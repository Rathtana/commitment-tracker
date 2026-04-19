---
phase: 02-goals-dashboard-three-types
plan: "06"
subsystem: ui, database, api
tags: [habit-grid, supabase, drizzle, motion, sonner, roving-tabindex, undo, rls, tdd]

# Dependency graph
requires:
  - phase: 02-05
    provides: toggleTaskAction + ChecklistCard + undoLastMutation tasks branch — established undo pattern reused for habit branch
  - phase: 02-04
    provides: undoLastMutationAction skeleton + count branch + Sonner single-slot toast contract
  - phase: 02-01
    provides: habit_check_ins table with composite PK (goal_id, check_in_date); schema patterns for child tables
provides:
  - habit_check_in_undos sibling table (undo_id PK) with 4 RLS policies — enables undo for PK-less deletes
  - upsertHabitCheckIn service (transaction: record prior state, upsert or delete habit_check_ins)
  - upsertHabitCheckInAction server action with Zod gate + auth + revalidatePath
  - undoLastMutationAction extended to handle all 3 goal types (count, checklist, habit)
  - HabitGrid primitive — 7x6 month calendar with Hit/Miss/Today/Future states + roving tabindex + ARIA
  - HabitCard wrapper — ProgressBar + PaceChip + HabitGrid + progress text
  - GoalCardHandlers now includes onHabitToggle; goal-card/index.tsx wires all 3 types (exhaustive)
  - DashboardShell handleHabitToggle — optimistic dispatch + upsertHabitCheckInAction + showUndoToast
  - Full Phase 2 UAT passed (31 steps: CRUD, progress logging, backfill, undo, keyboard, reduced motion, CLS)
affects: [03-month-navigation, 04-launch-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "habit_check_in_undos sibling table: when a mutation deletes a row (no id to hang metadata on), use a separate undo-handle table keyed by client-generated undoId; undoLastMutation branches sequentially to find the correct table"
    - "Roving tabindex on role=grid: only one cell gets tabIndex=0 (active ISO); all others -1; arrow keys call setFocusedIso to move focus programmatically"
    - "TDD habit branch: RED commit (failing tests) → GREEN commit (implementation) with no REFACTOR needed"

key-files:
  created:
    - src/components/habit-grid.tsx
    - src/components/goal-card/habit.tsx
    - supabase/migrations/0005_habit_check_ins_undo.sql
  modified:
    - src/server/db/schema.ts
    - src/server/actions/progress.ts
    - src/server/services/progress.ts
    - src/components/goal-card/index.tsx
    - src/components/dashboard-shell.tsx
    - tests/actions.progress.test.ts
    - tests/rls.test.ts

key-decisions:
  - "D-33 resolution: habit_check_in_undos sibling table chosen over storing undo metadata on habit_check_ins — because habit check-ins are DELETED on uncheck (no row survives to carry metadata); sibling table keyed by undoId keeps undo semantics uniform across all 3 types"
  - "undoLastMutation branch order: count (progressEntries) → tasks (tasks table priorIsDone) → habit (habit_check_in_undos) — first match wins; single undoId handshake covers all goal types"
  - "HabitGrid cell state truth table: Hit=bg-primary; Miss=bg-muted; Today=ring-2 ring-ring ring-offset-2 ring-offset-card (hit or miss); Future=opacity-50 cursor-not-allowed disabled; aria-pressed mirrors isHit"
  - "Future-date rejection: both UI (disabled attribute) and service layer (input.checkInDate > todayStr throws OutOfMonthError) — defense in depth per T-02-31"
  - "Backfill via past-cell tap: same upsertHabitCheckInAction + same toast contract, just with isBackfill=true copy (e.g. 'Marked 2026-04-10 on Meditate daily')"

patterns-established:
  - "Pattern: All 3 goal types' handlers are wired through GoalCardHandlers interface — adding a 4th type requires only extending the interface + adding a case in goal-card/index.tsx switch"
  - "Pattern: showUndoToast(copy, undoId, optimisticReverse) — copy is action-specific text, undoId is client-generated uuid, optimisticReverse is the dispatch call to undo client state"
  - "Pattern: HabitGrid receives checkIns as string[] (ISO dates) — server can stream SSR data; component is stateless w.r.t. check-in storage"

requirements-completed: [PROG-03, PROG-04, PROG-05, POLSH-03]

# Metrics
duration: ~5min automated + human UAT checkpoint
completed: 2026-04-19
---

# Phase 2 Plan 6: Habit Card + HabitGrid + Phase UAT Summary

**habit_check_in_undos sibling table + upsertHabitCheckInAction + 7x6 HabitGrid with roving tabindex/ARIA + full Phase 2 UAT passing all 31 checks**

## Performance

- **Duration:** ~5 min (automated tasks 12:51–12:56 local) + human UAT checkpoint
- **Started:** 2026-04-19T19:51:08Z
- **Completed:** 2026-04-19 (UAT approved)
- **Tasks:** 4 (6.1 schema+migration, 6.2 TDD action+service, 6.3 HabitGrid+HabitCard+wire, 6.4 UAT)
- **Files modified:** 9

## Accomplishments

- Shipped the habit-card path completing the three-type feature matrix: count, checklist, and habit all fully functional end-to-end
- Solved the composite-PK undo problem: since habit_check_ins rows are deleted on uncheck (nothing to hang metadata on), introduced a sibling `habit_check_in_undos` table keyed by client-generated undoId; undoLastMutation now branches across all three tables sequentially
- HabitGrid is the most visually distinctive component in Phase 2 — 7x6 month calendar with Hit/Miss/Today/Future cell states, roving tabindex (arrow key navigation), and full ARIA labeling (role=grid, role=gridcell, aria-label per cell, aria-pressed)
- Full Phase 2 UAT passed: 31 steps spanning CRUD, progress logging for all three types, backfill, undo reversal, keyboard navigation, reduced motion, CLS verification, single-slot toast, and RLS isolation

## Task Commits

Each task was committed atomically:

1. **Task 6.1: Schema + Migration 0005 + RLS tests** - `4677063` (chore)
   - Pre-push: schema.ts extended, drizzle-kit generated, migration authored
   - `supabase db push --linked` run by user; post-push verified via inline node -e
2. **Task 6.2 RED: Failing tests for upsertHabitCheckInAction** - `560813e` (test)
3. **Task 6.2 GREEN: upsertHabitCheckInAction + service + undo extension** - `2702d4b` (feat)
4. **Task 6.3: HabitGrid + HabitCard + wire onHabitToggle** - `80b7094` (feat)
5. **Task 6.4: Manual UAT (31 steps)** - approved by user (no code commit — verification gate)

**Plan metadata:** (this SUMMARY + STATE + ROADMAP commit — see below)

## Files Created/Modified

- `src/components/habit-grid.tsx` — 7x6 month calendar: Hit/Miss/Today/Future cells, roving tabindex, arrow key navigation, aria-label per cell, aria-pressed, role=grid/gridcell
- `src/components/goal-card/habit.tsx` — HabitCard wrapper: ProgressBar + PaceChip + HabitGrid + "N of M days this month" label + kebab menu
- `src/components/goal-card/index.tsx` — Extended GoalCardHandlers with onHabitToggle; wired HabitCard case in type switch (now exhaustive)
- `src/components/dashboard-shell.tsx` — handleHabitToggle: optimistic dispatch → upsertHabitCheckInAction → showUndoToast with backfill-aware copy
- `src/server/actions/progress.ts` — upsertHabitCheckInAction added (5th revalidatePath("/dashboard"))
- `src/server/services/progress.ts` — upsertHabitCheckIn service + habit branch in undoLastMutation (wasChecked reversal logic)
- `src/server/db/schema.ts` — habitCheckInUndos pgTable (undo_id PK, goal_id FK CASCADE, check_in_date, was_checked, created_at) + 4 RLS policies
- `supabase/migrations/0005_habit_check_ins_undo.sql` — DDL for habit_check_in_undos table
- `tests/actions.progress.test.ts` — 3 new tests for upsertHabitCheckInAction (exported, rejects malformed date, rejects missing undoId)
- `tests/rls.test.ts` — describe('habit_check_in_undos RLS') with 4-test cross-user isolation matrix

## Decisions Made

**D-33 resolution — habit_check_in_undos sibling table:**
habit_check_ins has a composite PK (goal_id, check_in_date) and rows are DELETED on uncheck. Unlike tasks (which carry priorIsDone + lastUndoId inline), there is no row to hang undo metadata on after a delete. Solution: `habit_check_in_undos` records (undoId, goalId, checkInDate, wasChecked) in the same transaction that mutates habit_check_ins. wasChecked=true means the row existed before (undo re-inserts); wasChecked=false means it didn't (undo deletes). Keeps undo semantics uniform — undoLastMutation just branches sequentially.

**undoLastMutation branch order:**
count branch (progressEntries) → tasks branch (tasks.priorIsDone) → habit branch (habit_check_in_undos) → UndoNotFoundError. First match wins. All branches JOIN through goals.user_id for RLS-equivalent ownership check at the service layer.

**Defense in depth for future dates (T-02-31):**
HabitGrid disables future cells (disabled attribute + no onClick); service layer additionally asserts `input.checkInDate <= todayStr` and throws OutOfMonthError. Both layers reject; UI never sends, server never processes.

**HabitGrid ARIA contract:**
Each cell: `aria-label="{MMMM d} — {done|not done|today, done|today, not yet done|future}"` + `aria-pressed={isHit}`. Grid container: `role="grid"` + `aria-label="Habit grid for {MMMM yyyy}"`. Header row: `aria-hidden`. Future cells: `disabled` (implicit aria-disabled).

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria met on first attempt.

## Phase 2 Close-out

**All Phase 2 requirements verified complete:**

| Requirement | Description | Status |
|-------------|-------------|--------|
| GOAL-01 | Goal creation (count/checklist/habit) with name, type, target, notes, month | Complete |
| GOAL-02 | Goal editing (type immutable after creation) | Complete |
| GOAL-03 | Goal deletion with AlertDialog confirmation | Complete |
| PROG-01 | Count goal: +1 increment from dashboard | Complete |
| PROG-02 | Count goal: stepper and backfill for earlier days | Complete |
| PROG-03 | Habit goal: tap today's cell to mark done | Complete |
| PROG-04 | Habit goal: tap past cell to backfill | Complete |
| PROG-05 | Undo last progress action via short-lived toast (all 3 types) | Complete |
| DASH-01 | Dashboard renders all current-month goals with progress bar | Complete |
| DASH-02 | Pace chip (behind/ahead/warming-up) on applicable goal types | Complete |
| POLSH-03 | Habit month-grid showing hit/miss/today/future cells | Complete |

**Manual UAT results (Task 6.4 — 31 steps):**
- Setup (steps 1-2): empty state + goal type picker — PASS
- Count goal flow (steps 3-9): create, +1 with spring animation, undo, rapid clicks single-slot, stepper, backfill — PASS
- Checklist goal flow (steps 10-14): create, checkbox toggle, line-through, undo, no pace chip — PASS
- Habit goal flow (steps 15-22): create, 7x6 grid render, tap today, unmark, backfill past day, future disabled, keyboard navigation, aria-labels — PASS
- Edit + delete flow (steps 23-25): edit prefilled dialog, change target, delete with confirmation — PASS
- Reduced motion (steps 26-28): bar updates instantly, no spring — PASS
- CLS check (step 29): Lighthouse CLS < 0.1 — PASS
- Toast single-slot (step 30): only 1 toast visible at a time — PASS
- RLS isolation (step 31): User B sees no User A goals — PASS

## Known Stubs

None — all goal types fully wired with live data.

## Issues Encountered

None. Build and TypeScript clean on first attempt for all automated tasks.

## Next Phase Readiness

Phase 2 is complete. All 6 plans shipped and UAT passed.

**Ready for Phase 3: Month Navigation, History & Reflection:**
- `getMonthDashboard(userId, month)` query shape already accepts any month — Phase 3 can add URL routing against it
- Past-month read-only enforcement is currently app-layer only (plan notes this is intentional); Phase 3 should add API-layer 403
- GoalCardHandlers interface and DashboardShell reducer are extensible — Phase 3 can add navigation handlers without touching goal-type logic

**Resolved research flags from STATE.md:**
- "Motion + shadcn Progress customization" flag: resolved in Plan 02-02 (scaleX CLS-safe approach)
- "Temporal API vs date-fns-tz" flag: resolved in Plan 01-02 (date-fns + TZDate pattern locked)

---
*Phase: 02-goals-dashboard-three-types*
*Completed: 2026-04-19*
