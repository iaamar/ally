import type {
  Finding, ReasoningPacket, TextEdit,
  Severity, Confidence, FixClass, Modality, WcagLevel,
} from '@ally/shared';
import type { Elem, ParsedDoc, AllyConfig } from '../types.js';
import { fingerprintOf, clusterKeyOf } from '../fingerprint.js';
import { imageRules } from './images.js';
import { interactiveRules } from './interactive.js';
import { ariaRules } from './aria.js';
import { structureRules } from './structure.js';
import { documentRules } from './document.js';

/* ── Rule framework interfaces ── */

export interface RuleMeta {
  id: string;
  wcag: string[];
  level: WcagLevel;
  severity: Severity;
  confidence: Confidence;
  impact: Modality[];
  fixClass: FixClass;
  description: string;
}

export interface FindingDraft {
  message: string;
  elem: Elem;
  fix?: (elem: Elem) => TextEdit[];
  packet?: {
    hypothesis: string;
    rubric: string[];
    citations: string[];
  };
  overrides?: Partial<Pick<Finding, 'severity' | 'confidence' | 'fixClass'>>;
}

export interface RuleCtx {
  config: AllyConfig;
  doc: ParsedDoc;
}

export interface Rule {
  meta: RuleMeta;
  check(elem: Elem, ctx: RuleCtx): FindingDraft | null;
  docCheck?(doc: ParsedDoc, ctx: RuleCtx): FindingDraft[];
}

/* ── Rule registry ── */

export const RULES: Rule[] = [
  ...imageRules,
  ...interactiveRules,
  ...ariaRules,
  ...structureRules,
  ...documentRules,
];

/* ── draftToFinding builder ── */

export function draftToFinding(
  draft: FindingDraft,
  rule: Rule,
  relFile: string,
  config: AllyConfig,
): { finding: Finding; packet?: ReasoningPacket } {
  const { meta } = rule;
  const elem = draft.elem;

  const clusterKey = clusterKeyOf(elem, relFile);
  const snippet = elem.raw;
  const fingerprint = fingerprintOf(meta.id, relFile, clusterKey, snippet);

  const finding: Finding = {
    fingerprint,
    ruleId: meta.id,
    wcag: meta.wcag,
    level: meta.level,
    severity: draft.overrides?.severity ?? meta.severity,
    confidence: draft.overrides?.confidence ?? meta.confidence,
    impact: meta.impact,
    message: draft.message,
    location: elem.loc,
    snippet,
    clusterKey,
    fixClass: draft.overrides?.fixClass ?? meta.fixClass,
    pass: 1,
    status: 'open',
  };

  // Build autofix if draft.fix is provided
  if (draft.fix) {
    const edits = draft.fix(elem);
    finding.fix = {
      title: draft.message,
      fingerprint,
      edits,
    };
  }

  // Build reasoning packet if draft.packet is provided
  let packet: ReasoningPacket | undefined;
  if (draft.packet) {
    packet = {
      packetId: `pkt_${fingerprint}`,
      findingFingerprint: fingerprint,
      hypothesis: draft.packet.hypothesis,
      evidence: {
        snippet,
        location: elem.loc,
      },
      rubric: draft.packet.rubric,
      citations: draft.packet.citations,
      verdictSchema: {
        confirm: 'boolean',
        reasoning: 'string',
        suggestedFix: 'string|null',
      },
    };
  }

  return { finding, packet };
}

/* ── Re-exports ── */
export type { Elem, ParsedDoc, AllyConfig } from '../types.js';
export * from './helpers.js';
