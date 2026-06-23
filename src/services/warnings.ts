import type pg from 'pg';

export type WarningKind = 'rejected' | 'unregistered' | 'clock_skew';

export interface IngestWarning {
  kind: WarningKind;
  event: string;
  detail: string;
  sample: unknown;
  count: number;
  first_seen: string;
  last_seen: string;
}

/** One accumulated warning to upsert (count is how many occurred in this batch). */
export interface WarningDelta {
  kind: WarningKind;
  event: string;
  detail: string;
  sample?: unknown;
  count: number;
}

/**
 * Upsert a batch of warnings, deduped by (project, env, kind, event): a repeat
 * bumps `count` and `last_seen` rather than inserting a new row, so the table
 * stays bounded to one row per distinct (kind, event) regardless of volume.
 */
export async function recordWarnings(
  pool: pg.Pool,
  projectId: string,
  env: string,
  deltas: WarningDelta[],
): Promise<void> {
  if (deltas.length === 0) return;
  const params: unknown[] = [projectId, env];
  const rows = deltas.map((d) => {
    params.push(d.kind, d.event, d.detail, d.sample !== undefined ? JSON.stringify(d.sample) : null, d.count);
    const b = params.length - 5;
    return `($1, $2, $${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5})`;
  });
  await pool.query(
    `INSERT INTO ingest_warnings (project_id, env, kind, event, detail, sample, count)
     VALUES ${rows.join(', ')}
     ON CONFLICT (project_id, env, kind, event) DO UPDATE
       SET count = ingest_warnings.count + EXCLUDED.count,
           detail = EXCLUDED.detail,
           sample = COALESCE(EXCLUDED.sample, ingest_warnings.sample),
           last_seen = now()`,
    params,
  );
}

export async function listIngestWarnings(
  pool: pg.Pool,
  projectId: string,
  filter: { env?: string; kind?: WarningKind } = {},
): Promise<IngestWarning[]> {
  const params: unknown[] = [projectId];
  let sql = `SELECT kind, event, detail, sample, count, first_seen, last_seen
             FROM ingest_warnings WHERE project_id = $1`;
  if (filter.env) { params.push(filter.env); sql += ` AND env = $${params.length}`; }
  if (filter.kind) { params.push(filter.kind); sql += ` AND kind = $${params.length}`; }
  const { rows } = await pool.query(`${sql} ORDER BY last_seen DESC LIMIT 200`, params);
  return rows.map((r) => ({
    kind: r.kind, event: r.event, detail: r.detail, sample: r.sample,
    count: Number(r.count), first_seen: new Date(r.first_seen).toISOString(), last_seen: new Date(r.last_seen).toISOString(),
  }));
}

export async function clearIngestWarnings(pool: pg.Pool, projectId: string, env?: string): Promise<number> {
  const params: unknown[] = [projectId];
  let sql = 'DELETE FROM ingest_warnings WHERE project_id = $1';
  if (env) { params.push(env); sql += ` AND env = $${params.length}`; }
  const { rowCount } = await pool.query(sql, params);
  return rowCount ?? 0;
}
