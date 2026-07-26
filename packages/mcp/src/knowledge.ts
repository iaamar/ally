export interface KnowledgeSearchOptions {
  matchCount?: number;
  version?: string;
  levels?: string[];
}

export interface KnowledgeHit {
  content: string;
  score: number | null;
  citation: {
    criterion: string | null;
    level: string | null;
    version: string | null;
    url: string | null;
    title: string | null;
  };
}

export interface KnowledgeSearchResult {
  query: string;
  mode: 'hybrid' | 'semantic' | 'lexical_fallback';
  embeddingProvider?: 'dedicated_bge' | 'legacy_edge';
  results: KnowledgeHit[];
  warning?: string;
}

type Fetch = typeof fetch;

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function getPlatformConfig(): { url: string; key: string } | null {
  const url = env('ALLY_API_URL');
  const key = env('ALLY_API_KEY');
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}

function getKnowledgeConfig(): { url: string; key: string } {
  const url = env('ALLY_SUPABASE_URL') ?? env('NEXT_PUBLIC_SUPABASE_URL');
  const key =
    env('ALLY_SUPABASE_PUBLISHABLE_KEY') ??
    env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ??
    env('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (!url || !key) {
    throw new Error(
      'Knowledge search is not configured. Set ALLY_SUPABASE_URL and ALLY_SUPABASE_PUBLISHABLE_KEY.',
    );
  }
  return { url: url.replace(/\/$/, ''), key };
}

function getEmbeddingConfig(): { url: string; token?: string } | null {
  const url = env('BGE_EMBEDDING_URL');
  if (!url) return null;
  return {
    url: url.replace(/\/$/, ''),
    token: env('BGE_EMBEDDING_TOKEN'),
  };
}

function embeddingTimeout(): number {
  const parsed = Number.parseInt(env('BGE_REQUEST_TIMEOUT_MS') ?? '5000', 10);
  return Number.isFinite(parsed) ? Math.max(1000, Math.min(parsed, 30_000)) : 5000;
}

type KnowledgeRow = {
  content: string;
  score?: number | null;
  source_url: string | null;
  criterion_id: string | null;
  conformance_level: string | null;
  wcag_version: string | null;
  metadata: Record<string, unknown> | null;
};

function mapRows(rows: KnowledgeRow[]): KnowledgeHit[] {
  return rows.map((row) => ({
    content: row.content,
    score: row.score ?? null,
    citation: {
      criterion: row.criterion_id,
      level: row.conformance_level,
      version: row.wcag_version,
      url: row.source_url,
      title: typeof row.metadata?.title === 'string' ? row.metadata.title : null,
    },
  }));
}

async function lexicalFallback(
  query: string,
  options: KnowledgeSearchOptions,
  matchCount: number,
  url: string,
  key: string,
  warning: string,
  fetchImpl: Fetch,
): Promise<KnowledgeSearchResult> {
  const rpcResponse = await fetchImpl(`${url}/rest/v1/rpc/lexical_search_wcag`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query_text: query,
      match_count: matchCount,
      filter_version: options.version ?? null,
      filter_levels: options.levels ?? null,
    }),
  });
  if (rpcResponse.ok) {
    return {
      query,
      mode: 'lexical_fallback',
      warning,
      results: mapRows(await rpcResponse.json() as KnowledgeRow[]),
    };
  }

  const fallbackUrl = new URL(`${url}/rest/v1/wcag_chunks`);
  fallbackUrl.searchParams.set(
    'select',
    'content,source_url,criterion_id,conformance_level,wcag_version,metadata',
  );
  fallbackUrl.searchParams.set('fts', `wfts.${query}`);
  fallbackUrl.searchParams.set('limit', String(matchCount));
  if (options.version) fallbackUrl.searchParams.set('wcag_version', `eq.${options.version}`);
  if (options.levels?.length) {
    fallbackUrl.searchParams.set(
      'conformance_level',
      `in.(${options.levels.map((level) => `"${level}"`).join(',')})`,
    );
  }
  const response = await fetchImpl(fallbackUrl, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) {
    throw new Error(`Knowledge retrieval and lexical fallback failed (HTTP ${response.status}).`);
  }
  return {
    query,
    mode: 'lexical_fallback',
    warning,
    results: mapRows(await response.json() as KnowledgeRow[]),
  };
}

export async function searchKnowledge(
  query: string,
  options: KnowledgeSearchOptions = {},
  fetchImpl: Fetch = fetch,
): Promise<KnowledgeSearchResult> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) throw new Error('Search query cannot be empty.');

  const matchCount = Math.max(1, Math.min(options.matchCount ?? 8, 25));
  const platform = getPlatformConfig();
  if (platform) {
    const response = await fetchImpl(`${platform.url}/api/v1/knowledge/search`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${platform.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: normalizedQuery,
        version: options.version,
        levels: options.levels,
        matchCount,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Ally knowledge API returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ''}.`,
      );
    }
    return await response.json() as KnowledgeSearchResult;
  }

  const { url, key } = getKnowledgeConfig();
  const dedicated = getEmbeddingConfig();

  if (dedicated) {
    const embeddingResponse = await fetchImpl(`${dedicated.url}/v1/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(dedicated.token ? { Authorization: `Bearer ${dedicated.token}` } : {}),
      },
      body: JSON.stringify({ input: normalizedQuery, kind: 'query' }),
      signal: AbortSignal.timeout(embeddingTimeout()),
    }).catch(() => null);

    if (embeddingResponse?.ok) {
      const body = await embeddingResponse.json() as {
        dimensions?: number;
        embeddings?: number[][];
      };
      const vector = body.embeddings?.[0];
      if (body.dimensions === 1024 && vector?.length === 1024) {
        const hybridResponse = await fetchImpl(`${url}/rest/v1/rpc/hybrid_search_wcag`, {
          method: 'POST',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query_text: normalizedQuery,
            query_embedding: JSON.stringify(vector),
            match_count: matchCount,
            filter_version: options.version ?? null,
            filter_levels: options.levels ?? null,
          }),
        }).catch(() => null);
        if (hybridResponse?.ok) {
          return {
            query: normalizedQuery,
            mode: 'hybrid',
            embeddingProvider: 'dedicated_bge',
            results: mapRows(await hybridResponse.json() as KnowledgeRow[]),
          };
        }
        return lexicalFallback(
          normalizedQuery,
          options,
          matchCount,
          url,
          key,
          `Supabase hybrid search was unavailable (HTTP ${hybridResponse?.status ?? 0}); using full-text retrieval.`,
          fetchImpl,
        );
      }
    }

    return lexicalFallback(
      normalizedQuery,
      options,
      matchCount,
      url,
      key,
      `The dedicated BGE service was unavailable (HTTP ${embeddingResponse?.status ?? 0}); using full-text retrieval.`,
      fetchImpl,
    );
  }

  const functionResponse = await fetchImpl(`${url}/functions/v1/search-wcag`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: normalizedQuery,
      match_count: matchCount,
      version: options.version,
      level: options.levels,
      hybrid: true,
    }),
  });

  if (functionResponse.ok) {
    const body = (await functionResponse.json()) as { results?: KnowledgeHit[] };
    return {
      query: normalizedQuery,
      mode: 'hybrid',
      embeddingProvider: 'legacy_edge',
      results: body.results ?? [],
    };
  }

  return lexicalFallback(
    normalizedQuery,
    options,
    matchCount,
    url,
    key,
    `Legacy semantic search was unavailable (HTTP ${functionResponse.status}); using full-text retrieval.`,
    fetchImpl,
  );
}
