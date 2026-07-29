import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ALLY_MCP_SERVER_INFO } from '@/lib/mcp-server-info';

describe('Ally MCP server identity', () => {
  it('publishes a branded PNG icon in the MCP initialize response', async () => {
    const server = new McpServer(ALLY_MCP_SERVER_INFO);
    const client = new Client({ name: 'ally-test-client', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    expect(client.getServerVersion()).toMatchObject({
      name: 'ally-remote-mcp',
      title: 'Ally MCP',
      icons: [
        {
          src: 'https://mcp-ally-server.vercel.app/ally-mcp-icon.png',
          mimeType: 'image/png',
          sizes: ['256x256'],
        },
      ],
    });

    await Promise.all([client.close(), server.close()]);
  });
});
