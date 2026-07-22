import { describe, it, expect } from 'vitest';
import { prioritize, summarize } from '../src/prioritize.js';
import type { Finding, WcagLevel, Severity, Confidence } from '@ally/shared';

function makeFinding(overrides: Partial<Finding> & { ruleId: string; severity: Severity; confidence: Confidence; level: WcagLevel; clusterKey: string }): Finding {
  return {
    fingerprint: overrides.ruleId + '-fp',
    wcag: ['1.1.1'],
    impact: ['screen_reader'],
    message: 'test',
    location: { file: 'a.tsx', startLine: 1, startCol: 1, endLine: 1, endCol: 10 },
    snippet: '<img>',
    fixClass: 'SUGGEST',
    pass: 1,
    status: 'open',
    ...overrides,
  };
}

describe('prioritize', () => {
  const findings: Finding[] = [
    makeFinding({ ruleId: 'rule-critical', severity: 'critical', confidence: 'certain', level: 'A', clusterKey: 'f#A' }),
    makeFinding({ ruleId: 'rule-serious', severity: 'serious', confidence: 'certain', level: 'AA', clusterKey: 'f#B', location: { file: 'a.tsx', startLine: 1, startCol: 1, endLine: 1, endCol: 10 } }),
    makeFinding({ ruleId: 'rule-serious', severity: 'serious', confidence: 'certain', level: 'AA', clusterKey: 'f#B', location: { file: 'a.tsx', startLine: 5, startCol: 1, endLine: 5, endCol: 10 } }),
    makeFinding({ ruleId: 'rule-serious', severity: 'serious', confidence: 'certain', level: 'AA', clusterKey: 'f#B', location: { file: 'a.tsx', startLine: 10, startCol: 1, endLine: 10, endCol: 10 } }),
    makeFinding({ ruleId: 'rule-minor', severity: 'minor', confidence: 'certain', level: 'A', clusterKey: 'f#C' }),
    makeFinding({ ruleId: 'rule-aaa', severity: 'moderate', confidence: 'needs_review', level: 'AAA', clusterKey: 'f#D' }),
  ];

  it('returns findings sorted by priority desc', () => {
    const result = prioritize(findings, 'AA');
    expect(result[0].ruleId).toBe('rule-serious');
    expect(result[3].ruleId).toBe('rule-critical');
    expect(result[4].ruleId).toBe('rule-minor');
    expect(result[5].ruleId).toBe('rule-aaa');
  });

  it('sets correct priority values', () => {
    const result = prioritize(findings, 'AA');
    expect(result[0].priority).toBe(9);
    expect(result[1].priority).toBe(9);
    expect(result[2].priority).toBe(9);
    expect(result[3].priority).toBe(5);
    expect(result[4].priority).toBe(0.5);
    expect(result[5].priority).toBe(0.15);
  });

  it('stable tie-break by ruleId then location.file then startLine', () => {
    const result = prioritize(findings, 'AA');
    expect(result[0].location.startLine).toBe(1);
    expect(result[1].location.startLine).toBe(5);
    expect(result[2].location.startLine).toBe(10);
  });

  it('returns a new array without mutating input', () => {
    const copy = [...findings];
    const result = prioritize(findings, 'AA');
    expect(result).not.toBe(findings);
    expect(findings).toEqual(copy);
  });
});

describe('summarize', () => {
  it('computes correct score and excludes dismissed', () => {
    const findings: Finding[] = [
      makeFinding({ ruleId: 'r1', severity: 'critical', confidence: 'certain', level: 'A', clusterKey: 'f#A', status: 'open' }),
      makeFinding({ ruleId: 'r2', severity: 'serious', confidence: 'certain', level: 'AA', clusterKey: 'f#B', status: 'open' }),
      makeFinding({ ruleId: 'r2', severity: 'serious', confidence: 'certain', level: 'AA', clusterKey: 'f#B', status: 'open' }),
      makeFinding({ ruleId: 'r2', severity: 'serious', confidence: 'certain', level: 'AA', clusterKey: 'f#B', status: 'open' }),
      makeFinding({ ruleId: 'r3', severity: 'minor', confidence: 'certain', level: 'A', clusterKey: 'f#C', status: 'open' }),
      makeFinding({ ruleId: 'r4', severity: 'moderate', confidence: 'needs_review', level: 'AAA', clusterKey: 'f#D', status: 'open' }),
      makeFinding({ ruleId: 'r5', severity: 'blocker', confidence: 'certain', level: 'A', clusterKey: 'f#E', status: 'dismissed' }),
    ];

    const summary = summarize(findings, 10);

    // weighted = 5 + 3 + 3 + 3 + 0.5 + 1 = 15.5
    // score = round(100 / (1 + 15.5/10)) = round(100 / 2.55) = round(39.2157) = 39
    expect(summary.score).toBe(39);
    expect(summary.total).toBe(6);
    expect(summary.bySeverity.blocker).toBe(0);
    expect(summary.bySeverity.critical).toBe(1);
    expect(summary.bySeverity.serious).toBe(3);
    expect(summary.bySeverity.moderate).toBe(1);
    expect(summary.bySeverity.minor).toBe(1);
  });

  it('initializes all severity and level keys to 0', () => {
    const summary = summarize([], 5);
    expect(summary.bySeverity).toEqual({ blocker: 0, critical: 0, serious: 0, moderate: 0, minor: 0 });
    expect(summary.byLevel).toEqual({ A: 0, AA: 0, AAA: 0 });
    expect(summary.total).toBe(0);
    expect(summary.score).toBe(100);
    expect(summary.clusters).toEqual([]);
  });

  it('clusters sorted by count desc', () => {
    const findings: Finding[] = [
      makeFinding({ ruleId: 'r1', severity: 'minor', confidence: 'certain', level: 'A', clusterKey: 'small', status: 'open' }),
      makeFinding({ ruleId: 'r2', severity: 'minor', confidence: 'certain', level: 'A', clusterKey: 'big', status: 'open' }),
      makeFinding({ ruleId: 'r2', severity: 'minor', confidence: 'certain', level: 'A', clusterKey: 'big', status: 'open' }),
      makeFinding({ ruleId: 'r3', severity: 'minor', confidence: 'certain', level: 'A', clusterKey: 'big', status: 'open' }),
    ];
    const summary = summarize(findings, 1);
    expect(summary.clusters[0].clusterKey).toBe('big');
    expect(summary.clusters[0].count).toBe(3);
    expect(summary.clusters[1].clusterKey).toBe('small');
    expect(summary.clusters[1].count).toBe(1);
  });
});
