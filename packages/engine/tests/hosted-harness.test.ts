import { describe, expect, it } from 'vitest';
import type { AttemptRecord } from '@ally/shared';
import {
  evaluateHostedContract,
  planHostedContract,
} from '../src/hosted-harness.js';
import { scanSources, type SourceFileInput } from '../src/runner.js';

const bad: SourceFileInput[] = [
  {
    path: 'src/App.tsx',
    content: 'export function App(){return <main><img src="/one.png" /><img src="/two.png" /></main>}',
  },
  {
    path: 'src/Other.tsx',
    content: 'export function Other(){return <p>Already accessible</p>}',
  },
];

async function contractForBad() {
  const report = await scanSources('demo', bad);
  return {
    report,
    contract: planHostedContract({
      report,
      sources: bad,
      options: { ruleId: 'img-missing-alt' },
      now: () => 1_700_000_000_000,
    }),
  };
}

describe('hosted remediation harness', () => {
  it('assigns stable sibling match keys and distinct ordinals', async () => {
    const { report } = await contractForBad();
    const images = report.findings.filter((finding) => finding.ruleId === 'img-missing-alt');

    expect(images).toHaveLength(2);
    expect(images[0]?.matchKey).toBe(images[1]?.matchKey);
    expect(images.map((finding) => finding.ordinal)).toEqual([0, 1]);
    expect(images[0]?.fingerprint).not.toBe(images[1]?.fingerprint);
  });

  it('passes a complete repair using stable match counts', async () => {
    const { contract } = await contractForBad();
    const fixed = [
      {
        path: 'src/App.tsx',
        content: 'export function App(){return <main><img src="/one.png" alt="One" /><img src="/two.png" alt="Two" /></main>}',
      },
      bad[1]!,
    ];
    const evaluation = await evaluateHostedContract({ contract, attempts: [], sources: fixed });

    expect(evaluation.result.verdict).toBe('pass');
    expect(evaluation.result.nextAction).toBe('settled');
    expect(evaluation.result.checks.find((check) => check.id === 'targets_resolved')?.pass).toBe(true);
  });

  it('rejects unchanged, incomplete, out-of-scope, and incomplete-file attempts', async () => {
    const { contract } = await contractForBad();
    const unchanged = await evaluateHostedContract({ contract, attempts: [], sources: bad });
    expect(unchanged.result.reason).toBe('no_edit');

    const incomplete = await evaluateHostedContract({
      contract,
      attempts: [],
      sources: [
        {
          path: 'src/App.tsx',
          content: 'export function App(){return <main><img src="/one.png" alt="One" /><img src="/two.png" /></main>}',
        },
        bad[1]!,
      ],
    });
    expect(incomplete.result.verdict).toBe('fail');

    const outsideScope = await evaluateHostedContract({
      contract,
      attempts: [],
      sources: [
        bad[0]!,
        { path: 'src/Other.tsx', content: 'export function Other(){return <p>Changed</p>}' },
      ],
    });
    expect(outsideScope.result.reason).toBe('scope_violation');

    const missing = await evaluateHostedContract({
      contract,
      attempts: [],
      sources: [bad[0]!],
    });
    expect(missing.result.reason).toBe('file_set_mismatch');
  });

  it('rejects a new moderate-or-higher regression and a lower score', async () => {
    const { contract } = await contractForBad();
    const evaluation = await evaluateHostedContract({
      contract,
      attempts: [],
      sources: [
        {
          path: 'src/App.tsx',
          content: 'export function App(){return <main><img src="/one.png" alt="One" /><img src="/two.png" alt="Two" /><div onClick={()=>{}}>Open</div></main>}',
        },
        bad[1]!,
      ],
    });

    expect(evaluation.result.verdict).toBe('regression');
    expect(evaluation.result.nextAction).toBe('escalate');
    expect(evaluation.result.checks.find((check) => check.id === 'no_regressions')?.pass).toBe(false);
  });

  it('escalates after the third failed attempt', async () => {
    const { contract } = await contractForBad();
    const attempts: AttemptRecord[] = [
      { n: 1, verdict: 'fail', progressSignature: 'first', feedback: '', changedFiles: ['src/App.tsx'] },
      { n: 2, verdict: 'fail', progressSignature: 'second', feedback: '', changedFiles: ['src/App.tsx'] },
    ];
    const evaluation = await evaluateHostedContract({
      contract,
      attempts,
      sources: [
        {
          path: 'src/App.tsx',
          content: 'export function App(){return <main><img src="/one.png" alt="One" /><img src="/two.png" /></main>}',
        },
        bad[1]!,
      ],
    });

    expect(evaluation.result.attempt).toBe(3);
    expect(evaluation.result.verdict).toBe('escalated');
    expect(evaluation.result.reason).toBe('max_attempts');
    expect(evaluation.result.attemptsRemaining).toBe(0);
  });

  it('honors cancellation before a hosted evaluation scan', async () => {
    const { contract } = await contractForBad();
    const controller = new AbortController();
    controller.abort();

    await expect(evaluateHostedContract({
      contract,
      attempts: [],
      sources: [
        {
          path: 'src/App.tsx',
          content: 'export function App(){return <main><img src="/one.png" alt="One" /><img src="/two.png" /></main>}',
        },
        bad[1]!,
      ],
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' });
  });
});
