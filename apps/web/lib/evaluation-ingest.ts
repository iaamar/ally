import { zEvaluationIngest } from '@ally/shared';
import { hashApiKey } from './keys';

export interface EvaluationIngestDb {
  findKeyOrg(hash: string): Promise<{ orgId: string; keyId: string } | null>;
  touchKey(keyId: string): Promise<void>;
  upsertProject(orgId: string, name: string): Promise<{ id: string }>;
  storeEvaluation(
    projectId: string,
    scanId: string | undefined,
    contract: Record<string, unknown>,
    evaluation: Record<string, unknown>,
  ): Promise<{ scanId: string }>;
}

export async function processEvaluationIngest(
  db: EvaluationIngestDb,
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

  const parsed = zEvaluationIngest.safeParse(body);
  if (!parsed.success) {
    return { status: 400, json: { issues: parsed.error.issues } };
  }

  const { projectName, scanId, contract, evaluation } = parsed.data;
  if (evaluation.contractId !== contract.id) {
    return {
      status: 400,
      json: { error: 'evaluation contractId does not match contract id' },
    };
  }

  await db.touchKey(keyOrg.keyId);
  const project = await db.upsertProject(keyOrg.orgId, projectName);
  const stored = await db.storeEvaluation(
    project.id,
    scanId,
    contract as Record<string, unknown>,
    evaluation as Record<string, unknown>,
  );

  return {
    status: 201,
    json: {
      projectId: project.id,
      contractId: contract.id,
      scanId: stored.scanId,
    },
  };
}
