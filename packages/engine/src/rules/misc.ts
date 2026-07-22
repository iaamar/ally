import type { Rule, FindingDraft, RuleCtx } from './index.js';
import type { Elem, ParsedDoc } from '../types.js';
import { attrValue, hasAttr, hasAnyAttr, removeAttrEdit, replaceAttrValueEdit } from './helpers.js';

/* ── WCAG reference URLs ── */

const WCAG_131_URL = 'https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html';
const WCAG_332_URL = 'https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html';
const WCAG_221_URL = 'https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html';
const WCAG_144_URL = 'https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html';

/* ── Form control tags ── */

const FORM_CONTROL_TAGS = new Set(['input', 'select', 'textarea']);

/* ── Heading tags ── */

const HEADING_TAGS: Record<string, number> = {
  h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6,
};

/* ── label-missing-control ── */

const labelMissingControl: Rule = {
  meta: {
    id: 'label-missing-control',
    wcag: ['3.3.2'],
    level: 'A',
    severity: 'moderate',
    confidence: 'high',
    impact: ['screen_reader'],
    fixClass: 'SUGGEST',
    description: 'Labels must be associated with a form control.',
  },
  check(elem: Elem, ctx: RuleCtx): FindingDraft | null {
    if (elem.tag !== 'label') return null;

    // Check for "for" attribute
    const forVal = attrValue(elem, 'for') ?? attrValue(elem, 'htmlFor');
    if (forVal) {
      // Check if any element in the doc has this id
      const target = ctx.doc.elements.find((e) => attrValue(e, 'id') === forVal);
      if (target) return null;
      return {
        message: `<label for="${forVal}"> references an id that does not exist in the document.`,
        elem,
      };
    }

    // No "for" — check if label wraps a form control
    if (hasFormControlDescendant(elem)) return null;

    return {
      message: '<label> is not associated with a form control. Use the "for" attribute or wrap a form control.',
      elem,
    };
  },
};

function hasFormControlDescendant(elem: Elem): boolean {
  for (const child of elem.children) {
    if (FORM_CONTROL_TAGS.has(child.tag)) return true;
    if (hasFormControlDescendant(child)) return true;
  }
  return false;
}

/* ── fieldset-missing-legend ── */

const fieldsetMissingLegend: Rule = {
  meta: {
    id: 'fieldset-missing-legend',
    wcag: ['1.3.1'],
    level: 'A',
    severity: 'moderate',
    confidence: 'high',
    impact: ['screen_reader'],
    fixClass: 'SUGGEST',
    description: 'Fieldset elements must contain a legend element.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (elem.tag !== 'fieldset') return null;

    const hasLegend = elem.children.some((c) => c.tag === 'legend');
    if (hasLegend) return null;

    return {
      message: '<fieldset> is missing a <legend> element. Add a <legend> to describe the group.',
      elem,
    };
  },
};

/* ── list-item-parent ── */

const listItemParent: Rule = {
  meta: {
    id: 'list-item-parent',
    wcag: ['1.3.1'],
    level: 'A',
    severity: 'serious',
    confidence: 'certain',
    impact: ['screen_reader'],
    fixClass: 'SUGGEST',
    description: 'List items must be contained in a <ul>, <ol>, or <menu>.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (elem.tag !== 'li') return null;
    if (elem.lang !== 'html') return null;

    const validParents = new Set(['ul', 'ol', 'menu']);
    if (elem.parent && validParents.has(elem.parent.tag)) return null;

    return {
      message: '<li> is not contained within a <ul>, <ol>, or <menu> parent.',
      elem,
    };
  },
};

/* ── heading-order ── */

const headingOrder: Rule = {
  meta: {
    id: 'heading-order',
    wcag: ['1.3.1'],
    level: 'A',
    severity: 'moderate',
    confidence: 'high',
    impact: ['screen_reader', 'cognitive'],
    fixClass: 'SUGGEST',
    description: 'Heading levels should not skip (e.g., h1 to h3).',
  },
  check(_elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    return null; // Only fires via docCheck
  },
  docCheck(doc: ParsedDoc, _ctx: RuleCtx): FindingDraft[] {
    const headings = doc.elements.filter((e) => e.tag in HEADING_TAGS);
    if (headings.length < 2) return [];

    const drafts: FindingDraft[] = [];
    for (let i = 1; i < headings.length; i++) {
      const prevLevel = HEADING_TAGS[headings[i - 1].tag];
      const currLevel = HEADING_TAGS[headings[i].tag];

      // Skipping downward (e.g., h1 -> h3 skips h2)
      if (currLevel > prevLevel + 1) {
        const draft: FindingDraft = {
          message: `Heading level skipped: <${headings[i - 1].tag}> to <${headings[i].tag}>. Do not skip heading levels.`,
          elem: headings[i],
        };
        if (doc.lang === 'jsx') {
          draft.overrides = { confidence: 'needs_review' };
        }
        drafts.push(draft);
      }
    }

    return drafts;
  },
};

/* ── meta-refresh ── */

const metaRefresh: Rule = {
  meta: {
    id: 'meta-refresh',
    wcag: ['2.2.1'],
    level: 'A',
    severity: 'serious',
    confidence: 'certain',
    impact: ['cognitive', 'screen_reader'],
    fixClass: 'SUGGEST',
    description: 'Pages should not use meta refresh to redirect or reload.',
  },
  check(_elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    return null; // Only fires via docCheck
  },
  docCheck(doc: ParsedDoc, _ctx: RuleCtx): FindingDraft[] {
    if (doc.lang !== 'html') return [];

    const drafts: FindingDraft[] = [];
    for (const elem of doc.elements) {
      if (elem.tag !== 'meta') continue;
      const httpEquiv = attrValue(elem, 'http-equiv');
      if (httpEquiv?.toLowerCase() !== 'refresh') continue;

      const content = attrValue(elem, 'content');
      if (!content) continue;

      // Parse delay from content (e.g., "5" or "5;url=...")
      const delay = parseInt(content, 10);
      if (isNaN(delay) || delay <= 0) continue;

      drafts.push({
        message: `meta[http-equiv="refresh"] has a delay of ${delay} seconds. Avoid automatic page refresh.`,
        elem,
      });
    }

    return drafts;
  },
};

/* ── meta-viewport-no-user-scale ── */

const metaViewportNoUserScale: Rule = {
  meta: {
    id: 'meta-viewport-no-user-scale',
    wcag: ['1.4.4'],
    level: 'AA',
    severity: 'critical',
    confidence: 'certain',
    impact: ['low_vision'],
    fixClass: 'SAFE_AUTOFIX',
    description: 'The viewport meta tag must not prevent user scaling.',
  },
  check(_elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    return null; // Only fires via docCheck
  },
  docCheck(doc: ParsedDoc, _ctx: RuleCtx): FindingDraft[] {
    if (doc.lang !== 'html') return [];

    const drafts: FindingDraft[] = [];
    for (const elem of doc.elements) {
      if (elem.tag !== 'meta') continue;
      const name = attrValue(elem, 'name');
      if (name?.toLowerCase() !== 'viewport') continue;

      const content = attrValue(elem, 'content');
      if (!content) continue;

      const directives = parseViewport(content);
      const userScalable = directives['user-scalable'];
      const maxScale = directives['maximum-scale'];

      if (userScalable === 'no' || userScalable === '0') {
        // Rewrite content without user-scalable=no
        const newContent = content
          .split(',')
          .map((s) => s.trim())
          .filter((s) => !s.startsWith('user-scalable'))
          .join(', ');

        drafts.push({
          message: 'Viewport meta has user-scalable=no, preventing users from zooming.',
          elem,
          fix: (e: Elem) => [replaceAttrValueEdit(e, 'content', newContent || 'width=device-width, initial-scale=1')],
        });
      } else if (maxScale !== undefined) {
        const maxScaleNum = parseFloat(maxScale);
        if (!isNaN(maxScaleNum) && maxScaleNum < 2) {
          const newContent = content
            .split(',')
            .map((s) => s.trim())
            .filter((s) => !s.startsWith('maximum-scale'))
            .join(', ');

          drafts.push({
            message: `Viewport meta has maximum-scale=${maxScale} (< 2), limiting user zoom.`,
            elem,
            fix: (e: Elem) => [replaceAttrValueEdit(e, 'content', newContent || 'width=device-width, initial-scale=1')],
          });
        }
      }
    }

    return drafts;
  },
};

function parseViewport(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of content.split(',')) {
    const [key, ...rest] = part.trim().split('=');
    if (key) result[key.trim()] = rest.join('=').trim();
  }
  return result;
}

/* ── Export ── */

export const miscRules: Rule[] = [
  labelMissingControl,
  fieldsetMissingLegend,
  listItemParent,
  headingOrder,
  metaRefresh,
  metaViewportNoUserScale,
];
