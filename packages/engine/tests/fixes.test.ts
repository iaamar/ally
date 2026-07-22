import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { ScanReport, TextEdit, Finding, ReasoningPacket } from '@ally/shared';
import { applyEdits, collectFixes } from '../src/fixes.js';
import { runRulesOn } from './harness.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

/* ── Helper: wrap harness output in a minimal ScanReport shape ── */
function toReport(result: { findings: Finding[]; packets: ReasoningPacket[] }): ScanReport {
  return {
    scanId: 'test',
    createdAt: new Date().toISOString(),
    projectName: 'test',
    target: { root: '.', files: 1 },
    toolVersion: '0.0.1',
    findings: result.findings,
    packets: result.packets,
    summary: { total: result.findings.length, bySeverity: {} as any, byLevel: {} as any, clusters: [], score: 0 },
  };
}

describe('applyEdits', () => {
  it('single insert', () => {
    const source = 'hello world';
    const edits: TextEdit[] = [
      { file: 'test', startLine: 1, startCol: 6, endLine: 1, endCol: 6, replacement: 'beautiful ' },
    ];
    expect(applyEdits(source, edits)).toBe('hellobeautiful  world');
  });

  it('applies two edits in any order', () => {
    const source = 'aaa\nbbb\nccc';
    const edits: TextEdit[] = [
      { file: 'test', startLine: 1, startCol: 1, endLine: 1, endCol: 4, replacement: 'AAA' },
      { file: 'test', startLine: 3, startCol: 1, endLine: 3, endCol: 4, replacement: 'CCC' },
    ];
    expect(applyEdits(source, edits)).toBe('AAA\nbbb\nCCC');
    // Reversed order should produce same result
    expect(applyEdits(source, [...edits].reverse())).toBe('AAA\nbbb\nCCC');
  });

  it('throws on overlapping edits', () => {
    const source = 'abcdef';
    const edits: TextEdit[] = [
      { file: 'test', startLine: 1, startCol: 1, endLine: 1, endCol: 4, replacement: 'X' },
      { file: 'test', startLine: 1, startCol: 3, endLine: 1, endCol: 6, replacement: 'Y' },
    ];
    expect(() => applyEdits(source, edits)).toThrow(/[Oo]verlap/);
  });
});

describe('idempotency gate — bad/interactive.tsx', () => {
  it('SAFE_AUTOFIX fixes do not re-fire and introduce no new findings', () => {
    const fixture = join(FIXTURES, 'bad/interactive.tsx');
    const original = readFileSync(fixture, 'utf-8');

    // Step 1: run rules, collect SAFE_AUTOFIX fixes
    const result1 = runRulesOn(fixture);
    const report1 = toReport(result1);
    const fixes = collectFixes(report1, { classes: ['SAFE_AUTOFIX'] });
    expect(fixes.length).toBeGreaterThan(0);

    // Step 2: apply all fixes
    let patched = original;
    for (const fix of fixes) {
      patched = applyEdits(patched, fix.edits);
    }

    // Step 3: write patched to temp file and re-scan
    const tmpFile = join(FIXTURES, '_patched_interactive.tsx');
    try {
      writeFileSync(tmpFile, patched);
      const result2 = runRulesOn(tmpFile);

      // Fixed rules should not fire again
      const fixedRuleIds = new Set(
        result1.findings
          .filter((f) => f.fixClass === 'SAFE_AUTOFIX' && f.fix)
          .map((f) => f.ruleId),
      );
      const reFired = result2.findings.filter((f) => fixedRuleIds.has(f.ruleId));
      expect(reFired).toEqual([]);

      // No new findings introduced (only pre-existing non-SAFE_AUTOFIX should remain)
      const originalNonSafe = result1.findings
        .filter((f) => f.fixClass !== 'SAFE_AUTOFIX' || !f.fix)
        .map((f) => f.ruleId)
        .sort();
      const remainingIds = result2.findings.map((f) => f.ruleId).sort();
      expect(remainingIds).toEqual(originalNonSafe);
    } finally {
      try { unlinkSync(tmpFile); } catch {}
    }
  });
});

describe('idempotency gate — bad/page.html', () => {
  it('SAFE_AUTOFIX fixes for doc rules do not re-fire', () => {
    const fixture = join(FIXTURES, 'bad/page.html');
    const original = readFileSync(fixture, 'utf-8');

    const result1 = runRulesOn(fixture);
    const report1 = toReport(result1);
    const fixes = collectFixes(report1, { classes: ['SAFE_AUTOFIX'] });
    expect(fixes.length).toBeGreaterThan(0);

    // Collect all edits from all fixes, sort by position to apply together
    const allEdits = fixes.flatMap((f) => f.edits);
    const patched = applyEdits(original, allEdits);

    const tmpFile = join(FIXTURES, '_patched_page.html');
    try {
      writeFileSync(tmpFile, patched);
      const result2 = runRulesOn(tmpFile);

      // no-redundant-role (all were SAFE_AUTOFIX) should be fully gone
      const redundantRole = result2.findings.filter((f) => f.ruleId === 'no-redundant-role');
      expect(redundantRole).toEqual([]);
      // SAFE_AUTOFIX duplicate-id should be gone (the SUGGEST one for referenced id may remain)
      const safeAutofixDupIds = result2.findings.filter(
        (f) => f.ruleId === 'duplicate-id' && f.fixClass === 'SAFE_AUTOFIX',
      );
      expect(safeAutofixDupIds).toEqual([]);
    } finally {
      try { unlinkSync(tmpFile); } catch {}
    }
  });
});
