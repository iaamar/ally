import { afterEach, describe, expect, it } from 'vitest';
import { PRODUCTION_SITE_URL, resolveSiteUrl } from '@/lib/site-url';

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const originalVercelEnv = process.env.VERCEL_ENV;

afterEach(() => {
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;

  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalVercelEnv;
});

describe('resolveSiteUrl', () => {
  it('always uses the canonical domain on Vercel production', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://another.example.com';

    expect(resolveSiteUrl('http://localhost:3000')).toBe(PRODUCTION_SITE_URL);
  });

  it('uses the configured URL outside Vercel production', () => {
    delete process.env.VERCEL_ENV;
    process.env.NEXT_PUBLIC_SITE_URL = 'https://preview.example.com/path';

    expect(resolveSiteUrl('http://localhost:3000')).toBe(
      'https://preview.example.com',
    );
  });

  it('keeps the request origin for local development', () => {
    delete process.env.VERCEL_ENV;
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(resolveSiteUrl('http://localhost:3002')).toBe(
      'http://localhost:3002',
    );
  });

  it('falls back safely when no valid URL is available', () => {
    delete process.env.VERCEL_ENV;
    process.env.NEXT_PUBLIC_SITE_URL = 'javascript:alert(1)';

    expect(resolveSiteUrl('not-a-url')).toBe('http://localhost:3000');
  });
});
