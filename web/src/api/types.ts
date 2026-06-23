// Mirrors the Platform API response shapes (src/http/server.ts + services).

export type MetricCategory =
  | 'acquisition' | 'activation' | 'retention' | 'revenue' | 'referral' | 'quality';

export type MetricType = 'count' | 'unique_actors' | 'value' | 'conversion' | 'state';
export type MetricStatus = 'proposed' | 'active' | 'deprecated';

export interface Metric {
  id: string;
  key: string;
  name: string;
  purpose: string;
  category: MetricCategory | null;
  tags: string[];
  type: MetricType;
  source: Record<string, unknown>;
  status: MetricStatus;
  owner: string | null;
  deprecation_reason: string | null;
  deprecated_at: string | null;
}

export interface FunnelStep {
  metric_key: string;
  label: string;
}

export interface Funnel {
  id: string;
  key: string;
  name: string;
  goal: string;
  steps: FunnelStep[];
  window_seconds: number;
}

export interface EntityType {
  name: string;
  description: string;
  prop_schema: unknown;
}

export interface ObservedEvent {
  event: string;
  count: number;
  registered_share: number; // 0..1
  last_seen: string;
}

export interface ProjectWithStats {
  slug: string;
  name: string;
  timezone: string;
  active_metrics: number;
  funnels: number;
  events_30d: number;
}

export interface ProjectSchema {
  project: { slug: string; name: string };
  env: string;
  metrics: Metric[];
  funnels: Funnel[];
  entity_types: EntityType[];
  observed_events_30d: ObservedEvent[];
}

export interface SampleEvent {
  event: string;
  timestamp: string;
  distinct_id: string;
  session_id: string | null;
  properties: Record<string, unknown>;
  registered: boolean;
  env: string;
}

export interface EntityRow {
  entity_id: string;
  properties: Record<string, unknown>;
  updated_at: string;
}

export type FilterOp = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'is_set' | 'is_not_set';
export interface SampleFilter {
  property: string;
  op: FilterOp;
  value?: string | number | Array<string | number>;
}

export interface ActorSummary {
  first_seen: string | null;
  last_seen: string | null;
  total_events: number;
  distinct_events: number;
  active_days: number;
  sessions: number;
  registered_share: number;
  top_events: Array<{ event: string; count: number }>;
}

export interface PersonSummary {
  distinct_id: string;
  env: string;
  summary: ActorSummary;
  entity: { entity_type: string; properties: Record<string, unknown>; updated_at: string } | null;
}

export interface IngestWarning {
  kind: 'rejected' | 'unregistered' | 'clock_skew';
  event: string;
  detail: string;
  sample: unknown;
  count: number;
  first_seen: string;
  last_seen: string;
}

export interface DataQualityIssue {
  kind: 'entity_event_status_conflict';
  severity: 'warning';
  entity_type: string;
  entity_id: string;
  current_status: string;
  expected_status: string;
  event: string;
  evidence_events: number;
  last_event_at: string;
  entity_updated_at: string;
  message: string;
}

export interface DataQualityResponse {
  issues: DataQualityIssue[];
  checked: { terminal_event_specs: number; evidence_rows: number };
}

export interface MetricUsage {
  metric: Metric;
  env: string;
  since_days: number;
  source_events: string[];
  observed_events: ObservedEvent[];
  used_by: {
    funnels: Array<{ key: string; name: string; goal: string; step_labels: string[]; window_seconds: number }>;
    insights: Array<{ id: string; title: string; status: string; severity: string | null; created_at: string }>;
  };
  guidance: string[];
}

export type KeyKind = 'ingest' | 'secret' | 'personal';

export interface ApiKeyRow {
  id: string;
  kind: KeyKind;
  env: string;
  label: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string; hint?: string };
}
