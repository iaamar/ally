'use client';

import { useEffect, useMemo, useState } from 'react';

type RunStatus = 'queued' | 'running' | 'waiting' | 'passed' | 'failed';
type EventStatus =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'skipped';

interface HarnessRun {
  id: string;
  scan_id: string | null;
  source_scan_ref: string | null;
  status: RunStatus;
  current_stage: string;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface HarnessEvent {
  id: number;
  run_id: string;
  stage: string;
  status: EventStatus;
  message: string;
  detail: Record<string, unknown>;
  created_at: string;
}

interface RunSnapshot {
  run: HarnessRun | null;
  events: HarnessEvent[];
}

const STAGES = [
  { id: 'connect', label: 'MCP connected', description: 'The local brain accepted the run.' },
  { id: 'scan', label: 'Scan', description: 'Static rules and configured runtime checks execute.' },
  { id: 'publish_scan', label: 'Publish scan', description: 'Findings are stored for the dashboard.' },
  { id: 'plan', label: 'Plan', description: 'A bounded sprint contract is created.' },
  { id: 'implement', label: 'Implement', description: 'The generator applies the contracted fixes.' },
  { id: 'evaluate', label: 'Evaluate', description: 'The engine re-scans and checks every gate.' },
  { id: 'repair', label: 'Repair', description: 'Failed gates are repaired before another attempt.' },
  { id: 'publish_evaluation', label: 'Publish result', description: 'The contract and evaluation are persisted.' },
] as const;

const TERMINAL = new Set<RunStatus>(['passed', 'failed']);

function elapsed(start: string, end?: string | null): string {
  const milliseconds = Math.max(
    0,
    new Date(end ?? Date.now()).getTime() - new Date(start).getTime(),
  );
  const seconds = Math.floor(milliseconds / 1_000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function badgeClass(status: RunStatus | EventStatus): string {
  if (status === 'passed' || status === 'completed') return 'badge badge--good';
  if (status === 'failed') return 'badge badge--bad';
  if (status === 'running' || status === 'waiting') return 'badge badge--warn';
  return 'badge';
}

export function HarnessRunTimeline({
  projectId,
}: {
  projectId: string;
  scanId: string;
}) {
  const [data, setData] = useState<RunSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<'connecting' | 'live' | 'reconnecting'>(
    'connecting',
  );
  const [, setClock] = useState(() => Date.now());

  useEffect(() => {
    const source = new EventSource(
      `/api/projects/${encodeURIComponent(projectId)}/harness-stream`,
    );
    source.onopen = () => setConnection('live');
    source.onerror = () => {
      setLoading(false);
      setConnection('reconnecting');
    };
    source.addEventListener('status', (event) => {
      try {
        setData(JSON.parse(event.data) as RunSnapshot);
        setLoading(false);
        setConnection('live');
      } catch {
        setConnection('reconnecting');
      }
    });
    return () => source.close();
  }, [projectId]);

  useEffect(() => {
    if (!data?.run || TERMINAL.has(data.run.status)) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [data?.run]);

  const latestByStage = useMemo(() => {
    const latest = new Map<string, HarnessEvent>();
    for (const event of data?.events ?? []) latest.set(event.stage, event);
    return latest;
  }, [data?.events]);

  if (loading) {
    return (
      <div className="card harness-empty" role="status">
        <span className="run-spinner" aria-hidden="true" />
        Loading harness status…
      </div>
    );
  }

  if (!data && connection === 'reconnecting') {
    return (
      <div className="notice" role="status">
        <strong>Reconnecting to live run status</strong>
        <p className="text-muted">
          The dashboard will resume automatically when the web service is available.
        </p>
      </div>
    );
  }

  if (!data?.run) {
    return (
      <div className="card harness-empty">
        <span className="harness-empty__mark" aria-hidden="true">○</span>
        <div>
          <h2>No run reported yet</h2>
          <p className="text-muted">
            Connect Ally in Claude Code or Codex, then run <code>scan_project</code>.
            This tab updates automatically through scan, publish, plan, implementation,
            evaluation, repair, and final result.
          </p>
        </div>
      </div>
    );
  }

  const { run, events } = data;
  const active = !TERMINAL.has(run.status);

  return (
    <div aria-live="polite" aria-atomic="false">
      <div className="run-summary">
        <div>
          <span className="stat__label">Run status</span>
          <span className={badgeClass(run.status)}>
            <span className="badge__dot" aria-hidden="true" />
            {run.status}
          </span>
        </div>
        <div>
          <span className="stat__label">Current stage</span>
          <strong>{STAGES.find((stage) => stage.id === run.current_stage)?.label ?? run.current_stage}</strong>
        </div>
        <div>
          <span className="stat__label">Elapsed</span>
          <strong className="run-metric">{elapsed(run.started_at, run.completed_at)}</strong>
        </div>
        <div>
          <span className="stat__label">Last update</span>
          <strong className="run-metric">{formatTime(run.updated_at)}</strong>
        </div>
        <div className="run-summary__live">
          {connection === 'live' ? (
            <>
              <span className="run-live-dot" aria-hidden="true" />
              {active ? 'Live stream' : 'Connected'}
            </>
          ) : (
            'Reconnecting…'
          )}
        </div>
      </div>

      <ol className="run-timeline" aria-label="Harness run timeline">
        {STAGES.map((stage) => {
          const event = latestByStage.get(stage.id);
          const status = event?.status ?? 'queued';
          const isCurrent =
            stage.id === run.current_stage &&
            (run.status === 'running' || run.status === 'waiting');
          return (
            <li
              key={stage.id}
              className={`run-step run-step--${status}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className="run-step__rail" aria-hidden="true">
                <span className="run-step__marker">
                  {status === 'completed' ? '✓' : status === 'failed' ? '!' : ''}
                </span>
              </span>
              <div className="run-step__content">
                <div className="run-step__heading">
                  <div>
                    <strong>{stage.label}</strong>
                    <p className="text-muted">{event?.message ?? stage.description}</p>
                  </div>
                  <div className="run-step__meta">
                    <span className={badgeClass(status)}>{status}</span>
                    {event ? <time dateTime={event.created_at}>{formatTime(event.created_at)}</time> : null}
                  </div>
                </div>
                {event && Object.keys(event.detail ?? {}).length > 0 ? (
                  <details className="run-step__details">
                    <summary>Technical details</summary>
                    <pre><code>{JSON.stringify(event.detail, null, 2)}</code></pre>
                  </details>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      <details className="run-event-log">
        <summary>Event log ({events.length})</summary>
        <ol>
          {events.map((event) => (
            <li key={event.id}>
              <time dateTime={event.created_at}>{formatTime(event.created_at)}</time>
              <span>{event.stage}</span>
              <strong>{event.status}</strong>
              <p>{event.message}</p>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
