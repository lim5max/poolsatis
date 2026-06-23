-- Inspectable log of events the platform accepted but couldn't fully process,
-- so an agent can self-diagnose instrumentation problems ("what happened to the
-- events for the metric I deleted?"). Deduped by (project, env, kind, event) with
-- a rolling count so it can never flood.
CREATE TABLE ingest_warnings (
  project_id  uuid NOT NULL REFERENCES projects(id),
  env         text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('rejected','unregistered','clock_skew')),
  event       text NOT NULL,           -- event name, or '(unknown)' for nameless rejects
  detail      text NOT NULL,
  sample      jsonb,                   -- a snippet of one offending event (rejected only)
  count       bigint NOT NULL DEFAULT 1,
  first_seen  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, env, kind, event)
);
CREATE INDEX ingest_warnings_recent ON ingest_warnings (project_id, last_seen DESC);
