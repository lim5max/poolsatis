import type pg from 'pg';
import { ApiError } from '../errors.js';
import type { EventStore, StorableEvent } from '../stores/eventStore.js';
import { ingestEventSchema, type IngestEnvelope } from '../schemas.js';
import { registeredEventNames } from './registry.js';
import { recordWarnings, type WarningDelta } from './warnings.js';

const CLOCK_SKEW_FUTURE_MS = 5 * 60_000;
const REGISTRY_CACHE_TTL_MS = 30_000;
const BATCH_DEDUP_WINDOW = '24 hours';
const BATCH_CLEANUP_EVERY = 100;

type BatchClaimResult = 'claimed' | 'duplicate' | 'processing';

export interface IngestResult {
  accepted: number;
  unregistered: number;
  duplicate?: boolean;
  errors?: Array<{ index: number; message: string }>;
}

interface CacheEntry {
  names: Set<string>;
  expiresAt: number;
}

/**
 * Ingest pipeline: per-event validation (a bad event never sinks the batch),
 * batch idempotency, clock-skew correction, and the registered-flag check
 * against the active metric registry.
 */
export class IngestService {
  private readonly registryCache = new Map<string, CacheEntry>();
  private batchesSinceCleanup = 0;

  constructor(
    private readonly pool: pg.Pool,
    private readonly eventStore: EventStore,
  ) {}

  async processBatch(
    project: { id: string; retention_months: number },
    env: string,
    batch: IngestEnvelope,
    now: Date = new Date(),
  ): Promise<IngestResult> {
    const rawEvents = batch.events;
    let claimedBatchId: string | null = null;

    if (batch.batch_id) {
      // A replay is a duplicate only within the 24h window; a stale row is
      // refreshed and the batch treated as new (per docs/04-http-api.md).
      const claim = await this.claimBatch(project.id, env, batch.batch_id);
      if (claim === 'duplicate') {
        return { accepted: 0, unregistered: 0, duplicate: true };
      }
      if (claim === 'processing') {
        throw new ApiError(
          503,
          'batch_processing',
          'this batch_id is already being processed',
          'retry the same batch_id shortly; Poolstatis will return duplicate once it is stored',
        );
      }
      claimedBatchId = batch.batch_id;
      if (++this.batchesSinceCleanup >= BATCH_CLEANUP_EVERY) {
        this.batchesSinceCleanup = 0;
        await this.pool.query(
          `DELETE FROM ingest_batches
           WHERE project_id = $1 AND received_at < now() - interval '${BATCH_DEDUP_WINDOW}'`,
          [project.id],
        ).catch(() => {});
      }
    }

    try {
      const registered = await this.registeredNames(project.id);
      const retentionFloor = new Date(now);
      retentionFloor.setUTCMonth(retentionFloor.getUTCMonth() - project.retention_months);

      const storable: StorableEvent[] = [];
      const errors: Array<{ index: number; message: string }> = [];
      let unregistered = 0;

      // Accumulate warnings deduped per (kind,event) within this batch, so a noisy
      // batch produces a handful of upserts, not one per event.
      const warn = new Map<string, WarningDelta>();
      const bump = (kind: WarningDelta['kind'], event: string, detail: string, sample?: unknown) => {
        const key = `${kind}:${event}`;
        const cur = warn.get(key);
        if (cur) { cur.count += 1; cur.detail = detail; } // keep the most recent detail, not just the first
        else warn.set(key, { kind, event, detail, count: 1, ...(sample !== undefined ? { sample } : {}) });
      };

      rawEvents.forEach((raw, index) => {
        const parsed = ingestEventSchema.safeParse(raw);
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          const message = issue ? `${issue.path.join('.') || 'event'}: ${issue.message}` : 'invalid event';
          errors.push({ index, message });
          const name = typeof (raw as { event?: unknown })?.event === 'string' ? (raw as { event: string }).event : '(unknown)';
          bump('rejected', name, message, raw);
          return;
        }
        const e = parsed.data;
        const properties: Record<string, unknown> = { ...e.properties };

        let timestamp = e.timestamp ? new Date(e.timestamp) : now;
        if (timestamp.getTime() > now.getTime() + CLOCK_SKEW_FUTURE_MS || timestamp < retentionFloor) {
          timestamp = now;
          properties.$clock_skew = true;
          bump('clock_skew', e.event, 'timestamp out of range — replaced with receipt time');
        }

        const isRegistered = registered.has(e.event);
        if (!isRegistered) {
          unregistered += 1;
          bump('unregistered', e.event, 'no active metric covers this event');
        }

        storable.push({
          projectId: project.id,
          env,
          event: e.event,
          timestamp,
          distinctId: e.distinct_id,
          sessionId: e.session_id ?? null,
          properties,
          registered: isRegistered,
        });
      });

      await this.eventStore.append(storable);
      if (claimedBatchId) {
        await this.completeBatch(project.id, env, claimedBatchId);
      }
      if (warn.size > 0) {
        // Best-effort: a warnings-log failure must never fail ingestion.
        await recordWarnings(this.pool, project.id, env, [...warn.values()]).catch(() => {});
      }

      const result: IngestResult = { accepted: storable.length, unregistered };
      if (errors.length > 0) result.errors = errors;
      return result;
    } catch (err) {
      if (claimedBatchId) {
        await this.failBatch(project.id, env, claimedBatchId, err).catch(() => {});
      }
      throw err;
    }
  }

  /** Drop the cached registry for a project (call after metric changes). */
  invalidateRegistry(projectId: string): void {
    this.registryCache.delete(projectId);
  }

  private async claimBatch(projectId: string, env: string, batchId: string): Promise<BatchClaimResult> {
    const claimed = await this.pool.query(
      `INSERT INTO ingest_batches (project_id, env, batch_id, status, completed_at, last_error)
       VALUES ($1, $2, $3, 'processing', NULL, NULL)
       ON CONFLICT (project_id, env, batch_id) DO UPDATE
       SET received_at = now(), status = 'processing', completed_at = NULL, last_error = NULL
       WHERE ingest_batches.status = 'failed'
          OR ingest_batches.received_at < now() - interval '${BATCH_DEDUP_WINDOW}'
       RETURNING status`,
      [projectId, env, batchId],
    );
    if ((claimed.rowCount ?? 0) > 0) return 'claimed';
    const { rows } = await this.pool.query(
      `SELECT status FROM ingest_batches
       WHERE project_id = $1 AND env = $2 AND batch_id = $3`,
      [projectId, env, batchId],
    );
    return rows[0]?.status === 'processing' ? 'processing' : 'duplicate';
  }

  private async completeBatch(projectId: string, env: string, batchId: string): Promise<void> {
    await this.pool.query(
      `UPDATE ingest_batches
       SET status = 'completed', completed_at = now(), last_error = NULL
       WHERE project_id = $1 AND env = $2 AND batch_id = $3`,
      [projectId, env, batchId],
    );
  }

  private async failBatch(projectId: string, env: string, batchId: string, err: unknown): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    await this.pool.query(
      `UPDATE ingest_batches
       SET status = 'failed', last_error = left($4, 1000)
       WHERE project_id = $1 AND env = $2 AND batch_id = $3 AND status = 'processing'`,
      [projectId, env, batchId, message],
    );
  }

  private async registeredNames(projectId: string): Promise<Set<string>> {
    const cached = this.registryCache.get(projectId);
    if (cached && cached.expiresAt > Date.now()) return cached.names;
    const names = await registeredEventNames(this.pool, projectId);
    this.registryCache.set(projectId, { names, expiresAt: Date.now() + REGISTRY_CACHE_TTL_MS });
    return names;
  }
}
