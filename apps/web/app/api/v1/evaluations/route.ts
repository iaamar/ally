import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { Database, Json } from '@/lib/database.types';
import {
  processEvaluationIngest,
  type EvaluationIngestDb,
} from '@/lib/evaluation-ingest';

function buildDb(
  supabase: ReturnType<typeof createClient<Database>>,
): EvaluationIngestDb {
  return {
    async findKeyOrg(hash: string) {
      const { data } = await supabase
        .from('api_keys')
        .select('id, org_id')
        .eq('key_hash', hash)
        .single();
      if (!data) return null;
      return { orgId: data.org_id as string, keyId: data.id as string };
    },
    async touchKey(keyId: string) {
      await supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', keyId);
    },
    async upsertProject(orgId: string, name: string) {
      const { data: existing } = await supabase
        .from('projects')
        .select('id')
        .eq('org_id', orgId)
        .eq('name', name)
        .single();
      if (existing) return { id: existing.id as string };

      const { data, error } = await supabase
        .from('projects')
        .insert({ org_id: orgId, name })
        .select('id')
        .single();
      if (error || !data) {
        throw new Error(`Failed to create project: ${error?.message}`);
      }
      return { id: data.id as string };
    },
    async storeEvaluation(projectId, scanId, contract, evaluation) {
      let query = supabase
        .from('scans')
        .select('id, summary')
        .eq('project_id', projectId);

      query = scanId
        ? query.eq('id', scanId)
        : query.order('created_at', { ascending: false }).limit(1);

      const { data: scan, error: findError } = await query.maybeSingle();
      if (findError || !scan) {
        throw new Error(`Failed to find synced scan: ${findError?.message ?? 'scan not found'}`);
      }

      const currentSummary =
        scan.summary && typeof scan.summary === 'object' && !Array.isArray(scan.summary)
          ? scan.summary
          : {};
      const { error } = await supabase
        .from('scans')
        .update({
          summary: {
            ...currentSummary,
            remediation: {
              contract,
              evaluation,
              updatedAt: new Date().toISOString(),
            },
          } as Json,
        })
        .eq('id', scan.id);
      if (error) throw new Error(`Failed to store evaluation: ${error.message}`);
      return { scanId: scan.id as string };
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
    const result = await processEvaluationIngest(
      buildDb(createClient<Database>(url, serviceKey)),
      rawKey,
      body,
    );
    return NextResponse.json(result.json, { status: result.status });
  } catch (error) {
    console.error('Evaluation ingest failed:', error);
    return NextResponse.json({ error: 'evaluation ingest failed' }, { status: 500 });
  }
}
