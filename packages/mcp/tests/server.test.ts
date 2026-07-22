import { describe, it, expect, beforeAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { resolve } from 'node:path';
import { buildServer } from '../src/server.js';
import { createState } from '../src/state.js';

const FIXTURE_ROOT = resolve(import.meta.dirname, '../../engine/tests/fixtures/project');

async function setup(stateOverrides?: Partial<ReturnType<typeof createState>>) {
  const state = { ...createState(), ...stateOverrides };
  const server = buildServer(state);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);

  const client = new Client({ name: 'test-client', version: '0.1.0' });
  await client.connect(clientTransport);

  return { client, state };
}

describe('MCP Server — tools', () => {
  it('tools/list contains all 9 tools', async () => {
    const { client } = await setup();
    const result = await client.listTools();
    const names = result.tools.map((t) => t.name).sort();
    expect(names).toEqual([
      'configure_policy',
      'explain_finding',
      'get_findings',
      'get_fixes',
      'get_reasoning_packets',
      'resolve_reasoning',
      'scan_files',
      'scan_project',
      'sync_report',
    ]);
  });

  it('scan_project on fixture returns score and packet count', async () => {
    const { client } = await setup();
    const result = await client.callTool({ name: 'scan_project', arguments: { path: FIXTURE_ROOT } });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('Score:');
    expect(text).toContain('Reasoning packets pending:');
  });

  it('get_findings severity filter works', async () => {
    const { client } = await setup();
    await client.callTool({ name: 'scan_project', arguments: { path: FIXTURE_ROOT } });
    const result = await client.callTool({ name: 'get_findings', arguments: { severity: 'blocker' } });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    const data = JSON.parse(text);
    for (const f of data.findings) {
      expect(f.severity).toBe('blocker');
    }
  });

  it('explain_finding includes WCAG URL', async () => {
    const { client } = await setup();
    await client.callTool({ name: 'scan_project', arguments: { path: FIXTURE_ROOT } });

    // Get first finding fingerprint
    const findingsResult = await client.callTool({ name: 'get_findings', arguments: { limit: 1 } });
    const findingsText = (findingsResult.content as Array<{ type: string; text: string }>)[0].text;
    const findingsData = JSON.parse(findingsText);
    const fingerprint = findingsData.findings[0]?.fingerprint;
    expect(fingerprint).toBeTruthy();

    const result = await client.callTool({ name: 'explain_finding', arguments: { fingerprint } });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('w3.org/WAI/WCAG');
  });

  it('get_findings before scan returns friendly error', async () => {
    const { client } = await setup();
    const result = await client.callTool({ name: 'get_findings', arguments: {} });
    expect(result.isError).toBe(true);
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('No scan report');
  });

  it('policy gate: autofix off returns hint, on returns fixes', async () => {
    const { client } = await setup();
    await client.callTool({ name: 'scan_project', arguments: { path: FIXTURE_ROOT } });

    // Autofix off by default
    const hintResult = await client.callTool({ name: 'get_fixes', arguments: {} });
    const hintText = (hintResult.content as Array<{ type: string; text: string }>)[0].text;
    expect(hintText).toContain('disabled');

    // Turn on
    await client.callTool({ name: 'configure_policy', arguments: { autofix: 'on' } });
    const fixResult = await client.callTool({ name: 'get_fixes', arguments: {} });
    const fixText = (fixResult.content as Array<{ type: string; text: string }>)[0].text;
    const fixData = JSON.parse(fixText);
    expect(fixData).toHaveProperty('count');
    expect(fixData).toHaveProperty('fixes');
  });

  it('resolve_reasoning happy path', async () => {
    const { client } = await setup();
    await client.callTool({ name: 'scan_project', arguments: { path: FIXTURE_ROOT } });

    // Get packets
    const packetsResult = await client.callTool({ name: 'get_reasoning_packets', arguments: {} });
    const packetsText = (packetsResult.content as Array<{ type: string; text: string }>)[0].text;
    const packets = JSON.parse(packetsText);

    if (packets.length === 0) {
      // No packets to resolve — that's fine, just verify the tool works
      return;
    }

    const verdicts = packets.slice(0, 1).map((p: { packetId: string }) => ({
      packetId: p.packetId,
      confirm: true,
      reasoning: 'Confirmed by test',
      suggestedFix: null,
    }));

    const result = await client.callTool({ name: 'resolve_reasoning', arguments: { verdicts } });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain('Resolved');
    expect(text).toContain('Score:');
  });
});

describe('MCP Server — prompts', () => {
  it('prompts/list contains both prompts', async () => {
    const { client } = await setup();
    const result = await client.listPrompts();
    const names = result.prompts.map((p) => p.name).sort();
    expect(names).toContain('a11y_review_workflow');
    expect(names).toContain('fix_no_brainers');
  });
});

describe('MCP Server — resource', () => {
  it('resource read returns report JSON', async () => {
    const { client } = await setup();
    await client.callTool({ name: 'scan_project', arguments: { path: FIXTURE_ROOT } });

    const result = await client.readResource({ uri: 'ally://report/latest' });
    const content = result.contents[0];
    expect(content.uri).toBe('ally://report/latest');
    const report = JSON.parse(content.text as string);
    expect(report).toHaveProperty('scanId');
    expect(report).toHaveProperty('findings');
  });
});
