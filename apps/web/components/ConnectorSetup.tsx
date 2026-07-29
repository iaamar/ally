'use client';

import React, { useActionState, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import {
  createApiKeyAction,
  type CreateApiKeyState,
} from '@/app/keys/actions';
import { ConnectorLogo, type ConnectorLogoId } from '@/components/ConnectorLogo';
import { MCP_TOOLS } from '@/lib/mcp-tools';

interface ConnectorSetupProps {
  endpoint: string;
  accountEmail: string;
  oauthReady: boolean;
}

interface SupportedClient {
  id: ConnectorLogoId;
  label: string;
}

const SUPPORTED_CLIENTS: SupportedClient[] = [
  { id: 'codex', label: 'Codex' },
  { id: 'claude', label: 'Claude Code + Desktop' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'manual', label: 'Other MCP clients' },
];

const initialState: CreateApiKeyState = {};

function CreateKeySubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Creating secure key…' : 'Create API key'}
    </button>
  );
}

export function ConnectorSetup({
  endpoint,
  accountEmail,
  oauthReady,
}: ConnectorSetupProps) {
  const [state, action] = useActionState(createApiKeyAction, initialState);
  const [copied, setCopied] = useState<string | null>(null);
  const keyDialogRef = useRef<HTMLDialogElement>(null);

  const codexCommand = [
    `codex mcp add ally --url ${endpoint}`,
    'codex mcp login ally --scopes email',
    'codex mcp get ally',
  ].join('\n');

  const claudeCommand = [
    `claude mcp add --transport http --scope local ally ${endpoint}`,
    'claude mcp login ally',
    'claude mcp get ally',
  ].join('\n');

  const cursorConfig = JSON.stringify({
    mcpServers: {
      ally: {
        url: endpoint,
      },
    },
  }, null, 2);

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 2_000);
  }

  function openKeyDialog() {
    keyDialogRef.current?.showModal();
    window.requestAnimationFrame(() => {
      document.getElementById('connector-key-name')?.focus();
    });
  }

  return (
    <>
      <header className="connect-hero">
        <div>
          <p className="connect-eyebrow">Developer connection</p>
          <h1>Ally MCP</h1>
          <p className="connect-intro">
            Bring accessibility intelligence into the tools where you already
            write, review, and repair code.
          </p>
        </div>
      </header>

      <div className="connector-workbench">
        <section className="connector-config-card" aria-labelledby="connect-guide-title">
          <header className="connector-setup-heading">
            <div>
              <p className="connect-eyebrow">One connection</p>
              <h2 id="connect-guide-title">Connect your coding tool</h2>
              <p>
                Add Ally once, sign in through your browser, and start using its
                tools from your repository.
              </p>
            </div>
            {oauthReady ? (
              <span className="connector-setup-state">
                <span aria-hidden="true" />
                Ready to connect
              </span>
            ) : null}
          </header>

          <div className="connector-supported" aria-label="Supported coding tools">
            {SUPPORTED_CLIENTS.map((client) => (
              <div key={client.id} className="connector-supported__item">
                <span
                  className={`connector-supported__logo connector-supported__logo--${client.id}`}
                  aria-hidden="true"
                >
                  <ConnectorLogo id={client.id} size={18} />
                </span>
                <span>{client.label}</span>
              </div>
            ))}
          </div>

          <div className="connector-panel">
            {!oauthReady ? (
              <div className="connector-setup-alert" role="alert">
                <strong>Connection setup is temporarily unavailable.</strong>
                <p>
                  An Ally administrator needs to finish the sign-in service
                  configuration before new connections can be added.
                </p>
              </div>
            ) : null}

            <InstructionStep number="1" title="Add Ally">
              Create a remote MCP connection named <strong>Ally</strong> in your
              coding tool. Claude Code and Claude Desktop use this same connection
              and the same sign-in flow.
            </InstructionStep>

            <InstructionStep number="2" title="Use the Ally server URL">
              Paste this URL when your tool asks for a remote or custom MCP server.
              <CodeBlock
                label="Ally MCP server"
                value={endpoint}
                copied={copied}
                onCopy={copy}
                copyLabel="Copy URL"
              />
            </InstructionStep>

            <InstructionStep number="3" title="Sign in and verify">
              Continue when your tool opens Ally in the browser. After signing in,
              return to your tool and ask it to run <code>get_ally_health</code>.
            </InstructionStep>

            <details className="connector-advanced connector-cli-setup">
              <summary>Command-line and project configuration</summary>
              <p>
                Prefer a terminal or project file? These recipes create the same
                Ally connection shown above.
              </p>
              <div className="connector-cli-grid">
                <CodeBlock
                  label="Codex"
                  value={codexCommand}
                  copied={copied}
                  onCopy={copy}
                />
                <CodeBlock
                  label="Claude Code"
                  value={claudeCommand}
                  copied={copied}
                  onCopy={copy}
                />
                <CodeBlock
                  label="Cursor · .cursor/mcp.json"
                  value={cursorConfig}
                  copied={copied}
                  onCopy={copy}
                />
              </div>
              <p className="connector-cli-note">
                In Claude Desktop, open <strong>Settings → Connectors</strong>,
                add a custom connector, and use the same Ally server URL.
              </p>
            </details>

            <div className="connector-secondary-action">
              <div>
                <strong>Connecting CI or a service account?</strong>
                <p>
                  Create an API key only for automation that cannot complete a
                  browser sign-in.
                </p>
              </div>
              <div>
                <button type="button" className="btn-ghost" onClick={openKeyDialog}>
                  Create API key
                </button>
                <a href="/keys">Manage keys</a>
              </div>
            </div>

            <div className="connector-boundary">
              <strong>Your code stays under your agent&apos;s control.</strong>
              <p>
                The hosted service processes only source selected for an Ally call.
                It persists findings and verification metadata, not submitted source.
              </p>
            </div>
          </div>
        </section>

        <aside className="mcp-tool-catalog" aria-labelledby="mcp-tools-heading">
          <div className="mcp-tool-catalog__heading">
            <div>
              <p className="connect-eyebrow">Assistant capabilities</p>
              <h2 id="mcp-tools-heading">Available tools</h2>
            </div>
            <span>{MCP_TOOLS.length}</span>
          </div>
          <ul>
            {MCP_TOOLS.map((tool) => (
              <li key={tool.name}>
                <code>{tool.name}</code>
                <span>{tool.aliasFor ? `Alias of ${tool.aliasFor}` : tool.phase}</span>
              </li>
            ))}
          </ul>
          <a href="/docs">Read the complete MCP docs →</a>
        </aside>
      </div>

      <dialog
        ref={keyDialogRef}
        className="key-dialog"
        aria-labelledby="key-dialog-title"
        onClick={(event) => {
          if (event.target === keyDialogRef.current) keyDialogRef.current?.close();
        }}
      >
        <div className="key-dialog__content">
          <header>
            <div>
              <p className="connect-eyebrow">Private credential</p>
              <h2 id="key-dialog-title">Create an Ally API key</h2>
            </div>
            <button
              type="button"
              className="btn-ghost key-dialog__close"
              onClick={() => keyDialogRef.current?.close()}
              aria-label="Close key dialog"
            >
              ×
            </button>
          </header>

          {state.raw ? (
            <div className="connector-new-key" role="status">
              <p>
                <strong>Copy this key now.</strong> Ally stores only its hash, so
                the full value cannot be shown again.
              </p>
              <div className="connector-secret">
                <code>{state.raw}</code>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => copy('key', state.raw ?? '')}
                >
                  {copied === 'key' ? 'Copied' : 'Copy key'}
                </button>
              </div>
            </div>
          ) : (
            <form action={action} className="connector-key-form">
              <div className="form-group">
                <label htmlFor="connector-key-name">Connection name</label>
                <input
                  id="connector-key-name"
                  name="name"
                  required
                  maxLength={120}
                  placeholder="e.g. CI accessibility checks"
                />
              </div>
              <p className="text-muted">
                This account-scoped key authorizes MCP tools for{' '}
                {accountEmail || 'your Ally account'}.
              </p>
              <CreateKeySubmit />
            </form>
          )}

          {state.error ? (
            <p className="danger-error" role="alert">{state.error}</p>
          ) : null}
        </div>
      </dialog>
    </>
  );
}

function InstructionStep({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="connector-step">
      <span className="connector-step__number" aria-hidden="true">{number}</span>
      <div>
        <h3>{title}</h3>
        <div className="connector-step__body">{children}</div>
      </div>
    </div>
  );
}

function CodeBlock({
  label,
  value,
  copied,
  onCopy,
  copyLabel = 'Copy',
}: {
  label: string;
  value: string;
  copied: string | null;
  onCopy: (label: string, value: string) => Promise<void>;
  copyLabel?: string;
}) {
  return (
    <div className="connector-code">
      <div className="connector-code__bar">
        <span>{label}</span>
        <button type="button" className="btn-ghost" onClick={() => onCopy(label, value)}>
          {copied === label ? 'Copied' : copyLabel}
        </button>
      </div>
      <pre><code>{value}</code></pre>
    </div>
  );
}
