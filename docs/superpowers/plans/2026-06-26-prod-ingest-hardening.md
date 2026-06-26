# Production Ingest Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Poolstatis' current Postgres-backed ingest path safer under concurrent multi-project event traffic without introducing Kafka or ClickHouse in this iteration.

**Architecture:** Keep HTTP ingest synchronous and durable: clients receive success only after events are flushed to Postgres. Add an in-process bounded batching layer around `EventStore.append()` to coalesce concurrent small writes, apply backpressure before the process runs out of memory or DB connections, and keep the existing storage interface as the future seam for durable queues or ClickHouse. Add tenant/time indexes that match current query paths.

**Tech Stack:** TypeScript, Fastify, `pg`, Vitest, PostgreSQL partitioned tables.

---

## File Structure

- Create `src/stores/bufferedEventStore.ts`: `EventStore` wrapper that batches only `append()` calls and delegates reads unchanged.
- Modify `src/http/context.ts`: wire `PostgresEventStore` through `BufferedEventStore` with defaults and test override hooks.
- Modify `src/config.ts`: expose production tuning knobs for pool size and ingest buffer sizing.
- Modify `src/db.ts`: honor configurable pool max while keeping UTC session timezone.
- Create `migrations/007_ingest_prod_indexes.sql`: add project/env/time and project/env/actor/time indexes for multi-tenant reads.
- Create `test/bufferedEventStore.test.ts`: unit tests for batching, threshold flush, backpressure, and failure propagation.
- Modify `test/ingest.test.ts` only if an end-to-end assertion is needed after the unit tests.

## Task 1: Buffered EventStore Tests

**Files:**
- Create: `test/bufferedEventStore.test.ts`

- [ ] **Step 1: Write RED tests**

Cover these exact behaviors:

```ts
it('coalesces concurrent appends into one delegate append', async () => {
  const delegate = fakeEventStore();
  const store = new BufferedEventStore(delegate, {
    maxEvents: 10,
    maxDelayMs: 5,
    maxPendingEvents: 100,
  });

  await Promise.all([
    store.append([event('a')]),
    store.append([event('b')]),
  ]);

  expect(delegate.appends).toHaveLength(1);
  expect(delegate.appends[0].map((e) => e.event)).toEqual(['a', 'b']);
});

it('flushes immediately once maxEvents is reached', async () => {
  const delegate = fakeEventStore();
  const store = new BufferedEventStore(delegate, {
    maxEvents: 2,
    maxDelayMs: 10_000,
    maxPendingEvents: 100,
  });

  await Promise.all([
    store.append([event('a')]),
    store.append([event('b')]),
  ]);

  expect(delegate.appends).toHaveLength(1);
});

it('rejects new appends with 503 when the pending queue is full', async () => {
  const delegate = fakeEventStore({ block: true });
  const store = new BufferedEventStore(delegate, {
    maxEvents: 10,
    maxDelayMs: 10_000,
    maxPendingEvents: 1,
  });

  const first = store.append([event('a')]);
  await expect(store.append([event('b')])).rejects.toMatchObject({
    statusCode: 503,
    code: 'ingest_backpressure',
  });
  delegate.release();
  await first;
});

it('propagates delegate append failures to every caller in the flushed batch', async () => {
  const delegate = fakeEventStore({ fail: new Error('database down') });
  const store = new BufferedEventStore(delegate, {
    maxEvents: 10,
    maxDelayMs: 1,
    maxPendingEvents: 100,
  });

  await expect(Promise.all([
    store.append([event('a')]),
    store.append([event('b')]),
  ])).rejects.toThrow('database down');
});
```

- [ ] **Step 2: Run RED**

Run: `pnpm test test/bufferedEventStore.test.ts`

Expected: fail because `src/stores/bufferedEventStore.ts` does not exist yet.

## Task 2: Buffered EventStore Implementation

**Files:**
- Create: `src/stores/bufferedEventStore.ts`
- Modify: `src/http/context.ts`

- [ ] **Step 1: Implement `BufferedEventStore`**

Requirements:

- `append([])` returns immediately.
- Queue entries keep their caller promises, so each HTTP request only resolves after the combined delegate append succeeds.
- `maxEvents` flushes immediately.
- `maxDelayMs` schedules a short timer for small traffic.
- `maxPendingEvents` rejects new appends with `new ApiError(503, 'ingest_backpressure', ...)`.
- One delegate flush runs at a time; events arriving during a flush are queued for the next flush.
- Read/query methods delegate directly to the wrapped `EventStore`.

- [ ] **Step 2: Wire default buffering**

In `createContext()`, wrap `new PostgresEventStore(pool)` with:

```ts
new BufferedEventStore(rawEventStore, {
  maxEvents: 1000,
  maxDelayMs: 10,
  maxPendingEvents: 50_000,
})
```

Keep a way for tests or future callers to override or disable these defaults.

- [ ] **Step 3: Run GREEN**

Run: `pnpm test test/bufferedEventStore.test.ts`

Expected: all tests pass.

## Task 3: Production Config Knobs

**Files:**
- Modify: `src/config.ts`
- Modify: `src/db.ts`
- Modify: `src/cli/serve.ts`

- [ ] **Step 1: Add config tests if a config test file exists**

If there is no config test file, keep this as typed implementation plus `pnpm typecheck`; do not create broad config tests only for env parsing.

- [ ] **Step 2: Add env-backed knobs**

Expose:

- `DATABASE_POOL_MAX`, default `10`.
- `INGEST_BUFFER_MAX_EVENTS`, default `1000`.
- `INGEST_BUFFER_MAX_DELAY_MS`, default `10`.
- `INGEST_BUFFER_MAX_PENDING_EVENTS`, default `50000`.

Clamp invalid non-positive values by throwing during config load rather than silently falling back.

- [ ] **Step 3: Wire serve path**

Ensure `pnpm serve` passes `databasePoolMax` into `createPool()` and passes ingest buffer options into `buildServer()`/`createContext()`.

## Task 4: Multi-Tenant Read Indexes

**Files:**
- Create: `migrations/007_ingest_prod_indexes.sql`

- [ ] **Step 1: Add indexes**

Create indexes that match the existing read paths:

```sql
CREATE INDEX events_project_env_time_idx ON events (project_id, env, "timestamp" DESC);
CREATE INDEX events_project_env_actor_time_idx ON events (project_id, env, distinct_id, "timestamp" DESC);
```

Reasoning:

- `sample`, `eventNames`, `eventStats`, and schema/data-health reads filter by project/env/time without always filtering by event.
- `actorSummary`, person-level deletion, and actor samples filter by project/env/distinct_id/time.

- [ ] **Step 2: Verify migrations apply**

Run the project migration command against the local test database when Docker Postgres is available.

## Task 5: Verification And Review

**Files:**
- No planned edits unless review finds issues.

- [ ] **Step 1: Targeted tests**

Run:

```bash
pnpm test test/bufferedEventStore.test.ts
pnpm test test/ingest.test.ts
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`

- [ ] **Step 3: Full backend tests**

Run: `pnpm test`

If Docker Postgres is unavailable, report that explicitly and include the exact failing connection error.

- [ ] **Step 4: Code review**

Dispatch a code-review subagent with the diff and requirements. Fix Critical/Important findings before final reporting.
