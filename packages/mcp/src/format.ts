import type { Finding, ScanReport } from '@ally/shared';
import { WCAG_SC } from '@ally/shared';

export function formatSummary(report: ScanReport): string {
  const { summary, packets, findings } = report;
  const safeFixes = findings.filter((f) => f.fixClass === 'SAFE_AUTOFIX' && f.fix).length;

  const lines: string[] = [
    `# Scan Report: ${report.projectName}`,
    '',
    `**Score:** ${summary.score}/100 | **Files:** ${report.target.files} | **Findings:** ${summary.total}`,
    '',
    '## Severity Breakdown',
    '',
    '| Severity | Count |',
    '|----------|-------|',
  ];

  for (const sev of ['blocker', 'critical', 'serious', 'moderate', 'minor'] as const) {
    const count = summary.bySeverity[sev] ?? 0;
    if (count > 0) lines.push(`| ${sev} | ${count} |`);
  }

  lines.push('', '## Top Clusters', '');
  for (const cluster of summary.clusters.slice(0, 5)) {
    lines.push(`- **${cluster.clusterKey}** (${cluster.count} findings) — rules: ${cluster.ruleIds.join(', ')}`);
  }

  lines.push('', '## Top Findings', '');
  for (const f of findings.slice(0, 10)) {
    lines.push(`- \`${f.ruleId}\` [${f.severity}] ${f.message} — ${f.location.file}:${f.location.startLine}`);
  }

  lines.push(
    '',
    `**Reasoning packets pending:** ${packets.length}`,
    `**Safe auto-fixes available:** ${safeFixes}`,
  );

  return lines.join('\n');
}

export function formatFinding(f: Finding): string {
  const wcagLinks = f.wcag
    .map((sc) => {
      const info = WCAG_SC[sc];
      return info ? `[${sc} ${info.name}](${info.url})` : sc;
    })
    .join(', ');

  const lines: string[] = [
    `# ${f.ruleId}: ${f.message}`,
    '',
    `**Severity:** ${f.severity} | **Confidence:** ${f.confidence} | **Level:** ${f.level}`,
    `**WCAG:** ${wcagLinks}`,
    `**Impact:** ${f.impact.join(', ')}`,
    `**Status:** ${f.status ?? 'open'} | **Fix class:** ${f.fixClass}`,
    '',
    '## Location',
    '',
    `\`${f.location.file}:${f.location.startLine}:${f.location.startCol}\``,
    '',
    '## Snippet',
    '',
    '```',
    f.snippet,
    '```',
  ];

  if (f.suggestedFixText) {
    lines.push('', '## Suggested Fix', '', f.suggestedFixText);
  }

  return lines.join('\n');
}
