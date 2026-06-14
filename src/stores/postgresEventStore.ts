import type pg from 'pg';
import type {
  EventStore,
  EventNameStat,
  FunnelQuery,
  RawEvent,
  SampleQuery,
  StorableEvent,
  TrendPoint,
  TrendQuery,
} from './eventStore.js';
import { compileFilters, numericPropSql } from './filters.js';

export class PostgresEventStore implements EventStore {
  private readonly knownPartitions = new Set<string>();

  constructor(private readonly pool: pg.Pool) {}

  async append(events: StorableEvent[]): Promise<void> {
    if (events.length === 0) return;
    await this.ensurePartitions(events.map((e) => e.timestamp));

    const params: unknown[] = [];
    const rows = events.map((e) => {
      params.push(
        e.projectId, e.env, e.event, e.timestamp, e.distinctId,
        e.sessionId, JSON.stringify(e.properties), e.registered,
      );
      const base = params.length - 8;
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8})`;
    });
    await this.pool.query(
      `INSERT INTO events (project_id, env, event, "timestamp", distinct_id, session_id, properties, registered)
       VALUES ${rows.join(', ')}`,
      params,
    );
  }

  async trend(q: TrendQuery): Promise<TrendPoint[]> {
    const params: unknown[] = [q.projectId, q.env, q.event, q.from, q.to];
    const where = [
      'project_id = $1',
      'env = $2',
      'event = $3',
      '"timestamp" >= $4',
      '"timestamp" < $5',
      ...compileFilters(q.filters, 'properties', params),
    ].join(' AND ');

    params.push(q.interval);
    // date_trunc on timestamptz truncates in the session timezone; the
    // platform pins it to UTC per connection (see createPool consumers).
    const bucketExpr = `date_trunc($${params.length}, "timestamp")`;

    let valueExpr: string;
    let aggExpr: string;
    switch (q.agg.kind) {
      case 'count':
        valueExpr = '1';
        aggExpr = 'count(*)';
        break;
      case 'unique_actors':
        valueExpr = 'distinct_id';
        aggExpr = 'count(DISTINCT val)';
        break;
      case 'value': {
        params.push(q.agg.property);
        valueExpr = numericPropSql('properties', params.length);
        aggExpr =
          q.agg.fn === 'p90'
            ? 'percentile_cont(0.9) WITHIN GROUP (ORDER BY val)'
            : `${q.agg.fn}(val)`;
        break;
      }
    }

    if (!q.breakdownProperty) {
      const sql = `
        SELECT ${bucketExpr} AS bucket, ${aggExpr} AS value
        FROM (SELECT "timestamp", ${valueExpr} AS val FROM events WHERE ${where}) src
        GROUP BY 1 ORDER BY 1`;
      const { rows } = await this.pool.query(sql, params);
      return rows.map((r) => ({ bucket: toIso(r.bucket), value: Number(r.value ?? 0) }));
    }

    params.push(q.breakdownProperty);
    const bvExpr = `COALESCE(properties->>$${params.length}, '(none)')`;
    // Top 10 breakdown values by row count; the long tail is re-aggregated
    // under '$other' from raw rows, so avg/p90 stay mathematically correct.
    const sql = `
      WITH raw AS (
        SELECT ${bucketExpr} AS bucket, ${bvExpr} AS bv, ${valueExpr} AS val
        FROM events WHERE ${where}
      ),
      top AS (
        SELECT bv FROM raw GROUP BY bv ORDER BY count(*) DESC, bv LIMIT 10
      )
      SELECT bucket,
             CASE WHEN raw.bv IN (SELECT bv FROM top) THEN raw.bv ELSE '$other' END AS bv,
             ${aggExpr} AS value
      FROM raw
      GROUP BY 1, 2
      ORDER BY 1, 2`;
    const { rows } = await this.pool.query(sql, params);
    return rows.map((r) => ({
      bucket: toIso(r.bucket),
      value: Number(r.value ?? 0),
      breakdown_value: String(r.bv),
    }));
  }

  async funnel(q: FunnelQuery): Promise<number[]> {
    const params: unknown[] = [q.projectId, q.env, q.from, q.to, q.windowSeconds];
    const ctes: string[] = [];

    q.steps.forEach((step, i) => {
      params.push(step.event);
      const eventParam = params.length;
      const filterClauses = compileFilters(step.filters, 'e.properties', params)
        .map((c) => ` AND ${c}`)
        .join('');
      if (i === 0) {
        ctes.push(`s0 AS (
          SELECT e.distinct_id, min(e."timestamp") AS t, min(e."timestamp") AS t0
          FROM events e
          WHERE e.project_id = $1 AND e.env = $2 AND e.event = $${eventParam}
            AND e."timestamp" >= $3 AND e."timestamp" < $4${filterClauses}
          GROUP BY e.distinct_id
        )`);
      } else {
        // Each step must happen after the previous step, within the window
        // anchored at the *first* step (t0), matching how activation windows
        // are usually defined.
        ctes.push(`s${i} AS (
          SELECT e.distinct_id, min(e."timestamp") AS t, s${i - 1}.t0
          FROM events e
          JOIN s${i - 1} ON s${i - 1}.distinct_id = e.distinct_id
          WHERE e.project_id = $1 AND e.env = $2 AND e.event = $${eventParam}
            AND e."timestamp" > s${i - 1}.t
            AND e."timestamp" <= s${i - 1}.t0 + make_interval(secs => $5)${filterClauses}
          GROUP BY e.distinct_id, s${i - 1}.t0
        )`);
      }
    });

    const selects = q.steps.map((_, i) => `(SELECT count(*) FROM s${i}) AS c${i}`);
    const sql = `WITH ${ctes.join(', ')} SELECT ${selects.join(', ')}`;
    const { rows } = await this.pool.query(sql, params);
    return q.steps.map((_, i) => Number(rows[0][`c${i}`]));
  }

  async sample(q: SampleQuery): Promise<RawEvent[]> {
    const params: unknown[] = [q.projectId];
    const where = ['project_id = $1'];
    if (q.env !== undefined) {
      params.push(q.env);
      where.push(`env = $${params.length}`);
    }
    if (q.event !== undefined) {
      params.push(q.event);
      where.push(`event = $${params.length}`);
    }
    if (q.registered !== undefined) {
      params.push(q.registered);
      where.push(`registered = $${params.length}`);
    }
    params.push(q.limit);
    const sql = `
      SELECT event, "timestamp", distinct_id, session_id, properties, registered, env
      FROM events WHERE ${where.join(' AND ')}
      ORDER BY ingested_at DESC LIMIT $${params.length}`;
    const { rows } = await this.pool.query(sql, params);
    return rows.map((r) => ({
      event: r.event,
      timestamp: toIso(r.timestamp),
      distinct_id: r.distinct_id,
      session_id: r.session_id,
      properties: r.properties,
      registered: r.registered,
      env: r.env,
    }));
  }

  async eventNames(projectId: string, env: string, sinceDays: number): Promise<EventNameStat[]> {
    const { rows } = await this.pool.query(
      `SELECT event, count(*) AS count, avg(registered::int) AS registered_share,
              max("timestamp") AS last_seen
       FROM events
       WHERE project_id = $1 AND env = $2 AND "timestamp" >= now() - make_interval(days => $3)
       GROUP BY event ORDER BY count DESC`,
      [projectId, env, sinceDays],
    );
    return rows.map((r) => ({
      event: r.event,
      count: Number(r.count),
      registered_share: Number(r.registered_share),
      last_seen: toIso(r.last_seen),
    }));
  }

  /**
   * Create monthly partitions for every month present in the batch.
   * The DEFAULT partition is a safety net, but routing rows to monthly
   * partitions keeps retention cheap (DROP TABLE instead of DELETE).
   */
  private async ensurePartitions(timestamps: Date[]): Promise<void> {
    const months = new Set<string>();
    for (const ts of timestamps) {
      months.add(`${ts.getUTCFullYear()}-${String(ts.getUTCMonth() + 1).padStart(2, '0')}`);
    }
    for (const month of months) {
      if (this.knownPartitions.has(month)) continue;
      const [y, m] = month.split('-').map(Number) as [number, number];
      const from = `${y}-${String(m).padStart(2, '0')}-01`;
      const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const table = `events_y${y}m${String(m).padStart(2, '0')}`;
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        // Advisory lock serializes concurrent partition creation across workers.
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [table]);
        await client.query(
          `CREATE TABLE IF NOT EXISTS ${table} PARTITION OF events
           FOR VALUES FROM ('${from}') TO ('${next}')`,
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        // A row for this month will land in the DEFAULT partition instead —
        // ingest must not fail because partition DDL raced or was denied.
        if (!isPartitionOverlapError(err)) throw err;
      } finally {
        client.release();
      }
      this.knownPartitions.add(month);
    }
  }
}

function isPartitionOverlapError(err: unknown): boolean {
  // 42P17 invalid_object_definition: thrown when the DEFAULT partition already
  // holds rows that would belong to the new partition.
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '42P17';
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
