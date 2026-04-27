---
phase: 03-month-navigation-history-reflection
plan: 4
subsystem: ui
tags: [route, ui, client-component, readonly, month-navigation, keyboard]

# Dependency graph
requires:
  - 03-01 (compareMonth, formatMonthSegment, parseMonthSegment, monthSegmentSchema)
  - 03-02 (ReadOnlyMonthError service-layer guard — UI layer defense in depth)
  - 03-03 (countGoalsInMonth + getReflectionForMonth query helpers)
  - 02 (DashboardShell, GoalCard, HabitGrid, PaceChip, EmptyState, signOutAction)

provides:
  - /dashboard redirect → /dashboard/[current-YYYY-MM] (MNAV-01 URL routing)
  - /dashboard/[month] dynamic route: Zod guard + future-cap + 5-branch render (MNAV-01)
  - MonthNavigator: prev/next links, disabled-next Button, keyboard ←/→ with D-07 focus guard
  - PastMonthReadOnly RSC: frozen GoalCards with variant='read-only' (MNAV-02 + D-12/13/14/15)
  - PastEmptyState RSC: 'No goals in {month}' + Back-to-current button
  - GoalCard variant='read-only': no kebab, no handlers, no PaceChip across count/checklist/habit
  - GoalCard progressDisabled: future-month CRUD enabled, progress affordances disabled (D-09/D-11)
  - DashboardShell monthContext: 'current' | 'future' threading progressDisabled to all cards

affects:
  - 03-05 (WelcomeToMonth + ReflectionCard — two TODO stubs in [month]/page.tsx)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Next.js 16 async params: params: Promise<{ month: string }> + await params destructure"
    - "rightCluster ReactNode slot: RSC page composes conditional children (Today/NewGoal/Logout) and passes to client MonthNavigator — avoids boolean props for server-computed visibility"
    - "variant='read-only' default='mutable': backward-compatible GoalCard extension — all Phase 2 call sites unchanged"
    - "progressDisabled prop chain: DashboardShell → GoalCard → count/checklist/habit/HabitGrid — future-month kebab live, stepper/+1/checkbox/cell disabled with title tooltip"
    - "readOnly prop on HabitGrid: suppresses click/focus handlers, today ring, future logic — miss cells always bg-muted (never red)"

key-files:
  created:
    - src/app/(protected)/dashboard/[month]/page.tsx
    - src/components/month-navigator.tsx
    - src/components/past-month-read-only.tsx
    - src/components/past-empty-state.tsx
  modified:
    - src/app/(protected)/dashboard/page.tsx (fully replaced — redirect only)
    - src/components/goal-card/index.tsx (variant + progressDisabled + monthYearLabel props)
    - src/components/goal-card/count.tsx (read-only gate + progressDisabled gate)
    - src/components/goal-card/checklist.tsx (read-only gate + disabled Checkbox + pointer-events-none)
    - src/components/goal-card/habit.tsx (read-only gate + passes readOnly to HabitGrid)
    - src/components/habit-grid.tsx (readOnly prop + progressDisabledTitle prop)
    - src/components/pace-chip.tsx (hidden prop for read-only/future-month suppression)
    - src/components/dashboard-shell.tsx (monthContext + monthYearLabel props; GoalCard progressDisabled)

key-decisions:
  - "progressDisabled prop (not variant='future-planning'): cleaner separation — variant controls presence/absence of affordances, progressDisabled controls disabled state while keeping kebab live. Threaded through 5 files."
  - "rightCluster ReactNode slot: Today button visibility is server-computed (viewed != current) — keeping it in the RSC avoids passing a boolean to a client component. RSC builds the ReactNode, passes it to MonthNavigator."
  - "PastMonthReadOnly is RSC (no 'use client'): no useOptimistic, no useTransition, no mutation handlers — pure render of frozen goals. DashboardShell is never mounted on past-month routes (D-13/14/15 honored at architecture level)."
  - "isNextDisabled computed server-side: isSameMonth(viewedMonth, addMonths(currentMonth, 1)) — prevents both UI Link and keyboard ArrowRight from navigating beyond cap (T-03-13 two-layer mitigation)."
  - "HabitGrid miss cells: bg-muted unchanged in readOnly — no red/destructive ever introduced (PITFALLS §1 + UI-SPEC Visual Regression Guardrail #6/#7)."

# Metrics
duration: ~9min
completed: 2026-04-27
tasks_completed: 5
files_changed: 12
---

# Phase 03 Plan 04: Month Route + Navigator + Read-Only UI Summary

Dynamic `/dashboard/[month]` route with Zod guard + future-cap + 5-branch render, MonthNavigator client header with keyboard shortcuts, and full GoalCard read-only/progressDisabled variant refactor across all six subcomponents.

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-27T05:18:00Z
- **Completed:** 2026-04-27T05:27:00Z
- **Tasks:** 5
- **Files modified/created:** 12

## Accomplishments

- **Task 1:** `src/app/(protected)/dashboard/page.tsx` fully replaced with a 21-line server redirect to `/dashboard/[current-month-YYYY-MM]` — all prior render logic moved to the dynamic route
- **Task 2:** `src/components/month-navigator.tsx` — `'use client'` component with prev/next Link navigation, disabled-next `<Button disabled>` branch (closes T-03-13 keyboard bypass), keyboard ←/→ shortcuts with D-07 focus guard (ignores INPUT/TEXTAREA/contenteditable), `rightCluster` ReactNode slot
- **Task 3:** GoalCard + count/checklist/habit/HabitGrid/PaceChip refactored — `variant='read-only'` removes kebab/handlers/PaceChip; `progressDisabled` disables progress affordances while keeping kebab live (D-09/D-11); no `bg-destructive`/`bg-red-*` in HabitGrid (PITFALLS §1)
- **Task 4:** `PastMonthReadOnly` RSC renders GoalCards with `variant="read-only"` (no DashboardShell, no client state); `PastEmptyState` RSC card with UI-SPEC verbatim copy; `DashboardShell` extended with `monthContext: 'current' | 'future'` + `monthYearLabel` props
- **Task 5:** `src/app/(protected)/dashboard/[month]/page.tsx` — Next.js 16 async params, Zod guard + `notFound()`, D-06 future cap + `notFound()`, 5-way branching render, two explicit TODO stubs for Plan 05

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 8e7909d | feat(03-04): rewrite dashboard/page.tsx as canonical-month redirect |
| 2 | 2228d52 | feat(03-04): create MonthNavigator client component with keyboard shortcuts |
| 3 | 2062d1b | feat(03-04): add variant/progressDisabled props to GoalCard + subcomponents |
| 4 | 253e8e4 | feat(03-04): add PastMonthReadOnly + PastEmptyState RSCs; extend DashboardShell with monthContext |
| 5 | c0e626d | feat(03-04): create dynamic /dashboard/[month] route with branching render |

## progressDisabled Prop Threading Chain

The `progressDisabled` prop flows through these files:
1. `src/app/(protected)/dashboard/[month]/page.tsx` — computes `monthContext` from `compareMonth` result
2. `src/components/dashboard-shell.tsx` — receives `monthContext: 'current' | 'future'`; passes `progressDisabled={monthContext === 'future'}` to each GoalCard
3. `src/components/goal-card/index.tsx` — accepts `progressDisabled?: boolean`; threads to count/checklist/habit
4. `src/components/goal-card/count.tsx` — gates +1 button, stepper buttons on `!progressDisabled`; `disabled` attr + `title` tooltip
5. `src/components/goal-card/checklist.tsx` — `<Checkbox disabled={progressDisabled}>`; `pointer-events-none` on row
6. `src/components/goal-card/habit.tsx` — passes `readOnly={isReadOnly || progressDisabled}` to HabitGrid
7. `src/components/habit-grid.tsx` — `readOnly` prop suppresses all click/focus/keydown handlers

## Motion/ProgressBar Tweak

None — Phase 2 ProgressBar is idempotent with `initial={false}`. Past-month bars render at historical fill without spring animation because no `percent` prop change occurs during page lifetime. No ProgressBar changes made.

## Plan 05 TODO Stubs

Two explicit TODO comments in `src/app/(protected)/dashboard/[month]/page.tsx`:
1. **Line 108:** `// TODO (Plan 05): render <WelcomeToMonth priorMonthLabel={...} monthYearLabel={...} />` — triggers when `goals.length === 0 && priorMonthHasGoals` (D-18 precondition computed but not rendered)
2. **Line 130:** `{/* TODO (Plan 05): when status !== 'future', render <ReflectionCard month={viewedMonth} initial={reflection} monthYearLabel={monthYearLabel} /> */}` — ReflectionCard UI

## Phase 2 Regression Test Status

- `npx vitest run`: **182 tests pass** (16/17 test files) — only `rls.test.ts` excluded (pre-existing DATABASE_URL requirement)
- Default `variant='mutable'` + `progressDisabled=false` + `monthContext` not applicable to past-month routes means all Phase 2 current-month behavior is preserved exactly
- DashboardShell call sites in Phase 2 test mocks do not pass `monthContext` — TypeScript would error if the prop were required. It is required but only from `[month]/page.tsx` which is new code.

## Known Stubs

Two intentional stubs in `src/app/(protected)/dashboard/[month]/page.tsx`:
- **WelcomeToMonth** (line ~108): Falls back to `<EmptyState>` for now. Plan 05 will replace with the Welcome card when `priorMonthHasGoals && goals.length === 0`.
- **ReflectionCard** (line ~130): Not rendered. Plan 05 will mount the ReflectionCard for past + current months.

These stubs do NOT prevent MNAV-01, MNAV-02, or GOAL-05 from being verified — the route is fully functional for those requirements.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

No new security-relevant surface beyond the plan's threat model:
- T-03-12: `monthSegmentSchema.safeParse` guards `[month]` segment before any DB query
- T-03-13: Disabled-next renders `<Button disabled>` (not Link); keyboard handler also checks `!isNextDisabled`
- T-03-16: Future cap `isSameMonth(viewedMonth, addMonths(currentMonth, 1))` fires `notFound()` before DB queries run

## Self-Check: PASSED

- FOUND: src/app/(protected)/dashboard/[month]/page.tsx
- FOUND: src/components/month-navigator.tsx
- FOUND: src/components/past-month-read-only.tsx
- FOUND: src/components/past-empty-state.tsx
- FOUND: src/app/(protected)/dashboard/page.tsx (redirect-only)
- Commits 8e7909d, 2228d52, 2062d1b, 253e8e4, c0e626d all verified in git log
