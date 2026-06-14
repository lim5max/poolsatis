import type pg from 'pg';
import { notFound } from '../errors.js';

export interface Insight {
  id: string;
  kind: 'manual' | 'auto';
  title: string;
  body: string;
  query: unknown;
  severity: string | null;
  status: 'open' | 'ack' | 'resolved';
  created_at: string;
}

const COLS = 'id, kind, title, body, query, severity, status, created_at';

export async function createInsight(
  pool: pg.Pool,
  projectId: string,
  input: { title: string; body: string; query?: unknown; severity?: string },
): Promise<Insight> {
  const { rows } = await pool.query(
    `INSERT INTO insights (project_id, kind, title, body, query, severity)
     VALUES ($1, 'manual', $2, $3, $4, $5) RETURNING ${COLS}`,
    [projectId, input.title, input.body,
     input.query !== undefined ? JSON.stringify(input.query) : null,
     input.severity ?? null],
  );
  return rows[0];
}

export async function listInsights(
  pool: pg.Pool,
  projectId: string,
  filter: { status?: string; kind?: string } = {},
): Promise<Insight[]> {
  const params: unknown[] = [projectId];
  let sql = `SELECT ${COLS} FROM insights WHERE project_id = $1`;
  if (filter.status) {
    params.push(filter.status);
    sql += ` AND status = $${params.length}`;
  }
  if (filter.kind) {
    params.push(filter.kind);
    sql += ` AND kind = $${params.length}`;
  }
  const { rows } = await pool.query(`${sql} ORDER BY created_at DESC LIMIT 100`, params);
  return rows;
}

export async function setInsightStatus(
  pool: pg.Pool,
  projectId: string,
  id: string,
  status: 'ack' | 'resolved',
): Promise<Insight> {
  const { rows } = await pool.query(
    `UPDATE insights SET status = $3 WHERE project_id = $1 AND id = $2 RETURNING ${COLS}`,
    [projectId, id, status],
  );
  if (!rows[0]) throw notFound('insight');
  return rows[0];
}
