import { describe, expect, it } from 'vitest';
import { scanSources } from '../src/runner.js';

describe('scanSources', () => {
  it('scans in-memory source files without filesystem access', async () => {
    const report = await scanSources('remote-project', [
      {
        path: 'src/App.tsx',
        content: 'export function App() { return <img src="/logo.png" />; }',
      },
    ]);

    expect(report.projectName).toBe('remote-project');
    expect(report.target).toEqual({ root: 'remote-project', files: 1 });
    expect(report.findings.some((finding) => finding.ruleId === 'img-missing-alt')).toBe(true);
  });

  it('respects remote scan policy overrides', async () => {
    const report = await scanSources(
      'remote-project',
      [{
        path: 'src/App.tsx',
        content: 'export function App() { return <img src="/logo.png" />; }',
      }],
      { ignoreRules: ['img-missing-alt'] },
    );

    expect(report.findings).toHaveLength(0);
    expect(report.summary.score).toBe(100);
  });
});
