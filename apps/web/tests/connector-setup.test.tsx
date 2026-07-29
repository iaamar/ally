// @vitest-environment jsdom

import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConnectorSetup } from '@/components/ConnectorSetup';

vi.mock('@/app/keys/actions', () => ({
  createApiKeyAction: vi.fn(),
}));

vi.mock('@/components/ConnectorLogo', () => ({
  ConnectorLogo: () => null,
}));

afterEach(cleanup);

describe('Ally MCP connector setup', () => {
  it('shows one universal connection flow without protocol marketing or client tabs', () => {
    render(
      <ConnectorSetup
        endpoint="https://ally.example.com/api/mcp"
        accountEmail="developer@example.com"
        oauthReady
      />,
    );

    expect(screen.queryByText(/OAuth 2.1 default/i)).toBeNull();
    expect(screen.queryByText(/OAuth browser sign-in is ready/i)).toBeNull();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(screen.getByText('Claude Code + Desktop')).toBeTruthy();
    expect(screen.getByText(/Claude Code and Claude Desktop use this same connection/)).toBeTruthy();
    expect(screen.getByText('Ally MCP server')).toBeTruthy();
    expect(screen.getByText(/codex mcp login ally --scopes email/)).toBeTruthy();
    expect(screen.getByText(/claude mcp login ally/)).toBeTruthy();
    expect(screen.getByText(/"mcpServers"/)).toBeTruthy();
    expect(screen.getByText('Connecting CI or a service account?')).toBeTruthy();
  });

  it('only shows the connection-service alert when setup is unavailable', () => {
    const { rerender } = render(
      <ConnectorSetup
        endpoint="https://ally.example.com/api/mcp"
        accountEmail="developer@example.com"
        oauthReady
      />,
    );

    expect(screen.queryByRole('alert')).toBeNull();

    rerender(
      <ConnectorSetup
        endpoint="https://ally.example.com/api/mcp"
        accountEmail="developer@example.com"
        oauthReady={false}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain(
      'Connection setup is temporarily unavailable.',
    );
  });
});
