import { describe, expect, it } from 'vitest';
import { validProgressToken } from '@/lib/mcp-activity';

describe('MCP progress tokens', () => {
  it('accepts the string and integer token forms from the protocol', () => {
    expect(validProgressToken('scan-99')).toBe(true);
    expect(validProgressToken(42)).toBe(true);
    expect(validProgressToken(0)).toBe(true);
  });

  it('rejects missing and malformed tokens', () => {
    expect(validProgressToken(undefined)).toBe(false);
    expect(validProgressToken(null)).toBe(false);
    expect(validProgressToken('')).toBe(false);
    expect(validProgressToken(2.5)).toBe(false);
    expect(validProgressToken({ token: 'x' })).toBe(false);
  });
});
