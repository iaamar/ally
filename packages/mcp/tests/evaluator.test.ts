import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import {
  resolveEvaluationProfile,
  runApprovedTestScripts,
} from '../src/evaluator.js';

const FIXTURE_ROOT = resolve(import.meta.dirname, '../../engine/tests/fixtures/project');

describe('evaluation profile', () => {
  it('uses safe static-only defaults', () => {
    const profile = resolveEvaluationProfile(FIXTURE_ROOT);

    expect(profile.runtime).toBe(false);
    expect(profile.routes).toEqual(['/']);
    expect(profile.testScripts).toEqual([]);
    expect(profile.runtimeTimeoutMs).toBe(30_000);
  });

  it('normalizes explicit routes and timeouts', () => {
    const profile = resolveEvaluationProfile(FIXTURE_ROOT, {
      runtime: true,
      appUrl: 'http://localhost:3000',
      routes: ['/', '/login', '/login'],
      runtimeTimeoutMs: 500,
      testTimeoutMs: 999_999,
    });

    expect(profile.runtime).toBe(true);
    expect(profile.routes).toEqual(['/', '/login']);
    expect(profile.runtimeTimeoutMs).toBe(1_000);
    expect(profile.testTimeoutMs).toBe(600_000);
  });
});

describe('approved test scripts', () => {
  it('does not execute scripts when the project has no package.json', async () => {
    const results = await runApprovedTestScripts(
      FIXTURE_ROOT,
      ['test'],
      1_000,
    );

    expect(results).toHaveLength(1);
    expect(results[0].passed).toBe(false);
    expect(results[0].command).toBeUndefined();
    expect(results[0].error).toContain('No package.json');
  });
});
