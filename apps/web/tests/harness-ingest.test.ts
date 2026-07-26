import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  processHarnessEventIngest,
  type HarnessIngestDb,
} from '@/lib/harness-ingest';
import {
  getHarnessSnapshot,
  resetHarnessEventBusForTests,
} from '@/lib/harness-event-bus';
import { hashApiKey } from '@/lib/keys';

const validKey = 'ally_sk_harness_test';

function makeDb(overrides: Partial<HarnessIngestDb> = {}): HarnessIngestDb {
  return {
    findKeyOrg: vi.fn().mockImplementation(async (hash: string) =>
      hash === hashApiKey(validKey)
        ? { orgId: 'org-1', keyId: 'key-1' }
        : null,
    ),
    touchKey: vi.fn().mockResolvedValue(undefined),
    upsertProject: vi.fn().mockResolvedValue({ id: 'project-1' }),
    ...overrides,
  };
}

const event = {
  projectName: 'demo-a11y-bugs',
  runId: 'run-1',
  runStatus: 'running',
  stage: 'scan',
  eventStatus: 'running',
  message: 'Scanning source files.',
} as const;

describe('processHarnessEventIngest', () => {
  beforeEach(() => resetHarnessEventBusForTests());

  it('rejects a missing API key', async () => {
    const db = makeDb();
    const result = await processHarnessEventIngest(db, null, event);

    expect(result).toEqual({ status: 401, json: { error: 'invalid api key' } });
    expect(getHarnessSnapshot('project-1').run).toBeNull();
  });

  it('rejects an invalid event state', async () => {
    const db = makeDb();
    const result = await processHarnessEventIngest(db, validKey, {
      ...event,
      eventStatus: 'done',
    });

    expect(result.status).toBe(400);
    expect(getHarnessSnapshot('project-1').events).toHaveLength(0);
  });

  it('upserts the run and appends an event', async () => {
    const db = makeDb();
    const result = await processHarnessEventIngest(db, validKey, event);

    expect(result).toEqual({
      status: 201,
      json: { runId: 'run-1', projectId: 'project-1' },
    });
    expect(db.touchKey).toHaveBeenCalledWith('key-1');
    expect(getHarnessSnapshot('project-1')).toMatchObject({
      run: {
        id: 'run-1',
        status: 'running',
        current_stage: 'scan',
      },
      events: [
        {
          run_id: 'run-1',
          stage: 'scan',
          status: 'running',
          message: 'Scanning source files.',
        },
      ],
    });
  });
});
