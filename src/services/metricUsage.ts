import type pg from 'pg';
import type { EventNameStat, EventStore } from '../stores/eventStore.js';
import { getMetric, type Metric } from './registry.js';

export interface MetricUsage {
  metric: Metric;
  env: string;
  since_days: number;
  source_events: string[];
  observed_events: EventNameStat[];
  used_by: {
    funnels: Array<{ key: string; name: string; goal: string; step_labels: string[]; window_seconds: number }>;
    insights: Array<{ id: string; title: string; status: string; severity: string | null; created_at: string }>;
  };
  guidance: string[];
}

export function metricSourceEvents(metric: Metric): string[] {
  const source = metric.source as Record<string, any>;
  if (metric.type === 'conversion') {
    return [source.from?.event, source.to?.event].filter(Boolean);
  }
  if (metric.type === 'state') return [];
  return source.event ? [source.event] : [];
}

export async function explainMetricUsage(
  pool: pg.Pool,
  eventStore: EventStore,
  projectId: string,
  key: string,
  env: string,
  sinceDays: number,
): Promise<MetricUsage> {
  const metric = await getMetric(pool, projectId, key);
  const sourceEvents = metricSourceEvents(metric);

  const [funnelRows, insightRows, observed] = await Promise.all([
    pool.query(
      `SELECT key, name, goal, steps, window_seconds
       FROM funnels
       WHERE project_id = $1 AND steps @> $2::jsonb
       ORDER BY created_at`,
      [projectId, JSON.stringify([{ metric_key: key }])],
    ),
    pool.query(
      `SELECT id, title, query, severity, status, created_at
       FROM insights
       WHERE project_id = $1 AND query::text LIKE $2 ESCAPE '\\'
       ORDER BY created_at DESC`,
      [projectId, `%${escapeLikePattern(JSON.stringify(key))}%`],
    ),
    eventStore.eventStats({ projectId, env, sinceDays, events: sourceEvents }),
  ]);

  const usedBy = {
    funnels: funnelRows.rows.map((row) => ({
      key: row.key as string,
      name: row.name as string,
      goal: row.goal as string,
      step_labels: Array.isArray(row.steps)
        ? row.steps
            .filter((step: { metric_key?: unknown }) => step.metric_key === key)
            .map((step: { label?: unknown }) => String(step.label ?? ''))
            .filter(Boolean)
        : [],
      window_seconds: Number(row.window_seconds),
    })),
    insights: insightRows.rows.map((row) => ({
        id: row.id as string,
        title: row.title as string,
        status: row.status as string,
        severity: row.severity as string | null,
        created_at: toIso(row.created_at),
      })),
  };

  const guidance: string[] = [];
  if (usedBy.funnels.length > 0) {
    guidance.push('delete_metric will refuse this metric until dependent funnels are removed or edited.');
  }
  if (metric.status === 'deprecated') {
    guidance.push(`metric is deprecated: ${metric.deprecation_reason}`);
  }
  if (sourceEvents.length > 0 && observed.length === 0) {
    guidance.push(`no source events were observed in env=${env} over the last ${sinceDays} days.`);
  }
  if (metric.type === 'state') {
    guidance.push('state metrics read current entity rows; use query_entities to inspect the underlying state.');
  }

  return {
    metric,
    env,
    since_days: sinceDays,
    source_events: sourceEvents,
    observed_events: observed,
    used_by: usedBy,
    guidance,
  };
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
