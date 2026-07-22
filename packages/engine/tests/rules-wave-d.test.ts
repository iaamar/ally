import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { runRulesOn } from './harness.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

/* ── Wave D rule IDs ── */

const WAVE_D_RULE_IDS = [
  'abstract-role-used',
  'area-missing-alt',
  'aria-required-attr',
  'aria-unsupported-elements',
  'fieldset-missing-legend',
  'heading-order',
  'input-image-missing-alt',
  'label-missing-control',
  'list-item-parent',
  'meta-refresh',
  'meta-viewport-no-user-scale',
  'no-access-key',
  'no-aria-hidden-on-body',
  'no-nested-interactive',
  'object-missing-text',
  'scope-on-non-th',
  'svg-missing-title',
  'table-missing-headers',
];

function waveDFindings(file: string) {
  const { findings } = runRulesOn(file);
  return findings.filter((f) => WAVE_D_RULE_IDS.includes(f.ruleId));
}

/* ── JSX fixtures ── */

describe('Wave D rules — bad/wave-d.tsx', () => {
  it('detects expected Wave D rule IDs', () => {
    const hits = waveDFindings(join(FIXTURES, 'bad/wave-d.tsx'));
    const ids = [...new Set(hits.map((f) => f.ruleId))].sort();
    expect(ids).toContain('aria-required-attr');
    expect(ids).toContain('no-access-key');
    expect(ids).toContain('input-image-missing-alt');
    expect(ids).toContain('area-missing-alt');
    expect(ids).toContain('object-missing-text');
    expect(ids).toContain('svg-missing-title');
    expect(ids).toContain('abstract-role-used');
    expect(ids).toContain('no-nested-interactive');
    expect(ids).toContain('fieldset-missing-legend');
    expect(ids).toContain('label-missing-control');
    expect(ids).toContain('heading-order');
  });

  it('aria-required-attr fires on checkbox and slider missing required attrs', () => {
    const hits = waveDFindings(join(FIXTURES, 'bad/wave-d.tsx'))
      .filter((f) => f.ruleId === 'aria-required-attr');
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it('no-access-key fires with SAFE_AUTOFIX', () => {
    const hits = waveDFindings(join(FIXTURES, 'bad/wave-d.tsx'))
      .filter((f) => f.ruleId === 'no-access-key');
    expect(hits).toHaveLength(1);
    expect(hits[0].fixClass).toBe('SAFE_AUTOFIX');
    expect(hits[0].fix).toBeDefined();
  });

  it('input-image-missing-alt fires on input[type=image] without alt', () => {
    const hits = waveDFindings(join(FIXTURES, 'bad/wave-d.tsx'))
      .filter((f) => f.ruleId === 'input-image-missing-alt');
    expect(hits).toHaveLength(1);
    expect(hits[0].severity).toBe('critical');
  });

  it('abstract-role-used fires on role="widget"', () => {
    const hits = waveDFindings(join(FIXTURES, 'bad/wave-d.tsx'))
      .filter((f) => f.ruleId === 'abstract-role-used');
    expect(hits).toHaveLength(1);
  });

  it('no-nested-interactive fires twice (button>a and a>button)', () => {
    const hits = waveDFindings(join(FIXTURES, 'bad/wave-d.tsx'))
      .filter((f) => f.ruleId === 'no-nested-interactive');
    expect(hits).toHaveLength(2);
  });

  it('heading-order fires with confidence=needs_review for JSX', () => {
    const hits = waveDFindings(join(FIXTURES, 'bad/wave-d.tsx'))
      .filter((f) => f.ruleId === 'heading-order');
    expect(hits).toHaveLength(1);
    expect(hits[0].confidence).toBe('needs_review');
  });

  it('fieldset-missing-legend fires on fieldset without legend', () => {
    const hits = waveDFindings(join(FIXTURES, 'bad/wave-d.tsx'))
      .filter((f) => f.ruleId === 'fieldset-missing-legend');
    expect(hits).toHaveLength(1);
  });

  it('label-missing-control fires on orphan label', () => {
    const hits = waveDFindings(join(FIXTURES, 'bad/wave-d.tsx'))
      .filter((f) => f.ruleId === 'label-missing-control');
    expect(hits).toHaveLength(1);
  });

  it('svg-missing-title fires on svg without title or aria-label', () => {
    const hits = waveDFindings(join(FIXTURES, 'bad/wave-d.tsx'))
      .filter((f) => f.ruleId === 'svg-missing-title');
    expect(hits).toHaveLength(1);
  });
});

describe('Wave D rules — clean/wave-d.tsx', () => {
  it('produces zero Wave D findings on clean fixture', () => {
    const hits = waveDFindings(join(FIXTURES, 'clean/wave-d.tsx'));
    expect(hits).toEqual([]);
  });
});

/* ── HTML fixtures ── */

describe('Wave D rules — bad/wave-d.html', () => {
  it('detects expected HTML-specific Wave D rule IDs', () => {
    const hits = waveDFindings(join(FIXTURES, 'bad/wave-d.html'));
    const ids = [...new Set(hits.map((f) => f.ruleId))].sort();
    expect(ids).toContain('meta-refresh');
    expect(ids).toContain('meta-viewport-no-user-scale');
    expect(ids).toContain('no-aria-hidden-on-body');
    expect(ids).toContain('scope-on-non-th');
    expect(ids).toContain('table-missing-headers');
    expect(ids).toContain('list-item-parent');
    expect(ids).toContain('aria-unsupported-elements');
  });

  it('meta-refresh fires with delay > 0', () => {
    const hits = waveDFindings(join(FIXTURES, 'bad/wave-d.html'))
      .filter((f) => f.ruleId === 'meta-refresh');
    expect(hits).toHaveLength(1);
    expect(hits[0].message).toContain('5');
  });

  it('meta-viewport-no-user-scale fires with SAFE_AUTOFIX', () => {
    const hits = waveDFindings(join(FIXTURES, 'bad/wave-d.html'))
      .filter((f) => f.ruleId === 'meta-viewport-no-user-scale');
    expect(hits).toHaveLength(1);
    expect(hits[0].fixClass).toBe('SAFE_AUTOFIX');
    expect(hits[0].fix).toBeDefined();
  });

  it('no-aria-hidden-on-body fires on body with SAFE_AUTOFIX', () => {
    const hits = waveDFindings(join(FIXTURES, 'bad/wave-d.html'))
      .filter((f) => f.ruleId === 'no-aria-hidden-on-body');
    expect(hits).toHaveLength(1);
    expect(hits[0].fixClass).toBe('SAFE_AUTOFIX');
  });

  it('scope-on-non-th fires on td with scope', () => {
    const hits = waveDFindings(join(FIXTURES, 'bad/wave-d.html'))
      .filter((f) => f.ruleId === 'scope-on-non-th');
    expect(hits).toHaveLength(1);
    expect(hits[0].fix).toBeDefined();
  });

  it('table-missing-headers fires on table with no th', () => {
    const hits = waveDFindings(join(FIXTURES, 'bad/wave-d.html'))
      .filter((f) => f.ruleId === 'table-missing-headers');
    expect(hits).toHaveLength(1);
  });

  it('list-item-parent fires on li outside ul/ol', () => {
    const hits = waveDFindings(join(FIXTURES, 'bad/wave-d.html'))
      .filter((f) => f.ruleId === 'list-item-parent');
    expect(hits).toHaveLength(1);
  });

  it('aria-unsupported-elements fires on style with role', () => {
    const hits = waveDFindings(join(FIXTURES, 'bad/wave-d.html'))
      .filter((f) => f.ruleId === 'aria-unsupported-elements');
    expect(hits).toHaveLength(1);
    expect(hits[0].fix).toBeDefined();
  });
});

describe('Wave D rules — clean/wave-d.html', () => {
  it('produces zero Wave D findings on clean fixture', () => {
    const hits = waveDFindings(join(FIXTURES, 'clean/wave-d.html'));
    expect(hits).toEqual([]);
  });
});
