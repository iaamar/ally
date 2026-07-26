import { describe, expect, it } from 'vitest';
import type { Finding, ScanReport } from '@ally/shared';
import { createSprintContract, evaluateSprintContract } from '../src/harness.js';

function finding(fingerprint: string, ruleId = 'img-missing-alt'): Finding {
  return {
    fingerprint,
    ruleId,
    wcag: ['1.1.1'],
    level: 'A',
    severity: 'critical',
    confidence: 'certain',
    impact: ['screen_reader'],
    message: 'Image needs a text alternative',
    location: { file: 'App.tsx', startLine: 3, startCol: 1, endLine: 3, endCol: 10 },
    snippet: '<img />',
    clusterKey: ruleId,
    fixClass: 'SUGGEST',
    pass: 1,
  };
}

function report(findings: Finding[], score = 80): ScanReport {
  return {
    scanId: 'scan-1',
    createdAt: '2026-07-24T00:00:00.000Z',
    projectName: 'fixture',
    target: { root: '/fixture', files: 1 },
    toolVersion: '0.1.0',
    findings,
    packets: [],
    summary: {
      total: findings.length,
      bySeverity: {
        blocker: 0,
        critical: findings.length,
        serious: 0,
        moderate: 0,
        minor: 0,
      },
      byLevel: { A: findings.length, AA: 0, AAA: 0 },
      clusters: [],
      score,
    },
  };
}

describe('remediation harness', () => {
  it('passes when goals resolve without regressions', () => {
    const contract = createSprintContract(report([finding('old')]));
    const evaluation = evaluateSprintContract(contract, report([], 100));
    expect(evaluation.passed).toBe(true);
    expect(evaluation.resolvedGoals).toHaveLength(1);
    expect(evaluation.newFindings).toHaveLength(0);
  });

  it('rejects a replacement regression even when the old fingerprint disappears', () => {
    const contract = createSprintContract(report([finding('old')]));
    const evaluation = evaluateSprintContract(
      contract,
      report([finding('new', 'button-missing-name')]),
    );
    expect(evaluation.passed).toBe(false);
    expect(evaluation.newFindings).toHaveLength(1);
    expect(evaluation.reasons.join(' ')).toContain('new finding');
  });
});
