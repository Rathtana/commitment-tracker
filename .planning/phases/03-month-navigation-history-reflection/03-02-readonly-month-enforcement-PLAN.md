---
phase: 03-month-navigation-history-reflection
plan: 2
type: execute
wave: 1
depends_on: [1]
files_modified:
  - src/server/services/progress.ts
  - src/server/services/goals.ts
  - src/server/actions/progress.ts
  - src/server/actions/goals.ts
  - tests/actions.progress.test.ts
  - tests/actions.goals.test.ts
  - tests/readonly-month-enforcement.test.ts
autonomous: true
requirements: [MNAV-02, GOAL-05]
tags: [service, security, refactor]

must_haves:
  truths:
    - "A past-month PATCH via updateGoal service throws ReadOnlyMonthError — verified by direct service-layer test (no UI)"
    - "A past-month DELETE via deleteGoal service throws ReadOnlyMonthError"
    - "A past-month incrementCount / backfillCount / toggleTask / upsertHabitCheckIn / undoLastMutation throws ReadOnlyMonthError"
    - "Future-month updateGoal and deleteGoal SUCCEED (D-09 — future goals are fully mutable)"
    - "Future-month progress logging (incrementCount, toggleTask, upsertHabitCheckIn) continues to throw ReadOnlyMonthError (D-11 — progress is current-month only)"
    - "Action-result shape on read-only failure: `{ ok: false, error: 'This month is archived.' }` (UI-SPEC locked copy)"
    - "Repo-wide grep for `OutOfMonthError` returns zero matches after rename (Pitfall 9)"
  artifacts:
    - path: "src/server/services/progress.ts"
      provides: "Rename OutOfMonthError → ReadOnlyMonthError; message = 'This month is archived.'"
      contains: "export class ReadOnlyMonthError"
    - path: "src/server/services/goals.ts"
      provides: "updateGoal + deleteGoal take userTz param and throw ReadOnlyMonthError on past-month writes (future allowed per D-09)"
      contains: "throw new ReadOnlyMonthError"
    - path: "src/server/actions/progress.ts"
      provides: "ReadOnlyMonthError import + error mapping returns 'This month is archived.'"
      contains: "ReadOnlyMonthError"
    - path: "src/server/actions/goals.ts"
      provides: "updateGoalAction + deleteGoalAction pass userTz to service; map ReadOnlyMonthError → error copy"
      contains: "ReadOnlyMonthError"
    - path: "tests/readonly-month-enforcement.test.ts"
      provides: "Service-layer smoke suite: past-month writes throw; future-month goal CRUD succeeds; future-month progress throws"
      contains: "describe('ReadOnlyMonthError"
  key_links:
    - from: "src/server/services/goals.ts"
      to: "src/lib/time.ts"
      via: "import { monthBucket }"
      pattern: "from ['\\\"]\\@/lib/time['\\\"]"
    - from: "src/server/actions/goals.ts"
      to: "src/server/services/goals.ts"
      via: "ReadOnlyMonthError class import + instanceof check"
      pattern: "instanceof ReadOnlyMonthError"
    - from: "src/server/actions/progress.ts"
      to: "src/server/services/progress.ts"
      via: "ReadOnlyMonthError class import + error mapping"
      pattern: "ReadOnlyMonthError"
---

<objective>
Generalize Phase 2's `OutOfMonthError` into the broader `ReadOnlyMonthError` that layers read-only defense at the service level for ALL goal + progress writes, while honoring D-09 (future-month goal CRUD is allowed) and D-11 (future-month progress logging is blocked).

Purpose: This is the CORE enforcement task for MNAV-02. A curl, a replayed PATCH, or a stale-tab race MUST not succeed against a past-month goal. PITFALLS §Debt line 181 + §line 259: "enforce on the API not just the button state; test by sending a PATCH to a past-month goal; must 403." The UI work in Plans 04/05 hides the kebab but is UX, not security.
Output: Renamed error class with UI-SPEC copy, extended `updateGoal`/`deleteGoal` guards, action-layer error mapping, and a dedicated service-level test file that bypasses UI to assert the 403 contract.
</objective>

<execution_context>
@/Users/rathtana.duong/gsd-tutorial/.claude/get-shit-done/workflows/execute-plan.md
@/Users/rathtana.duong/gsd-tutorial/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/03-month-navigation-history-reflection/03-CONTEXT.md
@.planning/phases/03-month-navigation-history-reflection/03-RESEARCH.md
@.planning/phases/03-month-navigation-history-reflection/03-PATTERNS.md
@.planning/phases/03-month-navigation-history-reflection/03-UI-SPEC.md
@CLAUDE.md

<interfaces>
<!-- Current Phase 2 state that this plan refactors -->

From src/server/services/progress.ts:
```typescript
export class OutOfMonthError extends Error {
  constructor() { super("That date isn't in the current month.") }
}
// 5+ throw sites across incrementCount, backfillCount, toggleTask, upsertHabitCheckIn, undoLastMutation
// Condition is always: if (g.month !== currentMonth) throw new OutOfMonthError()
```

From src/server/services/goals.ts (Phase 2 — has NO month guard today):
```typescript
export async function updateGoal(userId: string, input: UpdateGoalInput) { /* no month check */ }
export async function deleteGoal(userId: string, goalId: string) { /* no month check */ }
export async function createGoal(userId: string, userTz: string, input: CreateGoalInput) {
  const month = monthBucket(new Date(), userTz) // server-derived — current month only
}
```

From src/server/actions/progress.ts (error mapper):
```typescript
function mapServiceError(e: unknown): string {
  if (e instanceof OutOfMonthError) return "That date isn't in the current month."
  // ...
}
```

From src/server/actions/goals.ts:
```typescript
// updateGoalAction does not pass userTz to service today; passes only user.id + parsed.data
// deleteGoalAction does not pass userTz either
```

Completed Plan 01 interfaces:
```typescript
// src/lib/time.ts
export function monthBucket(now: Date, userTz: string): Date
export function compareMonth(viewed: Date, current: Date): 'past' | 'current' | 'future'
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Rename OutOfMonthError → ReadOnlyMonthError + update message; update all call sites + action error mappers</name>
  <files>src/server/services/progress.ts, src/server/actions/progress.ts, tests/actions.progress.test.ts</files>

  <read_first>
    - /Users/rathtana.duong/gsd-tutorial/src/server/services/progress.ts (all 5+ throw sites + class definition on line 19)
    - /Users/rathtana.duong/gsd-tutorial/src/server/actions/progress.ts (error mapper on lines 40-47)
    - /Users/rathtana.duong/gsd-tutorial/tests/actions.progress.test.ts (existing OutOfMonthError assertions)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-UI-SPEC.md §Error / Rollback Copy (exact user-facing string: "This month is archived.")
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-RESEARCH.md §Pitfall 9 (grep requirement after rename)
  </read_first>

  <behavior>
    Rename verification:
    - Test 1: After rename, `rg "OutOfMonthError" src/ tests/` returns zero matches (Pitfall 9)
    - Test 2: `ReadOnlyMonthError` is exported from `src/server/services/progress.ts`
    - Test 3: `new ReadOnlyMonthError().message === 'This month is archived.'` (UI-SPEC verbatim copy)

    Action layer:
    - Test 4: Calling `incrementCountAction` on a past-month goal returns `{ ok: false, error: 'This month is archived.' }`
    - Test 5: Existing Phase 2 `actions.progress.test.ts` behavior preserved (current-month increment still returns `{ ok: true }`)
  </behavior>

  <action>
    Step 1 (RED): Update `tests/actions.progress.test.ts` — replace any `OutOfMonthError` import with `ReadOnlyMonthError`, replace any `"That date isn't in the current month."` expected-string assertion with `"This month is archived."`. Run tests → they fail (rename not done yet).

    Step 2 (GREEN — rename at definition):
    In `src/server/services/progress.ts`, change:
    ```typescript
    export class OutOfMonthError extends Error {
      constructor() { super("That date isn't in the current month.") }
    }
    ```
    to:
    ```typescript
    export class ReadOnlyMonthError extends Error {
      constructor() { super("This month is archived.") }
    }
    ```

    Rename every throw site in the same file:
    - `throw new OutOfMonthError()` → `throw new ReadOnlyMonthError()` (5 known occurrences: incrementCount line ~60, backfillCount lines ~80/81/85, toggleTask, upsertHabitCheckIn, undoLastMutation — use grep to find all)

    Do NOT modify the throw CONDITION — `if (g.month !== currentMonth)` stays identical (progress is still current-month-only per D-11).

    Step 3 (GREEN — update consumers):
    In `src/server/actions/progress.ts`:
    - Rename import `OutOfMonthError` → `ReadOnlyMonthError`
    - Update mapper: `if (e instanceof ReadOnlyMonthError) return "This month is archived."` (replaces the old line returning "That date isn't in the current month.")

    Step 4 (GREEN — test file):
    Any other references in `tests/` using `OutOfMonthError` must also rename. Run `rg "OutOfMonthError"` — zero matches required.

    Step 5: Full suite — must be green.
  </action>

  <verify>
    <automated>rg "OutOfMonthError" src/ tests/ || echo "grep-clean"; npx vitest run tests/actions.progress.test.ts</automated>
  </verify>

  <acceptance_criteria>
    - `rg "OutOfMonthError" src/ tests/` exits 1 (ripgrep's "no matches" exit code) OR prints "grep-clean"
    - `grep -n "export class ReadOnlyMonthError" src/server/services/progress.ts` returns a match
    - `grep -n "This month is archived" src/server/services/progress.ts` returns a match
    - `grep -n "ReadOnlyMonthError" src/server/actions/progress.ts` returns at least two matches (import + instanceof)
    - `grep -n "That date isn't in the current month" src/ tests/` returns zero matches (old copy retired)
    - `npx vitest run tests/actions.progress.test.ts` exits 0
    - `grep -c "throw new ReadOnlyMonthError" src/server/services/progress.ts` returns at least 5 (all throw sites renamed)
  </acceptance_criteria>

  <done>
    `OutOfMonthError` is gone from the repo. `ReadOnlyMonthError` with message "This month is archived." replaces it at the class, throw sites, import, and error-mapper level. `tests/actions.progress.test.ts` passes against the new copy.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Extend updateGoal + deleteGoal with ReadOnlyMonthError guard (future allowed, past blocked) + wire userTz through actions</name>
  <files>src/server/services/goals.ts, src/server/actions/goals.ts, tests/actions.goals.test.ts, tests/readonly-month-enforcement.test.ts</files>

  <read_first>
    - /Users/rathtana.duong/gsd-tutorial/src/server/services/goals.ts (current updateGoal/deleteGoal — NO month guard today; createGoal uses monthBucket on line 20 as a pattern to replicate)
    - /Users/rathtana.duong/gsd-tutorial/src/server/services/progress.ts (post-Task-1: ReadOnlyMonthError already exported; re-import it OR re-declare sibling — use the same class from progress.ts for single source of truth)
    - /Users/rathtana.duong/gsd-tutorial/src/server/actions/goals.ts (updateGoalAction and deleteGoalAction — neither passes userTz today)
    - /Users/rathtana.duong/gsd-tutorial/tests/actions.goals.test.ts (existing assertions — replicate their mock-Supabase pattern for the new read-only cases)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-RESEARCH.md §Pattern 2 (assertMutableForGoalWrite — past blocks, future allowed)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-CONTEXT.md D-09 (future-month goals mutable) + D-12 (past-month layered defense)
  </read_first>

  <behavior>
    Service-layer enforcement tests (new `tests/readonly-month-enforcement.test.ts`):
    - Test 1: updateGoal against a past-month goal (month < currentMonth) throws ReadOnlyMonthError
    - Test 2: updateGoal against a current-month goal succeeds (no throw)
    - Test 3: updateGoal against a future-month goal (currentMonth + 1) succeeds (D-09 — future-month CRUD allowed)
    - Test 4: deleteGoal against a past-month goal throws ReadOnlyMonthError
    - Test 5: deleteGoal against a current-month goal succeeds
    - Test 6: deleteGoal against a future-month goal succeeds (D-09)
    - Test 7: incrementCount against a future-month goal throws ReadOnlyMonthError (D-11 — progress is current-month only; future-month progress blocked)
    - Test 8: incrementCount against a past-month goal throws ReadOnlyMonthError

    Action layer:
    - Test 9: updateGoalAction on past-month goal returns `{ ok: false, error: 'This month is archived.' }`
    - Test 10: deleteGoalAction on past-month goal returns `{ ok: false, error: 'This month is archived.' }`
    - Test 11: updateGoalAction on future-month goal returns `{ ok: true }` (D-09)
  </behavior>

  <action>
    Step 1 (RED): Write `tests/readonly-month-enforcement.test.ts` with all 8 service-layer test cases above. Extend `tests/actions.goals.test.ts` with tests 9-11 (reuse the existing mock-Supabase + mock-db fixture pattern in the file). Run → fail.

    Step 2 (GREEN — service guards):
    In `src/server/services/goals.ts`:
    - Add `import { monthBucket } from "@/lib/time"` (if not already present — createGoal already uses it, so the import likely exists; verify)
    - Import `ReadOnlyMonthError` from `./progress` (single-source-of-truth per RESEARCH §Pattern 2 + D-discretion)
    - Change `updateGoal` signature: `export async function updateGoal(userId: string, userTz: string, input: UpdateGoalInput)` — adds `userTz` as the second arg (matches `createGoal`'s existing signature)
    - Inside `updateGoal`, after the `existing.length === 0` GoalNotFoundError check, add:
      ```typescript
      const currentMonthStr = monthBucket(new Date(), userTz).toISOString().slice(0, 10)
      if (existing[0].month < currentMonthStr) throw new ReadOnlyMonthError()
      // future (existing[0].month > currentMonthStr) is ALLOWED per D-09
      // current (=== currentMonthStr) is ALLOWED
      ```
    - Change `deleteGoal` signature: `export async function deleteGoal(userId: string, userTz: string, goalId: string)` — adds `userTz`
    - Change deleteGoal body to load-goal-first-then-month-check (not a single atomic DELETE), so we can inspect `goal.month` before deleting:
      ```typescript
      return db.transaction(async (tx) => {
        const [existing] = await tx.select({ month: goals.month }).from(goals)
          .where(and(eq(goals.id, goalId), eq(goals.userId, userId))).limit(1)
        if (!existing) throw new GoalNotFoundError()
        const currentMonthStr = monthBucket(new Date(), userTz).toISOString().slice(0, 10)
        if (existing.month < currentMonthStr) throw new ReadOnlyMonthError()
        await tx.delete(goals).where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
      })
      ```

    Step 3 (GREEN — action wiring):
    In `src/server/actions/goals.ts`:
    - Import `ReadOnlyMonthError` from `@/server/services/progress`
    - `updateGoalAction`: resolve `userTz = await resolveUserTz(user.id)` (add this line), pass to service: `await updateGoal(user.id, userTz, parsed.data)`, add `if (e instanceof ReadOnlyMonthError) return { ok: false, error: "This month is archived." }` BEFORE the generic catch
    - `deleteGoalAction`: same — resolve userTz, pass to service, add error-mapping clause with verbatim copy "This month is archived."

    Step 4: Confirm the `WrongGoalTypeError` etc. are still exported from `progress.ts` (consumed by `actions/progress.ts`) — Task 1 renamed the class but left siblings intact.

    Step 5: Run full suite → green. Spot-check: `rg "updateGoal\(userId," src/` and `rg "deleteGoal\(userId," src/` — no stale callers missing `userTz`.
  </action>

  <verify>
    <automated>npx vitest run tests/readonly-month-enforcement.test.ts tests/actions.goals.test.ts</automated>
  </verify>

  <acceptance_criteria>
    - `grep -n "export async function updateGoal(userId: string, userTz: string" src/server/services/goals.ts` returns a match (new signature)
    - `grep -n "export async function deleteGoal(userId: string, userTz: string" src/server/services/goals.ts` returns a match
    - `grep -n "throw new ReadOnlyMonthError" src/server/services/goals.ts` returns at least two matches (updateGoal + deleteGoal paths)
    - `grep -n "existing\[0\].month < currentMonthStr" src/server/services/goals.ts` OR `grep -n "< currentMonthStr" src/server/services/goals.ts` returns a match (past-only block, future allowed)
    - `grep -n "ReadOnlyMonthError" src/server/actions/goals.ts` returns at least three matches (import + 2 instanceof checks)
    - `grep -n "This month is archived" src/server/actions/goals.ts` returns at least two matches (updateGoalAction + deleteGoalAction mapping)
    - `tests/readonly-month-enforcement.test.ts` exists with at least 8 service-layer test cases (past updateGoal throws, current succeeds, future succeeds, past deleteGoal throws, current succeeds, future succeeds, future incrementCount throws, past incrementCount throws)
    - `npx vitest run tests/readonly-month-enforcement.test.ts tests/actions.goals.test.ts` exits 0
    - `npx vitest run` full suite exits 0 (no regression)
  </acceptance_criteria>

  <done>
    Service-layer past-month guard is in place on updateGoal AND deleteGoal with the distinguished past/future rule (past blocks, future allowed). Action layer maps ReadOnlyMonthError to the UI-SPEC error copy. Service-level test file locks the behavior without touching UI.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → server action | Past-month PATCH/DELETE crosses here; client may have replayed the request or bypassed UI guards |
| server action → service | Authenticated session passes user.id + userTz; goalId is untrusted user input |
| service → Postgres | Goal month read back from DB is trusted; current month is server-derived via `monthBucket(new Date(), userTz)` |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-01 | Tampering | `updateGoalAction` / `deleteGoalAction` | mitigate | Service-layer `ReadOnlyMonthError` fires on `goal.month < currentMonth`; test file `tests/readonly-month-enforcement.test.ts` directly invokes the service to prove the guard works without UI (PITFALLS §Debt line 181 + line 259 acceptance). |
| T-03-02 | Tampering | `incrementCountAction` / `toggleTaskAction` / `upsertHabitCheckInAction` | mitigate | Existing Phase 2 guard `goal.month !== currentMonth` (now throwing ReadOnlyMonthError) covers past AND future-month progress blocks per D-11. |
| T-03-03 | Elevation of Privilege | `updateGoal` / `deleteGoal` when `userTz` spoofed from client | mitigate | `userTz` is resolved server-side via `resolveUserTz(user.id)` reading `public.users.timezone`; action never accepts userTz from the client body. |
| T-03-04 | Information Disclosure | Error message leaks archived-month state | accept | `"This month is archived."` is intentionally unpunitive copy (UI-SPEC §Error copy); does not disclose sensitive data. Not exploitable. |
| T-03-05 | Tampering | Lexical-string `month < currentMonthStr` comparison incorrect at year boundary | accept | Both are ISO `YYYY-MM-DD` first-of-month strings; lexical ordering equals calendar ordering (RESEARCH §Pattern 2 Assumption A2). Locked by existing Phase 1 `monthBucket` contract. |
</threat_model>

<verification>
- `rg "OutOfMonthError"` returns zero matches in `src/` and `tests/`
- `npx vitest run tests/readonly-month-enforcement.test.ts tests/actions.progress.test.ts tests/actions.goals.test.ts` — all green
- Full `npx vitest run` — no regression
- Manual (next plan wires it): /dashboard view of a past-month curl PATCH returns `{ok: false, error: "This month is archived."}`
</verification>

<success_criteria>
- All Phase 2 write paths that previously threw `OutOfMonthError` now throw `ReadOnlyMonthError` with message "This month is archived."
- `updateGoal` and `deleteGoal` block past-month writes but ALLOW future-month writes per D-09
- Future-month progress logging continues to throw per D-11 (regression test case 7)
- Action layer returns `{ ok: false, error: "This month is archived." }` on any read-only violation
- Service-level test file asserts the layered-defense contract independent of UI
</success_criteria>

<output>
After completion, create `.planning/phases/03-month-navigation-history-reflection/03-02-SUMMARY.md` capturing:
- Exact throw-site count after rename (confirm all sites moved)
- Any places `ReadOnlyMonthError` diverges from `OutOfMonthError` semantics (expected: stricter for goal CRUD, unchanged for progress)
- Locked "This month is archived." copy (UI-SPEC verbatim)
- Note whether ReadOnlyMonthError was re-exported from goals.ts (single-file import from progress.ts preferred)
</output>
