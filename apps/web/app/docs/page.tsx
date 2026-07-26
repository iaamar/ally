import { MCP_PHASES, MCP_TOOLS } from '@/lib/mcp-tools';

export const metadata = {
  title: 'Ally MCP Docs — Ally',
  description: 'Hosted Ally MCP tools, workflow, privacy, and client configuration.',
};

export default function DocsPage() {
  return (
    <section className="docs-page">
      <header className="docs-hero">
        <p className="connect-eyebrow">Ally MCP reference</p>
        <h1>Accessibility intelligence for coding agents</h1>
        <p>
          Ally gives Codex, Claude Code, Cursor, and any Streamable HTTP MCP client
          a deterministic accessibility loop: understand, scan, plan, repair, and verify.
        </p>
      </header>

      <nav className="docs-toc" aria-label="On this page">
        <strong>On this page</strong>
        <a href="#workflow">Workflow</a>
        <a href="#tools">Tools</a>
        <a href="#progress">Progress and traces</a>
        <a href="#privacy">Privacy model</a>
        <a href="#connect">Connect a client</a>
      </nav>

      <div className="docs-content">
        <article>
          <section id="workflow" className="docs-section">
            <p className="docs-kicker">Core workflow</p>
            <h2>One closed remediation loop</h2>
            <div className="docs-flow" aria-label="Ally remediation workflow">
              {['Search', 'Scan', 'Plan', 'Implement', 'Verify'].map((step, index) => (
                <div key={step}>
                  <span>{index + 1}</span>
                  <strong>{step}</strong>
                </div>
              ))}
            </div>
            <p>
              Use <code>search_wcag</code> before stating requirements, scan supplied
              source with <code>scan_accessibility</code>, create a bounded contract with
              <code>plan_fixes</code>, and keep repairing until <code>verify_fixes</code>
              passes or escalates after the allowed attempts.
            </p>
          </section>

          <section id="tools" className="docs-section">
            <p className="docs-kicker">Tool catalog</p>
            <h2>{MCP_TOOLS.length} hosted tools</h2>
            {MCP_PHASES.map((phase) => (
              <div className="docs-tool-group" key={phase}>
                <h3>{phase}</h3>
                {MCP_TOOLS.filter((tool) => tool.phase === phase).map((tool) => (
                  <article className="docs-tool" key={tool.name}>
                    <div>
                      <code>{tool.name}</code>
                      {tool.aliasFor ? <span className="tool-alias">Compatibility alias</span> : null}
                    </div>
                    <p>{tool.summary}</p>
                    <span>{tool.access}</span>
                  </article>
                ))}
              </div>
            ))}
          </section>

          <section id="progress" className="docs-section">
            <p className="docs-kicker">Observability</p>
            <h2>Progress in the client and durable traces</h2>
            <p>
              Long-running calls emit native MCP progress when the client supplies a
              progress token. Every hosted call also records monotonic milestones,
              duration, status, connection, project, and sanitized errors in Ally.
              Open <a href="/activity">Traces</a> to follow the same run across refreshes.
            </p>
          </section>

          <section id="privacy" className="docs-section">
            <p className="docs-kicker">Data boundary</p>
            <h2>Source is processed, never persisted</h2>
            <p>
              The hosted MCP receives only files selected by your coding agent. Ally
              stores hashes, paths, finding metadata, remediation targets, WCAG excerpts,
              verdicts, and sanitized feedback—not submitted source content.
            </p>
            <p>
              Local filesystem discovery, browser scans, and project test commands remain
              local-agent capabilities. The hosted service performs supplied-source scans,
              knowledge retrieval, durable planning, and deterministic verification.
            </p>
          </section>

          <section id="connect" className="docs-section">
            <p className="docs-kicker">Client setup</p>
            <h2>Connect with one account-scoped key</h2>
            <ol>
              <li>Create a private key from <a href="/connect">Ally MCP</a>.</li>
              <li>Select Codex, Claude Code, Cursor, or Generic MCP.</li>
              <li>Run the generated configuration from the clone the agent should inspect.</li>
              <li>Start a new agent session and call <code>get_ally_health</code>.</li>
            </ol>
          </section>
        </article>
      </div>
    </section>
  );
}
