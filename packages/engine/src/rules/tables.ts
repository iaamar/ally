import type { Rule, FindingDraft, RuleCtx } from './index.js';
import type { Elem, ParsedDoc } from '../types.js';
import { attrValue, hasAttr, hasAnyAttr, removeAttrEdit } from './helpers.js';

/* ── WCAG reference URLs ── */

const WCAG_131_URL = 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html';

/* ── scope-on-non-th ── */

const scopeOnNonTh: Rule = {
  meta: {
    id: 'scope-on-non-th',
    wcag: ['1.3.1'],
    level: 'A',
    severity: 'moderate',
    confidence: 'certain',
    impact: ['screen_reader'],
    fixClass: 'SAFE_AUTOFIX',
    description: 'The scope attribute should only be used on <th> elements.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (elem.tag === 'th') return null;
    if (!hasAttr(elem, 'scope')) return null;

    return {
      message: `<${elem.tag}> has scope attribute. scope is only valid on <th> elements.`,
      elem,
      fix: (e: Elem) => [removeAttrEdit(e, 'scope')],
    };
  },
};

/* ── table-missing-headers ── */

const tableMissingHeaders: Rule = {
  meta: {
    id: 'table-missing-headers',
    wcag: ['1.3.1'],
    level: 'A',
    severity: 'serious',
    confidence: 'high',
    impact: ['screen_reader'],
    fixClass: 'SUGGEST',
    description: 'Data tables should have header cells to identify columns and rows.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (elem.tag !== 'table') return null;

    // Collect all tr descendants
    const trs = collectDescendants(elem, 'tr');
    if (trs.length < 2) return null;

    // Check for any th descendant
    const ths = collectDescendants(elem, 'th');
    if (ths.length > 0) return null;

    // Check if any td has headers or scope attribute
    const tds = collectDescendants(elem, 'td');
    if (tds.some((td) => hasAttr(td, 'headers') || hasAttr(td, 'scope'))) return null;

    return {
      message: 'Data table has no header cells (<th>). Add <th> elements to identify columns/rows.',
      elem,
      packet: {
        hypothesis: 'Table lacks header cells for screen reader navigation',
        rubric: ['Does this table contain data (not layout)?', 'Which cells should be headers?'],
        citations: [WCAG_131_URL],
      },
    };
  },
};

function collectDescendants(elem: Elem, tag: string): Elem[] {
  const result: Elem[] = [];
  for (const child of elem.children) {
    if (child.tag === tag) result.push(child);
    result.push(...collectDescendants(child, tag));
  }
  return result;
}

/* ── Export ── */

export const tableRules: Rule[] = [
  scopeOnNonTh,
  tableMissingHeaders,
];
