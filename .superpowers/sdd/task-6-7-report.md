# Task 6 & 7 Report

## Task 6: Wave C ARIA/Structure/Document Rule Tests

### Files created
- `packages/engine/tests/rules-aria.test.ts` — 8 tests
- `packages/engine/tests/rules-document.test.ts` — 7 tests

### Findings discovered
**bad/aria.tsx** fires: aria-role-valid, aria-props-valid, aria-hidden-on-focusable, no-redundant-role (x3), form-control-missing-label, heading-has-content, plus button-missing-type (Wave B).

**bad/page.html** fires: all of the above ARIA rules plus doc-missing-lang, doc-missing-title, duplicate-id (x2: one SAFE_AUTOFIX for unreferenced "dup", one SUGGEST for referenced "refdup").

**Clean fixtures**: zero findings for ARIA/document rules (clean files do trigger some Wave B interactive-supports-focus findings which are correctly excluded from ARIA test assertions).

### fixClass validation
- duplicate-id on unreferenced ids → SAFE_AUTOFIX ✓
- duplicate-id on referenced ids (label for="refdup") → SUGGEST ✓

## Task 7: Auto-fix Patch Engine

### Files created
- `packages/engine/src/fixes.ts` — `applyEdits()` and `collectFixes()`
- `packages/engine/tests/fixes.test.ts` — 5 tests

### API
- `applyEdits(source, edits)` — line/col splice, bottom-up order, throws on overlap
- `collectFixes(report, {classes, fingerprints?})` — filters findings by fixClass and optional fingerprints

### Idempotency gates
- **bad/interactive.tsx**: SAFE_AUTOFIX fixes (interactive-supports-focus, tabindex-positive, no-autofocus, button-missing-type) applied, re-scanned, fixed rules do not re-fire, no new findings introduced.
- **bad/page.html**: SAFE_AUTOFIX fixes (no-redundant-role x3, duplicate-id unreferenced) applied, re-scanned, those rules do not re-fire.

### Exports added to `packages/engine/src/index.ts`
- `applyEdits`, `collectFixes`

## Test Summary
- 75 tests passing across 10 test files
- Full build (`pnpm build`) succeeds

## Commits
1. `71fd47e` — `test(engine): Wave C ARIA/structure/document rule tests`
2. `146a910` — `feat(engine): auto-fix patch engine with idempotency gate`
