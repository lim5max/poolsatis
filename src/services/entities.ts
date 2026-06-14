import type pg from 'pg';
import type { EntitiesQueryInput, EntityUpsertInput } from '../schemas.js';
import { compileFilters, numericPropSql } from '../stores/filters.js';
import { badRequest } from '../errors.js';

/**
 * Upsert with merge semantics: sent keys overwrite, missing keys are kept,
 * an explicit null deletes the key (top level only).
 */
export async function upsertEntities(
  pool: pg.Pool,
  projectId: string,
  env: string,
  input: EntityUpsertInput,
): Promise<{ upserted: number }> {
  const knownTypes = new Set(
    (await pool.query('SELECT name FROM entity_types WHERE project_id = $1', [projectId]))
      .rows.map((r) => r.name as string),
  );
  for (const e of input.entities) {
    if (!knownTypes.has(e.entity_type)) {
      throw badRequest(
        'unknown_entity_type',
        `entity type "${e.entity_type}" is not registered for this project`,
        'register it first via register_entity_type (MCP) or POST /entity-types',
      );
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const e of input.entities) {
      await client.query(
        `INSERT INTO entities (project_id, env, entity_type, entity_id, properties)
         VALUES ($1, $2, $3, $4, jsonb_strip_top_nulls($5::jsonb))
         ON CONFLICT (project_id, env, entity_type, entity_id) DO UPDATE SET
           properties = jsonb_strip_top_nulls(entities.properties || $5::jsonb),
           updated_at = now()`,
        [projectId, env, e.entity_type, e.entity_id, JSON.stringify(e.properties)],
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return { upserted: input.entities.length };
}

export async function queryEntities(
  pool: pg.Pool,
  projectId: string,
  q: EntitiesQueryInput,
): Promise<Array<{ entity_id: string; properties: Record<string, unknown>; updated_at: string }>> {
  const params: unknown[] = [projectId, q.env, q.entity_type];
  const where = [
    'project_id = $1',
    'env = $2',
    'entity_type = $3',
    ...compileFilters(q.filters, 'properties', params),
  ].join(' AND ');

  let orderSql = 'updated_at DESC';
  if (q.order_by) {
    params.push(q.order_by.property);
    const dir = q.order_by.dir === 'asc' ? 'ASC' : 'DESC';
    // Numeric-aware ordering: numbers sort numerically, the rest lexically.
    orderSql = `${numericPropSql('properties', params.length)} ${dir} NULLS LAST,
                properties->>$${params.length} ${dir} NULLS LAST`;
  }
  params.push(q.limit);

  const { rows } = await pool.query(
    `SELECT entity_id, properties, updated_at FROM entities
     WHERE ${where} ORDER BY ${orderSql} LIMIT $${params.length}`,
    params,
  );
  return rows.map((r) => ({
    entity_id: r.entity_id,
    properties: r.properties,
    updated_at: new Date(r.updated_at).toISOString(),
  }));
}

export async function countEntities(
  pool: pg.Pool,
  projectId: string,
  env: string,
  entityType: string,
  filters: EntitiesQueryInput['filters'],
): Promise<number> {
  const params: unknown[] = [projectId, env, entityType];
  const where = [
    'project_id = $1',
    'env = $2',
    'entity_type = $3',
    ...compileFilters(filters, 'properties', params),
  ].join(' AND ');
  const { rows } = await pool.query(`SELECT count(*) AS c FROM entities WHERE ${where}`, params);
  return Number(rows[0].c);
}
