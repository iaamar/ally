import { createHash } from 'node:crypto';
import type {
  AttemptRecord,
  ContractKnowledge,
  ContractTarget,
  EvaluationCheck,
  EvaluationResult,
  Finding,
  RemediationContract,
  ScanReport,
  Severity,
  WcagLevel,
} from '@ally/shared';
import { matchKeyOf } from './fingerprint.js';
import { scanSources, type SourceFileInput } from './runner.js';

export function hashSource(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function findingMatchKey(finding: Finding): string {
  return finding.matchKey ??
    matchKeyOf(finding.ruleId, finding.location.file, finding.clusterKey);
}

function sourceMap(sources: SourceFileInput[]): Map<string, string> {
  return new Map(sources.map((source) => [source.path, source.content]));
}

function progressSignature(findings: Finding[], fileSet: string[]): string {
  const inScope = new Set(fileSet);
  const counts = new Map<string, number>();
  for (const finding of findings) {
    if (!inScope.has(finding.location.file)) continue;
    const key = findingMatchKey(finding);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return createHash('sha256')
    .update(JSON.stringify([...counts.entries()].sort(([a], [b]) => a.localeCompare(b))))
    .digest('hex')
    .slice(0, 16);
}

export interface HostedPlanOptions {
  fingerprints?: string[];
  clusterKey?: string;
  ruleId?: string;
  maxFindings?: number;
}

export function planHostedContract(input: {
  report: ScanReport;
  sources: SourceFileInput[];
  options?: HostedPlanOptions;
  knowledge?: ContractKnowledge[];
  now?: () => number;
}): RemediationContract {
  const options = input.options ?? {};
  const maxFindings = Math.max(1, Math.min(options.maxFindings ?? 10, 50));
  let findings = input.report.findings;
  if (options.fingerprints?.length) {
    const fingerprints = new Set(options.fingerprints);
    findings = findings.filter((finding) => fingerprints.has(finding.fingerprint));
  } else if (options.clusterKey) {
    findings = findings.filter((finding) => finding.clusterKey === options.clusterKey);
  } else if (options.ruleId) {
    findings = findings.filter((finding) => finding.ruleId === options.ruleId);
  }
  findings = findings.slice(0, maxFindings);
  if (findings.length === 0) throw new Error('No findings match the given filters.');

  const contents = sourceMap(input.sources);
  const fileSet = [...new Set(input.sources.map((source) => source.path))];
  const allowedFiles = [...new Set(findings.map((finding) => finding.location.file))];
  const fileHashes = Object.fromEntries(
    fileSet.map((path) => [path, hashSource(contents.get(path) ?? '')]),
  );
  const countsByMatchKey: Record<string, number> = {};
  const severityCounts: Record<string, number> = {};
  for (const finding of input.report.findings) {
    const key = findingMatchKey(finding);
    countsByMatchKey[key] = (countsByMatchKey[key] ?? 0) + 1;
    severityCounts[finding.severity] = (severityCounts[finding.severity] ?? 0) + 1;
  }

  const targets: ContractTarget[] = findings.map((finding) => ({
    matchKey: findingMatchKey(finding),
    fingerprint: finding.fingerprint,
    ordinal: finding.ordinal ?? 0,
    ruleId: finding.ruleId,
    wcag: finding.wcag,
    level: finding.level,
    severity: finding.severity,
    file: finding.location.file,
    anchor: finding.location,
    fixClass: finding.fixClass,
  }));
  const knowledge = (input.knowledge ?? []).slice(0, 6);
  const now = input.now ?? Date.now;
  const timestamp = now();
  const contractId = `rc_${createHash('sha256')
    .update(`${input.report.scanId}|${targets.map((target) => target.fingerprint).join(',')}|${timestamp}`)
    .digest('hex')
    .slice(0, 12)}`;

  return {
    contractId,
    createdAt: new Date(timestamp).toISOString(),
    baseline: {
      scanId: input.report.scanId,
      fileSet,
      score: input.report.summary.score,
      total: input.report.summary.total,
      countsByMatchKey,
      severityCounts,
      fileHashes,
    },
    scope: { allowedFiles, maxAttempts: 3 },
    targets,
    acceptance: {
      targetsResolved: 'all',
      maxNewFindingsBySeverity: {
        blocker: 0,
        critical: 0,
        serious: 0,
        moderate: 0,
        minor: 2,
      },
      minimumScoreDelta: 0,
      requireParse: true,
    },
    knowledge,
    guidance: knowledge
      .slice(0, 3)
      .map((item) => `${item.criterion} (${item.level}): ${item.excerpt.slice(0, 180)}`)
      .join('\n'),
  };
}

function terminalAttempt(
  contract: RemediationContract,
  attempts: AttemptRecord[],
  verdict: AttemptRecord['verdict'],
  reason: string,
  nextAction: EvaluationResult['nextAction'],
  feedback: string,
  checks: EvaluationCheck[],
  changedFiles: string[],
): { result: EvaluationResult; attempt: AttemptRecord; afterReport: ScanReport | null } {
  const n = attempts.length + 1;
  return {
    result: {
      contractId: contract.contractId,
      attempt: n,
      verdict,
      reason,
      nextAction,
      attemptsRemaining: Math.max(0, contract.scope.maxAttempts - n),
      checks,
      feedback,
    },
    attempt: {
      n,
      verdict,
      progressSignature: '',
      feedback,
      changedFiles,
    },
    afterReport: null,
  };
}

export async function evaluateHostedContract(input: {
  contract: RemediationContract;
  attempts: AttemptRecord[];
  sources: SourceFileInput[];
  policy?: { targetLevel?: WcagLevel; ignoreRules?: string[] };
  signal?: AbortSignal;
}): Promise<{
  result: EvaluationResult;
  attempt: AttemptRecord;
  afterReport: ScanReport | null;
}> {
  const { contract, attempts, sources } = input;
  const expected = new Set(contract.baseline.fileSet);
  const supplied = new Set(sources.map((source) => source.path));
  const missing = contract.baseline.fileSet.filter((path) => !supplied.has(path));
  const extra = [...supplied].filter((path) => !expected.has(path));
  if (missing.length || extra.length) {
    const feedback = [
      missing.length ? `Missing contract files: ${missing.join(', ')}.` : '',
      extra.length ? `Files outside the contract: ${extra.join(', ')}.` : '',
      `Supply exactly: ${contract.baseline.fileSet.join(', ')}.`,
    ].filter(Boolean).join(' ');
    return terminalAttempt(
      contract,
      attempts,
      'scope_violation',
      'file_set_mismatch',
      'escalate',
      feedback,
      [{ id: 'scope', pass: false, detail: { missing, extra } }],
      [],
    );
  }

  const contents = sourceMap(sources);
  const changedFiles = contract.baseline.fileSet.filter(
    (path) => hashSource(contents.get(path) ?? '') !== contract.baseline.fileHashes[path],
  );
  if (changedFiles.length === 0) {
    return terminalAttempt(
      contract,
      attempts,
      'stalled',
      'no_edit',
      'repair',
      'No files were changed. Edit the target files before asking for evaluation.',
      [{ id: 'no_edit', pass: false, detail: {} }],
      [],
    );
  }
  const allowed = new Set(contract.scope.allowedFiles);
  const outsideScope = changedFiles.filter((path) => !allowed.has(path));
  if (outsideScope.length) {
    return terminalAttempt(
      contract,
      attempts,
      'scope_violation',
      'scope_violation',
      'escalate',
      `Changed files outside the contract scope: ${outsideScope.join(', ')}.`,
      [{ id: 'scope', pass: false, detail: { outsideScope } }],
      changedFiles,
    );
  }

  const afterReport = await scanSources(
    'hosted-evaluation',
    sources,
    input.policy,
    input.signal,
  );
  const checks: EvaluationCheck[] = [{ id: 'parse', pass: true, detail: {} }];
  const afterCounts: Record<string, number> = {};
  for (const finding of afterReport.findings) {
    const key = findingMatchKey(finding);
    afterCounts[key] = (afterCounts[key] ?? 0) + 1;
  }
  const targetCounts = new Map<string, number>();
  for (const target of contract.targets) {
    targetCounts.set(target.matchKey, (targetCounts.get(target.matchKey) ?? 0) + 1);
  }
  const unresolved = [...targetCounts.entries()].flatMap(([key, targetCount]) => {
    const before = contract.baseline.countsByMatchKey[key] ?? 0;
    const after = afterCounts[key] ?? 0;
    return after > before - targetCount
      ? [{ matchKey: key, before, after }]
      : [];
  });
  checks.push({
    id: 'targets_resolved',
    pass: unresolved.length === 0,
    detail: unresolved.length ? { unresolved } : { resolved: 'all' },
  });

  const baselineKeys = new Set(Object.keys(contract.baseline.countsByMatchKey));
  const newBySeverity: Partial<Record<Severity, number>> = {};
  for (const finding of afterReport.findings) {
    if (baselineKeys.has(findingMatchKey(finding))) continue;
    newBySeverity[finding.severity] = (newBySeverity[finding.severity] ?? 0) + 1;
  }
  const regression = Object.entries(newBySeverity).some(
    ([severity, count]) =>
      (count ?? 0) >
      contract.acceptance.maxNewFindingsBySeverity[severity as Severity],
  );
  checks.push({
    id: 'no_regressions',
    pass: !regression,
    detail: { newBySeverity },
  });
  const scoreDelta = afterReport.summary.score - contract.baseline.score;
  checks.push({
    id: 'score_delta',
    pass: scoreDelta >= contract.acceptance.minimumScoreDelta,
    detail: { before: contract.baseline.score, after: afterReport.summary.score, delta: scoreDelta },
  });

  const signature = progressSignature(afterReport.findings, contract.baseline.fileSet);
  const noProgress = attempts.at(-1)?.progressSignature === signature;
  if (noProgress) checks.push({ id: 'no_progress', pass: false, detail: { signature } });

  const attemptNumber = attempts.length + 1;
  const targetsResolved = unresolved.length === 0;
  let verdict: AttemptRecord['verdict'] = 'fail';
  let reason = 'target_not_resolved';
  let nextAction: EvaluationResult['nextAction'] = 'repair';
  if (regression || scoreDelta < contract.acceptance.minimumScoreDelta) {
    verdict = 'regression';
    reason = 'regression';
    nextAction = 'escalate';
  } else if (noProgress) {
    verdict = 'escalated';
    reason = 'no_progress';
    nextAction = 'escalate';
  } else if (targetsResolved) {
    verdict = 'pass';
    reason = 'all_targets_resolved';
    nextAction = 'settled';
  } else if (attemptNumber >= contract.scope.maxAttempts) {
    verdict = 'escalated';
    reason = 'max_attempts';
    nextAction = 'escalate';
  }
  const feedback = targetsResolved
    ? 'All contracted findings are resolved with no unapproved regressions.'
    : `Contracted findings remain for ${unresolved.map((item) => item.matchKey).join(', ')}.`;
  const attempt: AttemptRecord = {
    n: attemptNumber,
    verdict,
    progressSignature: signature,
    feedback,
    changedFiles,
  };
  return {
    result: {
      contractId: contract.contractId,
      attempt: attemptNumber,
      verdict,
      reason,
      nextAction,
      attemptsRemaining: Math.max(0, contract.scope.maxAttempts - attemptNumber),
      checks,
      feedback,
      score: { before: contract.baseline.score, after: afterReport.summary.score, delta: scoreDelta },
    },
    attempt,
    afterReport,
  };
}
