/**
 * Pass 2: Runtime scanning via Playwright + axe-core.
 * Playwright and axe-core are optional peer dependencies — the engine
 * loads and works without them.  If they are missing, runtimeScan()
 * throws a clear error message.
 */

import type { Finding, Severity, WcagLevel, Modality } from '@ally/shared';
import { fingerprintOf } from '../fingerprint.js';

export interface RuntimeScanOpts {
  timeoutMs?: number;
}

/* ---------- axe severity → ally severity ---------- */
const AXE_SEVERITY: Record<string, Severity> = {
  critical: 'blocker',
  serious: 'critical',
  moderate: 'serious',
  minor: 'moderate',
};

/* ---------- axe tag → wcag SC ---------- */
function wcagFromTags(tags: string[]): string[] {
  // axe tags like "wcag2a", "wcag2aa", "wcag111", "wcag412"
  return tags
    .filter((t) => /^wcag\d{3,}$/.test(t))
    .map((t) => {
      const digits = t.slice(4); // e.g. "111" → "1.1.1"
      return digits.split('').join('.');
    });
}

function levelFromTags(tags: string[]): WcagLevel {
  if (tags.includes('wcag2aaa')) return 'AAA';
  if (tags.includes('wcag2aa') || tags.includes('wcag21aa') || tags.includes('wcag22aa')) return 'AA';
  return 'A';
}

function impactModalities(tags: string[]): Modality[] {
  const mods: Modality[] = [];
  if (tags.some((t) => t.includes('aria') || t.includes('name'))) mods.push('screen_reader');
  if (tags.some((t) => t.includes('keyboard'))) mods.push('keyboard');
  if (tags.some((t) => t.includes('color') || t.includes('contrast'))) mods.push('low_vision');
  if (mods.length === 0) mods.push('screen_reader');
  return mods;
}

export async function runtimeScan(
  url: string,
  opts?: RuntimeScanOpts,
): Promise<Finding[]> {
  const timeoutMs = opts?.timeoutMs ?? 30_000;

  /* Dynamic import — fails gracefully when playwright is not installed */
  const pw = await import('playwright').catch(() => null);
  if (!pw) {
    throw new Error(
      'Playwright is not installed. Run `pnpm add -D playwright && npx playwright install chromium` to enable runtime scanning.',
    );
  }

  const axeSource: string = await import('axe-core').then(
    (m) => (m.default as { source: string }).source ?? (m as unknown as { source: string }).source,
  ).catch(() => {
    throw new Error(
      'axe-core is not installed. Run `pnpm add -D axe-core` to enable runtime scanning.',
    );
  });

  const browser = await pw.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { timeout: timeoutMs, waitUntil: 'domcontentloaded' });

    /* Inject axe-core and run */
    await page.evaluate(axeSource);
    const results = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).axe.run(document, { resultTypes: ['violations'] });
    });

    const findings: Finding[] = [];

    for (const violation of results.violations) {
      const severity = AXE_SEVERITY[violation.impact ?? 'minor'] ?? 'moderate';
      const wcag = wcagFromTags(violation.tags);
      const level = levelFromTags(violation.tags);
      const impact = impactModalities(violation.tags);

      for (const node of violation.nodes) {
        const snippet = (node.html as string).slice(0, 300);
        const ruleId = `axe/${violation.id}`;
        const fp = fingerprintOf(ruleId, url, url, snippet);

        findings.push({
          fingerprint: fp,
          ruleId,
          wcag,
          level,
          severity,
          confidence: 'certain',
          impact,
          message: violation.help,
          location: { file: url, startLine: 0, startCol: 0, endLine: 0, endCol: 0 },
          snippet,
          clusterKey: url,
          fixClass: 'NEEDS_HUMAN',
          pass: 2,
          status: 'open',
        });
      }
    }

    return findings;
  } finally {
    await browser.close();
  }
}
