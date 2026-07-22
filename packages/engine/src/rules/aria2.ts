import type { Rule, FindingDraft, RuleCtx } from './index.js';
import type { Elem, ParsedDoc } from '../types.js';
import { attrValue, hasAttr, hasAnyAttr, removeAttrEdit } from './helpers.js';

/* ── WCAG reference URLs ── */

const WCAG_412_URL = 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html';
const WCAG_214_URL = 'https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html';
const WCAG_111_URL = 'https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html';

/* ── Required ARIA attributes by role ── */

const REQUIRED_ATTRS_BY_ROLE: Record<string, string[]> = {
  checkbox: ['aria-checked'],
  radio: ['aria-checked'],
  switch: ['aria-checked'],
  combobox: ['aria-expanded'],
  slider: ['aria-valuenow'],
  spinbutton: ['aria-valuenow'],
  option: ['aria-selected'],
};

/* ── Elements that should not have ARIA ── */

const UNSUPPORTED_ELEMENTS = new Set(['meta', 'script', 'style']);

/* ── Abstract roles ── */

const ABSTRACT_ROLES = new Set([
  'command', 'composite', 'input', 'landmark', 'range',
  'roletype', 'section', 'sectionhead', 'select', 'structure',
  'widget', 'window',
]);

/* ── Interactive elements ── */

const INTERACTIVE_TAGS = new Set(['button', 'input', 'select', 'textarea']);

function isInteractiveElem(e: Elem): boolean {
  if (INTERACTIVE_TAGS.has(e.tag)) return true;
  if (e.tag === 'a' && hasAttr(e, 'href')) return true;
  return false;
}

/* ── aria-required-attr ── */

const ariaRequiredAttr: Rule = {
  meta: {
    id: 'aria-required-attr',
    wcag: ['4.1.2'],
    level: 'A',
    severity: 'serious',
    confidence: 'certain',
    impact: ['screen_reader'],
    fixClass: 'SUGGEST',
    description: 'Elements with ARIA roles must have all required ARIA attributes.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    const role = attrValue(elem, 'role');
    if (!role) return null;

    const required = REQUIRED_ATTRS_BY_ROLE[role];
    if (!required) return null;

    for (const attr of required) {
      if (!hasAttr(elem, attr)) {
        return {
          message: `Element with role="${role}" is missing required attribute "${attr}".`,
          elem,
          packet: {
            hypothesis: `role="${role}" requires ${attr}`,
            rubric: [`Does the element have ${attr}?`],
            citations: [WCAG_412_URL],
          },
        };
      }
    }
    return null;
  },
};

/* ── aria-unsupported-elements ── */

const ariaUnsupportedElements: Rule = {
  meta: {
    id: 'aria-unsupported-elements',
    wcag: ['4.1.2'],
    level: 'A',
    severity: 'serious',
    confidence: 'certain',
    impact: ['screen_reader'],
    fixClass: 'SAFE_AUTOFIX',
    description: 'ARIA attributes should not be used on elements that do not support them.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (!UNSUPPORTED_ELEMENTS.has(elem.tag)) return null;

    const ariaAttrs = Object.keys(elem.attrs).filter(
      (a) => a.startsWith('aria-') || a === 'role',
    );
    if (ariaAttrs.length === 0) return null;

    return {
      message: `<${elem.tag}> does not support ARIA attributes: ${ariaAttrs.join(', ')}.`,
      elem,
      fix: (e: Elem) => ariaAttrs.map((a) => removeAttrEdit(e, a)),
    };
  },
};

/* ── no-access-key ── */

const noAccessKey: Rule = {
  meta: {
    id: 'no-access-key',
    wcag: ['2.1.4'],
    level: 'A',
    severity: 'moderate',
    confidence: 'certain',
    impact: ['keyboard'],
    fixClass: 'SAFE_AUTOFIX',
    description: 'accessKey creates unexpected keyboard shortcuts that conflict with assistive technology.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (!hasAttr(elem, 'accessKey') && !hasAttr(elem, 'accesskey')) return null;

    const attrName = hasAttr(elem, 'accessKey') ? 'accessKey' : 'accesskey';
    return {
      message: `<${elem.tag}> has ${attrName} attribute. Access keys create conflicts with assistive technology shortcuts.`,
      elem,
      fix: (e: Elem) => [removeAttrEdit(e, attrName)],
    };
  },
};

/* ── no-aria-hidden-on-body ── */

const noAriaHiddenOnBody: Rule = {
  meta: {
    id: 'no-aria-hidden-on-body',
    wcag: ['4.1.2'],
    level: 'A',
    severity: 'critical',
    confidence: 'certain',
    impact: ['screen_reader'],
    fixClass: 'SAFE_AUTOFIX',
    description: 'aria-hidden must not be set on the document body or html element.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (elem.tag !== 'body' && elem.tag !== 'html') return null;
    if (attrValue(elem, 'aria-hidden') !== 'true') return null;

    return {
      message: `<${elem.tag}> has aria-hidden="true". This hides the entire page from assistive technology.`,
      elem,
      fix: (e: Elem) => [removeAttrEdit(e, 'aria-hidden')],
    };
  },
};

/* ── input-image-missing-alt ── */

const inputImageMissingAlt: Rule = {
  meta: {
    id: 'input-image-missing-alt',
    wcag: ['1.1.1'],
    level: 'A',
    severity: 'critical',
    confidence: 'certain',
    impact: ['screen_reader'],
    fixClass: 'SUGGEST',
    description: 'Image inputs must have alt text.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (elem.tag !== 'input') return null;
    if (attrValue(elem, 'type') !== 'image') return null;
    if (hasAnyAttr(elem, ['alt', 'aria-label', 'aria-labelledby'])) return null;

    return {
      message: '<input type="image"> is missing alt text. Add alt, aria-label, or aria-labelledby.',
      elem,
      packet: {
        hypothesis: 'Image input has no accessible name',
        rubric: ['What action does this image button perform?'],
        citations: [WCAG_111_URL],
      },
    };
  },
};

/* ── area-missing-alt ── */

const areaMissingAlt: Rule = {
  meta: {
    id: 'area-missing-alt',
    wcag: ['1.1.1'],
    level: 'A',
    severity: 'serious',
    confidence: 'certain',
    impact: ['screen_reader'],
    fixClass: 'SUGGEST',
    description: 'Image map area elements must have alt text.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (elem.tag !== 'area') return null;
    if (hasAnyAttr(elem, ['alt', 'aria-label', 'aria-labelledby'])) return null;

    return {
      message: '<area> is missing alt text. Add alt or aria-label.',
      elem,
    };
  },
};

/* ── object-missing-text ── */

const objectMissingText: Rule = {
  meta: {
    id: 'object-missing-text',
    wcag: ['1.1.1'],
    level: 'A',
    severity: 'serious',
    confidence: 'high',
    impact: ['screen_reader'],
    fixClass: 'SUGGEST',
    description: 'Object elements must have accessible text.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (elem.tag !== 'object') return null;
    if (elem.hasTextContent) return null;
    if (hasAnyAttr(elem, ['aria-label', 'aria-labelledby', 'title'])) return null;

    return {
      message: '<object> is missing accessible text. Add text content, aria-label, or title.',
      elem,
    };
  },
};

/* ── svg-missing-title ── */

const svgMissingTitle: Rule = {
  meta: {
    id: 'svg-missing-title',
    wcag: ['1.1.1'],
    level: 'A',
    severity: 'serious',
    confidence: 'high',
    impact: ['screen_reader'],
    fixClass: 'SUGGEST',
    description: 'Inline SVGs with role="img" or without aria-hidden must have a title or aria-label.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (elem.tag !== 'svg') return null;

    // If aria-hidden="true", it's decorative — skip
    if (attrValue(elem, 'aria-hidden') === 'true') return null;

    // Has aria-label or aria-labelledby
    if (hasAnyAttr(elem, ['aria-label', 'aria-labelledby'])) return null;

    // Has <title> child
    if (elem.children.some((c) => c.tag === 'title')) return null;

    return {
      message: '<svg> is missing an accessible name. Add a <title> child, aria-label, or aria-hidden="true" if decorative.',
      elem,
    };
  },
};

/* ── abstract-role-used ── */

const abstractRoleUsed: Rule = {
  meta: {
    id: 'abstract-role-used',
    wcag: ['4.1.2'],
    level: 'A',
    severity: 'serious',
    confidence: 'certain',
    impact: ['screen_reader'],
    fixClass: 'SUGGEST',
    description: 'Abstract ARIA roles must not be used directly.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    const role = attrValue(elem, 'role');
    if (!role) return null;

    const roles = role.split(/\s+/).filter(Boolean);
    for (const r of roles) {
      if (ABSTRACT_ROLES.has(r)) {
        return {
          message: `Abstract role "${r}" must not be used directly. Use a concrete role instead.`,
          elem,
        };
      }
    }
    return null;
  },
};

/* ── no-nested-interactive ── */

function hasNestedInteractive(elem: Elem): Elem | null {
  for (const child of elem.children) {
    if (isInteractiveElem(child)) return child;
    const deeper = hasNestedInteractive(child);
    if (deeper) return deeper;
  }
  return null;
}

const noNestedInteractive: Rule = {
  meta: {
    id: 'no-nested-interactive',
    wcag: ['4.1.2'],
    level: 'A',
    severity: 'serious',
    confidence: 'certain',
    impact: ['screen_reader', 'keyboard'],
    fixClass: 'SUGGEST',
    description: 'Interactive elements must not be nested inside other interactive elements.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    // Only check buttons and anchor links as parents
    if (elem.tag !== 'button' && !(elem.tag === 'a' && hasAttr(elem, 'href'))) return null;

    const nested = hasNestedInteractive(elem);
    if (!nested) return null;

    return {
      message: `<${elem.tag}> contains nested interactive element <${nested.tag}>. Interactive elements must not be nested.`,
      elem,
    };
  },
};

/* ── Export ── */

export const aria2Rules: Rule[] = [
  ariaRequiredAttr,
  ariaUnsupportedElements,
  noAccessKey,
  noAriaHiddenOnBody,
  inputImageMissingAlt,
  areaMissingAlt,
  objectMissingText,
  svgMissingTitle,
  abstractRoleUsed,
  noNestedInteractive,
];
