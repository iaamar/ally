/**
 * Correlate static (Pass 1) findings with runtime (Pass 2) findings.
 * - Upgrade confidence of static findings confirmed by runtime
 * - Append runtime-only findings
 * - Recompute summary
 */

import type { Finding, ScanReport, ScanSummary, Severity, WcagLevel } from '@ally/shared';

/**
 * Match a runtime finding to a static finding by ruleId similarity and snippet overlap.
 */
function findStaticMatch(
  staticFindings: Finding[],
  runtime: Finding,
): Finding | undefined {
  // Direct fingerprint match
  const fpMatch = staticFindings.find((s) => s.fingerprint === runtime.fingerprint);
  if (fpMatch) return fpMatch;

  // Same base rule (e.g. static "img/missing-alt" ↔ runtime "axe/image-alt")
  // Try matching by wcag criterion overlap
  if (runtime.wcag.length > 0) {
    return staticFindings.find(
      (s) =>
        s.pass === 1 &&
        s.wcag.some((w) => runtime.wcag.includes(w)) &&
        s.status !== 'dismissed',
    );
  }
  return undefined;
}

function recomputeSummary(findings: Finding[], filesScanned: number): ScanSummary {
  const bySeverity: Record<Severity, number> = {
    blocker: 0,
    critical: 0,
    serious: 0,
    moderate: 0,
    minor: 0,
  };
  const byLevel: Record<WcagLevel, number> = { A: 0, AA: 0, AAA: 0 };
  const clusterMap = new Map<string, Set<string>>();

  for (const f of findings) {
    bySeverity[f.severity]++;
    byLevel[f.level]++;
    let set = clusterMap.get(f.clusterKey);
    if (!set) {
      set = new Set();
      clusterMap.set(f.clusterKey, set);
    }
    set.add(f.ruleId);
  }

  const clusters = Array.from(clusterMap.entries()).map(([clusterKey, ruleIds]) => ({
    clusterKey,
    count: ruleIds.size,
    ruleIds: Array.from(ruleIds),
  }));

  const W: Record<Severity, number> = { blocker: 10, critical: 7, serious: 4, moderate: 2, minor: 1 };
  const rawPenalty = findings.reduce((sum, f) => sum + W[f.severity], 0);
  const baseline = Math.max(filesScanned * 2, 10);
  const score = Math.max(0, Math.round(100 - (rawPenalty / baseline) * 100));

  return {
    total: findings.length,
    bySeverity,
    byLevel,
    clusters,
    score,
  };
}

/**
 * Merge runtime findings into a static scan report.
 * Idempotent: calling correlate twice with the same runtime findings
 * produces the same result (runtime findings already present are skipped).
 */
export function correlate(report: ScanReport, runtimeFindings: Finding[]): ScanReport {
  const findings = [...report.findings];
  const existingFps = new Set(findings.map((f) => f.fingerprint));

  for (const rf of runtimeFindings) {
    // Skip if already present (idempotency)
    if (existingFps.has(rf.fingerprint)) continue;

    const match = findStaticMatch(findings, rf);
    if (match) {
      // Upgrade confidence of the static finding
      match.confidence = 'certain';
      match.status = 'confirmed';
    } else {
      // Append as runtime-only finding
      findings.push(rf);
      existingFps.add(rf.fingerprint);
    }
  }

  const filesScanned = report.target.files;
  const summary = recomputeSummary(findings, filesScanned);

  return {
    ...report,
    findings,
    summary,
  };
}
