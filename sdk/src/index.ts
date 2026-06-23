/**
 * @poolstatis/sdk — tiny browser + Node client for Poolstatis ingest.
 *
 * Design goals: drop-in for any digital product, never lose events.
 * - Batches events and flushes on an interval or when the batch fills.
 * - Retries failed flushes with backoff, re-queuing the batch under the SAME
 *   batch_id (the server dedups by batch_id, so retries are idempotent).
 * - Flushes on page hide/unload via `fetch(..., { keepalive: true })`, the
 *   modern replacement for sendBeacon that still allows the auth header.
 * - Zero dependencies. Works wherever `fetch` exists (Node >=18, modern browsers);
 *   inject a `fetch` impl otherwise.
 */

export interface PoolstatisOptions {
  /** Platform base URL, e.g. "https://analytics.example.com" (no trailing slash needed). */
  url: string;
  /** Ingest key (`pk_…`). Write-only; safe to ship in client code. */
  ingestKey: string;
  /** Auto-flush cadence in ms (default 5000). */
  flushIntervalMs?: number;
  /** Max events per request (default 100; the server hard-caps at 500). */
  maxBatchSize?: number;
  /** Drop-oldest cap on the in-memory queue to bound memory (default 10_000). */
  maxQueue?: number;
  /** Injected fetch (for tests or non-standard runtimes). Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Called when a flush ultimately fails after retries. */
  onError?: (err: unknown) => void;
}

export interface PoolstatisEvent {
  event: string;
  distinct_id: string;
  timestamp?: string;
  session_id?: string;
  properties?: Record<string, unknown>;
}

interface EntityUpsert {
  entity_type: string;
  entity_id: string;
  properties: Record<string, unknown>;
}

const DEFAULTS = { flushIntervalMs: 5000, maxBatchSize: 100, maxQueue: 10_000 };
// On page unload, fetch(keepalive) bodies are capped (~64KB total across keepalive
// requests), so cap the unload batch small to avoid silently dropping it.
const KEEPALIVE_BATCH = 25;
// Cap how many failed batches we hold for retry, so an unreachable backend can't
// grow memory without bound (each retry batch keeps its original batch_id).
const MAX_RETRY_BATCHES = 100;

/** A formed-but-unsent request, kept verbatim so retries reuse the same batch_id. */
interface PendingBatch { path: string; body: unknown }

function uuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Non-crypto fallback — only used where crypto.randomUUID is unavailable.
  return `b-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export class Poolstatis {
  private readonly url: string;
  private readonly key: string;
  private readonly fetchImpl: typeof fetch;
  private readonly flushIntervalMs: number;
  private readonly maxBatchSize: number;
  private readonly maxQueue: number;
  private readonly onError: (err: unknown) => void;

  private events: PoolstatisEvent[] = [];
  private entities: EntityUpsert[] = [];
  private retries: PendingBatch[] = []; // batches that failed transiently, resent with their original id
  private timer: ReturnType<typeof setInterval> | null = null;
  private unbindUnload: (() => void) | null = null;
  private flushing = false;

  constructor(opts: PoolstatisOptions) {
    this.url = opts.url.replace(/\/$/, '');
    this.key = opts.ingestKey;
    const f = opts.fetch ?? (globalThis as { fetch?: typeof fetch }).fetch;
    if (!f) throw new Error('no fetch available — pass opts.fetch');
    // Bind to globalThis: a bare `globalThis.fetch` called via a property
    // reference throws "Illegal invocation" in browsers.
    this.fetchImpl = f.bind(globalThis);
    this.flushIntervalMs = opts.flushIntervalMs ?? DEFAULTS.flushIntervalMs;
    this.maxBatchSize = Math.min(opts.maxBatchSize ?? DEFAULTS.maxBatchSize, 500);
    this.maxQueue = opts.maxQueue ?? DEFAULTS.maxQueue;
    this.onError = opts.onError ?? (() => {});
    this.startTimer();
    this.bindUnload();
  }

  /** Queue an event. The distinct_id must be a stable user id. */
  track(event: string, distinctId: string, properties: Record<string, unknown> = {}): void {
    this.capture({ event, distinct_id: distinctId, properties });
  }

  /** Queue a fully-formed event (e.g. with an explicit timestamp/session_id). */
  capture(e: PoolstatisEvent): void {
    this.events.push(e);
    if (this.events.length > this.maxQueue) this.events.splice(0, this.events.length - this.maxQueue);
    if (this.events.length >= this.maxBatchSize) void this.flush();
  }

  /** Upsert mutable entity state (user/account/…). Merge semantics; null deletes a key. */
  identify(entityType: string, entityId: string, properties: Record<string, unknown>): void {
    this.entities.push({ entity_type: entityType, entity_id: entityId, properties });
    if (this.entities.length >= this.maxBatchSize) void this.flush();
  }

  /**
   * Send everything queued now. Safe to call repeatedly; a non-keepalive call made
   * while a flush is in flight returns early because the in-flight loop re-checks the
   * queues and drains anything added meanwhile.
   *
   * A keepalive flush (page unload) is NOT suppressed by an in-flight periodic flush:
   * that in-flight request is non-keepalive and the browser cancels it on navigation,
   * so the unload path must still send whatever is queued, with `keepalive: true`.
   */
  async flush(opts: { keepalive?: boolean } = {}): Promise<void> {
    if (opts.keepalive) { await this.drain(true); return; }
    if (this.flushing) return;
    this.flushing = true;
    try {
      await this.drain(false);
    } finally {
      this.flushing = false;
    }
  }

  /** Drain retries, then entities, then events. `splice` is synchronous, so a concurrent
   *  keepalive drain and periodic drain never claim the same queued item. */
  private async drain(keepalive: boolean): Promise<void> {
    const cap = keepalive ? KEEPALIVE_BATCH : this.maxBatchSize;
    // 1) Retry the batches that previously failed — verbatim, so they keep their
    //    original batch_id and the server dedups any that actually landed.
    const pending = this.retries;
    this.retries = [];
    for (const b of pending) {
      if ((await this.send(b.path, b.body, keepalive)) === 'retry') this.requeue(b);
    }
    // 2) Entities, then 3) events — forming each batch's id exactly once.
    while (this.entities.length > 0) {
      const batch: PendingBatch = { path: '/i/v1/entities', body: { entities: this.entities.splice(0, cap) } };
      if ((await this.send(batch.path, batch.body, keepalive)) === 'retry') this.requeue(batch);
    }
    while (this.events.length > 0) {
      const batch: PendingBatch = { path: '/i/v1/events', body: { batch_id: uuid(), events: this.events.splice(0, cap) } };
      if ((await this.send(batch.path, batch.body, keepalive)) === 'retry') this.requeue(batch);
    }
  }

  /** Flush, stop the timer, and remove unload listeners (call on graceful shutdown). */
  async shutdown(): Promise<void> {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.unbindUnload?.();
    this.unbindUnload = null;
    await this.flush();
  }

  private requeue(b: PendingBatch): void {
    this.retries.push(b);
    if (this.retries.length > MAX_RETRY_BATCHES) this.retries.splice(0, this.retries.length - MAX_RETRY_BATCHES);
  }

  /** One request with bounded retry. Returns ok (sent / accepted), drop (client bug), retry (transient). */
  private async send(path: string, body: unknown, keepalive?: boolean): Promise<'ok' | 'drop' | 'retry'> {
    const attempts = keepalive ? 1 : 4; // on unload there's no time to retry
    const payload = JSON.stringify(body);
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await this.fetchImpl(`${this.url}${path}`, {
          method: 'POST',
          headers: { authorization: `Bearer ${this.key}`, 'content-type': 'application/json' },
          body: payload,
          keepalive,
        });
        // 2xx and 207 are accepted (207 = per-event validation errors, which are
        // logged server-side and won't pass on retry). 4xx is a client bug — drop.
        if (res.ok || res.status === 207) return 'ok';
        if (res.status < 500) { this.onError(new Error(`ingest rejected: ${res.status}`)); return 'drop'; }
      } catch (err) {
        if (i === attempts - 1) this.onError(err);
      }
      if (i < attempts - 1) await delay(250 * 2 ** i);
    }
    return 'retry';
  }

  private startTimer(): void {
    // Node's unref keeps the timer from holding the process open.
    this.timer = setInterval(() => { void this.flush(); }, this.flushIntervalMs);
    (this.timer as { unref?: () => void }).unref?.();
  }

  private bindUnload(): void {
    const doc = (globalThis as { document?: Document }).document;
    const g = globalThis as { addEventListener?: typeof addEventListener; removeEventListener?: typeof removeEventListener };
    if (!doc?.addEventListener) return;
    const onHide = () => { if (doc.visibilityState === 'hidden') void this.flush({ keepalive: true }); };
    const onPageHide = () => void this.flush({ keepalive: true });
    doc.addEventListener('visibilitychange', onHide);
    g.addEventListener?.('pagehide', onPageHide);
    this.unbindUnload = () => {
      doc.removeEventListener('visibilitychange', onHide);
      g.removeEventListener?.('pagehide', onPageHide);
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function createClient(opts: PoolstatisOptions): Poolstatis {
  return new Poolstatis(opts);
}
