import type { Finding, WcagLevel, ScanSummary, Severity } from '@ally/shared';
import { SEVERITY_WEIGHT, CONFIDENCE_WEIGHT, LEVEL_ORDER } from '@ally/shared';

/**
 * Prioritize findings by computing a priority score for each.
 *
 * Per-finding priority = SEVERITY_WEIGHT[severity] * CONFIDENCE_WEIGHT[confidence]
 *   * clusterCount * (requiredForTarget ? 1 : 0.3)
 *
 * Returns a NEW array sorted by priority desc, with stable tie-break
 * by ruleId then location.file then startLine.
 */
export function prioritize(findings: Finding[], targetLevel: WcagLevel): Finding[] {
  // Count cluster sizes
  const clusterCounts = new Map<string, number>();
  for (const f of findings) {
    clusterCounts.set(f.clusterKey, (clusterCounts.get(f.clusterKey) ?? 0) + 1);
  }

  // Compute priority for each finding (shallow copy to avoid mutation)
  const scored = findings.map((f) => {
    const requiredForTarget = LEVEL_ORDER[f.level] <= LEVEL_ORDER[targetLevel];
    const priority =
      SEVERITY_WEIGHT[f.severity] *
      CONFIDENCE_WEIGHT[f.confidence] *
      clusterCounts.get(f.clusterKey)! *
      (requiredForTarget ? 1 : 0.3);
    return { ...f, priority };
  });

  // Sort by priority desc, stable tie-break by ruleId, file, startLine
  scored.sort((a, b) => {
    if (b.priority! !== a.priority!) return b.priority! - a.priority!;
    const ruleCompare = a.ruleId.localeCompare(b.ruleId);
    if (ruleCompare !== 0) return ruleCompare;
    const fileCompare = a.location.file.localeCompare(b.location.file);
    if (fileCompare !== 0) return fileCompare;
    return a.location.startLine - b.location.startLine;
  });

  return scored;
}

/**
 * Summarize findings into a ScanSummary.
 *
 * Counts exclude findings with status === 'dismissed'.
 * Score = round(100 / (1 + weighted / max(1, filesScanned)))
 * where weighted = sum of SEVERITY_WEIGHT over non-dismissed findings.
 */
export function summarize(findings: Finding[], filesScanned: number): ScanSummary {
  const bySeverity: Record<Severity, number> = { blocker: 0, critical: 0, serious: 0, moderate: 0, minor: 0 };
  const byLevel: Record<WcagLevel, number> = { A: 0, AA: 0, AAA: 0 };
  const clusterMap = new Map<string, { count: number; ruleIds: Set<string> }>();
  let total = 0;
  let weighted = 0;

  for (const f of findings) {
    if (f.status === 'dismissed') continue;

    total++;
    bySeverity[f.severity]++;
    byLevel[f.level]++;
    weighted += SEVERITY_WEIGHT[f.severity];

    const existing = clusterMap.get(f.clusterKey);
    if (existing) {
      existing.count++;
      existing.ruleIds.add(f.ruleId);
    } else {
      clusterMap.set(f.clusterKey, { count: 1, ruleIds: new Set([f.ruleId]) });
    }
  }

  const clusters = Array.from(clusterMap.entries())
    .map(([clusterKey, { count, ruleIds }]) => ({
      clusterKey,
      count,
      ruleIds: Array.from(ruleIds),
    }))
    .sort((a, b) => b.count - a.count);

  const score = Math.round(100 / (1 + weighted / Math.max(1, filesScanned)));

  return { total, bySeverity, byLevel, clusters, score };
}
