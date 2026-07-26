import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkAllyHealth } from '../src/health.js';

const names = [
  'ALLY_API_URL',
  'ALLY_API_KEY',
  'ALLY_SUPABASE_URL',
  'ALLY_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'BGE_EMBEDDING_URL',
  'BGE_EMBEDDING_TOKEN',
  'GEMMA_BASE_URL',
] as const;

const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of names) {
    const value = original[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  vi.restoreAllMocks();
});

describe('checkAllyHealth', () => {
  it('reports unconfigured dependencies without exposing values', async () => {
    for (const name of names) delete process.env[name];

    const health = await checkAllyHealth(vi.fn());

    expect(health.status).toBe('unavailable');
    expect(health.components.knowledge.status).toBe('unconfigured');
    expect(health.components.bge.status).toBe('unconfigured');
    expect(health.components.gemma.status).toBe('unconfigured');
    expect(JSON.stringify(health)).not.toContain('undefined');
  });

  it('reports a healthy hybrid stack', async () => {
    delete process.env.ALLY_API_URL;
    delete process.env.ALLY_API_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public-key';
    process.env.BGE_EMBEDDING_URL = 'http://bge.local';
    process.env.BGE_EMBEDDING_TOKEN = 'private-token';
    process.env.GEMMA_BASE_URL = 'http://gemma.local';
    const vector = Array.from({ length: 1024 }, () => 0.01);

    const fetchMock = vi.fn(async (request: string | URL | Request) => {
      const url = String(request);
      if (url === 'http://bge.local/health/ready') {
        return new Response('{"status":"ready"}', { status: 200 });
      }
      if (url === 'http://gemma.local/health') {
        return new Response('{"status":"ok"}', { status: 200 });
      }
      if (url === 'http://bge.local/v1/embeddings') {
        return new Response(JSON.stringify({
          dimensions: 1024,
          embeddings: [vector],
        }), { status: 200 });
      }
      if (url.includes('/rpc/hybrid_search_wcag')) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    });

    const health = await checkAllyHealth(fetchMock);

    expect(health.status).toBe('healthy');
    expect(health.components.knowledge.status).toBe('healthy');
    expect(health.components.bge.status).toBe('healthy');
    expect(health.components.gemma.status).toBe('healthy');
    expect(JSON.stringify(health)).not.toContain('private-token');
    expect(JSON.stringify(health)).not.toContain('public-key');
  });

  it('treats BGE as platform-managed with a single Ally API key', async () => {
    process.env.ALLY_API_URL = 'https://ally.example.com';
    process.env.ALLY_API_KEY = 'ally_sk_test';
    delete process.env.ALLY_SUPABASE_URL;
    delete process.env.ALLY_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.BGE_EMBEDDING_URL;
    delete process.env.GEMMA_BASE_URL;

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      query: 'WCAG 1.1.1 non-text content',
      mode: 'hybrid',
      embeddingProvider: 'dedicated_bge',
      results: [],
    }), { status: 200 }));

    const health = await checkAllyHealth(fetchMock);

    expect(health.status).toBe('healthy');
    expect(health.components.knowledge.status).toBe('healthy');
    expect(health.components.bge.status).toBe('healthy');
    expect(health.components.bge.detail).toContain('managed by the Ally platform');
    expect(JSON.stringify(health)).not.toContain('ally_sk_test');
  });
});
