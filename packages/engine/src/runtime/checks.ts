/**
 * Custom runtime accessibility checks that go beyond axe-core.
 * These require a live Playwright Page instance.
 */

import type { Finding, Severity } from '@ally/shared';
import { fingerprintOf } from '../fingerprint.js';

/** Minimal Page interface so we don't import playwright at module level */
interface PageLike {
  url(): string;
  evaluate<R>(fn: string | (() => R)): Promise<R>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evaluate<R>(fn: (arg: any) => R, arg: any): Promise<R>;
  keyboard: { press(key: string): Promise<void> };
}

function makeFinding(
  ruleId: string,
  severity: Severity,
  message: string,
  snippet: string,
  pageUrl: string,
): Finding {
  return {
    fingerprint: fingerprintOf(ruleId, pageUrl, pageUrl, snippet),
    ruleId,
    wcag: ruleId === 'runtime/not-keyboard-reachable' ? ['2.1.1'] :
          ruleId === 'runtime/focus-not-visible' ? ['2.4.7'] :
          ['2.5.8'],
    level: 'AA',
    severity,
    confidence: 'certain',
    impact: ruleId === 'runtime/target-too-small' ? ['motor'] : ['keyboard'],
    message,
    location: { file: pageUrl, startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
    snippet,
    clusterKey: pageUrl,
    fixClass: 'NEEDS_HUMAN',
    pass: 2,
    status: 'open',
  };
}

/**
 * Check 1: Tab-walk to find interactive elements that are not keyboard reachable.
 */
async function checkKeyboardReachable(page: PageLike): Promise<Finding[]> {
  const url = page.url();

  // Get all interactive elements
  const interactiveSelectors = await page.evaluate(() => {
    const els = document.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex], [role="button"], [role="link"], [role="checkbox"], [role="radio"], [contenteditable="true"]'
    );
    return Array.from(els).map((el) => ({
      tag: el.tagName.toLowerCase(),
      html: el.outerHTML.slice(0, 200),
      tabindex: el.getAttribute('tabindex'),
    }));
  });

  const findings: Finding[] = [];

  for (const el of interactiveSelectors) {
    // Elements with tabindex="-1" are programmatically focusable but not keyboard-reachable
    if (el.tabindex === '-1') {
      findings.push(
        makeFinding(
          'runtime/not-keyboard-reachable',
          'critical',
          `Interactive element <${el.tag}> has tabindex="-1" and cannot be reached via keyboard navigation.`,
          el.html,
          url,
        ),
      );
    }
  }

  return findings;
}

/**
 * Check 2: Focus indicator visibility — elements with outline:none/0 and no box-shadow.
 */
async function checkFocusVisible(page: PageLike): Promise<Finding[]> {
  const url = page.url();

  const noFocusEls = await page.evaluate(() => {
    const els = document.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"]'
    );
    const results: { html: string; tag: string }[] = [];

    for (const el of Array.from(els)) {
      const styles = window.getComputedStyle(el, ':focus');
      const outline = styles.outlineStyle;
      const outlineWidth = parseFloat(styles.outlineWidth) || 0;
      const boxShadow = styles.boxShadow;

      // Check if element explicitly hides focus
      if (
        (outline === 'none' || outlineWidth === 0) &&
        (boxShadow === 'none' || !boxShadow)
      ) {
        results.push({
          html: el.outerHTML.slice(0, 200),
          tag: el.tagName.toLowerCase(),
        });
      }
    }
    return results;
  });

  return noFocusEls.map((el) =>
    makeFinding(
      'runtime/focus-not-visible',
      'serious',
      `Interactive element <${el.tag}> has no visible focus indicator (outline:none, no box-shadow).`,
      el.html,
      url,
    ),
  );
}

/**
 * Check 3: Target size — interactive elements smaller than 24x24px.
 */
async function checkTargetSize(page: PageLike): Promise<Finding[]> {
  const url = page.url();

  const smallEls = await page.evaluate(() => {
    const els = document.querySelectorAll(
      'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="radio"]'
    );
    const results: { html: string; tag: string; w: number; h: number }[] = [];

    for (const el of Array.from(els)) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && (rect.width < 24 || rect.height < 24)) {
        results.push({
          html: el.outerHTML.slice(0, 200),
          tag: el.tagName.toLowerCase(),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        });
      }
    }
    return results;
  });

  return smallEls.map((el) =>
    makeFinding(
      'runtime/target-too-small',
      'moderate',
      `Interactive element <${el.tag}> is ${el.w}x${el.h}px, below the 24x24px minimum target size.`,
      el.html,
      url,
    ),
  );
}

/**
 * Run all custom runtime checks on a Playwright page.
 */
export async function runCustomChecks(page: PageLike): Promise<Finding[]> {
  const [keyboard, focus, target] = await Promise.all([
    checkKeyboardReachable(page),
    checkFocusVisible(page),
    checkTargetSize(page),
  ]);
  return [...keyboard, ...focus, ...target];
}
