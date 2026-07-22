import { describe, it, expect, vi } from 'vitest';

/**
 * Runtime scan tests.
 * The runtime-gated tests only run when ALLY_RUNTIME_TESTS=1
 * (requires playwright + axe-core installed with browsers).
 * The non-gated test verifies graceful failure without playwright.
 */

describe('runtimeScan – no playwright', () => {
  it('rejects with install hint when playwright is missing', async () => {
    // Mock the dynamic import to simulate playwright not installed
    vi.doMock('playwright', () => {
      throw new Error('Cannot find module');
    });

    // Re-import to pick up the mock
    const { runtimeScan } = await import('../src/runtime/scan.js');
    await expect(runtimeScan('http://localhost:9999')).rejects.toThrow(
      /Playwright is not installed/,
    );

    vi.doUnmock('playwright');
  });
});

describe.skipIf(!process.env.ALLY_RUNTIME_TESTS)('runtimeScan – live', () => {
  it('scans a local HTML file and returns axe findings', async () => {
    const { runtimeScan } = await import('../src/runtime/scan.js');
    const { resolve } = await import('node:path');
    const fileUrl = `file://${resolve(__dirname, 'fixtures/runtime/page.html')}`;

    const findings = await runtimeScan(fileUrl, { timeoutMs: 15_000 });

    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.pass === 2)).toBe(true);
    expect(findings.every((f) => f.ruleId.startsWith('axe/'))).toBe(true);
    expect(findings.every((f) => f.confidence === 'certain')).toBe(true);

    // Should find the missing-alt image
    const imgAlt = findings.find((f) => f.ruleId === 'axe/image-alt');
    expect(imgAlt).toBeDefined();

    // Should find missing lang on <html>
    const htmlLang = findings.find((f) => f.ruleId === 'axe/html-has-lang');
    expect(htmlLang).toBeDefined();
  });

  it('runs custom checks on a page', async () => {
    const pw = await import('playwright');
    const { runCustomChecks } = await import('../src/runtime/checks.js');
    const { resolve } = await import('node:path');
    const fileUrl = `file://${resolve(__dirname, 'fixtures/runtime/page.html')}`;

    const browser = await pw.chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });

      const findings = await runCustomChecks(page);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings.every((f) => f.pass === 2)).toBe(true);

      // Should find the unreachable element (tabindex=-1)
      const unreachable = findings.find((f) => f.ruleId === 'runtime/not-keyboard-reachable');
      expect(unreachable).toBeDefined();

      // Should find the small button
      const small = findings.find((f) => f.ruleId === 'runtime/target-too-small');
      expect(small).toBeDefined();
    } finally {
      await browser.close();
    }
  });
});
