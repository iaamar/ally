import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { processIngest } from '@/lib/ingest';
import { createIngestDb } from '@/lib/ingest-db';
import type { Database } from '@/lib/database.types';

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'server misconfigured' }, { status: 500 });
  }

  const supabase = createClient<Database>(url, serviceKey);
  const db = createIngestDb(supabase);

  const auth = req.headers.get('authorization');
  const rawKey = auth?.startsWith('Bearer ') ? auth.slice(7) : null;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const result = await processIngest(db, rawKey, body);
  return NextResponse.json(result.json, { status: result.status });
}
