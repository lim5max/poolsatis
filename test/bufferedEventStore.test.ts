import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/errors.js';
import { BufferedEventStore } from '../src/stores/bufferedEventStore.js';
import type { EventStore, StorableEvent } from '../src/stores/eventStore.js';

interface FakeEventStore extends EventStore {
  appends: StorableEvent[][];
}

afterEach(() => {
  vi.useRealTimers();
});

describe('BufferedEventStore', () => {
  it('coalesces concurrent appends into one delegate append', async () => {
    vi.useFakeTimers();
    const delegate = fakeEventStore();
    const store = new BufferedEventStore(delegate, {
      maxEvents: 10,
      maxDelayMs: 5,
      maxPendingEvents: 100,
    });

    const writes = Promise.all([
      store.append([event('a')]),
      store.append([event('b')]),
    ]);
    await vi.advanceTimersByTimeAsync(5);
    await writes;

    expect(delegate.appends).toHaveLength(1);
    expect(delegate.appends[0]?.map((e) => e.event)).toEqual(['a', 'b']);
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
    expect(delegate.appends[0]).toHaveLength(2);
  });

  it('rejects new appends with 503 when the pending queue is full', async () => {
    vi.useFakeTimers();
    const delegate = fakeEventStore();
    const store = new BufferedEventStore(delegate, {
      maxEvents: 2,
      maxDelayMs: 10_000,
      maxPendingEvents: 2,
    });

    const first = store.append([event('a')]);
    await expect(store.append([event('b'), event('c')])).rejects.toMatchObject({
      statusCode: 503,
      code: 'ingest_backpressure',
    } satisfies Partial<ApiError>);

    await vi.advanceTimersByTimeAsync(10_000);
    await first;
  });

  it('propagates delegate append failures to every caller in the flushed batch', async () => {
    vi.useFakeTimers();
    const delegate = fakeEventStore({ fail: new Error('database down') });
    const store = new BufferedEventStore(delegate, {
      maxEvents: 10,
      maxDelayMs: 1,
      maxPendingEvents: 100,
    });

    const writes = Promise.all([
      store.append([event('a')]),
      store.append([event('b')]),
    ]);
    const assertion = expect(writes).rejects.toThrow('database down');
    await vi.advanceTimersByTimeAsync(1);

    await assertion;
  });
});

function fakeEventStore(options: { fail?: Error } = {}): FakeEventStore {
  const appends: StorableEvent[][] = [];
  return {
    appends,
    append: async (events: StorableEvent[]) => {
      appends.push(events);
      if (options.fail) throw options.fail;
    },
    trend: vi.fn(),
    funnel: vi.fn(),
    retention: vi.fn(),
    lifecycle: vi.fn(),
    stickiness: vi.fn(),
    sample: vi.fn(),
    eventNames: vi.fn(),
    eventStats: vi.fn(),
    entityStatusEvidence: vi.fn(),
    purge: vi.fn(),
    actorSummary: vi.fn(),
  } as unknown as FakeEventStore;
}

function event(name: string): StorableEvent {
  return {
    projectId: '00000000-0000-0000-0000-000000000001',
    env: 'prod',
    event: name,
    timestamp: new Date('2026-06-26T00:00:00.000Z'),
    distinctId: 'u1',
    sessionId: null,
    properties: {},
    registered: true,
  };
}
