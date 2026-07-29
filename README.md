# Ally

An accessibility engineer inside your coding agent.

Ally is an MCP-powered accessibility scanning platform that catches WCAG violations in your JSX and HTML before they ship. It combines static analysis, runtime auditing, and LLM-assisted reasoning in a 3-pass pipeline.

## Quickstart

### Codex

Register the hosted server, then authorize Ally in the browser:

```bash
codex mcp add ally --url https://mcp-ally-server.vercel.app/api/mcp
codex mcp login ally --scopes email
codex mcp get ally
```

The Codex app, CLI, and IDE extension share this MCP configuration. Start a new
Codex task after registration, use `/mcp` to inspect the connection when that
command is available, then ask Codex to run Ally's `remediation_harness`.

### Claude Code

Claude Code uses the same browser-based OAuth connection:

```bash
claude mcp add --transport http --scope local ally \
  https://mcp-ally-server.vercel.app/api/mcp
claude mcp login ally
claude mcp get ally
```

Inside Claude Code, run `/mcp` to confirm Ally is connected, then invoke the
`remediation_harness` prompt.

### Hosted MCP

The Vercel deployment exposes a Streamable HTTP endpoint at `/api/mcp`. It
uses OAuth 2.1 browser sign-in by default for Codex, Claude, Cursor, and
compatible remote MCP clients. Account-scoped API keys remain an advanced
fallback for CI and non-interactive clients.

Claude Desktop custom connector:

1. Add `https://mcp-ally-server.vercel.app/api/mcp` as a custom connector.
2. Sign in with the same email used for Ally.
3. Review and authorize the requested MCP access.

Connect Claude Code without running the local Node process:

```bash
claude mcp add --transport http --scope local ally-remote \
  https://mcp-ally-server.vercel.app/api/mcp
claude mcp login ally-remote
claude mcp get ally-remote
```

Codex uses the same OAuth discovery and browser authorization:

```bash
codex mcp add ally-remote \
  --url https://mcp-ally-server.vercel.app/api/mcp
codex mcp login ally-remote --scopes email
codex mcp get ally-remote
```

For CI or an older non-interactive client, generate an Ally API key and send it
as `Authorization: Bearer <ALLY_API_KEY>`. Do not use this fallback for normal
interactive coding sessions.

The hosted server supports the complete supplied-source loop:
`search_wcag`, `explain_finding`, `scan_accessibility`, `plan_fixes`,
`record_progress`, `verify_fixes`, `list_scans`, `get_findings`, and
`get_ally_health`. The older `search_wcag_knowledge` and `scan_source_files`
names remain as aliases. Keep the local stdio server for automatic filesystem
discovery, Playwright runtime scans, and approved project test scripts.

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
| `get_ally_health` | Check env bootstrap, retrieval, and BGE |
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
BGE_REQUEST_TIMEOUT_MS=5000
CRON_SECRET=<random-production-secret>
OTEL_EXPORTER_OTLP_ENDPOINT=<optional-collector-endpoint>
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
Groq API, with Anthropic as an optional hosted fallback.

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

The organization workspace includes **MCP Activity**, and each scan detail
keeps a project-filtered **Run status** tab. Hosted and local MCP tools publish
each transition to durable Supabase runs and immutable events:

`MCP connected → scan → publish scan → plan → implement/repair → evaluate → publish result`

Apply `apps/web/supabase/migrations/20260726192000_mcp_activity.sql` before
deploying this application version. The MCP authenticates each event with the
same Ally API key used for scan sync. Signed-in dashboards load a snapshot
under RLS, subscribe through Supabase Realtime, and fall back to five-second
polling if Realtime is interrupted. Completed activity telemetry is retained
for 30 days; scans, findings, remediation contracts, and evaluations are not
part of that cleanup.

Native MCP clients receive `notifications/progress` when they provide a
progress token. Structured Vercel logs are always emitted. OTLP spans are
enabled only when `OTEL_EXPORTER_OTLP_ENDPOINT` is configured, and never include
credentials, prompts, snippets, or submitted source. Submitted source is
scanned in memory; only hashes, paths, finding metadata, WCAG excerpts, and
sanitized verdicts are retained.

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
