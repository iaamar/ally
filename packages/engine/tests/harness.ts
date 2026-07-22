import { readFileSync } from 'node:fs';
import type { Finding, ReasoningPacket } from '@ally/shared';
import { parseSource } from '../src/parse.js';
import { loadConfig } from '../src/config.js';
import { RULES, draftToFinding } from '../src/rules/index.js';
import type { AllyConfig } from '../src/types.js';

const DEFAULT_CONFIG: AllyConfig = {
  targetLevel: 'AA',
  ignoreRules: [],
  ignorePaths: [],
  defaultLang: 'en',
  autofix: 'on',
};

/**
 * Minimal test harness: parse a fixture file, run all RULES, return findings + packets.
 *
 * Task 9's real runner will replace the internals; keep this API stable.
 */
export function runRulesOn(fixtureFile: string): { findings: Finding[]; packets: ReasoningPacket[] } {
  const source = readFileSync(fixtureFile, 'utf-8');
  const doc = parseSource(fixtureFile, source);
  const config = DEFAULT_CONFIG;

  const findings: Finding[] = [];
  const packets: ReasoningPacket[] = [];

  const ctx = { config, doc };

  for (const rule of RULES) {
    // Skip ignored rules
    if (config.ignoreRules.includes(rule.meta.id)) continue;

    // Per-element checks
    for (const elem of doc.elements) {
      const draft = rule.check(elem, ctx);
      if (draft) {
        const { finding, packet } = draftToFinding(draft, rule, fixtureFile, config);
        findings.push(finding);
        if (packet) packets.push(packet);
      }
    }

    // Document-level checks
    if (rule.docCheck) {
      const drafts = rule.docCheck(doc, ctx);
      for (const draft of drafts) {
        const { finding, packet } = draftToFinding(draft, rule, fixtureFile, config);
        findings.push(finding);
        if (packet) packets.push(packet);
      }
    }
  }

  return { findings, packets };
}
