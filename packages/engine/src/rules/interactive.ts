import type { Rule, FindingDraft, RuleCtx } from './index.js';
import type { Elem } from '../types.js';
import {
  hasAttr, attrValue, hasAnyAttr,
  isNativelyFocusable, INTERACTIVE_ROLES,
  insertAttrEdit, removeAttrEdit, replaceAttrValueEdit,
} from './helpers.js';

/* ── WCAG reference URLs ── */

const WCAG_211 = 'https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html';
const WCAG_243 = 'https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html';
const WCAG_321 = 'https://www.w3.org/WAI/WCAG22/Understanding/on-focus.html';
const WCAG_412 = 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html';
const WCAG_244 = 'https://www.w3.org/WAI/WCAG22/Understanding/link-purpose-in-context.html';
const WCAG_222 = 'https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html';

/* ── Helper predicates ── */

const CLICK_TARGETS = new Set(['div', 'span', 'section', 'li', 'td', 'img']);
const KEYBOARD_HANDLERS = ['onKeyDown', 'onKeyUp', 'onKeyPress'];
const NON_INTERACTIVE_TABINDEX_TAGS = new Set(['div', 'span', 'p', 'section', 'article', 'ul', 'li']);
const INVALID_HREFS = new Set(['#', 'javascript:void(0)', 'javascript:;']);

function hasInteractiveRole(e: Elem): boolean {
  const role = attrValue(e, 'role');
  return role !== null && (INTERACTIVE_ROLES as readonly string[]).includes(role);
}

function hasAncestorTag(e: Elem, tag: string): boolean {
  let cur = e.parent;
  while (cur) {
    if (cur.tag === tag) return true;
    cur = cur.parent;
  }
  return false;
}

/* ── click-without-keyboard ── */

const clickWithoutKeyboard: Rule = {
  meta: {
    id: 'click-without-keyboard',
    wcag: ['2.1.1'],
    level: 'A',
    severity: 'critical',
    confidence: 'high',
    impact: ['keyboard', 'screen_reader'],
    fixClass: 'SUGGEST',
    description: 'Elements with click handlers must also have keyboard event handlers.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (elem.lang !== 'jsx') return null;
    if (!CLICK_TARGETS.has(elem.tag)) return null;
    if (!hasAttr(elem, 'onClick')) return null;
    if (hasAnyAttr(elem, KEYBOARD_HANDLERS)) return null;
    if (hasInteractiveRole(elem)) return null;

    return {
      message: `<${elem.tag}> has onClick but no keyboard handler. Add onKeyDown or use a <button>.`,
      elem,
      packet: {
        hypothesis: 'Non-interactive element handles clicks but not keyboard events',
        rubric: [
          'Can the element be activated via keyboard?',
          'Would converting to <button> be appropriate?',
        ],
        citations: [WCAG_211],
      },
    };
  },
};

/* ── interactive-supports-focus ── */

const interactiveSupportsFocus: Rule = {
  meta: {
    id: 'interactive-supports-focus',
    wcag: ['2.1.1'],
    level: 'A',
    severity: 'critical',
    confidence: 'certain',
    impact: ['keyboard'],
    fixClass: 'SAFE_AUTOFIX',
    description: 'Elements with interactive ARIA roles must be focusable.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (!hasInteractiveRole(elem)) return null;
    if (isNativelyFocusable(elem)) return null;
    if (hasAttr(elem, 'tabindex')) return null;

    return {
      message: `<${elem.tag} role="${attrValue(elem, 'role')}"> has an interactive role but is not focusable. Add tabIndex={0}.`,
      elem,
      fix: (e: Elem) => [insertAttrEdit(e, 'tabIndex={0}')],
    };
  },
};

/* ── tabindex-positive ── */

const tabindexPositive: Rule = {
  meta: {
    id: 'tabindex-positive',
    wcag: ['2.4.3'],
    level: 'A',
    severity: 'serious',
    confidence: 'certain',
    impact: ['keyboard'],
    fixClass: 'SAFE_AUTOFIX',
    description: 'Avoid positive tabindex values; they disrupt natural tab order.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    // Parser normalizes tabIndex -> tabindex
    if (!hasAttr(elem, 'tabindex')) return null;

    const val = attrValue(elem, 'tabindex');
    if (val === null) return null;

    const n = parseInt(val, 10);
    if (isNaN(n) || n <= 0) return null;

    return {
      message: `tabindex="${val}" disrupts natural tab order. Use tabindex="0" instead.`,
      elem,
      fix: (e: Elem) => [replaceAttrValueEdit(e, 'tabindex', '0')],
    };
  },
};

/* ── no-autofocus ── */

const noAutofocus: Rule = {
  meta: {
    id: 'no-autofocus',
    wcag: ['3.2.1'],
    level: 'A',
    severity: 'moderate',
    confidence: 'certain',
    impact: ['low_vision', 'cognitive', 'screen_reader'],
    fixClass: 'SAFE_AUTOFIX',
    description: 'Avoid autofocus; it causes unexpected focus changes for assistive technology users.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    // JSX uses autoFocus, HTML uses autofocus
    const attrName = hasAttr(elem, 'autoFocus') ? 'autoFocus' : hasAttr(elem, 'autofocus') ? 'autofocus' : null;
    if (!attrName) return null;

    return {
      message: `<${elem.tag}> uses ${attrName}. This can disorient users of assistive technology.`,
      elem,
      fix: (e: Elem) => [removeAttrEdit(e, attrName)],
    };
  },
};

/* ── noninteractive-tabindex ── */

const noninteractiveTabindex: Rule = {
  meta: {
    id: 'noninteractive-tabindex',
    wcag: ['2.4.3'],
    level: 'A',
    severity: 'moderate',
    confidence: 'high',
    impact: ['keyboard'],
    fixClass: 'SUGGEST',
    description: 'Non-interactive elements should not have tabindex >= 0.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (!NON_INTERACTIVE_TABINDEX_TAGS.has(elem.tag)) return null;
    if (hasInteractiveRole(elem)) return null;
    if (hasAttr(elem, 'onClick')) return null;

    if (!hasAttr(elem, 'tabindex')) return null;

    const val = attrValue(elem, 'tabindex');
    if (val === null) return null;

    const n = parseInt(val, 10);
    if (isNaN(n) || n < 0) return null;

    return {
      message: `Non-interactive <${elem.tag}> should not have tabindex="${val!}". Remove tabindex or add an interactive role.`,
      elem,
    };
  },
};

/* ── mouse-events-need-focus-events ── */

const mouseEventsNeedFocusEvents: Rule = {
  meta: {
    id: 'mouse-events-need-focus-events',
    wcag: ['2.1.1'],
    level: 'A',
    severity: 'moderate',
    confidence: 'high',
    impact: ['keyboard'],
    fixClass: 'SUGGEST',
    description: 'Mouse event handlers must have corresponding focus event handlers.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (elem.lang !== 'jsx') return null;

    const issues: string[] = [];

    if (hasAttr(elem, 'onMouseOver') && !hasAttr(elem, 'onFocus')) {
      issues.push('onMouseOver without onFocus');
    }
    if (hasAttr(elem, 'onMouseOut') && !hasAttr(elem, 'onBlur')) {
      issues.push('onMouseOut without onBlur');
    }

    if (issues.length === 0) return null;

    return {
      message: `<${elem.tag}> has ${issues.join(' and ')}. Keyboard users need equivalent focus events.`,
      elem,
    };
  },
};

/* ── anchor-is-valid ── */

const anchorIsValid: Rule = {
  meta: {
    id: 'anchor-is-valid',
    wcag: ['4.1.2'],
    level: 'A',
    severity: 'serious',
    confidence: 'certain',
    impact: ['keyboard', 'screen_reader'],
    fixClass: 'SUGGEST',
    description: 'Anchors must have a valid href. Use a <button> for click-only actions.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (elem.tag !== 'a') return null;

    const href = attrValue(elem, 'href');
    const hasHrefAttr = hasAttr(elem, 'href');
    const hasOnClick = hasAttr(elem, 'onClick');

    // No href at all with onClick -> invalid
    if (!hasHrefAttr && hasOnClick) {
      return makeAnchorDraft(elem, 'Anchor has onClick but no href. Use a <button> instead.');
    }

    // href is an invalid placeholder with onClick
    if (href !== null && INVALID_HREFS.has(href) && hasOnClick) {
      return makeAnchorDraft(elem, `Anchor has href="${href}" with onClick. Use a <button> instead.`);
    }

    return null;
  },
};

function makeAnchorDraft(elem: Elem, message: string): FindingDraft {
  return {
    message,
    elem,
    packet: {
      hypothesis: 'Anchor is used as a button rather than a navigation link',
      rubric: [
        'Does this element navigate to a URL or trigger an action?',
        'If action-only, should it be a <button>?',
      ],
      citations: [WCAG_412],
    },
  };
}

/* ── anchor-has-content ── */

const anchorHasContent: Rule = {
  meta: {
    id: 'anchor-has-content',
    wcag: ['2.4.4'],
    level: 'A',
    severity: 'serious',
    confidence: 'certain',
    impact: ['screen_reader'],
    fixClass: 'NEEDS_HUMAN',
    description: 'Anchors must have discernible text content or an accessible label.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (elem.tag !== 'a') return null;

    if (elem.hasTextContent) return null;
    if (hasAttr(elem, 'aria-label')) return null;
    if (hasAttr(elem, 'aria-labelledby')) return null;
    if (hasAttr(elem, 'title')) return null;

    return {
      message: 'Anchor has no discernible text. Add text content, aria-label, or title.',
      elem,
    };
  },
};

/* ── button-missing-type ── */

const buttonMissingType: Rule = {
  meta: {
    id: 'button-missing-type',
    wcag: ['4.1.2'],
    level: 'A',
    severity: 'minor',
    confidence: 'certain',
    impact: ['keyboard'],
    fixClass: 'SAFE_AUTOFIX',
    description: 'Buttons should have an explicit type attribute to avoid unintended form submissions.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (elem.tag !== 'button') return null;
    if (elem.lang !== 'jsx') return null;
    if (hasAttr(elem, 'type')) return null;

    // Exempt if inside a <form> ancestor
    if (hasAncestorTag(elem, 'form')) return null;

    return {
      message: '<button> is missing a type attribute. Add type="button" to prevent unintended form submission.',
      elem,
      fix: (e: Elem) => [insertAttrEdit(e, 'type="button"')],
    };
  },
};

/* ── no-distracting-elements ── */

const noDistractingElements: Rule = {
  meta: {
    id: 'no-distracting-elements',
    wcag: ['2.2.2'],
    level: 'A',
    severity: 'serious',
    confidence: 'certain',
    impact: ['cognitive', 'low_vision'],
    fixClass: 'SUGGEST',
    description: '<marquee> and <blink> elements are distracting and should not be used.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    if (elem.tag !== 'marquee' && elem.tag !== 'blink') return null;

    return {
      message: `<${elem.tag}> is distracting and deprecated. Replace with static content or CSS animations with prefers-reduced-motion.`,
      elem,
    };
  },
};

/* ── Export all interactive rules ── */

export const interactiveRules: Rule[] = [
  clickWithoutKeyboard,
  interactiveSupportsFocus,
  tabindexPositive,
  noAutofocus,
  noninteractiveTabindex,
  mouseEventsNeedFocusEvents,
  anchorIsValid,
  anchorHasContent,
  buttonMissingType,
  noDistractingElements,
];
