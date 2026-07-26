export const PRODUCTION_SITE_URL = 'https://mcp-ally-server.vercel.app';

function normalizeHttpUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

export function resolveSiteUrl(requestOrigin?: string): string {
  if (process.env.VERCEL_ENV === 'production') {
    return PRODUCTION_SITE_URL;
  }

  return (
    normalizeHttpUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
    normalizeHttpUrl(requestOrigin) ??
    'http://localhost:3000'
  );
}
