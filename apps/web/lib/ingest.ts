import { zScanIngest } from '@ally/shared';
import type { Finding, ScanReport } from '@ally/shared';
import { hashApiKey } from './keys';

export interface IngestDb {
  findKeyOrg(hash: string): Promise<{ orgId: string; keyId: string } | null>;
  touchKey(keyId: string): Promise<void>;
  upsertProject(orgId: string, name: string): Promise<{ id: string }>;
  insertScan(projectId: string, report: ScanReport): Promise<{ id: string }>;
  insertFindings(scanId: string, findings: Finding[]): Promise<void>;
}

export async function processIngest(
  db: IngestDb,
  rawKey: string | null,
  body: unknown,
): Promise<{ status: number; json: object }> {
  if (!rawKey) {
    return { status: 401, json: { error: 'invalid api key' } };
  }

  const hash = hashApiKey(rawKey);
  const keyOrg = await db.findKeyOrg(hash);
  if (!keyOrg) {
    return { status: 401, json: { error: 'invalid api key' } };
  }

  const parsed = zScanIngest.safeParse(body);
  if (!parsed.success) {
    return { status: 400, json: { issues: parsed.error.issues } };
  }

  const { projectName, report } = parsed.data;

  await db.touchKey(keyOrg.keyId);
  const project = await db.upsertProject(keyOrg.orgId, projectName);
  const scan = await db.insertScan(project.id, report as ScanReport);
  await db.insertFindings(scan.id, report.findings as Finding[]);

  return {
    status: 201,
    json: {
      projectId: project.id,
      scanId: scan.id,
      scanUrl: `/p/${project.id}/scans/${scan.id}`,
    },
  };
}
