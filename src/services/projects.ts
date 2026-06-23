import type pg from 'pg';
import { generateToken, type KeyKind } from '../keys.js';
import { notFound } from '../errors.js';

export interface Project {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  timezone: string;
  retention_months: number;
}

export async function createOrganization(pool: pg.Pool, name: string): Promise<{ id: string }> {
  const { rows } = await pool.query(
    'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
    [name],
  );
  return { id: rows[0].id };
}

export async function createProject(
  pool: pg.Pool,
  orgId: string,
  slug: string,
  name: string,
): Promise<Project> {
  const { rows } = await pool.query(
    `INSERT INTO projects (org_id, slug, name) VALUES ($1, $2, $3)
     RETURNING id, org_id, slug, name, timezone, retention_months`,
    [orgId, slug, name],
  );
  return rows[0];
}

export async function createApiKey(
  pool: pg.Pool,
  opts: { orgId: string; projectId: string | null; kind: KeyKind; env?: string; label?: string },
): Promise<{ id: string; token: string }> {
  const { token, hash } = generateToken(opts.kind);
  const { rows } = await pool.query(
    `INSERT INTO api_keys (org_id, project_id, kind, env, token_hash, label)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [opts.orgId, opts.projectId, opts.kind, opts.env ?? 'prod', hash, opts.label ?? null],
  );
  return { id: rows[0].id, token };
}

export interface ApiKeyRow {
  id: string;
  kind: KeyKind;
  env: string;
  label: string | null;
  created_at: string;
  revoked_at: string | null;
}

/** Keys for a project, masked — the token itself is shown only once at creation. */
export async function listApiKeys(pool: pg.Pool, projectId: string): Promise<ApiKeyRow[]> {
  const { rows } = await pool.query(
    `SELECT id, kind, env, label, created_at, revoked_at
     FROM api_keys WHERE project_id = $1 ORDER BY created_at DESC`,
    [projectId],
  );
  return rows;
}

export async function revokeApiKey(
  pool: pg.Pool,
  orgId: string,
  id: string,
  projectId: string,
): Promise<void> {
  // Scope to project_id as well as org_id: a secret key pinned to one project
  // must not be able to revoke another project's key in the same org.
  const { rowCount } = await pool.query(
    `UPDATE api_keys SET revoked_at = now()
     WHERE id = $1 AND org_id = $2 AND project_id = $3 AND revoked_at IS NULL`,
    [id, orgId, projectId],
  );
  if (!rowCount) throw notFound('api_key', 'no active key with that id in this project');
}

export interface ProjectWithStats extends Pick<Project, 'slug' | 'name' | 'timezone'> {
  active_metrics: number;
  funnels: number;
  events_30d: number;
}

export async function listProjectsWithStats(pool: pg.Pool, orgId: string): Promise<ProjectWithStats[]> {
  const { rows } = await pool.query(
    `SELECT p.slug, p.name, p.timezone,
       (SELECT count(*) FROM metrics m WHERE m.project_id = p.id AND m.status = 'active')::int AS active_metrics,
       (SELECT count(*) FROM funnels f WHERE f.project_id = p.id)::int AS funnels,
       (SELECT count(*) FROM events e WHERE e.project_id = p.id
          AND e."timestamp" >= now() - interval '30 days')::int AS events_30d
     FROM projects p WHERE p.org_id = $1 ORDER BY p.created_at`,
    [orgId],
  );
  return rows;
}

export async function getProjectBySlug(
  pool: pg.Pool,
  orgId: string,
  slug: string,
): Promise<Project> {
  const { rows } = await pool.query(
    `SELECT id, org_id, slug, name, timezone, retention_months
     FROM projects WHERE org_id = $1 AND slug = $2`,
    [orgId, slug],
  );
  if (!rows[0]) {
    throw notFound('project', `no project with slug "${slug}" in this organization — call list_projects`);
  }
  return rows[0];
}

export async function listProjects(pool: pg.Pool, orgId: string): Promise<Project[]> {
  const { rows } = await pool.query(
    `SELECT id, org_id, slug, name, timezone, retention_months
     FROM projects WHERE org_id = $1 ORDER BY created_at`,
    [orgId],
  );
  return rows;
}
