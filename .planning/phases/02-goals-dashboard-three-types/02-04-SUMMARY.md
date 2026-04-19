---
phase: 2
plan: 4
subsystem: count-card
tags: [progress-actions, server-actions, service-layer, optimistic-ui, sonner, undo, count-card, tdd]
dependency_graph:
  requires:
    - Phase 02-01 — Zod schemas (incrementCountSchema, backfillCountSchema, undoLastMutationSchema)
    - Phase 02-01 — DB schema (goals, progressEntries tables + RLS)
    - Phase 02-01 — shadcn primitives (popover, dropdown-menu, sonner)
    - Phase 02-02 — DashboardShell (useOptimistic hoist + discriminated reducer)
    - Phase 02-02 — ProgressBar + PaceChip components
    - Phase 02-03 — CreateGoalDialog, DeleteGoalDialog, NewGoalButton
  provides:
    - incrementCountAction / backfillCountAction / undoLastMutationAction server actions
    - incrementCount / backfillCount / undoLastMutation service functions + 4 typed error classes
    - CountCard component (+1 primary, stepper, kebab with Edit/Log-for-earlier-day/Delete)
    - EarlierDayPopover (month grid, past-days-only gate, amount stepper)
    - GoalCard variant picker (index.tsx — checklist/habit stubs ready for Plans 05/06)
    - DashboardShell: handleCountIncrement + handleCountBackfill wired with startTransition + Sonner undo toast
    - Toast contract (single id:'progress-undo', 6s, undoId handshake) — Plans 05/06 reuse verbatim
  affects:
    - Plans 02-05 (checklist card) and 02-06 (habit card) — extend GoalCard picker + DashboardShell handlers
tech_stack:
  added: []
  patterns:
    - db.transaction wrapping INSERT progressEntries + UPDATE goals.currentCount (Pitfall 3 atomicity)
    - GREATEST(0, current_count + delta) SQL clamp — prevents current_count below zero
    - undoLastMutation: JOIN goals.user_id for ownership-scoped reversal (T-02-20 mitigation)
    - startTransition(async () => { dispatch(optimistic); await serverAction() }) — Pattern 4 shape
    - Single Sonner id:'progress-undo' replaces rather than stacks (D-34)
    - crypto.randomUUID() generates undoId on every mutation — client-side, not server
    - EarlierDayPopover: disabled={iso >= todayStr} enforces past-days-only in UI; service enforces server-side
    - TDD RED/GREEN: test file committed failing before implementation (5 tests, module-not-found RED)
key_files:
  created:
    - src/server/services/progress.ts (incrementCount, backfillCount, undoLastMutation + 4 typed error classes)
    - src/server/actions/progress.ts (incrementCountAction, backfillCountAction, undoLastMutationAction)
    - src/components/goal-card/index.tsx (GoalCard variant picker — GoalCardHandlers interface)
    - src/components/goal-card/count.tsx (CountCard — +1 button, stepper, kebab, EarlierDayPopover)
    - src/components/earlier-day-popover.tsx (month grid picker + amount stepper)
    - tests/actions.progress.test.ts (5 Vitest assertions — RED committed before GREEN)
  modified:
    - src/components/dashboard-shell.tsx (handleCountIncrement + handleCountBackfill handlers + showUndoToast; replaces placeholder card renderer with GoalCard)
decisions:
  - "D-05/D-06: progressEntries row INSERT + goals.currentCount UPDATE in single db.transaction — atomicity prevents audit log + cache divergence (T-02-19)"
  - "D-33/D-34: undoLastMutation reverses by undoId scoped via goals.user_id JOIN; single Sonner id:'progress-undo' replaces (most-recent-only semantics)"
  - "D-36: EarlierDayPopover disables iso >= todayStr in UI AND service rejects loggedLocalDate >= today — dual enforcement (T-02-22, T-02-23)"
  - "D-28: Count card +1 primary button fires incrementCountAction directly; stepper uses onCountIncrement with stepperValue delta, reset to 0 after commit"
  - "D-32: Sonner toast duration 6000ms — 6-second undo window per design"
  - "D-24: Card anatomy: CardHeader (icon + title + kebab), CardContent (ProgressBar + PaceChip row, +1 + stepper row, progress text)"
  - "GoalCard index.tsx: checklist returns null (Plan 05), habit returns null (Plan 06) — exhaustive switch with never check"
  - "loadOwnedGoal helper uses typed tx parameter from db.transaction callback signature"
metrics:
  duration: "~4 min"
  completed_date: "2026-04-19T19:42:00Z"
  tasks_completed: 2
  files_changed: 6
---

# Phase 2 Plan 4: Count Card + Progress Actions Summary

**One-liner:** Atomic count server actions (increment/backfill/undo with db.transaction + GREATEST(0,...) clamp + ownership JOIN) wired to a CountCard (+1 primary, stepper, Log-for-earlier-day popover) and DashboardShell Sonner undo toast (single id:'progress-undo', 6s) — establishes the reusable toast contract for Plans 05/06.

## What Was Built

### Server Actions — `src/server/actions/progress.ts`

**Three actions following the same pattern as goals.ts:**
1. Zod `safeParse(input)` → return `{ ok: false }` on failure (never touches auth or DB)
2. `getSupabaseServerClient()` + `auth.getUser()` → return `{ ok: false, error: "Not authenticated." }` if no session
3. `resolveUserTz(userId)` → fetch timezone from public.users
4. Delegate to service function (owns DB logic + error classes)
5. `revalidatePath("/dashboard")` on success
6. Map typed service errors to fixed user-facing strings

**Signatures:**
```typescript
incrementCountAction(input: IncrementCountInput): Promise<ActionResult>
backfillCountAction(input: BackfillCountInput): Promise<ActionResult>
undoLastMutationAction(input: UndoLastMutationInput): Promise<ActionResult>
```

**Error copy map:**

| Condition | Returned error string |
|-----------|----------------------|
| Zod parse failure | `"Invalid input."` |
| No session | `"Not authenticated."` |
| GoalNotFoundError | `"Goal not found or not owned by you."` |
| OutOfMonthError | `"That date isn't in the current month."` |
| WrongGoalTypeError | `"That action isn't valid for this goal type."` |
| UndoNotFoundError | `"Nothing to undo."` |
| Generic DB error | `"Couldn't save that change. Try again."` |

### Service Layer — `src/server/services/progress.ts`

**`incrementCount(userId, userTz, input)`**
- `monthBucket(now, userTz)` → derive current month (server-derived, Pitfall 9)
- `today(now, userTz)` → derive loggedLocalDate (Pitfall 5)
- `db.transaction`: ownership+type+month assert → INSERT progressEntries → UPDATE goals via `GREATEST(0, current_count + delta)`

**`backfillCount(userId, userTz, input)`**
- Pre-check: `loggedLocalDate.slice(0,7) !== currentMonth.slice(0,7)` → throw OutOfMonthError
- Pre-check: `loggedLocalDate >= todayStr` → throw OutOfMonthError (future/today rejected)
- `db.transaction`: same ownership+type+month assert → INSERT progressEntries → UPDATE goals

**`undoLastMutation(userId, input)`**
- `db.transaction`: SELECT progressEntries JOIN goals WHERE undoId = ? AND goals.user_id = userId
- If row found: UPDATE goals `GREATEST(0, current_count - delta)` → DELETE progressEntries row
- If no row: extension point for Plans 05/06 (commented) → throw UndoNotFoundError

**4 typed error classes:**
```typescript
class GoalNotFoundError  // "Goal not found or not owned by you."
class OutOfMonthError    // "That date isn't in the current month."
class WrongGoalTypeError // "That action isn't valid for this goal type."
class UndoNotFoundError  // "Nothing to undo."
```

### GoalCard Variant Picker — `src/components/goal-card/index.tsx`

**GoalCardHandlers interface (shared by all card types):**
```typescript
export interface GoalCardHandlers {
  onCountIncrement: (goalId: string, delta: number) => void
  onCountBackfill: (goalId: string, loggedLocalDate: string, delta: number) => void
  onEdit: (goal: Goal) => void
  onDelete: (goal: Goal) => void
}
```

**Discriminator switch:** `goal.type === 'count'` → `<CountCard>`, others return null (Plans 05/06 wire).
Exhaustive `never` check in default branch catches future goal type additions at compile time.

### CountCard — `src/components/goal-card/count.tsx`

**Layout (D-24 anatomy):**
- `CardHeader`: Target icon + title + kebab `DropdownMenu` (Edit / Log for earlier day / Delete)
- `CardContent`:
  - `ProgressBar` (flex-1) + `PaceChip` row
  - `+1` primary `Button` (size="lg", h-11) + stepper (Minus/Input/Plus/Apply)
  - Progress text (`snap.raw.done of snap.raw.total`)
- `EarlierDayPopover` (portalled; opens via kebab "Log for earlier day")

**Stepper behavior:** ±1 per click, readOnly Input shows delta, Apply fires `handlers.onCountIncrement(goal.id, stepperValue)` and resets to 0.

### EarlierDayPopover — `src/components/earlier-day-popover.tsx`

**Month grid:** `eachDayOfInterval(startOfMonth(month), endOfMonth(month))` → 7-column grid.
- `disabled = iso >= todayStr` — UI enforcement of past-days-only (T-02-23)
- Selected day highlighted with `bg-primary text-primary-foreground`
- Amount stepper (min 1, no upper bound in UI)
- Log button: fires `onCommit(selectedDate!, amount)` then closes popover
- Cancel button: closes popover
- Reset on close: `useEffect` clears selectedDate + amount when `open` becomes false

### DashboardShell — `src/components/dashboard-shell.tsx`

**handleCountIncrement (useCallback):**
```
undoId = crypto.randomUUID()
startTransition(async () => {
  dispatch({ type: 'count:increment', goalId, delta })  // optimistic
  result = await incrementCountAction(...)
  if (!result.ok) { toast.error(result.error); return }
  showUndoToast(label, undoId, rollback)
})
```

**handleCountBackfill:** Same shape with `backfillCountAction` + loggedLocalDate in toast label.

**showUndoToast:**
```typescript
toast(label, {
  id: 'progress-undo',   // D-34: replaces, not stacks
  duration: 6000,        // D-32: 6 seconds
  action: {
    label: 'Undo',
    onClick: () => startTransition(async () => {
      optimisticRollback()
      await undoLastMutationAction({ undoId })
    })
  }
})
```

**GoalCard wiring:** Shell now renders `<GoalCard key={goal.id} goal={goal} now={now} userTz={userTz} handlers={handlers} />` — replaces prior placeholder Card+ProgressBar renderer.

## Toast Contract (Plans 05/06 reuse verbatim)

| Property | Value | Reference |
|----------|-------|-----------|
| Sonner `id` | `'progress-undo'` | D-34: single slot, most-recent-only |
| `duration` | `6000` | D-32: 6-second undo window |
| `action.label` | `'Undo'` | UI-SPEC §Undo Toast |
| `action.onClick` | `startTransition(async () => { rollback(); await undoLastMutationAction({ undoId }) })` | Pattern 4 |
| undoId source | `crypto.randomUUID()` (client-side, before startTransition) | D-33 |

Plans 05 and 06 add `onChecklistToggle` / `onHabitToggle` to `GoalCardHandlers` and call `showUndoToast` with the same contract. The `undoLastMutation` service extension points are marked with comments in `services/progress.ts`.

## Dashboard Handler Extension Points for Plans 05/06

**Plan 05 adds to `GoalCardHandlers`:**
```typescript
onChecklistToggle: (goalId: string, taskId: string, isDone: boolean) => void
```
And adds `handleChecklistToggle` in DashboardShell dispatching `{ type: 'checklist:toggle', ... }`.

**Plan 06 adds to `GoalCardHandlers`:**
```typescript
onHabitToggle: (goalId: string, localDate: string, isChecked: boolean) => void
```
And adds `handleHabitToggle` in DashboardShell dispatching `{ type: 'habit:toggle', ... }`.

The `undoLastMutation` service in `progress.ts` has commented extension points for Plans 05/06 to add task/habit undoId lookup branches.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test file committed failing) | 3b0d8db | PASSED — 5 tests failed (Cannot find module) |
| GREEN (implementation commits) | 8d9b0fc | PASSED — all 5 tests pass |
| REFACTOR | N/A | Not needed |

## Deviations from Plan

None — plan executed exactly as written. The `loadOwnedGoal` helper's `tx` parameter type was inferred from `db.transaction` callback to satisfy TypeScript (minor implementation detail, not a plan deviation).

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `case 'checklist': return null` | `goal-card/index.tsx:22` | Plan 05 wires ChecklistCard |
| `case 'habit': return null` | `goal-card/index.tsx:25` | Plan 06 wires HabitCard |
| Extension point comment | `services/progress.ts:90-92` | Plans 05/06 add task/habit undoId lookup branches to undoLastMutation |

The checklist/habit nulls do not prevent Plan 04's goal — count cards render fully; the variant picker simply passes through for types not yet wired.

## Threat Flags

None. All STRIDE threat mitigations from the plan's threat model were implemented:
- T-02-19: `db.transaction` wraps INSERT + UPDATE (atomicity, Pitfall 3)
- T-02-20: `undoLastMutation` JOIN predicate includes `goals.user_id = userId` (cross-user undo prevention)
- T-02-21: `GREATEST(0, current_count + delta)` SQL clamp (T-02-21); DB CHECK is defense-in-depth
- T-02-22: `loggedLocalDate < today && month matches` enforced in service before transaction
- T-02-23: UI disabled gate `iso >= todayStr` + service-level check (dual enforcement)
- T-02-24: Single Sonner `id:'progress-undo'` replaces (D-34)
- T-02-25: `progress_entries` has `logged_at timestamptz + undoId + logged_local_date` audit trail

## Green Gate Verification

| Check | Result |
|-------|--------|
| `npx vitest run tests/actions.progress.test.ts` | PASSED (5/5) |
| `npx vitest run` (all non-DB tests) | PASSED (114/114) |
| `npx tsc --noEmit` | PASSED |
| `npm run build` | PASSED (12 routes, /dashboard dynamic) |
| `grep -c "db.transaction" services/progress.ts` | 4 (≥3 required) |
| `grep -n "GREATEST(0," services/progress.ts` | 3 occurrences (≥2 required) |
| `grep -n "revalidatePath" actions/progress.ts` | 3 (all 3 actions) |
| `grep -c "safeParse" actions/progress.ts` | 3 (all 3 actions) |
| `grep -n "id: 'progress-undo'" dashboard-shell.tsx` | 1 match |
| `grep -n "duration: 6000" dashboard-shell.tsx` | 1 match |
| `grep -n "crypto.randomUUID()" dashboard-shell.tsx` | 2 (increment + backfill) |

## Self-Check: PASSED
