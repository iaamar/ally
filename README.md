# Ally

An accessibility engineer inside your coding agent.

Ally is an MCP-powered accessibility scanning platform that catches WCAG violations in your JSX and HTML before they ship. It combines static analysis, runtime auditing, and LLM-assisted reasoning in a 3-pass pipeline.

## Quickstart

### Claude Code

Add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "ally": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"],
      "env": { "ALLY_PROJECT_ROOT": "." }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "ally": {
      "command": "node",
      "args": ["packages/mcp/dist/index.js"],
      "env": { "ALLY_PROJECT_ROOT": "." }
    }
  }
}
```

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

## Dashboard

The dashboard is a Next.js app at `apps/web/`.

### Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### Running

```bash
cd apps/web
pnpm dev
```

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
  mcp/       # MCP server (9 tools)
  shared/    # Shared types and utilities
apps/
  web/       # Next.js dashboard
scripts/
  dogfood.mjs  # Self-scan accessibility gate
```

## License

UNLICENSED — Proprietary.
