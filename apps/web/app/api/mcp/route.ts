import { createClient } from '@supabase/supabase-js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { scanSources } from '@ally/engine/scan-sources';
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { z } from 'zod';
import { createIngestDb } from '@/lib/ingest-db';
import { processIngest } from '@/lib/ingest';
import { hashApiKey } from '@/lib/keys';
import { searchWcagKnowledge } from '@/lib/knowledge';
import type { Database } from '@/lib/database.types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const readPlatform = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

const writePlatform = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

function getPlatformClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    throw new Error('Ally platform storage is not configured.');
  }
  return createClient<Database>(url, secret);
}

async function verifyAllyToken(
  _request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken?.startsWith('ally_sk_')) return undefined;

  const db = createIngestDb(getPlatformClient());
  const key = await db.findKeyOrg(hashApiKey(bearerToken));
  if (!key) return undefined;
  await db.touchKey(key.keyId);

  return {
    token: bearerToken,
    scopes: ['ally:use'],
    clientId: key.keyId,
    extra: {
      orgId: key.orgId,
      keyId: key.keyId,
    },
  };
}

const handler = createMcpHandler(
  (server) => {
    server.tool(
      'get_ally_health',
      'Check the authenticated Ally remote MCP server and its WCAG knowledge retrieval path',
      {},
      readPlatform,
      async () => {
        const started = performance.now();
        const knowledge = await searchWcagKnowledge(
          'WCAG 2.2 contrast minimum',
          { version: '2.2', levels: ['AA'], matchCount: 1 },
        );
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'healthy',
              transport: 'streamable_http',
              authentication: 'ally_api_key',
              knowledge: {
                status: 'healthy',
                mode: knowledge.mode,
                embeddingProvider: knowledge.embeddingProvider,
                latencyMs: Math.round(performance.now() - started),
              },
              capabilities: {
                knowledgeSearch: true,
                suppliedSourceScan: true,
                localFilesystemScan: false,
                runtimeBrowserScan: false,
              },
            }, null, 2),
          }],
        };
      },
    );

    server.tool(
      'search_wcag_knowledge',
      'Search Ally WCAG knowledge using metadata-filtered hybrid retrieval with lexical fallback',
      {
        query: z.string().min(1).max(2_000),
        version: z.string().max(20).optional(),
        levels: z.array(z.enum(['A', 'AA', 'AAA'])).max(3).optional(),
        matchCount: z.number().int().min(1).max(25).default(8).optional(),
      },
      readPlatform,
      async ({ query, version, levels, matchCount }) => {
        const result = await searchWcagKnowledge(query, {
          version,
          levels,
          matchCount: matchCount ?? 8,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      },
    );

    server.tool(
      'scan_source_files',
      'Scan supplied JSX, TSX, JavaScript, TypeScript, or HTML source and persist the report to the Ally dashboard',
      {
        projectName: z.string().trim().min(1).max(120),
        targetLevel: z.enum(['A', 'AA', 'AAA']).default('AA').optional(),
        ignoreRules: z.array(z.string().min(1).max(120)).max(100).optional(),
        files: z.array(z.object({
          path: z.string().min(1).max(500),
          content: z.string().max(200_000),
        })).min(1).max(100),
      },
      writePlatform,
      async ({ projectName, targetLevel, ignoreRules, files }, extra) => {
        const normalized = files.map((file) => ({
          path: file.path.replaceAll('\\', '/'),
          content: file.content,
        }));
        const invalidPath = normalized.find((file) => {
          const segments = file.path.split('/');
          return (
            file.path.startsWith('/') ||
            segments.includes('..') ||
            !/\.(?:html?|[cm]?[jt]sx?)$/i.test(file.path)
          );
        });
        if (invalidPath) {
          return {
            content: [{
              type: 'text',
              text: `Unsupported source path "${invalidPath.path}". Use a relative JS, JSX, TS, TSX, HTML, or HTM path without "..".`,
            }],
            isError: true,
          };
        }

        const totalBytes = normalized.reduce(
          (total, file) => total + Buffer.byteLength(file.content, 'utf8'),
          0,
        );
        if (totalBytes > 2_000_000) {
          return {
            content: [{
              type: 'text',
              text: 'The supplied source exceeds the 2 MB request limit. Split it into smaller scans.',
            }],
            isError: true,
          };
        }

        const report = await scanSources(projectName, normalized, {
          targetLevel: targetLevel ?? 'AA',
          ignoreRules: ignoreRules ?? [],
        });
        const rawKey = extra.authInfo?.token;
        const stored = await processIngest(
          createIngestDb(getPlatformClient()),
          rawKey ?? null,
          { projectName, report },
        );
        if (stored.status !== 201) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(stored.json, null, 2),
            }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              ...stored.json,
              report: {
                scanRef: report.scanId,
                summary: report.summary,
                findings: report.findings.slice(0, 50),
                findingsTruncated: report.findings.length > 50,
                reasoningPackets: report.packets.slice(0, 20),
                reasoningPacketsTruncated: report.packets.length > 20,
              },
            }, null, 2),
          }],
        };
      },
    );
  },
  {
    serverInfo: {
      name: 'ally-remote-mcp',
      version: '0.1.0',
    },
    instructions: [
      'Ally Remote is an API-key-authenticated accessibility brain.',
      'Use search_wcag_knowledge for grounded WCAG answers.',
      'To scan code, read the relevant local JSX, TSX, JavaScript, TypeScript, or HTML files and pass their relative paths and contents to scan_source_files; the result is persisted to the Ally dashboard.',
      'This remote server cannot read the client filesystem or launch the client application.',
      'Use Ally local stdio for automatic file discovery, Playwright runtime scans, and the stateful remediation harness.',
    ].join(' '),
  },
  {
    basePath: '/api',
    disableSse: true,
    maxDuration: 60,
    sessionIdGenerator: undefined,
  },
);

const authenticatedHandler = withMcpAuth(handler, verifyAllyToken, {
  required: true,
  requiredScopes: ['ally:use'],
});

export {
  authenticatedHandler as GET,
  authenticatedHandler as POST,
  authenticatedHandler as DELETE,
};
