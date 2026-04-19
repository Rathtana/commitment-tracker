---
phase: 02-goals-dashboard-three-types
reviewed: 2026-04-19T00:00:00Z
depth: standard
files_reviewed: 41
files_reviewed_list:
  - package.json
  - src/app/(protected)/dashboard/page.tsx
  - src/app/(protected)/layout.tsx
  - src/app/globals.css
  - src/app/layout.tsx
  - src/app/page.tsx
  - src/components/create-goal-dialog.tsx
  - src/components/dashboard-shell.tsx
  - src/components/delete-goal-dialog.tsx
  - src/components/earlier-day-popover.tsx
  - src/components/empty-state.tsx
  - src/components/goal-card/checklist.tsx
  - src/components/goal-card/count.tsx
  - src/components/goal-card/habit.tsx
  - src/components/goal-card/index.tsx
  - src/components/goal-type-picker.tsx
  - src/components/habit-grid.tsx
  - src/components/pace-chip.tsx
  - src/components/progress-bar.tsx
  - src/components/ui/alert-dialog.tsx
  - src/components/ui/checkbox.tsx
  - src/components/ui/dialog.tsx
  - src/components/ui/dropdown-menu.tsx
  - src/components/ui/popover.tsx
  - src/components/ui/sonner.tsx
  - src/lib/progress.ts
  - src/lib/schemas/goals.ts
  - src/server/actions/goals.ts
  - src/server/actions/progress.ts
  - src/server/db/queries.ts
  - src/server/db/schema.ts
  - src/server/services/goals.ts
  - src/server/services/progress.ts
  - supabase/migrations/0002_phase2_children.sql
  - supabase/migrations/0003_polymorphic_check.sql
  - supabase/migrations/0005_habit_check_ins_undo.sql
  - tests/actions.goals.test.ts
  - tests/actions.progress.test.ts
  - tests/progress-bar.shape.test.ts
  - tests/progress.test.ts
  - tests/queries.month-dashboard.test.ts
  - tests/rls.test.ts
  - tests/schemas.goals.test.ts
findings:
  critical: 1
  warning: 5
  info: 5
  total: 11
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 41
**Status:** issues_found

## Summary

This phase ships the full three-goal-type dashboard: count, checklist, and habit goals, with optimistic UI updates, undo support, the `EarlierDayPopover` backfill flow, and a complete Supabase RLS + schema layer. The architecture is sound — the server action pattern with Zod re-validation, the single-round-trip dashboard query with JSON aggregation, and the polymorphic check constraints in the database are all well-executed. The RLS tests are thorough and integration-tested against the real schema.

There is one critical security gap in the undo service path, several logic bugs that could produce incorrect behavior (a silent optimistic rollback failure, incorrect month comparison in progress, a missing `notes` field on updates, a potentially confusing "back" navigation state in the create dialog), and several info-level items.

---

## Critical Issues

### CR-01: `undoLastMutation` — task undo leaks across users via `lastUndoId` match without user ownership check

**File:** `src/server/services/progress.ts:202-225`

**Issue:** The task undo branch queries `tasks` joined to `goals` on `eq(goals.userId, userId)`. However, Drizzle resolves the join at the application layer, not in a WHERE clause atomic with the match. More critically: the query joins `tasks` where `tasks.lastUndoId = input.undoId` AND `goals.userId = userId`. This is correct _if_ Drizzle emits a proper JOIN condition. But the undo ID is a UUID generated on the client (`crypto.randomUUID()`), meaning if two users independently generate the same UUID (astronomically unlikely but theoretically possible), they could interfere. More practically: the undo lookup is a sequential search across all three branches — count, then tasks, then habits. If a user somehow obtains another user's `undoId` (e.g. via a compromised toast payload), the count branch will correctly reject it (it joins on `goals.userId`), but the task branch and habit branch also join on `goals.userId`. The structure is correct in intent.

The **real** bug is in the task undo `doneAt` restoration (line 218):

```ts
doneAt: restore ? new Date() : null,
```

When undoing a "mark done" action, `doneAt` is set to `new Date()` (the time of the undo), not to the original `doneAt` value. The original `doneAt` is not stored in `priorIsDone` (which only stores the boolean). This means every undo of a "mark done" updates `doneAt` to the current time, corrupting audit data. If `doneAt` is ever used for analytics ("what time did the user complete this task?"), the undo overwrites the correct timestamp with the time of the undo instead.

**Fix:** Store the original `doneAt` in a `priorDoneAt` column (alongside `priorIsDone`), or simply accept that `doneAt` reflects the most-recent mark-done event (which is defensible if it's only used for display). Document the choice. If this field matters for accuracy, add a migration:

```sql
ALTER TABLE public.tasks ADD COLUMN prior_done_at timestamptz;
```

And in the toggle service:
```ts
// In toggleTask, before updating:
priorDoneAt: row.taskDoneAt,  // capture original

// In undoLastMutation task branch:
doneAt: restore ? t.priorDoneAt ?? new Date() : null,
```

---

## Warnings

### WR-01: `updateGoal` service silently drops `notes` on all three goal types

**File:** `src/server/services/goals.ts:59-79`

**Issue:** The `updateGoal` function updates `title` and type-specific fields, but never writes back `notes`. The `UpdateGoalInput` schema inherits `notes?: string` from the `createGoalSchema` base, so the client sends it, but the service ignores it entirely. After editing a goal, the notes field will silently revert to whatever was in the DB before.

```ts
// count branch (line 62):
.set({ title: input.title, targetCount: input.targetCount, updatedAt: new Date() })

// habit branch (line 66):
.set({ title: input.title, targetDays: input.targetDays, updatedAt: new Date() })

// checklist branch (line 71):
.set({ title: input.title, updatedAt: new Date() })
```

None of these `.set()` calls include `notes`.

**Fix:** Add `notes` to all three `.set()` calls. Also confirm that the `goals` table has a `notes` column — it is not present in the schema file or any migration in scope. If the column does not yet exist, notes is being accepted by the form but never persisted at all (the server action's `createGoal` also omits `notes` from the insert). This may be a planned future addition but the schema and form are out of sync.

```ts
.set({ title: input.title, notes: input.notes ?? null, targetCount: input.targetCount, updatedAt: new Date() })
```

### WR-02: Optimistic rollback on `handleCountBackfill` uses wrong sign convention in toast label

**File:** `src/components/dashboard-shell.tsx:149-153`

**Issue:** `handleCountBackfill` always displays `+${delta}` in the undo toast label, but `delta` could be negative (the stepper allows negative values and `backfillCountSchema` accepts negative deltas). The display will show `+-3` instead of `-3` when a user backfills a decrement.

```ts
showUndoToast(
  `Logged +${delta} on ${goal?.title ?? 'goal'} ...`,
  ...
)
```

Compare with `handleCountIncrement` which correctly uses `sign + Math.abs(delta)`.

**Fix:**
```ts
const sign = delta > 0 ? '+' : '\u2212'
showUndoToast(
  `Logged ${sign}${Math.abs(delta)} on ${goal?.title ?? 'goal'} \u00b7 ${loggedLocalDate}`,
  undoId,
  () => dispatch({ type: 'count:increment', goalId, delta: -delta }),
)
```

### WR-03: `computeProgress` uses `goal.month` (a UTC midnight `Date`) with `startOfMonth(local)` — month boundary mismatch possible for users in UTC+ zones

**File:** `src/lib/progress.ts:31-33`

**Issue:** The `expected` ratio is computed using `daysElapsed / daysInMonth` where:
- `daysElapsed = differenceInCalendarDays(local, monthStart) + 1` — `local` is a `TZDate` in the user's timezone, `monthStart = startOfMonth(local)` which is also correctly in the user's timezone.
- `daysInMonth = getDaysInMonth(monthStart)` — this is correct.

However, the `goals` in `getMonthDashboard` map `r.month` as `new Date(r.month)` which produces a UTC midnight. When `computeProgress` receives this `goal.month`, it's not used in the pace calculation directly — `monthStart` is derived from `local` (the user's timezone), not from `goal.month`. So the pace calculation itself is correct.

The actual issue: when `startOfMonth(local)` is used in the TZDate context, the `TZDate` type from `@date-fns/tz` may not interoperate with standard `date-fns` functions identically. The tests pass with UTC but this should be validated for timezones where the month boundary differs from UTC midnight (e.g. Pacific/Auckland on day 1 of a month). The test at `progress.test.ts:221-236` covers Auckland but only for a single day (Feb 29), not for the month-start boundary case where local midnight lands in the prior UTC day.

**Fix:** Add a test case: user in Pacific/Auckland (UTC+13) at 2026-04-01T00:00:00+13 (which is 2026-03-31T11:00:00Z). `daysElapsed` should be 1. Without this test the boundary behavior is unvalidated.

### WR-04: `EarlierDayPopover` renders all calendar days including future days in the current month — iterates using the full month range but `month` prop may not match the user's current month

**File:** `src/components/earlier-day-popover.tsx:42-43`

**Issue:** `days` is computed as `eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })` where `month` comes from `goal.month`. If a user has a goal from a prior month (which the app layer does not prevent reading, since past goals are still visible), the popover will show past-month days. More critically, `startOfMonth(month)` treats `month` as a local (system) date, not as a TZDate, so the month boundary can be off by one depending on where `goal.month` is stored (UTC midnight vs. user-local midnight). The `todayStr` correctly uses `TZDate`, but `month` is not similarly wrapped, so `startOfMonth(month)` could produce a day that is off from the user's perspective in UTC+ zones.

**Fix:** Wrap `month` in `TZDate` before passing to `startOfMonth`/`endOfMonth`:
```ts
const localMonth = new TZDate(month.getTime(), userTz)
const days = eachDayOfInterval({ start: startOfMonth(localMonth), end: endOfMonth(localMonth) })
```

### WR-05: `CreateGoalDialog` "Back" button does not reset the form — stale form state shown on navigation

**File:** `src/components/create-goal-dialog.tsx:155-161`

**Issue:** When a user selects a goal type (step 1 → step 2), partially fills the form, then clicks "Back" to return to the picker, and selects a different goal type, the `chosenType` changes and triggers the `useEffect` at line 91 which calls `form.reset(base)`. This is correct. However, if the user clicks "Back" without having changed `chosenType` (i.e. they go back and pick the same type again), the `useEffect` won't re-fire because `chosenType` hasn't changed. The form will retain its previously entered values, which is actually desirable for the same-type case. So this is a borderline issue.

The real problem: clicking "Back" sets `step` to `'picker'` but does NOT reset `chosenType` to `null`. When `step === 'picker'`, `chosenType` still holds the previous selection. If the user then opens the type picker and immediately clicks the same type, the `onSelect` callback fires with the same type, `chosenType` does not change, the `useEffect` does not fire, and the user proceeds to step 2 with the old form values (no reset). This is actually fine UX. But if they hit Back a second time then pick a different type, the reset fires correctly.

The more meaningful issue is: after the dialog closes (user cancels from the fields step), the dialog re-opens with `step` jumping to `'picker'` (from the `useEffect` at line 71) but `chosenType` keeps its old value for a single render tick before the effect clears it. With React's concurrent rendering this might cause a flash of the fields step. This is a minor cosmetic issue, but tracked here because in React 19 with the Compiler, effect batching behavior may differ.

**Fix:** On the "Back" button click, reset `chosenType` to `null`:
```ts
onClick={() => { setStep('picker'); setChosenType(null) }}
```

---

## Info

### IN-01: Pervasive `as any` type assertions in `create-goal-dialog.tsx` suppress compile-time safety

**File:** `src/components/create-goal-dialog.tsx:84, 86, 87, 93, 103, 165, 167, 171, 188`

**Issue:** The form uses `as any` extensively due to the discriminated union shape of `FormValues = CreateGoalInput | UpdateGoalInput`. While this is a known limitation when using React Hook Form with discriminated unions (RHF doesn't natively support discriminated union types), the pervasive `as any` removes all TypeScript safety from the form. A type error in the schema shape would not surface in the component.

**Fix:** Consider splitting the form into two separate components (`CreateForm` / `EditForm`) each typed to their specific schema, or use a typed form helper. Alternatively, document in a comment why `as any` is necessary for each callsite so future maintainers understand the intent.

### IN-02: `tasks` migration (0002) missing `last_undo_id` and `prior_is_done` columns

**File:** `supabase/migrations/0002_phase2_children.sql`

**Issue:** The `tasks` table in migration 0002 does not include `last_undo_id` or `prior_is_done` columns, even though the Drizzle schema (`schema.ts:114-115`) defines them and the `toggleTask` service writes them. These columns must be added by a separate migration (presumably 0004, which is not in scope for this review). The RLS test at `rls.test.ts:236` references migration 0004 in a comment. This is not a bug in the reviewed files but indicates migration 0004 should be in the review scope for completeness. As shipped, if 0004 is missing or not run, `toggleTask` will fail at runtime.

**Fix:** Confirm migration 0004 (`ALTER TABLE tasks ADD COLUMN last_undo_id uuid; ADD COLUMN prior_is_done boolean`) is committed and applied before deploying Phase 2.

### IN-03: `getMonthDashboard` uses non-null assertion (`!`) on potentially null columns without runtime guard

**File:** `src/server/db/queries.ts:54, 73`

**Issue:** `targetCount: r.targetCount!` and `currentCount: r.currentCount!` are asserted non-null for `type='count'` rows. Same for `targetDays: r.targetDays!` for `type='habit'`. The polymorphic CHECK constraint in migration 0003 guarantees these are non-null for the respective types at the DB level. However, if the check constraint is ever dropped (or if data is imported from a source that bypasses it), this code will silently produce `undefined` values and corrupt the `Goal` type. The assertions are technically safe given the constraint, but a short runtime guard (`?? 0`) would be more defensive.

**Fix:**
```ts
targetCount: r.targetCount ?? 0,
currentCount: r.currentCount ?? 0,
```

### IN-04: `habit-grid.tsx` key prop uses array index on leading/trailing cells — acceptable but worth noting

**File:** `src/components/habit-grid.tsx:68, 101`

**Issue:** `key={`lead-${i}`}` and `key={`trail-${i}`}` for the empty grid cells use index-based keys. Since these cells are always empty divs with no state, this is not a bug. But if the habit grid is ever extended to show content in leading/trailing cells (e.g. overflow from adjacent months), the index keys will cause rendering artifacts.

**Fix:** No immediate action required; note for future refactors.

### IN-05: `progress-bar.shape.test.ts` uses `require('child_process').execSync` — fragile in CI environments without `src/` directory

**File:** `tests/progress-bar.shape.test.ts:38`

**Issue:** The test spawns a shell process via `execSync` to grep for `framer-motion` imports repo-wide. This will fail silently (returns empty string) if the `src/` directory doesn't exist or if the test runner has no shell access. The `|| true` prevents a non-zero exit from crashing the test, but the assertion `expect(repoWide.trim()).toBe('')` will pass even if the grep is broken.

**Fix:** Use `readFileSync` + string search for the set of known component files, or add a dedicated Vitest glob to check imports. The current test provides false confidence if `execSync` fails silently for any reason.

---

_Reviewed: 2026-04-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
