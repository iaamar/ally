export interface McpToolInfo {
  name: string;
  summary: string;
  access: 'Read' | 'Write';
  phase: 'Understand' | 'Scan' | 'Remediate' | 'Inspect';
  aliasFor?: string;
}

export const MCP_TOOLS: McpToolInfo[] = [
  {
    name: 'search_wcag',
    summary: 'Search WCAG knowledge with metadata-filtered hybrid retrieval and lexical fallback.',
    access: 'Read',
    phase: 'Understand',
  },
  {
    name: 'explain_finding',
    summary: 'Ground a finding in WCAG evidence and return context for a safe correction.',
    access: 'Read',
    phase: 'Understand',
  },
  {
    name: 'scan_accessibility',
    summary: 'Scan supplied HTML, JavaScript, TypeScript, JSX, and TSX source and sync the report.',
    access: 'Write',
    phase: 'Scan',
  },
  {
    name: 'plan_fixes',
    summary: 'Create a durable remediation contract with an exact file scope and acceptance checks.',
    access: 'Write',
    phase: 'Remediate',
  },
  {
    name: 'record_progress',
    summary: 'Publish implementation milestones to the live Ally trace for a remediation contract.',
    access: 'Write',
    phase: 'Remediate',
  },
  {
    name: 'verify_fixes',
    summary: 'Re-scan the contracted files and deterministically accept, reject, or escalate the attempt.',
    access: 'Write',
    phase: 'Remediate',
  },
  {
    name: 'list_scans',
    summary: 'List recent scans in the authenticated Ally organization.',
    access: 'Read',
    phase: 'Inspect',
  },
  {
    name: 'get_findings',
    summary: 'Read findings from an owned scan with optional severity filtering.',
    access: 'Read',
    phase: 'Inspect',
  },
  {
    name: 'get_ally_health',
    summary: 'Check MCP authentication, retrieval health, latency, and hosted capabilities.',
    access: 'Read',
    phase: 'Inspect',
  },
  {
    name: 'search_wcag_knowledge',
    summary: 'Backward-compatible alias for search_wcag.',
    access: 'Read',
    phase: 'Understand',
    aliasFor: 'search_wcag',
  },
  {
    name: 'scan_source_files',
    summary: 'Backward-compatible alias for scan_accessibility.',
    access: 'Write',
    phase: 'Scan',
    aliasFor: 'scan_accessibility',
  },
];

export const MCP_PHASES = ['Understand', 'Scan', 'Remediate', 'Inspect'] as const;
