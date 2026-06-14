import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { activeMetric, api, createTestEnv, hoursAgo, type TestEnv } from './helpers.js';

let env: TestEnv;
const P = () => `/api/v1/projects/${env.projectSlug}`;

beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(() => env.close());

describe('event ingest', () => {
  it('accepts events for unknown event names but counts them unregistered', async () => {
    const res = await api(env, env.ingestToken, 'POST', '/i/v1/events', {
      events: [
        { event: 'wild.event', distinct_id: 'u1', properties: { a: 1 } },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ accepted: 1, unregistered: 1 });
  });

  it('marks events registered once an active metric covers them', async () => {
    await activeMetric(env, { key: 'doc_exported', source: { event: 'doc.exported' } });
    const res = await api(env, env.ingestToken, 'POST', '/i/v1/events', {
      events: [{ event: 'doc.exported', distinct_id: 'u1' }],
    });
    expect(res.body).toEqual({ accepted: 1, unregistered: 0 });

    const sample = await api(env, env.secretToken, 'GET', `${P()}/events/sample?event=doc.exported`);
    expect(sample.body.events[0].registered).toBe(true);
  });

  it('deduplicates replayed batch_ids', async () => {
    const payload = {
      batch_id: 'batch-123',
      events: [{ event: 'doc.exported', distinct_id: 'u2' }],
    };
    const first = await api(env, env.ingestToken, 'POST', '/i/v1/events', payload);
    expect(first.body.accepted).toBe(1);
    const replay = await api(env, env.ingestToken, 'POST', '/i/v1/events', payload);
    expect(replay.body).toEqual({ accepted: 0, unregistered: 0, duplicate: true });
  });

  it('treats a batch_id replay as new once the 24h window has passed', async () => {
    const payload = {
      batch_id: 'batch-expiring',
      events: [{ event: 'doc.exported', distinct_id: 'u-exp' }],
    };
    await api(env, env.ingestToken, 'POST', '/i/v1/events', payload);
    // Age the dedup row past the window.
    await env.pool.query(
      `UPDATE ingest_batches SET received_at = now() - interval '25 hours' WHERE batch_id = $1`,
      ['batch-expiring'],
    );
    const replay = await api(env, env.ingestToken, 'POST', '/i/v1/events', payload);
    expect(replay.body.accepted).toBe(1);
    expect(replay.body.duplicate).toBeUndefined();
  });

  it('returns 207 with per-element errors without sinking the batch', async () => {
    const res = await api(env, env.ingestToken, 'POST', '/i/v1/events', {
      events: [
        { event: 'doc.exported', distinct_id: 'u3' },
        { event: 'BadName!!', distinct_id: 'u3' },
        { event: 'doc.exported' }, // missing distinct_id
      ],
    });
    expect(res.status).toBe(207);
    expect(res.body.accepted).toBe(1);
    expect(res.body.errors).toHaveLength(2);
    expect(res.body.errors[0].index).toBe(1);
    expect(res.body.errors[1].index).toBe(2);
  });

  it('corrects far-future timestamps and flags $clock_skew', async () => {
    const res = await api(env, env.ingestToken, 'POST', '/i/v1/events', {
      events: [{
        event: 'doc.exported',
        distinct_id: 'u-skew',
        timestamp: new Date(Date.now() + 3600_000).toISOString(),
      }],
    });
    expect(res.body.accepted).toBe(1);
    const sample = await api(env, env.secretToken, 'GET', `${P()}/events/sample?limit=5`);
    const skewed = sample.body.events.find((e: any) => e.distinct_id === 'u-skew');
    expect(skewed.properties.$clock_skew).toBe(true);
    expect(new Date(skewed.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('keeps env separation: dev key writes dev events', async () => {
    await api(env, env.ingestDevToken, 'POST', '/i/v1/events', {
      events: [{ event: 'doc.exported', distinct_id: 'dev-user' }],
    });
    const prodSample = await api(env, env.secretToken, 'GET', `${P()}/events/sample?env=prod&limit=100`);
    expect(prodSample.body.events.every((e: any) => e.env === 'prod')).toBe(true);
    const devSample = await api(env, env.secretToken, 'GET', `${P()}/events/sample?env=dev&limit=100`);
    expect(devSample.body.events.map((e: any) => e.distinct_id)).toContain('dev-user');
  });

  it('rejects platform tokens on ingest routes', async () => {
    const res = await api(env, env.secretToken, 'POST', '/i/v1/events', {
      events: [{ event: 'doc.exported', distinct_id: 'u4' }],
    });
    expect(res.status).toBe(403);
  });
});

describe('entity ingest', () => {
  it('rejects entities of unregistered types', async () => {
    const res = await api(env, env.ingestToken, 'POST', '/i/v1/entities', {
      entities: [{ entity_type: 'ghost', entity_id: 'g1', properties: {} }],
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('unknown_entity_type');
  });

  it('merges properties on upsert; explicit null deletes a key', async () => {
    await api(env, env.secretToken, 'POST', `${P()}/entity-types`, {
      name: 'account',
      description: 'Customer account entity used in the entity merge tests.',
    });
    await api(env, env.ingestToken, 'POST', '/i/v1/entities', {
      entities: [{ entity_type: 'account', entity_id: 'acc1', properties: { plan: 'free', seats: 2, trial: true } }],
    });
    await api(env, env.ingestToken, 'POST', '/i/v1/entities', {
      entities: [{ entity_type: 'account', entity_id: 'acc1', properties: { plan: 'pro', trial: null } }],
    });

    const res = await api(env, env.secretToken, 'POST', `${P()}/query`, {
      kind: 'entities',
      entity_type: 'account',
      filters: [{ property: 'plan', op: 'eq', value: 'pro' }],
    });
    expect(res.status).toBe(200);
    expect(res.body.entities).toHaveLength(1);
    expect(res.body.entities[0].properties).toEqual({ plan: 'pro', seats: 2 });
  });
});
