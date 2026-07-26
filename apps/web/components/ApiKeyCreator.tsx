'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  createApiKeyAction,
  type CreateApiKeyState,
} from '@/app/keys/actions';

const initialState: CreateApiKeyState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Creating…' : 'Create key'}
    </button>
  );
}

export function ApiKeyCreator() {
  const [state, action] = useActionState(createApiKeyAction, initialState);
  const [origin, setOrigin] = useState('https://your-ally-server.example.com');
  const [copied, setCopied] = useState<
    'claude' | 'codex' | 'claude-remote' | 'codex-remote' | null
  >(null);

  useEffect(() => setOrigin(window.location.origin), []);

  const claudeCommand = state.raw
    ? [
        'claude mcp add --transport stdio --scope local ally',
        `  -e ALLY_API_KEY=${state.raw} ALLY_API_URL=${origin}`,
        '  -- node /ABSOLUTE/PATH/TO/EasyAllianceProduct/packages/mcp/dist/index.js',
      ].join(' \\\n')
    : '';
  const codexCommand = state.raw
    ? [
        'codex mcp add ally',
        `  --env ALLY_API_KEY=${state.raw}`,
        `  --env ALLY_API_URL=${origin}`,
        '  -- node /ABSOLUTE/PATH/TO/EasyAllianceProduct/packages/mcp/dist/index.js',
      ].join(' \\\n')
    : '';
  const remoteUrl = `${origin}/api/mcp`;
  const claudeRemoteCommand = state.raw
    ? [
        'claude mcp add --transport http --scope local ally-remote',
        `  ${remoteUrl}`,
        `  --header "Authorization: Bearer ${state.raw}"`,
      ].join(' \\\n')
    : '';
  const codexRemoteCommand = state.raw
    ? [
        `export ALLY_API_KEY=${state.raw}`,
        'codex mcp add ally-remote',
        `  --url ${remoteUrl}`,
        '  --bearer-token-env-var ALLY_API_KEY',
      ].join('\n')
    : '';

  async function copyCommand(
    agent: 'claude' | 'codex' | 'claude-remote' | 'codex-remote',
    command: string,
  ) {
    await navigator.clipboard.writeText(command);
    setCopied(agent);
    window.setTimeout(() => setCopied(null), 2_000);
  }

  return (
    <>
      {state.raw ? (
        <aside role="status" className="notice">
          <p>
            <strong>New key created.</strong> Copy it now—it will not be shown again.
          </p>
          <output className="api-key-output">{state.raw}</output>

          <h3>Connect Claude Code</h3>
          <p className="text-muted">
            Build Ally MCP, replace the absolute path below, then run this command
            from the codebase Claude should scan.
          </p>
          <pre className="api-key-command"><code>{claudeCommand}</code></pre>
          <button type="button" onClick={() => copyCommand('claude', claudeCommand)}>
            {copied === 'claude' ? 'Copied' : 'Copy Claude Code command'}
          </button>

          <h3>Connect Codex</h3>
          <p className="text-muted">
            The same key works in the Codex app, CLI, and IDE extension.
          </p>
          <pre className="api-key-command"><code>{codexCommand}</code></pre>
          <button type="button" onClick={() => copyCommand('codex', codexCommand)}>
            {copied === 'codex' ? 'Copied' : 'Copy Codex command'}
          </button>

          <h3>Connect to hosted Ally MCP</h3>
          <p className="text-muted">
            Use the remote endpoint for WCAG search and supplied-source scans
            without running the local MCP process.
          </p>

          <h4>Claude Code — remote</h4>
          <pre className="api-key-command"><code>{claudeRemoteCommand}</code></pre>
          <button
            type="button"
            onClick={() => copyCommand('claude-remote', claudeRemoteCommand)}
          >
            {copied === 'claude-remote' ? 'Copied' : 'Copy remote Claude command'}
          </button>

          <h4>Codex — remote</h4>
          <pre className="api-key-command"><code>{codexRemoteCommand}</code></pre>
          <button
            type="button"
            onClick={() => copyCommand('codex-remote', codexRemoteCommand)}
          >
            {copied === 'codex-remote' ? 'Copied' : 'Copy remote Codex command'}
          </button>
        </aside>
      ) : null}

      <div className="card" style={{ marginTop: '1.25rem' }}>
        <h2 style={{ marginTop: 0 }}>Create a coding-agent key</h2>
        <form
          action={action}
          style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}
        >
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 16rem' }}>
            <label htmlFor="key-name">Key name</label>
            <input
              type="text"
              id="key-name"
              name="name"
              required
              maxLength={120}
              placeholder="e.g. Codex and Claude — MacBook"
            />
          </div>
          <SubmitButton />
        </form>
        {state.error ? (
          <p role="alert" style={{ color: 'var(--bad)', marginTop: '0.75rem' }}>
            {state.error}
          </p>
        ) : null}
      </div>
    </>
  );
}
