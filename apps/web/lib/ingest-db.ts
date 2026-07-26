import type { SupabaseClient } from '@supabase/supabase-js';
import type { Finding, ScanReport } from '@ally/shared';
import type { Database, Json } from './database.types';
import type { IngestDb } from './ingest';

export function createIngestDb(
  supabase: SupabaseClient<Database>,
): IngestDb {
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
      if (error || !created) {
        throw new Error(`Failed to create project: ${error?.message}`);
      }
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
      if (error || !data) {
        throw new Error(`Failed to insert scan: ${error?.message}`);
      }
      return { id: data.id };
    },
    async insertFindings(scanId: string, findings: Finding[]) {
      if (findings.length === 0) return;
      const rows = findings.map((finding) => ({
        scan_id: scanId,
        fingerprint: finding.fingerprint,
        rule_id: finding.ruleId,
        wcag: finding.wcag,
        level: finding.level,
        severity: finding.severity,
        confidence: finding.confidence,
        message: finding.message,
        file: finding.location.file,
        line: finding.location.startLine,
        snippet: finding.snippet,
        fix_class: finding.fixClass,
        cluster_key: finding.clusterKey,
        status: 'open' as const,
      }));
      const { error } = await supabase.from('findings').insert(rows);
      if (error) throw new Error(`Failed to insert findings: ${error.message}`);
    },
  };
}
