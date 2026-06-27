export interface Config {
  databaseUrl: string;
  databasePoolMax: number;
  port: number;
  host: string;
  publicUrl: string;
  ingestBuffer: {
    maxEvents: number;
    maxDelayMs: number;
    maxPendingEvents: number;
  };
  mcpRunner: {
    command: string;
    args: string[];
    packageStatus: 'published' | 'publish_pending';
    note: string;
  };
  auth: {
    issuer: string;
    audience: string;
    jwksUri: string;
  } | null;
}

function parseArgs(raw: string | undefined): string[] {
  if (!raw?.trim()) return ['--silent', 'dlx', '@poolstatis/mcp'];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
      throw new Error('POOLSTATIS_MCP_ARGS must be a JSON string array or a whitespace-separated string');
    }
    return parsed;
  }
  return trimmed.split(/\s+/);
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
  const issuer = env.AUTH_JWT_ISSUER;
  const audience = env.AUTH_JWT_AUDIENCE;
  const jwksUri = env.AUTH_JWKS_URI ?? (issuer ? new URL('.well-known/jwks.json', issuer).toString() : undefined);
  const packageStatus = env.POOLSTATIS_MCP_PACKAGE_PUBLISHED === 'true' ? 'published' : 'publish_pending';
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
    publicUrl: (env.POOLSTATIS_PUBLIC_URL ?? 'https://api.poolstatis.com').replace(/\/$/, ''),
    ingestBuffer,
    mcpRunner: {
      command: env.POOLSTATIS_MCP_COMMAND ?? 'pnpm',
      args: parseArgs(env.POOLSTATIS_MCP_ARGS),
      packageStatus,
      note: packageStatus === 'published'
        ? 'The configured MCP runner is marked published for this hosted deployment.'
        : 'Publish or configure the MCP runner before treating this template as copy-paste ready.',
    },
    auth: issuer && audience && jwksUri ? { issuer, audience, jwksUri } : null,
  };
}
