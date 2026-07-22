import type { Rule, FindingDraft, RuleCtx } from './index.js';
import type { Elem } from '../types.js';
import {
  attrValue, hasAttr, isNativelyFocusable,
  ARIA_ROLES, ARIA_PROPS,
  removeAttrEdit,
} from './helpers.js';

/* ── WCAG reference URLs ── */

const WCAG_412_URL = 'https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html';

/* ── Closest ARIA role / prop suggestion (Levenshtein) ── */

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

export function closestAriaRole(name: string): string | null {
  let best = '';
  let bestDist = Infinity;
  for (const role of ARIA_ROLES) {
    const d = levenshtein(name, role);
    if (d < bestDist) {
      bestDist = d;
      best = role;
    }
  }
  return bestDist <= 3 ? best : null;
}

export function closestAriaProp(name: string): string | null {
  let best = '';
  let bestDist = Infinity;
  for (const prop of ARIA_PROPS) {
    const d = levenshtein(name, prop);
    if (d < bestDist) {
      bestDist = d;
      best = prop;
    }
  }
  return bestDist <= 3 ? best : null;
}

/* ── Implicit role map for no-redundant-role ── */

const IMPLICIT_ROLES: Record<string, string | ((e: Elem) => string | null)> = {
  button: 'button',
  a: (e) => hasAttr(e, 'href') ? 'link' : null,
  img: 'img',
  nav: 'navigation',
  main: 'main',
  header: 'banner',
  footer: 'contentinfo',
  ul: 'list',
  ol: 'list',
  li: 'listitem',
};

function getImplicitRole(e: Elem): string | null {
  const entry = IMPLICIT_ROLES[e.tag];
  if (!entry) return null;
  if (typeof entry === 'function') return entry(e);
  return entry;
}

/* ── aria-role-valid ── */

const ariaRoleValid: Rule = {
  meta: {
    id: 'aria-role-valid',
    wcag: ['4.1.2'],
    level: 'A',
    severity: 'critical',
    confidence: 'certain',
    impact: ['screen_reader'],
    fixClass: 'SUGGEST',
    description: 'The role attribute must use a valid ARIA role value.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    const role = attrValue(elem, 'role');
    if (role === null) return null;

    const roles = role.split(/\s+/).filter(Boolean);
    for (const r of roles) {
      if (!(ARIA_ROLES as readonly string[]).includes(r)) {
        const suggestion = closestAriaRole(r);
        const hint = suggestion ? ` Did you mean "${suggestion}"?` : '';
        return {
          message: `Invalid ARIA role "${r}".${hint}`,
          elem,
          packet: {
            hypothesis: `role="${r}" is not a valid WAI-ARIA role`,
            rubric: ['Is the role value in the WAI-ARIA role taxonomy?'],
            citations: [WCAG_412_URL],
          },
        };
      }
    }
    return null;
  },
};

/* ── aria-props-valid ── */

const ariaPropsValid: Rule = {
  meta: {
    id: 'aria-props-valid',
    wcag: ['4.1.2'],
    level: 'A',
    severity: 'critical',
    confidence: 'certain',
    impact: ['screen_reader'],
    fixClass: 'SUGGEST',
    description: 'ARIA attributes must be valid (correctly spelled).',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    for (const name of Object.keys(elem.attrs)) {
      if (!name.startsWith('aria-')) continue;
      if ((ARIA_PROPS as readonly string[]).includes(name)) continue;

      const suggestion = closestAriaProp(name);
      const hint = suggestion ? ` Did you mean "${suggestion}"?` : '';
      return {
        message: `Invalid ARIA attribute "${name}".${hint}`,
        elem,
        packet: {
          hypothesis: `"${name}" is not a valid ARIA attribute`,
          rubric: ['Is the attribute in the WAI-ARIA states/properties spec?'],
          citations: [WCAG_412_URL],
        },
      };
    }
    return null;
  },
};

/* ── aria-hidden-on-focusable ── */

const ariaHiddenOnFocusable: Rule = {
  meta: {
    id: 'aria-hidden-on-focusable',
    wcag: ['4.1.2'],
    level: 'A',
    severity: 'critical',
    confidence: 'certain',
    impact: ['screen_reader'],
    fixClass: 'SUGGEST',
    description: 'Elements with aria-hidden="true" must not be focusable.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    const ariaHidden = attrValue(elem, 'aria-hidden');
    if (ariaHidden !== 'true') return null;
    if (!isNativelyFocusable(elem)) return null;

    return {
      message: `Element <${elem.tag}> has aria-hidden="true" but is focusable. Remove aria-hidden or make it non-focusable.`,
      elem,
      packet: {
        hypothesis: 'Focusable element hidden from assistive tech creates a trap',
        rubric: [
          'Is the element keyboard-reachable?',
          'Should it be removed from tab order or have aria-hidden removed?',
        ],
        citations: [WCAG_412_URL],
      },
    };
  },
};

/* ── no-redundant-role ── */

const noRedundantRole: Rule = {
  meta: {
    id: 'no-redundant-role',
    wcag: ['4.1.2'],
    level: 'A',
    severity: 'minor',
    confidence: 'certain',
    impact: ['screen_reader'],
    fixClass: 'SAFE_AUTOFIX',
    description: 'Elements should not have an explicit ARIA role that matches their implicit role.',
  },
  check(elem: Elem, _ctx: RuleCtx): FindingDraft | null {
    const role = attrValue(elem, 'role');
    if (role === null) return null;

    const implicit = getImplicitRole(elem);
    if (implicit === null) return null;
    if (role !== implicit) return null;

    return {
      message: `<${elem.tag}> has implicit role "${implicit}"; explicit role="${role}" is redundant.`,
      elem,
      fix: (e: Elem) => [removeAttrEdit(e, 'role')],
    };
  },
};

/* ── Export all ARIA rules ── */

export const ariaRules: Rule[] = [
  ariaRoleValid,
  ariaPropsValid,
  ariaHiddenOnFocusable,
  noRedundantRole,
];
