-- Supports the 24h idempotency window: stale batch rows are refreshed on
-- conflict and cleaned up opportunistically by project.
CREATE INDEX ingest_batches_received_idx ON ingest_batches (project_id, received_at);
