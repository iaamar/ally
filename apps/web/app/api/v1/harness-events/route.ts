import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { Database } from '@/lib/database.types';
import {
  processHarnessEventIngest,
  type HarnessIngestDb,
} from '@/lib/harness-ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildDb(
  supabase: ReturnType<typeof createClient<Database>>,
): HarnessIngestDb {
  return {
    async findKeyOrg(hash) {
      const { data } = await supabase
        .from('api_keys')
        .select('id, org_id')
        .eq('key_hash', hash)
        .single();
      return data ? { orgId: data.org_id, keyId: data.id } : null;
    },
    async touchKey(keyId) {
      await supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', keyId);
    },
    async upsertProject(orgId, name) {
      const { data: existing } = await supabase
        .from('projects')
        .select('id')
        .eq('org_id', orgId)
        .eq('name', name)
        .single();
      if (existing) return existing;

      const { data, error } = await supabase
        .from('projects')
        .insert({ org_id: orgId, name })
        .select('id')
        .single();
      if (error || !data) throw new Error(`Failed to create project: ${error?.message}`);
      return data;
    },
  };
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'server misconfigured' }, { status: 500 });
  }

  const auth = request.headers.get('authorization');
  const rawKey = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  try {
    const result = await processHarnessEventIngest(
      buildDb(createClient<Database>(url, serviceKey)),
      rawKey,
      body,
    );
    return NextResponse.json(result.json, { status: result.status });
  } catch (error) {
    console.error('Harness event ingest failed:', error);
    return NextResponse.json({ error: 'harness event ingest failed' }, { status: 500 });
  }
}
