import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { scanProject, scanFiles, applyVerdicts, collectFixes } from '@ally/engine';
import { zVerdict } from '@ally/shared';
import type { Verdict, Finding, FixClass } from '@ally/shared';
import type { SessionState } from './state.js';
import { formatSummary, formatFinding } from './format.js';
import { registerPrompts } from './prompts.js';
import { pushReport } from './sync.js';

function requireReport(state: SessionState) {
  if (!state.report) {
    throw new Error('No scan report available. Run scan_project or scan_files first.');
  }
  return state.report;
}

export function buildServer(state: SessionState): McpServer {
  const server = new McpServer({
    name: 'ally-mcp',
    version: '0.1.0',
  });

  // --- Task 10: scan/query tools ---

  server.tool(
    'scan_project',
    'Scan all discoverable files in a project for accessibility issues',
    { path: z.string().optional().describe('Project root path (defaults to cwd)') },
    async ({ path }) => {
      const root = path ?? state.root ?? process.cwd();
      state.root = root;
      state.report = await scanProject(root, {
        targetLevel: state.policy.targetLevel,
        ignoreRules: state.policy.ignoreRules,
      });
      return { content: [{ type: 'text', text: formatSummary(state.report) }] };
    },
  );

  server.tool(
    'scan_files',
    'Scan specific files for accessibility issues',
    {
      path: z.string().optional().describe('Project root path (defaults to cwd)'),
      files: z.array(z.string()).describe('Relative file paths to scan'),
    },
    async ({ path, files }) => {
      const root = path ?? state.root ?? process.cwd();
      state.root = root;
      state.report = await scanFiles(root, files, {
        targetLevel: state.policy.targetLevel,
        ignoreRules: state.policy.ignoreRules,
      });
      return { content: [{ type: 'text', text: formatSummary(state.report) }] };
    },
  );

  server.tool(
    'get_findings',
    'Get filtered findings from the current scan report',
    {
      tier: z.number().int().min(1).max(3).optional().describe('Finding pass/tier (1-3)'),
      severity: z.string().optional().describe('Filter by severity'),
      ruleId: z.string().optional().describe('Filter by rule ID'),
      status: z.string().optional().describe('Filter by status'),
      limit: z.number().int().default(50).optional().describe('Max results'),
      offset: z.number().int().default(0).optional().describe('Offset for pagination'),
    },
    async ({ tier, severity, ruleId, status, limit, offset }) => {
      const report = requireReport(state);
      let results: Finding[] = report.findings;
      if (tier != null) results = results.filter((f) => f.pass === tier);
      if (severity) results = results.filter((f) => f.severity === severity);
      if (ruleId) results = results.filter((f) => f.ruleId === ruleId);
      if (status) results = results.filter((f) => (f.status ?? 'open') === status);

      const l = limit ?? 50;
      const o = offset ?? 0;
      const page = results.slice(o, o + l);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ total: results.length, offset: o, limit: l, findings: page }, null, 2),
        }],
      };
    },
  );

  server.tool(
    'explain_finding',
    'Get a detailed explanation of a specific finding',
    { fingerprint: z.string().describe('Finding fingerprint') },
    async ({ fingerprint }) => {
      const report = requireReport(state);
      const finding = report.findings.find((f) => f.fingerprint === fingerprint);
      if (!finding) {
        return { content: [{ type: 'text', text: `No finding with fingerprint "${fingerprint}" found.` }] };
      }
      return { content: [{ type: 'text', text: formatFinding(finding) }] };
    },
  );

  server.tool(
    'get_reasoning_packets',
    'Get pending reasoning packets that need human/LLM review',
    { limit: z.number().int().default(20).optional().describe('Max packets to return') },
    async ({ limit }) => {
      const report = requireReport(state);
      const packets = report.packets.slice(0, limit ?? 20);
      return {
        content: [{ type: 'text', text: JSON.stringify(packets, null, 2) }],
      };
    },
  );

  // --- Task 11: fixes, verdicts, policy, prompts, resource, sync ---

  server.tool(
    'get_fixes',
    'Collect auto-fix suggestions from the scan report',
    {
      classes: z.array(z.string()).default(['SAFE_AUTOFIX']).optional().describe('Fix classes to include'),
      fingerprints: z.array(z.string()).optional().describe('Limit to specific fingerprints'),
    },
    async ({ classes, fingerprints }) => {
      const report = requireReport(state);
      const fixClasses = (classes ?? ['SAFE_AUTOFIX']) as FixClass[];

      if (fixClasses.includes('SAFE_AUTOFIX') && state.policy.autofix === 'off') {
        return {
          content: [{
            type: 'text',
            text: 'Auto-fix is currently disabled. Use `configure_policy` with `autofix: "on"` to enable safe auto-fixes before collecting them.',
          }],
        };
      }

      const fixes = collectFixes(report, { classes: fixClasses, fingerprints });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ count: fixes.length, fixes }, null, 2),
        }],
      };
    },
  );

  server.tool(
    'resolve_reasoning',
    'Apply verdicts to pending reasoning packets',
    {
      verdicts: z.array(zVerdict).describe('Array of verdicts for reasoning packets'),
    },
    async ({ verdicts }) => {
      const report = requireReport(state);
      const before = report.packets.length;
      state.report = applyVerdicts(report, verdicts as Verdict[]);
      const after = state.report.packets.length;
      return {
        content: [{
          type: 'text',
          text: `Resolved ${before - after} reasoning packets.\n\n${formatSummary(state.report)}`,
        }],
      };
    },
  );

  server.tool(
    'configure_policy',
    'Configure the scan/fix policy for this session',
    {
      autofix: z.enum(['on', 'off']).optional().describe('Enable or disable auto-fix'),
      targetLevel: z.enum(['A', 'AA', 'AAA']).optional().describe('WCAG target level'),
      ignoreRules: z.array(z.string()).optional().describe('Rule IDs to ignore'),
    },
    async ({ autofix, targetLevel, ignoreRules }) => {
      if (autofix != null) state.policy.autofix = autofix;
      if (targetLevel != null) state.policy.targetLevel = targetLevel;
      if (ignoreRules != null) state.policy.ignoreRules = ignoreRules;
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ policy: state.policy }, null, 2),
        }],
      };
    },
  );

  server.tool(
    'sync_report',
    'Push the current scan report to the Ally dashboard',
    { projectName: z.string().optional().describe('Override project name') },
    async ({ projectName }) => {
      const report = requireReport(state);
      const apiKey = process.env['ALLY_API_KEY'];
      const baseUrl = process.env['ALLY_API_URL'] ?? 'https://web-azure-kappa-78.vercel.app';

      if (!apiKey || !baseUrl) {
        return {
          content: [{
            type: 'text',
            text: 'Missing ALLY_API_KEY or ALLY_API_URL environment variables. Set them to sync reports to the Ally dashboard.',
          }],
        };
      }

      const reportToSync = projectName
        ? { ...report, projectName }
        : report;

      const result = await pushReport(reportToSync, { apiKey, baseUrl });
      return {
        content: [{
          type: 'text',
          text: result.ok
            ? `Report synced successfully (HTTP ${result.status}).`
            : `Sync failed (HTTP ${result.status}): ${result.body}`,
        }],
      };
    },
  );

  // --- Prompts ---
  registerPrompts(server);

  // --- Resource ---
  server.resource(
    'report_latest',
    'ally://report/latest',
    { description: 'The latest scan report' },
    async () => ({
      contents: [{
        uri: 'ally://report/latest',
        mimeType: 'application/json',
        text: JSON.stringify(state.report ?? {}),
      }],
    }),
  );

  return server;
}
