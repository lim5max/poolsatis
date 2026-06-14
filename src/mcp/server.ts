/**
 * Poolsatis MCP server: a thin wrapper over the Platform API.
 * No business logic lives here — tools map 1:1 onto REST calls, so the same
 * server works against a local instance or a hosted one.
 *
 * Env: POOLSATIS_URL (default http://127.0.0.1:3300), POOLSATIS_TOKEN (pt_/sk_).
 */
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  defineFunnelSchema, entitiesQuerySchema, funnelQuerySchema,
  registerEntityTypeSchema, registerMetricSchema, trendQuerySchema, updateMetricSchema,
} from '../schemas.js';
import { INSTRUMENTATION_STANDARD } from './standard.js';

const BASE_URL = process.env.POOLSATIS_URL ?? 'http://127.0.0.1:3300';
const TOKEN = process.env.POOLSATIS_TOKEN;

if (!TOKEN) {
  console.error('POOLSATIS_TOKEN is required (a pt_ personal token or sk_ secret key)');
  process.exit(1);
}

async function api(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = (await res.json().catch(() => null)) as
    | { error?: { code: string; message: string; hint?: string } }
    | null;
  if (!res.ok) {
    const err = json?.error;
    const hint = err?.hint ? `\nhint: ${err.hint}` : '';
    throw new Error(`${err?.code ?? res.status}: ${err?.message ?? 'request failed'}${hint}`);
  }
  return json;
}

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

/** Errors are returned as content, not thrown: the message + hint is the agent's documentation. */
function wrap<A>(fn: (args: A) => Promise<unknown>): (args: A) => Promise<ToolResult> {
  return async (args) => {
    try {
      return ok(await fn(args));
    } catch (err) {
      return { isError: true, content: [{ type: 'text', text: (err as Error).message }] };
    }
  };
}

const server = new McpServer({ name: 'poolsatis', version: '0.1.0' });
const project = z.string().describe('project slug, see list_projects');

// ===== Context =====

server.tool(
  'list_projects',
  'List projects this token can access.',
  {},
  wrap(() => api('GET', '/api/v1/projects')),
);

server.tool(
  'get_project_schema',
  'Everything about a project in one read: registered metrics, funnels, entity types, and actual event names seen in the last 30 days with their registered share. Read this before registering anything.',
  { project, env: z.string().default('prod') },
  wrap(({ project: slug, env }) => api('GET', `/api/v1/projects/${slug}/schema?env=${encodeURIComponent(env)}`)),
);

// ===== Registry (design-time) =====

server.tool(
  'register_metric',
  'Register a metric in the project registry. `purpose` must be a real sentence — what decision does this metric inform? New metrics start as status=proposed; the project owner activates them.',
  { project, metric: registerMetricSchema },
  wrap(({ project: slug, metric }) => api('POST', `/api/v1/projects/${slug}/metrics`, metric)),
);

server.tool(
  'update_metric',
  'Update a registry metric: rename, refine purpose, change source, or move status (proposed → active → deprecated).',
  { project, key: z.string(), patch: updateMetricSchema },
  wrap(({ project: slug, key, patch }) => api('PATCH', `/api/v1/projects/${slug}/metrics/${key}`, patch)),
);

server.tool(
  'list_metrics',
  'List registry metrics, optionally filtered by status or category.',
  {
    project,
    status: z.enum(['proposed', 'active', 'deprecated']).optional(),
    category: z.string().optional(),
  },
  wrap(({ project: slug, status, category }) => {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (category) qs.set('category', category);
    const suffix = qs.size ? `?${qs}` : '';
    return api('GET', `/api/v1/projects/${slug}/metrics${suffix}`);
  }),
);

server.tool(
  'register_entity_type',
  'Declare an entity type (user, account, …) before upserting entities of that type.',
  { project, entity_type: registerEntityTypeSchema },
  wrap(({ project: slug, entity_type }) => api('POST', `/api/v1/projects/${slug}/entity-types`, entity_type)),
);

server.tool(
  'define_funnel',
  'Define a funnel from registry metrics (not raw events). `goal` must say what the funnel is for — it feeds the insights layer.',
  { project, funnel: defineFunnelSchema },
  wrap(({ project: slug, funnel }) => api('POST', `/api/v1/projects/${slug}/funnels`, funnel)),
);

server.tool(
  'list_funnels',
  'List defined funnels with their goals and steps.',
  { project },
  wrap(({ project: slug }) => api('GET', `/api/v1/projects/${slug}/funnels`)),
);

// ===== Queries (analysis-time) =====

server.tool(
  'query_trend',
  'Time series for a registry metric. Dates: relative ("-30d", "-12h") or ISO. Optional breakdown by an event property (top 10 + $other).',
  { project, query: trendQuerySchema.omit({ kind: true }) },
  wrap(({ project: slug, query }) => api('POST', `/api/v1/projects/${slug}/query`, { kind: 'trend', ...query })),
);

server.tool(
  'query_funnel',
  'Step-by-step conversion for a saved funnel (by key) or inline steps (registry metric keys).',
  { project, query: funnelQuerySchema.omit({ kind: true }) },
  wrap(({ project: slug, query }) => api('POST', `/api/v1/projects/${slug}/query`, { kind: 'funnel', ...query })),
);

server.tool(
  'query_entities',
  'Filter and sort entities by their current properties.',
  { project, query: entitiesQuerySchema.omit({ kind: true }) },
  wrap(({ project: slug, query }) => api('POST', `/api/v1/projects/${slug}/query`, { kind: 'entities', ...query })),
);

server.tool(
  'sample_events',
  'Latest raw events — use to verify instrumentation works (did the event arrive? is it registered?).',
  {
    project,
    event: z.string().optional(),
    registered: z.boolean().optional(),
    limit: z.number().int().min(1).max(100).default(20),
    env: z.string().default('prod'),
  },
  wrap(({ project: slug, event, registered, limit, env }) => {
    const qs = new URLSearchParams({ limit: String(limit), env });
    if (event) qs.set('event', event);
    if (registered !== undefined) qs.set('registered', String(registered));
    return api('GET', `/api/v1/projects/${slug}/events/sample?${qs}`);
  }),
);

// ===== Insights =====

server.tool(
  'list_insights',
  'List insights (manual notes and auto findings).',
  {
    project,
    status: z.enum(['open', 'ack', 'resolved']).optional(),
    kind: z.enum(['manual', 'auto']).optional(),
  },
  wrap(({ project: slug, status, kind }) => {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    if (kind) qs.set('kind', kind);
    const suffix = qs.size ? `?${qs}` : '';
    return api('GET', `/api/v1/projects/${slug}/insights${suffix}`);
  }),
);

server.tool(
  'create_insight',
  'Save a finding: title, markdown body, and optionally the query that reproduces it.',
  {
    project,
    title: z.string().min(1),
    body: z.string().min(1),
    query: z.record(z.unknown()).optional(),
    severity: z.enum(['info', 'warning', 'critical']).optional(),
  },
  wrap(({ project: slug, ...rest }) => api('POST', `/api/v1/projects/${slug}/insights`, rest)),
);

server.tool(
  'resolve_insight',
  'Acknowledge or resolve an insight.',
  { project, id: z.string().uuid(), status: z.enum(['ack', 'resolved']) },
  wrap(({ project: slug, id, status }) => api('PATCH', `/api/v1/projects/${slug}/insights/${id}`, { status })),
);

// ===== Resources =====

server.resource(
  'instrumentation-standard',
  'poolsatis://standard/instrumentation',
  async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: INSTRUMENTATION_STANDARD }],
  }),
);

server.resource(
  'project-schema',
  new ResourceTemplate('poolsatis://{project}/schema', { list: undefined }),
  async (uri, { project: slug }) => {
    const schema = await api('GET', `/api/v1/projects/${String(slug)}/schema`);
    return {
      contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(schema, null, 2) }],
    };
  },
);

await server.connect(new StdioServerTransport());
