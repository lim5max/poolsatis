import type pg from 'pg';
import { hashToken } from '../keys.js';
import { unauthorized, ApiError } from '../errors.js';

export interface AuthContext {
  keyId: string;
  orgId: string;
  /** Bound project for ingest/secret keys; null for personal (org-wide) tokens. */
  projectId: string | null;
  kind: 'ingest' | 'secret' | 'personal';
  env: string;
}

export async function authenticate(pool: pg.Pool, header: string | undefined): Promise<AuthContext> {
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw unauthorized();
  const { rows } = await pool.query(
    `SELECT id, org_id, project_id, kind, env FROM api_keys
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashToken(token)],
  );
  if (!rows[0]) throw unauthorized('unknown or revoked API key');
  return {
    keyId: rows[0].id,
    orgId: rows[0].org_id,
    projectId: rows[0].project_id,
    kind: rows[0].kind,
    env: rows[0].env,
  };
}

export function requireKind(auth: AuthContext, ...kinds: AuthContext['kind'][]): void {
  if (!kinds.includes(auth.kind)) {
    throw new ApiError(
      403,
      'wrong_key_kind',
      `this endpoint requires a ${kinds.join(' or ')} key, got ${auth.kind}`,
      auth.kind === 'ingest'
        ? 'ingest keys (pk_) only write events; use a secret key (sk_) or personal token (pt_) for the platform API'
        : 'use the right key prefix: pk_ for ingest, sk_/pt_ for platform',
    );
  }
}
