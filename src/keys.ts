import { createHash, randomBytes } from 'node:crypto';

export type KeyKind = 'ingest' | 'secret' | 'personal';

const PREFIX: Record<KeyKind, string> = {
  ingest: 'pk',
  secret: 'sk',
  personal: 'pt',
};

/** Tokens are shown once at creation; only the sha256 hash is stored. */
export function generateToken(kind: KeyKind): { token: string; hash: string } {
  const token = `${PREFIX[kind]}_${randomBytes(24).toString('hex')}`;
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
