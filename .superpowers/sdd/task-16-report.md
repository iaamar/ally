# Task 16 Report: Next.js scaffold + auth + accessible shell + ingest API

## Status: COMPLETE

## What was done

### Scaffold
- Scaffolded Next.js 15 app at `apps/web/` using `create-next-app@15`
- Added deps: `@supabase/supabase-js ^2.47`, `@supabase/ssr ^0.6`, `@ally/shared workspace:*`
- Added devDep: `vitest`
- Preserved existing `apps/web/supabase/migrations/0001_init.sql` and `apps/web/lib/database.types.ts`

### TDD (13 tests, all passing)
- `tests/keys.test.ts` (6 tests): raw prefix, length, hash format, hashApiKey consistency, uniqueness
- `tests/ingest.test.ts` (7 tests): null key 401, bad key 401, malformed body 400, valid ingest 201, touchKey called, insertFindings mapped, upsertProject called

### Implementation
- `lib/keys.ts`: `generateApiKey()` and `hashApiKey()` using crypto
- `lib/ingest.ts`: `processIngest()` with dependency-injected `IngestDb` interface
- `lib/orgs.ts`: `ensureOrg()` for org auto-creation
- `lib/supabase/server.ts`: Server-side Supabase client
- `lib/supabase/client.ts`: Browser-side Supabase client
- `lib/supabase/middleware.ts`: Session refresh + auth redirect
- `middleware.ts`: Next.js middleware wiring
- `app/layout.tsx`: Accessible layout with `<html lang="en">`, SkipLink, nav, `<main id="main">`
- `app/globals.css`: CSS tokens, `:focus-visible` outline, dark mode, `.visually-hidden`, `.skip-link`
- `components/SkipLink.tsx`: Skip-to-main-content link
- `app/login/page.tsx`: Email OTP login with server action, `role="status"` success message
- `app/auth/callback/route.ts`: Code exchange redirect
- `app/api/v1/scans/route.ts`: POST ingest route with typed Database client
- `.env.example`: Placeholder env vars

### Build
- `pnpm --filter web build` compiles successfully (Turbopack)

## Test Summary
- 2 test files, 13 tests, all passing
- keys.test.ts: 6 passed
- ingest.test.ts: 7 passed
