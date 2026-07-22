import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { runRulesOn } from './harness.js';
import { summarize } from '../src/prioritize.js';
import { applyVerdicts } from '../src/reasoning.js';
import type { ScanReport, Verdict } from '@ally/shared';

const FIXTURES = join(import.meta.dirname, 'fixtures');

/** Build a minimal ScanReport from the harness output for testing. */
function buildReport(fixtureFile: string): ScanReport {
  const { findings, packets } = runRulesOn(fixtureFile);
  const filesScanned = 1;
  return {
    scanId: 'test-scan-001',
    createdAt: new Date().toISOString(),
    projectName: 'test-project',
    target: { root: '.', files: filesScanned },
    toolVersion: '0.0.1',
    findings: findings.map((f) => ({ ...f, status: f.status ?? ('open' as const) })),
    packets,
    summary: summarize(findings, filesScanned),
  };
}

describe('applyVerdicts (Pass 3 reasoning)', () => {
  it('confirm with suggestedFix sets status, confidence, and suggestedFixText', () => {
    const report = buildReport(join(FIXTURES, 'bad/images.tsx'));
    const missingAltPacket = report.packets.find((p) =>
      report.findings.some(
        (f) => f.fingerprint === p.findingFingerprint && f.ruleId === 'img-missing-alt',
      ),
    )!;
    expect(missingAltPacket).toBeDefined();

    const verdicts: Verdict[] = [
      {
        packetId: missingAltPacket.packetId,
        confirm: true,
        reasoning: 'Image has no alt attribute and is not decorative.',
        suggestedFix: 'alt="Company logo"',
      },
    ];

    const result = applyVerdicts(report, verdicts);

    // Finding updated
    const updatedFinding = result.findings.find(
      (f) => f.fingerprint === missingAltPacket.findingFingerprint,
    )!;
    expect(updatedFinding.status).toBe('confirmed');
    expect(updatedFinding.suggestedFixText).toBe('alt="Company logo"');

    // Packet consumed
    expect(
      result.packets.find((p) => p.packetId === missingAltPacket.packetId),
    ).toBeUndefined();

    // Summary total unchanged (confirmed findings still count)
    expect(result.summary.total).toBe(report.summary.total);

    // Original report is NOT mutated (pure function)
    expect(
      report.findings.find((f) => f.fingerprint === missingAltPacket.findingFingerprint)!
        .status,
    ).toBe('open');
  });

  it('confirm upgrades confidence from needs_review to high', () => {
    const report = buildReport(join(FIXTURES, 'bad/images.tsx'));
    const altQualityPacket = report.packets.find((p) =>
      report.findings.some(
        (f) => f.fingerprint === p.findingFingerprint && f.ruleId === 'img-alt-quality',
      ),
    )!;
    expect(altQualityPacket).toBeDefined();

    // Verify the finding starts as needs_review
    const originalFinding = report.findings.find(
      (f) => f.fingerprint === altQualityPacket.findingFingerprint,
    )!;
    expect(originalFinding.confidence).toBe('needs_review');

    const verdicts: Verdict[] = [
      {
        packetId: altQualityPacket.packetId,
        confirm: true,
        reasoning: 'Alt text is a filename, not descriptive.',
      },
    ];

    const result = applyVerdicts(report, verdicts);
    const updatedFinding = result.findings.find(
      (f) => f.fingerprint === altQualityPacket.findingFingerprint,
    )!;
    expect(updatedFinding.status).toBe('confirmed');
    expect(updatedFinding.confidence).toBe('high');
  });

  it('dismiss sets status to dismissed and decrements summary total', () => {
    const report = buildReport(join(FIXTURES, 'bad/images.tsx'));
    const altQualityPacket = report.packets.find((p) =>
      report.findings.some(
        (f) => f.fingerprint === p.findingFingerprint && f.ruleId === 'img-alt-quality',
      ),
    )!;
    expect(altQualityPacket).toBeDefined();

    const verdicts: Verdict[] = [
      {
        packetId: altQualityPacket.packetId,
        confirm: false,
        reasoning: 'This is intentionally using a filename as alt.',
      },
    ];

    const originalTotal = report.summary.total;
    const result = applyVerdicts(report, verdicts);

    const updatedFinding = result.findings.find(
      (f) => f.fingerprint === altQualityPacket.findingFingerprint,
    )!;
    expect(updatedFinding.status).toBe('dismissed');

    // Dismissed findings drop out of summary total
    expect(result.summary.total).toBe(originalTotal - 1);

    // Score should increase (fewer weighted issues)
    expect(result.summary.score).toBeGreaterThanOrEqual(report.summary.score);
  });

  it('throws on unknown packetId without mutating the report', () => {
    const report = buildReport(join(FIXTURES, 'bad/images.tsx'));
    const originalReport = structuredClone(report);

    const verdicts: Verdict[] = [
      {
        packetId: 'pkt_nonexistent_12345',
        confirm: true,
        reasoning: 'This packet does not exist.',
      },
    ];

    expect(() => applyVerdicts(report, verdicts)).toThrowError(/Unknown packetIds/);

    // Report unchanged
    expect(report).toEqual(originalReport);
  });

  it('rejects malformed verdict (missing reasoning) via zVerdict validation', () => {
    const report = buildReport(join(FIXTURES, 'bad/images.tsx'));
    const packet = report.packets[0]!;

    const verdicts = [
      {
        packetId: packet.packetId,
        confirm: true,
        // reasoning is missing
      },
    ] as unknown as Verdict[];

    expect(() => applyVerdicts(report, verdicts)).toThrow();
  });

  it('rejects verdict with empty reasoning string', () => {
    const report = buildReport(join(FIXTURES, 'bad/images.tsx'));
    const packet = report.packets[0]!;

    const verdicts = [
      {
        packetId: packet.packetId,
        confirm: true,
        reasoning: '',
      },
    ] as Verdict[];

    expect(() => applyVerdicts(report, verdicts)).toThrow();
  });
});
