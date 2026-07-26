import { z } from 'zod';
import {
  publishHarnessEvent,
  type HarnessEventInput,
} from './harness-event-bus';
import { hashApiKey } from './keys';

export const zHarnessEventIngest = z.object({
  projectName: z.string().min(1).max(120),
  runId: z.string().min(1).max(120),
  scanId: z.string().uuid().optional(),
  sourceScanRef: z.string().min(1).max(120).optional(),
  runStatus: z.enum(['queued', 'running', 'waiting', 'passed', 'failed']),
  stage: z.string().min(1).max(80),
  eventStatus: z.enum(['queued', 'running', 'waiting', 'completed', 'failed', 'skipped']),
  message: z.string().min(1).max(500),
  detail: z.record(z.string(), z.unknown()).optional(),
});

export interface HarnessIngestDb {
  findKeyOrg(hash: string): Promise<{ orgId: string; keyId: string } | null>;
  touchKey(keyId: string): Promise<void>;
  upsertProject(orgId: string, name: string): Promise<{ id: string }>;
}

export async function processHarnessEventIngest(
  db: HarnessIngestDb,
  rawKey: string | null,
  body: unknown,
): Promise<{ status: number; json: object }> {
  if (!rawKey) {
    return { status: 401, json: { error: 'invalid api key' } };
  }

  const keyOrg = await db.findKeyOrg(hashApiKey(rawKey));
  if (!keyOrg) {
    return { status: 401, json: { error: 'invalid api key' } };
  }

  const parsed = zHarnessEventIngest.safeParse(body);
  if (!parsed.success) {
    return { status: 400, json: { issues: parsed.error.issues } };
  }

  await db.touchKey(keyOrg.keyId);
  const project = await db.upsertProject(keyOrg.orgId, parsed.data.projectName);
  publishHarnessEvent(project.id, parsed.data as HarnessEventInput);

  return {
    status: 201,
    json: { runId: parsed.data.runId, projectId: project.id },
  };
}
