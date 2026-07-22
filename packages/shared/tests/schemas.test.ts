import { describe, expect, it } from 'vitest';
import { zScanReport, zVerdict, zScanIngest } from '../src/index.js';
import { SEVERITY_WEIGHT, CONFIDENCE_WEIGHT, LEVEL_ORDER, WCAG_SC } from '../src/index.js';
import type { Finding, ScanReport } from '../src/index.js';

const finding: Finding = {
  fingerprint: 'abc123def4567890', ruleId: 'jsx/img-missing-alt', wcag: ['1.1.1'], level: 'A',
  severity: 'critical', confidence: 'certain', impact: ['screen_reader'],
  message: 'img element has no alt attribute',
  location: { file: 'src/App.tsx', startLine: 3, startCol: 5, endLine: 3, endCol: 30 },
  snippet: '<img src="/logo.png" />', clusterKey: 'src/App.tsx#App', fixClass: 'SUGGEST', pass: 1,
};
const report: ScanReport = {
  scanId: 'scan_1', createdAt: '2026-07-22T00:00:00.000Z', projectName: 'demo',
  target: { root: '/tmp/demo', files: 2 }, toolVersion: '0.1.0',
  findings: [finding], packets: [],
  summary: { total: 1, bySeverity: { blocker: 0, critical: 1, serious: 0, moderate: 0, minor: 0 },
    byLevel: { A: 1, AA: 0, AAA: 0 },
    clusters: [{ clusterKey: 'src/App.tsx#App', count: 1, ruleIds: ['jsx/img-missing-alt'] }], score: 67 },
};

describe('shared contract', () => {
  it('accepts a valid ScanReport and round-trips', () => {
    expect(zScanReport.parse(report)).toEqual(report);
  });
  it('rejects a bad severity', () => {
    expect(() => zScanReport.parse({ ...report, findings: [{ ...finding, severity: 'huge' }] })).toThrow();
  });
  it('validates verdicts', () => {
    expect(zVerdict.parse({ packetId: 'pkt_abc123def4567890', confirm: true, reasoning: 'decorative logo' }).confirm).toBe(true);
  });
  it('validates ingest payloads', () => {
    expect(zScanIngest.parse({ projectName: 'demo', report }).projectName).toBe('demo');
  });
  it('exposes weights and WCAG catalog', () => {
    expect(SEVERITY_WEIGHT.blocker).toBe(10);
    expect(CONFIDENCE_WEIGHT.certain).toBe(1);
    expect(LEVEL_ORDER.AA).toBe(2);
    expect(WCAG_SC['1.1.1'].name).toBe('Non-text Content');
  });
});
