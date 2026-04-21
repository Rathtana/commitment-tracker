---
phase: 03-month-navigation-history-reflection
plan: 4
type: execute
wave: 2
depends_on: [1, 2, 3]
files_modified:
  - src/app/(protected)/dashboard/page.tsx
  - src/app/(protected)/dashboard/[month]/page.tsx
  - src/components/month-navigator.tsx
  - src/components/past-month-read-only.tsx
  - src/components/past-empty-state.tsx
  - src/components/goal-card/index.tsx
  - src/components/goal-card/count.tsx
  - src/components/goal-card/checklist.tsx
  - src/components/goal-card/habit.tsx
  - src/components/habit-grid.tsx
  - src/components/pace-chip.tsx
  - src/components/dashboard-shell.tsx
autonomous: true
requirements: [MNAV-01, MNAV-02, GOAL-05]
tags: [route, ui, client-component, readonly]

must_haves:
  truths:
    - "GET /dashboard (no segment) 302-redirects to /dashboard/[current-month-YYYY-MM]"
    - "GET /dashboard/[month] with a valid YYYY-MM segment renders the month dashboard"
    - "GET /dashboard/[bad-segment] (e.g. /dashboard/abc, /dashboard/2026-13, /dashboard/2026-4) renders Next.js 404 via notFound()"
    - "GET /dashboard/[month-beyond-next] renders 404 — future-month cap = current + 1 only (D-06)"
    - "MonthNavigator renders ← [Month Year] → with prev always enabled and next disabled when viewed = current + 1 (D-05)"
    - "Today button appears only when viewed != current (D-08); links to /dashboard/[current-month]"
    - "Keyboard ← and → shortcuts navigate months; no-op when focus is in input/textarea/contenteditable (D-07)"
    - "Past-month routes render PastMonthReadOnly — frozen GoalCards with variant='read-only': NO kebab, NO steppers, NO checkbox click handlers, NO habit-cell click handlers, NO PaceChip (D-12, D-13, D-14, D-15)"
    - "Past-month habit grid cells render emerald fill on hits and muted on misses — NEVER red/destructive (PITFALLS §1 portfolio of wins; UI-SPEC Visual Regression Guardrail #6 + #7)"
    - "Past-month routes do NOT mount DashboardShell (no useOptimistic, no mutation handlers — D-14, D-15)"
    - "Past-month empty deep-link (no goals + compareMonth='past') renders PastEmptyState with Back-to-current button"
  artifacts:
    - path: "src/app/(protected)/dashboard/page.tsx"
      provides: "1-line server redirect to /dashboard/[current-month-segment]"
      contains: "redirect(`/dashboard/"
    - path: "src/app/(protected)/dashboard/[month]/page.tsx"
      provides: "Async-params RSC route: Zod guard → compareMonth → future-cap → branching render (past-empty / past / current-or-future-empty / with-goals)"
      contains: "notFound"
    - path: "src/components/month-navigator.tsx"
      provides: "'use client' prev/next/today header with keyboard listener"
      contains: "'use client'"
    - path: "src/components/past-month-read-only.tsx"
      provides: "RSC wrapper rendering GoalCards with variant='read-only' (no DashboardShell)"
      contains: "readOnly"
    - path: "src/components/past-empty-state.tsx"
      provides: "RSC-safe card: 'No goals in {Month}' + Back-to-current button"
      contains: "No goals in"
    - path: "src/components/goal-card/index.tsx"
      provides: "GoalCard accepts variant: 'mutable' | 'read-only' prop; threads through to count/checklist/habit subcomponents"
      contains: "variant"
  key_links:
    - from: "src/app/(protected)/dashboard/[month]/page.tsx"
      to: "src/lib/schemas/month.ts"
      via: "monthSegmentSchema.safeParse → notFound()"
      pattern: "monthSegmentSchema"
    - from: "src/app/(protected)/dashboard/[month]/page.tsx"
      to: "src/lib/time.ts"
      via: "parseMonthSegment + compareMonth + formatMonthSegment + monthBucket"
      pattern: "compareMonth\\(viewedMonth"
    - from: "src/components/month-navigator.tsx"
      to: "next/link + next/navigation"
      via: "<Link> for prev/next/today + useRouter for keyboard push"
      pattern: "useRouter"
    - from: "src/components/past-month-read-only.tsx"
      to: "src/components/goal-card/index.tsx"
      via: "passes variant='read-only' prop"
      pattern: "variant=\"read-only\""
---

<objective>
Stand up the dynamic `/dashboard/[month]` route, the `MonthNavigator` client header with keyboard shortcuts, and the read-only past-month render path — including the `GoalCard` variant refactor that threads a `readOnly` flag through count/checklist/habit/HabitGrid/PaceChip children. Wires Plan 02's service-layer `ReadOnlyMonthError` to the UI affordance absence (D-12 layered defense).

Purpose: This plan delivers MNAV-01 (URL-routed navigation) + MNAV-02 UI half (past-month visible but frozen) + GOAL-05 path (future-month route exists; Plan 05 wires the Welcome trigger UI). The Welcome card, the ReflectionCard UI, and the copy-from-last-month action ship in Plan 05.
Output: New `[month]/page.tsx` route with branching render; `/dashboard` page rewritten as a redirect; four new components (MonthNavigator, PastMonthReadOnly, PastEmptyState, plus the variant refactor on GoalCard); DashboardShell extended with a `monthContext` prop; HabitGrid + PaceChip respect readOnly.
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
@.planning/phases/02-goals-dashboard-three-types/02-UI-SPEC.md
@CLAUDE.md

<interfaces>
<!-- Contracts this plan extends -->

From Plan 01 (src/lib/time.ts + schemas):
```typescript
export function compareMonth(viewed: Date, current: Date): 'past' | 'current' | 'future'
export function formatMonthSegment(month: Date): string        // 'YYYY-MM'
export function parseMonthSegment(segment: string): Date       // returns UTC first-of-month
export function monthBucket(now: Date, userTz: string): Date
// src/lib/schemas/month.ts
export const monthSegmentSchema: z.ZodSchema<string>
```

From Plan 03 (query helpers):
```typescript
// src/server/db/queries.ts
export async function getMonthDashboard(userId: string, month: Date): Promise<Goal[]>   // Phase 2 existing
export async function countGoalsInMonth(userId: string, month: Date): Promise<number>    // NEW
export async function getReflectionForMonth(userId: string, month: Date): Promise<{whatWorked, whatDidnt} | null>  // NEW
```

From Phase 2 (src/app/(protected)/dashboard/page.tsx lines 29-41 — current static header to replace):
```typescript
<header className="mb-2 flex items-center justify-between">
  <h1 className="text-2xl font-semibold">{monthYearLabel}</h1>
  <div className="flex items-center gap-2">
    {goals.length > 0 && <NewGoalButton daysInMonthDefault={daysInMonthDefault} />}
    <form action={signOutAction}><Button type="submit" variant="outline" size="sm">Log out</Button></form>
  </div>
</header>
```

From Phase 2 (src/components/dashboard-shell.tsx — has useOptimistic + dispatch pattern; Plan 3 extends to accept monthContext):
```typescript
export function DashboardShell({ initialGoals, userTz, nowIso, daysInMonthDefault }: Props)
export function NewGoalButton({ daysInMonthDefault }: { daysInMonthDefault: number })
```

From Phase 2 (src/components/goal-card/*):
```typescript
// index.tsx: <GoalCard goal={goal} now={now} userTz={userTz} handlers={handlers} />
// count.tsx / checklist.tsx / habit.tsx: each accept { goal, onAction, ... }
// habit-grid.tsx + pace-chip.tsx: currently always interactive
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite src/app/(protected)/dashboard/page.tsx as canonical-month redirect</name>
  <files>src/app/(protected)/dashboard/page.tsx</files>

  <read_first>
    - /Users/rathtana.duong/gsd-tutorial/src/app/(protected)/dashboard/page.tsx (current full render — will be fully replaced)
    - /Users/rathtana.duong/gsd-tutorial/src/server/actions/auth.ts (signOutAction redirect pattern to replicate)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-PATTERNS.md §`src/app/(protected)/dashboard/page.tsx` section (verbatim redirect body)
  </read_first>

  <action>
    FULLY REPLACE the contents of `src/app/(protected)/dashboard/page.tsx` with:

    ```typescript
    import { redirect } from "next/navigation"
    import { eq } from "drizzle-orm"
    import { getSupabaseServerClient } from "@/lib/supabase/server"
    import { db } from "@/server/db"
    import { users } from "@/server/db/schema"
    import { monthBucket, formatMonthSegment } from "@/lib/time"

    export default async function DashboardRedirect() {
      const supabase = await getSupabaseServerClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) redirect("/login")

      const [row] = await db
        .select({ timezone: users.timezone })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1)
      const userTz = row?.timezone ?? "UTC"

      redirect(`/dashboard/${formatMonthSegment(monthBucket(new Date(), userTz))}`)
    }
    ```

    All previous render logic (header, EmptyState, DashboardShell) is moving to `[month]/page.tsx` in Task 2.
  </action>

  <verify>
    <automated>grep -n "redirect(\`/dashboard/" src/app/\(protected\)/dashboard/page.tsx && npx tsc --noEmit -p .</automated>
  </verify>

  <acceptance_criteria>
    - `src/app/(protected)/dashboard/page.tsx` exists and is ≤ 25 lines (redirect-only)
    - `grep -n "formatMonthSegment" src/app/\(protected\)/dashboard/page.tsx` returns a match
    - `grep -n "redirect(\`/dashboard/" src/app/\(protected\)/dashboard/page.tsx` returns a match
    - `grep -n "DashboardShell\|EmptyState\|NewGoalButton" src/app/\(protected\)/dashboard/page.tsx` returns ZERO matches (render moved to [month]/page.tsx)
    - `npx tsc --noEmit -p .` exits 0
  </acceptance_criteria>

  <done>
    Old static render is gone; page is a 1-action server redirect to the canonical month URL.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create MonthNavigator client component with keyboard shortcuts</name>
  <files>src/components/month-navigator.tsx</files>

  <read_first>
    - /Users/rathtana.duong/gsd-tutorial/src/components/create-goal-dialog.tsx lines 60-90 (client-component setup pattern + useEffect)
    - /Users/rathtana.duong/gsd-tutorial/src/components/earlier-day-popover.tsx lines 29-38 (useEffect + keydown + cleanup pattern)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-RESEARCH.md §Pattern 4 (full MonthNavigator implementation, copy verbatim with adjustments for slot-based right-cluster per UI-SPEC)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-UI-SPEC.md §MonthNavigator (layout, aria-labels, disabled state, keyboard spec)
  </read_first>

  <action>
    Create `src/components/month-navigator.tsx`:

    ```typescript
    'use client'

    import { useEffect, type ReactNode } from 'react'
    import { useRouter } from 'next/navigation'
    import Link from 'next/link'
    import { ChevronLeft, ChevronRight } from 'lucide-react'
    import { addMonths, subMonths } from 'date-fns'
    import { Button } from '@/components/ui/button'
    import { formatMonthSegment } from '@/lib/time'

    interface Props {
      viewedMonthIso: string         // 'YYYY-MM-DD' — UTC first-of-month from the route page
      currentMonthIso: string        // 'YYYY-MM-DD'
      isNextDisabled: boolean        // server-computed: viewedMonth === currentMonth + 1
      monthYearLabel: string         // 'April 2026'
      rightCluster?: ReactNode        // Conditional children: [Today] [NewGoal] [Logout] — route wires visibility
    }

    export function MonthNavigator({
      viewedMonthIso,
      currentMonthIso,
      isNextDisabled,
      monthYearLabel,
      rightCluster,
    }: Props) {
      const router = useRouter()
      const viewed = new Date(viewedMonthIso)
      const prevHref = `/dashboard/${formatMonthSegment(subMonths(viewed, 1))}`
      const nextHref = `/dashboard/${formatMonthSegment(addMonths(viewed, 1))}`

      useEffect(() => {
        function onKey(e: KeyboardEvent) {
          // D-07: ignore when focus is inside an input/textarea/contenteditable
          const t = e.target as HTMLElement | null
          if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            router.push(prevHref)
          } else if (e.key === 'ArrowRight' && !isNextDisabled) {
            e.preventDefault()
            router.push(nextHref)
          }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [router, prevHref, nextHref, isNextDisabled])

      return (
        <header className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href={prevHref} aria-label="Previous month">
                <ChevronLeft className="size-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold">{monthYearLabel}</h1>
            {isNextDisabled ? (
              <Button
                variant="ghost"
                size="icon"
                disabled
                aria-disabled="true"
                aria-label="Next month — unavailable"
                title="Next month — unavailable"
                className="opacity-50 cursor-not-allowed"
              >
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button variant="ghost" size="icon" asChild>
                <Link href={nextHref} aria-label="Next month">
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            )}
          </div>
          {rightCluster && <div className="flex items-center gap-2">{rightCluster}</div>}
        </header>
      )
    }
    ```

    Notes:
    - The disabled-next branch renders a `<Button disabled>` (not a `<Link>`) — closes Pitfall 6 (keyboard-enter through pointer-events-none).
    - `rightCluster` is a ReactNode slot so the route page can conditionally compose [Today button] [NewGoalButton — only if not past] [Logout].
    - Today button is NOT rendered by MonthNavigator — the route page passes it (or not) via rightCluster. Per UI-SPEC: Today visibility depends on server-computed `viewed !== current`, so keeping it in the RSC avoids a boolean prop.
  </action>

  <verify>
    <automated>grep -c "'use client'" src/components/month-navigator.tsx && grep -n "useEffect" src/components/month-navigator.tsx && npx tsc --noEmit -p .</automated>
  </verify>

  <acceptance_criteria>
    - `src/components/month-navigator.tsx` starts with `'use client'` directive
    - Exports `MonthNavigator` component
    - `grep -n "aria-label=\"Previous month\"" src/components/month-navigator.tsx` returns a match
    - `grep -n "aria-label=\"Next month\"" src/components/month-navigator.tsx` returns a match
    - `grep -n "aria-label=\"Next month — unavailable\"" src/components/month-navigator.tsx` returns a match (disabled state)
    - `grep -n "ArrowLeft\|ArrowRight" src/components/month-navigator.tsx` returns matches for both keys
    - `grep -n "t.tagName === 'INPUT'" src/components/month-navigator.tsx` OR `grep -n "INPUT\|TEXTAREA" src/components/month-navigator.tsx` returns a match (D-07 focus guard)
    - `grep -n "ChevronLeft\|ChevronRight" src/components/month-navigator.tsx` returns matches
    - `npx tsc --noEmit -p .` exits 0
  </acceptance_criteria>

  <done>
    MonthNavigator ships with working prev/next Link navigation, disabled-state Button branch (closes Pitfall 6), keyboard shortcuts with D-07 focus guard, and a rightCluster slot for caller-provided conditional children.
  </done>
</task>

<task type="auto">
  <name>Task 3: Refactor GoalCard + count/checklist/habit/HabitGrid/PaceChip to accept variant='read-only' prop (no kebab, no handlers, no PaceChip)</name>
  <files>src/components/goal-card/index.tsx, src/components/goal-card/count.tsx, src/components/goal-card/checklist.tsx, src/components/goal-card/habit.tsx, src/components/habit-grid.tsx, src/components/pace-chip.tsx</files>

  <read_first>
    - /Users/rathtana.duong/gsd-tutorial/src/components/goal-card/index.tsx (current Props shape — extend to accept variant)
    - /Users/rathtana.duong/gsd-tutorial/src/components/goal-card/count.tsx (find kebab mount site + stepper + +1 button — all three must be gated on variant)
    - /Users/rathtana.duong/gsd-tutorial/src/components/goal-card/checklist.tsx (find Checkbox + row click handler — use disabled + pointer-events-none in read-only)
    - /Users/rathtana.duong/gsd-tutorial/src/components/goal-card/habit.tsx (find kebab + HabitGrid call site)
    - /Users/rathtana.duong/gsd-tutorial/src/components/habit-grid.tsx (cell rendering — add readOnly prop that suppresses click handlers; keep aria-labels per UI-SPEC)
    - /Users/rathtana.duong/gsd-tutorial/src/components/pace-chip.tsx (current Props — add hidePaceChip OR have callers return null based on variant)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-UI-SPEC.md §Past-Month Read-Only Rendering (exhaustive behavior table lines 386-407)
  </read_first>

  <action>
    Step 1 — GoalCard Props: Add `variant?: 'mutable' | 'read-only'` (default `'mutable'`) to the top-level `GoalCardProps` in `src/components/goal-card/index.tsx`. Thread it to the three variant-picker branches (count/checklist/habit).

    Step 2 — count.tsx: Wrap kebab DropdownMenu, stepper buttons, and +1 button in `{variant !== 'read-only' && ...}`. When read-only, render ONLY: title, PaceChip (but PaceChip returns null when readOnly — Step 5), progress bar (same component, same visual), raw count label ("N of M"). All interactive affordances gone from the DOM.

    Step 3 — checklist.tsx: When read-only:
    - Hide DropdownMenu kebab
    - Render checkboxes as `<Checkbox checked={t.isDone} disabled />` (disabled state; shadcn checkbox shows faint fill)
    - Wrap the row in `className={cn(rowClass, variant === 'read-only' && 'cursor-default pointer-events-none')}`
    - Remove `onCheckedChange` handler when readOnly
    - Keep line-through styling on completed tasks

    Step 4 — habit.tsx: When read-only:
    - Hide DropdownMenu kebab
    - Pass `readOnly={true}` to HabitGrid
    - PaceChip hidden (Step 5)

    Step 5 — habit-grid.tsx: Add `readOnly?: boolean` prop. When true:
    - Render cells as `<button disabled>` OR `<div>` elements — keep the EXACT aria-label format per UI-SPEC.md §Past-Month ("April 3 — done" / "April 3 — not done")
    - Do NOT attach any onClick handlers
    - Miss cells: `bg-muted` (UNCHANGED — PITFALLS §1 + UI-SPEC Visual Regression Guardrail #6+#7 — NEVER red/destructive)
    - Hit cells: `bg-primary` (UNCHANGED — emerald fill on past months)
    - "Today" ring: not rendered in read-only (past months have no "today")
    - Future-in-month cells: not applicable in read-only (past months are complete)

    Step 6 — pace-chip.tsx: Add a `hidden?: boolean` prop (OR read variant from parent). When hidden, return `null`. PaceChip is suppressed on past-month cards per UI-SPEC line 401.

    Step 7: Update GoalCard call sites — the existing DashboardShell (Phase 2) calls `<GoalCard goal={goal} ... />` without variant; the default `'mutable'` keeps it mutable. The new PastMonthReadOnly (Task 4) passes `variant="read-only"`.

    Step 8: For Motion ProgressBar: Per UI-SPEC line 394, Phase 2 ProgressBar is already idempotent with `initial={false}`. Do NOT alter the progress-bar component; past-month bars use the same component and render at historical fill without spring animation because no `percent` prop change occurs during the page lifetime.
  </action>

  <verify>
    <automated>npx tsc --noEmit -p . && grep -c "variant" src/components/goal-card/index.tsx</automated>
  </verify>

  <acceptance_criteria>
    - `grep -n "variant" src/components/goal-card/index.tsx` returns at least one match (prop added)
    - `grep -n "variant.*'read-only'\|variant === \"read-only\"" src/components/goal-card/count.tsx` returns a match (conditional gate)
    - `grep -n "variant.*'read-only'\|variant === \"read-only\"" src/components/goal-card/checklist.tsx` returns a match
    - `grep -n "readOnly\|variant" src/components/habit-grid.tsx` returns at least one match (prop added)
    - `grep -n "disabled" src/components/goal-card/checklist.tsx` returns at least one match (Checkbox disabled in read-only)
    - `grep -n "bg-destructive\|bg-red-" src/components/habit-grid.tsx` returns ZERO matches (PITFALLS §1 — no red cells)
    - `grep -n "hidden\|readOnly\|variant" src/components/pace-chip.tsx` returns at least one match (suppression prop)
    - `npx tsc --noEmit -p .` exits 0
    - `npx vitest run` full suite exits 0 (Phase 2 tests still pass — default variant='mutable' preserves behavior)
  </acceptance_criteria>

  <done>
    GoalCard + children accept `variant` prop; `read-only` hides kebab, replaces interactive inputs with disabled/static elements, suppresses PaceChip. Phase 2 regression-free because default is `'mutable'`. No destructive color introduced.
  </done>
</task>

<task type="auto">
  <name>Task 4: Create PastMonthReadOnly RSC wrapper + PastEmptyState RSC component + extend DashboardShell with monthContext prop</name>
  <files>src/components/past-month-read-only.tsx, src/components/past-empty-state.tsx, src/components/dashboard-shell.tsx</files>

  <read_first>
    - /Users/rathtana.duong/gsd-tutorial/src/components/dashboard-shell.tsx (Phase 2 — lines mapping goals to GoalCards is the analog for PastMonthReadOnly)
    - /Users/rathtana.duong/gsd-tutorial/src/components/empty-state.tsx (analog for PastEmptyState — same Card primitive choices)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-UI-SPEC.md §PastEmptyState Card layout (lines 545-556) + §Past-Month Read-Only Rendering
    - /Users/rathtana.duong/gsd-tutorial/src/lib/progress.ts (Goal type)
  </read_first>

  <action>
    Step 1 — Create `src/components/past-month-read-only.tsx` as an RSC (no 'use client'):

    ```typescript
    import type { Goal } from '@/lib/progress'
    import { GoalCard } from '@/components/goal-card'

    interface Props {
      goals: Goal[]
      now: Date
      userTz: string
    }

    /**
     * Frozen past-month goal list — no DashboardShell, no useOptimistic, no mutation handlers.
     * Per D-13, D-14, D-15 + UI-SPEC §Past-Month Read-Only Rendering.
     */
    export function PastMonthReadOnly({ goals, now, userTz }: Props) {
      return (
        <section className="flex flex-col gap-4" aria-label="Your goals (archived)">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              now={now}
              userTz={userTz}
              variant="read-only"
            />
          ))}
        </section>
      )
    }
    ```

    Step 2 — Create `src/components/past-empty-state.tsx` as an RSC:

    ```typescript
    import Link from 'next/link'
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
    import { Button } from '@/components/ui/button'

    interface Props {
      monthYearLabel: string
      currentMonthSegment: string
    }

    /**
     * Minimal past-empty-month view per D-16 + UI-SPEC §PastEmptyState.
     */
    export function PastEmptyState({ monthYearLabel, currentMonthSegment }: Props) {
      return (
        <Card className="p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-2xl font-semibold">No goals in {monthYearLabel}.</CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            <p className="text-base text-muted-foreground">
              You didn&apos;t have goals tracked this month.
            </p>
            <Button variant="outline" asChild className="min-h-11 w-full sm:w-auto">
              <Link href={`/dashboard/${currentMonthSegment}`}>Back to current month</Link>
            </Button>
          </CardContent>
        </Card>
      )
    }
    ```

    Step 3 — Extend `src/components/dashboard-shell.tsx`:

    The existing `DashboardShell` is the mutable Wave 2+ Phase 2 client wrapper. Past months do NOT mount it. Current/future-with-goals months DO mount it. Add a `monthContext: 'current' | 'future'` prop so future-month card rendering can suppress progress affordances per D-11 + UI-SPEC §Future-Month Render.

    Change `DashboardShell` Props to:
    ```typescript
    interface DashboardShellProps {
      initialGoals: Goal[]
      userTz: string
      nowIso: string
      daysInMonthDefault: number
      monthContext: 'current' | 'future'  // NEW
    }
    ```

    Thread `monthContext` to each `GoalCard`:
    - When `monthContext === 'future'`: pass `variant="mutable"` BUT HabitGrid and stepper use `disabled` state with hint tooltip "Available when {Month} starts" per UI-SPEC line 417. Simplest implementation: add a separate `progressDisabled={monthContext === 'future'}` prop OR re-use `variant` by introducing a third value `'future-planning'` with its own behavior. **Planner decision:** add `progressDisabled: boolean` prop to GoalCard (clearer than overloading variant) — threaded to count/checklist/habit/HabitGrid. When true, kebab is RENDERED (future-month CRUD is allowed), but stepper/+1/checkbox/habit-cell handlers are gated behind `disabled` + the hint tooltip. PaceChip is hidden.
    - When `monthContext === 'current'`: existing Phase 2 behavior — all affordances live.

    Update GoalCard + count/checklist/habit/HabitGrid to accept `progressDisabled?: boolean`. When true AND variant is 'mutable':
    - Steppers / +1 / Checkbox / habit cells: render with `disabled` attribute + `title="Available when {Month} starts"` (route page passes the monthYearLabel)
    - Kebab: RENDERED (create/edit/delete allowed per D-09)
    - PaceChip: hidden
    - Progress bar: renders at zero (future months have no progress)

    Verify Phase 2 regression: default `progressDisabled={false}` + existing call sites don't pass it → behavior unchanged.
  </action>

  <verify>
    <automated>npx tsc --noEmit -p . && grep -n "PastMonthReadOnly" src/components/past-month-read-only.tsx && grep -n "PastEmptyState" src/components/past-empty-state.tsx && grep -n "monthContext" src/components/dashboard-shell.tsx</automated>
  </verify>

  <acceptance_criteria>
    - `src/components/past-month-read-only.tsx` exists; does NOT start with `'use client'` (RSC-safe)
    - `grep -n "variant=\"read-only\"" src/components/past-month-read-only.tsx` returns a match
    - `grep -n "useOptimistic\|useState\|useTransition" src/components/past-month-read-only.tsx` returns ZERO matches (no client state)
    - `src/components/past-empty-state.tsx` exists; RSC-safe (no 'use client')
    - `grep -n "No goals in" src/components/past-empty-state.tsx` returns a match (UI-SPEC verbatim copy)
    - `grep -n "Back to current month" src/components/past-empty-state.tsx` returns a match
    - `grep -n "monthContext" src/components/dashboard-shell.tsx` returns at least one match
    - `grep -n "progressDisabled" src/components/goal-card/index.tsx` OR equivalent threading prop returns a match
    - `npx tsc --noEmit -p .` exits 0
    - `npx vitest run` full suite exits 0 (Phase 2 current-month behavior preserved)
  </acceptance_criteria>

  <done>
    Past-month render path is two components (no DashboardShell). DashboardShell knows about current vs future context. Future-month cards render with kebab + create/edit/delete (D-09) but progress affordances disabled with hint tooltip (D-11 + UI-SPEC line 417).
  </done>
</task>

<task type="auto">
  <name>Task 5: Create the dynamic route src/app/(protected)/dashboard/[month]/page.tsx with branching render</name>
  <files>src/app/(protected)/dashboard/[month]/page.tsx</files>

  <read_first>
    - Previous version (now a redirect): `src/app/(protected)/dashboard/page.tsx` (what we just removed moved here)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-RESEARCH.md §Pattern 1 (async params + Zod + notFound) + §Pattern 5 (branching render, full snippet)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-UI-SPEC.md §Layout decision tree (lines 491-517) — five render branches
    - /Users/rathtana.duong/gsd-tutorial/src/server/db/queries.ts (countGoalsInMonth + getReflectionForMonth + getMonthDashboard)
    - /Users/rathtana.duong/gsd-tutorial/src/components/empty-state.tsx (reuse for first-ever-user empty state)
  </read_first>

  <action>
    Create `src/app/(protected)/dashboard/[month]/page.tsx`. Note: Plan 05 adds WelcomeToMonth + ReflectionCard — for now, this plan stubs those two renders so the route is complete enough to ship MNAV-01 + MNAV-02 + GOAL-05 independently. In Task 5 we render:

    - Past empty → `<PastEmptyState />` ✓
    - Past with goals → `<PastMonthReadOnly />` ✓
    - Current/future empty + prior-month-has-goals → TODO stub (render `<EmptyState />` for now; Plan 05 swaps to `<WelcomeToMonth />`)
    - Current/future empty + no prior goals → `<EmptyState />` ✓
    - Current/future with goals → `<DashboardShell monthContext={...} />` ✓
    - Reflection card rendering → TODO stub (Plan 05 mounts `<ReflectionCard />`)

    Add TODO comments at the two stub sites clearly referencing Plan 05.

    Full file:

    ```typescript
    import { notFound, redirect } from "next/navigation"
    import { eq } from "drizzle-orm"
    import { addMonths, format, getDaysInMonth, isSameMonth, subMonths } from "date-fns"
    import { getSupabaseServerClient } from "@/lib/supabase/server"
    import { db } from "@/server/db"
    import { users } from "@/server/db/schema"
    import {
      compareMonth,
      formatMonthSegment,
      monthBucket,
      parseMonthSegment,
    } from "@/lib/time"
    import { monthSegmentSchema } from "@/lib/schemas/month"
    import {
      countGoalsInMonth,
      getMonthDashboard,
    } from "@/server/db/queries"
    import { MonthNavigator } from "@/components/month-navigator"
    import { DashboardShell, NewGoalButton } from "@/components/dashboard-shell"
    import { EmptyState } from "@/components/empty-state"
    import { PastMonthReadOnly } from "@/components/past-month-read-only"
    import { PastEmptyState } from "@/components/past-empty-state"
    import { signOutAction } from "@/server/actions/auth"
    import { Button } from "@/components/ui/button"
    import Link from "next/link"

    interface PageProps {
      params: Promise<{ month: string }>
    }

    export default async function DashboardMonthPage({ params }: PageProps) {
      const { month: segment } = await params
      const parsed = monthSegmentSchema.safeParse(segment)
      if (!parsed.success) notFound()

      const supabase = await getSupabaseServerClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) redirect("/login")

      const [userRow] = await db
        .select({ timezone: users.timezone })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1)
      const userTz = userRow?.timezone ?? "UTC"

      const now = new Date()
      const currentMonth = monthBucket(now, userTz)
      const viewedMonth = parseMonthSegment(parsed.data)
      const status = compareMonth(viewedMonth, currentMonth)

      // D-06: future cap = current + 1 only
      const nextAllowed = addMonths(currentMonth, 1)
      if (status === "future" && !isSameMonth(viewedMonth, nextAllowed)) notFound()

      const isNextDisabled = isSameMonth(viewedMonth, nextAllowed)
      const monthYearLabel = format(viewedMonth, "MMMM yyyy")
      const daysInMonth = getDaysInMonth(viewedMonth)
      const viewedIsoDate = viewedMonth.toISOString().slice(0, 10)
      const currentIsoDate = currentMonth.toISOString().slice(0, 10)
      const currentSegment = formatMonthSegment(currentMonth)
      const isCurrent = status === "current"

      const goals = await getMonthDashboard(user.id, viewedMonth)

      // D-18 precondition (Plan 05 will wire Welcome UI; for now, compute but don't render the card)
      const priorMonthHasGoals =
        status === "past"
          ? false
          : (await countGoalsInMonth(user.id, subMonths(viewedMonth, 1))) > 0

      // Header right-cluster: past months have no NewGoal button (D-12 UI layer)
      // Today button: only when viewed != current (D-08)
      const rightCluster = (
        <>
          {!isCurrent && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/${currentSegment}`} aria-label="Return to this month">Today</Link>
            </Button>
          )}
          {status !== "past" && goals.length > 0 && (
            <NewGoalButton daysInMonthDefault={daysInMonth} />
          )}
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">Log out</Button>
          </form>
        </>
      )

      return (
        <>
          <MonthNavigator
            viewedMonthIso={viewedIsoDate}
            currentMonthIso={currentIsoDate}
            isNextDisabled={isNextDisabled}
            monthYearLabel={monthYearLabel}
            rightCluster={rightCluster}
          />

          {status === "past" && goals.length === 0 ? (
            <PastEmptyState
              monthYearLabel={monthYearLabel}
              currentMonthSegment={currentSegment}
            />
          ) : status === "past" ? (
            <PastMonthReadOnly goals={goals} now={now} userTz={userTz} />
          ) : goals.length === 0 && priorMonthHasGoals ? (
            // TODO (Plan 05): render <WelcomeToMonth priorMonthLabel={format(subMonths(viewedMonth, 1), 'MMMM')} monthYearLabel={monthYearLabel} />
            // For now, fall back to Phase 2 EmptyState so the route is usable for MNAV-01/MNAV-02/GOAL-05 verification.
            <EmptyState
              monthYearLabel={monthYearLabel}
              createButtonSlot={<NewGoalButton daysInMonthDefault={daysInMonth} />}
            />
          ) : goals.length === 0 ? (
            <EmptyState
              monthYearLabel={monthYearLabel}
              createButtonSlot={<NewGoalButton daysInMonthDefault={daysInMonth} />}
            />
          ) : (
            <DashboardShell
              initialGoals={goals}
              userTz={userTz}
              nowIso={now.toISOString()}
              daysInMonthDefault={daysInMonth}
              monthContext={status === "future" ? "future" : "current"}
            />
          )}

          {/* TODO (Plan 05): when status !== 'future', render <ReflectionCard month={viewedMonth} initial={reflection} monthYearLabel={monthYearLabel} /> */}
        </>
      )
    }
    ```

    Development verification steps:
    1. `npm run build` — confirm the route compiles (Next 16 async params shape)
    2. Local dev: navigate to `/dashboard` → verify 302 → `/dashboard/2026-04`
    3. Navigate to `/dashboard/2026-03` → past-month render (no goals → PastEmptyState; with goals → frozen cards)
    4. Navigate to `/dashboard/2026-05` → future-month render (if current is April 2026, May is allowed)
    5. Navigate to `/dashboard/2026-06` → 404 (past cap)
    6. Navigate to `/dashboard/abc` → 404
    7. Navigate to `/dashboard/2026-13` → 404
    8. Press ← / → on the dashboard → URL changes; respects next-cap.
  </action>

  <verify>
    <automated>npm run build 2>&1 | tail -30</automated>
  </verify>

  <acceptance_criteria>
    - `src/app/(protected)/dashboard/[month]/page.tsx` exists
    - `grep -n "params: Promise<{ month: string }>" src/app/\(protected\)/dashboard/\[month\]/page.tsx` returns a match (Next 16 async params)
    - `grep -n "const { month: segment } = await params" src/app/\(protected\)/dashboard/\[month\]/page.tsx` returns a match
    - `grep -n "monthSegmentSchema.safeParse" src/app/\(protected\)/dashboard/\[month\]/page.tsx` returns a match
    - `grep -n "notFound()" src/app/\(protected\)/dashboard/\[month\]/page.tsx` returns at least TWO matches (bad segment + future-cap)
    - `grep -n "compareMonth(viewedMonth, currentMonth)" src/app/\(protected\)/dashboard/\[month\]/page.tsx` returns a match
    - `grep -n "isSameMonth(viewedMonth, nextAllowed)" src/app/\(protected\)/dashboard/\[month\]/page.tsx` returns a match (D-06 cap)
    - `grep -n "PastEmptyState\|PastMonthReadOnly\|MonthNavigator\|DashboardShell\|EmptyState" src/app/\(protected\)/dashboard/\[month\]/page.tsx` returns matches for all five components
    - `grep -n "TODO (Plan 05)" src/app/\(protected\)/dashboard/\[month\]/page.tsx` returns at least two matches (WelcomeToMonth + ReflectionCard stubs flagged)
    - `npm run build` exits 0
  </acceptance_criteria>

  <done>
    Route builds. 404s fire on invalid segments + future cap. Five-way branching render compiles and runs. Two explicit TODO markers for Plan 05 (WelcomeToMonth + ReflectionCard).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → route page | URL segment `[month]` is untrusted user input; arbitrary bytes could arrive |
| route page → getMonthDashboard | userId comes from authenticated session; month is server-derived from segment + Zod-validated |
| client-side useRouter push | ← / → keystrokes produce internal navigations; disabled-next state must be respected |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-12 | Tampering | `[month]` URL segment (SQLi, XSS, DoS) | mitigate | `monthSegmentSchema` regex + refine guards BEFORE parse; Drizzle parameterized queries never string-concat. |
| T-03-13 | Tampering | Keyboard Enter on disabled next-arrow bypasses `pointer-events: none` (Pitfall 6) | mitigate | Disabled branch renders `<Button disabled>` (not a Link), AND keyboard handler in MonthNavigator checks `!isNextDisabled` before router.push. |
| T-03-14 | Information Disclosure | Past-month goal list visible to another user via URL | mitigate | Existing Phase 1/2 RLS on goals + service-layer user.id check; untouched. |
| T-03-15 | Tampering | Past-month mutation via replayed request (UI absence not enforcement) | mitigate | Plan 02 service-layer ReadOnlyMonthError is the authority. This plan's UI absence is defense in depth only. |
| T-03-16 | Denial of Service | Navigation to far-future month (e.g. /dashboard/9999-12) overloads query | mitigate | Future cap `isSameMonth(viewedMonth, addMonths(currentMonth, 1))` returns 404 before the DB query runs. |
</threat_model>

<verification>
- `npm run build` succeeds
- Manual: `/dashboard` → 302 → `/dashboard/[current-month]`
- Manual: `/dashboard/[current-month]` renders with MonthNavigator + existing Phase 2 dashboard content
- Manual: `/dashboard/[past-month]` renders PastMonthReadOnly (or PastEmptyState if empty); no kebab, no stepper, no checkbox click
- Manual: `/dashboard/[next-month]` renders with progress affordances disabled + hint tooltip; create/edit/delete enabled
- Manual: `/dashboard/[month-beyond-next]` → 404
- Manual: `/dashboard/abc` → 404
- Manual: ← / → keyboard shortcuts navigate months; ignored when focus is in input/textarea
- `npx vitest run` — no regression on Phase 2 current-month tests
</verification>

<success_criteria>
- `/dashboard` redirect → canonical month URL
- `/dashboard/[month]` dynamic route branches correctly across five render shapes
- Past-month UI is fully frozen (no kebab, no handlers, no PaceChip) — D-12/13/14/15 honored
- Future-month UI is fully mutable for goal CRUD (D-09) but progress-disabled (D-11)
- Keyboard ← / → works respecting focus + next-cap
- `npm run build` succeeds; full test suite green
</success_criteria>

<output>
After completion, create `.planning/phases/03-month-navigation-history-reflection/03-04-SUMMARY.md` capturing:
- Exact `progressDisabled` prop threading chain (which files got it)
- Any Motion/ProgressBar tweak made (expected: none — Phase 2 ProgressBar is idempotent)
- Screenshot paths if manual UAT captured visual freeze confirmation
- Two explicit TODO markers referenced for Plan 05 wiring (WelcomeToMonth + ReflectionCard)
- Phase 2 regression-test status: confirm current-month dashboard behavior preserved
</output>
