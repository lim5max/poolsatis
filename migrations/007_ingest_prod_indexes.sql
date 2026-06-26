-- Production read-path indexes for the Postgres event store.
--
-- Existing events_main_idx is optimized for project/env/event/time queries.
-- These two cover project-wide recent reads and actor-specific reads where the
-- event name is optional or absent.
CREATE INDEX events_project_env_time_idx ON events (project_id, env, "timestamp" DESC);
CREATE INDEX events_project_env_actor_time_idx ON events (project_id, env, distinct_id, "timestamp" DESC);
CREATE INDEX events_project_env_ingested_idx ON events (project_id, env, ingested_at DESC);
