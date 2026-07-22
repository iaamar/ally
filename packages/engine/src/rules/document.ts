import type { Rule, FindingDraft, RuleCtx } from './index.js';
import type { Elem, ParsedDoc } from '../types.js';
import { attrValue, hasAttr, insertAttrEdit } from './helpers.js';

/* ── WCAG reference URLs ── */

const WCAG_311_URL = 'https://www.w3.org/WAI/WCAG22/Understanding/language-of-page.html';
const WCAG_242_URL = 'https://www.w3.org/WAI/WCAG22/Understanding/page-titled.html';
const WCAG_411_URL = 'https://www.w3.org/WAI/WCAG22/Understanding/parsing.html';

/* ── doc-missing-lang ── */

const docMissingLang: Rule = {
  meta: {
    id: 'doc-missing-lang',
    wcag: ['3.1.1'],
    level: 'A',
    severity: 'serious',
    confidence: 'certain',
    impact: ['screen_reader'],
    fixClass: 'SUGGEST',
    description: 'The <html> element must have a lang attribute.',
  },
  check(_elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    return null; // Only fires via docCheck
  },
  docCheck(doc: ParsedDoc, _ctx: RuleCtx): FindingDraft[] {
    if (doc.lang !== 'html') return [];

    const htmlElem = doc.elements.find((e) => e.tag === 'html');
    if (!htmlElem) return [];

    const lang = attrValue(htmlElem, 'lang');
    if (lang !== null && lang.trim() !== '') return [];

    return [{
      message: 'Document is missing a lang attribute on the <html> element.',
      elem: htmlElem,
      packet: {
        hypothesis: '<html> element lacks lang attribute',
        rubric: [
          'What is the primary language of this document?',
          'Add the appropriate BCP 47 language tag',
        ],
        citations: [WCAG_311_URL],
      },
    }];
  },
};

/* ── doc-missing-title ── */

const docMissingTitle: Rule = {
  meta: {
    id: 'doc-missing-title',
    wcag: ['2.4.2'],
    level: 'A',
    severity: 'serious',
    confidence: 'certain',
    impact: ['screen_reader', 'cognitive'],
    fixClass: 'SUGGEST',
    description: 'The document must have a <title> element with text content.',
  },
  check(_elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    return null; // Only fires via docCheck
  },
  docCheck(doc: ParsedDoc, _ctx: RuleCtx): FindingDraft[] {
    if (doc.lang !== 'html') return [];

    const titleElem = doc.elements.find((e) => e.tag === 'title');

    // No <title> element at all
    if (!titleElem) {
      // Attach finding to <html> or first element
      const anchor = doc.elements.find((e) => e.tag === 'html') ?? doc.elements[0];
      if (!anchor) return [];

      return [{
        message: 'Document is missing a <title> element.',
        elem: anchor,
        packet: {
          hypothesis: 'Document has no <title>',
          rubric: ['What title describes this page?'],
          citations: [WCAG_242_URL],
        },
      }];
    }

    // <title> exists but is empty
    if (!titleElem.hasTextContent) {
      return [{
        message: 'Document <title> element is empty. Add descriptive text.',
        elem: titleElem,
        packet: {
          hypothesis: '<title> is empty',
          rubric: ['What title describes this page?'],
          citations: [WCAG_242_URL],
        },
      }];
    }

    return [];
  },
};

/* ── duplicate-id ── */

/** Attributes that reference element IDs */
const ID_REF_ATTRS = ['for', 'aria-labelledby', 'aria-describedby'];

function isIdReferenced(id: string, doc: ParsedDoc): boolean {
  for (const elem of doc.elements) {
    for (const refAttr of ID_REF_ATTRS) {
      const val = attrValue(elem, refAttr);
      if (val !== null) {
        // aria-labelledby/describedby can be space-separated ID lists
        const ids = val.split(/\s+/);
        if (ids.includes(id)) return true;
      }
    }
    // Check href="#id"
    const href = attrValue(elem, 'href');
    if (href === `#${id}`) return true;
  }
  return false;
}

const duplicateId: Rule = {
  meta: {
    id: 'duplicate-id',
    wcag: ['4.1.1'],
    level: 'A',
    severity: 'serious',
    confidence: 'certain',
    impact: ['screen_reader'],
    fixClass: 'SAFE_AUTOFIX',
    description: 'Element id attributes must be unique within the document.',
  },
  check(_elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    return null; // Only fires via docCheck
  },
  docCheck(doc: ParsedDoc, _ctx: RuleCtx): FindingDraft[] {
    const idMap = new Map<string, Elem[]>();

    for (const elem of doc.elements) {
      const id = attrValue(elem, 'id');
      if (id === null || id === '') continue;
      const list = idMap.get(id) ?? [];
      list.push(elem);
      idMap.set(id, list);
    }

    const drafts: FindingDraft[] = [];

    for (const [id, elems] of idMap) {
      if (elems.length < 2) continue;

      const referenced = isIdReferenced(id, doc);

      // Report each duplicate (skip the first occurrence)
      for (let i = 1; i < elems.length; i++) {
        const suffix = `-${i + 1}`;
        const draft: FindingDraft = {
          message: `Duplicate id="${id}". Element ids must be unique.`,
          elem: elems[i],
        };

        if (referenced) {
          // Referenced IDs need human review
          draft.overrides = { fixClass: 'SUGGEST' };
        } else {
          // Not referenced: safe to auto-suffix
          draft.fix = (e: Elem) => [
            replaceIdEdit(e, id, `${id}${suffix}`),
          ];
        }

        drafts.push(draft);
      }
    }

    return drafts;
  },
};

/** Replace the id attribute value */
function replaceIdEdit(e: Elem, _oldId: string, newId: string) {
  const attr = e.attrs['id'];
  if (!attr) throw new Error('id attr not found');
  const quote = e.lang === 'jsx' ? '"' : '"';
  return {
    file: attr.loc.file,
    startLine: attr.loc.startLine,
    startCol: attr.loc.startCol,
    endLine: attr.loc.endLine,
    endCol: attr.loc.endCol,
    replacement: `id=${quote}${newId}${quote}`,
  };
}

/* ── Export all document rules ── */

export const documentRules: Rule[] = [
  docMissingLang,
  docMissingTitle,
  duplicateId,
];
