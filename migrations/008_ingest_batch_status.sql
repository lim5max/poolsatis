-- Track batch-id lifecycle so a failed append can be retried with the same
-- batch_id instead of being treated as a completed duplicate.
ALTER TABLE ingest_batches
  ADD COLUMN status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('processing','completed','failed')),
  ADD COLUMN completed_at timestamptz DEFAULT now(),
  ADD COLUMN last_error text;

CREATE INDEX ingest_batches_retry_idx
  ON ingest_batches (project_id, env, status, received_at);
