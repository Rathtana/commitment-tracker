---
phase: 2
plan: 3
subsystem: goal-crud
tags: [server-actions, service-layer, dialogs, forms, zod, ownership, tdd]
dependency_graph:
  requires:
    - Phase 02-01 — Zod discriminated-union schemas (createGoalSchema, updateGoalSchema, deleteGoalSchema)
    - Phase 02-01 — DB schema (goals, tasks tables + RLS)
    - Phase 02-01 — shadcn primitives (dialog, alert-dialog, dropdown-menu)
    - Phase 02-02 — DashboardShell, EmptyState, dashboard/page.tsx stubs
    - Phase 01 — getSupabaseServerClient, monthBucket
  provides:
    - createGoalAction / updateGoalAction / deleteGoalAction server actions
    - createGoal / updateGoal / deleteGoal service functions + GoalNotFoundError / GoalTypeImmutableError
    - CreateGoalDialog (2-step: GoalTypePicker → per-type fields; reused for edit)
    - DeleteGoalDialog (AlertDialog with exact UI-SPEC copy)
    - GoalTypePicker (3 type cards — Count / Checklist / Habit)
    - NewGoalButton (client component exporting dialog trigger)
    - Dashboard header "New goal" button wired
    - EmptyState "Add your first goal" CTA wired
    - Kebab DropdownMenu on placeholder cards (Edit / Delete items)
  affects:
    - Waves 3-5 (CountCard, ChecklistCard, HabitCard) — can now create goals to test against
    - Plan 02-04/05/06 — progress actions inherit the ActionResult<T> pattern
tech_stack:
  added: []
  patterns:
    - ActionResult<T> discriminated union ({ ok: true; data: T } | { ok: false; error: string })
    - Thin service layer (services/goals.ts) — DB mutations extracted from actions for testability
    - db.transaction wrapping multi-write operations (goal INSERT + tasks INSERT for checklist)
    - Zod safeParse first, then auth.getUser() — never touch DB on invalid input
    - useFieldArray (react-hook-form) for dynamic checklist task inputs
    - Two-step Dialog pattern: step state ('picker' | 'fields') + chosenType state
    - NewGoalButton as isolated client island — keeps dashboard/page.tsx a pure RSC
key_files:
  created:
    - src/server/services/goals.ts (createGoal, updateGoal, deleteGoal + typed error classes)
    - src/server/actions/goals.ts (createGoalAction, updateGoalAction, deleteGoalAction)
    - src/components/goal-type-picker.tsx (3 type selection cards)
    - src/components/create-goal-dialog.tsx (2-step Dialog; handles create + edit modes)
    - src/components/delete-goal-dialog.tsx (AlertDialog with destructive confirm)
    - tests/actions.goals.test.ts (6 Vitest assertions — RED committed before GREEN)
  modified:
    - src/components/dashboard-shell.tsx (added NewGoalButton export, kebab DropdownMenu,
      CreateGoalDialog + DeleteGoalDialog mounts, daysInMonthDefault prop)
    - src/app/(protected)/dashboard/page.tsx (NewGoalButton in header + EmptyState slot,
      getDaysInMonth computed server-side, removed disabled Button placeholder)
decisions:
  - "D-15 (shadcn Dialog + AnimatePresence): standard shadcn Dialog used; no AnimatePresence added — step transition is a simple conditional render; can add motion later without breaking changes"
  - "D-16 (2-step flow): step state ('picker'|'fields') + chosenType state; picker click sets both and advances; Back button sets step back to 'picker' only on create mode"
  - "D-17 (server-derived month): monthBucket(new Date(), userTz) in createGoal service — month NOT in Zod input schemas (T-02-14 mitigated)"
  - "D-18 (type immutable on update): updateGoal service compares existing[0].type !== input.type and throws GoalTypeImmutableError; action maps to fixed string (T-02-13 mitigated)"
  - "D-19 (delete via AlertDialog): DeleteGoalDialog uses shadcn AlertDialog; AlertDialogAction preventDefault + manual async handler for loading state"
  - "D-06 (transaction): checklist create wraps goal INSERT + tasks INSERT in db.transaction; update wraps goal UPDATE + tasks delete/re-insert"
  - "ActionResult<T> shape: { ok: true; data: T } | { ok: false; error: string } — generic over T to allow createGoalAction returning { id: string } while delete/update return void"
  - "NewGoalButton as client island: keeps dashboard/page.tsx a pure RSC; dialog portal-mounts outside card tree"
  - "daysInMonthDefault: computed server-side via date-fns getDaysInMonth; passed as prop to NewGoalButton and DashboardShell"
metrics:
  duration: "~4 min"
  completed_date: "2026-04-19T19:31:52Z"
  tasks_completed: 2
  files_changed: 8
---

# Phase 2 Plan 3: Goal CRUD Summary

**One-liner:** Zod-validated server actions (create/update/delete) with ownership assertion + db.transaction + typed service errors, wired to a 2-step shadcn Dialog (GoalTypePicker → per-type fields) and AlertDialog delete confirm — dashboard header and empty-state CTA now open the create dialog.

## What Was Built

### Server Actions — `src/server/actions/goals.ts`

**Three actions, all following the same pattern:**
1. `createGoalSchema.safeParse(input)` → return `{ ok: false }` on failure (never touches DB)
2. `getSupabaseServerClient()` + `auth.getUser()` → return `{ ok: false, error: "Not authenticated." }` if no session
3. Delegate to service function (owns DB logic)
4. `revalidatePath("/dashboard")` on success
5. Map typed service errors to fixed user-facing strings

**Signatures:**
```typescript
createGoalAction(input: CreateGoalInput): Promise<ActionResult<{ id: string }>>
updateGoalAction(input: UpdateGoalInput): Promise<ActionResult>
deleteGoalAction(input: DeleteGoalInput): Promise<ActionResult>
```

**ActionResult shape:**
```typescript
type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }
```

**Error copy map:**

| Condition | Returned error string |
|-----------|----------------------|
| Zod parse failure | `"Invalid input. Please check the form."` |
| No session | `"Not authenticated."` |
| GoalNotFoundError | `"Goal not found or not owned by you."` |
| GoalTypeImmutableError | `"A goal's type cannot be changed after creation."` |
| Generic DB error | `"Couldn't save that change. Try again."` |

### Service Layer — `src/server/services/goals.ts`

**`createGoal(userId, userTz, input)`**
- `monthBucket(new Date(), userTz)` — server-derived month (D-17, T-02-14)
- `db.transaction` wraps goal INSERT + tasks INSERT for checklist type (D-06, T-02-18)
- Per-type DB column mapping:
  - `count`: `targetCount` + `currentCount: 0`
  - `habit`: `targetDays`
  - `checklist`: no count columns; tasks rows inserted in same transaction

**`updateGoal(userId, input)`**
- Ownership SELECT before mutation: `WHERE id = input.goalId AND userId = userId` (T-02-15)
- `existing[0].type !== input.type` → throws `GoalTypeImmutableError` (D-18, T-02-13)
- Checklist update: naive delete+re-insert of tasks within transaction (Plan 05 may refine)

**`deleteGoal(userId, goalId)`**
- `WHERE id = goalId AND userId = userId` — 0 rows returned → throws `GoalNotFoundError`
- ON DELETE CASCADE in DB schema wipes child rows (tasks, habit_check_ins, progress_entries)

**Typed error classes:**
```typescript
class GoalNotFoundError extends Error   // "Goal not found or not owned by you."
class GoalTypeImmutableError extends Error  // "A goal's type cannot be changed after creation."
```

### CreateGoalDialog — `src/components/create-goal-dialog.tsx`

**Step flow:**

| Condition | Step shown |
|-----------|-----------|
| Creating new goal, dialog just opened | `'picker'` — GoalTypePicker with 3 cards |
| User clicks type card | `'fields'` — per-type form |
| User clicks "← Back" | `'picker'` — returns to type selection |
| Editing existing goal | `'fields'` immediately (Step 1 skipped) |

**Edit mode detection:** `Boolean(editing)` prop — when truthy:
- Step 1 is skipped entirely
- Dialog title: `Edit {goal.title}`
- Type shown read-only in `DialogDescription`: `Type: {type} · Cannot be changed after creation`
- Submit button: `Save changes`
- Calls `updateGoalAction` instead of `createGoalAction`

**Per-type fields:**
- `count`: title + targetCount (number input, min=1) + notes
- `habit`: title + targetDays (number input, min=1, max=31) + notes
- `checklist`: title + dynamic task list (useFieldArray, min 1 task, add/remove buttons) + notes

### GoalTypePicker — `src/components/goal-type-picker.tsx`

Three `<button>` cards (type="button", not submit):

| Type | Icon | Heading | Body copy |
|------|------|---------|-----------|
| count | Target | Count | Track a number you want to hit — "read 5 books" or "run 40 miles". |
| checklist | ListChecks | Checklist | Check off a set of finite tasks — "renovate the spare room" or "launch v1". |
| habit | Flame | Habit | Mark days you showed up — "meditate daily" or "write 20 of 30 days". |

### DeleteGoalDialog — `src/components/delete-goal-dialog.tsx`

- `AlertDialog` with exact UI-SPEC copy: `"This removes the goal and all its progress. This can't be undone."`
- Confirm button: `variant='destructive'`, loading state shows `"Deleting…"`
- Error shown inline above footer if action fails (no toast — dialog stays open)
- `onDeleted()` callback fires after successful deletion

### Dashboard Wiring

**`NewGoalButton` (exported from `dashboard-shell.tsx`):**
```typescript
export function NewGoalButton({ daysInMonthDefault, className }: NewGoalButtonProps)
```
Renders a `<Button>` that opens `<CreateGoalDialog>` portal-style. Used in 2 places:
1. Dashboard header (when `goals.length > 0`)
2. `EmptyState` `createButtonSlot` prop (when `goals.length === 0`)

**Kebab menu on placeholder cards (in `DashboardShell`):**
- `DropdownMenu` with `Edit` and `Delete` items
- Edit: sets `editingGoal` state + opens `createOpen` dialog
- Delete: sets `deletingGoal` state → `<DeleteGoalDialog>` appears
- Waves 3-5 will replace the placeholder card with typed card components

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `handleCountIncrement` no-op | `dashboard-shell.tsx` | Plan 02-04 wires `incrementCountAction` + `startTransition` + Sonner toast (unchanged from Plan 02-02) |
| Placeholder card renderer | `dashboard-shell.tsx` | Waves 3-5 replace with `<CountCard>`, `<ChecklistCard>`, `<HabitCard>` |

These stubs do not prevent the plan's goal — the create/edit/delete dialogs are fully functional.

## Threat Flags

None. All threat mitigations from the plan's threat model implemented:
- T-02-13: `existing[0].type !== input.type` throws `GoalTypeImmutableError` in service
- T-02-14: month derived server-side via `monthBucket(new Date(), userTz)` — no month field in Zod schemas
- T-02-15: `deleteGoal` uses `WHERE id = ? AND userId = ?`; 0 rows → `GoalNotFoundError`; RLS is defense-in-depth
- T-02-16: raw DB errors mapped to `"Couldn't save that change. Try again."` — no internals leaked
- T-02-17: `safeParse` returns false on unknown discriminator — test cases lock this
- T-02-18: `db.transaction` wraps goal + tasks inserts; rollback on failure

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test commit before implementation) | 8f2972d | PASSED — `tests/actions.goals.test.ts` committed; all 6 tests failed (module not found) |
| GREEN (implementation commit after RED) | c74d420 | PASSED — `src/server/actions/goals.ts` + `src/server/services/goals.ts` committed; all 6 tests pass |
| REFACTOR | N/A | Not needed |

## Self-Check: PASSED

Files confirmed to exist:
- src/server/actions/goals.ts
- src/server/services/goals.ts
- src/components/goal-type-picker.tsx
- src/components/create-goal-dialog.tsx
- src/components/delete-goal-dialog.tsx
- tests/actions.goals.test.ts
- src/components/dashboard-shell.tsx (modified)
- src/app/(protected)/dashboard/page.tsx (modified)

Commits confirmed:
- 8f2972d test(02-03): add failing tests for goal CRUD server actions (RED)
- c74d420 feat(02-03): goal CRUD server actions + service layer (GREEN)
- 7067888 feat(02-03): CreateGoalDialog, DeleteGoalDialog, NewGoalButton + wire triggers

Build: PASSED (12 routes, /dashboard dynamic, no TypeScript errors)
Vitest: 109 tests passing (rls.test.ts skipped — requires DATABASE_URL)
