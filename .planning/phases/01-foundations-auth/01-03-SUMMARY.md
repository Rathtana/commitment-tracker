---
phase: 01-foundations-auth
plan: 03
subsystem: database
tags: [drizzle, supabase, postgres, rls, migrations, schema, check-constraint, trigger, vitest]

requires:
  - phase: 01-foundations-auth
    plan: 01
    provides: "drizzle-kit 0.31.10 + drizzle-orm 0.45.2 + postgres 3.4.9 installed; DATABASE_URL (pooler) in .env.local; Supabase CLI 2.90.0 linked to project ref mzdnabewgjcnouzydwdb"
  - phase: 01-foundations-auth
    plan: 02
    provides: "monthBucket() pure function producing first-of-month Date values that the goals.month CHECK constraint will validate"
provides:
  - "public.users table (id UUID PK → auth.users.id ON DELETE CASCADE, timezone TEXT DEFAULT 'UTC', created_at/updated_at TIMESTAMPTZ) — live in Supabase dev project"
  - "public.goals table (id UUID PK, user_id UUID → users.id ON DELETE CASCADE, month DATE with month_is_first_of_month CHECK, title TEXT, type goal_type ENUM, position TEXT DEFAULT '0', created_at/updated_at TIMESTAMPTZ) — live in Supabase dev project"
  - "goal_type enum ('count','checklist','habit') — D-06"
  - "RLS ENABLED on both tables (pg_class.relrowsecurity = true) with 6 policies: users-select-own, users-update-own, goals-select-own, goals-insert-own, goals-update-own, goals-delete-own — all keyed on auth.uid()"
  - "on_auth_user_created AFTER INSERT trigger on auth.users → public.handle_new_user (SECURITY DEFINER, empty search_path) auto-populating public.users with default timezone 'UTC' — D-08"
  - "src/server/db/schema.ts — Drizzle schema with pgPolicy RLS rules (committed in Plan 01-03 Task 1)"
  - "src/server/db/index.ts — db client wired via postgres.js with prepare: false for Supabase transaction pooler"
  - "drizzle.config.ts — emits migrations to ./supabase/migrations (Pitfall 4 compliant)"
  - "supabase/migrations/0000_initial_schema.sql — drizzle-kit generated DDL for tables/enum/FKs/policies"
  - "supabase/migrations/0001_custom_constraints.sql — handwritten CHECK + auth.users trigger"
  - "tests/rls.test.ts — automated 6-assertion RLS cross-user isolation test (SET LOCAL role=authenticated + forged request.jwt.claims) — green against live DB"
affects: [01-04-auth, 01-05-ui-auth, 02-goals, 02-goal-create, 03-progress, 04-dashboard]

tech-stack:
  added: []
  patterns:
    - "pgPolicy co-located with pgTable: RLS policies live in the Drizzle schema alongside table defs so `drizzle-kit generate` emits CREATE POLICY statements — no separate RLS migration to maintain."
    - "Supabase-specific imports: `authenticatedRole` + `authUsers` from `drizzle-orm/supabase` (NOT `crudPolicy` from `drizzle-orm/neon` — Neon uses auth.user_id() which does not exist in Supabase)."
    - "Hybrid migration strategy: drizzle-kit emits 0000 (tables/enum/FK/policies) + handwritten 0001 for things Drizzle 0.45 cannot express — CHECK constraint on DATE column + trigger on the internal auth.users schema."
    - "Supabase pooler = postgres superuser: the DATABASE_URL (pooler, transaction mode) connects as the `postgres` role, which owns migration workload and has privileges on auth schema. Used in tests to insert into auth.users so the on_auth_user_created trigger exercises too."
    - "RLS test harness without Supabase admin SDK: `sql.begin(tx => { SET LOCAL role = authenticated; SET LOCAL request.jwt.claims = '{...}'; ... })` makes `auth.uid()` return any user id; transaction rollback keeps tests hermetic. Zero new dependencies."
    - "Shell-safe env loading: `set -a; source .env.local; set +a` (NOT `export $(grep ... | xargs)`) — robust against `=`, `&`, `?`, spaces, and pooler URL query strings in values."
    - "node -e + postgres.js as psql replacement: when psql isn't available locally, the same driver already in node_modules can run ad-hoc verification queries against the live DB."

key-files:
  created:
    - src/server/db/schema.ts
    - src/server/db/index.ts
    - drizzle.config.ts
    - supabase/migrations/0000_initial_schema.sql
    - supabase/migrations/0001_custom_constraints.sql
    - supabase/migrations/meta/_journal.json
    - supabase/migrations/meta/0000_snapshot.json
    - supabase/migrations/meta/0001_snapshot.json
    - tests/rls.test.ts
  modified: []

key-decisions:
  - "Seed RLS test users via auth.users (Rule 1 fix): direct INSERT into public.users fails users_id_fk (REFERENCES auth.users). Inserting into auth.users is accepted because the pooler role is postgres superuser, AND it exercises the on_auth_user_created trigger — covering D-08 alongside D-21/D-22 in one test."
  - "Quote DATABASE_URL in .env.local: the pooler URL query string contains `&connection_limit=1` which, if unquoted, causes `source .env.local` to fork a background job. Wrapping in double-quotes keeps shell parsing clean without changing the value dotenv/Next.js loaders parse."
  - "psql not available locally → verification queries run via inline `node -e` + `postgres.js` (already in node_modules). Same DB, same SQL, different client. Added to 'patterns-established' so future plans reuse the approach."
  - "Skipped `supabase db diff --linked` dry-run step: requires ~100 MB Docker image for a local Postgres comparison. `supabase migration list --linked` (Local/Remote column table) is sufficient proof of push state and runs without Docker."
  - "Task 3 produces no code-file changes (applies migrations to live DB + runs verification queries); no task-3 commit was made — the migration files themselves were committed in Task 2 (cb126a4). Post-push verification is documented in this SUMMARY and witnessed by Task 4's green RLS test against the live DB."

patterns-established:
  - "RLS defense-in-depth: RLS is the ONLY gate against cross-user reads in an anon-key browser flow. `tests/rls.test.ts` locks the 6-policy contract (users: select/update; goals: select/insert/update/delete) against regression. Any future schema change that drops a policy or introduces a new table must extend this test."
  - "GOAL-04 month-invariant dual-enforcement: `CHECK (EXTRACT(DAY FROM month) = 1)` at DB layer + `monthBucket()` returns getUTCDate()===1 at app layer. Both must pass for a write to succeed — belt-and-suspenders."
  - "Drizzle schema as RLS source of truth: co-locating pgPolicy() with pgTable means the migration and the schema never drift. Code review of schema.ts is code review of RLS."

requirements-completed: [GOAL-04]

duration: "~3min (Task 3 verification + Task 4 test author/run + docs)"
completed: 2026-04-19
---

# Phase 01 Plan 03: Drizzle Schema + RLS Migration Summary

**Two live tables (public.users, public.goals) with 6 RLS policies, month-first-of-month CHECK constraint, and auth.users → public.users SECURITY DEFINER trigger — all pushed to Supabase dev project via `supabase db push --linked`, locked behind a 6-assertion automated Vitest RLS test that exits 0 against the live DB.**

## Performance

- **Duration:** ~3 min post-resume (Task 3 verify + Task 4 author + vitest run + SUMMARY); Tasks 1–2 shipped previously at ~2 min
- **Started (Task 1):** 2026-04-18 evening (prior session)
- **Checkpoint paused:** 2026-04-18 (before `supabase db push`)
- **Resumed:** 2026-04-19T02:44Z (user replied "approved")
- **Completed:** 2026-04-19T02:48Z (this summary)
- **Tasks:** 4 (2 author + 1 migration push + 1 RLS test)
- **Files created:** 9 (+ 3 files in `supabase/migrations/meta/` — drizzle journal + snapshots)

## Accomplishments

- Both tables live in Supabase project `mzdnabewgjcnouzydwdb`: `public.users` and `public.goals`
- RLS ENABLED on both (`pg_class.relrowsecurity = true` for both rows)
- All 6 RLS policies present: `users-select-own`, `users-update-own`, `goals-select-own`, `goals-insert-own`, `goals-update-own`, `goals-delete-own`
- `month_is_first_of_month` CHECK constraint live; direct INSERT with `month='2026-04-15'` rejected with `new row for relation "goals" violates check constraint "month_is_first_of_month"`
- `on_auth_user_created` trigger on `auth.users` fires `public.handle_new_user()` (SECURITY DEFINER, empty search_path) — inserts into `public.users` with default timezone `'UTC'`. Exercised by the RLS test's `seedUsers()` helper (inserting into auth.users succeeded AND produced the matching public.users row)
- `goal_type` enum created with 3 values (count, checklist, habit); FKs resolve: `goals.user_id → users.id` (cascade), `users.id → auth.users.id` (cascade)
- `supabase migration list --linked` shows both migrations in **Remote** column (`0000 | 0000`, `0001 | 0001`)
- 6/6 RLS assertions green against the live DB; full suite 17/17 (11 time + 6 rls)
- `npx tsc --noEmit` exits 0

## Task Commits

1. **Task 1: Drizzle schema.ts + drizzle.config.ts + db/index.ts** — `64a01dc` (feat) — prior session
2. **Task 2: Generate 0000_initial_schema.sql + author 0001_custom_constraints.sql** — `cb126a4` (feat) — prior session
3. **Task 3: [BLOCKING] `supabase db push --linked` + 7 post-push verification queries** — no code commit (verification-only task; `supabase/migrations/meta/_journal.json` + snapshots were already committed as part of Task 2). Push witnessed by `supabase migration list --linked` showing both in Remote column.
4. **Task 4: Automated RLS cross-user isolation test** — `b3d0f1d` (test)

**Plan metadata:** (this commit) — `docs(01-03): complete drizzle schema + RLS migration plan`

## Vitest Output (tests/rls.test.ts against live DB)

```
 RUN  v4.1.4 /Users/rathtana.duong/gsd-tutorial

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Duration  4.53s
```

All 6 assertions:
1. `user A SELECT public.goals → only A rows (B row hidden by RLS)` — PASS
2. `user A UPDATE B goal → 0 rows affected (RLS filters UPDATE)` — PASS
3. `user A DELETE B goal → 0 rows affected` — PASS
4. `user A INSERT with user_id = B → rejected by WITH CHECK` (throws `/row-level security/i`) — PASS
5. `user A SELECT public.users → only A row` — PASS
6. `user A UPDATE B user row → 0 rows affected` — PASS

## Post-Push Verification Queries (run via `node -e` + postgres.js)

| # | Query | Expected | Actual |
|---|-------|----------|--------|
| 1 | Tables in public | `goals`, `users` | `['goals','users']` |
| 2 | RLS on both tables | 2 rows, relrowsecurity=true | `{goals:true}, {users:true}` |
| 3 | Policies on users+goals | 6 | 6 (all named as contracted) |
| 4 | `month_is_first_of_month` CHECK def | contains `EXTRACT` | `CHECK ((EXTRACT(day FROM month) = (1)::numeric))` |
| 5 | `handle_new_user` function + `on_auth_user_created` trigger | both present | both present |
| 6 | `goal_type` enum values | 3 (count, checklist, habit) | `['count','checklist','habit']` |
| 7 | FKs | `goals_user_id_fk → public.users`, `users_id_fk → auth.users`, both ON DELETE CASCADE | both present, both cascade |
| 8 | CHECK rejects mid-month INSERT | `violates check constraint "month_is_first_of_month"` | error message matches |

`supabase migration list --linked` output:
```
   Local | Remote | Time (UTC)
  -------|--------|------------
   0000  | 0000   | 0000
   0001  | 0001   | 0001
```

## pg_policy Query Output (6 policies, copy-pasted)

```
polname             | relname
--------------------+---------
goals-delete-own    | goals
goals-insert-own    | goals
goals-select-own    | goals
goals-update-own    | goals
users-select-own    | users
users-update-own    | users
```

## pg_trigger Query Output

```
tgname
----------------------
on_auth_user_created
```

## Files Created/Modified

### Created in Task 1 (commit `64a01dc`)
- `src/server/db/schema.ts` — pgTable + pgPolicy definitions for users + goals; imports `authenticatedRole` + `authUsers` from `drizzle-orm/supabase` (NOT neon)
- `src/server/db/index.ts` — drizzle client wired via postgres.js with `prepare: false` (Supabase transaction-pooler compat)
- `drizzle.config.ts` — `out: "./supabase/migrations"` (Pitfall 4); dialect postgresql; credentials from DATABASE_URL

### Created in Task 2 (commit `cb126a4`)
- `supabase/migrations/0000_initial_schema.sql` — 1-file DDL: goal_type enum, users table, goals table, ALTER TABLE ENABLE ROW LEVEL SECURITY, 2 FKs, 6 CREATE POLICY statements
- `supabase/migrations/0001_custom_constraints.sql` — ALTER TABLE public.goals ADD CONSTRAINT month_is_first_of_month + CREATE OR REPLACE FUNCTION public.handle_new_user + CREATE OR REPLACE TRIGGER on_auth_user_created
- `supabase/migrations/meta/_journal.json` + `meta/0000_snapshot.json` + `meta/0001_snapshot.json` — drizzle-kit state tracking

### Created in Task 4 (commit `b3d0f1d`)
- `tests/rls.test.ts` — 170-line automated Vitest suite with `SET LOCAL role = authenticated` + forged `request.jwt.claims` harness; 6 cross-user isolation assertions; seeds via `auth.users` INSERT so the trigger fires; `afterAll` cleans up both `auth.users` + `public.users` + `public.goals`

### Applied to live DB in Task 3 (no new files)
- Pushed migrations 0000 + 0001 to Supabase project `mzdnabewgjcnouzydwdb`
- Witness: `supabase migration list --linked` shows both in Remote column

## Decisions Made

See `key-decisions` in frontmatter. Highlights:

- **Seed via auth.users (Rule 1 fix):** The original `seedUsers()` in the plan template tried `INSERT INTO public.users` directly, which fails the `users_id_fk → auth.users` FK. Switched to `INSERT INTO auth.users` so the `on_auth_user_created` trigger populates `public.users`. Net benefit: this test now exercises trigger D-08 alongside the RLS policies D-21/D-22, giving us more coverage per assertion.
- **psql replaced by node -e + postgres.js:** `psql` is not installed on this laptop; installing it felt disproportionate to what Task 3's verification queries needed. The `postgres` package already in node_modules handles the same DDL introspection queries, and the resulting script is easy to diff vs. the plan's acceptance criteria. Documented the approach for future plans.
- **Skipped `supabase db diff --linked`:** Requires ~100 MB Docker image for a local Postgres to diff against. `supabase migration list --linked` already shows push state correctly. Not a load-bearing step in the plan (it was marked "optional but recommended").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] RLS test seedUsers FK violation**
- **Found during:** Task 4 first vitest run
- **Issue:** The plan's template for `seedUsers()` did `INSERT INTO public.users (id, timezone) VALUES (...)`. That fails with `insert or update on table "users" violates foreign key constraint "users_id_fk"` because `public.users.id → auth.users.id`. The plan itself notes this as a fallback: "If this fails with RLS/permission errors, switch that helper to the trigger path: insert into `auth.users`."
- **Fix:** Changed `seedUsers()` to INSERT into `auth.users` with the minimum required columns (`id`, `instance_id`, `aud`, `role`, `email`, `raw_user_meta_data`, `raw_app_meta_data`, `created_at`, `updated_at`, `email_confirmed_at`, `encrypted_password`). The `on_auth_user_created` trigger auto-creates the matching `public.users` row with `timezone='UTC'`. Updated `cleanup()` to DELETE from all three tables.
- **Files modified:** `tests/rls.test.ts`
- **Verification:** `npx vitest run tests/rls.test.ts` → 6/6 passed; trigger fired (public.users rows exist after seed, confirmed in test 5)
- **Committed in:** `b3d0f1d` (Task 4 commit)

**2. [Rule 3 — Blocking] DATABASE_URL quoting in .env.local**
- **Found during:** Prior session, Task 3 checkpoint preparation
- **Issue:** Pooler URL contains `&connection_limit=1` in the query string. Unquoted in `.env.local`, `source .env.local` treats `&` as a shell background-job separator, silently truncating DATABASE_URL.
- **Fix:** Wrapped the value in double-quotes in `.env.local` (gitignored; not committed). Node/Next.js/dotenv parse the same value correctly either way — only matters when humans `source` the file in a shell. The plan's documented env-loading idiom (`set -a; source .env.local; set +a`) requires the quotes.
- **Files modified:** `.env.local` (gitignored)
- **Verification:** `set -a; source .env.local; set +a && [ -n "$DATABASE_URL" ] && echo "OK (length=${#DATABASE_URL})"` → `OK (length=141)`
- **Committed in:** (not committed — gitignored)

**3. [Rule 3 — Blocking] psql unavailable; replaced with node -e + postgres.js**
- **Found during:** Task 3 verification step (this session)
- **Issue:** The plan's verification commands use `psql "$DATABASE_URL" -c "..."`. `psql` is not installed (`which psql` → "psql not found"). Installing PostgreSQL client tools system-wide is disproportionate for 7 introspection queries.
- **Fix:** Rewrote all 7 post-push queries as a single `node -e` script using the `postgres` package (already in node_modules from Plan 01). Same DB (DATABASE_URL), same SQL, different client.
- **Files modified:** none (ad-hoc verification; not a persistent artifact)
- **Verification:** All 7 queries returned the expected results; documented above in "Post-Push Verification Queries"
- **Committed in:** (verification-only, no code change)

**4. [Rule 3 — Skipped] `supabase db diff --linked` dry-run skipped**
- **Found during:** Task 3 execution
- **Issue:** The plan marks this step "optional but recommended" — it runs a local Postgres via Docker (~100 MB image) to diff against the remote, showing what changes the push will apply. We don't have Docker bandwidth/space budget right now; also, `supabase migration list --linked` already shows the local-vs-remote state table which is sufficient proof.
- **Fix:** Skipped the step. Went straight to `supabase db push --linked` with `yes |` pipe for non-TTY confirmation. Verified post-push via the 7 introspection queries + `migration list --linked`.
- **Files modified:** none
- **Verification:** Push succeeded cleanly; all 7 verification queries passed
- **Committed in:** (verification-only)

---

**Total deviations:** 4 auto-fixed (1 × Rule 1 bug, 3 × Rule 3 blocking/skipped)
**Impact on plan:** Zero scope change. Deviation 1 (trigger-path seeding) actually *strengthens* the test by exercising D-08 alongside D-21/D-22. Deviations 2–4 are environmental — plan's canonical path depends on tooling (quoted env, psql, Docker) that's not universally present. Documented approaches as patterns for future plans.

## Authentication Gates

- **Task 3 checkpoint (resolved):** `supabase db push --linked` is destructive against the dev project. Paused for user approval per `checkpoint:human-verify` protocol; user replied `approved` at 2026-04-19T02:13Z window; push executed immediately on resume. No other auth gates in this plan.

## Requirements Touched

| Requirement | Status | What this plan delivers |
|-------------|--------|-------------------------|
| **GOAL-04** (goal scoped to month via DATE first-of-month) | **COMPLETED** | `public.goals.month DATE NOT NULL` + `month_is_first_of_month CHECK (EXTRACT(DAY FROM month) = 1)` live in Supabase. Rejected mid-month INSERT is witnessed. App-layer `monthBucket()` (Plan 01-02) and DB-layer CHECK now both enforce the invariant. |

Frontmatter lists `requirements: [GOAL-04]`. Marked complete via `gsd-tools requirements mark-complete GOAL-04`.

## Threat Flags

None introduced beyond the plan's `<threat_model>`. Trust boundaries (DATABASE_URL → Postgres, anon key → browser, auth.users → public.users trigger, auth.uid() → RLS expressions) are all handled by design. No new network endpoints, file access patterns, or schema changes at trust boundaries that the plan didn't already enumerate.

## Known Stubs

None. Every file is production-intent; `tests/rls.test.ts` has no `describe.skip`, `it.skip`, `xdescribe`, `xit`, `TODO(phase-2)`, or `TODO(phase2)` markers (verified by grep per plan acceptance criteria).

## Issues Encountered

- **First vitest run of Task 4 failed on `seedUsers()`** — FK violation on `public.users.id → auth.users.id`. Caused by the plan template's direct-insert approach. Resolved via Rule 1 auto-fix: switched to `auth.users` insert and let the trigger populate `public.users`. See Deviation #1 for details. Turnaround: ~2 minutes.
- **No other issues.** Migrations applied cleanly; all 7 verification queries returned expected data; RLS test went green on the second run.

## User Setup Required

None. Task 3's human-action checkpoint (approving the `supabase db push`) was a one-time gate; the push itself and all subsequent verification were fully automated.

## Next Phase Readiness

**Plan 01-04 (auth server actions + middleware):** unblocked.
- `public.users` table exists with `timezone` column — Plan 04's signup server action can write it
- `auth.users → public.users` trigger is live — Plan 04 only needs to call `supabase.auth.signUp()`; the public.users row is auto-created
- `@supabase/ssr 0.10.2` + `@supabase/supabase-js 2.103.3` already installed (Plan 01)
- RLS is ON, so the anon-key browser flow will be correctly scoped the moment Plan 04 wires real auth

**Plan 01-05 (auth UI):** unblocked — waits on Plan 04's server actions, no direct dependency on this plan beyond the UX copy in the design doc.

**Phase 2 (goals CRUD):** unblocked from the DB side.
- `public.goals` table + `goal_type` enum + CHECK constraint + RLS policies are all live
- `monthBucket()` from Plan 01-02 produces the exact value the CHECK accepts
- `tests/rls.test.ts` will catch regressions to the 6-policy contract if Phase 2 changes the schema

**Known follow-ups:**
- Phase 2 will introduce child tables (`tasks`, `habit_check_ins`) joined via `goal_id`. Extend `tests/rls.test.ts` with 2 more assertions per table (cross-user SELECT + cross-user INSERT rejection) at that point.
- When Plan 04 wires the signup flow, add an integration test that calls the server action and asserts `public.users` has the row (belt to the trigger's suspenders).
- If/when we move off the pooler connection for server-side writes (e.g., direct connection 5432 for long-running jobs), revisit `prepare: false` — not needed on direct connections.

## Self-Check: PASSED

- File check — `test -f src/server/db/schema.ts` → FOUND
- File check — `test -f src/server/db/index.ts` → FOUND
- File check — `test -f drizzle.config.ts` → FOUND
- File check — `test -f supabase/migrations/0000_initial_schema.sql` → FOUND
- File check — `test -f supabase/migrations/0001_custom_constraints.sql` → FOUND
- File check — `test -f tests/rls.test.ts` → FOUND
- Commit check — `64a01dc` (Task 1) → FOUND in git log
- Commit check — `cb126a4` (Task 2) → FOUND in git log
- Commit check — `b3d0f1d` (Task 4) → FOUND in git log
- Verification — `npx tsc --noEmit` → exit 0
- Verification — `npx vitest run` (full suite) → exit 0, 17/17 passed (11 time + 6 rls)
- Verification — `npx vitest run tests/rls.test.ts` → exit 0, 6/6 passed
- Verification — `supabase migration list --linked` → both in Remote column
- Verification — 7 post-push introspection queries → all expected results
- Grep check — `tests/rls.test.ts` contains `SET LOCAL request.jwt.claims` and `SET LOCAL role = authenticated` → MATCH
- Negative check — `tests/rls.test.ts` does NOT contain any of `describe.skip|it.skip|xdescribe|xit|TODO(phase-?2)` → confirmed clean
- Negative check — no `drizzle-orm/neon` imports in `src/` → confirmed clean

## TDD Gate Compliance

This plan is `type: execute` (not TDD). Still, Task 4 effectively ships RED+GREEN in a single commit: the test asserts the live DB's RLS behavior, and the DB already landed its GREEN via Task 3's push. If we wanted to formalize the sequence as TDD, it would have been:
- (implicit RED) — before Task 3 push, the test would fail because the tables didn't exist
- (GREEN) — after Task 3 push, the test passes

No REFACTOR commit needed — the test is minimal.

---
*Phase: 01-foundations-auth*
*Plan: 03 — Drizzle schema + RLS migration*
*Completed: 2026-04-19*
