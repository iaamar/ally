import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  normalizeKnowledgeQuery,
  searchWcagKnowledge,
} from '@/lib/knowledge';

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const originalEmbeddingUrl = process.env.BGE_EMBEDDING_URL;
const originalEmbeddingToken = process.env.BGE_EMBEDDING_TOKEN;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
  if (originalEmbeddingUrl === undefined) delete process.env.BGE_EMBEDDING_URL;
  else process.env.BGE_EMBEDDING_URL = originalEmbeddingUrl;
  if (originalEmbeddingToken === undefined) delete process.env.BGE_EMBEDDING_TOKEN;
  else process.env.BGE_EMBEDDING_TOKEN = originalEmbeddingToken;
});

describe('searchWcagKnowledge', () => {
  it('removes version metadata and question scaffolding from retrieval text', () => {
    expect(normalizeKnowledgeQuery('What contrast ratio does WCAG 2.2 require?'))
      .toBe(
        'contrast ratio require minimum text normal large text success criterion',
      );
  });

  it('uses lexical search when the embedding endpoint is unavailable', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public-key';
    delete process.env.BGE_EMBEDDING_URL;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{
        content: 'Text requires a contrast ratio of at least 4.5:1.',
        source_url: 'https://www.w3.org/example',
        criterion_id: '1.4.3',
        conformance_level: 'AA',
        wcag_version: '2.2',
        metadata: { title: 'Contrast (Minimum)' },
      }]), { status: 200 }));

    const result = await searchWcagKnowledge(
      'minimum contrast',
      { version: '2.2', levels: ['AA'] },
      fetchMock,
    );

    expect(result.mode).toBe('lexical_fallback');
    expect(result.results[0].citation.criterion).toBe('1.4.3');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/rpc/lexical_search_wcag');
    expect(
      fetchMock.mock.calls.some(([request]) => String(request).includes('/functions/v1/')),
    ).toBe(false);
  });

  it('uses the dedicated BGE service and calls the hybrid Supabase RPC directly', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public-key';
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

    const result = await searchWcagKnowledge(
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
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer service-token',
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).input)
      .toBe('minimum contrast');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/rpc/hybrid_search_wcag');
  });

  it('does not call the legacy Edge Function when the dedicated service fails', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public-key';
    process.env.BGE_EMBEDDING_URL = 'https://embeddings.example.com';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));

    const result = await searchWcagKnowledge('focus order', {}, fetchMock);

    expect(result.mode).toBe('lexical_fallback');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/rpc/lexical_search_wcag');
    expect(
      fetchMock.mock.calls.some(([request]) => String(request).includes('/functions/v1/')),
    ).toBe(false);
  });
});
