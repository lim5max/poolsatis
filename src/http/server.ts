import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import type pg from 'pg';
import { ApiError, badRequest, notFound } from '../errors.js';
import { authenticate, requireKind, type AuthContext } from './auth.js';
import { createContext, type AppContext } from './context.js';
import { getProjectBySlug, listProjects, type Project } from '../services/projects.js';
import {
  defineFunnel, listFunnels, listMetrics, registerEntityType, registerMetric, updateMetric,
} from '../services/registry.js';
import { upsertEntities } from '../services/entities.js';
import { createInsight, listInsights, setInsightStatus } from '../services/insights.js';
import { getProjectSchema } from '../services/schema.js';
import {
  defineFunnelSchema, entityUpsertSchema, ingestEnvelopeSchema, querySchema,
  registerEntityTypeSchema, registerMetricSchema, updateMetricSchema,
} from '../schemas.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

export function buildServer(pool: pg.Pool): FastifyInstance {
  const ctx = createContext(pool);
  const app = Fastify({ logger: false, bodyLimit: 1024 * 1024 });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ApiError) {
      return reply.status(err.statusCode).send(err.toBody());
    }
    if (err instanceof ZodError) {
      const issue = err.issues[0];
      return reply.status(400).send({
        error: {
          code: 'validation_error',
          message: issue ? `${issue.path.join('.') || 'body'}: ${issue.message}` : 'invalid request body',
          hint: 'see the API reference in docs/04-http-api.md',
        },
      });
    }
    const fastifyErr = err as { statusCode?: number; code?: string; message?: string };
    if (typeof fastifyErr.statusCode === 'number' && fastifyErr.statusCode < 500) {
      return reply.status(fastifyErr.statusCode).send({
        error: { code: fastifyErr.code ?? 'bad_request', message: fastifyErr.message ?? 'bad request' },
      });
    }
    app.log?.error?.(err);
    return reply.status(500).send({ error: { code: 'internal', message: 'internal error' } });
  });

  app.addHook('onRequest', async (req) => {
    req.auth = await authenticate(pool, req.headers.authorization);
  });

  registerIngestRoutes(app, ctx);
  registerPlatformRoutes(app, ctx);
  return app;
}

// ===== Ingest (/i/v1, pk_ keys) =====

function registerIngestRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.post('/i/v1/events', async (req, reply) => {
    requireKind(req.auth, 'ingest');
    const project = await ingestProject(ctx, req.auth);
    const body = ingestEnvelopeSchema.parse(req.body);
    const result = await ctx.ingest.processBatch(project, req.auth.env, body);
    return reply.status(result.errors ? 207 : 200).send(result);
  });

  app.post('/i/v1/entities', async (req) => {
    requireKind(req.auth, 'ingest');
    const project = await ingestProject(ctx, req.auth);
    const body = entityUpsertSchema.parse(req.body);
    return upsertEntities(ctx.pool, project.id, req.auth.env, body);
  });
}

async function ingestProject(
  ctx: AppContext,
  auth: AuthContext,
): Promise<{ id: string; retention_months: number }> {
  const { rows } = await ctx.pool.query(
    'SELECT id, retention_months FROM projects WHERE id = $1',
    [auth.projectId],
  );
  if (!rows[0]) throw notFound('project');
  return rows[0];
}

// ===== Platform (/api/v1, sk_/pt_ keys) =====

function registerPlatformRoutes(app: FastifyInstance, ctx: AppContext): void {
  const platform = (req: FastifyRequest) => requireKind(req.auth, 'secret', 'personal');

  /** Resolve :slug within the caller's scope; secret keys are pinned to their project. */
  const resolveProject = async (req: FastifyRequest): Promise<Project> => {
    const { slug } = req.params as { slug: string };
    const project = await getProjectBySlug(ctx.pool, req.auth.orgId, slug);
    if (req.auth.kind === 'secret' && req.auth.projectId !== project.id) {
      throw new ApiError(403, 'project_scope', 'this secret key belongs to a different project');
    }
    return project;
  };

  app.get('/api/v1/projects', async (req) => {
    platform(req);
    if (req.auth.kind === 'secret') {
      const { rows } = await ctx.pool.query(
        'SELECT slug, name, timezone FROM projects WHERE id = $1',
        [req.auth.projectId],
      );
      return { projects: rows };
    }
    const projects = await listProjects(ctx.pool, req.auth.orgId);
    return { projects: projects.map(({ slug, name, timezone }) => ({ slug, name, timezone })) };
  });

  app.get('/api/v1/projects/:slug/schema', async (req) => {
    platform(req);
    const project = await resolveProject(req);
    const { env } = req.query as { env?: string };
    return getProjectSchema(ctx.pool, ctx.eventStore, project, env ?? 'prod');
  });

  app.post('/api/v1/projects/:slug/metrics', async (req, reply) => {
    platform(req);
    const project = await resolveProject(req);
    const input = registerMetricSchema.parse(req.body);
    const metric = await registerMetric(ctx.pool, project.id, input, `key:${req.auth.keyId}`);
    ctx.ingest.invalidateRegistry(project.id);
    return reply.status(201).send(metric);
  });

  app.patch('/api/v1/projects/:slug/metrics/:key', async (req) => {
    platform(req);
    const project = await resolveProject(req);
    const { key } = req.params as { key: string };
    const patch = updateMetricSchema.parse(req.body);
    const metric = await updateMetric(ctx.pool, project.id, key, patch);
    ctx.ingest.invalidateRegistry(project.id);
    return metric;
  });

  app.get('/api/v1/projects/:slug/metrics', async (req) => {
    platform(req);
    const project = await resolveProject(req);
    const { status, category } = req.query as { status?: string; category?: string };
    return { metrics: await listMetrics(ctx.pool, project.id, { ...(status && { status }), ...(category && { category }) }) };
  });

  app.post('/api/v1/projects/:slug/entity-types', async (req, reply) => {
    platform(req);
    const project = await resolveProject(req);
    const input = registerEntityTypeSchema.parse(req.body);
    return reply.status(201).send(await registerEntityType(ctx.pool, project.id, input));
  });

  app.post('/api/v1/projects/:slug/funnels', async (req, reply) => {
    platform(req);
    const project = await resolveProject(req);
    const input = defineFunnelSchema.parse(req.body);
    return reply.status(201).send(await defineFunnel(ctx.pool, project.id, input));
  });

  app.get('/api/v1/projects/:slug/funnels', async (req) => {
    platform(req);
    const project = await resolveProject(req);
    return { funnels: await listFunnels(ctx.pool, project.id) };
  });

  app.post('/api/v1/projects/:slug/query', async (req) => {
    platform(req);
    const project = await resolveProject(req);
    const q = querySchema.parse(req.body);
    return ctx.query.run(project.id, q);
  });

  app.get('/api/v1/projects/:slug/events/sample', async (req) => {
    platform(req);
    const project = await resolveProject(req);
    const { event, registered, limit, env } = req.query as {
      event?: string; registered?: string; limit?: string; env?: string;
    };
    const parsedLimit = limit ? Number(limit) : 20;
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      throw badRequest('invalid_limit', 'limit must be an integer between 1 and 100');
    }
    const events = await ctx.eventStore.sample({
      projectId: project.id,
      limit: parsedLimit,
      ...(env !== undefined && { env }),
      ...(event !== undefined && { event }),
      ...(registered !== undefined && { registered: registered === 'true' }),
    });
    return { events };
  });

  app.get('/api/v1/projects/:slug/insights', async (req) => {
    platform(req);
    const project = await resolveProject(req);
    const { status, kind } = req.query as { status?: string; kind?: string };
    return { insights: await listInsights(ctx.pool, project.id, { ...(status && { status }), ...(kind && { kind }) }) };
  });

  app.post('/api/v1/projects/:slug/insights', async (req, reply) => {
    platform(req);
    const project = await resolveProject(req);
    const body = req.body as { title?: string; body?: string; query?: unknown; severity?: string };
    if (!body?.title || !body?.body) {
      throw badRequest('validation_error', 'title and body are required');
    }
    return reply.status(201).send(
      await createInsight(ctx.pool, project.id, {
        title: body.title,
        body: body.body,
        ...(body.query !== undefined && { query: body.query }),
        ...(body.severity !== undefined && { severity: body.severity }),
      }),
    );
  });

  app.patch('/api/v1/projects/:slug/insights/:id', async (req) => {
    platform(req);
    const project = await resolveProject(req);
    const { id } = req.params as { id: string };
    const { status } = req.body as { status?: string };
    if (status !== 'ack' && status !== 'resolved') {
      throw badRequest('validation_error', 'status must be "ack" or "resolved"');
    }
    return setInsightStatus(ctx.pool, project.id, id, status);
  });
}
