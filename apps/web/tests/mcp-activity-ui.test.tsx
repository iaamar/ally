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
        detail: {},
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
      name: 'scan_accessibility progress: 50 of 100',
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
});
