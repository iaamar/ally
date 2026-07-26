# Deterministic evaluator implementation

## Implemented foundation

The evaluator is owned by the local MCP process. The coding host remains the
generator; no LLM decides whether remediation passed.

The active sequence is:

1. `scan_project` creates a static baseline and can optionally scan configured
   runtime routes.
2. `plan_remediation` resolves the evaluation profile, verifies a clean
   Playwright/axe/custom-check baseline, and runs only explicitly named
   `package.json` scripts.
3. The coding host implements the bounded goals.
4. `evaluate_remediation` repeats static, runtime, and test gates and returns
   structured deltas and repair reasons.
5. `sync_evaluation` sends the contract and attempt to the dashboard API.

The MCP loads a central environment file only when `ALLY_ENV_FILE` explicitly
names it. It never guesses or reads the target project's secrets. The
`get_ally_health` tool reports configured variable names, never values, and
checks knowledge retrieval and BGE availability.

## Contract gates

An evaluation passes only when all four gates pass:

- every contracted fingerprint is gone;
- finding regressions stay within the contract budget and total findings do
  not increase;
- every required runtime route completes;
- every approved test script exits successfully.

Runtime findings are merged with static findings through the existing
correlator, so a runtime-only regression is treated like any other new
finding.

## Persistence

Migration `0002_remediation_evaluations.sql` adds:

- `remediation_contracts`, owned through the existing project/org hierarchy;
- `remediation_evaluations`, uniquely keyed by contract and attempt;
- RLS policies matching project ownership.

The ingest endpoint authenticates with the existing hashed Ally API key and
upserts attempts idempotently.

## Step five: hosted inference or local relay

Step five is not required for the local coding harness. It is required only
when a deployed dashboard must synthesize answers instead of showing retrieved
passages.

### Option A — private hosted inference

Required:

- a reachable BGE service preserving the exact 1,024-dimensional
  `BAAI/bge-large-en-v1.5` contract;
- a hosted LLM provider;
- TLS endpoints and separate bearer tokens for embeddings and completion;
- Vercel variables `BGE_EMBEDDING_URL`, `BGE_EMBEDDING_TOKEN`,
  `GROQ_API_KEY`, `GROQ_MODEL`, and any provider fallback key;
- request timeouts, concurrency limits, health checks, logs, latency/error
  metrics, and a monthly cost ceiling;
- network restrictions so only the application backend can call inference.

### Option B — outbound local companion relay

Required:

- a signed desktop/MCP identity and short-lived session token;
- an outbound WebSocket from the developer machine to a hosted relay, avoiding
  inbound localhost access;
- user/org authorization and explicit approval before a dashboard request is
  routed to a local agent;
- encrypted request/response envelopes, replay protection, rate limits, audit
  logs, disconnect handling, and lexical/provider fallback;
- a clear UI indicating whether an answer ran locally or on a hosted provider.

Option A is simpler and more scalable for production. Option B preserves local
models and zero per-token inference but requires a desktop companion and a
substantially larger security surface.
