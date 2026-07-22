import type { TextEdit, AutoFix, FixClass, ScanReport } from '@ally/shared';

/**
 * Apply text edits to a source string. Edits are applied bottom-up (highest line/col first)
 * so earlier positions remain valid. Throws on overlapping edits.
 */
export function applyEdits(source: string, edits: TextEdit[]): string {
  if (edits.length === 0) return source;

  // Sort bottom-up: highest startLine first, then highest startCol first
  const sorted = [...edits].sort((a, b) => {
    if (a.startLine !== b.startLine) return b.startLine - a.startLine;
    return b.startCol - a.startCol;
  });

  // Check for overlaps
  for (let i = 0; i < sorted.length - 1; i++) {
    const upper = sorted[i];   // higher position (applied first)
    const lower = sorted[i + 1]; // lower position
    // upper starts at or after lower's end? OK. Otherwise overlap.
    if (
      upper.startLine < lower.endLine ||
      (upper.startLine === lower.endLine && upper.startCol < lower.endCol)
    ) {
      throw new Error(
        `Overlapping edits: [${lower.startLine}:${lower.startCol}-${lower.endLine}:${lower.endCol}] and [${upper.startLine}:${upper.startCol}-${upper.endLine}:${upper.endCol}]`,
      );
    }
  }

  const lines = source.split('\n');

  for (const edit of sorted) {
    const { startLine, startCol, endLine, endCol, replacement } = edit;
    // Convert 1-based line to 0-based index
    const sl = startLine - 1;
    const el = endLine - 1;

    const before = lines[sl].slice(0, startCol - 1);
    const after = lines[el].slice(endCol - 1);

    const replacementLines = (before + replacement + after).split('\n');

    lines.splice(sl, el - sl + 1, ...replacementLines);
  }

  return lines.join('\n');
}

/**
 * Collect all auto-fixes from a scan report, filtered by fixClass and optional fingerprints.
 */
export function collectFixes(
  report: ScanReport,
  opts: { classes: FixClass[]; fingerprints?: string[] },
): AutoFix[] {
  const fixes: AutoFix[] = [];
  for (const finding of report.findings) {
    if (!finding.fix) continue;
    if (!opts.classes.includes(finding.fixClass)) continue;
    if (opts.fingerprints && !opts.fingerprints.includes(finding.fingerprint)) continue;
    fixes.push(finding.fix);
  }
  return fixes;
}
