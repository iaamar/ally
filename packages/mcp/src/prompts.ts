import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerPrompts(server: McpServer): void {
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
