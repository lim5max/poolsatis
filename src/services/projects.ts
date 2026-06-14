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
