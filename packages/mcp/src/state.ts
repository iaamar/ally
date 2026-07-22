import type { ScanReport, WcagLevel } from '@ally/shared';

export interface SessionState {
  report?: ScanReport;
  root?: string;
  policy: {
    autofix: 'on' | 'off';
    targetLevel: WcagLevel;
    ignoreRules: string[];
  };
}

export function createState(): SessionState {
  return {
    policy: {
      autofix: 'off',
      targetLevel: 'AA',
      ignoreRules: [],
    },
  };
}
