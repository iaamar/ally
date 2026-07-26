# Ally harness and knowledge architecture

## Current system

Ally already has three useful product planes:

1. `@ally/engine` discovers JSX/TSX/HTML, runs 42 static rules, can add runtime
   axe/custom checks, prioritizes findings, and creates deterministic fixes or
   reasoning packets.
2. `@ally/mcp` exposes scan, inspection, policy, fix, verdict, and dashboard
   sync tools to a coding agent.
3. `apps/web` stores scan reports in Supabase and presents project/finding
   dashboards.

The separate EasyAllianceKB repository has a fourth plane:

4. W3C pages are scraped, structurally chunked, embedded with
   `BAAI/bge-large-en-v1.5`, and stored as `halfvec(1024)` rows in Supabase.
   Retrieval combines HNSW cosine search and Postgres full-text search with RRF.

The live corpus currently contains 3,278 chunks. The embedding inference
provider is a replaceable dependency, not a reliable system boundary: when it
is unavailable, exact/full-text WCAG search must continue to work.

## Smallest reliable harness

The coding host (Codex, Claude Code, Cursor, etc.) remains the generator because
it already reads and edits the developer's repository. Ally's MCP owns the
accessibility-specific planner and evaluator:

```text
developer intent
      |
      v
scan_project -> plan_remediation -> sprint contract
                                      |
                                      v
                       coding host changes + tests
                                      |
                                      v
                         evaluate_remediation
                           | pass       | reject
                           v            v
                         report    repair from delta
```

The sprint contract records the baseline scan, selected fingerprints, exact
acceptance criteria, and permitted regression budget. Evaluation performs a
fresh static scan and, when contracted, Playwright/axe plus custom runtime
checks and approved project test scripts. It fails when contracted findings
remain, new findings exceed the budget, a runtime route cannot be evaluated, a
test gate fails, or the total finding count increases.

This is intentionally smaller than three independent autonomous agents. Every
additional harness component should be added only after an observed failure
shows it is load-bearing.

## Retrieval path

```text
question + finding context
          |
          v
metadata filters (WCAG version / level)
          |
          +------ semantic HNSW search
          |             |
          +------ lexical Postgres FTS
                        |
                        v
                     RRF fusion
                        |
                 optional reranker
                        |
                        v
             answer with source citations
```

Reliability behavior:

- Normal mode: the dashboard and MCP call a dedicated, warm BGE service and
  invoke the Supabase hybrid RRF RPC directly.
- Inference or hybrid-RPC failure: callers invoke `lexical_search_wcag`.
- If no dedicated service is configured, the existing `search-wcag` Edge
  Function remains available as a legacy compatibility path.
- Compatibility fallback: MCP and the web server can query the public
  `tsvector` column through PostgREST if an older Edge Function still returns
  an error.
- Generation failure or missing LLM key: the UI returns ranked source excerpts
  rather than fabricating an answer.

An external cross-encoder should be introduced only after an evaluation set
exists. Without labeled query/relevance pairs, a reranker adds cost and latency
without evidence that it improves answer fidelity.

## Product boundaries

- The browser never receives service-role or LLM credentials.
- Chat requires an authenticated dashboard user.
- The LLM receives only the question, bounded finding context, recent bounded
  conversation history, and the top retrieved passages.
- WCAG claims are expected to cite `[S1]`, `[S2]`, etc.; source URLs are rendered
  separately by the UI.
- Scan/fix state stays local to the MCP session until the user explicitly syncs
  a report.

## Next measured sprints

1. Deploy the lexical fallback migration and updated search function; add a
   health check that exercises both semantic and fallback modes.
2. Build a retrieval evaluation set (identifier, conceptual, code-specific,
   and adversarial queries) with criterion-level relevance labels. Measure
   recall@8, MRR, citation correctness, latency, and fallback availability.
3. Add reranking behind a feature flag and retain it only if it beats hybrid
   RRF on the evaluation set at an acceptable latency/cost.
4. Build route-level browser scenarios for multi-step keyboard and dialog
   behavior beyond the current page-level axe/custom checks.
5. Deploy private inference endpoints or an outbound local companion relay for
   hosted-dashboard synthesis; retain provider and lexical fallbacks.
