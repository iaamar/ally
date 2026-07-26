export type HarnessRunStatus = 'queued' | 'running' | 'waiting' | 'passed' | 'failed';
export type HarnessEventStatus =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface HarnessEventInput {
  projectName: string;
  runId: string;
  scanId?: string;
  sourceScanRef?: string;
  runStatus: HarnessRunStatus;
  stage: string;
  eventStatus: HarnessEventStatus;
  message: string;
  detail?: Record<string, unknown>;
}

export interface HarnessRun {
  id: string;
  scan_id: string | null;
  source_scan_ref: string | null;
  status: HarnessRunStatus;
  current_stage: string;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface HarnessEvent {
  id: number;
  run_id: string;
  stage: string;
  status: HarnessEventStatus;
  message: string;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface HarnessSnapshot {
  run: HarnessRun | null;
  events: HarnessEvent[];
}

type Subscriber = (snapshot: HarnessSnapshot) => void;

interface ProjectChannel extends HarnessSnapshot {
  subscribers: Set<Subscriber>;
}

interface HarnessEventStore {
  projects: Map<string, ProjectChannel>;
  nextEventId: number;
}

const globalHarness = globalThis as typeof globalThis & {
  __allyHarnessEventStore?: HarnessEventStore;
};

const store =
  globalHarness.__allyHarnessEventStore ??
  (globalHarness.__allyHarnessEventStore = {
    projects: new Map<string, ProjectChannel>(),
    nextEventId: 1,
  });

function channelFor(projectId: string): ProjectChannel {
  const existing = store.projects.get(projectId);
  if (existing) return existing;

  const channel: ProjectChannel = {
    run: null,
    events: [],
    subscribers: new Set(),
  };
  store.projects.set(projectId, channel);
  return channel;
}

function snapshot(channel: ProjectChannel): HarnessSnapshot {
  return {
    run: channel.run ? { ...channel.run } : null,
    events: channel.events.map((event) => ({
      ...event,
      detail: { ...event.detail },
    })),
  };
}

function sameDetail(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function publishHarnessEvent(
  projectId: string,
  input: HarnessEventInput,
): HarnessSnapshot {
  const channel = channelFor(projectId);
  const now = new Date().toISOString();
  const isNewRun = channel.run?.id !== input.runId;
  const terminal = input.runStatus === 'passed' || input.runStatus === 'failed';

  if (isNewRun) channel.events = [];

  channel.run = {
    id: input.runId,
    scan_id: input.scanId ?? (isNewRun ? null : channel.run?.scan_id ?? null),
    source_scan_ref:
      input.sourceScanRef ??
      (isNewRun ? null : channel.run?.source_scan_ref ?? null),
    status: input.runStatus,
    current_stage: input.stage,
    started_at: isNewRun ? now : channel.run?.started_at ?? now,
    updated_at: now,
    completed_at: terminal ? now : null,
  };

  const detail = input.detail ?? {};
  const previous = channel.events.at(-1);
  const duplicate = !isNewRun &&
    previous?.run_id === input.runId &&
    previous.stage === input.stage &&
    previous.status === input.eventStatus &&
    previous.message === input.message &&
    sameDetail(previous.detail, detail);

  if (!duplicate) {
    channel.events.push({
      id: store.nextEventId++,
      run_id: input.runId,
      stage: input.stage,
      status: input.eventStatus,
      message: input.message,
      detail,
      created_at: now,
    });
  }
  channel.events = channel.events.slice(-100);

  const next = snapshot(channel);
  for (const subscriber of channel.subscribers) subscriber(next);
  return next;
}

export function getHarnessSnapshot(projectId: string): HarnessSnapshot {
  return snapshot(channelFor(projectId));
}

export function subscribeToHarness(
  projectId: string,
  subscriber: Subscriber,
): () => void {
  const channel = channelFor(projectId);
  channel.subscribers.add(subscriber);
  subscriber(snapshot(channel));
  return () => channel.subscribers.delete(subscriber);
}

export function resetHarnessEventBusForTests(): void {
  store.projects.clear();
  store.nextEventId = 1;
}
