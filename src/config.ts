export interface Config {
  databaseUrl: string;
  databasePoolMax: number;
  port: number;
  host: string;
  ingestBuffer: {
    maxEvents: number;
    maxDelayMs: number;
    maxPendingEvents: number;
  };
}

const POSTGRES_APPEND_MAX_EVENTS = 8000;

function positiveInt(raw: string | undefined, fallback: number, name: string, max?: number): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  if (max !== undefined && value > max) {
    throw new Error(`${name} must be less than or equal to ${max}`);
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const ingestBuffer = {
    maxEvents: positiveInt(
      env.INGEST_BUFFER_MAX_EVENTS,
      1000,
      'INGEST_BUFFER_MAX_EVENTS',
      POSTGRES_APPEND_MAX_EVENTS,
    ),
    maxDelayMs: positiveInt(env.INGEST_BUFFER_MAX_DELAY_MS, 10, 'INGEST_BUFFER_MAX_DELAY_MS'),
    maxPendingEvents: positiveInt(env.INGEST_BUFFER_MAX_PENDING_EVENTS, 50_000, 'INGEST_BUFFER_MAX_PENDING_EVENTS'),
  };
  if (ingestBuffer.maxEvents > ingestBuffer.maxPendingEvents) {
    throw new Error('INGEST_BUFFER_MAX_EVENTS must be less than or equal to INGEST_BUFFER_MAX_PENDING_EVENTS');
  }
  return {
    databaseUrl:
      env.DATABASE_URL ??
      'postgres://poolsatis:poolsatis@localhost:5444/poolsatis',
    databasePoolMax: positiveInt(env.DATABASE_POOL_MAX, 10, 'DATABASE_POOL_MAX'),
    port: env.PORT ? Number(env.PORT) : 3300,
    host: env.HOST ?? '127.0.0.1',
    ingestBuffer,
  };
}
