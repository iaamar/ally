import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey } from '@/lib/keys';

describe('generateApiKey', () => {
  it('returns raw starting with ally_sk_', () => {
    const { raw } = generateApiKey();
    expect(raw.startsWith('ally_sk_')).toBe(true);
  });

  it('returns raw with length > 40', () => {
    const { raw } = generateApiKey();
    expect(raw.length).toBeGreaterThan(40);
  });

  it('returns hash as 64-char hex string', () => {
    const { hash } = generateApiKey();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns prefix as first 12 chars of raw', () => {
    const { raw, prefix } = generateApiKey();
    expect(prefix).toBe(raw.slice(0, 12));
  });

  it('hashApiKey(raw) matches hash', () => {
    const { raw, hash } = generateApiKey();
    expect(hashApiKey(raw)).toBe(hash);
  });

  it('two calls produce different keys', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.raw).not.toBe(b.raw);
    expect(a.hash).not.toBe(b.hash);
  });
});
