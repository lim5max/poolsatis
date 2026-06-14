import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, createTestEnv, type TestEnv } from './helpers.js';

let env: TestEnv;
const P = () => `/api/v1/projects/${env.projectSlug}`;

beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(() => env.close());

describe('metric registry', () => {
  it('registers a metric as proposed', async () => {
    const res = await api(env, env.secretToken, 'POST', `${P()}/metrics`, {
      key: 'checkout_completed',
      name: 'Checkouts completed',
      purpose: 'Counts successful checkouts to track revenue-generating conversion.',
      category: 'revenue',
      type: 'count',
      source: { event: 'checkout.completed' },
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('proposed');
    expect(res.body.key).toBe('checkout_completed');
  });

  it('rejects a lazy purpose', async () => {
    const res = await api(env, env.secretToken, 'POST', `${P()}/metrics`, {
      key: 'lazy_metric',
      name: 'Lazy',
      purpose: 'clicks',
      type: 'count',
      source: { event: 'x.clicked' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  it('rejects a source that does not match the metric type', async () => {
    const res = await api(env, env.secretToken, 'POST', `${P()}/metrics`, {
      key: 'bad_source',
      name: 'Bad source',
      purpose: 'A metric whose source is missing the value_property field.',
      type: 'value',
      source: { event: 'checkout.completed' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('value_property');
  });

  it('returns 409 with a hint on duplicate key', async () => {
    const res = await api(env, env.secretToken, 'POST', `${P()}/metrics`, {
      key: 'checkout_completed',
      name: 'Duplicate',
      purpose: 'Attempting to register the same key twice should conflict.',
      type: 'count',
      source: { event: 'other.event' },
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('metric_key_taken');
    expect(res.body.error.hint).toContain('update_metric');
  });

  it('rejects a state metric referencing an unregistered entity type', async () => {
    const res = await api(env, env.secretToken, 'POST', `${P()}/metrics`, {
      key: 'ghost_accounts',
      name: 'Ghost accounts',
      purpose: 'Counts entities of a type that was never registered in the project.',
      type: 'state',
      source: { entity_type: 'ghost' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('unknown_entity_type');
    expect(res.body.error.hint).toContain('register_entity_type');
  });

  it('returns 404 when updating a metric that does not exist', async () => {
    const res = await api(env, env.secretToken, 'PATCH', `${P()}/metrics/ghost_metric`, {
      status: 'active',
    });
    expect(res.status).toBe(404);
  });

  it('activates a metric via PATCH', async () => {
    const res = await api(env, env.secretToken, 'PATCH', `${P()}/metrics/checkout_completed`, {
      status: 'active',
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
  });

  it('lists metrics filtered by status', async () => {
    const res = await api(env, env.secretToken, 'GET', `${P()}/metrics?status=active`);
    expect(res.status).toBe(200);
    expect(res.body.metrics.map((m: any) => m.key)).toEqual(['checkout_completed']);
  });
});

describe('funnels', () => {
  it('rejects a funnel referencing an unknown metric', async () => {
    const res = await api(env, env.secretToken, 'POST', `${P()}/funnels`, {
      key: 'broken_funnel',
      name: 'Broken',
      goal: 'This funnel references a metric that was never registered.',
      steps: [
        { metric_key: 'checkout_completed', label: 'Checkout' },
        { metric_key: 'ghost_metric', label: 'Ghost' },
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('unknown_step_metric');
  });

  it('defines a funnel over registry metrics', async () => {
    await api(env, env.secretToken, 'POST', `${P()}/metrics`, {
      key: 'signup_completed',
      name: 'Signups',
      purpose: 'Counts completed signups as the activation funnel entry point.',
      type: 'count',
      source: { event: 'signup.completed' },
    });
    const res = await api(env, env.secretToken, 'POST', `${P()}/funnels`, {
      key: 'purchase_funnel',
      name: 'Purchase funnel',
      goal: 'Take a new signup to their first completed checkout.',
      steps: [
        { metric_key: 'signup_completed', label: 'Signup' },
        { metric_key: 'checkout_completed', label: 'Checkout' },
      ],
      window_seconds: 86400,
    });
    expect(res.status).toBe(201);
    expect(res.body.steps).toHaveLength(2);
  });
});

describe('entity types', () => {
  it('registers and conflicts on duplicate', async () => {
    const first = await api(env, env.secretToken, 'POST', `${P()}/entity-types`, {
      name: 'account',
      description: 'A paying customer account with plan and seat properties.',
    });
    expect(first.status).toBe(201);
    const dup = await api(env, env.secretToken, 'POST', `${P()}/entity-types`, {
      name: 'account',
      description: 'A second registration of the same entity type name.',
    });
    expect(dup.status).toBe(409);
  });
});

describe('project schema', () => {
  it('returns the full live schema in one read', async () => {
    const res = await api(env, env.secretToken, 'GET', `${P()}/schema`);
    expect(res.status).toBe(200);
    expect(res.body.metrics.length).toBeGreaterThanOrEqual(2);
    expect(res.body.funnels.map((f: any) => f.key)).toContain('purchase_funnel');
    expect(res.body.entity_types.map((t: any) => t.name)).toContain('account');
    expect(res.body).toHaveProperty('observed_events_30d');
  });
});

describe('auth scoping', () => {
  it('rejects an ingest key on platform routes', async () => {
    const res = await api(env, env.ingestToken, 'GET', `${P()}/metrics`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('wrong_key_kind');
  });

  it('rejects a secret key from another project', async () => {
    const other = await createTestEnv();
    try {
      const res = await api(env, other.secretToken, 'GET', `${P()}/metrics`);
      // Other org's secret key cannot even see this org's project slug.
      expect(res.status).toBe(404);
    } finally {
      await other.close();
    }
  });

  it('rejects a bad token', async () => {
    const res = await api(env, 'sk_definitely_wrong', 'GET', `${P()}/metrics`);
    expect(res.status).toBe(401);
  });
});
