---
phase: 03-month-navigation-history-reflection
plan: 3
subsystem: database
tags: [schema, migration, service, server-action, rls, tdd]
dependency_graph:
  requires:
    - 03-01 (upsertReflectionSchema, compareMonth, monthBucket)
    - 01-03 (Supabase dev project linked, migration push infra)
  provides:
    - monthReflections Drizzle table + 4 RLS policies
    - migration 0006_salty_jack_power.sql (CREATE TABLE + policies)
    - migration 0007_month_reflections_check.sql (CHECK first-of-month)
    - upsertReflection service (onConflictDoUpdate)
    - upsertReflectionAction (auth guard + D-28 future-month gate)
    - countGoalsInMonth query helper
    - getReflectionForMonth query helper
  affects:
    - 03-04 (ReflectionCard UI — consumes upsertReflectionAction + getReflectionForMonth)
    - 03-05 (WelcomeModal — consumes countGoalsInMonth for prior-month trigger)
tech_stack:
  added: []
  patterns:
    - Drizzle onConflictDoUpdate targeting composite UNIQUE(user_id, month)
    - Hand-authored CHECK migration (0007) following Phase 1 D-09 pattern
    - ActionResult<T> shape with Zod parse-before-auth guard ordering
    - D-28 server-side future-month gate via compareMonth(viewedMonth, currentMonth)
    - RLS smoke via postgres.js SET LOCAL role=authenticated + forged JWT claims
key_files:
  created:
    - src/server/services/reflections.ts
    - src/server/actions/reflections.ts
    - supabase/migrations/0006_salty_jack_power.sql
    - supabase/migrations/0007_month_reflections_check.sql
    - tests/actions.reflections.test.ts
  modified:
    - src/server/db/schema.ts (monthReflections table appended)
    - src/server/db/queries.ts (countGoalsInMonth + getReflectionForMonth appended)
    - tests/rls.test.ts (month_reflections RLS suite appended)
decisions:
  - "Migration 0006 drizzle-kit suffix: 0006_salty_jack_power.sql (drizzle-kit chosen suffix — not renamed per plan note)"
  - "FutureMonthReflectionError defined in service but only caught in action layer — service itself does not throw it (action handles compareMonth check before calling service)"
  - "TDD test mocking: vi.mock at module level (not vi.doMock) required to intercept @/lib/supabase/server before module loads — mirrors actions.goals.test.ts pattern"
metrics:
  duration: ~25min (including human-action checkpoint wait for supabase db push)
  completed: 2026-04-26
  tasks_completed: 4
  files_changed: 8
---

# Phase 03 Plan 03: Reflections Schema + Service Summary

Month_reflections table, migrations, UPSERT service, server action, query helpers, and test coverage — all committed and live on the Supabase dev project.

## What Was Built

**Schema (Task 1):** `monthReflections` pgTable appended to `src/server/db/schema.ts` with columns `(id, userId, month, whatWorked, whatDidnt, createdAt, updatedAt)`, FK cascade on `userId`, UNIQUE constraint `(userId, month)`, and 4 pgPolicy RLS blocks (select/insert/update/delete for `user_id = auth.uid()`).

**Migrations (Task 2):**
- `0006_salty_jack_power.sql` — drizzle-kit generated (CREATE TABLE + UNIQUE + FK + 4 RLS CREATE POLICY statements)
- `0007_month_reflections_check.sql` — hand-authored CHECK constraint (`EXTRACT(DAY FROM month) = 1`) following Phase 1 D-09 pattern

**Supabase push (Task 3 — human-action checkpoint):** `supabase db push --linked` applied both migrations to the linked dev project. Verification JSON confirmed: `{"table":1,"check":1,"policies":4}`.

**Service + Action + Queries (Task 4 — TDD):**
- `src/server/services/reflections.ts`: `upsertReflection` using `onConflictDoUpdate({ target: [userId, month] })` + `FutureMonthReflectionError` class
- `src/server/actions/reflections.ts`: `upsertReflectionAction` — Zod parse → auth guard → D-28 future-month server-side gate → service call → `revalidatePath`
- `src/server/db/queries.ts`: `countGoalsInMonth` + `getReflectionForMonth` appended
- `tests/actions.reflections.test.ts`: 14 tests covering auth guard, Zod rejection, D-28 future gate, D-27 past allowed, current month allowed, D-30 empty→null transform, response shape
- `tests/rls.test.ts`: 4 new RLS smoke tests for `month_reflections` (T-03-08)

## Verification

```
Tests: 212 passed (17 test files) — no regressions
TypeScript: npx tsc --noEmit exits 0
Supabase push: {"table":1,"check":1,"policies":4}
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 55b0a4c | feat(03-03): add monthReflections table + RLS policies to Drizzle schema |
| 2 | 13b2fb7 | feat(03-03): generate migration 0006 + hand-author migration 0007 |
| 3 | (human-action checkpoint — no code commit) | supabase db push --linked |
| 4 RED | b4ecf94 | test(03-03): add failing tests for reflections action + service + queries |
| 4 GREEN | 876cd9d | feat(03-03): implement upsertReflection service + action + query helpers + RLS test |

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes

**Migration filename:** drizzle-kit generated `0006_salty_jack_power.sql` (not `0006_month_reflections.sql`). The plan anticipated this and instructed to use whatever suffix drizzle-kit chose. References in SUMMARY use the actual filename.

**FutureMonthReflectionError usage:** The class is defined in the service file as specified, but the service itself does not throw it (the action catches the `compareMonth` result before calling the service). The class exists for type safety and potential future use if the service needs to enforce the constraint independently.

**TDD mock pattern:** `vi.doMock` (per-test dynamic mocking) does not intercept module loads after the first import. Top-level `vi.mock` (hoisted) is required — consistent with `tests/actions.goals.test.ts`. The test file was rewritten to use this pattern (Rule 1 — auto-fix).

## Known Stubs

None — all functions are fully implemented and wired to the live DB.

## Threat Flags

No new security-relevant surface beyond what the plan's threat model covers. All T-03-06 through T-03-11 mitigations are implemented:
- T-03-06: Zod `.max(280)` server-side re-parse in action
- T-03-07: `compareMonth === "future"` gate in action
- T-03-08: RLS `user_id = auth.uid()` + smoke test in rls.test.ts
- T-03-09: `UNIQUE(user_id, month)` + `onConflictDoUpdate` atomic
- T-03-11: `CHECK(EXTRACT(DAY FROM month) = 1)` in migration 0007

## Self-Check: PASSED

All created files exist on disk. All 4 task commits verified in git log.
