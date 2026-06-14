-- Poolsatis initial schema. Metadata plane + MVP event store (single Postgres).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Merge helper for entity upserts: drops top-level null values, which is the
-- "explicit null deletes the key" contract of POST /i/v1/entities.
CREATE OR REPLACE FUNCTION jsonb_strip_top_nulls(j jsonb) RETURNS jsonb AS $$
  SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
  FROM jsonb_each(j) AS kv(k, v)
  WHERE jsonb_typeof(v) <> 'null'
$$ LANGUAGE sql IMMUTABLE;

-- ===== Tenancy =====

CREATE TABLE organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),
  slug        text NOT NULL,
  name        text NOT NULL,
  timezone    text NOT NULL DEFAULT 'UTC',
  retention_months integer NOT NULL DEFAULT 12,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

CREATE TABLE api_keys (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organizations(id),
  project_id  uuid REFERENCES projects(id),      -- NULL for personal tokens (org scope)
  kind        text NOT NULL CHECK (kind IN ('ingest','secret','personal')),
  env         text NOT NULL DEFAULT 'prod',
  token_hash  text NOT NULL UNIQUE,
  label       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz
);

-- ===== Entities (mutable state) =====

CREATE TABLE entity_types (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid NOT NULL REFERENCES projects(id),
  name         text NOT NULL,
  description  text NOT NULL,
  prop_schema  jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

CREATE TABLE entities (
  project_id   uuid NOT NULL REFERENCES projects(id),
  env          text NOT NULL DEFAULT 'prod',
  entity_type  text NOT NULL,
  entity_id    text NOT NULL,
  properties   jsonb NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, env, entity_type, entity_id)
);
CREATE INDEX entities_props_gin ON entities USING gin (properties);

-- ===== Metric registry (semantic layer) =====

CREATE TABLE metrics (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id),
  key         text NOT NULL,
  name        text NOT NULL,
  purpose     text NOT NULL CHECK (length(trim(purpose)) >= 10),
  category    text CHECK (category IN
                ('acquisition','activation','retention','revenue','referral','quality')),
  type        text NOT NULL CHECK (type IN
                ('count','unique_actors','value','conversion','state')),
  source      jsonb NOT NULL,
  status      text NOT NULL DEFAULT 'proposed'
                CHECK (status IN ('proposed','active','deprecated')),
  owner       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, key)
);

CREATE TABLE funnels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id),
  key         text NOT NULL,
  name        text NOT NULL,
  goal        text NOT NULL CHECK (length(trim(goal)) >= 10),
  steps       jsonb NOT NULL,
  window_seconds integer NOT NULL DEFAULT 604800,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, key)
);

CREATE TABLE insights (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id),
  kind        text NOT NULL CHECK (kind IN ('manual','auto')),
  title       text NOT NULL,
  body        text NOT NULL,
  query       jsonb,
  severity    text CHECK (severity IN ('info','warning','critical')),
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open','ack','resolved')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX insights_project_idx ON insights (project_id, status, created_at DESC);

-- ===== Event store (MVP: partitioned Postgres table) =====

CREATE TABLE events (
  project_id   uuid NOT NULL,
  env          text NOT NULL,
  event        text NOT NULL,
  timestamp    timestamptz NOT NULL,
  distinct_id  text NOT NULL,
  session_id   text,
  properties   jsonb NOT NULL DEFAULT '{}',
  registered   boolean NOT NULL DEFAULT false,
  ingested_at  timestamptz NOT NULL DEFAULT now()
) PARTITION BY RANGE ("timestamp");

-- Monthly partitions are created on demand by the ingest path; the DEFAULT
-- partition catches anything outside pre-created ranges so writes never fail.
CREATE TABLE events_default PARTITION OF events DEFAULT;

CREATE INDEX events_main_idx ON events (project_id, env, event, "timestamp");
CREATE INDEX events_actor_idx ON events (project_id, distinct_id, "timestamp");

-- Batch idempotency: a replayed batch_id within retention is dropped.
CREATE TABLE ingest_batches (
  project_id  uuid NOT NULL,
  env         text NOT NULL,
  batch_id    text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, env, batch_id)
);
