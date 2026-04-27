---
phase: 03-month-navigation-history-reflection
plan: 2
subsystem: api
tags: [service, security, error-handling, tdd, drizzle, typescript]

# Dependency graph
requires:
  - phase: 03-month-navigation-history-reflection
    plan: 1
    provides: monthBucket + compareMonth time utilities and reflection schema foundations
  - phase: 02
    provides: OutOfMonthError throw sites in progress.ts, updateGoal/deleteGoal service stubs

provides:
  - ReadOnlyMonthError class exported from services/progress.ts with message "This month is archived."
  - updateGoal service with userTz param and past-month guard (future-month CRUD allowed per D-09)
  - deleteGoal service refactored to load-then-check transaction with same past/future rule
  - actions/goals.ts wires userTz server-side and maps ReadOnlyMonthError to UI-SPEC copy
  - tests/readonly-month-enforcement.test.ts: 8 service-layer cases prove guard works without UI
  - Zero OutOfMonthError references in codebase (confirmed by grep)

affects:
  - 03-03 (UI month-navigation will rely on this error shape for gate feedback)
  - 03-04 (kebab-menu disable logic is UX layer on top of this service enforcement)
  - 03-05 (reflection write path may need same past-month check pattern)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ReadOnlyMonthError single-source-of-truth: class lives in progress.ts, re-exported from goals.ts"
    - "load-then-check transaction: deleteGoal loads goal row inside tx to inspect month before delete"
    - "Lexical ISO date comparison: goal.month < currentMonthStr (YYYY-MM-DD strings, past-only block)"
    - "resolveUserTz always server-side: actions never accept userTz from client body (T-03-03 mitigation)"

key-files:
  created:
    - tests/readonly-month-enforcement.test.ts
  modified:
    - src/server/services/progress.ts
    - src/server/services/goals.ts
    - src/server/actions/progress.ts
    - src/server/actions/goals.ts
    - tests/actions.progress.test.ts
    - tests/actions.goals.test.ts

key-decisions:
  - "ReadOnlyMonthError imported from progress.ts into goals.ts (single source of truth) and re-exported — consumers import from either file"
  - "Past-month guard uses lexical string comparison: existing.month < currentMonthStr; future (>) is ALLOWED per D-09"
  - "deleteGoal refactored from atomic DELETE to load-first transaction so month can be inspected before deletion"
  - "resolveUserTz called server-side in action layer; userTz never accepted from client (T-03-03 mitigation)"
  - "Throw site count after rename: 8 total (incrementCount x1, backfillCount x3, toggleTask x1, upsertHabitCheckIn x3, goals.updateGoal x1, goals.deleteGoal x1 = 10 sites total across both service files)"

patterns-established:
  - "ReadOnlyMonthError: single class, single message 'This month is archived.' — all service files import from progress.ts"
  - "Service guard pattern: load goal row → compare month strings → throw ReadOnlyMonthError if past → proceed"
  - "Action error mapping order: ReadOnlyMonthError checked BEFORE GoalNotFoundError (most-specific first)"
  - "TDD: RED test for class existence/message → GREEN rename + update consumers → full suite"

requirements-completed: [MNAV-02, GOAL-05]

# Metrics
duration: 5min
completed: 2026-04-27
---

# Phase 03 Plan 02: ReadOnly Month Enforcement Summary

**Service-layer read-only defense generalized: `OutOfMonthError` renamed to `ReadOnlyMonthError` with UI-SPEC copy, `updateGoal`/`deleteGoal` gain past-month guards (future-month CRUD allowed per D-09), and a dedicated test file bypasses the UI to prove the 403 contract**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-27T03:51:54Z
- **Completed:** 2026-04-27T03:56:57Z
- **Tasks:** 2
- **Files modified:** 6 (+ 1 created)

## Accomplishments
- Renamed `OutOfMonthError` → `ReadOnlyMonthError` with message "This month is archived." (UI-SPEC verbatim copy) — zero old references remain in repo
- Extended `updateGoal` and `deleteGoal` services with `userTz` parameter and past-month guard; `deleteGoal` refactored to load-then-check transaction pattern to enable month inspection before delete
- Service-level test suite (`tests/readonly-month-enforcement.test.ts`) asserts the layered-defense contract with 8 cases covering past/current/future for both goal services and D-11 future-progress block — no UI required
- Action layer (`actions/goals.ts`) resolves `userTz` server-side, passes to services, maps `ReadOnlyMonthError` to exact UI-SPEC copy in both `updateGoalAction` and `deleteGoalAction`

## Task Commits

1. **Task 1: Rename OutOfMonthError → ReadOnlyMonthError** - `e4ec7b0` (feat)
2. **Task 2: Extend updateGoal + deleteGoal with guard; wire userTz through actions** - `120220a` (feat)

## Files Created/Modified
- `src/server/services/progress.ts` - Renamed class + message; 8 throw sites updated
- `src/server/services/goals.ts` - Imports ReadOnlyMonthError; updateGoal/deleteGoal gain userTz + past-month guard; re-exports class
- `src/server/actions/progress.ts` - Import rename + error mapper updated to new copy
- `src/server/actions/goals.ts` - Imports ReadOnlyMonthError; resolveUserTz wired into update + delete; error mapping added
- `tests/actions.progress.test.ts` - Added ReadOnlyMonthError class contract tests (export + message)
- `tests/actions.goals.test.ts` - Added service mock + 3 action-layer tests (tests 9-11: past throws, future succeeds)
- `tests/readonly-month-enforcement.test.ts` (created) - 8 service-layer smoke cases for the 403 contract

## Decisions Made

- **ReadOnlyMonthError single source of truth:** Class lives in `progress.ts`, imported and re-exported from `goals.ts`. Consumers can import from either file without circular dependency issues (goals.ts imports from progress.ts, never the reverse).
- **Lexical date comparison for month guard:** `existing.month < currentMonthStr` where both are ISO `YYYY-MM-DD` first-of-month strings — lexical ordering equals calendar ordering (confirmed by RESEARCH §Pattern 2 Assumption A2).
- **deleteGoal load-first transaction:** Original `db.delete().where().returning()` pattern could not inspect `goal.month` before deleting. Refactored to `db.transaction` with `SELECT month → check → DELETE` so the month guard can fire before any mutation.
- **resolveUserTz server-side only:** `userTz` derived from `public.users.timezone` inside the action, never accepted from the client request body — mitigates T-03-03 (userTz spoofing).
- **Exact throw-site count:** 8 sites renamed in `progress.ts` + 2 new sites added in `goals.ts` = 10 total `throw new ReadOnlyMonthError()` in the codebase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invalid Zod 4 UUIDs in action-layer tests**
- **Found during:** Task 2 (action-layer test writing)
- **Issue:** Test UUIDs like `00000000-0000-0000-0000-000000000010` fail Zod 4's strict RFC 4122 validation (version nibble `[1-8]` required). Actions were returning "Invalid input." instead of reaching service mocks.
- **Fix:** Replaced with valid v4-format UUID `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11` in the new test cases.
- **Files modified:** tests/actions.goals.test.ts
- **Verification:** Tests 9-11 now pass (received `ReadOnlyMonthError` error copy as expected)
- **Committed in:** 120220a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in test data)
**Impact on plan:** Necessary for test correctness. No scope creep.

## Issues Encountered

None beyond the UUID fix above.

## Known Stubs

None — this plan is purely service/action layer with no UI components.

## Threat Flags

None — all surfaces modified were existing service/action files. No new network endpoints, auth paths, or schema changes introduced.

## Next Phase Readiness
- `ReadOnlyMonthError` with message "This month is archived." is locked and ready for Plans 03-04/05 to use in UI-side error display
- `updateGoal` and `deleteGoal` are now hardened; Plans 03-04/05 UI kebab-menu disable logic is UX on top of this already-working service guard
- Full suite: 168 tests pass; only `rls.test.ts` excluded (requires DATABASE_URL — pre-existing, not caused by this plan)

---
*Phase: 03-month-navigation-history-reflection*
*Completed: 2026-04-27*
