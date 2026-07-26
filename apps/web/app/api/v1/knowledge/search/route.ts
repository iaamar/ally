import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Database } from '@/lib/database.types';
import { hashApiKey } from '@/lib/keys';
import { searchWcagKnowledge } from '@/lib/knowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const zRequest = z.object({
  query: z.string().trim().min(1).max(4_000),
  version: z.string().trim().min(1).max(20).optional(),
  levels: z.array(z.enum(['A', 'AA', 'AAA'])).max(3).optional(),
  matchCount: z.number().int().min(1).max(25).optional(),
});

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'server misconfigured' }, { status: 500 });
  }

  const auth = request.headers.get('authorization');
  const rawKey = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!rawKey) {
    return NextResponse.json({ error: 'invalid api key' }, { status: 401 });
  }

  const supabase = createClient<Database>(url, serviceKey);
  const { data: apiKey } = await supabase
    .from('api_keys')
    .select('id')
    .eq('key_hash', hashApiKey(rawKey))
    .maybeSingle();
  if (!apiKey) {
    return NextResponse.json({ error: 'invalid api key' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const parsed = zRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ issues: parsed.error.issues }, { status: 400 });
  }

  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id);

  try {
    const result = await searchWcagKnowledge(parsed.data.query, {
      version: parsed.data.version,
      levels: parsed.data.levels,
      matchCount: parsed.data.matchCount,
    });
    return NextResponse.json({ query: parsed.data.query, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Knowledge retrieval failed.',
      },
      { status: 502 },
    );
  }
}
