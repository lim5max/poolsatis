import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

export function createPool(databaseUrl: string): pg.Pool {
  // Timezone is pinned to UTC so date_trunc buckets are stable regardless of
  // where the server or the database happens to run.
  return new pg.Pool({ connectionString: databaseUrl, max: 10, options: '-c timezone=UTC' });
}

/** Apply pending .sql migrations in lexicographic order, tracked in schema_migrations. */
export async function migrate(pool: pg.Pool): Promise<string[]> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];
  for (const file of files) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rowCount } = await client.query(
        'SELECT 1 FROM schema_migrations WHERE name = $1 FOR UPDATE',
        [file],
      );
      if (!rowCount) {
        const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        applied.push(file);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  return applied;
}
