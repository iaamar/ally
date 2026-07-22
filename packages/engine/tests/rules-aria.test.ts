import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { runRulesOn } from './harness.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

/** ARIA-specific ruleIds expected from bad/aria.tsx */
const EXPECTED_ARIA_RULE_IDS = [
  'aria-hidden-on-focusable',
  'aria-props-valid',
  'aria-role-valid',
  'form-control-missing-label',
  'heading-has-content',
  'no-redundant-role',
];

describe('Wave C ARIA rules — bad/aria.tsx', () => {
  it('detects exactly the expected ARIA ruleIds', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/aria.tsx'));
    // Filter to only ARIA/structure rules (exclude interactive rules like button-missing-type)
    const ariaRuleIds = [
      ...new Set(
        findings
          .filter((f) => EXPECTED_ARIA_RULE_IDS.includes(f.ruleId))
          .map((f) => f.ruleId),
      ),
    ].sort();
    expect(ariaRuleIds).toEqual(EXPECTED_ARIA_RULE_IDS);
  });

  it('aria-role-valid fires on invalid role="buttn"', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/aria.tsx'));
    const f = findings.find((f) => f.ruleId === 'aria-role-valid')!;
    expect(f).toBeDefined();
    expect(f.confidence).toBe('certain');
    expect(f.fixClass).toBe('SUGGEST');
    expect(f.location.startLine).toBe(5);
  });

  it('aria-props-valid fires on invalid aria-expandd', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/aria.tsx'));
    const f = findings.find((f) => f.ruleId === 'aria-props-valid')!;
    expect(f).toBeDefined();
    expect(f.confidence).toBe('certain');
    expect(f.fixClass).toBe('SUGGEST');
  });

  it('aria-hidden-on-focusable fires on button with aria-hidden', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/aria.tsx'));
    const f = findings.find((f) => f.ruleId === 'aria-hidden-on-focusable')!;
    expect(f).toBeDefined();
    expect(f.location.startLine).toBe(9);
  });

  it('no-redundant-role fires three times (button, nav, a)', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/aria.tsx'));
    const hits = findings.filter((f) => f.ruleId === 'no-redundant-role');
    expect(hits).toHaveLength(3);
    expect(hits.every((h) => h.fixClass === 'SAFE_AUTOFIX')).toBe(true);
  });

  it('form-control-missing-label fires on input without label', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/aria.tsx'));
    const f = findings.find((f) => f.ruleId === 'form-control-missing-label')!;
    expect(f).toBeDefined();
    expect(f.fixClass).toBe('SUGGEST');
  });

  it('heading-has-content fires on empty h1', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/aria.tsx'));
    const f = findings.find((f) => f.ruleId === 'heading-has-content')!;
    expect(f).toBeDefined();
    expect(f.location.startLine).toBe(19);
  });
});

describe('Wave C ARIA rules — clean/aria.tsx', () => {
  it('produces zero ARIA findings on clean fixture', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'clean/aria.tsx'));
    const ariaFindings = findings.filter((f) => EXPECTED_ARIA_RULE_IDS.includes(f.ruleId));
    expect(ariaFindings).toEqual([]);
  });
});
