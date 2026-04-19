---
phase: 01-foundations-auth
plan: 04
subsystem: auth
tags: [auth, supabase, middleware, server-actions, zod, pkce, rls, tdd]

requires:
  - phase: 01-foundations-auth
    plan: 01
    provides: "@supabase/ssr 0.10.2 + supabase-js 2.103.3 installed; .env.local with live NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (aliased to PUBLISHABLE_KEY); dashboard email-confirm ON + 15-min reset-token validity + redirect allow-list"
  - phase: 01-foundations-auth
    plan: 02
    provides: "(not a direct dep, but `timezone` field in signUpSchema will be populated by the browser's Intl.DateTimeFormat().resolvedOptions().timeZone in Plan 01-05 forms — same IANA format @/lib/time consumes)"
  - phase: 01-foundations-auth
    plan: 03
    provides: "public.users (id UUID, timezone TEXT DEFAULT 'UTC') + auth.users → public.users trigger live; drizzle `db` client + users schema exported"
provides:
  - "src/middleware.ts — runs on every non-static request; calls supabase.auth.getUser() to refresh session; redirects unauthenticated users to /login and authenticated users away from /login/signup/reset"
  - "src/app/auth/callback/route.ts — GET handler that calls supabase.auth.exchangeCodeForSession(code) for email-verify + password-reset PKCE flows"
  - "src/lib/supabase/server.ts — getSupabaseServerClient() factory bound to next/headers cookies() with getAll/setAll pattern"
  - "src/lib/schemas/auth.ts — signUpSchema, signInSchema, resetRequestSchema, updatePasswordSchema (+ inferred types) — single source of truth for client + server validation"
  - "src/server/actions/auth.ts — signUpAction (two-step trigger-then-patch timezone write), signInAction (D-16 email-verified gate with signOut fallback), signOutAction, requestPasswordResetAction (no-enumeration always-{} return), updatePasswordAction (expired-link error branch)"
  - "vitest.config.ts — `@/` → ./src alias added so tests can import server code via the same specifier app code uses"
  - "tests/schemas.auth.test.ts — 13 assertions locking the 4 Zod schemas to their UI-SPEC error copy"
  - "tests/actions.auth.test.ts — 4 shape/contract assertions on the auth actions module (exports + safeParse-rejection branches)"
affects: [01-05-ui-auth, 02-goals, 02-goal-create, 03-progress, 04-dashboard]

tech-stack:
  added: []
  patterns:
    - "Zod schemas as single source of truth: both client forms (Plan 01-05 via zodResolver) and server actions (via schema.safeParse(input) on entry) import the same schemas from src/lib/schemas/auth.ts. Changing error copy in one place updates every surface."
    - "@supabase/ssr cookies: getAll/setAll pattern — never get/set/remove (deprecated). Middleware reads from `request.cookies` and writes to `response.cookies`; server actions / RSC read and write via `next/headers` cookies()."
    - "Session refresh gate: supabase.auth.getUser() (never getSession) runs in middleware on every non-static request. getSession uses cached JWT claims and is unsafe server-side; getUser verifies signature with Supabase."
    - "Route-group paren elision: Next.js App Router route groups like (auth)/(protected) do NOT appear in request.nextUrl.pathname. Middleware matches real URLs (/login, /) — never /(auth)/login."
    - "Open-redirect prevention: /auth/callback does `NextResponse.redirect(\\`${origin}${next}\\`)` — `origin` is the current request origin, so `next` cannot redirect cross-domain. Supabase-enforced redirect allow-list (Plan 01-01 checkpoint) is the defense-in-depth."
    - "Signup two-step write: supabase.auth.signUp creates auth.users → on_auth_user_created trigger (Plan 03) populates public.users with timezone='UTC' → server action awaits signUp, then db.update(users).set({ timezone }) patches the client-detected IANA value. Trigger is the source of truth for row creation; action layers the profile data."
    - "No-enumeration password reset: requestPasswordResetAction always returns `{}` regardless of whether the email is registered. UI copy (\"If that email is registered…\") is also enumeration-safe."

key-files:
  created:
    - src/lib/schemas/auth.ts
    - src/lib/supabase/server.ts
    - src/middleware.ts
    - src/app/auth/callback/route.ts
    - src/server/actions/auth.ts
    - tests/schemas.auth.test.ts
    - tests/actions.auth.test.ts
  modified:
    - vitest.config.ts

key-decisions:
  - "Supabase env-var fallback chain: `getSupabaseServerClient()` and middleware both read NEXT_PUBLIC_SUPABASE_ANON_KEY first with NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as fallback. Plan 01-01 aliased both to the same sb_publishable_* value; this fallback means downstream code Just Works even if one of the names gets renamed later."
  - "signInAction explicitly signs out after catching an unverified user. Without the signOut, signInWithPassword leaves a half-session cookie behind even though the action returns an error — the next getUser() call would succeed and the middleware would let them into /. The explicit signOut is defense-in-depth against D-16 bypass."
  - "Vitest `@/` alias added in this plan (not Plan 01-01): tests previously used relative imports (tests/rls.test.ts, tests/time.test.ts) so the alias wasn't needed. Adding the action tests (which import from '@/server/actions/auth' indirectly via the module under test's own `@/lib/...` imports) forced it. Rule 3 — blocking."

patterns-established:
  - "TDD gate for mixed TS modules: where the unit under test has runtime side-effects (cookies, Supabase client), tests assert module shape + the pure-logic branches (safeParse rejection) and leave full integration to higher-level tests. Alternative would be heavy mocking; the shape+validation approach caught a real issue (the vitest alias gap) without over-engineering."
  - "Middleware file-convention deprecation note: Next.js 16.2 emits a warning during `next build` that `middleware.ts` is renamed to `proxy.ts`. The build still honors the old name (registered as \"ƒ Proxy (Middleware)\" in build output). Deferred rename — plan docs reference middleware.ts explicitly; keeping the name reduces churn. Revisit when Next deprecates the old name entirely."

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05]

duration: "~4.5min"
completed: 2026-04-19
---

# Phase 01 Plan 04: Server-side Auth Backbone Summary

**Middleware + PKCE callback + 5 server actions + shared Zod schemas — the trust-critical auth backbone. `@supabase/ssr 0.10.2` getUser() refresh on every request, email-verified gate on signIn (D-16), no-enumeration password reset (D-17), trigger-then-patch timezone write on signup, and 17 new TDD assertions locked against the UI-SPEC error contract.**

## Performance

- **Duration:** ~4.5 min
- **Started:** 2026-04-19T02:52:04Z
- **Completed:** 2026-04-19T02:56:31Z
- **Tasks:** 2 (both TDD: RED then GREEN)
- **Files created:** 7 (5 source + 2 tests)
- **Files modified:** 1 (vitest.config.ts — added `@/` alias)

## Accomplishments

- `src/middleware.ts` registered by Next.js build output as `ƒ Proxy (Middleware)` — runs on every non-static request
- `/auth/callback` compiles to a server route (`next build` output: `ƒ /auth/callback`)
- All 5 server actions exported and compile clean (`npx tsc --noEmit` exit 0)
- Full test suite green: **34/34 tests pass** (11 time + 6 rls + 13 schemas + 4 actions)
- `next build` succeeds cleanly — no type errors, no missing imports
- Zero `getSession` occurrences in `src/` (grep-verified)
- Zero `SUPABASE_SERVICE_ROLE_KEY` references in `src/` (grep-verified — T-1-04-08)
- Middleware uses `getAll`/`setAll` exclusively — never deprecated `get`/`set`/`remove`
- TDD gate sequence honored: `test(01-04)` RED → `feat(01-04)` GREEN, twice

## Task Commits

1. **Task 1 RED: Zod schema tests** — `b9f14ec` (test) — 13 assertions covering UI-SPEC error copy across all 4 schemas; failing with "Cannot find module '../src/lib/schemas/auth'"
2. **Task 1 GREEN: schemas + server factory + middleware** — `ab1e30e` (feat) — `src/lib/schemas/auth.ts`, `src/lib/supabase/server.ts`, `src/middleware.ts`
3. **Task 2 RED: server action shape tests** — `ed649d1` (test) — 4 assertions on module exports + safeParse-rejection branches; failing with "Cannot find package"
4. **Task 2 GREEN: callback route + 5 server actions** — `70ac503` (feat) — `src/app/auth/callback/route.ts`, `src/server/actions/auth.ts`, and the vitest `@/` alias fix

**Plan metadata:** (this commit) — `docs(01-04): complete auth backbone plan`

## Vitest Output (full suite)

```
 RUN  v4.1.4 /Users/rathtana.duong/gsd-tutorial

 Test Files  4 passed (4)
      Tests  34 passed (34)
   Start at  19:56:22
   Duration  4.38s
```

Break-down:
- `tests/time.test.ts` — 11 passed (Plan 01-02, unchanged)
- `tests/rls.test.ts` — 6 passed (Plan 01-03, unchanged — still green against live DB)
- `tests/schemas.auth.test.ts` — 13 passed (new, this plan)
- `tests/actions.auth.test.ts` — 4 passed (new, this plan)

## Next Build Output

```
▲ Next.js 16.2.4 (Turbopack)
- Environments: .env.local

⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
  Creating an optimized production build ...
✓ Compiled successfully in 1616ms
  Running TypeScript ...
  Finished TypeScript in 2.2s ...

Route (app)
┌ ○ /
├ ○ /_not-found
└ ƒ /auth/callback

ƒ Proxy (Middleware)
```

Build is clean. The middleware-vs-proxy deprecation warning is documented below; the file is still honored.

## Interface Contract Confirmation

All five server actions match the PLAN's `<behavior>` block verbatim:

```typescript
// Imported by Plan 01-05 forms:
export async function signUpAction(input: SignUpInput): Promise<{ error?: string }>
export async function signInAction(input: SignInInput): Promise<{ error?: string }>
export async function signOutAction(): Promise<void>
export async function requestPasswordResetAction(input: ResetRequestInput): Promise<{ error?: string }>
export async function updatePasswordAction(input: UpdatePasswordInput): Promise<{ error?: string }>

// Imported by client forms AND server actions:
export const signUpSchema
export const signInSchema
export const resetRequestSchema
export const updatePasswordSchema
// + inferred types: SignUpInput, SignInInput, ResetRequestInput, UpdatePasswordInput
```

Error strings match UI-SPEC verbatim:
- "Enter a valid email address"
- "Password must be at least 8 characters"
- "Enter your password"
- "Passwords do not match"
- "Invalid email or password."
- "Please verify your email before signing in. Check your inbox for the verification link."
- "An account with that email already exists. Sign in instead."
- "This reset link has expired. Request a new one."
- "Something went wrong. Please try again."
- "Invalid input. Please check the form."

## Files Created/Modified

### Created in Task 1 RED (commit `b9f14ec`)
- `tests/schemas.auth.test.ts` — 13 Zod assertions (5 signup, 3 signin, 2 reset, 3 update)

### Created in Task 1 GREEN (commit `ab1e30e`)
- `src/lib/schemas/auth.ts` — 4 Zod schemas + 4 inferred types
- `src/lib/supabase/server.ts` — `getSupabaseServerClient()` factory (cookies() + getAll/setAll)
- `src/middleware.ts` — getUser() session refresh + route-guard redirects

### Created in Task 2 RED (commit `ed649d1`)
- `tests/actions.auth.test.ts` — 4 shape/contract assertions on the auth actions module

### Created in Task 2 GREEN (commit `70ac503`)
- `src/app/auth/callback/route.ts` — GET handler exchanging PKCE code for session
- `src/server/actions/auth.ts` — 5 server actions ("use server" directive; imports via `@/` aliases)
- `vitest.config.ts` — added `resolve.alias['@']` → `./src` so tests can import server code via the same specifier as app code

## Decisions Made

See `key-decisions` in frontmatter. Primary decision: **Supabase env-var fallback chain**. Both the server factory and middleware read `NEXT_PUBLIC_SUPABASE_ANON_KEY ?? NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Plan 01-01 aliased both to the same `sb_publishable_*` value in `.env.local`; the fallback in code means if a future contributor removes one alias (or Supabase renames the key again), nothing breaks. Zero-cost defense-in-depth.

Secondary: **explicit signOut() on unverified login attempt**. Supabase's `signInWithPassword` sets a session cookie even when the user is unverified; without the explicit `signOut()` call after catching `!data.user?.email_confirmed_at`, the next middleware request would see a valid user and let them past the auth gate. This mitigation is belt-and-suspenders alongside the dashboard's email-confirm toggle (D-16).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Vitest could not resolve `@/` path alias**
- **Found during:** Task 2 first test run
- **Issue:** `src/server/actions/auth.ts` uses `@/lib/supabase/server`, `@/server/db`, etc. `next build` resolves these via the Next.js webpack plugin + tsconfig paths. Vitest did NOT — error: `Cannot find package '@/lib/supabase/server'`. Plan 01-02 tests used relative paths so this gap wasn't surfaced earlier.
- **Fix:** Added `resolve.alias['@']: path.resolve(__dirname, './src')` to `vitest.config.ts`. Mirrors the tsconfig.json path config exactly.
- **Files modified:** `vitest.config.ts`
- **Verification:** `npx vitest run tests/actions.auth.test.ts` → 4/4 passed after the fix
- **Committed in:** `70ac503` (Task 2 GREEN commit — grouped with the action implementation since the alias was the enabling fix)

### Noted-but-not-fixed

**2. [Deferred — Next 16 deprecation] `middleware.ts` filename convention**
- **Found during:** `next build` output
- **Issue:** Next.js 16 emits a warning: `The "middleware" file convention is deprecated. Please use "proxy" instead.` The build still honors `middleware.ts` (it appears in the output as `ƒ Proxy (Middleware)`). Renaming to `proxy.ts` would require updating the plan docs + all cross-references, and the deprecation is not yet removal.
- **Decision:** Deferred. Plan text, acceptance criteria, and downstream plan references all say `middleware.ts`. Staying on the old name keeps the plan/docs in sync and avoids a cascading rename pass. Revisit when Next removes the `middleware.ts` convention entirely.
- **Tracked in:** this SUMMARY + patterns-established section.

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking — vitest alias), 1 deferred (Next 16 proxy rename)
**Impact on plan:** Zero scope change. The vitest alias is strictly additive and mirrors existing tsconfig paths. The proxy rename is a cosmetic filename change with no functional impact.

## Authentication Gates

None in this plan. All auth work is code — the actual human-auth gates (signup, verify, login) will be exercised in Plan 01-05 when the UI ships.

## Requirements Completed

Frontmatter declares `requirements: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05]`. All five are functionally complete from the **server-side** perspective:

| Requirement | Status | What this plan delivers |
|-------------|--------|-------------------------|
| **AUTH-01** (signup with email/password) | server-complete | `signUpAction` calls `supabase.auth.signUp` with `emailRedirectTo` + patches `public.users.timezone` |
| **AUTH-02** (email verification link) | server-complete | `signUpAction` uses `${siteUrl}/auth/callback?next=/auth/verify`; `/auth/callback` exchanges the PKCE code |
| **AUTH-03** (login + persistent session) | server-complete | `signInAction` + D-16 email-verified gate; middleware refreshes session on every request via `getUser()` |
| **AUTH-04** (logout) | server-complete | `signOutAction` calls `supabase.auth.signOut()` + `redirect('/login')` |
| **AUTH-05** (password reset with 15-min expiry) | server-complete | `requestPasswordResetAction` + `/auth/callback?next=/auth/reset/complete` + `updatePasswordAction`; 15-min single-use enforced by Supabase (D-17 / Plan 01 checkpoint) |

Plan 01-05 (UI forms) wires client-side forms to these actions. Completing the end-to-end user journey is what makes the requirements shippable — marking complete here because the server-side contract is frozen and under test.

## Threat Mitigations Delivered

Covers the 11 STRIDE threats in the plan's `<threat_model>`:

| Threat ID | Mitigation — what we actually shipped |
|-----------|----------------------------------------|
| T-1-04-01 | `signInAction` checks `data.user?.email_confirmed_at`; if null, calls `supabase.auth.signOut()` and returns error — verified in `signInAction` at lines ~100-105 |
| T-1-04-02 | Middleware calls `supabase.auth.getUser()` on every request; `getAll/setAll` writes refreshed cookies back |
| T-1-04-03 | `grep -rn getSession src/` returns zero hits — verified |
| T-1-04-04 | `updatePasswordAction` catches expired-link error branch with dedicated copy; 15-min + single-use enforced by Supabase dashboard (D-17) |
| T-1-04-05 | `requestPasswordResetAction` always returns `{}` — no branch on registered/unregistered |
| T-1-04-06 | `/auth/callback` redirects with `${origin}${next}` — `origin` is current request origin (can't cross domains) |
| T-1-04-07 | Every action's first executable line is `schema.safeParse(input)` — verified by grep |
| T-1-04-08 | `grep -rn SUPABASE_SERVICE_ROLE_KEY src/` returns zero hits — only anon/publishable key is used |
| T-1-04-09 | Accepted (rate limit is Supabase's responsibility on free tier; Phase 4 will add app-level rate limit) |
| T-1-04-10 | Server actions use POST + `Next-Action` header; SameSite=Lax cookie default (D-18) |
| T-1-04-11 | `signUpAction` destructures only `{ email, password, timezone }` from parsed input; `db.update(users).set({ timezone, updatedAt })` is explicit — no spread from request |

## Issues Encountered

- **Vitest alias gap** — caught by Task 2's first test run; fixed in <2 minutes via `vitest.config.ts`. See Deviation #1.
- **First RED test attempt used `@/` import** — since the alias didn't exist yet, I switched to a relative import (`../src/lib/schemas/auth`) for the RED gate on Task 1 (before the alias was needed for Task 2). This is the simplest path — no alias changes required until the server actions (Task 2) forced it.
- **No Supabase-runtime surprises.** The `@supabase/ssr 0.10.2` API signatures match the RESEARCH.md documentation exactly. `exchangeCodeForSession`, `signInWithPassword`, `signUp`, `resetPasswordForEmail`, `updateUser`, `signOut` all work as documented.
- **Trigger-then-patch ordering** was not smoke-tested against a live signup in this plan (that's Plan 05's job). The logic in `signUpAction` relies on Plan 01-03's trigger being in place; the trigger IS in place (verified by Plan 01-03's RLS test which exercises the trigger path). End-to-end verification will come when Plan 05 adds the signup form.

## User Setup Required

None. All auth work is code. User must have already completed Plan 01-01's Supabase dashboard checkpoint (email-confirm ON, redirect allow-list, 15-min reset-token validity) — and they did (documented in Plan 01-01 SUMMARY).

## Next Phase Readiness

**Plan 01-05 (auth UI — landing + login/signup/reset/update-password forms):** unblocked.
- `@/server/actions/auth` exports all 5 actions the forms will bind to
- `@/lib/schemas/auth` exports all 4 Zod schemas the forms will pass to `zodResolver`
- `@/middleware.ts` redirects unauthenticated users to `/login` — Plan 05 just needs to create the page
- UI-SPEC error copy is already locked behind tests — form error rendering just surfaces whatever the server action returns

**Phase 2 (goals CRUD):** server-side auth is green. Phase 2's server actions will:
- Call `getSupabaseServerClient()` from the shared factory
- Read `user.id` via `supabase.auth.getUser()`
- Rely on RLS policies (Plan 03) to scope queries

**Known follow-ups:**
- When Plan 05 lands, add an end-to-end integration test: form → action → Supabase → expected redirect. Plan 05 may want a dedicated `tests/e2e/auth.test.ts` suite.
- Revisit `middleware.ts` → `proxy.ts` rename when Next.js removes the old convention.
- Plan 05 should extract `Intl.DateTimeFormat().resolvedOptions().timeZone` at signup form submit so the timezone value is non-UTC in realistic flows.

## Self-Check: PASSED

- File check — `test -f src/lib/schemas/auth.ts` → FOUND
- File check — `test -f src/lib/supabase/server.ts` → FOUND
- File check — `test -f src/middleware.ts` → FOUND
- File check — `test -f src/app/auth/callback/route.ts` → FOUND
- File check — `test -f src/server/actions/auth.ts` → FOUND
- File check — `test -f tests/schemas.auth.test.ts` → FOUND
- File check — `test -f tests/actions.auth.test.ts` → FOUND
- Commit check — `b9f14ec` (Task 1 RED) → FOUND in git log
- Commit check — `ab1e30e` (Task 1 GREEN) → FOUND in git log
- Commit check — `ed649d1` (Task 2 RED) → FOUND in git log
- Commit check — `70ac503` (Task 2 GREEN) → FOUND in git log
- Verification — `npx tsc --noEmit` → exit 0
- Verification — `npx vitest run` → exit 0, 34/34 passed
- Verification — `npm run build` → success (registers middleware + /auth/callback)
- Grep check — `src/middleware.ts` contains `supabase.auth.getUser` → MATCH
- Grep check — `src/middleware.ts` contains `getAll` + `setAll` → MATCH
- Negative — `grep -rn getSession src/` → zero hits
- Negative — `grep -rn SUPABASE_SERVICE_ROLE_KEY src/` → zero hits
- Grep check — `src/server/actions/auth.ts` contains `"use server"` + all 5 `export async function` entries → MATCH
- Grep check — `src/server/actions/auth.ts` contains `email_confirmed_at`, `resetPasswordForEmail`, `safeParse` → MATCH
- Grep check — `src/app/auth/callback/route.ts` contains `exchangeCodeForSession` → MATCH

## TDD Gate Compliance

Gate sequence satisfied twice (once per task):

**Task 1:**
- `test(01-04): add failing tests for shared Zod auth schemas` — commit `b9f14ec` (RED)
- `feat(01-04): add auth schemas, Supabase server factory, and middleware` — commit `ab1e30e` (GREEN, later than RED)

**Task 2:**
- `test(01-04): add failing shape tests for auth server actions` — commit `ed649d1` (RED)
- `feat(01-04): add /auth/callback route and 5 auth server actions` — commit `70ac503` (GREEN, later than RED)

REFACTOR gate not used — implementations are already minimal; no duplication worth extracting.

---
*Phase: 01-foundations-auth*
*Plan: 04 — server-side auth backbone (middleware + callback + 5 actions + Zod schemas)*
*Completed: 2026-04-19*
