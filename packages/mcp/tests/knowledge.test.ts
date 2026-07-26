import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchKnowledge } from '../src/knowledge.js';

const originalUrl = process.env.ALLY_SUPABASE_URL;
const originalKey = process.env.ALLY_SUPABASE_PUBLISHABLE_KEY;
const originalApiUrl = process.env.ALLY_API_URL;
const originalApiKey = process.env.ALLY_API_KEY;
const originalEmbeddingUrl = process.env.BGE_EMBEDDING_URL;
const originalEmbeddingToken = process.env.BGE_EMBEDDING_TOKEN;

afterEach(() => {
  if (originalApiUrl === undefined) delete process.env.ALLY_API_URL;
  else process.env.ALLY_API_URL = originalApiUrl;
  if (originalApiKey === undefined) delete process.env.ALLY_API_KEY;
  else process.env.ALLY_API_KEY = originalApiKey;
  if (originalUrl === undefined) delete process.env.ALLY_SUPABASE_URL;
  else process.env.ALLY_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.ALLY_SUPABASE_PUBLISHABLE_KEY;
  else process.env.ALLY_SUPABASE_PUBLISHABLE_KEY = originalKey;
  if (originalEmbeddingUrl === undefined) delete process.env.BGE_EMBEDDING_URL;
  else process.env.BGE_EMBEDDING_URL = originalEmbeddingUrl;
  if (originalEmbeddingToken === undefined) delete process.env.BGE_EMBEDDING_TOKEN;
  else process.env.BGE_EMBEDDING_TOKEN = originalEmbeddingToken;
});

describe('knowledge search', () => {
  it('uses the Ally platform with the single API key when configured', async () => {
    process.env.ALLY_API_URL = 'https://ally.example.com';
    process.env.ALLY_API_KEY = 'ally_sk_test';
    delete process.env.ALLY_SUPABASE_URL;
    delete process.env.ALLY_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.BGE_EMBEDDING_URL;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      query: 'minimum contrast',
      mode: 'hybrid',
      embeddingProvider: 'dedicated_bge',
      results: [],
    }), { status: 200 }));

    const result = await searchKnowledge('minimum contrast', {
      version: '2.2',
      levels: ['AA'],
    }, fetchMock);

    expect(result.mode).toBe('hybrid');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      'https://ally.example.com/api/v1/knowledge/search',
    );
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        Authorization: 'Bearer ally_sk_test',
        'Content-Type': 'application/json',
      },
    });
  });

  it('falls back to Supabase full-text search when embeddings are unavailable', async () => {
    delete process.env.ALLY_API_URL;
    delete process.env.ALLY_API_KEY;
    process.env.ALLY_SUPABASE_URL = 'https://example.supabase.co';
    process.env.ALLY_SUPABASE_PUBLISHABLE_KEY = 'public-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('credits exhausted', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        content: 'The contrast ratio shall be at least 4.5:1.',
        source_url: 'https://w3.org/example',
        criterion_id: '1.4.3',
        conformance_level: 'AA',
        wcag_version: '2.2',
        metadata: { title: 'Contrast (Minimum)' },
      }]), { status: 200 }));

    const result = await searchKnowledge(
      'minimum contrast',
      { version: '2.2', levels: ['AA'] },
      fetchMock,
    );

    expect(result.mode).toBe('lexical_fallback');
    expect(result.results[0].citation.criterion).toBe('1.4.3');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/rpc/lexical_search_wcag');
  });

  it('bypasses the Edge Function when a dedicated BGE service is configured', async () => {
    delete process.env.ALLY_API_URL;
    delete process.env.ALLY_API_KEY;
    process.env.ALLY_SUPABASE_URL = 'https://example.supabase.co';
    process.env.ALLY_SUPABASE_PUBLISHABLE_KEY = 'public-key';
    process.env.BGE_EMBEDDING_URL = 'https://embeddings.example.com';
    process.env.BGE_EMBEDDING_TOKEN = 'service-token';
    const vector = Array.from({ length: 1024 }, () => 0.01);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        dimensions: 1024,
        embeddings: [vector],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        content: 'Minimum contrast guidance',
        score: 0.032,
        source_url: 'https://www.w3.org/example',
        criterion_id: '1.4.3',
        conformance_level: 'AA',
        wcag_version: '2.2',
        metadata: { title: 'Contrast (Minimum)' },
      }]), { status: 200 }));

    const result = await searchKnowledge(
      'minimum contrast',
      { version: '2.2', levels: ['AA'] },
      fetchMock,
    );

    expect(result.mode).toBe('hybrid');
    expect(result.embeddingProvider).toBe('dedicated_bge');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://embeddings.example.com/v1/embeddings',
    );
    expect(String(fetchMock.mock.calls[1][0])).toContain('/rpc/hybrid_search_wcag');
  });
});
