import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanProject, scanFiles } from '../src/runner.js';

/* ── Fixture-based tests (static fixtures) ── */

const FIXTURE_DIR = join(import.meta.dirname!, 'fixtures', 'project');

describe('scanProject', () => {
  it('returns findings from bad TSX and none from clean HTML', async () => {
    const report = await scanProject(FIXTURE_DIR);

    expect(report.scanId).toMatch(/^scan_[a-f0-9]{8}$/);
    expect(report.toolVersion).toBe('0.1.0');
    expect(report.projectName).toBe('test-project');
    expect(report.findings.length).toBeGreaterThan(0);

    const tsxFindings = report.findings.filter(f => f.location.file.includes('App.tsx'));
    expect(tsxFindings.length).toBeGreaterThanOrEqual(2);

    const ruleIds = new Set(tsxFindings.map(f => f.ruleId));
    expect(ruleIds.has('img-missing-alt')).toBe(true);
    expect(ruleIds.has('button-missing-type')).toBe(true);

    // Clean HTML should have no findings (or very few)
    const htmlFindings = report.findings.filter(f => f.location.file.includes('index.html'));
    expect(htmlFindings.length).toBe(0);

    expect(report.summary.total).toBe(report.findings.length);
    expect(report.summary.score).toBeGreaterThan(0);
  });
});

describe('scanFiles', () => {
  it('scans only specified files', async () => {
    const report = await scanFiles(FIXTURE_DIR, ['src/App.tsx']);

    expect(report.target.files).toBe(1);
    expect(report.findings.length).toBeGreaterThanOrEqual(2);

    const ruleIds = new Set(report.findings.map(f => f.ruleId));
    expect(ruleIds.has('img-missing-alt')).toBe(true);
  });
});

/* ── Temp dir tests for ignore configs ── */

describe('ignoreRules', () => {
  let tmp: string;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ally-runner-'));
    mkdirSync(join(tmp, 'src'), { recursive: true });
    writeFileSync(join(tmp, 'src', 'Bad.tsx'), `
export function Bad() {
  return <img src="/x.png" />;
}
`);
    writeFileSync(join(tmp, 'ally.config.json'), JSON.stringify({
      ignoreRules: ['img-missing-alt'],
    }));
  });

  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('filters out ignored rules', async () => {
    const report = await scanProject(tmp);
    const altFindings = report.findings.filter(f => f.ruleId === 'img-missing-alt');
    expect(altFindings.length).toBe(0);
  });
});

describe('ignorePaths', () => {
  let tmp: string;

  beforeAll(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ally-runner-'));
    mkdirSync(join(tmp, 'vendor'), { recursive: true });
    mkdirSync(join(tmp, 'src'), { recursive: true });
    writeFileSync(join(tmp, 'vendor', 'Bad.tsx'), `
export function Bad() {
  return <img src="/x.png" />;
}
`);
    writeFileSync(join(tmp, 'src', 'Good.tsx'), `
export function Good() {
  return <img src="/x.png" alt="logo" />;
}
`);
  });

  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('skips ignored directories', async () => {
    const report = await scanProject(tmp, { ignorePaths: ['vendor/**'] });
    const vendorFindings = report.findings.filter(f => f.location.file.includes('vendor'));
    expect(vendorFindings.length).toBe(0);
  });
});
