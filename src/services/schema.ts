import type pg from 'pg';
import type { EventStore } from '../stores/eventStore.js';
import { listEntityTypes, listFunnels, listMetrics } from './registry.js';

/**
 * The live project schema: everything an agent needs to reason about a
 * project in one read — registry, funnels, entity types, and the actual
 * event names seen in the last 30 days with their registered share.
 */
export async function getProjectSchema(
  pool: pg.Pool,
  eventStore: EventStore,
  project: { id: string; slug: string; name: string },
  env: string,
): Promise<Record<string, unknown>> {
  const [metrics, funnels, entityTypes, observedEvents] = await Promise.all([
    listMetrics(pool, project.id),
    listFunnels(pool, project.id),
    listEntityTypes(pool, project.id),
    eventStore.eventNames(project.id, env, 30),
  ]);
  return {
    project: { slug: project.slug, name: project.name },
    env,
    metrics,
    funnels,
    entity_types: entityTypes,
    observed_events_30d: observedEvents,
  };
}
