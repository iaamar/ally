import { describe, it, expect, vi } from 'vitest';
import { processIngest, type IngestDb } from '@/lib/ingest';

function makeFakeDb(overrides: Partial<IngestDb> = {}): IngestDb {
  return {
    findKeyOrg: vi.fn().mockResolvedValue(null),
    touchKey: vi.fn().mockResolvedValue(undefined),
    upsertProject: vi.fn().mockResolvedValue({ id: 'proj-1' }),
    insertScan: vi.fn().mockResolvedValue({ id: 'scan-1' }),
    insertFindings: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const sampleReport = {
  scanId: 'scan-abc',
  createdAt: '2026-01-01T00:00:00Z',
  projectName: 'my-app',
  target: { root: '/src', files: 10 },
  toolVersion: '0.1.0',
  findings: [
    {
      fingerprint: 'fp1',
      ruleId: 'img-alt',
      wcag: ['1.1.1'],
      level: 'A' as const,
      severity: 'critical' as const,
      confidence: 'certain' as const,
      impact: ['screen_reader' as const],
      message: 'Missing alt text',
      location: { file: 'src/App.tsx', startLine: 10, startCol: 1, endLine: 10, endCol: 20 },
      snippet: '<img src="logo.png" />',
      clusterKey: 'img-alt',
      fixClass: 'SAFE_AUTOFIX' as const,
      pass: 1 as const,
    },
  ],
  packets: [],
  summary: {
    total: 1,
    bySeverity: { blocker: 0, critical: 1, serious: 0, moderate: 0, minor: 0 },
    byLevel: { A: 1, AA: 0, AAA: 0 },
    clusters: [{ clusterKey: 'img-alt', count: 1, ruleIds: ['img-alt'] }],
    score: 80,
  },
};

describe('processIngest', () => {
  it('returns 401 when key is null', async () => {
    const db = makeFakeDb();
    const result = await processIngest(db, null, { projectName: 'test', report: sampleReport });
    expect(result.status).toBe(401);
    expect(result.json).toEqual({ error: 'invalid api key' });
    expect(db.insertScan).not.toHaveBeenCalled();
    expect(db.insertFindings).not.toHaveBeenCalled();
  });

  it('returns 401 when key hash not found', async () => {
    const db = makeFakeDb();
    const result = await processIngest(db, 'ally_sk_badkey', { projectName: 'test', report: sampleReport });
    expect(result.status).toBe(401);
    expect(result.json).toEqual({ error: 'invalid api key' });
  });

  it('returns 400 for malformed body', async () => {
    const db = makeFakeDb({
      findKeyOrg: vi.fn().mockResolvedValue({ orgId: 'org-1', keyId: 'key-1' }),
    });
    const result = await processIngest(db, 'ally_sk_validkey', { bad: 'data' });
    expect(result.status).toBe(400);
    expect((result.json as { issues: unknown[] }).issues).toBeDefined();
    expect(Array.isArray((result.json as { issues: unknown[] }).issues)).toBe(true);
  });

  it('returns 201 with valid key and report', async () => {
    const db = makeFakeDb({
      findKeyOrg: vi.fn().mockResolvedValue({ orgId: 'org-1', keyId: 'key-1' }),
    });
    const result = await processIngest(db, 'ally_sk_validkey', {
      projectName: 'my-app',
      report: sampleReport,
    });
    expect(result.status).toBe(201);
    expect(result.json).toEqual({ scanUrl: '/p/proj-1/scans/scan-1' });
  });

  it('calls touchKey on valid key', async () => {
    const db = makeFakeDb({
      findKeyOrg: vi.fn().mockResolvedValue({ orgId: 'org-1', keyId: 'key-1' }),
    });
    await processIngest(db, 'ally_sk_validkey', {
      projectName: 'my-app',
      report: sampleReport,
    });
    expect(db.touchKey).toHaveBeenCalledWith('key-1');
  });

  it('calls insertFindings with mapped finding rows', async () => {
    const db = makeFakeDb({
      findKeyOrg: vi.fn().mockResolvedValue({ orgId: 'org-1', keyId: 'key-1' }),
    });
    await processIngest(db, 'ally_sk_validkey', {
      projectName: 'my-app',
      report: sampleReport,
    });
    expect(db.insertFindings).toHaveBeenCalledWith('scan-1', sampleReport.findings);
  });

  it('calls upsertProject with orgId and projectName', async () => {
    const db = makeFakeDb({
      findKeyOrg: vi.fn().mockResolvedValue({ orgId: 'org-1', keyId: 'key-1' }),
    });
    await processIngest(db, 'ally_sk_validkey', {
      projectName: 'my-app',
      report: sampleReport,
    });
    expect(db.upsertProject).toHaveBeenCalledWith('org-1', 'my-app');
  });
});
