import { createClient } from '@supabase/supabase-js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import {
  evaluateHostedContract,
  planHostedContract,
} from '@ally/engine/hosted-harness';
import { scanSources, type SourceFileInput } from '@ally/engine/scan-sources';
import type { ContractKnowledge } from '@ally/shared';
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { z } from 'zod';
import { createIngestDb } from '@/lib/ingest-db';
import { processIngest } from '@/lib/ingest';
import { hashApiKey } from '@/lib/keys';
import { searchWcagKnowledge } from '@/lib/knowledge';
import {
  getMcpPlatformClient,
  runWithMcpActivity,
  type HostedToolExtra,
} from '@/lib/mcp-activity';
import {
  loadHostedAttempts,
  loadHostedContract,
  saveHostedAttempt,
  saveHostedContract,
} from '@/lib/mcp-harness-store';
import type { Database } from '@/lib/database.types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const readPlatform = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

const writePlatform = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

const fileSchema = z.object({
  path: z.string().min(1).max(500),
  content: z.string().max(200_000).optional(),
  source: z.string().max(200_000).optional(),
}).refine((file) => file.content !== undefined || file.source !== undefined, {
  message: 'Each file requires content or source.',
});

const filesSchema = z.array(fileSchema).min(1).max(100);

function getPlatformClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error('Ally platform storage is not configured.');
  return createClient<Database>(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function errorResult(text: string) {
  return { isError: true, content: [{ type: 'text' as const, text }] };
}

function normalizeFiles(
  files: Array<{ path: string; content?: string; source?: string }>,
): { files?: SourceFileInput[]; error?: string } {
  const normalized = files.map((file) => ({
    path: file.path.replaceAll('\\', '/'),
    content: file.content ?? file.source ?? '',
  }));
  const invalid = normalized.find((file) => {
    const segments = file.path.split('/');
    return (
      file.path.startsWith('/') ||
      segments.includes('..') ||
      !/\.(?:html?|[cm]?[jt]sx?)$/i.test(file.path)
    );
  });
  if (invalid) {
    return {
      error: `Unsupported source path "${invalid.path}". Use a relative JS, JSX, TS, TSX, HTML, or HTM path without "..".`,
    };
  }
  const totalBytes = normalized.reduce(
    (total, file) => total + Buffer.byteLength(file.content, 'utf8'),
    0,
  );
  if (totalBytes > 2_000_000) {
    return { error: 'The supplied source exceeds the 2 MB limit. Split it into smaller scans.' };
  }
  return { files: normalized };
}

async function persistReport(
  projectName: string,
  report: Awaited<ReturnType<typeof scanSources>>,
  extra: HostedToolExtra,
): Promise<{ projectId: string; scanId: string; scanUrl: string }> {
  const rawKey = extra.authInfo?.token;
  const stored = await processIngest(
    createIngestDb(getPlatformClient()),
    rawKey ?? null,
    { projectName, report },
  );
  if (stored.status !== 201) {
    throw new Error(`Could not persist scan: ${JSON.stringify(stored.json)}`);
  }
  return stored.json as { projectId: string; scanId: string; scanUrl: string };
}

function formatKnowledge(result: Awaited<ReturnType<typeof searchWcagKnowledge>>): string {
  if (result.results.length === 0) return 'No matching WCAG passages were found.';
  return result.results.map((hit, index) => {
    const citation = [
      hit.citation.title ?? 'WCAG guidance',
      hit.citation.criterion,
      hit.citation.level ? `Level ${hit.citation.level}` : null,
    ].filter(Boolean).join(' — ');
    return `[S${index + 1}] ${citation}\n${hit.citation.url ?? ''}\n${hit.content.slice(0, 1_500)}`;
  }).join('\n\n');
}

async function verifyAllyToken(
  request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken?.startsWith('ally_sk_')) return undefined;
  const db = createIngestDb(getPlatformClient());
  const key = await db.findKeyOrg(hashApiKey(bearerToken));
  if (!key) return undefined;
  await db.touchKey(key.keyId);
  return {
    token: bearerToken,
    scopes: ['ally:use'],
    clientId: key.keyId,
    extra: {
      orgId: key.orgId,
      keyId: key.keyId,
      ...(key.keyName ? { keyName: key.keyName } : {}),
      clientName: (
        request.headers.get('x-mcp-client-name')
        ?? request.headers.get('user-agent')
        ?? 'Unknown MCP client'
      ).slice(0, 120),
    },
  };
}

const handler = createMcpHandler(
  (server) => {
    const registerKnowledge = (name: 'search_wcag' | 'search_wcag_knowledge') => {
      server.tool(
        name,
        'Search Ally WCAG knowledge using metadata-filtered hybrid retrieval with lexical fallback',
        {
          query: z.string().min(1).max(2_000),
          version: z.string().max(20).optional(),
          levels: z.array(z.enum(['A', 'AA', 'AAA'])).max(3).optional(),
          matchCount: z.number().int().min(1).max(25).default(8).optional(),
        },
        readPlatform,
        async ({ query, version, levels, matchCount }, extra) =>
          runWithMcpActivity(name, extra, async (activity) => {
            await activity.progress(10, 'Preparing the WCAG query.', 'validate');
            await activity.progress(35, 'Searching semantic and lexical indexes.', 'search');
            const result = await searchWcagKnowledge(query, {
              version,
              levels,
              matchCount: matchCount ?? 8,
              signal: activity.signal,
            });
            await activity.progress(90, `Found ${result.results.length} relevant passages.`, 'format', {
              resultCount: result.results.length,
              mode: result.mode,
            });
            return textResult(JSON.stringify(result, null, 2));
          }),
      );
    };

    const registerScan = (name: 'scan_accessibility' | 'scan_source_files') => {
      server.tool(
        name,
        'Scan supplied JSX, TSX, JavaScript, TypeScript, or HTML and persist the report',
        {
          projectName: z.string().trim().min(1).max(120),
          targetLevel: z.enum(['A', 'AA', 'AAA']).default('AA').optional(),
          ignoreRules: z.array(z.string().min(1).max(120)).max(100).optional(),
          files: filesSchema,
        },
        writePlatform,
        async ({ projectName, targetLevel, ignoreRules, files }, extra) =>
          runWithMcpActivity(name, extra, async (activity) => {
            await activity.progress(5, 'Validating supplied source files.', 'validate', {
              fileCount: files.length,
            });
            const normalized = normalizeFiles(files);
            if (normalized.error || !normalized.files) return errorResult(normalized.error ?? 'Invalid files.');
            await activity.progress(25, `Scanning ${normalized.files.length} files.`, 'scan', {
              fileCount: normalized.files.length,
            });
            const report = await scanSources(projectName, normalized.files, {
              targetLevel: targetLevel ?? 'AA',
              ignoreRules: ignoreRules ?? [],
            }, activity.signal);
            await activity.progress(75, 'Persisting scan and findings.', 'persist', {
              findingCount: report.summary.total,
            });
            const stored = await persistReport(projectName, report, extra);
            await activity.link({ projectId: stored.projectId });
            await activity.progress(95, 'Scan is available in the Ally workspace.', 'complete', {
              scanId: stored.scanId,
              score: report.summary.score,
            });
            return textResult(JSON.stringify({
              ...stored,
              report: {
                scanRef: report.scanId,
                summary: report.summary,
                findings: report.findings.slice(0, 50),
                findingsTruncated: report.findings.length > 50,
                reasoningPackets: report.packets.slice(0, 20),
                reasoningPacketsTruncated: report.packets.length > 20,
              },
            }, null, 2));
          }),
      );
    };

    server.tool(
      'get_ally_health',
      'Check the authenticated Ally remote MCP server and WCAG retrieval path',
      {},
      readPlatform,
      async (_args, extra) =>
        runWithMcpActivity('get_ally_health', extra, async (activity) => {
          const started = performance.now();
          await activity.progress(30, 'Checking WCAG retrieval.', 'knowledge');
          const knowledge = await searchWcagKnowledge(
            'WCAG 2.2 contrast minimum',
            { version: '2.2', levels: ['AA'], matchCount: 1, signal: activity.signal },
          );
          return textResult(JSON.stringify({
            status: 'healthy',
            transport: 'streamable_http',
            authentication: 'ally_api_key',
            exposedTools: 11,
            knowledge: {
              status: 'healthy',
              mode: knowledge.mode,
              embeddingProvider: knowledge.embeddingProvider,
              latencyMs: Math.round(performance.now() - started),
            },
            capabilities: {
              nativeProgress: true,
              durableActivity: true,
              suppliedSourceScan: true,
              hostedRemediation: true,
              localFilesystemScan: false,
              runtimeBrowserScan: false,
            },
          }, null, 2));
        }),
    );

    registerKnowledge('search_wcag');
    registerKnowledge('search_wcag_knowledge');

    server.tool(
      'explain_finding',
      'Ground one accessibility finding in WCAG evidence and provide context for a correct fix',
      {
        ruleId: z.string().min(1).max(120),
        snippet: z.string().max(2_000).optional(),
        wcag: z.array(z.string().min(1).max(20)).max(10).optional(),
      },
      readPlatform,
      async ({ ruleId, snippet, wcag }, extra) =>
        runWithMcpActivity('explain_finding', extra, async (activity) => {
          await activity.progress(25, 'Finding relevant WCAG criteria.', 'search');
          const knowledge = await searchWcagKnowledge(
            `${ruleId.replaceAll('-', ' ')} ${wcag?.join(' ') ?? ''}`.trim(),
            { version: '2.2', matchCount: 4, signal: activity.signal },
          );
          await activity.progress(90, 'Preparing grounded explanation context.', 'format', {
            resultCount: knowledge.results.length,
          });
          return textResult([
            `Rule: ${ruleId}`,
            wcag?.length ? `Criteria: ${wcag.join(', ')}` : '',
            snippet ? `Offending code:\n${snippet.slice(0, 1_000)}` : '',
            '',
            'Grounding sources:',
            formatKnowledge(knowledge),
          ].filter(Boolean).join('\n'));
        }),
    );

    registerScan('scan_accessibility');
    registerScan('scan_source_files');

    server.tool(
      'plan_fixes',
      'Create a durable remediation contract from supplied source and matching findings',
      {
        projectName: z.string().trim().min(1).max(120),
        targetLevel: z.enum(['A', 'AA', 'AAA']).default('AA').optional(),
        files: filesSchema,
        ruleId: z.string().max(120).optional(),
        clusterKey: z.string().max(500).optional(),
        fingerprints: z.array(z.string().max(120)).max(50).optional(),
        maxFindings: z.number().int().min(1).max(50).default(10).optional(),
      },
      writePlatform,
      async ({ projectName, targetLevel, files, ruleId, clusterKey, fingerprints, maxFindings }, extra) =>
        runWithMcpActivity('plan_fixes', extra, async (activity) => {
          await activity.progress(5, 'Validating contract source.', 'validate');
          const normalized = normalizeFiles(files);
          if (normalized.error || !normalized.files) return errorResult(normalized.error ?? 'Invalid files.');
          await activity.progress(25, 'Scanning the contract baseline.', 'scan');
          const report = await scanSources(projectName, normalized.files, {
            targetLevel: targetLevel ?? 'AA',
          }, activity.signal);
          const probe = planHostedContract({
            report,
            sources: normalized.files,
            options: { ruleId, clusterKey, fingerprints, maxFindings },
          });
          const criteria = [...new Set(probe.targets.flatMap((target) => target.wcag))];
          await activity.progress(50, 'Grounding the contract in WCAG guidance.', 'knowledge', {
            criteria,
          });
          const knowledgeResult = criteria.length
            ? await searchWcagKnowledge(criteria.join(' '), {
                version: '2.2',
                matchCount: Math.min(12, criteria.length * 2),
                signal: activity.signal,
              })
            : { results: [] };
          const knowledge: ContractKnowledge[] = knowledgeResult.results
            .filter((hit) => hit.citation.criterion)
            .map((hit) => ({
              criterion: hit.citation.criterion ?? '',
              level: hit.citation.level ?? '',
              title: hit.citation.title ?? 'WCAG guidance',
              excerpt: hit.content.slice(0, 400),
            }));
          const contract = planHostedContract({
            report,
            sources: normalized.files,
            options: { ruleId, clusterKey, fingerprints, maxFindings },
            knowledge,
          });
          await activity.progress(70, 'Persisting scan and remediation contract.', 'persist');
          const storedScan = await persistReport(projectName, report, extra);
          const workflowRunId = await activity.createWorkflow(
            storedScan.projectId,
            `Planning ${contract.targets.length} remediation targets.`,
          );
          await saveHostedContract(activity.orgId, projectName, workflowRunId, contract);
          await getMcpPlatformClient().from('mcp_runs').update({
            contract_id: contract.contractId,
            status: 'waiting',
            progress: 40,
            current_stage: 'implement',
            message: 'Waiting for the coding agent to implement the contracted fixes.',
            updated_at: new Date().toISOString(),
          }).eq('id', workflowRunId);
          await activity.link({
            projectId: storedScan.projectId,
            parentRunId: workflowRunId,
            contractId: contract.contractId,
          });
          await activity.workflowEvent(
            workflowRunId,
            'implement',
            'waiting',
            'Waiting for the coding agent to implement the contracted fixes.',
            40,
            { contractId: contract.contractId, targets: contract.targets.length },
          );
          await activity.progress(95, 'Remediation contract is ready.', 'complete', {
            contractId: contract.contractId,
          });
          return textResult(JSON.stringify({
            contract,
            projectId: storedScan.projectId,
            scanId: storedScan.scanId,
            instructions: [
              `Edit only: ${contract.scope.allowedFiles.join(', ')}`,
              `Then call verify_fixes with contractId "${contract.contractId}" and every baseline file.`,
            ],
          }, null, 2));
        }),
    );

    server.tool(
      'record_progress',
      'Record remediation implementation progress on the live Ally activity timeline',
      {
        contractId: z.string().min(1).max(120),
        message: z.string().min(1).max(500),
        status: z.enum(['running', 'waiting', 'succeeded', 'failed', 'info']).default('running').optional(),
      },
      writePlatform,
      async ({ contractId, message, status }, extra) =>
        runWithMcpActivity('record_progress', extra, async (activity) => {
          const stored = await loadHostedContract(activity.orgId, contractId);
          if (!stored) return errorResult(`Contract ${contractId} was not found.`);
          if (!stored.workflowRunId) return errorResult(`Contract ${contractId} has no activity run.`);
          await activity.link({ parentRunId: stored.workflowRunId, contractId });
          await activity.workflowEvent(
            stored.workflowRunId,
            'implement',
            status ?? 'running',
            message,
            55,
            { contractId },
          );
          return textResult('Progress recorded.');
        }),
    );

    server.tool(
      'verify_fixes',
      'Re-scan a durable remediation contract and deterministically judge the current attempt',
      {
        contractId: z.string().min(1).max(120),
        files: filesSchema,
        targetLevel: z.enum(['A', 'AA', 'AAA']).default('AA').optional(),
      },
      writePlatform,
      async ({ contractId, files, targetLevel }, extra) =>
        runWithMcpActivity('verify_fixes', extra, async (activity) => {
          await activity.progress(5, 'Loading the remediation contract.', 'load');
          const stored = await loadHostedContract(activity.orgId, contractId);
          if (!stored) return errorResult(`Contract ${contractId} was not found.`);
          const normalized = normalizeFiles(files);
          if (normalized.error || !normalized.files) return errorResult(normalized.error ?? 'Invalid files.');
          await activity.link({
            ...(stored.workflowRunId ? { parentRunId: stored.workflowRunId } : {}),
            contractId,
          });
          await activity.progress(25, 'Validating the exact contract file set.', 'validate');
          const attempts = await loadHostedAttempts(stored.rowId);
          if (stored.workflowRunId) {
            await activity.workflowEvent(
              stored.workflowRunId,
              'evaluate',
              'running',
              `Evaluating remediation attempt ${attempts.length + 1}.`,
              70,
              { contractId, attempt: attempts.length + 1 },
            );
          }
          await activity.progress(50, 'Re-scanning the edited source.', 'scan');
          const evaluation = await evaluateHostedContract({
            contract: stored.contract,
            attempts,
            sources: normalized.files,
            policy: { targetLevel: targetLevel ?? 'AA' },
            signal: activity.signal,
          });
          await activity.progress(80, 'Persisting the deterministic verdict.', 'persist', {
            verdict: evaluation.result.verdict,
          });
          await saveHostedAttempt(stored.rowId, evaluation.attempt, evaluation.result);
          if (stored.workflowRunId) {
            const settled = evaluation.result.nextAction === 'settled';
            const escalated = evaluation.result.nextAction === 'escalate';
            await activity.workflowEvent(
              stored.workflowRunId,
              settled ? 'settle' : escalated ? 'evaluate' : 'repair',
              settled ? 'succeeded' : escalated ? 'escalated' : 'waiting',
              `${evaluation.result.verdict}: ${evaluation.result.reason}`,
              settled || escalated ? 100 : 80,
              {
                contractId,
                attempt: evaluation.result.attempt,
                verdict: evaluation.result.verdict,
                checks: evaluation.result.checks,
              },
            );
          }
          return {
            ...textResult(JSON.stringify(evaluation.result, null, 2)),
            isError: evaluation.result.verdict !== 'pass',
          };
        }),
    );

    server.tool(
      'list_scans',
      'List scans in the authenticated Ally organization, newest first',
      { limit: z.number().int().min(1).max(50).default(10).optional() },
      readPlatform,
      async ({ limit }, extra) =>
        runWithMcpActivity('list_scans', extra, async (activity) => {
          const db = getMcpPlatformClient();
          const { data: projects } = await db.from('projects')
            .select('id, name')
            .eq('org_id', activity.orgId);
          const projectIds = (projects ?? []).map((project) => project.id);
          if (!projectIds.length) return textResult('No scans yet.');
          const { data: scans } = await db.from('scans')
            .select('id, project_id, created_at, files_scanned, score')
            .in('project_id', projectIds)
            .order('created_at', { ascending: false })
            .limit(limit ?? 10);
          const names = new Map((projects ?? []).map((project) => [project.id, project.name]));
          return textResult((scans ?? []).map((scan) =>
            `- ${scan.id}  ${names.get(scan.project_id) ?? 'unknown'}  score ${scan.score}/100  ${scan.files_scanned} files  ${scan.created_at}`,
          ).join('\n') || 'No scans yet.');
        }),
    );

    server.tool(
      'get_findings',
      'Read findings from an owned scan, or from the newest scan when scanId is omitted',
      {
        scanId: z.string().uuid().optional(),
        severity: z.enum(['blocker', 'critical', 'serious', 'moderate', 'minor']).optional(),
        limit: z.number().int().min(1).max(200).default(25).optional(),
      },
      readPlatform,
      async ({ scanId, severity, limit }, extra) =>
        runWithMcpActivity('get_findings', extra, async (activity) => {
          const db = getMcpPlatformClient();
          const { data: projects } = await db.from('projects').select('id').eq('org_id', activity.orgId);
          const projectIds = (projects ?? []).map((project) => project.id);
          if (!projectIds.length) return textResult('No scans yet.');
          let targetScanId = scanId;
          if (targetScanId) {
            const { data } = await db.from('scans')
              .select('id')
              .eq('id', targetScanId)
              .in('project_id', projectIds)
              .maybeSingle();
            if (!data) return errorResult(`Scan ${targetScanId} was not found.`);
          } else {
            const { data } = await db.from('scans')
              .select('id')
              .in('project_id', projectIds)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            targetScanId = data?.id;
          }
          if (!targetScanId) return textResult('No scans yet.');
          let query = db.from('findings')
            .select('rule_id, severity, wcag, message, file, line, fingerprint, match_key, ordinal')
            .eq('scan_id', targetScanId)
            .limit(limit ?? 25);
          if (severity) query = query.eq('severity', severity);
          const { data: findings } = await query;
          return textResult(JSON.stringify({
            scanId: targetScanId,
            findings: findings ?? [],
          }, null, 2));
        }),
    );
  },
  {
    serverInfo: { name: 'ally-remote-mcp', version: '0.2.0' },
    instructions: [
      'Ally is an API-key-authenticated accessibility brain.',
      'Use search_wcag before stating WCAG requirements and explain_finding for grounded defect context.',
      'Use scan_accessibility, then plan_fixes, edit only contracted files, and call verify_fixes.',
      'If verification fails, follow its feedback and retry; stop when it passes or escalates.',
      'Use record_progress during longer implementations so the Ally workspace stays current.',
      'This hosted server accepts supplied source but never stores source contents.',
      'Use the local Ally MCP for filesystem discovery, Playwright runtime scans, and approved project tests.',
    ].join(' '),
  },
  {
    basePath: '/api',
    disableSse: true,
    maxDuration: 60,
    sessionIdGenerator: undefined,
  },
);

const authenticatedHandler = withMcpAuth(handler, verifyAllyToken, {
  required: true,
  requiredScopes: ['ally:use'],
});

export {
  authenticatedHandler as GET,
  authenticatedHandler as POST,
  authenticatedHandler as DELETE,
};
