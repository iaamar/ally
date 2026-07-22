import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { runRulesOn } from './harness.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

const EXPECTED_BAD_RULE_IDS = [
  'anchor-has-content',
  'anchor-is-valid',
  'button-missing-type',
  'click-without-keyboard',
  'form-control-missing-label',
  'interactive-supports-focus',
  'mouse-events-need-focus-events',
  'no-autofocus',
  'no-distracting-elements',
  'noninteractive-tabindex',
  'tabindex-positive',
];

describe('Wave B interactive/keyboard rules', () => {
  it('detects expected rule IDs on bad/interactive.tsx', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/interactive.tsx'));
    const ruleIds = [...new Set(findings.map((f) => f.ruleId))].sort();
    expect(ruleIds).toEqual(EXPECTED_BAD_RULE_IDS);
  });

  it('click-without-keyboard fires on div with onClick', () => {
    const { findings, packets } = runRulesOn(join(FIXTURES, 'bad/interactive.tsx'));
    const f = findings.find((f) => f.ruleId === 'click-without-keyboard')!;
    expect(f).toBeDefined();
    expect(f.confidence).toBe('high');
    expect(f.fixClass).toBe('SUGGEST');
    // Should have a reasoning packet
    const pkt = packets.find((p) => p.findingFingerprint === f.fingerprint);
    expect(pkt).toBeDefined();
  });

  it('interactive-supports-focus fires on span[role=button] without tabindex', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/interactive.tsx'));
    const f = findings.find((f) => f.ruleId === 'interactive-supports-focus')!;
    expect(f).toBeDefined();
    expect(f.confidence).toBe('certain');
    expect(f.fixClass).toBe('SAFE_AUTOFIX');
    expect(f.fix).toBeDefined();
    expect(f.fix!.edits.length).toBeGreaterThan(0);
    expect(f.fix!.edits[0].replacement).toContain('tabIndex');
  });

  it('tabindex-positive fires on tabIndex={3}', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/interactive.tsx'));
    const f = findings.find((f) => f.ruleId === 'tabindex-positive')!;
    expect(f).toBeDefined();
    expect(f.confidence).toBe('certain');
    expect(f.fixClass).toBe('SAFE_AUTOFIX');
    expect(f.fix).toBeDefined();
    expect(f.fix!.edits[0].replacement).toContain('0');
  });

  it('no-autofocus fires on input with autoFocus', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/interactive.tsx'));
    const f = findings.find((f) => f.ruleId === 'no-autofocus')!;
    expect(f).toBeDefined();
    expect(f.confidence).toBe('certain');
    expect(f.fixClass).toBe('SAFE_AUTOFIX');
    expect(f.fix).toBeDefined();
    expect(f.fix!.edits[0].replacement).toBe('');
  });

  it('noninteractive-tabindex fires on p with tabIndex={0}', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/interactive.tsx'));
    const f = findings.find((f) => f.ruleId === 'noninteractive-tabindex')!;
    expect(f).toBeDefined();
    expect(f.confidence).toBe('high');
    expect(f.fixClass).toBe('SUGGEST');
  });

  it('mouse-events-need-focus-events fires on div with onMouseOver', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/interactive.tsx'));
    const f = findings.find((f) => f.ruleId === 'mouse-events-need-focus-events')!;
    expect(f).toBeDefined();
    expect(f.message).toContain('onMouseOver');
  });

  it('anchor-is-valid fires on a with href="#" and onClick', () => {
    const { findings, packets } = runRulesOn(join(FIXTURES, 'bad/interactive.tsx'));
    const f = findings.find((f) => f.ruleId === 'anchor-is-valid')!;
    expect(f).toBeDefined();
    expect(f.confidence).toBe('certain');
    expect(f.fixClass).toBe('SUGGEST');
    const pkt = packets.find((p) => p.findingFingerprint === f.fingerprint);
    expect(pkt).toBeDefined();
  });

  it('anchor-has-content fires on icon-only anchor', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/interactive.tsx'));
    const f = findings.find((f) => f.ruleId === 'anchor-has-content')!;
    expect(f).toBeDefined();
    expect(f.confidence).toBe('certain');
    expect(f.fixClass).toBe('NEEDS_HUMAN');
  });

  it('button-missing-type fires on button without type', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/interactive.tsx'));
    const f = findings.find((f) => f.ruleId === 'button-missing-type')!;
    expect(f).toBeDefined();
    expect(f.confidence).toBe('certain');
    expect(f.fixClass).toBe('SAFE_AUTOFIX');
    expect(f.fix).toBeDefined();
    expect(f.fix!.edits[0].replacement).toContain('type="button"');
  });

  it('no-distracting-elements fires on marquee', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/interactive.tsx'));
    const f = findings.find((f) => f.ruleId === 'no-distracting-elements')!;
    expect(f).toBeDefined();
    expect(f.confidence).toBe('certain');
    expect(f.message).toContain('marquee');
  });

  it('produces zero findings on clean/interactive.tsx', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'clean/interactive.tsx'));
    // Filter to only interactive rule IDs so Wave A rules don't interfere
    const interactiveFindings = findings.filter((f) => EXPECTED_BAD_RULE_IDS.includes(f.ruleId));
    expect(interactiveFindings).toEqual([]);
  });
});
