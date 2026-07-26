import { getEnvironmentBootstrap } from './env.js';
import { searchKnowledge } from './knowledge.js';

export type ComponentStatus =
  | 'healthy'
  | 'degraded'
  | 'unavailable'
  | 'unconfigured';

export interface HealthComponent {
  status: ComponentStatus;
  detail: string;
  latencyMs?: number;
}

export interface AllyHealth {
  status: 'healthy' | 'degraded' | 'unavailable';
  checkedAt: string;
  environment: {
    bootstrap: ReturnType<typeof getEnvironmentBootstrap>;
    configuredVariables: string[];
  };
  components: {
    knowledge: HealthComponent;
    bge: HealthComponent;
  };
}

type Fetch = typeof fetch;

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

async function checkHttp(
  label: string,
  url: string | undefined,
  fetchImpl: Fetch,
): Promise<HealthComponent> {
  if (!url) {
    return {
      status: 'unconfigured',
      detail: `${label} is not configured.`,
    };
  }

  const started = performance.now();
  try {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(5_000),
    });
    const latencyMs = Math.round(performance.now() - started);
    if (!response.ok) {
      return {
        status: 'unavailable',
        detail: `${label} returned HTTP ${response.status}.`,
        latencyMs,
      };
    }
    return {
      status: 'healthy',
      detail: `${label} is reachable.`,
      latencyMs,
    };
  } catch (error) {
    return {
      status: 'unavailable',
      detail: `${label} check failed: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
      latencyMs: Math.round(performance.now() - started),
    };
  }
}

async function checkKnowledge(fetchImpl: Fetch): Promise<HealthComponent> {
  const started = performance.now();
  try {
    const result = await searchKnowledge(
      'WCAG 1.1.1 non-text content',
      { version: '2.2', matchCount: 1 },
      fetchImpl,
    );
    return {
      status: result.mode === 'hybrid' ? 'healthy' : 'degraded',
      detail:
        result.mode === 'hybrid'
          ? `Hybrid retrieval is available through ${result.embeddingProvider ?? 'the configured embedding provider'}.`
          : `Knowledge retrieval is available in lexical fallback mode. ${result.warning ?? ''}`.trim(),
      latencyMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    return {
      status: detail.includes('not configured') ? 'unconfigured' : 'unavailable',
      detail,
      latencyMs: Math.round(performance.now() - started),
    };
  }
}

export async function checkAllyHealth(
  fetchImpl: Fetch = fetch,
): Promise<AllyHealth> {
  const platformManaged = Boolean(env('ALLY_API_URL') && env('ALLY_API_KEY'));
  const bgeBase = env('BGE_EMBEDDING_URL')?.replace(/\/+$/, '');

  const [knowledge, bge] = await Promise.all([
    checkKnowledge(fetchImpl),
    platformManaged
      ? Promise.resolve({
          status: 'healthy' as const,
          detail: 'BGE embeddings are managed by the Ally platform.',
        })
      : checkHttp('BGE embedding service', bgeBase ? `${bgeBase}/health/ready` : undefined, fetchImpl),
  ]);

  const status =
    knowledge.status === 'unavailable' || knowledge.status === 'unconfigured'
      ? 'unavailable'
      : knowledge.status === 'degraded' ||
          bge.status !== 'healthy'
        ? 'degraded'
        : 'healthy';

  const variableNames = [
    'ALLY_API_URL',
    'ALLY_API_KEY',
    'ALLY_SUPABASE_URL',
    'ALLY_SUPABASE_PUBLISHABLE_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'BGE_EMBEDDING_URL',
    'BGE_EMBEDDING_TOKEN',
  ];

  return {
    status,
    checkedAt: new Date().toISOString(),
    environment: {
      bootstrap: getEnvironmentBootstrap(),
      configuredVariables: variableNames.filter((name) => Boolean(env(name))),
    },
    components: { knowledge, bge },
  };
}
