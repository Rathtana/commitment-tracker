# Phase 1: Foundations & Auth - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 01-foundations-auth
**Mode:** discuss (interactive)
**Areas discussed:** Phase 1 scope edge, Timezone strategy, Email delivery & verification, RLS policies & schema scope

---

## Phase 1 scope edge

### Q: ROADMAP lists AUTH-01..05 + GOAL-04 (schema only). Research SUMMARY added a count-goal walking skeleton. Which scope does Phase 1 actually deliver?

| Option | Description | Selected |
|--------|-------------|----------|
| Strict ROADMAP scope | Auth + schema + timezone strategy + DST test suite. Post-login lands on stub. All goal UI + progress in Phase 2. | ✓ |
| Narrow walking skeleton | Everything in strict scope PLUS hidden dev-only count insert + static bar render. | |
| Full walking skeleton per research | Auth + schema + complete count-goal flow with create/increment/optimistic bar. | |

**User's choice:** Strict ROADMAP scope (Recommended)

---

### Q: What does the logged-in landing page actually render in Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal stub | "Welcome, {email}" + logout + "Goals coming in Phase 2" placeholder. | ✓ |
| Dashboard shell with empty state | Real /dashboard route with header, empty-state card, current-month label. | |
| Current-month URL + empty dashboard | /dashboard/[month] dynamic route in place with empty content. | |

**User's choice:** Minimal stub (Recommended)

---

### Q: Which tables land in the Phase 1 migration?

| Option | Description | Selected |
|--------|-------------|----------|
| Only goals | Just polymorphic parent with CHECK constraint on month. | ✓ (initial) |
| All three tables up-front | goals + tasks + habit_check_ins all migrated now. | |
| goals + users mirror table | goals plus public.users mirror for FKs + timezone. | |

**User's choice:** Only goals (initial); later reconciled to `public.users + goals` after the user-ref decision required the mirror for the `timezone` column. See reconciliation below.

---

### Q: How is "timezone strategy locked" verified as done (success criterion #5)?

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest suite with fake timers | Unit tests against pure today(now, userTz). Fixtures: UTC-8, UTC+13, UTC+0 at 11:30 PM last-day-of-month, DST, leap year, NYE. | ✓ |
| Integration test hitting real DB | Spin up Postgres via Supabase CLI, write with varying timezones, assert month bucket. | |
| Both unit + one integration smoke test | Vitest primary + one DB integration test. | |

**User's choice:** Vitest suite with fake timers (Recommended)

---

## Timezone strategy

### Q: Which library drives server-side timezone math?

| Option | Description | Selected |
|--------|-------------|----------|
| date-fns-tz | Already in stack's date-fns lineage. Stable, documented, works today. | ✓ |
| Temporal API + polyfill | Future-proof zoned-datetime semantics; polyfill adds ~15KB. | |
| Native Intl.DateTimeFormat + Date | No extra library; DST edge cases are fiddly. | |

**User's choice:** date-fns-tz (Recommended)

---

### Q: Where does each user's IANA timezone live?

| Option | Description | Selected |
|--------|-------------|----------|
| user profile column | public.users.timezone TEXT NOT NULL DEFAULT 'UTC'. Set on signup; authoritative. | ✓ |
| Per-request from client | Client sends tz on every mutation; no DB storage. | |
| Both — profile + client override | Profile column default; client header can override per session. | |

**User's choice:** user profile column (Recommended)

---

### Q: When is the timezone captured and saved?

| Option | Description | Selected |
|--------|-------------|----------|
| At signup, from browser | Signup reads Intl.DateTimeFormat().resolvedOptions().timeZone; stored on users row. Default 'UTC' if detection fails. | ✓ |
| Default 'UTC' at signup, prompt later | Row defaults to UTC; first tz-sensitive action prompts user. | |
| Detect on every request from the browser | Never stored; re-detected per action. | |

**User's choice:** At signup, from browser (Recommended)

---

### Q: Which SQL type stores the month-boundary CHECK-constrained "bucket" column?

| Option | Description | Selected |
|--------|-------------|----------|
| DATE with CHECK constraint | goals.month DATE NOT NULL CHECK (EXTRACT(DAY FROM month) = 1). | ✓ |
| TIMESTAMPTZ pinned to midnight UTC | More flexible; tz ambiguity reintroduces the pitfall. | |
| INT (year*100 + month) | Denormalized integer, trivial to index; fights Postgres date functions. | |

**User's choice:** DATE with CHECK constraint (Recommended)

---

## Email delivery & verification

### Q: Which email provider sends verification + password-reset emails?

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase built-in SMTP | Zero setup, free, rate-limited 4/hour, Supabase-branded sender. | ✓ |
| Resend from day one | 3KB SDK, 3000/month free, requires DNS (SPF + DKIM). | |
| Postmark from day one | Best-in-class deliverability, 100/month free, requires DNS. | |

**User's choice:** Supabase built-in SMTP (Recommended for v1)

---

### Q: Is email verification required before the user can log in?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — block login until verified | Login fails with 'please verify' until link clicked. Matches success criterion #1. | ✓ |
| No — allow login with persistent nag banner | Lower friction; adds semi-verified state to RLS. | |
| Grace period (24h then blocked) | More code paths; rarely worth it. | |

**User's choice:** Yes — block login until verified (Recommended)

---

### Q: How is the password-reset link hardened for Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase defaults + one-time use | 15m expiry, single-use token. No bespoke rate limit (Phase 4 adds it). | ✓ |
| Full hardening now (rate limit + one-time + 15m) | Moves Phase 4 polish work forward. | |
| Short expiry only (15m), no one-time enforcement | Weaker — reusable for 15m. | |

**User's choice:** Supabase defaults + one-time use (Recommended)

---

### Q: What email address does the 'from' field use for v1?

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase default (noreply@mail.app.supabase.io) | Zero DNS. Supabase branding; fine for beta / builder's daily use. | ✓ |
| Custom sender on own domain | Requires domain + SPF + DKIM + DMARC. | |

**User's choice:** Supabase default (Recommended if Supabase SMTP)

---

## RLS policies & schema scope

### Q: How are Row-Level Security policies written and versioned?

| Option | Description | Selected |
|--------|-------------|----------|
| Drizzle crudPolicy() helpers in schema | Co-located with table defs; drizzle-kit generates policy SQL. Single source of truth. | ✓ |
| Hand-written SQL in Supabase migration files | Raw .sql files; diverges from Drizzle schema. | |
| Drizzle for tables, hand-written SQL for policies | Clean separation; requires alignment discipline. | |

**User's choice:** Drizzle crudPolicy() helpers in schema (Recommended)

---

### Q: How does the app reference the authenticated user (FKs, session lookups)?

| Option | Description | Selected |
|--------|-------------|----------|
| public.users mirror with id = auth.users.id | Mirror table with timezone + future profile fields. Trigger on auth.users insert. Standard Supabase pattern. | ✓ |
| Direct FK to auth.users.id, no mirror | Skip mirror; timezone needs a separate home. | |
| No FK, just store user_id as UUID | RLS enforces ownership; loses referential integrity. | |

**User's choice:** public.users mirror with id = auth.users.id (Recommended)

---

### Q: How are migrations run against staging + production Supabase?

| Option | Description | Selected |
|--------|-------------|----------|
| drizzle-kit + Supabase CLI both | drizzle-kit generates SQL; supabase CLI applies to local/staging/prod. | ✓ |
| drizzle-kit migrate only | Drizzle runs migrations directly; bypasses Supabase migration history. | |
| Supabase CLI migrations, Drizzle for queries only | Hand-write SQL; lose drizzle-kit schema-diff. | |

**User's choice:** drizzle-kit + Supabase CLI both (Recommended)

---

### Q: How does the @supabase/ssr middleware set up auth cookies in Phase 1?

| Option | Description | Selected |
|--------|-------------|----------|
| Official template defaults | HttpOnly + Secure + SameSite=Lax; token refresh on each server render. | ✓ |
| Defaults + explicit Domain + Path config | More control; riskier if misconfigured. | |

**User's choice:** Official template defaults (Recommended)

---

### Q (reconciliation): Which tables actually land in the Phase 1 migration?

| Option | Description | Selected |
|--------|-------------|----------|
| public.users + goals | Both needed: users holds timezone, goals holds polymorphic parent with CHECK. | ✓ |
| Just goals — put timezone elsewhere | Conflicts with 'user profile column' decision for timezone. | |

**User's choice:** public.users + goals (Recommended) — reconciled conflict with earlier "only goals" answer, which had meant "no child goal-type tables" (tasks, habit_check_ins) rather than "nothing else at all."

---

## Claude's Discretion

- Exact shape of `middleware.ts` (follow `@supabase/ssr` official template)
- Copy, layout, visual polish of login/signup/reset/verify pages
- Whether auth forms use shadcn `<Form>` wrapper or plain `<form>` (must use react-hook-form + zod)
- Drizzle schema file organization
- ESLint/Prettier specifics beyond defaults
- Vitest config shape
- Directory layout under `src/`

## Deferred Ideas

- Custom email provider (Resend / Postmark) — pre-public-launch swap
- OAuth sign-in (Google / Apple) — v2+
- Password reset IP rate limiting — Phase 4
- Settings page to change timezone — Phase 4+
- Temporal API migration — ~2027
- `tasks` and `habit_check_ins` child tables — Phase 2
- Dashboard shell / empty state / month-routed URL — Phase 2 & Phase 3
- Past-month write protection at RLS — Phase 3
- Count-goal walking skeleton — Phase 2
