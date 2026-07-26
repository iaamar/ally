import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerPrompts(server: McpServer): void {
  server.prompt(
    'remediation_harness',
    'Plan, build, evaluate, and repair accessibility changes using a sprint contract',
    () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              'Run Ally as a remediation harness:',
              '',
              '1. Scan the project with `scan_project`.',
              '2. Call `sync_report` so the baseline and live run are linked in the dashboard.',
              '3. Create a bounded contract with `plan_remediation`.',
              '4. For unfamiliar criteria, ground the implementation with `search_wcag_knowledge`.',
              '5. Call `report_harness_progress` with implement/running, implement only the contracted goals, run relevant project tests, then report implement/completed.',
              '6. Call `evaluate_remediation` to re-scan and check the contract.',
              '7. If rejected, report repair/running, use its unresolved goals and new-findings report to repair the implementation, report repair/completed, then evaluate again.',
              '8. When the evaluator passes, call `sync_evaluation` and finish.',
            ].join('\n'),
          },
        },
      ],
    }),
  );

  server.prompt(
    'a11y_review_workflow',
    'Guided accessibility scan, review, fix, and sync workflow',
    () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              'Follow this accessibility review workflow:',
              '',
              '1. Run `scan_project` on the current project to get a full scan report.',
              '2. Review the findings — use `get_findings` to filter by severity, starting with blockers.',
              '3. For each finding needing review, use `explain_finding` to understand the issue.',
              '4. Use `get_reasoning_packets` to see pending reasoning packets and resolve them with `resolve_reasoning`.',
              '5. Use `get_fixes` to collect safe auto-fixes and apply them.',
              '6. After fixes, re-scan to confirm improvements.',
              '7. Use `sync_report` to push the final report to the Ally dashboard.',
            ].join('\n'),
          },
        },
      ],
    }),
  );

  server.prompt(
    'fix_no_brainers',
    'Scan, apply safe auto-fixes, rescan, and report the delta',
    () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              'Fix all no-brainer accessibility issues:',
              '',
              '1. Run `scan_project` to get a baseline report. Note the score and finding count.',
              '2. Use `get_fixes` with class SAFE_AUTOFIX to collect all safe fixes.',
              '3. Apply each fix to the codebase.',
              '4. Re-scan with `scan_project` to get updated results.',
              '5. Report the delta: how many findings were fixed, score improvement.',
            ].join('\n'),
          },
        },
      ],
    }),
  );
}
