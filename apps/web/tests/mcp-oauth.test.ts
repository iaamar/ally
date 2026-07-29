import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getMcpBearerChallenge,
  getMcpOAuthConfig,
  getProtectedResourceMetadata,
} from '@/lib/mcp-oauth';

describe('MCP OAuth discovery', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('publishes Ally as the protected resource and Supabase Auth as issuer', () => {
    vi.stubEnv('VERCEL_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://ally.example.com');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');

    expect(getProtectedResourceMetadata()).toEqual({
      resource: 'https://ally.example.com/api/mcp',
      authorization_servers: ['https://project.supabase.co/auth/v1'],
      scopes_supported: ['email'],
      bearer_methods_supported: ['header'],
      resource_name: 'Ally MCP',
      resource_documentation: 'https://ally.example.com/docs',
    });
  });

  it('returns an RFC 9728 resource metadata challenge', () => {
    vi.stubEnv('VERCEL_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://ally.example.com');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');

    expect(getMcpBearerChallenge()).toBe(
      'Bearer resource_metadata="https://ally.example.com/.well-known/oauth-protected-resource", scope="email"',
    );
  });

  it('uses the MCP endpoint as the OAuth resource indicator', () => {
    vi.stubEnv('VERCEL_ENV', 'development');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');

    expect(getMcpOAuthConfig('http://localhost:3000').resource).toBe(
      'http://localhost:3000/api/mcp',
    );
    expect(getMcpOAuthConfig('http://localhost:3000').icon).toBe(
      'http://localhost:3000/ally-mcp-icon.png',
    );
  });
});
