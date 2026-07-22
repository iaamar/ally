import { randomBytes, createHash } from 'node:crypto';

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = 'ally_sk_' + randomBytes(32).toString('base64url');
  const hash = hashApiKey(raw);
  const prefix = raw.slice(0, 12);
  return { raw, hash, prefix };
}
