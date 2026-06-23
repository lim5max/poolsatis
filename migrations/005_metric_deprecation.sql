-- Track metric retirement metadata. Existing deprecated metrics are backfilled
-- so the stricter invariant can be enforced without breaking live projects.

ALTER TABLE metrics ADD COLUMN deprecation_reason text;
ALTER TABLE metrics ADD COLUMN deprecated_at timestamptz;

UPDATE metrics
SET
  deprecation_reason = COALESCE(deprecation_reason, 'Deprecated before Poolstatis tracked retirement reasons.'),
  deprecated_at = COALESCE(deprecated_at, updated_at, now())
WHERE status = 'deprecated';

ALTER TABLE metrics
  ADD CONSTRAINT metrics_deprecation_metadata_check CHECK (
    status <> 'deprecated'
    OR (
      deprecation_reason IS NOT NULL
      AND length(trim(deprecation_reason)) >= 10
      AND deprecated_at IS NOT NULL
    )
  );
