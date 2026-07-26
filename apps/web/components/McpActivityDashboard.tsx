'use client';

import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ActivityRun,
  ActivityRunStatus,
  ActivitySnapshot,
} from '@/lib/activity-data';
import { createClient } from '@/lib/supabase/client';

type View = 'live' | 'history' | 'errors';
type ConnectionState = 'connecting' | 'live' | 'polling';

const ACTIVE = new Set<ActivityRunStatus>(['queued', 'running', 'waiting']);
const FAILED = new Set<ActivityRunStatus>(['failed', 'cancelled', 'escalated']);

function formatDuration(milliseconds: number): string {
  if (milliseconds < 1_000) return `${milliseconds}ms`;
  const seconds = Math.round(milliseconds / 100) / 10;
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function elapsed(run: ActivityRun): string {
  return formatDuration(
    run.duration_ms
      ?? Math.max(0, new Date(run.completed_at ?? Date.now()).getTime() - new Date(run.started_at).getTime()),
  );
}

function badgeClass(status: ActivityRunStatus | 'info'): string {
  if (status === 'succeeded') return 'badge badge--good';
  if (FAILED.has(status as ActivityRunStatus)) return 'badge badge--bad';
  if (ACTIVE.has(status as ActivityRunStatus)) return 'badge badge--warn';
  return 'badge';
}

function percentile95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
}

export function McpActivityDashboard({
  initialSnapshot,
  projectId,
  compact = false,
}: {
  initialSnapshot: ActivitySnapshot;
  projectId?: string;
  compact?: boolean;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [view, setView] = useState<View>('live');
  const [tool, setTool] = useState('');
  const [project, setProject] = useState(projectId ?? '');
  const [connection, setConnection] = useState('');
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const connectionStateRef = useRef<ConnectionState>('connecting');
  const [refreshError, setRefreshError] = useState(false);
  const refreshInFlight = useRef(false);
  const announcement = useRef('');

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      const params = new URLSearchParams();
      if (projectId) params.set('projectId', projectId);
      const response = await fetch(`/api/activity?${params}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Activity request failed');
      setSnapshot(await response.json() as ActivitySnapshot);
      setRefreshError(false);
    } catch {
      setRefreshError(true);
    } finally {
      refreshInFlight.current = false;
    }
  }, [projectId]);

  const updateConnectionState = useCallback((next: ConnectionState) => {
    connectionStateRef.current = next;
    setConnectionState(next);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`mcp-activity:${projectId ?? 'organization'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mcp_runs' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mcp_run_events' }, refresh)
      .subscribe((state) => {
        if (state === 'SUBSCRIBED') updateConnectionState('live');
        if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          updateConnectionState('polling');
        }
      });
    const fallback = window.setInterval(() => {
      if (connectionStateRef.current !== 'live') void refresh();
    }, 5_000);
    return () => {
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [projectId, refresh, updateConnectionState]);

  const runs = snapshot.runs;
  const now = Date.now();
  const last24Hours = runs.filter((run) => now - new Date(run.started_at).getTime() <= 86_400_000);
  const finished24Hours = last24Hours.filter((run) => !ACTIVE.has(run.status));
  const successes = finished24Hours.filter((run) => run.status === 'succeeded').length;
  const successRate = finished24Hours.length ? Math.round((successes / finished24Hours.length) * 100) : 100;
  const p95 = percentile95(
    finished24Hours.flatMap((run) => run.duration_ms === null ? [] : [run.duration_ms]),
  );
  const activeCount = runs.filter((run) => ACTIVE.has(run.status)).length;
  const latest = runs[0];
  const nextAnnouncement = latest
    ? `${latest.tool_name ?? 'Remediation workflow'} ${latest.status}: ${latest.message}`
    : '';
  if (nextAnnouncement !== announcement.current) announcement.current = nextAnnouncement;

  const tools = [...new Set(runs.flatMap((run) => run.tool_name ? [run.tool_name] : []))].sort();
  const projects = [...new Map(runs.flatMap((run) =>
    run.project_id ? [[run.project_id, run.project_name ?? 'Unnamed project'] as const] : [],
  )).entries()];
  const connections = [...new Map(runs.flatMap((run) =>
    run.api_key_id ? [[run.api_key_id, run.connection_name ?? run.client_name ?? 'Unknown connection'] as const] : [],
  )).entries()];

  const filtered = useMemo(() => runs.filter((run) => {
    if (view === 'live' && !ACTIVE.has(run.status)) return false;
    if (view === 'history' && ACTIVE.has(run.status)) return false;
    if (view === 'errors' && !FAILED.has(run.status)) return false;
    if (tool && run.tool_name !== tool) return false;
    if (project && run.project_id !== project) return false;
    if (connection && run.api_key_id !== connection) return false;
    if (status && run.status !== status) return false;
    if (date && run.started_at.slice(0, 10) !== date) return false;
    return true;
  }), [connection, date, project, runs, status, tool, view]);

  return (
    <div className={`activity${compact ? ' activity--compact' : ''}`}>
      {!compact ? (
        <div className="activity-kpis" aria-label="MCP service status">
          <article className="stat">
            <span className="stat__label">MCP server</span>
            <strong className="activity-health">
              <span className="activity-health__dot" aria-hidden="true" />
              Healthy
            </strong>
            <span className="stat__meta">{snapshot.databaseLatencyMs}ms database latency</span>
          </article>
          <article className="stat">
            <span className="stat__label">Exposed tools</span>
            <strong className="stat__value">{snapshot.toolCount}</strong>
            <span className="stat__meta">Static hosted catalog</span>
          </article>
          <article className="stat">
            <span className="stat__label">Active calls</span>
            <strong className="stat__value">{activeCount}</strong>
            <span className="stat__meta">Queued, running, or waiting</span>
          </article>
          <article className="stat">
            <span className="stat__label">24h success rate</span>
            <strong className="stat__value">{successRate}%</strong>
            <span className="stat__meta">{finished24Hours.length} completed calls</span>
          </article>
          <article className="stat">
            <span className="stat__label">24h p95 duration</span>
            <strong className="stat__value">{p95 ? formatDuration(p95) : '—'}</strong>
            <span className="stat__meta">Completed calls</span>
          </article>
        </div>
      ) : null}

      <div className="activity-toolbar">
        <div className="activity-tabs" role="tablist" aria-label="Activity view">
          {(['live', 'history', 'errors'] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={view === item}
              className="activity-tab"
              onClick={() => setView(item)}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        <span className={`activity-connection activity-connection--${connectionState}`}>
          <span aria-hidden="true" />
          {connectionState === 'live' ? 'Realtime connected' : connectionState === 'polling' ? 'Polling every 5s' : 'Connecting'}
        </span>
      </div>

      <div className="activity-filters" aria-label="Activity filters">
        <label>Tool<select value={tool} onChange={(event) => setTool(event.target.value)}>
          <option value="">All tools</option>
          {tools.map((name) => <option key={name}>{name}</option>)}
        </select></label>
        {!projectId ? <label>Project<select value={project} onChange={(event) => setProject(event.target.value)}>
          <option value="">All projects</option>
          {projects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select></label> : null}
        <label>Connection<select value={connection} onChange={(event) => setConnection(event.target.value)}>
          <option value="">All connections</option>
          {connections.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select></label>
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {(['queued', 'running', 'waiting', 'succeeded', 'failed', 'cancelled', 'escalated'] as const)
            .map((value) => <option key={value}>{value}</option>)}
        </select></label>
        <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      </div>

      <p className="visually-hidden" aria-live="polite">{announcement.current}</p>
      {refreshError ? (
        <div className="notice" role="status">
          Live refresh is temporarily unavailable. The last successful snapshot remains visible.
        </div>
      ) : null}

      <div className="activity-list" aria-label={`${view} MCP activity`}>
        {filtered.length ? filtered.map((run) => (
          <details className="activity-run card" key={run.id}>
            <summary>
              <span className="activity-run__identity">
                <strong>{run.tool_name ?? 'Remediation workflow'}</strong>
                <span>{run.message || run.current_stage}</span>
              </span>
              <span className={badgeClass(run.status)}>
                {run.status}
                {ACTIVE.has(run.status) && now - new Date(run.updated_at).getTime() > 300_000
                  ? ' · stale'
                  : ''}
              </span>
              <span className="activity-run__progress">
                <progress
                  value={Math.min(run.progress, run.total)}
                  max={run.total}
                  aria-label={`${run.tool_name ?? 'Workflow'} progress: ${Math.round(run.progress)} of ${Math.round(run.total)}`}
                />
                <span>{Math.round((run.progress / run.total) * 100)}%</span>
              </span>
              <span className="activity-run__meta">
                <span>{elapsed(run)}</span>
                <time dateTime={run.started_at}>{new Date(run.started_at).toLocaleString()}</time>
              </span>
            </summary>
            <div className="activity-run__details">
              <dl>
                <div><dt>Connection</dt><dd>{run.connection_name ?? run.client_name ?? 'Unknown'}</dd></div>
                <div><dt>Project</dt><dd>{run.project_name ?? 'Not linked'}</dd></div>
                <div><dt>Stage</dt><dd>{run.current_stage}</dd></div>
                <div><dt>Last seen</dt><dd><time dateTime={run.updated_at}>{new Date(run.updated_at).toLocaleString()}</time></dd></div>
                {run.parent_run_id ? <div><dt>Parent workflow</dt><dd><code>{run.parent_run_id}</code></dd></div> : null}
                {run.contract_id ? <div><dt>Contract</dt><dd><code>{run.contract_id}</code></dd></div> : null}
                {run.error_category ? <div><dt>Error</dt><dd>{run.error_category}: {run.error_message}</dd></div> : null}
              </dl>
              {run.attempts.length ? (
                <div className="activity-attempts">
                  <h3>Verification attempts</h3>
                  <ol>{run.attempts.map((attempt) => (
                    <li key={attempt.id}>
                      <strong>Attempt {attempt.n}: {attempt.verdict}</strong>
                      <span>{attempt.feedback}</span>
                    </li>
                  ))}</ol>
                </div>
              ) : null}
              <div className="activity-timeline">
                <h3>Event timeline</h3>
                {run.events.length ? <ol>{run.events.map((event) => (
                  <li key={event.id}>
                    <span className={badgeClass(event.status)}>{event.status}</span>
                    <div>
                      <strong>{event.stage}</strong>
                      <p>{event.message}</p>
                    </div>
                    <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleTimeString()}</time>
                  </li>
                ))}</ol> : <p className="text-muted">No detailed events were recorded.</p>}
              </div>
            </div>
          </details>
        )) : (
          <div className="card activity-empty">
            <strong>No matching activity</strong>
            <p className="text-muted">
              {view === 'live' ? 'No MCP tools are currently running.' : 'Try changing the filters or run an Ally MCP tool.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
