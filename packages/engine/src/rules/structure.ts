import type { Rule, FindingDraft, RuleCtx } from './index.js';
import type { Elem } from '../types.js';
import { attrValue, hasAttr } from './helpers.js';

/* ── WCAG reference URLs ── */

const WCAG_131_URL = 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html';
const WCAG_412_URL = 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html';

/* ── Form control tags ── */

const FORM_CONTROL_TAGS = new Set(['input', 'select', 'textarea']);

/* ── Heading tags ── */

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

/* ── form-control-missing-label ── */

const formControlMissingLabel: Rule = {
  meta: {
    id: 'form-control-missing-label',
    wcag: ['1.3.1', '4.1.2'],
    level: 'A',
    severity: 'critical',
    confidence: 'certain',
    impact: ['screen_reader'],
    fixClass: 'SUGGEST',
    description: 'Form controls must have an accessible label.',
  },
  check(elem: Elem, ctx: RuleCtx): FindingDraft | null {
    if (!FORM_CONTROL_TAGS.has(elem.tag)) return null;

    // Skip hidden inputs
    if (elem.tag === 'input' && attrValue(elem, 'type') === 'hidden') return null;

    // Has aria-label or aria-labelledby
    if (hasAttr(elem, 'aria-label') || hasAttr(elem, 'aria-labelledby')) return null;

    // Has title attribute (accessible name fallback)
    const title = attrValue(elem, 'title');
    if (title !== null && title.trim() !== '') return null;

    // Check for wrapping <label> ancestor
    let parent = elem.parent;
    while (parent) {
      if (parent.tag === 'label') return null;
      parent = parent.parent;
    }

    // Check for <label> with for/htmlFor matching this elem's id
    const id = attrValue(elem, 'id');
    if (id) {
      for (const other of ctx.doc.elements) {
        if (other.tag !== 'label') continue;
        const forVal = attrValue(other, 'for');
        if (forVal === id) return null;
      }
    }

    return {
      message: `Form control <${elem.tag}> is missing an accessible label. Add a <label>, aria-label, or aria-labelledby.`,
      elem,
      packet: {
        hypothesis: 'Form control has no accessible name',
        rubric: [
          'Is there a visible label that could be associated?',
          'Would aria-label or a wrapping <label> be more appropriate?',
        ],
        citations: [WCAG_131_URL, WCAG_412_URL],
      },
    };
  },
};

/* ── heading-has-content ── */

const headingHasContent: Rule = {
  meta: {
    id: 'heading-has-content',
    wcag: ['1.3.1', '2.4.6'],
    level: 'AA',
    severity: 'serious',
    confidence: 'certain',
    impact: ['screen_reader', 'cognitive'],
    fixClass: 'SUGGEST',
    description: 'Heading elements must have text content.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (!HEADING_TAGS.has(elem.tag)) return null;

    // Has text content (direct or nested)
    if (elem.hasTextContent) return null;

    // Has aria-label
    if (hasAttr(elem, 'aria-label') || hasAttr(elem, 'aria-labelledby')) return null;

    return {
      message: `Empty heading <${elem.tag}>. Add text content or remove the heading.`,
      elem,
      packet: {
        hypothesis: 'Heading has no accessible text content',
        rubric: [
          'Should this heading contain text?',
          'Or should the heading element be removed?',
        ],
        citations: [WCAG_131_URL],
      },
    };
  },
};

/* ── Export all structure rules ── */

export const structureRules: Rule[] = [
  formControlMissingLabel,
  headingHasContent,
];
