import { randomUUID } from 'node:crypto';
import type { Finding, FixClass, ScanReport, Severity } from '@ally/shared';
import type { EvaluationProfile, TestScriptResult } from './evaluator.js';

export interface SprintGoal {
  fingerprint: string;
  ruleId: string;
  severity: Severity;
  fixClass: FixClass;
  file: string;
  line: number;
  acceptance: string;
}

export interface SprintContract {
  id: string;
  createdAt: string;
  root: string;
  baselineScanId: string;
  baselineScore: number;
  baselineFindingCount: number;
  baselineFingerprints: string[];
  maxNewFindings: number;
  goals: SprintGoal[];
  evaluationProfile: EvaluationProfile;
  baselineTests: TestScriptResult[];
}

export interface ContractOptions {
  severities?: Severity[];
  fixClasses?: FixClass[];
  limit?: number;
  maxNewFindings?: number;
}

export interface Evaluation {
  contractId: string;
  passed: boolean;
  score: {
    before: number;
    after: number;
    delta: number;
  };
  findings: {
    before: number;
    after: number;
    delta: number;
  };
  resolvedGoals: SprintGoal[];
  unresolvedGoals: SprintGoal[];
  newFindings: Finding[];
  reasons: string[];
}

export function createSprintContract(
  report: ScanReport,
  options: ContractOptions = {},
  evaluationProfile: EvaluationProfile = {
    runtime: false,
    routes: ['/'],
    runtimeTimeoutMs: 30_000,
    testScripts: [],
    testTimeoutMs: 120_000,
  },
  baselineTests: TestScriptResult[] = [],
): SprintContract {
  const severitySet = options.severities ? new Set(options.severities) : null;
  const fixClassSet = options.fixClasses ? new Set(options.fixClasses) : null;
  const limit = Math.max(1, Math.min(options.limit ?? 10, 50));

  const candidates = report.findings
    .filter((finding) => (finding.status ?? 'open') !== 'dismissed')
    .filter((finding) => !severitySet || severitySet.has(finding.severity))
    .filter((finding) => !fixClassSet || fixClassSet.has(finding.fixClass))
    .slice(0, limit);

  return {
    id: `contract_${randomUUID()}`,
    createdAt: new Date().toISOString(),
    root: report.target.root,
    baselineScanId: report.scanId,
    baselineScore: report.summary.score,
    baselineFindingCount: report.summary.total,
    baselineFingerprints: report.findings.map((finding) => finding.fingerprint),
    maxNewFindings: Math.max(0, options.maxNewFindings ?? 0),
    evaluationProfile,
    baselineTests,
    goals: candidates.map((finding) => ({
      fingerprint: finding.fingerprint,
      ruleId: finding.ruleId,
      severity: finding.severity,
      fixClass: finding.fixClass,
      file: finding.location.file,
      line: finding.location.startLine,
      acceptance: `Finding ${finding.fingerprint} no longer appears after a fresh scan, with no unapproved regressions.`,
    })),
  };
}

export function evaluateSprintContract(
  contract: SprintContract,
  current: ScanReport,
): Evaluation {
  const currentFingerprints = new Set(current.findings.map((finding) => finding.fingerprint));
  const baselineFingerprints = new Set(contract.baselineFingerprints);
  const unresolvedGoals = contract.goals.filter((goal) => currentFingerprints.has(goal.fingerprint));
  const resolvedGoals = contract.goals.filter((goal) => !currentFingerprints.has(goal.fingerprint));
  const newFindings = current.findings.filter(
    (finding) => !baselineFingerprints.has(finding.fingerprint),
  );

  const reasons: string[] = [];
  if (unresolvedGoals.length > 0) {
    reasons.push(`${unresolvedGoals.length} contracted finding(s) remain.`);
  }
  if (newFindings.length > contract.maxNewFindings) {
    reasons.push(
      `${newFindings.length} new finding(s) exceed the allowed maximum of ${contract.maxNewFindings}.`,
    );
  }
  if (current.summary.total > contract.baselineFindingCount) {
    reasons.push('The total finding count increased.');
  }

  return {
    contractId: contract.id,
    passed: reasons.length === 0,
    score: {
      before: contract.baselineScore,
      after: current.summary.score,
      delta: current.summary.score - contract.baselineScore,
    },
    findings: {
      before: contract.baselineFindingCount,
      after: current.summary.total,
      delta: current.summary.total - contract.baselineFindingCount,
    },
    resolvedGoals,
    unresolvedGoals,
    newFindings,
    reasons,
  };
}
