import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getHarnessSnapshot,
  publishHarnessEvent,
  resetHarnessEventBusForTests,
  subscribeToHarness,
} from '@/lib/harness-event-bus';

const baseEvent = {
  projectName: 'demo',
  runId: 'run-1',
  runStatus: 'running',
  stage: 'scan',
  eventStatus: 'running',
  message: 'Scan started.',
} as const;

describe('harness event bus', () => {
  beforeEach(() => resetHarnessEventBusForTests());

  it('broadcasts an initial snapshot and subsequent events', () => {
    const subscriber = vi.fn();
    const unsubscribe = subscribeToHarness('project-1', subscriber);

    publishHarnessEvent('project-1', baseEvent);
    unsubscribe();

    expect(subscriber).toHaveBeenCalledTimes(2);
    expect(subscriber.mock.calls[1]?.[0]).toMatchObject({
      run: { id: 'run-1', current_stage: 'scan' },
      events: [{ message: 'Scan started.' }],
    });
  });

  it('keeps the current run identifiers across later events', () => {
    publishHarnessEvent('project-1', {
      ...baseEvent,
      scanId: '77008039-b81b-49c8-918c-58da60be3980',
      sourceScanRef: 'scan-source-1',
    });
    publishHarnessEvent('project-1', {
      ...baseEvent,
      stage: 'plan',
      eventStatus: 'completed',
      runStatus: 'waiting',
      message: 'Plan ready.',
    });

    expect(getHarnessSnapshot('project-1').run).toMatchObject({
      scan_id: '77008039-b81b-49c8-918c-58da60be3980',
      source_scan_ref: 'scan-source-1',
      current_stage: 'plan',
      status: 'waiting',
    });
  });

  it('replaces the temporary timeline when a new run starts', () => {
    publishHarnessEvent('project-1', baseEvent);
    publishHarnessEvent('project-1', {
      ...baseEvent,
      runId: 'run-2',
      message: 'A new scan started.',
    });

    const snapshot = getHarnessSnapshot('project-1');
    expect(snapshot.run?.id).toBe('run-2');
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0]?.message).toBe('A new scan started.');
  });

  it('does not duplicate retried status events', () => {
    publishHarnessEvent('project-1', baseEvent);
    publishHarnessEvent('project-1', baseEvent);

    expect(getHarnessSnapshot('project-1').events).toHaveLength(1);
  });
});
