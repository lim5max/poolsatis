import type pg from 'pg';
import type { EventStore } from '../stores/eventStore.js';
import { PostgresEventStore } from '../stores/postgresEventStore.js';
import { IngestService } from '../services/ingest.js';
import { QueryService } from '../services/query.js';

/** Shared service wiring for the HTTP server, CLI, and tests. */
export interface AppContext {
  pool: pg.Pool;
  eventStore: EventStore;
  ingest: IngestService;
  query: QueryService;
}

export function createContext(pool: pg.Pool): AppContext {
  const eventStore = new PostgresEventStore(pool);
  return {
    pool,
    eventStore,
    ingest: new IngestService(pool, eventStore),
    query: new QueryService(pool, eventStore),
  };
}
