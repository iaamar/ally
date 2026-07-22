import { describe, it, expect } from 'vitest';
import type { Finding, ScanReport } from '@ally/shared';
import { correlate } from '../src/runtime/correlate.js';

function makeFinding(overrides: Partial<Finding> & { fingerprint: string; ruleId: string }): Finding {
  return {
    wcag: ['1.1.1'],
    level: 'A',
    severity: 'serious',
    confidence: 'needs_review',
    impact: ['screen_reader'],
    message: 'test',
    location: { file: 'test.html', startLine: 1, startCol: 0, endLine: 1, endCol: 10 },
    snippet: '<img>',
    clusterKey: 'test.html#img',
    fixClass: 'NEEDS_HUMAN',
    pass: 1,
    status: 'open',
    ...overrides,
  };
}

function makeReport(findings: Finding[]): ScanReport {
  return {
    scanId: 'test-scan',
    createdAt: new Date().toISOString(),
    projectName: 'test',
    target: { root: '.', files: 5 },
    toolVersion: '0.1.0',
    findings,
    packets: [],
    summary: {
      total: findings.length,
      bySeverity: { blocker: 0, critical: 0, serious: findings.length, moderate: 0, minor: 0 },
      byLevel: { A: findings.length, AA: 0, AAA: 0 },
      clusters: [],
      score: 80,
    },
  };
}

describe('correlate', () => {
  it('upgrades confidence of static findings matched by runtime', () => {
    const staticFinding = makeFinding({
      fingerprint: 'static-001',
      ruleId: 'img/missing-alt',
      wcag: ['1.1.1'],
      confidence: 'needs_review',
      pass: 1,
    });

    const runtimeFinding = makeFinding({
      fingerprint: 'runtime-001',
      ruleId: 'axe/image-alt',
      wcag: ['1.1.1'],
      confidence: 'certain',
      pass: 2,
    });

    const report = makeReport([staticFinding]);
    const result = correlate(report, [runtimeFinding]);

    // Static finding should be upgraded
    const upgraded = result.findings.find((f) => f.fingerprint === 'static-001');
    expect(upgraded?.confidence).toBe('certain');
    expect(upgraded?.status).toBe('confirmed');

    // Runtime finding should NOT be appended (it matched a static one)
    expect(result.findings.find((f) => f.fingerprint === 'runtime-001')).toBeUndefined();
  });

  it('appends runtime-only findings', () => {
    const staticFinding = makeFinding({
      fingerprint: 'static-001',
      ruleId: 'img/missing-alt',
      wcag: ['1.1.1'],
      pass: 1,
    });

    const runtimeOnly = makeFinding({
      fingerprint: 'runtime-002',
      ruleId: 'axe/html-has-lang',
      wcag: ['3.1.1'],
      confidence: 'certain',
      pass: 2,
    });

    const report = makeReport([staticFinding]);
    const result = correlate(report, [runtimeOnly]);

    expect(result.findings).toHaveLength(2);
    expect(result.findings.find((f) => f.fingerprint === 'runtime-002')).toBeDefined();
  });

  it('recomputes summary after correlation', () => {
    const staticFinding = makeFinding({
      fingerprint: 'static-001',
      ruleId: 'img/missing-alt',
      pass: 1,
    });

    const runtimeOnly = makeFinding({
      fingerprint: 'runtime-002',
      ruleId: 'runtime/target-too-small',
      wcag: ['2.5.8'],
      severity: 'moderate',
      level: 'AA',
      pass: 2,
    });

    const report = makeReport([staticFinding]);
    const result = correlate(report, [runtimeOnly]);

    expect(result.summary.total).toBe(2);
    expect(result.summary.bySeverity.moderate).toBe(1);
    expect(result.summary.bySeverity.serious).toBe(1);
    expect(result.summary.byLevel.AA).toBe(1);
  });

  it('is idempotent on second call', () => {
    const staticFinding = makeFinding({
      fingerprint: 'static-001',
      ruleId: 'img/missing-alt',
      pass: 1,
    });

    const runtimeFinding = makeFinding({
      fingerprint: 'runtime-001',
      ruleId: 'axe/keyboard-focus',
      wcag: ['2.1.1'],
      pass: 2,
    });

    const report = makeReport([staticFinding]);
    const first = correlate(report, [runtimeFinding]);
    const second = correlate(first, [runtimeFinding]);

    expect(second.findings).toHaveLength(first.findings.length);
    expect(second.summary.total).toBe(first.summary.total);
  });
});
