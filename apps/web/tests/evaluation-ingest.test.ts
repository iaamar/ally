import { describe, expect, it, vi } from 'vitest';
import {
  processEvaluationIngest,
  type EvaluationIngestDb,
} from '@/lib/evaluation-ingest';

function fakeDb(
  overrides: Partial<EvaluationIngestDb> = {},
): EvaluationIngestDb {
  return {
    findKeyOrg: vi.fn().mockResolvedValue({
      orgId: 'org-1',
      keyId: 'key-1',
    }),
    touchKey: vi.fn().mockResolvedValue(undefined),
    upsertProject: vi.fn().mockResolvedValue({ id: 'project-1' }),
    storeEvaluation: vi.fn().mockResolvedValue({ scanId: 'scan-db-1' }),
    ...overrides,
  };
}

const body = {
  projectName: 'example',
  contract: {
    id: 'contract-1',
    baselineScanId: 'scan-1',
  },
  evaluation: {
    contractId: 'contract-1',
    attempt: 1,
    passed: true,
    gates: {
      contractedFindingsResolved: true,
      noFindingRegressions: true,
      runtimePassed: true,
      testsPassed: true,
    },
    runtime: { required: false, passed: true, routes: [] },
    tests: [],
  },
};

describe('processEvaluationIngest', () => {
  it('rejects invalid API keys', async () => {
    const db = fakeDb({ findKeyOrg: vi.fn().mockResolvedValue(null) });

    const result = await processEvaluationIngest(db, 'bad-key', body);

    expect(result.status).toBe(401);
    expect(db.storeEvaluation).not.toHaveBeenCalled();
  });

  it('rejects mismatched contract identifiers', async () => {
    const db = fakeDb();

    const result = await processEvaluationIngest(db, 'valid-key', {
      ...body,
      evaluation: { ...body.evaluation, contractId: 'another-contract' },
    });

    expect(result.status).toBe(400);
    expect(db.storeEvaluation).not.toHaveBeenCalled();
  });

  it('persists the contract and evaluation on the synced scan', async () => {
    const db = fakeDb();
    const request = { ...body, scanId: '77008039-b81b-49c8-918c-58da60be3980' };

    const result = await processEvaluationIngest(db, 'valid-key', request);

    expect(result.status).toBe(201);
    expect(db.upsertProject).toHaveBeenCalledWith('org-1', 'example');
    expect(db.storeEvaluation).toHaveBeenCalledWith(
      'project-1',
      request.scanId,
      body.contract,
      body.evaluation,
    );
    expect(result.json).toMatchObject({ scanId: 'scan-db-1' });
  });
});
