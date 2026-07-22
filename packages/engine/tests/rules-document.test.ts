import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { runRulesOn } from './harness.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

/** Document-level ruleIds expected from bad/page.html */
const EXPECTED_DOC_RULE_IDS = [
  'doc-missing-lang',
  'doc-missing-title',
  'duplicate-id',
];

describe('Wave C document rules — bad/page.html', () => {
  it('detects doc-missing-lang, doc-missing-title, and duplicate-id', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/page.html'));
    const docRuleIds = [
      ...new Set(
        findings
          .filter((f) => EXPECTED_DOC_RULE_IDS.includes(f.ruleId))
          .map((f) => f.ruleId),
      ),
    ].sort();
    expect(docRuleIds).toEqual(EXPECTED_DOC_RULE_IDS);
  });

  it('doc-missing-lang fires on <html> without lang', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/page.html'));
    const f = findings.find((f) => f.ruleId === 'doc-missing-lang')!;
    expect(f).toBeDefined();
    expect(f.fixClass).toBe('SUGGEST');
  });

  it('doc-missing-title fires on page without <title>', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/page.html'));
    const f = findings.find((f) => f.ruleId === 'doc-missing-title')!;
    expect(f).toBeDefined();
    expect(f.fixClass).toBe('SUGGEST');
  });

  it('duplicate-id on unreferenced ids has fixClass SAFE_AUTOFIX', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/page.html'));
    const dupFindings = findings.filter((f) => f.ruleId === 'duplicate-id');
    expect(dupFindings.length).toBeGreaterThanOrEqual(2);
    // The unreferenced duplicate (id="dup") should be SAFE_AUTOFIX
    const safeAutofix = dupFindings.find((f) => f.fixClass === 'SAFE_AUTOFIX');
    expect(safeAutofix).toBeDefined();
  });

  it('duplicate-id on referenced ids has fixClass SUGGEST', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/page.html'));
    const dupFindings = findings.filter((f) => f.ruleId === 'duplicate-id');
    // The referenced duplicate (id="refdup", referenced by label for="refdup") should be SUGGEST
    const suggest = dupFindings.find((f) => f.fixClass === 'SUGGEST');
    expect(suggest).toBeDefined();
  });

  it('also detects ARIA rules in bad/page.html', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/page.html'));
    const ariaRuleIds = [
      ...new Set(
        findings
          .filter((f) =>
            ['aria-role-valid', 'aria-props-valid', 'aria-hidden-on-focusable', 'no-redundant-role', 'form-control-missing-label', 'heading-has-content'].includes(f.ruleId),
          )
          .map((f) => f.ruleId),
      ),
    ].sort();
    expect(ariaRuleIds).toEqual([
      'aria-hidden-on-focusable',
      'aria-props-valid',
      'aria-role-valid',
      'form-control-missing-label',
      'heading-has-content',
      'no-redundant-role',
    ]);
  });
});

describe('Wave C document rules — clean/page.html', () => {
  it('produces zero document-level findings on clean fixture', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'clean/page.html'));
    const docFindings = findings.filter((f) => EXPECTED_DOC_RULE_IDS.includes(f.ruleId));
    expect(docFindings).toEqual([]);
  });
});
