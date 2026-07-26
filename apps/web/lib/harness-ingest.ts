import { z } from 'zod';
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
  findKeyOrg(hash: string): Promise<{ orgId: string; keyId: string; keyName?: string } | null>;
  touchKey(keyId: string): Promise<void>;
  upsertProject(orgId: string, name: string): Promise<{ id: string }>;
  upsertRun(input: {
    orgId: string;
    keyId: string;
    keyName?: string;
    projectId: string;
    externalRunId: string;
    status: 'queued' | 'running' | 'waiting' | 'succeeded' | 'failed';
    progress: number;
    stage: string;
    message: string;
  }): Promise<{ id: string }>;
  appendEvent(input: {
    runId: string;
    eventKey: string;
    stage: string;
    status: 'queued' | 'running' | 'waiting' | 'succeeded' | 'failed' | 'info';
    progress: number;
    message: string;
    detail: Record<string, unknown>;
  }): Promise<void>;
}

const stageProgress: Record<string, number> = {
  connect: 5,
  scan: 20,
  publish_scan: 35,
  plan: 45,
  implement: 60,
  evaluate: 75,
  repair: 85,
  publish_evaluation: 95,
};

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
  const runStatus = parsed.data.runStatus === 'passed'
    ? 'succeeded'
    : parsed.data.runStatus;
  const eventStatus = parsed.data.eventStatus === 'completed'
    ? 'succeeded'
    : parsed.data.eventStatus === 'skipped'
      ? 'info'
      : parsed.data.eventStatus;
  const progress = runStatus === 'succeeded' || runStatus === 'failed'
    ? 100
    : stageProgress[parsed.data.stage] ?? 0;
  const run = await db.upsertRun({
    orgId: keyOrg.orgId,
    keyId: keyOrg.keyId,
    keyName: keyOrg.keyName,
    projectId: project.id,
    externalRunId: parsed.data.runId,
    status: runStatus,
    progress,
    stage: parsed.data.stage,
    message: parsed.data.message,
  });
  await db.appendEvent({
    runId: run.id,
    eventKey: [
      parsed.data.stage,
      eventStatus,
      parsed.data.message,
      JSON.stringify(parsed.data.detail ?? {}),
    ].join(':'),
    stage: parsed.data.stage,
    status: eventStatus,
    progress,
    message: parsed.data.message,
    detail: parsed.data.detail ?? {},
  });

  return {
    status: 201,
    json: { runId: parsed.data.runId, activityRunId: run.id, projectId: project.id },
  };
}
