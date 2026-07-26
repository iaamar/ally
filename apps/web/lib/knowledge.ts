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

export interface KnowledgeResult {
  mode: 'hybrid' | 'semantic' | 'lexical_fallback';
  embeddingProvider?: 'dedicated_bge';
  warning?: string;
  results: KnowledgeHit[];
}

interface SearchOptions {
  version?: string;
  levels?: string[];
  matchCount?: number;
  signal?: AbortSignal;
}

type Fetch = typeof fetch;

const QUESTION_STOP_WORDS = new Set([
  'a',
  'an',
  'are',
  'can',
  'do',
  'does',
  'for',
  'how',
  'i',
  'in',
  'is',
  'me',
  'of',
  'the',
  'to',
  'what',
  'when',
  'where',
  'which',
  'why',
]);

export function normalizeKnowledgeQuery(query: string): string {
  const withoutVersion = query.replace(/\bWCAG\s*2(?:\.2)?\b/gi, ' ');
  const tokens = withoutVersion.match(/[a-z0-9]+(?:[.-][a-z0-9]+)*/gi) ?? [];
  const meaningful = tokens.filter(
    (token) => !QUESTION_STOP_WORDS.has(token.toLowerCase()),
  );
  const normalized = meaningful.join(' ').trim() || query.trim();
  const terms = new Set(meaningful.map((token) => token.toLowerCase()));

  // Expand terse contrast questions toward the normative text instead of
  // generic WCAG introductions or historical ratio rationale.
  if (terms.has('contrast') && (terms.has('ratio') || terms.has('ratios'))) {
    return `${normalized} minimum text normal large text success criterion`;
  }

  return normalized;
}

function config(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase knowledge search is not configured.');
  return { url, key };
}

function embeddingConfig(): { url: string; token?: string } | null {
  const url = process.env.BGE_EMBEDDING_URL?.trim().replace(/\/$/, '');
  if (!url) return null;
  return {
    url,
    token: process.env.BGE_EMBEDDING_TOKEN?.trim() || undefined,
  };
}

function embeddingTimeout(): number {
  const parsed = Number.parseInt(process.env.BGE_REQUEST_TIMEOUT_MS ?? '5000', 10);
  return Number.isFinite(parsed) ? Math.max(1000, Math.min(parsed, 5_000)) : 5000;
}

function mapRows(rows: Array<{
  content: string;
  score?: number | null;
  source_url: string | null;
  criterion_id: string | null;
  conformance_level: string | null;
  wcag_version: string | null;
  metadata: Record<string, unknown> | null;
}>): KnowledgeHit[] {
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
  options: SearchOptions,
  matchCount: number,
  url: string,
  key: string,
  warning: string,
  fetchImpl: Fetch,
): Promise<KnowledgeResult> {
  if (options.signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
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
    signal: options.signal,
  });

  if (rpcResponse.ok) {
    return {
      mode: 'lexical_fallback',
      warning,
      results: mapRows(await rpcResponse.json()),
    };
  }

  // Compatibility path while the ranked lexical RPC migration is not deployed.
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
  const fallback = await fetchImpl(fallbackUrl, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: options.signal,
  });
  if (!fallback.ok) {
    throw new Error(`Knowledge retrieval and lexical fallback failed (HTTP ${fallback.status}).`);
  }
  return {
    mode: 'lexical_fallback',
    warning,
    results: mapRows(await fallback.json()),
  };
}

export async function searchWcagKnowledge(
  query: string,
  options: SearchOptions = {},
  fetchImpl: Fetch = fetch,
): Promise<KnowledgeResult> {
  const normalizedQuery = normalizeKnowledgeQuery(query);
  const { url, key } = config();
  const matchCount = Math.max(1, Math.min(options.matchCount ?? 8, 25));
  const dedicated = embeddingConfig();

  if (dedicated) {
    const signal = options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(embeddingTimeout())])
      : AbortSignal.timeout(embeddingTimeout());
    const embeddingResponse = await fetchImpl(`${dedicated.url}/v1/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(dedicated.token ? { Authorization: `Bearer ${dedicated.token}` } : {}),
      },
      body: JSON.stringify({ input: normalizedQuery, kind: 'query' }),
      signal,
    }).catch(() => null);

    if (embeddingResponse?.ok) {
      const embeddingBody = await embeddingResponse.json() as {
        dimensions?: number;
        embeddings?: number[][];
      };
      const vector = embeddingBody.embeddings?.[0];
      if (embeddingBody.dimensions === 1024 && vector?.length === 1024) {
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
          signal: options.signal,
        }).catch(() => null);
        if (hybridResponse?.ok) {
          return {
            mode: 'hybrid',
            embeddingProvider: 'dedicated_bge',
            results: mapRows(await hybridResponse.json()),
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

  return lexicalFallback(
    normalizedQuery,
    options,
    matchCount,
    url,
    key,
    'The dedicated BGE service is not configured; using full-text retrieval.',
    fetchImpl,
  );
}
