import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { randomUUID } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { z } from 'zod';
import { scanProject, scanFiles, applyVerdicts, collectFixes } from '@ally/engine';
import { zVerdict } from '@ally/shared';
import type { Verdict, Finding, FixClass } from '@ally/shared';
import type { SessionState } from './state.js';
import { formatSummary, formatFinding } from './format.js';
import { registerPrompts } from './prompts.js';
import {
  pushEvaluation,
  pushHarnessEvent,
  pushReport,
  type HarnessEventStatus,
  type HarnessRunStatus,
} from './sync.js';
import {
  createSprintContract,
  evaluateSprintContract,
  type SprintContract,
} from './harness.js';
import { searchKnowledge } from './knowledge.js';
import { checkAllyHealth } from './health.js';
import {
  resolveEvaluationProfile,
  runApprovedTestScripts,
  scanForEvaluation,
} from './evaluator.js';

function requireReport(state: SessionState) {
  if (!state.report) {
    throw new Error('No scan report available. Run scan_project or scan_files first.');
  }
  return state.report;
}

function plannedLocalChanges(goals: SprintContract['goals']) {
  const byFile = new Map<string, SprintContract['goals']>();
  for (const goal of goals) {
    const fileGoals = byFile.get(goal.file) ?? [];
    fileGoals.push(goal);
    byFile.set(goal.file, fileGoals);
  }
  return [...byFile.entries()].map(([path, fileGoals]) => ({
    path,
    changes: fileGoals.map((goal) => ({
      rule: goal.ruleId,
      line: goal.line,
      severity: goal.severity,
      fixClass: goal.fixClass,
      acceptance: goal.acceptance,
    })),
  }));
}

function ensureHarnessRun(
  state: SessionState,
  projectName: string,
  sourceScanRef?: string,
): void {
  state.harnessRunId ??= randomUUID();
  state.harnessProjectName = projectName;
  if (sourceScanRef) state.harnessSourceScanRef = sourceScanRef;
}

async function emitHarnessEvent(
  state: SessionState,
  event: {
    stage: string;
    eventStatus: HarnessEventStatus;
    runStatus: HarnessRunStatus;
    message: string;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  const apiKey = process.env.ALLY_API_KEY;
  const baseUrl = process.env.ALLY_API_URL;
  if (!apiKey || !baseUrl || !state.harnessRunId || !state.harnessProjectName) return;

  try {
    await pushHarnessEvent({
      projectName: state.harnessProjectName,
      runId: state.harnessRunId,
      ...(state.harnessScanId ? { scanId: state.harnessScanId } : {}),
      ...(state.harnessSourceScanRef
        ? { sourceScanRef: state.harnessSourceScanRef }
        : {}),
      ...event,
    }, { apiKey, baseUrl });
  } catch {
    // Observability is best-effort and must never break the scan/evaluator itself.
  }
}

export function buildServer(state: SessionState): McpServer {
  const server = new McpServer({
    name: 'ally-mcp',
    version: '0.1.0',
  }, {
    instructions: [
      'Ally is the deterministic accessibility brain for this coding session.',
      'For remediation work: check health when needed, scan the project, sync the scan, create a remediation contract, implement only the contracted fixes, evaluate deterministically, repair failures, and sync the final evaluation.',
      'Use search_wcag_knowledge for grounded WCAG guidance.',
      'Never claim remediation passed until evaluate_remediation returns passed.',
      'Report file-level updates with report_harness_progress while implementing or repairing fixes.',
      'The configured Ally API key authorizes platform search, dashboard sync, evaluation sync, and live run events.',
    ].join(' '),
  });

  const readLocal = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  } as const;
  const readPlatform = {
    ...readLocal,
    openWorldHint: true,
  } as const;
  const writeSession = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  } as const;
  const writePlatform = {
    ...writeSession,
    openWorldHint: true,
  } as const;

  // --- Task 10: scan/query tools ---

  server.tool(
    'get_ally_health',
    'Check MCP environment bootstrap, Supabase knowledge retrieval, and BGE embeddings',
    {},
    readPlatform,
    async () => {
      const health = await checkAllyHealth();
      return {
        content: [{ type: 'text', text: JSON.stringify(health, null, 2) }],
        isError: health.status === 'unavailable',
      };
    },
  );

  server.tool(
    'search_wcag_knowledge',
    'Search the WCAG knowledge base with metadata-filtered hybrid retrieval and a full-text fallback',
    {
      query: z.string().min(1).describe('Accessibility question or exact WCAG identifier'),
      version: z.string().optional().describe('WCAG version, for example 2.2'),
      levels: z.array(z.enum(['A', 'AA', 'AAA'])).optional().describe('Conformance levels'),
      matchCount: z.number().int().min(1).max(25).default(8).optional(),
    },
    readPlatform,
    async ({ query, version, levels, matchCount }) => {
      const result = await searchKnowledge(query, {
        version,
        levels,
        matchCount: matchCount ?? 8,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'plan_remediation',
    'Turn the current scan into a bounded sprint contract with explicit acceptance criteria',
    {
      severities: z.array(z.enum(['blocker', 'critical', 'serious', 'moderate', 'minor'])).optional(),
      fixClasses: z.array(z.enum(['SAFE_AUTOFIX', 'SUGGEST', 'NEEDS_HUMAN'])).optional(),
      limit: z.number().int().min(1).max(50).default(10).optional(),
      maxNewFindings: z.number().int().min(0).default(0).optional(),
      runtime: z.boolean().optional().describe('Require Playwright/axe runtime evaluation'),
      appUrl: z.string().url().optional().describe('Running application base URL'),
      routes: z.array(z.string().min(1)).max(50).optional(),
      testScripts: z.array(z.string().min(1)).max(20).optional()
        .describe('Explicit package.json scripts approved as evaluator gates'),
      runtimeTimeoutMs: z.number().int().min(1_000).max(120_000).optional(),
      testTimeoutMs: z.number().int().min(1_000).max(600_000).optional(),
    },
    writePlatform,
    async ({
      severities,
      fixClasses,
      limit,
      maxNewFindings,
      runtime,
      appUrl,
      routes,
      testScripts,
      runtimeTimeoutMs,
      testTimeoutMs,
    }) => {
      let report = requireReport(state);
      ensureHarnessRun(state, report.projectName, report.scanId);
      await emitHarnessEvent(state, {
        stage: 'plan',
        eventStatus: 'running',
        runStatus: 'running',
        message: 'Creating the remediation sprint contract.',
        detail: {
          input: {
            projectName: report.projectName,
            baselineScan: report.scanId,
            selectedSeverities: severities ?? 'all',
            selectedFixClasses: fixClasses ?? 'all',
            limit: limit ?? 10,
          },
          action: 'Build a bounded file-level remediation plan and deterministic acceptance gates.',
        },
      });
      const profile = resolveEvaluationProfile(report.target.root, {
        runtime,
        appUrl,
        routes,
        testScripts,
        runtimeTimeoutMs,
        testTimeoutMs,
      });

      if (profile.runtime) {
        const baselineScan = await scanForEvaluation(
          report.target.root,
          state.policy,
          profile,
        );
        if (!baselineScan.runtime.passed) {
          await emitHarnessEvent(state, {
            stage: 'plan',
            eventStatus: 'failed',
            runStatus: 'failed',
            message: 'Runtime baseline failed; the remediation contract was not created.',
            detail: { runtime: baselineScan.runtime },
          });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'Runtime baseline failed; no remediation contract was created.',
                runtime: baselineScan.runtime,
              }, null, 2),
            }],
            isError: true,
          };
        }
        report = baselineScan.report;
        state.report = report;
      }

      const baselineTests = await runApprovedTestScripts(
        report.target.root,
        profile.testScripts,
        profile.testTimeoutMs,
      );
      if (baselineTests.some((test) => !test.passed)) {
        await emitHarnessEvent(state, {
          stage: 'plan',
          eventStatus: 'failed',
          runStatus: 'failed',
          message: 'Baseline test gates failed; the remediation contract was not created.',
          detail: { tests: baselineTests },
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'Baseline test gates failed; no remediation contract was created.',
              tests: baselineTests,
            }, null, 2),
          }],
          isError: true,
        };
      }

      state.contract = createSprintContract(report, {
        severities,
        fixClasses,
        limit,
        maxNewFindings,
      }, profile, baselineTests);
      state.evaluation = undefined;
      state.evaluationAttempts = 0;
      await emitHarnessEvent(state, {
        stage: 'plan',
        eventStatus: 'completed',
        runStatus: 'waiting',
        message: `Sprint contract created with ${state.contract.goals.length} remediation goal${state.contract.goals.length === 1 ? '' : 's'}.`,
        detail: {
          action: 'Freeze the remediation scope before implementation begins.',
          output: {
            contractId: state.contract.id,
            goalCount: state.contract.goals.length,
            files: plannedLocalChanges(state.contract.goals),
            acceptance: {
              maxNewFindings: state.contract.maxNewFindings,
              runtime: state.contract.evaluationProfile.runtime,
              testScripts: state.contract.evaluationProfile.testScripts,
            },
          },
        },
      });
      await emitHarnessEvent(state, {
        stage: 'implement',
        eventStatus: 'waiting',
        runStatus: 'waiting',
        message: 'Waiting for the generator to implement the contracted fixes.',
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            contract: state.contract,
            generatorInstructions: [
              'Change only what is needed to satisfy the contracted goals.',
              profile.testScripts.length
                ? `The evaluator will run these approved scripts: ${profile.testScripts.join(', ')}.`
                : 'Run the project tests relevant to the changed files.',
              profile.runtime
                ? `Keep the application available at ${profile.appUrl} for runtime evaluation.`
                : 'Runtime browser evaluation is not required by this contract.',
              'Call evaluate_remediation when the implementation is ready.',
            ],
          }, null, 2),
        }],
      };
    },
  );

  server.tool(
    'evaluate_remediation',
    'Re-scan the contracted project and pass or reject the sprint based on resolved goals and regressions',
    {},
    writePlatform,
    async () => {
      if (!state.contract) {
        throw new Error('No sprint contract available. Run plan_remediation after a scan first.');
      }
      ensureHarnessRun(
        state,
        state.report?.projectName ?? basename(resolve(state.contract.root)),
        state.contract.baselineScanId,
      );
      await emitHarnessEvent(state, {
        stage: 'evaluate',
        eventStatus: 'running',
        runStatus: 'running',
        message: `Running deterministic evaluation attempt ${state.evaluationAttempts + 1}.`,
        detail: {
          input: {
            contractId: state.contract.id,
            attempt: state.evaluationAttempts + 1,
            files: [...new Set(state.contract.goals.map((goal) => goal.file))],
            goalCount: state.contract.goals.length,
          },
          action: 'Re-scan the contracted project and execute every required runtime and test gate.',
        },
      });
      const currentScan = await scanForEvaluation(
        state.contract.root,
        state.policy,
        state.contract.evaluationProfile,
      );
      const tests = await runApprovedTestScripts(
        state.contract.root,
        state.contract.evaluationProfile.testScripts,
        state.contract.evaluationProfile.testTimeoutMs,
      );
      const base = evaluateSprintContract(state.contract, currentScan.report);
      const testsPassed = tests.every((test) => test.passed);
      const gates = {
        contractedFindingsResolved: base.unresolvedGoals.length === 0,
        noFindingRegressions:
          base.newFindings.length <= state.contract.maxNewFindings &&
          currentScan.report.summary.total <= state.contract.baselineFindingCount,
        runtimePassed: currentScan.runtime.passed,
        testsPassed,
      };
      const reasons = [...base.reasons];
      if (!currentScan.runtime.passed) {
        reasons.push('One or more required runtime routes could not be evaluated.');
      }
      if (!testsPassed) {
        reasons.push('One or more approved project test scripts failed.');
      }
      const evaluation = {
        ...base,
        attempt: state.evaluationAttempts + 1,
        passed: Object.values(gates).every(Boolean),
        gates,
        runtime: currentScan.runtime,
        tests,
        reasons,
      };
      state.report = currentScan.report;
      state.evaluationAttempts = evaluation.attempt;
      state.evaluation = evaluation;
      await emitHarnessEvent(state, {
        stage: 'evaluate',
        eventStatus: evaluation.passed ? 'completed' : 'failed',
        runStatus: evaluation.passed ? 'passed' : 'failed',
        message: evaluation.passed
          ? 'All deterministic acceptance gates passed.'
          : `Evaluation failed: ${evaluation.reasons.join(' ')}`,
        detail: {
          action: 'Compare the fresh scan and test evidence against the frozen contract.',
          output: {
            attempt: evaluation.attempt,
            passed: evaluation.passed,
            gates: evaluation.gates,
            score: evaluation.score,
            resolved: evaluation.resolvedGoals.map((goal) => ({
              file: goal.file,
              line: goal.line,
              rule: goal.ruleId,
            })),
            unresolved: evaluation.unresolvedGoals.map((goal) => ({
              file: goal.file,
              line: goal.line,
              rule: goal.ruleId,
            })),
            newFindings: evaluation.newFindings.map((finding) => ({
              file: finding.location.file,
              line: finding.location.startLine,
              rule: finding.ruleId,
              severity: finding.severity,
            })),
            reasons: evaluation.reasons,
          },
        },
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(evaluation, null, 2) }],
        isError: !evaluation.passed,
      };
    },
  );

  server.tool(
    'scan_project',
    'Scan all discoverable files, optionally including configured Playwright/axe runtime routes',
    {
      path: z.string().optional().describe('Project root path (defaults to cwd)'),
      runtime: z.boolean().optional(),
      appUrl: z.string().url().optional(),
      routes: z.array(z.string().min(1)).max(50).optional(),
      runtimeTimeoutMs: z.number().int().min(1_000).max(120_000).optional(),
    },
    writePlatform,
    async ({ path, runtime, appUrl, routes, runtimeTimeoutMs }) => {
      const root = path ?? state.root ?? process.cwd();
      state.root = root;
      state.harnessRunId = randomUUID();
      state.harnessProjectName = basename(resolve(root));
      state.harnessScanId = undefined;
      state.harnessSourceScanRef = undefined;
      await emitHarnessEvent(state, {
        stage: 'connect',
        eventStatus: 'completed',
        runStatus: 'running',
        message: 'MCP session connected and accepted the scan request.',
      });
      await emitHarnessEvent(state, {
        stage: 'scan',
        eventStatus: 'running',
        runStatus: 'running',
        message: 'Discovering files and running accessibility rules.',
        detail: {
          input: {
            projectName: state.harnessProjectName,
            root,
            runtime: runtime ?? false,
            routes: routes ?? [],
          },
          action: 'Discover supported files, run static rules, and run configured browser checks.',
        },
      });
      const profile = resolveEvaluationProfile(root, {
        runtime,
        appUrl,
        routes,
        runtimeTimeoutMs,
        testScripts: [],
      });
      let result;
      try {
        result = await scanForEvaluation(root, state.policy, profile);
        state.report = result.report;
        state.harnessProjectName = result.report.projectName;
        state.harnessSourceScanRef = result.report.scanId;
        await emitHarnessEvent(state, {
          stage: 'scan',
          eventStatus: result.runtime.passed ? 'completed' : 'failed',
          runStatus: result.runtime.passed ? 'waiting' : 'failed',
          message: result.runtime.passed
            ? `Scan completed: ${result.report.summary.total} findings across ${result.report.target.files} files.`
            : 'Static scan completed, but one or more runtime routes failed.',
          detail: {
            action: 'Persist the deterministic scan result in the active MCP session.',
            output: {
              scanRef: result.report.scanId,
              files: result.report.target.files,
              findings: result.report.summary.total,
              score: result.report.summary.score,
              severity: result.report.summary.bySeverity,
              runtime: result.runtime,
            },
          },
        });
      } catch (error) {
        await emitHarnessEvent(state, {
          stage: 'scan',
          eventStatus: 'failed',
          runStatus: 'failed',
          message: error instanceof Error ? error.message : 'The scan failed.',
        });
        throw error;
      }
      return {
        content: [{
          type: 'text',
          text: [
            formatSummary(state.report),
            profile.runtime
              ? `\nRuntime routes:\n${JSON.stringify(result.runtime, null, 2)}`
              : '',
          ].join(''),
        }],
        isError: !result.runtime.passed,
      };
    },
  );

  server.tool(
    'scan_files',
    'Scan specific files for accessibility issues',
    {
      path: z.string().optional().describe('Project root path (defaults to cwd)'),
      files: z.array(z.string()).describe('Relative file paths to scan'),
    },
    writePlatform,
    async ({ path, files }) => {
      const root = path ?? state.root ?? process.cwd();
      state.root = root;
      state.harnessRunId = randomUUID();
      state.harnessProjectName = basename(resolve(root));
      state.harnessScanId = undefined;
      state.harnessSourceScanRef = undefined;
      await emitHarnessEvent(state, {
        stage: 'connect',
        eventStatus: 'completed',
        runStatus: 'running',
        message: 'MCP session connected and accepted the file scan request.',
      });
      await emitHarnessEvent(state, {
        stage: 'scan',
        eventStatus: 'running',
        runStatus: 'running',
        message: `Scanning ${files.length} selected file${files.length === 1 ? '' : 's'}.`,
        detail: {
          input: { projectName: state.harnessProjectName, root, files },
          action: 'Run deterministic accessibility rules against the selected files.',
        },
      });
      let report;
      try {
        report = await scanFiles(root, files, {
          targetLevel: state.policy.targetLevel,
          ignoreRules: state.policy.ignoreRules,
        });
      } catch (error) {
        await emitHarnessEvent(state, {
          stage: 'scan',
          eventStatus: 'failed',
          runStatus: 'failed',
          message: error instanceof Error ? error.message : 'The file scan failed.',
        });
        throw error;
      }
      state.report = report;
      state.harnessProjectName = report.projectName;
      state.harnessSourceScanRef = report.scanId;
      await emitHarnessEvent(state, {
        stage: 'scan',
        eventStatus: 'completed',
        runStatus: 'waiting',
        message: `Scan completed: ${report.summary.total} findings across ${report.target.files} files.`,
        detail: {
          action: 'Store the selected-file scan as the active baseline.',
          output: {
            scanRef: report.scanId,
            filesScanned: report.target.files,
            findings: report.summary.total,
            score: report.summary.score,
            severity: report.summary.bySeverity,
          },
        },
      });
      return { content: [{ type: 'text', text: formatSummary(report) }] };
    },
  );

  server.tool(
    'report_harness_progress',
    'Report generator or repair progress to the live Ally dashboard timeline',
    {
      stage: z.enum(['implement', 'repair']),
      status: z.enum(['running', 'waiting', 'completed', 'failed']),
      message: z.string().min(1).max(500),
      updates: z.array(z.object({
        path: z.string().min(1),
        summary: z.string().min(1).max(500),
        rules: z.array(z.string().min(1)).optional(),
      })).optional().describe('File-level changes completed or currently being implemented'),
      detail: z.record(z.unknown()).optional(),
    },
    writePlatform,
    async ({ stage, status, message, updates, detail }) => {
      const report = requireReport(state);
      ensureHarnessRun(state, report.projectName, report.scanId);
      await emitHarnessEvent(state, {
        stage,
        eventStatus: status,
        runStatus:
          status === 'failed'
            ? 'failed'
            : status === 'waiting'
              ? 'waiting'
              : 'running',
        message,
        detail: {
          input: {
            contractId: state.contract?.id ?? null,
            allowedFiles: state.contract
              ? [...new Set(state.contract.goals.map((goal) => goal.file))]
              : [],
          },
          action: message,
          output: {
            updates: updates ?? [],
            ...detail,
          },
        },
      });
      return {
        content: [{
          type: 'text',
          text: `Harness ${stage} status updated to ${status}.`,
        }],
      };
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
    readLocal,
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
    readLocal,
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
    readLocal,
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
    readLocal,
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
    writeSession,
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
    writeSession,
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
    writePlatform,
    async ({ projectName }) => {
      const report = requireReport(state);
      const apiKey = process.env['ALLY_API_KEY'];
      const baseUrl = process.env['ALLY_API_URL'] ?? 'https://ally-web-black.vercel.app';

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

      ensureHarnessRun(state, reportToSync.projectName, reportToSync.scanId);
      await emitHarnessEvent(state, {
        stage: 'publish_scan',
        eventStatus: 'running',
        runStatus: 'running',
        message: 'Uploading the scan and findings to the dashboard.',
      });
      const result = await pushReport(reportToSync, { apiKey, baseUrl });
      if (result.ok) {
        try {
          const payload = JSON.parse(result.body) as { scanId?: string };
          state.harnessScanId = payload.scanId;
        } catch {
          // Older dashboard versions may return only a scan URL.
        }
      }
      await emitHarnessEvent(state, {
        stage: 'publish_scan',
        eventStatus: result.ok ? 'completed' : 'failed',
        runStatus: result.ok ? 'waiting' : 'failed',
        message: result.ok
          ? 'Scan is available in the dashboard.'
          : `Dashboard sync failed with HTTP ${result.status}.`,
        detail: { httpStatus: result.status },
      });
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

  server.tool(
    'sync_evaluation',
    'Persist the active remediation contract and latest deterministic evaluation to the Ally dashboard',
    { projectName: z.string().optional().describe('Override project name') },
    writePlatform,
    async ({ projectName }) => {
      if (!state.contract || !state.evaluation || !state.report) {
        return {
          content: [{
            type: 'text',
            text: 'No completed evaluation is available. Run plan_remediation and evaluate_remediation first.',
          }],
          isError: true,
        };
      }

      const apiKey = process.env.ALLY_API_KEY;
      const baseUrl = process.env.ALLY_API_URL ?? 'https://ally-web-black.vercel.app';
      if (!apiKey || !baseUrl) {
        return {
          content: [{
            type: 'text',
            text: 'Missing ALLY_API_KEY or ALLY_API_URL environment variables. Set them to sync evaluations.',
          }],
        };
      }

      await emitHarnessEvent(state, {
        stage: 'publish_evaluation',
        eventStatus: 'running',
        runStatus: 'running',
        message: 'Uploading the contract and deterministic evaluation.',
      });
      const result = await pushEvaluation(
        projectName ?? state.report.projectName,
        state.contract,
        state.evaluation,
        { apiKey, baseUrl },
        state.harnessScanId,
      );
      await emitHarnessEvent(state, {
        stage: 'publish_evaluation',
        eventStatus: result.ok ? 'completed' : 'failed',
        runStatus:
          result.ok && state.evaluation.passed
            ? 'passed'
            : 'failed',
        message: result.ok
          ? 'Evaluation and sprint contract are available in the dashboard.'
          : `Evaluation sync failed with HTTP ${result.status}.`,
        detail: { httpStatus: result.status },
      });
      return {
        content: [{
          type: 'text',
          text: result.ok
            ? `Evaluation synced successfully (HTTP ${result.status}).`
            : `Evaluation sync failed (HTTP ${result.status}): ${result.body}`,
        }],
        isError: !result.ok,
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

  server.resource(
    'contract_latest',
    'ally://contract/latest',
    { description: 'The active remediation contract' },
    async () => ({
      contents: [{
        uri: 'ally://contract/latest',
        mimeType: 'application/json',
        text: JSON.stringify(state.contract ?? {}),
      }],
    }),
  );

  server.resource(
    'evaluation_latest',
    'ally://evaluation/latest',
    { description: 'The latest deterministic remediation evaluation' },
    async () => ({
      contents: [{
        uri: 'ally://evaluation/latest',
        mimeType: 'application/json',
        text: JSON.stringify(state.evaluation ?? {}),
      }],
    }),
  );

  return server;
}
