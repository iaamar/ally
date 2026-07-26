import type { FixClass, Severity, SourceLocation, WcagLevel } from './types.js';

export interface ContractTarget {
  matchKey: string;
  fingerprint: string;
  ordinal: number;
  ruleId: string;
  wcag: string[];
  level: WcagLevel;
  severity: Severity;
  file: string;
  anchor: SourceLocation;
  fixClass: FixClass;
}

export interface ContractBaseline {
  scanId: string;
  fileSet: string[];
  score: number;
  total: number;
  countsByMatchKey: Record<string, number>;
  severityCounts: Record<string, number>;
  fileHashes: Record<string, string>;
}

export interface ContractKnowledge {
  criterion: string;
  level: string;
  title: string;
  excerpt: string;
}

export interface RemediationContract {
  contractId: string;
  createdAt: string;
  baseline: ContractBaseline;
  scope: {
    allowedFiles: string[];
    maxAttempts: number;
  };
  targets: ContractTarget[];
  acceptance: {
    targetsResolved: 'all';
    maxNewFindingsBySeverity: Record<Severity, number>;
    minimumScoreDelta: number;
    requireParse: boolean;
  };
  knowledge: ContractKnowledge[];
  guidance: string;
}

export type AttemptVerdict =
  | 'pass'
  | 'fail'
  | 'stalled'
  | 'scope_violation'
  | 'regression'
  | 'escalated';

export interface AttemptRecord {
  n: number;
  progressSignature: string;
  feedback: string;
  changedFiles: string[];
  verdict: AttemptVerdict;
}

export interface EvaluationCheck {
  id: string;
  pass: boolean;
  detail: Record<string, unknown>;
}

export interface EvaluationResult {
  contractId: string;
  attempt: number;
  verdict: AttemptVerdict;
  reason: string;
  nextAction: 'settled' | 'repair' | 'escalate';
  attemptsRemaining: number;
  checks: EvaluationCheck[];
  feedback: string;
  score?: { before: number; after: number; delta: number };
}
