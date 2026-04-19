---
phase: 02-goals-dashboard-three-types
plan: 5
subsystem: checklist-card
tags: [checklist, tasks, toggle, undo, optimistic-ui, sonner, drizzle, server-actions, tdd]

requires:
  - phase: 02-01
    provides: Zod schemas (toggleTaskSchema, ToggleTaskInput), DB schema (tasks table + RLS)
  - phase: 02-02
    provides: DashboardShell (useOptimistic + discriminated reducer with checklist:toggle action)
  - phase: 02-04
    provides: Toast contract (id:'progress-undo', 6s, undoLastMutationAction), GoalCard variant picker, GoalCardHandlers interface

provides:
  - toggleTask service: ownership JOIN + type/month assert + transactional is_done flip with priorIsDone capture
  - TaskNotFoundError typed error class
  - toggleTaskAction server action (Zod gate + auth + service + revalidatePath)
  - undoLastMutation extended: tasks branch restores is_done from priorIsDone via lastUndoId
  - ChecklistCard component: task rows with shadcn Checkbox, line-through done styling, empty-state, PaceChip suppressed
  - GoalCardHandlers extended with onChecklistToggle
  - DashboardShell handleChecklistToggle: optimistic dispatch + server action + undo toast (same contract as count)

affects:
  - Plan 02-06 (habit card) — extends GoalCardHandlers + undoLastMutation with habit branch
  - Plan 03+ (read-only past months) — toggleTask month-bound assert already present

tech-stack:
  added: []
  patterns:
    - tasks table stores undo metadata inline (priorIsDone + lastUndoId) — no separate audit log per D-07
    - undoLastMutation branches: count branch (progressEntries.undoId) then checklist branch (tasks.lastUndoId); Plan 06 adds habit branch before throw
    - toggleTask service follows same ownership JOIN pattern as incrementCount (tasks -> goals WHERE goals.user_id = userId)
    - TDD RED/GREEN: test file committed failing before implementation (2 new tests)

key-files:
  created:
    - src/components/goal-card/checklist.tsx (ChecklistCard — shadcn Checkbox rows, line-through, empty-state, PaceChip suppressed)
  modified:
    - src/server/services/progress.ts (TaskNotFoundError + toggleTask + undoLastMutation checklist branch)
    - src/server/actions/progress.ts (toggleTaskAction + TaskNotFoundError in mapServiceError)
    - src/components/goal-card/index.tsx (onChecklistToggle in GoalCardHandlers; checklist case wired)
    - src/components/dashboard-shell.tsx (handleChecklistToggle + toggleTaskAction import)
    - tests/actions.progress.test.ts (2 new tests: toggleTaskAction exported + rejects malformed input)

key-decisions:
  - "D-07: tasks table stores undo metadata inline (priorIsDone + lastUndoId) — set transactionally AT flip time; undoLastMutation restores from priorIsDone and clears both fields"
  - "D-33: undoLastMutation extended with tasks branch after count branch; single undoId handshake covers both goal types transparently"
  - "D-34: ChecklistCard reuses id:'progress-undo' Sonner slot verbatim from Plan 04 toast contract — single slot replaces, most-recent-only"
  - "D-12: PaceChip suppressed for checklist goals via suppressForChecklist prop — checklist has no time axis, chip would be meaningless"
  - "D-24: ChecklistCard follows same card anatomy: CardHeader (icon + title + kebab), CardContent (ProgressBar + PaceChip row, task list, progress text)"
  - "D-29: Task toggle fires toggleTaskAction directly (not via a log entry) — tasks are their own log per D-07"

patterns-established:
  - "toggleTask service pattern: ownership JOIN tasks->goals WHERE goals.user_id=userId + type assert + month assert + transactional update"
  - "undo extension pattern: try count branch → try tasks branch → (Plan 06: try habit branch) → throw UndoNotFoundError"
  - "ChecklistCard empty-state: 'No tasks yet. Edit this goal to add some.' — render when tasks.length === 0"

requirements-completed: [PROG-02, PROG-05]

duration: ~5min (tasks 5.2 + 5.3; task 5.1 completed in prior session)
completed: 2026-04-19
---

# Phase 2 Plan 5: Checklist Card + Task Toggle Summary

**Checklist card with shadcn Checkbox rows, line-through done styling, and optimistic toggle using inline undo metadata (priorIsDone + lastUndoId on tasks table per D-07) — undoLastMutation now handles both count and checklist reversals via single undoId handshake.**

## Performance

- **Duration:** ~5 min (tasks 5.2 + 5.3; task 5.1 pre-completed with checkpoint)
- **Started:** 2026-04-19T19:44:00Z
- **Completed:** 2026-04-19T19:47:44Z
- **Tasks:** 2 (5.2 + 5.3; 5.1 was the migration checkpoint completed before resume)
- **Files modified:** 5

## Accomplishments

- Extended `src/server/services/progress.ts` with `toggleTask` (ownership + type + month asserts, transactional priorIsDone capture) and checklist branch in `undoLastMutation`
- Added `toggleTaskAction` to `src/server/actions/progress.ts` following the same Zod-gate + auth + revalidate pattern as count actions
- Built `ChecklistCard` with full shadcn Checkbox rows, line-through for done tasks, empty-state fallback, and PaceChip suppressed (D-12)
- Wired `handleChecklistToggle` in DashboardShell reusing exact Plan 04 toast contract (`id:'progress-undo'`, 6s, Undo action)

## Task Commits

Each task was committed atomically:

1. **Task 5.1: Migration 0004** - `40b5c63` (chore) — pre-committed before resume
2. **Task 5.2 RED: Failing tests for toggleTaskAction** - `c9a442d` (test)
3. **Task 5.2 GREEN: toggleTaskAction + service + extend undoLastMutation** - `88fd8bb` (feat)
4. **Task 5.3: ChecklistCard + onChecklistToggle wiring** - `8a080da` (feat)

**Plan metadata:** (docs commit — this summary)

_Note: TDD task 5.2 has separate RED (test) and GREEN (feat) commits._

## Files Created/Modified

- `src/server/services/progress.ts` — Added `TaskNotFoundError`, `toggleTask` service function, and checklist branch in `undoLastMutation`
- `src/server/actions/progress.ts` — Added `toggleTaskAction`; extended `mapServiceError` with `TaskNotFoundError`
- `src/components/goal-card/checklist.tsx` — New: ChecklistCard with Checkbox rows, line-through, empty-state, suppressed PaceChip
- `src/components/goal-card/index.tsx` — Extended `GoalCardHandlers` with `onChecklistToggle`; wired checklist case (no longer returns null)
- `src/components/dashboard-shell.tsx` — Added `handleChecklistToggle` + `toggleTaskAction` import; added `onChecklistToggle` to handlers object
- `tests/actions.progress.test.ts` — 2 new describes: toggleTaskAction exported + rejects malformed input; undo malformed undoId regression

## Decisions Made

- **D-07 compliance:** `priorIsDone` + `lastUndoId` stored directly on the `tasks` row and set transactionally at flip time. `undoLastMutation` restores `isDone ← priorIsDone` and clears both fields. No separate audit table needed.
- **D-33 extension:** `undoLastMutation` branches sequentially — count branch first (progressEntries), tasks branch second, Plan 06 adds habit branch. Single `undoId` handshake works transparently across all goal types.
- **D-34 reuse:** `handleChecklistToggle` calls `showUndoToast` with identical `id:'progress-undo'` + `duration:6000` — single Sonner slot replaces on every mutation regardless of type.
- **D-12 enforcement:** `<PaceChip suppressForChecklist />` renders null for checklist goals — no time-axis-dependent pace display.

## Deviations from Plan

None — plan executed exactly as written. The `toggleTask` service signature, undo extension shape, and ChecklistCard component match the plan spec verbatim.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `case 'habit': return null` | `goal-card/index.tsx:28` | Plan 06 wires HabitCard |
| Extension point comment | `services/progress.ts` | Plan 06 adds habit_check_ins branch to undoLastMutation |

The habit null does not prevent Plan 05's goal — checklist cards now render fully. The variant picker simply passes through for the habit type not yet wired.

## Threat Surface Scan

All STRIDE threat mitigations from the plan's threat model were implemented:
- T-02-26: `toggleTask` JOINs tasks→goals WHERE goals.user_id = userId (cross-user toggle prevention)
- T-02-27: Service asserts `goal.type === 'checklist'` before mutating (WrongGoalTypeError)
- T-02-28: Service asserts `goal.month === monthBucket(now, userTz)` (OutOfMonthError)
- T-02-29: `priorIsDone` not selected by `getMonthDashboard` — not exposed to client
- T-02-30: `done_at` + `last_undo_id` audit trail per D-07; no separate log

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test file committed failing) | c9a442d | PASSED — 2 tests failed (toggleTaskAction undefined) |
| GREEN (implementation commits) | 88fd8bb | PASSED — all 8 tests pass |
| REFACTOR | N/A | Not needed |

## Green Gate Verification

| Check | Result |
|-------|--------|
| `npx vitest run tests/actions.progress.test.ts` | PASSED (8/8) |
| `npx vitest run` (all non-DB tests) | PASSED (117/117) |
| `npx tsc --noEmit` | PASSED |
| `npm run build` | PASSED (12 routes, /dashboard dynamic) |
| `grep -n "export async function toggleTask\b" services/progress.ts` | 1 match (line 98) |
| `grep -n "priorIsDone: row.taskIsDone" services/progress.ts` | 1 match (line 125) |
| `grep -n "eq(tasks.lastUndoId, input.undoId)" services/progress.ts` | 1 match (line 166) |
| `grep -n "export async function toggleTaskAction" actions/progress.ts` | 1 match (line 99) |
| `grep -c "revalidatePath(\"/dashboard\")" actions/progress.ts` | 4 |
| `grep -n "<Checkbox" checklist.tsx` | 1 match |
| `grep -n "line-through" checklist.tsx` | 1 match |
| `grep -n "suppressForChecklist" checklist.tsx` | 1 match |
| `grep -n "id: 'progress-undo'" dashboard-shell.tsx` | 1 match |

## Self-Check: PASSED
