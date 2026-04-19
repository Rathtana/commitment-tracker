---
phase: 02-goals-dashboard-three-types
verified: 2026-04-19T00:00:00Z
status: human_needed
score: 5/5
overrides_applied: 0
human_verification:
  - test: "Visual appearance of progress bar spring animation and pace chip on a real device"
    expected: "Bar fills smoothly with spring physics on +1/toggle; pace chip shows 'behind by N'/'ahead by N'/'on pace' with correct colors; no layout shift observable"
    why_human: "CLS and animation feel cannot be verified programmatically; UAT step 29 (Lighthouse CLS < 0.1) was reportedly passed but verifier cannot re-run Lighthouse"
  - test: "Keyboard navigation of HabitGrid (Tab in, arrow keys move focus, Enter/Space toggles)"
    expected: "Tab moves focus to first enabled cell; ArrowRight/Left/Up/Down navigate between enabled cells; Enter/Space toggles the focused cell; Tab exits grid"
    why_human: "ARIA + roving-tabindex correctness requires interactive browser session; code presence is confirmed but behavior needs hands-on test"
  - test: "Reduced-motion mode suppresses spring animation"
    expected: "With OS 'Reduce Motion' enabled, bar updates instantly (no spring); disabling returns to spring animation"
    why_human: "Requires OS-level preference and visual inspection; UAT step 26-28 reportedly passed"
---

# Phase 2: Goals & Dashboard (Three Types) — Verification Report

**Phase Goal:** User opens the dashboard, sees every current-month goal at a glance with a moving progress bar, and can log progress in one click for any of the three goal shapes (count, checklist, habit) — including pace-aware feedback and a habit month-grid.

**Verified:** 2026-04-19
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can create a goal (count/checklist/habit) with name, type, target, optional notes, and month — and edit or delete it with confirmation | VERIFIED | `createGoalAction`/`updateGoalAction`/`deleteGoalAction` confirmed in `src/server/actions/goals.ts`; 2-step `CreateGoalDialog` in `src/components/create-goal-dialog.tsx`; `DeleteGoalDialog` (AlertDialog) in `src/components/delete-goal-dialog.tsx`; type immutability enforced via `GoalTypeImmutableError` in `src/server/services/goals.ts:57`. Notes field accepted by Zod schema but no `notes` column exists in the `goals` DB table — notes are silently dropped (WR-01 from code review). This is advisory-only and does not block the goal since notes is marked optional. |
| 2 | Dashboard renders all current-month goals in a single scrollable list with a visual progress bar on every card | VERIFIED | `src/app/(protected)/dashboard/page.tsx` calls `getMonthDashboard(user.id, month)` and renders `DashboardShell` (when goals exist) or `EmptyState`; `ProgressBar` component confirmed with `scaleX`, `origin-left`, `initial={false}`, `useReducedMotion`, `bg-primary` fill; all three card types (`CountCard`, `ChecklistCard`, `HabitCard`) render a `ProgressBar` |
| 3 | User can increment a count goal in one click, toggle a checklist sub-task in one click, and mark today done on a habit goal in one tap — all directly from the dashboard with optimistic UI | VERIFIED | `CountCard` has `+1` button wired to `handlers.onCountIncrement(goal.id, 1)`; `ChecklistCard` has shadcn `Checkbox` wired via `handlers.onChecklistToggle`; `HabitCard` has `HabitGrid` cells wired via `handlers.onHabitToggle`; all three dispatch to `useOptimistic` in `DashboardShell` inside `startTransition` before server action call |
| 4 | User can log a missed check-in for any prior day within the current month, and undo the last progress action via a short-lived toast | VERIFIED | `EarlierDayPopover` (count backfill) confirmed with `disabled={iso >= todayStr}` gate; `HabitGrid` past-cell tap calls `upsertHabitCheckInAction` with `isChecked`; undo toast confirmed: `id: 'progress-undo'`, `duration: 6000`, single Sonner slot; `undoLastMutation` handles all three goal types sequentially (count → tasks → habit_check_in_undos) |
| 5 | Habit goal cards show a month-grid alongside the bar revealing which specific days were hit and which were missed (no punishing streak counter) | VERIFIED | `src/components/habit-grid.tsx` confirmed: `role="grid"`, `role="gridcell"`, `tabIndex={iso === activeIso ? 0 : -1}` (roving tabindex), `ArrowRight`/`ArrowLeft`/`ArrowDown`/`ArrowUp` keyboard handlers, `opacity-50 cursor-not-allowed` for future cells, `ring-2 ring-ring ring-offset-2 ring-offset-card` for today, `aria-label` per cell; no streak counter logic present |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/server/db/schema.ts` | tasks, habitCheckIns, progressEntries tables + RLS + nullable polymorphic cols on goals | VERIFIED | `export const tasks = pgTable`, `habitCheckIns`, `progressEntries` confirmed; `lastUndoId`/`priorIsDone` on tasks; `habitCheckInUndos` table present |
| `supabase/migrations/0002_phase2_children.sql` | Child tables + RLS | VERIFIED | File exists in `supabase/migrations/` |
| `supabase/migrations/0003_polymorphic_check.sql` | Polymorphic validity + non-negativity CHECKs | VERIFIED | File exists |
| `supabase/migrations/0004_tasks_undo_id.sql` | Adds last_undo_id + prior_is_done to tasks | VERIFIED | File exists |
| `supabase/migrations/0005_habit_check_ins_undo.sql` | habit_check_in_undos table + 4 RLS policies | VERIFIED | File exists |
| `src/lib/progress.ts` | Pure computeProgress function — single source of truth for % + pace | VERIFIED | Exports `computeProgress`, `type Goal`, `type Pace`, `type ProgressSnapshot`; uses `TZDate` from `@date-fns/tz` |
| `src/lib/schemas/goals.ts` | Canonical Zod discriminated-union schemas | VERIFIED | Two `z.discriminatedUnion("type", ...)` (create + update); 14+ exports confirmed |
| `src/components/progress-bar.tsx` | Motion scaleX + origin-left + useReducedMotion + initial={false} bar | VERIFIED | All 4 invariants confirmed: `scaleX: clamped`, `origin-left`, `initial={false}`, `useReducedMotion()` |
| `src/components/pace-chip.tsx` | cva variants: on-pace/behind/ahead; returns null for warming-up | VERIFIED | `paceChipVariants` cva confirmed; `if (pace === 'warming-up') return null`; `if (suppressForChecklist) return null` |
| `src/components/dashboard-shell.tsx` | useOptimistic hoist + discriminated reducer + all handlers | VERIFIED | `useOptimistic(initialGoals, dashboardReducer)`, `startTransition` in all handlers; all 4 handler functions wired (`handleCountIncrement`, `handleCountBackfill`, `handleChecklistToggle`, `handleHabitToggle`) |
| `src/server/db/queries.ts` | getMonthDashboard single-trip query | VERIFIED | `export async function getMonthDashboard`; single `db.select(`; `json_agg`; `array_agg` |
| `src/app/(protected)/dashboard/page.tsx` | RSC auth-gate + month fetch + EmptyState/DashboardShell | VERIFIED | `redirect("/login")` on no user; `monthBucket(now, userTz)`; `getMonthDashboard(user.id, month)` |
| `src/server/actions/goals.ts` | createGoalAction, updateGoalAction, deleteGoalAction | VERIFIED | All three present; `"use server"` at line 1; `safeParse` in each; `revalidatePath("/dashboard")` ×3 |
| `src/server/services/goals.ts` | Ownership assertion + month resolution + DB mutation | VERIFIED | `monthBucket(new Date(), userTz)` in createGoal; `db.transaction` ×2; `existing[0].type !== input.type` check |
| `src/server/actions/progress.ts` | incrementCountAction, backfillCountAction, undoLastMutationAction, toggleTaskAction, upsertHabitCheckInAction | VERIFIED | All 5 confirmed at lines 49, 67(?), 86(?), 102, 120 |
| `src/server/services/progress.ts` | Atomic transactions + month-bound + ownership | VERIFIED | `db.transaction` ×6+; `GREATEST(0, ...)` SQL clamp ×2+; `OutOfMonthError`; `GoalNotFoundError` |
| `src/components/goal-card/count.tsx` | +1 button + stepper + kebab with Edit/Log-for-earlier-day/Delete | VERIFIED | `onClick={() => handlers.onCountIncrement(goal.id, 1)}`; `EarlierDayPopover` wired; 3 `DropdownMenuItem` items |
| `src/components/goal-card/checklist.tsx` | Checkbox rows + line-through + PaceChip suppressed | VERIFIED | `<Checkbox>` import + usage; `line-through` class; `suppressForChecklist` prop |
| `src/components/goal-card/habit.tsx` | HabitCard wrapping HabitGrid | VERIFIED | `<HabitGrid>` rendered with `onToggle` wired to `handlers.onHabitToggle` |
| `src/components/habit-grid.tsx` | 7x6 calendar grid + aria + roving tabindex | VERIFIED | `role="grid"`, `role="gridcell"`, `tabIndex={iso === activeIso ? 0 : -1}`, `ArrowRight` handler, `opacity-50 cursor-not-allowed` |
| `src/components/create-goal-dialog.tsx` | 2-step Dialog (type picker → per-type fields) | VERIFIED | `step` state `'picker'|'fields'`; `setStep('fields')` on type select; `Cannot be changed after creation` copy |
| `src/components/delete-goal-dialog.tsx` | AlertDialog confirmation | VERIFIED | `This removes the goal and all its progress. This can't be undone.` (HTML entity encoded) |
| `src/components/earlier-day-popover.tsx` | Popover with month grid + past-days-only gate | VERIFIED | `disabled={iso >= todayStr}` |
| `src/components/empty-state.tsx` | D-27 headline copy + 3 greyed example cards + CTA | VERIFIED | `It's {monthYearLabel}. What do you want to commit to?` (JSX entity encoded); 3 `ExampleCard` stubs |
| `src/app/globals.css` | --color-warning-* and --color-success-* tokens (light + dark) | VERIFIED | 6 tokens in light, 6 tokens in dark `@media (prefers-color-scheme: dark)` block |
| `src/app/layout.tsx` | `<Toaster />` mounted exactly once | VERIFIED | `<Toaster />` at line 19; grep confirmed only 1 occurrence in src/ |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/(protected)/dashboard/page.tsx` | `src/server/db/queries.ts` | `getMonthDashboard(` | WIRED | Import + call confirmed at lines 8 and 25 |
| `src/components/progress-bar.tsx` | `motion/react` | `import { motion, useReducedMotion }` | WIRED | Import from `motion/react` (not framer-motion); no framer-motion imports in entire src/ |
| `src/app/page.tsx` | `/dashboard` | `redirect("/dashboard")` | WIRED | Line 8 confirmed |
| `src/server/actions/goals.ts` | `src/lib/schemas/goals.ts` | `createGoalSchema.safeParse` | WIRED | `safeParse` called in all three actions |
| `src/server/actions/goals.ts` | `src/lib/time.ts` | `monthBucket` (via service) | WIRED | `monthBucket(new Date(), userTz)` in goals service |
| `src/components/create-goal-dialog.tsx` | `src/server/actions/goals.ts` | `createGoalAction(` | WIRED | Import + call in dialog's `onSubmit` |
| `src/components/goal-card/count.tsx` | `src/components/dashboard-shell.tsx` | `onIncrement` handler prop | WIRED | `handlers.onCountIncrement(goal.id, 1)` in CountCard; handler defined in DashboardShell |
| `src/components/dashboard-shell.tsx` | `src/server/actions/progress.ts` | `incrementCountAction + startTransition` | WIRED | `startTransition(async () => { ... await incrementCountAction(...) })` confirmed |
| `src/server/services/progress.ts` | `src/server/db/schema.ts` | `db.transaction INSERT progressEntries + UPDATE goals.currentCount` | WIRED | `db.transaction` with INSERT + GREATEST UPDATE confirmed |
| `src/components/goal-card/checklist.tsx` | `src/components/dashboard-shell.tsx` | `handlers.onChecklistToggle` | WIRED | `handlers.onChecklistToggle(goal.id, taskId, ...)` in ChecklistCard; `handleChecklistToggle` in DashboardShell |
| `src/components/habit-grid.tsx` | `src/components/goal-card/habit.tsx` | `onToggle` prop | WIRED | `<HabitGrid onToggle={(iso, willBeChecked) => handlers.onHabitToggle(...)} />` |
| `src/server/services/progress.ts` | `habit_check_ins` | `upsert by composite key — insert on check, delete on uncheck` | WIRED | `habitCheckInUndos`, `onConflictDoNothing()`, `tx.delete(habitCheckIns)` in service |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `dashboard/page.tsx` | `goals` | `getMonthDashboard(user.id, month)` → Postgres via Drizzle | Yes — single `db.select()` with JSON aggregation | FLOWING |
| `DashboardShell` | `goals` (optimistic) | `useOptimistic(initialGoals, dashboardReducer)` | Yes — seeded from server-fetched `initialGoals` | FLOWING |
| `CountCard` | `snap` (progress snapshot) | `computeProgress(goal, now, userTz)` | Yes — pure function with real `goal.currentCount` / `goal.targetCount` | FLOWING |
| `ChecklistCard` | `snap.percent` | `computeProgress(goal, now, userTz)` over `goal.tasks` | Yes — tasks from JSON-aggregated dashboard query | FLOWING |
| `HabitCard`/`HabitGrid` | `checkIns` | `goal.checkIns` from `array_agg` in dashboard query | Yes — ISO date strings from habit_check_ins table | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: The app requires a running Next.js dev server and Supabase connection to test behaviors. Module-level behavioral checks were run instead against the server action and schema layers.

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| Progress actions export all 5 functions | `grep` on `src/server/actions/progress.ts` | `incrementCountAction`, `backfillCountAction`, `undoLastMutationAction`, `toggleTaskAction`, `upsertHabitCheckInAction` all present | PASS |
| No framer-motion in src/ | `grep -rn "framer-motion" src/` | No output | PASS |
| Discriminated union schemas | `grep "z.discriminatedUnion" schemas/goals.ts` | 2 matches (create + update) | PASS |
| Single Toaster mount | `grep "<Toaster" src/app/layout.tsx` | Exactly 1 match | PASS |
| 146/146 vitest tests pass | Reported by context (verified with DATABASE_URL) | Reported passing | PASS (per context) |
| `npm run build` passes | Reported by summaries + context | PASSED across all 6 plans | PASS (per context) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GOAL-01 | 02-01, 02-03 | Create goal with name, type, target, optional notes, month | SATISFIED | createGoalAction + service + CreateGoalDialog confirmed. Note: `notes` field accepted by Zod schema but no DB column exists — silently dropped (code review WR-01) |
| GOAL-02 | 02-03 | Edit a goal that belongs to the current or a future month | SATISFIED | updateGoalAction + updateGoal service + CreateGoalDialog edit mode; type immutability enforced |
| GOAL-03 | 02-03 | Delete a goal with a confirmation step | SATISFIED | deleteGoalAction + DeleteGoalDialog (AlertDialog) with exact UI-SPEC copy |
| PROG-01 | 02-04 | Increment a count-based goal in one click from the dashboard | SATISFIED | CountCard +1 button → `handlers.onCountIncrement` → `incrementCountAction` with optimistic update |
| PROG-02 | 02-05 | Toggle a sub-task done/not-done on a checklist goal | SATISFIED | ChecklistCard Checkbox → `handlers.onChecklistToggle` → `toggleTaskAction` with line-through styling |
| PROG-03 | 02-06 | Mark today done for a habit goal in one tap | SATISFIED | HabitGrid today cell → `handlers.onHabitToggle` → `upsertHabitCheckInAction` |
| PROG-04 | 02-04, 02-06 | Log a missed-day check-in for any prior day within the current month | SATISFIED | Count: EarlierDayPopover → `backfillCountAction` (past-days-only gate); Habit: past HabitGrid cell → `upsertHabitCheckInAction` |
| PROG-05 | 02-04, 02-05, 02-06 | Undo the last progress action via a short-lived toast | SATISFIED | Single `id:'progress-undo'` Sonner toast, 6s duration; `undoLastMutationAction` handles count/checklist/habit branches |
| DASH-01 | 02-02 | Dashboard shows all current-month goals in a single scrollable list | SATISFIED | `/dashboard` RSC route renders `DashboardShell` with `goals.map(goal => <GoalCard>)`; `max-w-[720px]` single column layout |
| DASH-02 | 02-02 | Every goal renders a visual progress bar reflecting completion percent | SATISFIED | `ProgressBar` present in CountCard, ChecklistCard, HabitCard, and EmptyState example cards |
| POLSH-03 | 02-06 | Habit goals render a month-grid showing which specific days were hit/missed | SATISFIED | `HabitGrid` 7x6 calendar with Hit/Miss/Today/Future cell states confirmed |

All 11 requirements declared across the 6 plans are accounted for. No orphaned requirements detected.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `src/server/services/goals.ts` | `updateGoal` silently drops `notes` field — no `notes` column in `goals` table schema | Warning | Notes entered in edit dialog are accepted by Zod but never persisted; user sees no error (silent data loss). Advisory per code review WR-01. Does not block phase goal. |
| `src/server/services/progress.ts:218` | `doneAt: restore ? new Date() : null` — undo of "mark done" sets `doneAt` to the undo time, not the original mark time | Warning (Critical per review CR-01) | Corrupts audit `doneAt` timestamp on task undo. Functional undo works correctly (is_done flips back); only the timestamp is wrong. Does not block phase goal or user experience. |
| `src/components/dashboard-shell.tsx` | `Logged +${delta}` in `handleCountBackfill` toast — always shows `+` sign even for negative delta | Warning (WR-02) | Displays `+-3` instead of `−3` for negative backfill. Minor cosmetic bug; does not block functionality. |
| `src/components/earlier-day-popover.tsx` | `startOfMonth(month)` uses goal.month without TZDate wrap — off-by-one possible for UTC+ zones | Warning (WR-04) | Month boundary mismatch for users in UTC+ when goal.month stored as UTC midnight. Affects correctness but not a blocker for today's verification. |
| `src/components/create-goal-dialog.tsx` | Extensive `as any` type assertions suppress TypeScript safety | Info (IN-01) | Reduces compile-time safety for discriminated union form; future type errors may go undetected. Advisory. |
| `tests/progress-bar.shape.test.ts` | `require('child_process').execSync` for framer-motion grep — fragile in CI | Info (IN-05) | Could silently pass even if the grep fails; provides false confidence. Advisory. |

No blockers found that prevent the phase goal from being achieved. The critical issue (CR-01 `doneAt` corruption on task undo) and warning WR-01 (notes silently dropped) are both advisory follow-ups for a later plan or hotfix — neither prevents the user from achieving the three-type dashboard experience described in the phase goal.

---

### Human Verification Required

The following items cannot be verified programmatically and require a human tester with a running browser session. The UAT walkthrough (Task 6.4, 31 steps) was reportedly completed and "approved" by the developer. These items surface what cannot be re-verified from code alone:

### 1. Progress Bar Spring Animation Quality and CLS

**Test:** Log in to the dev or staging app. Navigate to `/dashboard`. Create a count goal. Click +1 rapidly 10 times while observing the progress bar. Open Chrome DevTools > Performance > Record, click +1 five times, stop recording, and inspect Layout Shifts.

**Expected:** Bar fills smoothly with spring animation (no jank); no layout shift registered (CLS = 0 for compositor-only `scaleX`). Lighthouse CLS on `/dashboard` should be < 0.1.

**Why human:** Animation quality and compositor-only rendering can only be confirmed by visual inspection in a browser. Code confirms `scaleX` + `origin-left` + `will-change: transform` which are the correct preconditions, but the actual render behavior depends on the browser compositor.

### 2. HabitGrid Keyboard Navigation (Roving Tabindex)

**Test:** Log in. Create a habit goal. On the habit card, press Tab until focus enters the HabitGrid. Use ArrowRight, ArrowLeft, ArrowDown, ArrowUp to navigate between cells. Press Enter to toggle a past cell. Press Tab to exit the grid.

**Expected:** Only one cell has `tabindex=0` at a time (roving tabindex); arrow keys move focus between past and today cells only (future cells skipped); Enter/Space toggles the focused cell; Tab moves focus out of the grid entirely.

**Why human:** Roving tabindex correctness and keyboard UX can only be confirmed interactively. The code implements the pattern correctly (`tabIndex={iso === activeIso ? 0 : -1}` + arrow key handlers), but the browser focus-management behavior requires hands-on testing.

### 3. Reduced-Motion Mode Suppresses Spring Animation

**Test:** Enable "Reduce Motion" in OS accessibility preferences (macOS: System Settings > Accessibility > Display > Reduce Motion; or Chrome DevTools > Rendering > Emulate CSS media feature prefers-reduced-motion). Reload `/dashboard`. Click +1 on a count goal.

**Expected:** Progress bar updates immediately (no spring animation). Disable Reduce Motion, reload, click +1 again — spring animation returns.

**Why human:** `useReducedMotion()` from `motion/react` responds to the `prefers-reduced-motion` CSS media feature. Code confirms the hook is called and `{ duration: 0 }` is passed on reduce = true, but the actual media query response requires OS-level configuration and visual confirmation.

---

### Gaps Summary

No gaps blocking goal achievement. All 5 observable truths are VERIFIED by code inspection. All 11 declared requirements (GOAL-01, GOAL-02, GOAL-03, PROG-01, PROG-02, PROG-03, PROG-04, PROG-05, DASH-01, DASH-02, POLSH-03) are satisfied by implemented artifacts.

The `human_needed` status is set because the three human verification items above (animation quality, keyboard navigation, reduced-motion behavior) cannot be verified programmatically, even though the automated checks, 146/146 Vitest tests, build pass, and the developer's 31-step UAT walkthrough all confirm correct behavior. The verifier cannot independently re-run the Lighthouse CLS test or the browser keyboard session.

**Follow-up items (not blockers, tracked for Phase 3 / hotfix):**

- CR-01: `doneAt` corruption on task undo — `toggleTask` captures `priorIsDone` but not `priorDoneAt`; undo sets `doneAt = new Date()` instead of restoring original. Fix: add `priorDoneAt` column or document that `doneAt` reflects most-recent mark event.
- WR-01: `notes` field accepted by Zod schema but no `goals.notes` DB column exists — silently dropped. Fix: add migration for `notes` column and include in all three `.set()` calls in `updateGoal`.
- WR-02: Backfill toast label shows `+${delta}` — wrong sign for negative deltas. Fix: use `sign + Math.abs(delta)` pattern from `handleCountIncrement`.
- WR-04: `EarlierDayPopover` passes `month` (UTC midnight Date) to `startOfMonth` without `TZDate` wrap. Fix: `new TZDate(month.getTime(), userTz)` before interval calculation.

---

_Verified: 2026-04-19_
_Verifier: Claude (gsd-verifier)_
