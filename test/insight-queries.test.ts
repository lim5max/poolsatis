import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { activeMetric, api, createTestEnv, type TestEnv } from './helpers.js';

// Deterministic weekly buckets (date_trunc('week') is Monday-anchored in UTC).
// Mondays in Jan 2026: 05, 12, 19, 26. We open the app on Tuesdays so each
// event lands unambiguously inside its week.
const FROM = '2026-01-05T00:00:00.000Z';
const TO = '2026-02-02T00:00:00.000Z';
const WK0 = '2026-01-05T00:00:00.000Z';
const WK1 = '2026-01-12T00:00:00.000Z';
const WK2 = '2026-01-19T00:00:00.000Z';
const WK3 = '2026-01-26T00:00:00.000Z';

let env: TestEnv;
const P = () => `/api/v1/projects/${env.projectSlug}`;

beforeAll(async () => {
  env = await createTestEnv();
  await activeMetric(env, { key: 'app_open', source: { event: 'app.opened' } });

  const open = (distinct_id: string, day: string) => ({ event: 'app.opened', distinct_id, timestamp: day });
  const events = [
    // userA: weeks 0,1,2 ; userB: weeks 0,2 ; userC: week 0 ; userD: weeks 1,2
    open('A', '2026-01-06T10:00:00Z'), open('A', '2026-01-13T10:00:00Z'), open('A', '2026-01-20T10:00:00Z'),
    open('B', '2026-01-06T11:00:00Z'), open('B', '2026-01-20T11:00:00Z'),
    open('C', '2026-01-06T12:00:00Z'),
    open('D', '2026-01-13T13:00:00Z'), open('D', '2026-01-20T13:00:00Z'),
  ];
  const res = await api(env, env.ingestToken, 'POST', '/i/v1/events', { events });
  if (res.body.accepted !== events.length) throw new Error(JSON.stringify(res.body));
});
afterAll(() => env.close());

describe('retention', () => {
  it('computes a weekly cohort grid (classic, return = start)', async () => {
    const res = await api(env, env.secretToken, 'POST', `${P()}/query`, {
      kind: 'retention', start_metric: 'app_open', interval: 'week', periods: 4,
      date_from: FROM, date_to: TO,
    });
    expect(res.status).toBe(200);
    const c = res.body.cohorts;
    expect(c).toHaveLength(2);

    expect(c[0].cohort).toBe(WK0);
    expect(c[0].size).toBe(3);              // A, B, C first-opened in week 0
    expect(c[0].retained).toEqual([3, 1, 2, 0]); // wk0:all, wk1:A, wk2:A+B

    expect(c[1].cohort).toBe(WK1);
    expect(c[1].size).toBe(1);              // D first-opened in week 1
    expect(c[1].retained).toEqual([1, 1, 0, 0]);

    expect(c[0].retained_pct[2]).toBeCloseTo(2 / 3, 3);

    // TO is week-3's right edge, so cohort wk0 is fully observed (4 periods) but
    // wk1's period 3 (ending 2026-02-09) has not elapsed yet.
    expect(c[0].mature_periods).toBe(4);
    expect(c[1].mature_periods).toBe(3);
  });

  it('flags right-censored periods on recent cohorts', async () => {
    const res = await api(env, env.secretToken, 'POST', `${P()}/query`, {
      kind: 'retention', start_metric: 'app_open', interval: 'week', periods: 4,
      date_from: FROM, date_to: '2026-01-21T00:00:00.000Z', // mid week 2 → later periods unobserved
    });
    expect(res.status).toBe(200);
    const byCohort = Object.fromEntries(res.body.cohorts.map((c: any) => [c.cohort, c]));
    expect(byCohort[WK0].mature_periods).toBe(2); // weeks 0,1 fully elapsed by Jan 21
    expect(byCohort[WK1].mature_periods).toBe(1); // only week 1 fully elapsed
    expect(res.body.meta.note).toMatch(/censored/i);
  });

  it('rejects a conversion metric as start', async () => {
    await api(env, env.secretToken, 'POST', `${P()}/metrics`, {
      key: 'conv_x', name: 'Conv', purpose: 'A conversion metric not usable for retention queries.',
      type: 'conversion', source: { from: { event: 'a.x' }, to: { event: 'b.y' }, window_seconds: 60 },
    });
    const res = await api(env, env.secretToken, 'POST', `${P()}/query`, {
      kind: 'retention', start_metric: 'conv_x', interval: 'week', periods: 4, date_from: FROM, date_to: TO,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('metric_not_event_based');
  });
});

describe('lifecycle', () => {
  it('classifies new / returning / resurrecting / dormant per week', async () => {
    const res = await api(env, env.secretToken, 'POST', `${P()}/query`, {
      kind: 'lifecycle', metric: 'app_open', interval: 'week', date_from: FROM, date_to: TO,
    });
    expect(res.status).toBe(200);
    const byBucket = Object.fromEntries(res.body.series.map((s: any) => [s.bucket, s]));

    expect(byBucket[WK0]).toMatchObject({ new: 3, returning: 0, resurrecting: 0, dormant: 0 });
    expect(byBucket[WK1]).toMatchObject({ new: 1, returning: 1, resurrecting: 0, dormant: -2 });
    expect(byBucket[WK2]).toMatchObject({ new: 0, returning: 2, resurrecting: 1, dormant: 0 });
    expect(byBucket[WK3]).toMatchObject({ new: 0, returning: 0, resurrecting: 0, dormant: -3 });
  });

  it('does not report churn in the current, partial interval', async () => {
    // date_to lands mid-week-3, so week 3 is still open. The 3 actors active in
    // week 2 must NOT be counted dormant in week 3 merely because it hasn't ended.
    const res = await api(env, env.secretToken, 'POST', `${P()}/query`, {
      kind: 'lifecycle', metric: 'app_open', interval: 'week',
      date_from: FROM, date_to: '2026-01-28T00:00:00.000Z',
    });
    expect(res.status).toBe(200);
    const byBucket = Object.fromEntries(res.body.series.map((s: any) => [s.bucket, s]));
    // With a complete week 3 (TO=2026-02-02) this bucket is dormant: -3; mid-week it must be 0.
    expect(byBucket[WK3]?.dormant ?? 0).toBe(0);
  });
});

describe('stickiness', () => {
  it('histograms distinct active weeks per actor', async () => {
    const res = await api(env, env.secretToken, 'POST', `${P()}/query`, {
      kind: 'stickiness', metric: 'app_open', interval: 'week', date_from: FROM, date_to: TO,
    });
    expect(res.status).toBe(200);
    const bins = Object.fromEntries(res.body.bins.map((b: any) => [b.intervals_active, b.actors]));
    expect(bins).toEqual({ 1: 1, 2: 2, 3: 1 }); // C=1wk, B&D=2wk, A=3wk
  });
});
