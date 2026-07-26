import type { ScanReport, WcagLevel } from '@ally/shared';
import type { SprintContract } from './harness.js';
import type { Evaluation } from './harness.js';
import type {
  EvaluationScan,
  TestScriptResult,
} from './evaluator.js';

export interface RemediationEvaluation extends Evaluation {
  attempt: number;
  passed: boolean;
  gates: {
    contractedFindingsResolved: boolean;
    noFindingRegressions: boolean;
    runtimePassed: boolean;
    testsPassed: boolean;
  };
  runtime: EvaluationScan['runtime'];
  tests: TestScriptResult[];
}

export interface SessionState {
  report?: ScanReport;
  contract?: SprintContract;
  evaluation?: RemediationEvaluation;
  evaluationAttempts: number;
  harnessRunId?: string;
  harnessProjectName?: string;
  harnessScanId?: string;
  harnessSourceScanRef?: string;
  root?: string;
  policy: {
    autofix: 'on' | 'off';
    targetLevel: WcagLevel;
    ignoreRules: string[];
  };
}

export function createState(): SessionState {
  return {
    evaluationAttempts: 0,
    root:
      process.env.ALLY_PROJECT_ROOT ??
      process.env.CLAUDE_PROJECT_DIR,
    policy: {
      autofix: 'off',
      targetLevel: 'AA',
      ignoreRules: [],
    },
  };
}
