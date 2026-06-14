import type pg from 'pg';
import type { EventStore } from '../stores/eventStore.js';
import type {
  EntitiesQueryInput,
  FunnelQueryInput,
  PropertyFilter,
  QueryInput,
  TrendQueryInput,
} from '../schemas.js';
import { parseDateInput } from '../dates.js';
import { badRequest } from '../errors.js';
import { getFunnel, getMetric, type Metric } from './registry.js';
import { countEntities, queryEntities } from './entities.js';

export interface QueryMeta {
  computed_at: string;
  date_range?: { from: string; to: string };
  sampling: null;
  note?: string;
}

export type QueryResult =
  | { kind: 'trend'; series: Array<{ bucket: string; value: number; breakdown_value?: string }>; meta: QueryMeta }
  | {
      kind: 'funnel';
      steps: Array<{ label: string; actors: number; conversion_from_prev: number; conversion_from_start: number }>;
      meta: QueryMeta;
    }
  | { kind: 'entities'; entities: Array<{ entity_id: string; properties: Record<string, unknown>; updated_at: string }>; meta: QueryMeta };

export class QueryService {
  constructor(
    private readonly pool: pg.Pool,
    private readonly eventStore: EventStore,
  ) {}

  async run(projectId: string, q: QueryInput, now: Date = new Date()): Promise<QueryResult> {
    switch (q.kind) {
      case 'trend':
        return this.trend(projectId, q, now);
      case 'funnel':
        return this.funnel(projectId, q, now);
      case 'entities':
        return this.entities(projectId, q, now);
    }
  }

  private async trend(projectId: string, q: TrendQueryInput, now: Date): Promise<QueryResult> {
    const metric = await getMetric(this.pool, projectId, q.metric);
    const from = parseDateInput(q.date_from, now);
    const to = q.date_to ? parseDateInput(q.date_to, now) : now;
    const meta = (extra?: Partial<QueryMeta>): QueryMeta => ({
      computed_at: now.toISOString(),
      date_range: { from: from.toISOString(), to: to.toISOString() },
      sampling: null,
      ...extra,
    });

    if (metric.type === 'conversion') {
      throw badRequest(
        'metric_not_trendable',
        `metric "${metric.key}" has type=conversion`,
        'query it as a funnel: define metrics for its from/to events and use kind=funnel with inline steps',
      );
    }

    if (metric.type === 'state') {
      const source = metric.source as { entity_type: string; filters?: PropertyFilter[] };
      const count = await countEntities(
        this.pool, projectId, q.env, source.entity_type, source.filters ?? [],
      );
      return {
        kind: 'trend',
        series: [{ bucket: now.toISOString(), value: count }],
        meta: meta({ note: 'state metrics are snapshots of current entity state, not time series' }),
      };
    }

    const source = metric.source as {
      event: string;
      filters?: PropertyFilter[];
      value_property?: string;
      agg?: 'sum' | 'avg' | 'min' | 'max' | 'p90';
    };
    const agg =
      metric.type === 'count'
        ? ({ kind: 'count' } as const)
        : metric.type === 'unique_actors'
          ? ({ kind: 'unique_actors' } as const)
          : ({ kind: 'value', property: source.value_property!, fn: source.agg ?? 'sum' } as const);

    const series = await this.eventStore.trend({
      projectId,
      env: q.env,
      event: source.event,
      filters: source.filters ?? [],
      agg,
      from,
      to,
      interval: q.interval,
      ...(q.breakdown ? { breakdownProperty: q.breakdown.property } : {}),
    });
    return { kind: 'trend', series, meta: meta() };
  }

  private async funnel(projectId: string, q: FunnelQueryInput, now: Date): Promise<QueryResult> {
    if (Boolean(q.funnel) === Boolean(q.steps)) {
      throw badRequest(
        'invalid_funnel_query',
        'pass either a saved funnel key or inline steps, not both and not neither',
        'use {funnel: "<key>"} for a saved funnel, or {steps: [{metric: "..."}, ...]} for ad-hoc',
      );
    }
    const from = parseDateInput(q.date_from, now);
    const to = q.date_to ? parseDateInput(q.date_to, now) : now;

    let stepDefs: Array<{ label: string; metric: Metric }>;
    let windowSeconds: number;

    if (q.funnel) {
      const funnel = await getFunnel(this.pool, projectId, q.funnel);
      windowSeconds = funnel.window_seconds;
      stepDefs = await Promise.all(
        funnel.steps.map(async (s) => ({
          label: s.label,
          metric: await getMetric(this.pool, projectId, s.metric_key),
        })),
      );
    } else {
      windowSeconds = 604800;
      stepDefs = await Promise.all(
        q.steps!.map(async (s) => {
          const metric = await getMetric(this.pool, projectId, s.metric);
          return { label: metric.name, metric };
        }),
      );
    }

    for (const { metric } of stepDefs) {
      if (metric.type === 'conversion' || metric.type === 'state') {
        throw badRequest(
          'invalid_step_metric',
          `funnel step "${metric.key}" has type=${metric.type}; steps must be event-based`,
        );
      }
    }

    const counts = await this.eventStore.funnel({
      projectId,
      env: q.env,
      windowSeconds,
      from,
      to,
      steps: stepDefs.map(({ metric }) => {
        const source = metric.source as { event: string; filters?: PropertyFilter[] };
        return { event: source.event, filters: source.filters ?? [] };
      }),
    });

    const first = counts[0] ?? 0;
    return {
      kind: 'funnel',
      steps: counts.map((actors, i) => ({
        label: stepDefs[i]!.label,
        actors,
        conversion_from_prev: i === 0 ? 1 : ratio(actors, counts[i - 1]!),
        conversion_from_start: i === 0 ? 1 : ratio(actors, first),
      })),
      meta: {
        computed_at: now.toISOString(),
        date_range: { from: from.toISOString(), to: to.toISOString() },
        sampling: null,
      },
    };
  }

  private async entities(projectId: string, q: EntitiesQueryInput, now: Date): Promise<QueryResult> {
    const entities = await queryEntities(this.pool, projectId, q);
    return {
      kind: 'entities',
      entities,
      meta: { computed_at: now.toISOString(), sampling: null },
    };
  }
}

function ratio(num: number, denom: number): number {
  return denom === 0 ? 0 : Number((num / denom).toFixed(4));
}
