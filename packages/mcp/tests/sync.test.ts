import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pushReport } from '../src/sync.js';
import { zScanIngest } from '@ally/shared';
import type { ScanReport } from '@ally/shared';

function makeFakeReport(): ScanReport {
  return {
    scanId: 'scan_test1234',
    createdAt: new Date().toISOString(),
    projectName: 'test-project',
    target: { root: '/tmp/test', files: 2 },
    toolVersion: '0.1.0',
    findings: [],
    packets: [],
    summary: {
      total: 0,
      bySeverity: { blocker: 0, critical: 0, serious: 0, moderate: 0, minor: 0 },
      byLevel: { A: 0, AA: 0, AAA: 0 },
      clusters: [],
      score: 100,
    },
  };
}

describe('pushReport', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"ok":true}', { status: 200 }),
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('sends correct URL, bearer header, and valid zScanIngest body', async () => {
    const report = makeFakeReport();
    const result = await pushReport(report, {
      apiKey: 'test-key-123',
      baseUrl: 'https://ally.example.com',
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ally.example.com/api/v1/scans');
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer test-key-123');

    // Validate body against zScanIngest
    const body = JSON.parse(opts.body as string);
    expect(() => zScanIngest.parse(body)).not.toThrow();
    expect(body.projectName).toBe('test-project');
  });
});

describe('sync_report tool — missing API key', () => {
  it('returns setup hint when env vars missing', async () => {
    // Import server setup
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
    const { buildServer } = await import('../src/server.js');
    const { createState } = await import('../src/state.js');
    const { resolve } = await import('node:path');

    const FIXTURE_ROOT = resolve(import.meta.dirname, '../../engine/tests/fixtures/project');

    // Clear env
    const origKey = process.env['ALLY_API_KEY'];
    const origUrl = process.env['ALLY_API_URL'];
    delete process.env['ALLY_API_KEY'];
    delete process.env['ALLY_API_URL'];

    try {
      const state = createState();
      const server = buildServer(state);
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await server.connect(serverTransport);
      const client = new Client({ name: 'test-client', version: '0.1.0' });
      await client.connect(clientTransport);

      await client.callTool({ name: 'scan_project', arguments: { path: FIXTURE_ROOT } });
      const result = await client.callTool({ name: 'sync_report', arguments: {} });
      const text = (result.content as Array<{ type: string; text: string }>)[0].text;
      expect(text).toContain('Missing');
      expect(text).toContain('ALLY_API_KEY');
    } finally {
      if (origKey) process.env['ALLY_API_KEY'] = origKey;
      if (origUrl) process.env['ALLY_API_URL'] = origUrl;
    }
  });
});
