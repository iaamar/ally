# Ally — AI-Native Accessibility Scanning MCP Platform: Design & Delivery Plan

**Working name:** "Ally" (a11y = ally; final naming is a launch task — npm scope placeholder `@easyalliance/*`)
**Date:** 2026-07-22 · **Status:** Design decisions resolved with user (§9) — ready for implementation planning

## 1. Context

Build a brand-new developer accessibility product with two halves:

1. **An MCP server** that plugs into agentic coding tools (Claude Code, Cursor, Copilot, Windsurf, any MCP client) and scans codebases for accessibility bugs — with tiered output from flat listing → prioritized list → remediation suggestions → policy-gated auto-fix → human-in-the-loop review.
2. **An observability dashboard (SaaS)** where developers track scan results, remediation progress, and accessibility health over time.

Goal: be **better, faster, and cheaper** than Deque (axe) and Evinced — "do what Evinced does, one AI step ahead." Mass-market self-serve product: **closed-source freemium SaaS** (decided, §9) — proprietary code, generous free tier with zero-signup local scanning, paid tiers for team features, history, and CI.

This is a greenfield repo (`EasyAllianceProduct/` is empty). This document is the validated design; implementation planning follows via the writing-plans skill.

## 2. Research findings (from the provided links + sub-links)

### 2.1 Forrester Wave: Digital Accessibility Platforms, Q4 2025
The reprint page is JS-rendered and would not load in this environment; findings below are from vendor coverage of the same report (Deque's blog, Level Access, Siteimprove announcement pages).

- **Leaders: Deque, Level Access, Siteimprove.** Deque took the top Strategy score and highest-possible scores on 21 criteria (most of any vendor), incl. vision, innovation, roadmap, **developer tools, source code remediation**, program-impact metrics.
- Forrester on Deque: *"consistently first to market with innovative features, including new testing approaches, genAI features, and most recently, its MCP solution offering agentic AI support for accessibility."* → **Analyst market explicitly rewards MCP/agentic AI capability.**
- **Evinced was NOT a Leader** (it appeared in Forrester's Q2 2025 Landscape of 15 vendors). Its strength is tech, not market presence — the "leapfrog Evinced" position is open.

### 2.2 Deque / axe
- **axe MCP Server** (`dequelabs/axe-mcp-server-public`): two tools — `analyze` (scans **rendered web pages** via the axe DevTools extension engine in a real browser) and `remediate` (AI code-level fix guidance). Requires **Docker + paid Axe DevTools for Web subscription + API key**. Docs: docs.deque.com/devtools-server/4.0.0/en/axe-mcp-server.
- **axe DevTools Linter**: the static-analysis product — **44 rules**, React/React Native/Vue/Angular/HTML/Markdown, runs in IDE/CI/API, **priced by lines of code inspected ("LoC" metric)**. Free VS Code-only version has 600k+ installs → proven mass demand for free static a11y linting.
- **axe Advanced Rules**: AI/vision rules beyond axe-core (e.g., `image-informative-has-alt`, `heading-markup`) that return **confidence ratings instead of pass/fail**, with adjustable thresholds; add 15–20s to scans. → Validates confidence-scored AI findings as an accepted industry pattern.
- **axe-core**: OSS (MPL-2.0) runtime rules engine; industry standard; usable as a dependency.
- **Deque accessibility statement**: claims WCAG 2.2 AA + Section 508 + EN 301 549, links 17 per-product VPATs, describes testing methodology and feedback channels. → Template for our own statement; our product must itself be accessible (dogfooding is table stakes for credibility in this market).

### 2.3 Evinced
- **Tech**: renders pages and analyzes them "like a sighted user would" — computer vision + rule-sets + structural semantic model of the page; detects undeclared controls, inaccessible custom widgets, poor contrast on complex backgrounds, poor focus indication; handles DOM mutations; framework-independent. Claims **19× more critical issues on average** (30-site study; up to 26× claimed elsewhere) vs axe/Lighthouse.
- **Web MCP Server** (`npx @evinced/mcp-server-web`): one tool `evinced_analyze_webpage(url, componentSelector)` + one MCP prompt `evinced_fix_webpage_issues` (guided remediation workflow). Runs **headless Chromium against a URL** (or browser-extension mode for authenticated pages). Severity buckets Critical/Serious/Moderate/Minor; prioritizes `WRONG_SEMANTIC_ROLE`, `NOT_FOCUSABLE`; returns "LLM-optimized remediation instructions", DOM selectors/snippets/bounding boxes. Mobile MCP Server drives simulators/devices (WebDriverAgent/ADB).
- **Friction**: requires an Evinced account with **service ID + API key "from your Evinced representative"** (sales-gated), plus a **JFrog token in `.npmrc`** just to install the package. SOC 2 Type II; cloud or private deploy.
- **Platform (their dashboard)**: component clustering — *"a short list of components usually account for thousands of accessibility issues — well over 50% of the project on average"*; **stable unique issue IDs across scans** (new vs recurring vs resolved); baseline + fail-build-on-new-issues; severity trends; resolution-time metrics; Jira export with screenshots/CSS selectors/fix suggestions.
- Their claimed "5X better" agent outcome: Cursor+Sonnet with Evinced MCP vs 19% baseline accessible-component rate.

### 2.4 The competitive gap (our wedge)
| Gap | Evidence | Our move |
|---|---|---|
| **Both MCP offerings are enterprise-gated** (sales call, subscription, API key; Docker for axe, JFrog for Evinced) | §2.2, §2.3 | `npx` zero-config, no account required for local scans; self-serve free tier |
| **Both MCP servers scan rendered pages only** — they need a running URL; neither scans the repo through the agent | axe `analyze`, `evinced_analyze_webpage` | **Code-first static pass** works on any repo instantly, before the app even runs; runtime pass is the verifier, not the entry point |
| **Static analysis exists only as a separate paid product** (axe Linter, LoC-metered) | §2.2 | Static engine is the free core |
| **Their engines do the reasoning server-side; the agent is just a consumer** | both | **Agent-native reasoning**: the host agent's own LLM is Pass 3 of the engine (evidence + rubrics from us, reasoning + edits by the agent) → near-zero marginal AI cost |
| **No explicit auto-fix policy tiers** — axe gives "guidance", Evinced gives "instructions" | both | Policy-gated `SAFE_AUTOFIX` vs `SUGGEST` vs `NEEDS_HUMAN`, enforced by the server, reviewable in the dashboard |
| Observability is enterprise-sold | Evinced platform | Same core analytics (clusters, baselines, trends, MTTR) self-serve from day one |

## 3. Product definition

**One-liner:** An accessibility engineer inside your coding agent — scans code the moment it's written, fixes the no-brainers, escalates the judgment calls, and tracks your accessibility health in a dashboard.

**Users:** individual developers → teams → enterprises (land-and-expand PLG). **Platforms v1:** web codebases (React/JSX/TSX + HTML first, Vue next; mobile later — Evinced-parity backlog). **Standard:** WCAG 2.2 AA by default (configurable target incl. A/AAA, Section 508 / EN 301 549 mappings).

**Business model (decided):** closed freemium. All packages are proprietary (npm-published as bundled artifacts under an EULA — no OSS core). Free tier: unlimited local scanning with **no account required** (preserves the anti-friction wedge vs Deque/Evinced), free account for cloud sync of 1 project with 30-day history. Paid Pro/Team: unlimited projects/history, CI gates, review queue, team roles. Pricing is flat per seat/org — explicitly **no per-scan or lines-of-code metering** (contrast: axe Linter's LoC pricing).

**Better / Faster / Cheaper:**
- *Better:* 3-pass engine (static AST + runtime render + LLM semantics) catches both code-level issues runtime-only tools miss pre-deploy and semantic issues (meaningless alt text, wrong roles, name≠label) deterministic tools can't judge; component root-cause clustering; fix→re-scan verification loop.
- *Faster:* instant static results in-editor (no Docker, no browser, no URL needed); diff-only scans in the agent loop; auto-fix applied as ordinary git diffs.
- *Cheaper:* free local core; no LoC metering; Pass 3 rides the agent's existing LLM (we pay ~$0 inference for the local path); paid tier = cloud history/team/CI, not per-scan tax.

## 4. Architecture & delivery (answer: **MCP server AND API — phased**)

```
┌────────────────────────── Developer machine ─────────────────────────┐
│  Coding agent (Claude Code / Cursor / Copilot / any MCP client)      │
│      │  MCP (stdio, TS SDK, spec 2025-06-18)                         │
│      ▼                                                               │
│  Ally MCP server (npm: npx @easyalliance/ally-mcp)                   │
│      ├─ Pass 1: static engine (AST rules, framework adapters)        │
│      ├─ Pass 2: runtime engine (Playwright + axe-core + custom)      │
│      ├─ Pass 3: reasoning packets → host agent's LLM                 │
│      └─ sync (optional, API key) ──────────────┐                     │
└────────────────────────────────────────────────┼─────────────────────┘
                                                 ▼ HTTPS/JSON (ingest API)
┌─────────────────────────── Ally Cloud (Vercel) ──────────────────────┐
│  Next.js App Router: dashboard + REST API routes                     │
│  Supabase: Postgres (RLS) + Auth (GitHub/Google OAuth) + API keys    │
│  Later: remote Streamable-HTTP MCP (OAuth 2.1) · CI GitHub Action ·  │
│         public scan API · Stripe billing                             │
└──────────────────────────────────────────────────────────────────────┘
```

- **Local-first MCP server** is the flagship interface: works fully offline/anonymous (results stay local); logging in (`--login` device flow or `ALLY_API_KEY` env — mirrors Evinced's two auth modes, minus the sales call) unlocks cloud sync + dashboard.
- **Cloud API** (REST, API-key auth) is the same engine's ingestion/reporting surface, and later the CI + public-API surface. MCP and API share one engine package — no logic forks.
- **Why not remote-MCP-first:** codebase scanning needs file access next to the agent; local stdio is the seamless path in Claude Code/Cursor today. Remote MCP is additive later for dashboard queries from any client.
- Registry/distribution: npm (compiled/bundled artifacts, proprietary EULA per closed-freemium model) + MCP Registry listing + one-line configs documented for Claude Code (`claude mcp add`), Cursor, VS Code, Windsurf.

## 5. Core logic — Input → Black Box → Output

### 5.1 Input
**Developer-provided (all optional beyond a repo):** repo/files via the agent's workspace; `ally.config.json` (target WCAG level, framework hints, ignore patterns, auto-fix policy, severity budget); optionally a running app URL / Storybook for Pass 2; org context via API key.
**Auto-discovered:** framework + language detection (package.json, file extensions), component inventory + reuse graph (for clustering), design-system usage, routing structure, prior scan baseline (fingerprints from cloud or local cache), git diff scope (changed-files mode).

### 5.2 Black box — the three-pass engine
1. **Pass 1 — Deterministic static rules** (instant, offline, zero-false-positive class): AST analysis via framework adapters (react/tsx, html, vue). ~50 rules at v1 mapped to WCAG 2.2 SC (parity target: axe Linter's 44) — missing alt/label/lang, invalid ARIA role/attr/state, positive tabindex, click-on-div without role/keyboard, missing button type, duplicate ids, autofocus, iframe titles, table headers, heading order (statically inferable cases)…
2. **Pass 2 — Runtime verification** (optional URL/Storybook): Playwright renders; axe-core runs; custom checks add what axe misses (focus-visibility contrast sampling from screenshots, keyboard-reachability walk of interactables, target-size 24×24, computed contrast incl. gradients/images, DOM-mutation re-checks after interactions). Confirms/augments Pass 1; catches computed-only issues. This is our counter to Evinced's "like a sighted user" analysis, built on commodity headless tooling.
3. **Pass 3 — Semantic reasoning (the AI leapfrog):** for candidates no rule can decide (is this `div` really a button? is `alt="image123"` meaningful? does accessible name match visible label (SC 2.5.3)? is this custom widget a proper APG combobox? does this update need a live region?), the engine emits **reasoning packets**: `{evidence: code excerpt + a11y-tree slice + screenshot ref, hypothesis, rubric, APG/WCAG citation, verdict schema}`. **The host agent's LLM adjudicates** and returns structured verdicts the server validates. In CI/API mode (no host LLM) the same packets go to our cloud LLM (Claude via Vercel AI Gateway), metered. (Decision Q3.)

**Every finding:** `{fingerprint (stable across scans — Evinced-parity dedup: rule + normalized code/selector context hash), rule id, WCAG SC + level, severity: blocker|critical|serious|moderate|minor, confidence: certain|high|needs_review (Deque Advanced Rules precedent), user impact (affected modalities: screen reader/keyboard/low-vision/motor/cognitive), cluster key (component root cause), fix class}`.
**Action policy (server-enforced, user-configurable):** `SAFE_AUTOFIX` only when deterministic + behavior-preserving + idiomatic (missing `type="button"`, `tabindex="5"`→`0`, redundant/conflicting ARIA removal, missing `lang`, `aria-hidden` on focusable, duplicate id rename…). Anything needing content or intent (`alt` text wording, label copy, role changes on ambiguous widgets, color changes) → `SUGGEST` or `NEEDS_HUMAN`.

### 5.3 Output — five tiers (all five ship)
1. **Listing:** structured findings (JSON + SARIF export + agent-readable markdown).
2. **Prioritized list:** score = severity × confidence × reach (cluster instance count, route weight) × WCAG level distance from target; top-N with "fixing these 3 components clears 60% of issues" rollups.
3. **Remediation suggestions:** framework-idiomatic diff per finding + why (user-impact narrative) + WCAG/APG citation + docs link.
4. **Auto-fix:** for `SAFE_AUTOFIX` class, the MCP tool returns ready patches the agent applies as normal edits — always visible in git diff, never silent writes; batch mode "fix all no-brainers".
5. **Human-in-the-loop:** `NEEDS_HUMAN` findings go to (a) MCP elicitation prompts in-agent and (b) the dashboard review queue (approve → becomes a suggested patch next scan; reject → suppressed with reason, audit-trailed). Fix→re-scan verification closes the loop and prevents regressions (mirrors Evinced's workflow prompt, but enforced by the server).

**MCP surface (v1):** tools `scan_project`, `scan_files` (diff/changed-files mode), `get_findings` (tiered/filtered), `explain_finding`, `get_fixes` (patches by fix class), `resolve_reasoning` (Pass 3 verdict return), `sync_report` (cloud push), `configure_policy`; prompts `a11y_review_workflow` (Evinced-style guided loop), `fix_no_brainers`; resource `ally://report/latest`.

## 6. Observability dashboard (SaaS)
- **Entities:** org → project → scan → finding (+ cluster, + baseline). Supabase Postgres with RLS; ingest via `POST /api/v1/scans` (API key).
- **Views:** Overview (accessibility score + trend, severity/WCAG-level breakdown, agent-vs-human fix ratio); Findings explorer (filter by SC/severity/component/route/status/confidence); Clusters (root-cause components ranked by blast radius); Remediation (burndown, MTTR by severity — Evinced-parity metrics); Scan history (new vs recurring vs fixed via fingerprints; baseline compare; fail-on-new budget for CI later); Settings (WCAG target, auto-fix policy, ignores w/ audit trail, API keys).
- **Dogfood requirement:** dashboard itself meets WCAG 2.2 AA, is scanned by our own engine in CI, and we publish an accessibility statement modeled on Deque's (standards claimed, testing methodology, feedback channel, VPAT later).

## 7. Decomposition & phased delivery (too big for one plan — 3 sub-projects)
Per user decision, the MVP includes **all three engine passes**. To keep that shippable, SP1 is sequenced so each pass lands behind its own capability flag (Pass 2 remains optional at runtime — it activates only when the developer supplies an app/Storybook URL).

- **SP1 — MVP (first implementation plan):**
  1. pnpm+Turborepo monorepo: `packages/engine` (passes + findings model), `packages/mcp` (server), `apps/web` (dashboard), `packages/shared` (schemas).
  2. **Pass 1** static engine — react/tsx + html adapters, ~50 WCAG-mapped rules, golden-fixture corpus, fingerprinting + clustering v1.
  3. **Pass 3** agent-native reasoning — reasoning-packet emitter + `resolve_reasoning` verdict validation (semantic checks: alt-text quality, ambiguous interactives, name-vs-label, APG pattern conformance).
  4. **Pass 2** runtime verification — Playwright orchestration against a user-supplied URL/Storybook; axe-core integration; custom checks (keyboard-reachability walk, focus-visibility sampling, target-size, computed contrast); static↔runtime finding correlation.
  5. MCP server with the full v1 tool surface (§5.3), tiered output, server-enforced auto-fix policy.
  6. Cloud: Supabase schema (RLS) + ingest route; dashboard: auth, projects, findings explorer, severity/WCAG breakdown, trend chart, API keys. Deployed to Vercel.
  TDD throughout; MVP exit = scan→prioritize→auto-fix→re-scan loop working end-to-end in Claude Code and Cursor with results visible in the dashboard.
- **SP2 — Observability depth:** clustering v2 + baselines/fail-on-new; dashboard analytics (cluster explorer, MTTR, burndown, HITL review queue); Vue adapter; benchmark harness vs axe-core/axe Linter; suppression audit trail.
- **SP3 — Scale & revenue:** Stripe billing for Pro/Team (closed-freemium tiers per §3); GitHub Action + public REST scan API; remote Streamable-HTTP MCP (OAuth 2.1); docs site; MCP Registry + npm launch; accessibility statement + VPAT export.
- **Backlog:** mobile (iOS/Android) scanning, design-tool assistant, Jira export, SSO/enterprise.

## 8. Verification strategy
- **Engine:** golden corpus — per rule a seeded-violation fixture + clean fixture; assert exact findings (recall) and zero findings on clean set (precision). Benchmark harness runs our engine vs axe-core/axe Linter on the corpus + real OSS apps → substantiates "finds more, false-positives fewer" before we market it (Evinced's 19× teaches: claims need a published methodology).
- **MCP:** protocol-level tests with a scripted MCP client (tool discovery, scan→fix→re-scan loop, policy enforcement, elicitation paths); manual smoke in Claude Code + Cursor.
- **Cloud:** Playwright e2e (signup → key → synced scan → dashboard views); our own engine scanning the dashboard in CI (dogfood gate); RLS tests for tenant isolation.

## 9. Resolved decisions (user, 2026-07-21)
1. **GTM/monetization: Closed freemium.** Proprietary code; free tier (zero-signup local scans + 1 synced project) + paid Pro/Team. No open-sourcing of the engine.
2. **MVP scope: All three passes in MVP.** Static + runtime + agent-native semantic reasoning all ship in SP1 (sequenced Pass 1 → 3 → 2 internally; Pass 2 optional at runtime, needs an app URL).
3. **Pass-3 economics: Agent-native.** Host agent's LLM adjudicates reasoning packets; our metered cloud LLM only later for CI/API mode.
4. **Cloud stack: Vercel + Next.js + Supabase** (Postgres/RLS + Auth + API keys).

## 10. Risks
- **False positives destroy trust** → severity-gated confidence model, `certain`-only auto-fix, suppression with audit, precision measured in CI.
- **Claims parity** ("better than Evinced") → no public claims until benchmark harness produces reproducible numbers.
- **axe-core license (MPL-2.0)** → used as unmodified dependency in Pass 2; our rules stay original work.
- **MCP client capability drift** (elicitation/sampling support varies) → reasoning packets degrade gracefully to plain tool output; no hard dependency on sampling.
- **Runtime pass needs a running app** → static pass is the zero-setup default; Pass 2 always optional.
- **MVP breadth (all 3 passes)** → sequenced delivery inside SP1 with capability flags; if timeline slips, Pass 2 ships as a fast-follow point release without blocking launch of Passes 1+3.
- **Closed-source trust deficit with developers** (no GitHub stars flywheel) → compensate with zero-signup free tier, published benchmark methodology + reproducible corpus, and public changelogs/docs.

## 11. Next steps after approval
1. Materialize this doc as the spec: `docs/superpowers/specs/2026-07-22-ally-a11y-mcp-platform-design.md`; `git init` + initial commit.
2. Invoke **superpowers:writing-plans** to produce the SP1 implementation plan (TDD task breakdown).
3. Execute SP1 per that plan (subagent-driven or executing-plans flow), then SP2/SP3 each with their own plan.
