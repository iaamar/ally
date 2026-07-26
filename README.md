# Ally

An accessibility engineer inside your coding agent.

Ally is an MCP-powered accessibility scanning platform that catches WCAG violations in your JSX and HTML before they ship. It combines static analysis, runtime auditing, and LLM-assisted reasoning in a 3-pass pipeline.

## Quickstart

### Claude Code

Create one API key at **Ally → API Keys**, then build the local MCP server:

```bash
pnpm install
pnpm --filter @ally/mcp build
```

From the project Claude Code should scan, register Ally using that single key:

```bash
claude mcp add --transport stdio --scope local ally \
  -e ALLY_API_KEY=<KEY_FROM_ALLY> ALLY_API_URL=http://localhost:3000 \
  -- node /ABSOLUTE/PATH/TO/EasyAllianceProduct/packages/mcp/dist/index.js

claude mcp get ally
```

Claude Code supplies `CLAUDE_PROJECT_DIR`, so Ally scans the project from which
Claude was launched unless a tool call provides another path. The same API key
authorizes hosted WCAG search, scan and evaluation sync, and live dashboard
events; Claude Code itself remains the completion/generator model.

Inside Claude Code, run `/mcp` to confirm Ally is connected, then invoke the
`remediation_harness` prompt.

### Codex

The same Ally key can be registered with Codex:

```bash
codex mcp add ally \
  --env ALLY_API_KEY=<KEY_FROM_ALLY> \
  --env ALLY_API_URL=http://localhost:3000 \
  -- node /ABSOLUTE/PATH/TO/EasyAllianceProduct/packages/mcp/dist/index.js

codex mcp get ally
```

The Codex app, CLI, and IDE extension share this MCP configuration. Start a new
Codex task after registration, use `/mcp` to inspect the connection when that
command is available, then ask Codex to run Ally's `remediation_harness`.

### Hosted MCP

The Vercel deployment exposes an API-key-authenticated Streamable HTTP endpoint
at `/api/mcp`. Connect Claude Code without running the local Node process:

```bash
claude mcp add --transport http --scope local ally-remote \
  https://mcp-ally-server.vercel.app/api/mcp \
  --header "Authorization: Bearer <KEY_FROM_ALLY>"
```

Codex can read the same Ally key from its environment:

```bash
export ALLY_API_KEY=<KEY_FROM_ALLY>
codex mcp add ally-remote \
  --url https://mcp-ally-server.vercel.app/api/mcp \
  --bearer-token-env-var ALLY_API_KEY
```

The hosted server supports grounded WCAG search and `scan_source_files`, which
scans source content supplied by the coding agent and persists the report to
the dashboard. Keep the local stdio server for automatic filesystem discovery,
Playwright runtime scans, and the stateful remediation harness.

### Cursor

Use the equivalent local stdio configuration with `ALLY_API_KEY`,
`ALLY_API_URL`, and the absolute MCP build path.

## Architecture: 3-Pass Engine

1. **Pass 1 — Static Analysis**: Parses JSX/TSX and HTML into a unified `Elem` tree, then runs 42 rules covering images, forms, ARIA, structure, media, color, and more. Produces fingerprinted findings with severity, confidence, and WCAG mapping.

2. **Pass 2 — Runtime Scan**: Launches a headless browser via Playwright and runs axe-core against rendered pages, plus custom runtime checks. Correlates runtime findings with static ones.

3. **Pass 3 — LLM Reasoning**: Generates reasoning packets for uncertain findings, allowing an LLM to confirm or dismiss them with evidence-based verdicts.

## MCP Tools

| Tool | Description |
|------|-------------|
| `scan_project` | Full scan of a project directory |
| `scan_files` | Scan specific files |
| `get_findings` | Query findings with filters |
| `explain_finding` | Detailed explanation of a finding |
| `get_reasoning_packets` | Get LLM reasoning packets for uncertain findings |
| `get_fixes` | Get auto-fix suggestions |
| `resolve_reasoning` | Submit verdicts for reasoning packets |
| `configure_policy` | Set scanning policy (severity thresholds, ignored rules) |
| `sync_report` | Sync scan report to Supabase dashboard |
| `search_wcag_knowledge` | Search the WCAG corpus with hybrid retrieval and lexical fallback |
| `get_ally_health` | Check env bootstrap, retrieval, BGE, and optional Gemma |
| `plan_remediation` | Create a bounded accessibility sprint contract from the current scan |
| `report_harness_progress` | Publish implementation or repair progress to the live dashboard |
| `evaluate_remediation` | Run static, optional runtime, and approved test gates |
| `sync_evaluation` | Persist the contract and latest evaluation attempt |

## Dashboard

The dashboard is a Next.js app at `apps/web/`.

### Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-publishable-key>
NEXT_PUBLIC_SITE_URL=https://mcp-ally-server.vercel.app
SUPABASE_SECRET_KEY=<your-secret-key>
GROQ_API_KEY=<your-groq-api-key>
GROQ_MODEL=qwen/qwen3.6-27b
ANTHROPIC_API_KEY=<optional-chat-generation-key>
ANTHROPIC_MODEL=<provider-model-id>
BGE_EMBEDDING_URL=http://embeddings:8080
BGE_EMBEDDING_TOKEN=<private-service-token>
BGE_REQUEST_TIMEOUT_MS=30000
```

The assistant uses Groq Qwen when `GROQ_API_KEY` is configured, then falls back
to Anthropic when configured. Accessibility questions use hybrid
or lexical WCAG retrieval; greetings and ordinary conversation go directly to
the model without an unnecessary search.
See [the harness and retrieval architecture](docs/architecture/2026-07-24-ally-harness-rag.md).

### Docker Deployment

The root `compose.yml` runs the full stack as server-ready containers:

```bash
docker compose up --build -d
```

Services:

```txt
web        http://localhost:3000
embeddings http://localhost:8080
```

Inside Docker, the web container talks to BGE over Docker DNS at
`http://embeddings:8080`. On a VPS or other single-server deployment, keep that
internal URL and expose only the web service publicly through your reverse
proxy. The Compose file binds the BGE host port to `127.0.0.1` for local
debugging without exposing it publicly. Text completion uses the configured
Groq API, so the obsolete local Gemma runtime and model-downloader containers
are not part of the stack.

When `BGE_EMBEDDING_URL` is set, the web app and MCP bypass the legacy
`search-wcag` Edge Function: they generate a query vector with the dedicated
BGE service and invoke Supabase `hybrid_search_wcag` directly. If either is
unavailable, they fall back to ranked full-text retrieval.

### Deterministic evaluator

Add an evaluation profile to the target project's `ally.config.json`:

```json
{
  "appUrl": "http://localhost:3000",
  "evaluation": {
    "runtime": true,
    "routes": ["/", "/login"],
    "timeoutMs": 30000,
    "testScripts": ["typecheck", "test"]
  }
}
```

`plan_remediation` first verifies a clean runtime and test baseline.
`evaluate_remediation` repeats the static scan, Playwright + axe/custom checks,
and only the named `package.json` scripts. Every contracted gate must pass.
See [the evaluator implementation](docs/architecture/2026-07-25-evaluator-implementation.md).

### Live harness status

The scan detail page includes a **Run status** tab. MCP tools publish each
harness transition to the dashboard:

`MCP connected → scan → publish scan → plan → implement/repair → evaluate → publish result`

No database migration is required for live status. The MCP authenticates each
event with the same Ally API key used for scan sync, and the single Docker web
process broadcasts events to signed-in dashboards over Server-Sent Events.
The process retains the latest 100 events in memory, so a container restart
clears the temporary timeline while permanent scans and evaluations remain in
Supabase. For local development, `.mcp.json` points `ALLY_API_URL` to
`http://localhost:3000`.

After changing MCP tools, rebuild the package and reconnect the MCP server:

```bash
pnpm --filter @ally/mcp build
```

Connecting MCP starts the server but does not start a scan. A run appears when
`scan_project` or `scan_files` is called. Scanning, planning, evaluation, and
dashboard sync report themselves automatically. The generator reports
implementation and repair stages with `report_harness_progress`.

### Running

```bash
pnpm --filter web dev --port 3000
```

The web scripts load the monorepo-root `.env` before Next starts, so the app,
Turbopack, and middleware share the centralized configuration.

## Scripts

```bash
pnpm build       # Build all packages
pnpm test        # Run all tests
pnpm typecheck   # Type-check all packages
pnpm dogfood     # Scan the Ally dashboard with the Ally engine (a11y gate)
```

## Project Structure

```
packages/
  engine/    # Core scanning engine (42 rules, 3-pass pipeline)
  mcp/       # MCP server and deterministic remediation harness
  shared/    # Shared types and utilities
apps/
  web/       # Next.js dashboard
scripts/
  dogfood.mjs  # Self-scan accessibility gate
```

## License

UNLICENSED — Proprietary.
