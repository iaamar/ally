import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { processIngest, type IngestDb } from '@/lib/ingest';
import type { Database, Json } from '@/lib/database.types';
import type { ScanReport, Finding } from '@ally/shared';

function buildDb(supabase: ReturnType<typeof createClient<Database>>): IngestDb {
  return {
    async findKeyOrg(hash: string) {
      const { data } = await supabase
        .from('api_keys')
        .select('id, org_id')
        .eq('key_hash', hash)
        .single();
      if (!data) return null;
      return { orgId: data.org_id, keyId: data.id };
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
      if (existing) return { id: existing.id };

      const { data: created, error } = await supabase
        .from('projects')
        .insert({ org_id: orgId, name })
        .select('id')
        .single();
      if (error || !created) throw new Error(`Failed to create project: ${error?.message}`);
      return { id: created.id };
    },
    async insertScan(projectId: string, report: ScanReport) {
      const { data, error } = await supabase
        .from('scans')
        .insert({
          project_id: projectId,
          tool_version: report.toolVersion,
          files_scanned: report.target.files,
          score: report.summary.score,
          summary: report.summary as unknown as Json,
        })
        .select('id')
        .single();
      if (error || !data) throw new Error(`Failed to insert scan: ${error?.message}`);
      return { id: data.id };
    },
    async insertFindings(scanId: string, findings: Finding[]) {
      if (findings.length === 0) return;
      const rows = findings.map((f) => ({
        scan_id: scanId,
        fingerprint: f.fingerprint,
        rule_id: f.ruleId,
        wcag: f.wcag,
        level: f.level,
        severity: f.severity,
        confidence: f.confidence,
        message: f.message,
        file: f.location.file,
        line: f.location.startLine,
        snippet: f.snippet,
        fix_class: f.fixClass,
        cluster_key: f.clusterKey,
        status: 'open' as const,
      }));
      const { error } = await supabase.from('findings').insert(rows);
      if (error) throw new Error(`Failed to insert findings: ${error.message}`);
    },
  };
}

export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'server misconfigured' }, { status: 500 });
  }

  const supabase = createClient<Database>(url, serviceKey);
  const db = buildDb(supabase);

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
