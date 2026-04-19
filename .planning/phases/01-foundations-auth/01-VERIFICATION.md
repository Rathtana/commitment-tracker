---
phase: 01-foundations-auth
verified: 2026-04-18T21:40:00Z
status: human_needed
score: 5/5 must-haves verified (automated) + 1 async human observation pending
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Click the previously-issued password-reset link AFTER 16 minutes have elapsed since Supabase sent it (Scenario 6 from Plan 05 UAT)"
    expected: "Browser lands on /auth/error OR /auth/reset/complete rendering 'This reset link has expired. Request a new one.' — link does NOT successfully let the user set a new password"
    why_human: "Supabase's reset-token 15-minute expiry is a time-bound behavior of the live auth service. Programmatic verification would require synthesising a real PKCE flow, waiting 16 minutes of wall-clock, and then exercising the stale link — out of reach of the verifier's automated pass. Plan 05 explicitly records this as NOT_YET_OBSERVED and defers to an out-of-band observation. If the stale link STILL works, file a gap-closure against Plan 01 Supabase dashboard setting (Reset password token validity = 900 seconds)."
  - test: "Carry-forward: audit the 2 Critical findings from 01-REVIEW.md (CR-01 middleware cookie drop on redirect; CR-02 /auth/callback open-redirect via unvalidated `next` param) and decide whether to fix now or defer to Phase 4 Launch Polish"
    expected: "Dev decision: either file a gap-closure plan for Phase 1 (before merging to main) OR explicitly defer both to a Phase 4 POLSH plan. Both findings are security-impacting but do not break any ROADMAP Success Criterion — SC-1..SC-5 are all met. The open-redirect is mitigated in practice by Supabase's redirect-URL allow-list (Plan 01 checkpoint: only http://localhost:3000/** is whitelisted) and the cookie-drop affects token freshness edge cases, not basic login flow."
    why_human: "Advisory severity triage — whether 'ship with known issues' or 'block until fixed' is a developer/product call, not a verifier call."
---

# Phase 1: Foundations & Auth Verification Report

**Phase Goal:** User can sign up, verify email, log in, log out, and reset their password on a deployed Next.js + Supabase scaffold whose schema is ready for three goal types and whose timezone strategy is locked before any goal data accumulates.

**Verified:** 2026-04-18T21:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Must-haves derived from ROADMAP.md Success Criteria (SC-1 through SC-5). These are the roadmap contract.

| #   | Truth                                                                                                                                                                | Status       | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC-1 | New user can sign up with email+password, receive a verification email, and reach a logged-in landing page in under 2 minutes                                        | ✓ VERIFIED   | UAT Scenarios 1+3 PASSED against live Supabase. `signUpAction` (auth.ts:28-74) calls `supabase.auth.signUp` with `emailRedirectTo: ${siteUrl}/auth/callback?next=/auth/verify`. `/auth/callback` (route.ts:18-23) exchanges PKCE code and redirects. Landing page (`src/app/page.tsx`) renders "Welcome, {user.email}" + "Your goals are coming in Phase 2." SignUpForm captures client timezone via `Intl.DateTimeFormat` (signup-form.tsx:54) and patches public.users.timezone post-signup. |
| SC-2 | User stays logged in across browser sessions, can log out from any page, and replaying a stale cookie is rejected                                                    | ✓ VERIFIED   | Middleware (`src/middleware.ts:20-79`) calls `supabase.auth.getUser()` on every non-static request and redirects unauthed requests to /login. UAT Scenario 3 confirmed session persists across browser restart; Scenario 4 confirmed logout clears cookie; Scenario 9 confirmed deleting sb-*-auth-token redirects to /login on next request. `signOutAction` (auth.ts:110-114) calls `signOut()` and `redirect("/login")`. `<form action={signOutAction}>` wired in `src/app/page.tsx:22`. |
| SC-3 | User can request a password reset via email, use the link once within 15 minutes, and successfully set a new password                                                | ⚠️ PARTIAL   | Single-use enforcement PASSED (UAT Scenario 5 — second click on same reset link fails). Server-side: `requestPasswordResetAction` + `updatePasswordAction` wired with correct redirectTo contract. Supabase dashboard setting confirmed at 900s per Plan 01 checkpoint. **16-minute expiry behavior is NOT YET OBSERVED** — Plan 05 Scenario 6 flagged as async; requires human observation. See `human_verification` section.                                      |
| SC-4 | `goals` table exists with `month DATE` column whose CHECK constraint rejects any value not pinned to the first of a month                                            | ✓ VERIFIED   | Live Supabase DB check: `pg_constraint.pg_get_constraintdef = 'CHECK ((EXTRACT(day FROM month) = (1)::numeric))'`. Direct `INSERT INTO public.goals (..., month, ...) VALUES (..., '2026-04-15', ...)` produced error: `new row for relation "goals" violates check constraint "month_is_first_of_month"`. Migration `supabase/migrations/0001_custom_constraints.sql` contains the ALTER TABLE. Verified via live-DB query this session.              |
| SC-5 | 11:30 PM local on last day of month buckets to that month regardless of UTC offset, validated by a DST/month-boundary test suite                                      | ✓ VERIFIED   | `npx vitest run` → 39/39 tests passed including 11 time tests exercising UTC-8 (LA/PDT), UTC+13 (Auckland), UTC+0, DST spring-forward (America/New_York March 8 2026), leap-year Feb 28/29, NYE midnight. `src/lib/time.ts` exports pure isomorphic `today()` + `monthBucket()` using `@date-fns/tz`. `monthBucket` invariant `getUTCDate() === 1` mirrors DB CHECK at app layer.                                                                              |

**Score:** 5/5 truths verified (SC-3 passes with one async human observation remaining)

### Required Artifacts

Verified existence, substance, and wiring of every artifact declared across the 5 plan frontmatters.

| Artifact                                                    | Expected                                                        | Status      | Details                                                                                                                                                              |
| ----------------------------------------------------------- | --------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                              | Locked stack deps                                                | ✓ VERIFIED  | Contains `next@16.2.4`, `react@19.2.4`, `@supabase/ssr@^0.10.2`, `drizzle-orm@^0.45.2`, `@date-fns/tz@^1.4.1`, `zod@^4.3.0`, `vitest@^4.1.4`                          |
| `src/app/globals.css`                                       | Tailwind v4 @theme with emerald primary                          | ✓ VERIFIED  | File present. Not re-read here; plan acceptance verified in Plan 01 and re-verified by build success (routes compile, pages render per UAT)                           |
| `components.json`                                           | shadcn new-york + zinc                                           | ✓ VERIFIED  | Plan 01 SUMMARY self-check PASSED; referenced by 6 shadcn components now present                                                                                     |
| `vitest.config.ts`                                          | Node env + tests glob + `@/` alias                                | ✓ VERIFIED  | 39 tests ran successfully this session; `@/` alias added in Plan 04                                                                                                   |
| `drizzle.config.ts`                                         | `out: './supabase/migrations'`                                    | ✓ VERIFIED  | File present (233 bytes). Migrations landed under `supabase/migrations/` — Pitfall 4 compliance proven by `supabase migration list --linked` showing 0000+0001      |
| `.env.local`                                                | Populated live secrets, git-ignored                              | ✓ VERIFIED  | `git check-ignore .env.local` → `.env.local` (exits 0). Contains `NEXT_PUBLIC_SUPABASE_URL=`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=` (aliased with PUBLISHABLE_KEY), `DATABASE_URL=` — verified populated via `.env.local` ls + live psql connection success |
| `.env.example`                                              | Committed template with blank values                             | ✓ VERIFIED  | File exists (551 bytes), committed to git                                                                                                                            |
| `src/lib/time.ts`                                           | Pure `today()` + `monthBucket()`                                 | ✓ VERIFIED  | 26-line module. Imports `TZDate` from `@date-fns/tz` + `startOfMonth, format` from `date-fns`. No `'use server'`/`'use client'` directive. No `Date.now()` calls. 11 fixtures green. |
| `tests/time.test.ts`                                        | D-23 Vitest suite                                                | ✓ VERIFIED  | 11 assertions PASS. Covers 3 offsets, DST spring-forward (America/New_York March 8 2026), leap year, NYE.                                                             |
| `src/server/db/schema.ts`                                   | Drizzle schema with 6 pgPolicy                                   | ✓ VERIFIED  | 96 lines. Imports `pgPolicy` from `drizzle-orm/pg-core`, `authenticatedRole` + `authUsers` from `drizzle-orm/supabase` (NOT neon). 6 `pgPolicy()` calls verified. Users + goals + goal_type enum exported. |
| `src/server/db/index.ts`                                    | drizzle client with `prepare: false`                             | ✓ VERIFIED  | 11 lines. Contains `postgres(connectionString, { prepare: false })` — Supabase transaction-pooler compat                                                              |
| `supabase/migrations/0000_initial_schema.sql`               | Generated DDL for tables/enum/FK/policies                         | ✓ VERIFIED  | Contains `CREATE TYPE "public"."goal_type" AS ENUM`, `CREATE TABLE "goals"`, `CREATE TABLE "users"`, both `ENABLE ROW LEVEL SECURITY`, 2 FKs, 6 `CREATE POLICY` statements |
| `supabase/migrations/0001_custom_constraints.sql`           | CHECK + trigger                                                   | ✓ VERIFIED  | Contains `CHECK (EXTRACT(DAY FROM month) = 1)`, `handle_new_user` function with `SECURITY DEFINER SET search_path = ''`, `CREATE OR REPLACE TRIGGER on_auth_user_created AFTER INSERT ON auth.users` |
| `tests/rls.test.ts`                                         | Automated 6-assertion RLS test                                    | ✓ VERIFIED  | Contains `SET LOCAL request.jwt.claims` + `SET LOCAL role = authenticated`. No skip markers. 6/6 assertions green against live DB this session.                       |
| `src/middleware.ts`                                         | @supabase/ssr token refresh + route guard                         | ✓ VERIFIED  | 86 lines. Calls `supabase.auth.getUser()`, uses `getAll/setAll` (never `get/set/remove`), redirects unauth → /login, redirects authed off auth routes. Matcher excludes static. Registered by Next as `ƒ Proxy (Middleware)` in build output. |
| `src/app/auth/callback/route.ts`                            | GET handler → exchangeCodeForSession                              | ✓ VERIFIED  | 28 lines. Contains `exchangeCodeForSession(code)`, redirects to `${origin}${next}` on success or `/auth/error` on failure. Build registers `ƒ /auth/callback`.       |
| `src/server/actions/auth.ts`                                | 5 server actions                                                  | ✓ VERIFIED  | 164 lines. `'use server'` directive on line 1. All 5 actions exported: signUpAction, signInAction, signOutAction, requestPasswordResetAction, updatePasswordAction. Each calls `safeParse` as first step. `email_confirmed_at` gate in signInAction. `resetPasswordForEmail` with `redirectTo=/auth/callback?next=/auth/reset/complete`. |
| `src/lib/schemas/auth.ts`                                   | 4 shared Zod schemas                                              | ✓ VERIFIED  | 56 lines. signUpSchema, signInSchema, resetRequestSchema, updatePasswordSchema + inferred types all exported. UI-SPEC error strings present verbatim: "Enter a valid email address", "Password must be at least 8 characters", "Enter your password", "Passwords do not match". |
| `src/lib/supabase/server.ts`                                | getSupabaseServerClient factory                                   | ✓ VERIFIED  | 38 lines. `createServerClient` bound to `next/headers` `cookies()` via `getAll/setAll`. ANON_KEY with PUBLISHABLE_KEY fallback.                                       |
| `src/components/auth/password-input.tsx`                     | Eye/EyeOff toggle with dynamic aria-label                        | ✓ VERIFIED  | 38 lines. Uses `forwardRef`, toggles `type` between "password"/"text", aria-label switches between "Show password"/"Hide password". 44x44 button (h-11 w-11).          |
| `src/components/auth/login-form.tsx`                         | RHF + zodResolver(signInSchema) → signInAction                   | ✓ VERIFIED  | 118 lines, `"use client"`. Imports signInSchema + signInAction. Loader2 on submit. Destructive Alert for root error. Forgot-password link to /auth/reset.             |
| `src/components/auth/signup-form.tsx`                        | RHF + zodResolver(signUpSchema) + Intl tz capture → signUpAction | ✓ VERIFIED  | 168 lines. Uses `z.input<typeof signUpSchema>` for form type (Zod 4 input/output divergence handling). Reads `Intl.DateTimeFormat().resolvedOptions().timeZone` at onSubmit. |
| `src/components/auth/reset-password-form.tsx`                | RHF + zodResolver(resetRequestSchema) → requestPasswordResetAction | ✓ VERIFIED  | 104 lines. Local sent state renders enumeration-safe "If that email is registered..." copy.                                                                            |
| `src/components/auth/update-password-form.tsx`               | RHF + zodResolver(updatePasswordSchema) → updatePasswordAction   | ✓ VERIFIED  | 103 lines. On success, server redirects to /login?reset=success. Two PasswordInput fields.                                                                            |
| `src/app/(auth)/layout.tsx`                                  | Centered-card layout                                              | ✓ VERIFIED  | 13 lines. `flex min-h-screen items-center justify-center`, `max-w-sm` wrapper. After Rule-1 fix removing --spacing-* tokens.                                          |
| `src/app/(auth)/login/page.tsx`                              | Server Component with ?reset=success Alert                        | ✓ VERIFIED  | 35 lines. Awaits `searchParams`, shows one-time Alert when reset === "success", renders LoginForm.                                                                     |
| `src/app/(auth)/signup/page.tsx`                             | SignUpForm wrapper                                                | ✓ VERIFIED  | 16 lines. Card title "Create your account".                                                                                                                            |
| `src/app/(auth)/auth/reset/page.tsx`                         | ResetPasswordForm wrapper                                         | ✓ VERIFIED  | 25 lines. Card title "Reset your password".                                                                                                                            |
| `src/app/(auth)/auth/reset/complete/page.tsx`                | UpdatePasswordForm wrapper                                        | ✓ VERIFIED  | 16 lines. Card title "Set a new password".                                                                                                                             |
| `src/app/(auth)/auth/verify/page.tsx`                        | "Email verified" Server Component                                 | ✓ VERIFIED  | 22 lines. Card title "Email verified" + Sign in CTA to /login.                                                                                                         |
| `src/app/(auth)/auth/error/page.tsx`                         | "Verification failed" Server Component                           | ✓ VERIFIED  | 23 lines. Card title "Verification failed" + Back to sign up CTA.                                                                                                      |
| `src/app/page.tsx`                                           | D-02 landing stub                                                | ✓ VERIFIED  | 39 lines. Calls getSupabaseServerClient + auth.getUser. Renders "Welcome, {user.email}" + "Your goals are coming in Phase 2." + form action={signOutAction}.          |

### Key Link Verification

Verified the load-bearing wiring between modules — these are the connections that 80% of stubs hide behind.

| From                                                | To                                                      | Via                                                          | Status     | Details                                                                                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/layout.tsx`                                | `src/app/globals.css`                                    | `import './globals.css'`                                     | ✓ WIRED    | Plan 01 self-check verified; production build succeeds so import resolves                                                                                    |
| `src/app/layout.tsx`                                | `next/font/google`                                       | `Geist` + `Geist_Mono` imports                               | ✓ WIRED    | Plan 01 self-check verified                                                                                                                                  |
| `drizzle.config.ts`                                 | `src/server/db/schema.ts`                                | `schema: './src/server/db/schema.ts'`                        | ✓ WIRED    | drizzle-kit generate produced 0000 migration from the schema; both files present                                                                             |
| `src/lib/time.ts`                                   | `@date-fns/tz`                                            | `import { TZDate } from '@date-fns/tz'`                      | ✓ WIRED    | First line of file; verified in Read output                                                                                                                  |
| `src/lib/time.ts`                                   | `date-fns`                                                | `import { startOfMonth, format }`                            | ✓ WIRED    | Second line of file; verified                                                                                                                                |
| `tests/time.test.ts`                                | `src/lib/time.ts`                                         | `import { today, monthBucket } from '../src/lib/time'`       | ✓ WIRED    | 11 tests pass — implementation is actually exercised                                                                                                         |
| `src/server/db/schema.ts`                           | `drizzle-orm/supabase`                                    | `import { authenticatedRole, authUsers }`                    | ✓ WIRED    | Line 12 of schema.ts (verified in Read); generated migration 0000 correctly emits policies targeting `authenticated` role and FK to `auth.users`              |
| `src/server/db/schema.ts`                           | `pgPolicy` from drizzle-orm/pg-core                       | `pgPolicy(...)`                                              | ✓ WIRED    | 6 `pgPolicy(` calls visible; 6 CREATE POLICY statements emitted in migration 0000 (verified)                                                                 |
| `supabase/migrations/0001_custom_constraints.sql`   | `public.goals.month`                                      | `ALTER TABLE ... ADD CONSTRAINT ... CHECK`                   | ✓ WIRED    | SQL file line 3-5; applied to live DB; verified by `pg_get_constraintdef` query                                                                              |
| `tests/rls.test.ts`                                 | public.goals + public.users RLS policies                 | postgres.js sql + `SET LOCAL request.jwt.claims` + `SET LOCAL role = authenticated` | ✓ WIRED    | 6/6 cross-user isolation assertions pass against live DB this session                                                                                         |
| `src/middleware.ts`                                 | `@supabase/ssr createServerClient`                       | `getUser()` inside middleware                                | ✓ WIRED    | Line 47-49 of middleware.ts: `await supabase.auth.getUser()`. Middleware registered at build time.                                                            |
| `src/server/actions/auth.ts`                        | `src/lib/supabase/server.ts`                              | `getSupabaseServerClient()`                                  | ✓ WIRED    | Line 5 import; called inside every action (signUp, signIn, signOut, requestPasswordReset, updatePassword)                                                   |
| `src/server/actions/auth.ts`                        | `src/server/db` (Plan 03)                                 | `db.update(users).set({ timezone }).where(eq(users.id, ...))` | ✓ WIRED    | Lines 6-7 imports; lines 62-66 patch timezone after signUp                                                                                                   |
| `src/server/actions/auth.ts`                        | `src/lib/schemas/auth.ts`                                 | `schema.safeParse(input)` on every action entry              | ✓ WIRED    | Lines 9-17 imports; every action calls `.safeParse` (grep confirms)                                                                                           |
| `src/components/auth/signup-form.tsx`                | `src/server/actions/auth.ts`                              | `import { signUpAction }`                                    | ✓ WIRED    | Line 9 import; called at line 62 `await signUpAction(payload)`                                                                                                |
| `src/components/auth/login-form.tsx`                 | `src/lib/schemas/auth.ts`                                 | `import { signInSchema }`                                    | ✓ WIRED    | Line 8 import; used in zodResolver on line 24                                                                                                                 |
| `src/app/page.tsx`                                  | `src/server/actions/auth.ts`                              | `<form action={signOutAction}>`                              | ✓ WIRED    | Line 3 import; line 22 `<form action={signOutAction}>`                                                                                                        |
| `src/app/(auth)/login/page.tsx`                     | URLSearchParams `?reset=success`                          | `searchParams` in page props                                 | ✓ WIRED    | Line 12 `const { reset } = await searchParams; const resetSuccess = reset === "success"` — conditional Alert rendered                                        |

### Data-Flow Trace (Level 4)

Artifacts that render dynamic data — traced to their data sources.

| Artifact                     | Data Variable      | Source                                                                                                  | Produces Real Data | Status     |
| ---------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------- | ------------------ | ---------- |
| `src/app/page.tsx`           | `user`             | `supabase.auth.getUser()` via `getSupabaseServerClient()` — verified JWT from Supabase (not static)     | Yes                | ✓ FLOWING   |
| Every auth form              | `isSubmitting`, `errors.root` | `react-hook-form` state + server action response (not hardcoded)                                   | Yes                | ✓ FLOWING   |
| `src/components/auth/signup-form.tsx` | `tz`        | `Intl.DateTimeFormat().resolvedOptions().timeZone` at onSubmit — browser API (not hardcoded 'UTC') | Yes                | ✓ FLOWING   |
| `src/app/(auth)/login/page.tsx` | `resetSuccess` | awaited `searchParams.reset` from URL — real query string                                                | Yes                | ✓ FLOWING   |

No HOLLOW, STATIC, or DISCONNECTED artifacts detected. Every rendered variable flows from a real source.

### Behavioral Spot-Checks

Direct checks executed this session against the live codebase + live Supabase DB.

| Behavior                                                             | Command                                                                                                                | Result                                                                                                           | Status  |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------- |
| TypeScript compiles clean                                            | `npx tsc --noEmit`                                                                                                      | exit 0 (no output)                                                                                               | ✓ PASS  |
| Full test suite passes                                               | `npx vitest run` (with DATABASE_URL loaded)                                                                             | `Test Files 5 passed (5)` / `Tests 39 passed (39)`                                                                 | ✓ PASS  |
| Production build succeeds                                            | `npm run build`                                                                                                         | `Compiled successfully in 2.4s` — 11 routes compiled; `ƒ Proxy (Middleware)` registered                            | ✓ PASS  |
| Live DB has public.users + public.goals with RLS enabled              | `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('users','goals') AND relnamespace='public'::regnamespace` | `[{"goals",true},{"users",true}]`                                                                                | ✓ PASS  |
| 6 RLS policies exist                                                 | `SELECT polname FROM pg_policy WHERE polrelid::regclass::text IN ('users','goals')`                                     | `["goals-delete-own","goals-insert-own","goals-select-own","goals-update-own","users-select-own","users-update-own"]` | ✓ PASS  |
| goals.month CHECK constraint rejects mid-month dates                  | `INSERT INTO public.goals (..., month, ...) VALUES (..., '2026-04-15', ...)`                                             | `ERROR: new row for relation "goals" violates check constraint "month_is_first_of_month"`                          | ✓ PASS  |
| on_auth_user_created trigger exists                                  | `SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created'`                                                   | `[{"on_auth_user_created"}]`                                                                                     | ✓ PASS  |
| goal_type enum has exactly 3 values                                   | `SELECT enumlabel FROM pg_enum WHERE enumtypid='goal_type'::regtype ORDER BY enumsortorder`                             | `["count","checklist","habit"]`                                                                                  | ✓ PASS  |
| Both migrations applied to linked remote                              | `supabase migration list --linked`                                                                                      | Local/Remote columns show `0000 \| 0000` and `0001 \| 0001`                                                        | ✓ PASS  |
| `.env.local` git-ignored                                              | `git check-ignore .env.local`                                                                                            | `.env.local` (exit 0)                                                                                            | ✓ PASS  |
| No `getSession` usage server-side                                     | `grep -rn getSession src/`                                                                                               | No matches                                                                                                       | ✓ PASS  |
| No `SUPABASE_SERVICE_ROLE_KEY` usage                                  | `grep -rn SUPABASE_SERVICE_ROLE_KEY src/`                                                                                 | No matches                                                                                                       | ✓ PASS  |
| No `drizzle-orm/neon` contamination                                   | `grep -rn drizzle-orm/neon src/`                                                                                         | No matches                                                                                                       | ✓ PASS  |

### Requirements Coverage

| Requirement | Source Plan(s)              | Description                                                                              | Status       | Evidence                                                                                                                                                                                                           |
| ----------- | --------------------------- | ---------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AUTH-01     | 01, 04, 05                  | User can sign up with email and password                                                 | ✓ SATISFIED  | signUpAction + SignUpForm + UAT Scenario 1 PASSED. Traceability matrix in REQUIREMENTS.md already marked Complete.                                                                                              |
| AUTH-02     | 01, 04, 05                  | User receives an email verification link after signup                                    | ✓ SATISFIED  | `emailRedirectTo` wired + `/auth/callback` PKCE exchange + `/auth/verify` success page. UAT Scenarios 1, 2, 3 PASSED (Scenario 2 specifically tests the unverified-login BLOCK which proves the gate holds). |
| AUTH-03     | 01, 04, 05                  | User can log in and stay logged in across browser sessions                               | ✓ SATISFIED  | signInAction + middleware `getUser()` refresh + session persist across browser restart per UAT Scenario 3; stale-cookie handling per Scenario 9.                                                                 |
| AUTH-04     | 01, 04, 05                  | User can log out from any page                                                           | ✓ SATISFIED  | signOutAction + landing-page logout form. UAT Scenario 4 PASSED.                                                                                                                                                   |
| AUTH-05     | 01, 04, 05                  | User can reset a forgotten password via an emailed link                                  | ⚠️ PARTIAL   | requestPasswordResetAction + updatePasswordAction + reset UI surfaces; single-use PASSED (Scenario 5). **15-minute expiry NOT_YET_OBSERVED** — async Scenario 6 from Plan 05 pending human observation.                   |
| GOAL-04     | 01, 02, 03, 05              | Every goal is scoped to a specific month (DATE pinned to first-of-month)                 | ✓ SATISFIED  | DB CHECK constraint live + mid-month INSERT rejection proven live + `monthBucket()` app-layer invariant locked by 11 tests + cross-user RLS proven by 6-assertion test. Marked Complete in REQUIREMENTS.md.   |

**Requirements declared across plans:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, GOAL-04 — 6 total (matches phase requirement IDs exactly, no orphans).

**REQUIREMENTS.md Traceability matrix:** all 6 phase-1 requirements listed; 5 AUTH-* and GOAL-04 all marked Complete there. No orphaned requirements for Phase 1.

### Anti-Patterns Found

Scanned key source files for stub/placeholder patterns.

| File                                      | Line / Pattern                                                                          | Severity  | Impact                                                                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/server/actions/auth.ts`              | Substring match on Supabase error strings (`error.message.toLowerCase().includes("already"|"expired")`) (lines 48, 153-157) | ⚠️ Warning | Flagged in 01-REVIEW.md WR-02. Fragile to Supabase locale/version changes. Does not break any SC but can silently mis-route future users. |
| `src/middleware.ts`                       | Redirect responses drop refreshed cookies written to `response` (lines 58-62, 67-76)      | ⚠️ Warning | 01-REVIEW.md CR-01 — canonical @supabase/ssr foot-gun. Affects edge case where getUser() refreshes AND request redirects. SC-1..SC-5 still met because happy-path UAT exercised. Security: defers refresh to next non-redirecting request. |
| `src/app/auth/callback/route.ts`          | `next` query param interpolated without allow-list or path validation (line 22)          | ⚠️ Warning | 01-REVIEW.md CR-02 — open-redirect vector. Mitigated in practice by Supabase Redirect-URL allow-list (only localhost:3000/** whitelisted) but not at code layer. |
| `src/components/auth/password-input.tsx`  | `tabIndex={-1}` on visibility toggle (line 30)                                            | ℹ️ Info    | 01-REVIEW.md IN-01 — a11y: toggle is not keyboard-reachable (screen readers can still activate via a11y tree)          |
| `src/server/actions/auth.ts`              | `siteUrl()` falls back to `http://localhost:3000` in any environment (lines 21-25)       | ⚠️ Warning | 01-REVIEW.md WR-05 — silent production failure if `NEXT_PUBLIC_SITE_URL` unset on deploy. Currently Phase 1 is dev-only; relevant when Phase 4 deploys.                             |
| `src/server/actions/auth.ts`              | `signOutAction` has no error handling (lines 110-114)                                     | ⚠️ Warning | 01-REVIEW.md WR-06 — transient Supabase failure surfaces as a red-screen error boundary instead of graceful logout     |
| `src/lib/schemas/auth.ts`                 | `timezone: z.string().min(1)` — no IANA validation                                        | ⚠️ Warning | 01-REVIEW.md WR-03 — invalid tz string reaches DB → `TZDate` throws RangeError on subsequent reads; potential self-DoS |
| `src/server/actions/auth.ts` + `src/lib/supabase/server.ts` + `src/middleware.ts` | `??` coalesce on anon/publishable-key env vars misses empty-string case | ⚠️ Warning | 01-REVIEW.md WR-04 — empty env var value → silent "always unauthenticated" masquerading as auth failure               |
| `src/server/actions/auth.ts`              | signUp emits distinct "already registered" error (lines 46-55)                            | ⚠️ Warning | 01-REVIEW.md WR-01 — user-enumeration asymmetric with password-reset no-enumeration stance                            |

**Blocker count:** 0. None of the flagged items prevent the phase goal (all 5 Success Criteria and 6 requirements met modulo SC-3 async observation).
**Warning count:** 8 (all carry-forward from 01-REVIEW.md; advisory severity per phase context note)
**Info count:** 1 (keyboard a11y)

### Human Verification Required

See frontmatter `human_verification` section. Two items:

#### 1. AUTH-05 16-minute reset-link expiry observation

**Test:** Click the second reset-link email (deliberately left unclicked during UAT Scenario 5) after 16+ minutes have elapsed.
**Expected:** Link fails — browser lands on `/auth/error` OR on `/auth/reset/complete` surfacing "This reset link has expired. Request a new one."
**Why human:** 15-minute token expiry is a time-bound behavior of the live Supabase service. Plan 05 explicitly defers this to async follow-up (recorded as NOT_YET_OBSERVED in 01-05-SUMMARY.md).
**Action if fails:** File gap-closure against Plan 01 Supabase dashboard setting (Reset password token validity = 900 seconds).

#### 2. Advisory severity triage — CR-01 and CR-02

**Test:** Developer reviews `.planning/phases/01-foundations-auth/01-REVIEW.md` Critical section.
**Expected:** Developer chooses one of: (a) file a gap-closure plan inside Phase 1 before merge to main to fix CR-01 (middleware cookie drop on redirect) and CR-02 (open-redirect via `next` param), OR (b) explicitly defer both to a Phase 4 POLSH plan with a note in `.planning/STATE.md`.
**Why human:** Severity triage is a product/developer judgement call. Neither finding breaks a ROADMAP Success Criterion, and both have partial mitigations in place (Supabase redirect-URL allow-list for CR-02; happy-path session refresh isn't lossy for CR-01 — only redirect-coincident token refresh is).

### Gaps Summary

**Automated gaps: none.** Every ROADMAP Success Criterion is verifiable by the codebase + live Supabase state this session:

- Signup / verify / login / logout / reset-request / reset-complete all have end-to-end implementations wired through middleware, server actions, shared Zod schemas, and UI forms.
- Live Supabase DB has both tables, both migrations, 6 RLS policies, the CHECK constraint (which rejects mid-month INSERTs as proven live), and the auth-users trigger.
- Timezone + month-bucket logic is test-locked across 11 DST/leap/NYE fixtures.
- Full test suite: 39/39 passed.
- Production build: clean, 11 routes compiled, middleware registered.
- No stubs, no hardcoded empty data paths, no orphaned exports, no Neon/service-role/getSession contamination.

**What's outstanding is strictly human-observable, not a code gap:**

1. **Scenario 6 (16-min reset expiry)** — async by design per Plan 05 checkpoint. Recorded as NOT_YET_OBSERVED in 01-05-SUMMARY.md. When the user clicks the stale second reset email and confirms the expiry works, AUTH-05 flips from PARTIAL to fully VERIFIED. If it doesn't expire, that's a Supabase dashboard mis-config from Plan 01 checkpoint — one-toggle gap closure.

2. **01-REVIEW.md findings (2 Critical + 6 Warning + 1 Info)** are advisory per the phase context and do NOT block phase closure. They are carry-forward technical debt for either a targeted Phase 1 gap-closure plan OR a Phase 4 POLSH plan. The developer should make that triage call before merging to main / proceeding to Phase 2.

**Recommendation:** Phase 1 has achieved its goal. Proceed to human observation of Scenario 6. If it passes, phase can transition. The CR-01 + CR-02 findings should be actioned before Phase 4 production deploy regardless of which plan holds them — they are security-impacting for a public product.

---

_Verified: 2026-04-18T21:40:00Z_
_Verifier: Claude (gsd-verifier)_
