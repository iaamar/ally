'use client';

import { useActionState, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  createApiKeyAction,
  type CreateApiKeyState,
} from '@/app/keys/actions';
import { ConnectorLogo } from '@/components/ConnectorLogo';
import { MCP_TOOLS } from '@/lib/mcp-tools';

type ConnectorId = 'codex' | 'claude' | 'cursor' | 'manual';

interface ConnectorSetupProps {
  endpoint: string;
  accountEmail: string;
  lastUsedLabel: string;
}

interface Connector {
  id: ConnectorId;
  label: string;
}

const CONNECTORS: Connector[] = [
  { id: 'codex', label: 'Codex' },
  { id: 'claude', label: 'Claude Code' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'manual', label: 'Generic MCP' },
];

const initialState: CreateApiKeyState = {};
const KEY_PLACEHOLDER = 'PASTE_YOUR_ALLY_KEY_HERE';

function CreateKeySubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? 'Creating secure key…' : 'Create API key'}
    </button>
  );
}

function shellValue(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function ConnectorSetup({
  endpoint,
  accountEmail,
  lastUsedLabel,
}: ConnectorSetupProps) {
  const [active, setActive] = useState<ConnectorId>('codex');
  const [state, action] = useActionState(createApiKeyAction, initialState);
  const [copied, setCopied] = useState<string | null>(null);
  const keyDialogRef = useRef<HTMLDialogElement>(null);
  const key = state.raw ?? KEY_PLACEHOLDER;

  const codexCommand = [
    `export ALLY_API_KEY=${shellValue(key)}`,
    `codex mcp add ally --url ${endpoint} --bearer-token-env-var ALLY_API_KEY`,
    'codex mcp get ally',
  ].join('\n');

  const codexProjectConfig = [
    '[mcp_servers.ally]',
    `url = "${endpoint}"`,
    'bearer_token_env_var = "ALLY_API_KEY"',
  ].join('\n');

  const claudeCommand = [
    'claude mcp add --transport http --scope local ally \\',
    `  ${endpoint} \\`,
    `  --header "Authorization: Bearer ${key}"`,
    'claude mcp get ally',
  ].join('\n');

  const cursorConfig = JSON.stringify({
    mcpServers: {
      ally: {
        url: endpoint,
        headers: {
          Authorization: 'Bearer ${env:ALLY_API_KEY}',
        },
      },
    },
  }, null, 2);

  const manualConfig = [
    `URL: ${endpoint}`,
    'Transport: Streamable HTTP',
    `Authorization: Bearer ${key}`,
  ].join('\n');

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 2_000);
  }

  function selectTab(connectorId: ConnectorId) {
    setActive(connectorId);
    window.requestAnimationFrame(() => {
      document.getElementById(`connector-tab-${connectorId}`)?.focus();
    });
  }

  function handleTabKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    connectorId: ConnectorId,
  ) {
    const currentIndex = CONNECTORS.findIndex(
      (connector) => connector.id === connectorId,
    );
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % CONNECTORS.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + CONNECTORS.length) % CONNECTORS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = CONNECTORS.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextConnector = CONNECTORS[nextIndex];
    if (nextConnector) selectTab(nextConnector.id);
  }

  const activeConnector = CONNECTORS.find(
    (connector) => connector.id === active,
  )!;

  return (
    <>
      <header className="connect-hero">
        <div>
          <p className="connect-eyebrow">Developer connectors</p>
          <h1>Ally MCP</h1>
          <p className="connect-intro">
            Connect the accessibility brain to your coding agent. Search WCAG,
            scan supplied source, plan bounded fixes, and verify repairs from the
            repository where your agent is already working.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary connect-create-key"
          onClick={() => {
            keyDialogRef.current?.showModal();
            window.requestAnimationFrame(() => {
              document.getElementById('connector-key-name')?.focus();
            });
          }}
        >
          Create API key
        </button>
      </header>

      <div className="connect-status-strip" aria-label="Connection summary">
        <span><strong>Endpoint</strong> Streamable HTTP</span>
        <span><strong>Tools</strong> {MCP_TOOLS.length} available</span>
        <span><strong>Last activity</strong> {lastUsedLabel}</span>
      </div>

      <div className="connector-workbench">
        <div className="connector-config-card">
          <div className="connector-tabs" role="tablist" aria-label="Coding agent">
            {CONNECTORS.map((connector) => (
              <button
                key={connector.id}
                type="button"
                role="tab"
                id={`connector-tab-${connector.id}`}
                aria-selected={active === connector.id}
                aria-controls={`connector-panel-${connector.id}`}
                tabIndex={active === connector.id ? 0 : -1}
                className="connector-tab"
                onClick={() => setActive(connector.id)}
                onKeyDown={(event) => handleTabKeyDown(event, connector.id)}
              >
                <span
                  className={`connector-tab__mark connector-tab__mark--${connector.id}`}
                  aria-hidden="true"
                >
                  <ConnectorLogo id={connector.id} />
                </span>
                <strong>{connector.label}</strong>
              </button>
            ))}
          </div>

          <section
            role="tabpanel"
            id={`connector-panel-${active}`}
            aria-labelledby={`connector-tab-${active}`}
            className="connector-panel"
          >
            <div className="connector-panel__heading">
              <div>
                <p className="connect-eyebrow">Configure {activeConnector.label}</p>
                <h2>Install Ally from your cloned repository</h2>
              </div>
              <span className="badge">
                <span className="badge__dot" aria-hidden="true" />
                Hosted MCP
              </span>
            </div>

            {active === 'codex' ? (
              <>
                <InstructionStep number="1" title="Open the clone">
                  In Terminal, change into the repository Codex should work on.
                </InstructionStep>
                <InstructionStep number="2" title="Register Ally">
                  Keep the API key in the environment used to launch Codex. Restart
                  the Codex app or IDE after setting it.
                  <CodeBlock
                    label="Codex install command"
                    value={codexCommand}
                    copied={copied}
                    onCopy={copy}
                  />
                </InstructionStep>
                <details className="connector-advanced">
                  <summary>Use project-scoped Codex configuration</summary>
                  <p>
                    Put this in <code>.codex/config.toml</code> for a trusted clone.
                    Commit only the environment variable name, never the API key.
                  </p>
                  <CodeBlock
                    label="Codex project configuration"
                    value={codexProjectConfig}
                    copied={copied}
                    onCopy={copy}
                  />
                </details>
                <InstructionStep number="3" title="Start a new Codex task">
                  Confirm Ally is available, then ask: “Use Ally to scan this repository.”
                </InstructionStep>
              </>
            ) : null}

            {active === 'claude' ? (
              <>
                <InstructionStep number="1" title="Open the clone">
                  Run the command from the repository Claude Code should inspect.
                </InstructionStep>
                <InstructionStep number="2" title="Register Ally">
                  <CodeBlock
                    label="Claude Code install command"
                    value={claudeCommand}
                    copied={copied}
                    onCopy={copy}
                  />
                </InstructionStep>
                <InstructionStep number="3" title="Verify the connection">
                  Start Claude Code, run <code>/mcp</code>, and confirm <strong>ally</strong>
                  is connected.
                </InstructionStep>
              </>
            ) : null}

            {active === 'cursor' ? (
              <>
                <InstructionStep number="1" title="Set the secret">
                  Export <code>ALLY_API_KEY</code> before launching Cursor.
                  <CodeBlock
                    label="Cursor environment"
                    value={`export ALLY_API_KEY=${shellValue(key)}\ncursor .`}
                    copied={copied}
                    onCopy={copy}
                  />
                </InstructionStep>
                <InstructionStep number="2" title="Add project configuration">
                  Save this as <code>.cursor/mcp.json</code> in the clone.
                  <CodeBlock
                    label="Cursor MCP configuration"
                    value={cursorConfig}
                    copied={copied}
                    onCopy={copy}
                  />
                </InstructionStep>
                <InstructionStep number="3" title="Enable Ally">
                  Open Cursor settings, select MCP, and confirm Ally appears in
                  Available Tools.
                </InstructionStep>
              </>
            ) : null}

            {active === 'manual' ? (
              <>
                <InstructionStep number="1" title="Create a Streamable HTTP connection">
                  Use these values in any client that accepts a remote MCP endpoint.
                  <CodeBlock
                    label="Generic MCP connection"
                    value={manualConfig}
                    copied={copied}
                    onCopy={copy}
                  />
                </InstructionStep>
                <InstructionStep number="2" title="Verify the catalog">
                  Call <code>get_ally_health</code>, then list the {MCP_TOOLS.length}
                  available tools.
                </InstructionStep>
              </>
            ) : null}

            <div className="connector-boundary">
              <strong>Your code stays under your agent&apos;s control.</strong>
              <p>
                The hosted service processes only source selected for an Ally call.
                It persists findings and verification metadata, not submitted source.
              </p>
            </div>
          </section>
        </div>

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
                  placeholder="e.g. Codex — MacBook Pro"
                />
              </div>
              <p className="text-muted">
                This account-scoped key authorizes MCP tools for {accountEmail || 'your Ally account'}.
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
  children: React.ReactNode;
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
}: {
  label: string;
  value: string;
  copied: string | null;
  onCopy: (label: string, value: string) => Promise<void>;
}) {
  return (
    <div className="connector-code">
      <div className="connector-code__bar">
        <span>{label}</span>
        <button type="button" className="btn-ghost" onClick={() => onCopy(label, value)}>
          {copied === label ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre><code>{value}</code></pre>
    </div>
  );
}
