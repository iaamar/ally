// @vitest-environment jsdom

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { McpActivityDashboard } from '@/components/McpActivityDashboard';
import type { ActivitySnapshot } from '@/lib/activity-data';

const channel = {
  on: vi.fn(),
  subscribe: vi.fn(),
};
channel.on.mockReturnValue(channel);
channel.subscribe.mockReturnValue(channel);

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => channel,
    removeChannel: vi.fn().mockResolvedValue(undefined),
  }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  channel.on.mockReturnValue(channel);
  channel.subscribe.mockReturnValue(channel);
});

function snapshot(): ActivitySnapshot {
  const now = new Date().toISOString();
  return {
    generatedAt: now,
    databaseLatencyMs: 18,
    toolCount: 11,
    runs: [{
      id: 'run-1',
      kind: 'tool',
      tool_name: 'scan_accessibility',
      status: 'running',
      progress: 50,
      total: 100,
      current_stage: 'scan',
      message: 'Scanning source files.',
      error_category: null,
      error_message: null,
      started_at: now,
      updated_at: now,
      completed_at: null,
      duration_ms: null,
      parent_run_id: null,
      contract_id: null,
      project_id: 'project-1',
      project_name: 'Demo',
      api_key_id: 'key-1',
      connection_name: 'Developer laptop',
      client_name: 'Codex',
      events: [{
        id: 1,
        run_id: 'run-1',
        stage: 'scan',
        status: 'running',
        progress: 50,
        total: 100,
        message: 'Scanning source files.',
        detail: {
          input: {
            projectName: 'Demo',
            files: [{ path: 'src/App.tsx', bytes: 480 }],
          },
          action: 'Run deterministic accessibility rules.',
          output: { findingCount: 3 },
        },
        created_at: now,
      }],
      attempts: [],
    }],
  };
}

describe('MCP activity dashboard', () => {
  it('renders service metrics and accessible progress', () => {
    render(<McpActivityDashboard initialSnapshot={snapshot()} />);

    expect(screen.getByText('Healthy')).toBeTruthy();
    expect(screen.getByText('11')).toBeTruthy();
    const progress = screen.getByRole('progressbar', {
      name: 'Accessibility scan · Demo progress: 50 of 100',
    });
    expect(progress.getAttribute('value')).toBe('50');
    expect(progress.getAttribute('max')).toBe('100');
  });

  it('filters live calls out of history and exposes event details', () => {
    render(<McpActivityDashboard initialSnapshot={snapshot()} />);

    fireEvent.click(document.querySelector('summary')!);
    expect(screen.getAllByText('Scanning source files.').length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole('tab', { name: 'History' }));
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByText('No matching activity')).toBeTruthy();
  });

  it('shows what a completed verification checked and changed', () => {
    const completed = snapshot();
    completed.runs[0] = {
      ...completed.runs[0],
      tool_name: 'verify_fixes',
      status: 'succeeded',
      progress: 100,
      current_stage: 'complete',
      message: 'Verified 1 changed file for Demo.',
      completed_at: completed.generatedAt,
      duration_ms: 1200,
      events: [{
        id: 2,
        run_id: 'run-1',
        stage: 'complete',
        status: 'succeeded',
        progress: 100,
        total: 100,
        message: 'Verified 1 changed file for Demo.',
        detail: {
          input: {
            projectName: 'Demo',
            contractId: 'contract-1',
            files: [{ path: 'src/App.tsx', bytes: 510 }],
          },
          action: 'Compare stable finding identities against the baseline.',
          output: {
            verdict: 'pass',
            changedFiles: ['src/App.tsx'],
            checks: [{ id: 'targets_resolved', pass: true }],
          },
        },
        created_at: completed.generatedAt,
      }],
      attempts: [{
        id: 'attempt-1',
        n: 1,
        verdict: 'pass',
        feedback: 'All contracted findings are resolved.',
        changed_files: ['src/App.tsx'],
        result: {
          verdict: 'pass',
          checks: [{ id: 'targets_resolved', pass: true }],
        },
        created_at: completed.generatedAt,
      }],
    };

    render(<McpActivityDashboard initialSnapshot={completed} />);
    fireEvent.click(screen.getByRole('tab', { name: 'History' }));
    fireEvent.click(screen.getByText('Fix verification · Demo'));

    expect(screen.getAllByText('Verified 1 changed file for Demo.').length).toBeGreaterThan(0);
    expect(screen.getAllByText('src/App.tsx').length).toBeGreaterThan(0);
    expect(screen.getByText('Attempt 1: pass')).toBeTruthy();
    expect(screen.getByText('Verification evidence')).toBeTruthy();
  });
});
