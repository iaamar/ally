import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { Database } from '@/lib/database.types';
import type { Json } from '@/lib/database.types';
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
        .select('id, org_id, name')
        .eq('key_hash', hash)
        .single();
      return data ? { orgId: data.org_id, keyId: data.id, keyName: data.name } : null;
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
    async upsertRun(input) {
      const { data: existing } = await supabase
        .from('mcp_runs')
        .select('id, progress')
        .eq('org_id', input.orgId)
        .eq('request_id', input.externalRunId)
        .maybeSingle();
      const terminal = input.status === 'succeeded' || input.status === 'failed';
      const now = new Date().toISOString();
      if (existing) {
        const { error } = await supabase.from('mcp_runs').update({
          api_key_id: input.keyId,
          project_id: input.projectId,
          client_name: input.keyName ?? null,
          status: input.status,
          progress: Math.max(Number(existing.progress), input.progress),
          current_stage: input.stage,
          message: input.message,
          updated_at: now,
          ...(terminal ? { completed_at: now } : {}),
        }).eq('id', existing.id);
        if (error) throw new Error(`Failed to update activity run: ${error.message}`);
        return { id: existing.id };
      }
      const { data, error } = await supabase.from('mcp_runs').insert({
        org_id: input.orgId,
        api_key_id: input.keyId,
        project_id: input.projectId,
        kind: 'remediation',
        request_id: input.externalRunId,
        client_name: input.keyName ?? null,
        status: input.status,
        progress: input.progress,
        current_stage: input.stage,
        message: input.message,
        ...(terminal ? { completed_at: now } : {}),
      }).select('id').single();
      if (error || !data) throw new Error(`Failed to create activity run: ${error?.message}`);
      return data;
    },
    async appendEvent(input) {
      const { error } = await supabase.from('mcp_run_events').upsert({
        run_id: input.runId,
        event_key: input.eventKey.slice(0, 1_000),
        stage: input.stage,
        status: input.status,
        progress: input.progress,
        total: 100,
        message: input.message,
        detail: input.detail as Json,
      }, { onConflict: 'run_id,event_key', ignoreDuplicates: true });
      if (error) throw new Error(`Failed to append activity event: ${error.message}`);
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
