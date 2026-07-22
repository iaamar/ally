import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { runRulesOn } from './harness.js';
import { fingerprintOf, clusterKeyOf } from '../src/fingerprint.js';

const FIXTURES = join(import.meta.dirname, 'fixtures');

const EXPECTED_BAD_RULE_IDS = [
  'iframe-missing-title',
  'img-alt-quality',
  'img-missing-alt',
  'img-redundant-alt',
  'media-missing-captions',
];

describe('Wave A image/media rules — JSX', () => {
  it('detects exactly the expected ruleIds on bad/images.tsx', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/images.tsx'));
    const ruleIds = [...new Set(findings.map((f) => f.ruleId))].sort();
    expect(ruleIds).toEqual(EXPECTED_BAD_RULE_IDS);
  });

  it('img-missing-alt finding has correct metadata', () => {
    const { findings, packets } = runRulesOn(join(FIXTURES, 'bad/images.tsx'));
    const f = findings.find((f) => f.ruleId === 'img-missing-alt')!;
    expect(f).toBeDefined();
    expect(f.confidence).toBe('certain');
    expect(f.fixClass).toBe('SUGGEST');
    expect(f.location.startLine).toBe(4);
    expect(f.pass).toBe(1);
    expect(f.status).toBe('open');

    // Verify packet was emitted with correct packetId
    const pkt = packets.find((p) => p.findingFingerprint === f.fingerprint);
    expect(pkt).toBeDefined();
    expect(pkt!.packetId).toBe(`pkt_${f.fingerprint}`);
  });

  it('img-alt-quality fires on filename-like alt', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/images.tsx'));
    const f = findings.find((f) => f.ruleId === 'img-alt-quality')!;
    expect(f).toBeDefined();
    expect(f.confidence).toBe('needs_review');
    expect(f.message).toContain('photo123.png');
  });

  it('img-redundant-alt fires on "image of" phrase', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/images.tsx'));
    const f = findings.find((f) => f.ruleId === 'img-redundant-alt')!;
    expect(f).toBeDefined();
    expect(f.fix).toBeDefined();
    expect(f.severity).toBe('minor');
  });

  it('media-missing-captions fires on video without track', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/images.tsx'));
    const f = findings.find((f) => f.ruleId === 'media-missing-captions')!;
    expect(f).toBeDefined();
    expect(f.fixClass).toBe('NEEDS_HUMAN');
  });

  it('iframe-missing-title fires on iframe without title', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/images.tsx'));
    const f = findings.find((f) => f.ruleId === 'iframe-missing-title')!;
    expect(f).toBeDefined();
    expect(f.confidence).toBe('certain');
  });

  it('does not fire on role="presentation" img (line 9)', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/images.tsx'));
    // The img on line 9 has alt="chart" role="presentation"
    // img-missing-alt should NOT fire (role=presentation exempts it)
    // img-alt-quality should NOT fire ("chart" is not a filename/placeholder)
    const line9 = findings.filter((f) => f.location.startLine === 9);
    expect(line9).toEqual([]);
  });

  it('produces zero findings on clean/images.tsx', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'clean/images.tsx'));
    expect(findings).toEqual([]);
  });
});

describe('Wave A image/media rules — HTML', () => {
  it('detects exactly the expected ruleIds on bad/images.html', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'bad/images.html'));
    const ruleIds = [...new Set(findings.map((f) => f.ruleId))].sort();
    expect(ruleIds).toEqual(EXPECTED_BAD_RULE_IDS);
  });

  it('produces zero findings on clean/images.html', () => {
    const { findings } = runRulesOn(join(FIXTURES, 'clean/images.html'));
    expect(findings).toEqual([]);
  });
});
