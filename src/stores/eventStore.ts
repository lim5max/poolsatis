import type { PropertyFilter } from '../schemas.js';

/** A validated event ready for storage. */
export interface StorableEvent {
  projectId: string;
  env: string;
  event: string;
  timestamp: Date;
  distinctId: string;
  sessionId: string | null;
  properties: Record<string, unknown>;
  registered: boolean;
}

export interface TrendQuery {
  projectId: string;
  env: string;
  event: string;
  filters: PropertyFilter[];
  agg:
    | { kind: 'count' }
    | { kind: 'unique_actors' }
    | { kind: 'value'; property: string; fn: 'sum' | 'avg' | 'min' | 'max' | 'p90' };
  from: Date;
  to: Date;
  interval: 'hour' | 'day' | 'week' | 'month';
  breakdownProperty?: string;
}

export interface TrendPoint {
  bucket: string; // ISO timestamp of bucket start
  value: number;
  breakdown_value?: string;
}

export interface FunnelStepQuery {
  event: string;
  filters: PropertyFilter[];
}

export interface FunnelQuery {
  projectId: string;
  env: string;
  steps: FunnelStepQuery[];
  windowSeconds: number;
  from: Date;
  to: Date;
}

export interface SampleQuery {
  projectId: string;
  env?: string;
  event?: string;
  registered?: boolean;
  limit: number;
}

export interface RawEvent {
  event: string;
  timestamp: string;
  distinct_id: string;
  session_id: string | null;
  properties: Record<string, unknown>;
  registered: boolean;
  env: string;
}

export interface EventNameStat {
  event: string;
  count: number;
  registered_share: number;
  last_seen: string;
}

/**
 * The narrow storage interface the whole platform depends on.
 * Every method must be implementable efficiently on both Postgres and
 * ClickHouse — that constraint is what keeps the Query DSL small.
 */
export interface EventStore {
  append(events: StorableEvent[]): Promise<void>;
  trend(q: TrendQuery): Promise<TrendPoint[]>;
  funnel(q: FunnelQuery): Promise<number[]>; // actor count per step
  sample(q: SampleQuery): Promise<RawEvent[]>;
  eventNames(projectId: string, env: string, sinceDays: number): Promise<EventNameStat[]>;
}
