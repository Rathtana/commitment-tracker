---
phase: 03-month-navigation-history-reflection
plan: 5
type: execute
wave: 3
depends_on: [1, 2, 3, 4]
files_modified:
  - src/components/ui/textarea.tsx
  - src/components/welcome-to-month.tsx
  - src/components/reflection-card.tsx
  - src/server/services/goals.ts
  - src/server/actions/goals.ts
  - src/app/(protected)/dashboard/[month]/page.tsx
  - tests/actions.copyGoals.test.ts
autonomous: false
requirements: [MNAV-03, MNAV-04, POLSH-04, GOAL-05]
tags: [ui, server-action, uat]

must_haves:
  truths:
    - "shadcn Textarea primitive installed at src/components/ui/textarea.tsx"
    - "WelcomeToMonth renders on current or next-month routes when goals.length === 0 AND priorMonthHasGoals === true (D-18)"
    - "'Copy from last month' click invokes copyGoalsFromLastMonthAction (zero-arg); on success, page revalidates and new goal cards render in place of Welcome"
    - "'Start fresh' click dismisses WelcomeToMonth for the page session via React state (D-20); falls back to Phase 2 EmptyState"
    - "copyGoalsFromLastMonth server action takes ZERO month params; server derives toMonth = monthBucket(now, userTz) and fromMonth = toMonth - 1 month (D-21)"
    - "Copy is idempotent: if target month already has >= 1 goal, the transaction aborts and returns {copiedCount: 0, alreadyHadGoals: true} (D-23)"
    - "Copy transfers shells only: count currentCount=0, checklist tasks.isDone=false, habit_check_ins not copied, progress_entries not copied (D-21)"
    - "Habit target_days clamped to getDaysInMonth(toMonth) when source target_days > daysInMonth (D-22)"
    - "ReflectionCard renders on current + past months, NOT on future months (D-27, D-28)"
    - "ReflectionCard has two 280-char textareas with live counter (muted -> warning-amber at 250 -> destructive at 280)"
    - "ReflectionCard autosaves on blur OR after 800ms idle, showing 'Saved' indicator on success; inline Alert on failure"
    - "Past-month mutation attempt via curl/replay still returns ReadOnlyMonthError with 'This month is archived.' (Plan 02 enforcement verified via end-to-end UAT)"
  artifacts:
    - path: "src/components/ui/textarea.tsx"
      provides: "shadcn Textarea primitive (npx shadcn@latest add textarea)"
      contains: "Textarea"
    - path: "src/components/welcome-to-month.tsx"
      provides: "'use client' Welcome card - Copy/Fresh buttons, loading/error states, Start-fresh dismiss"
      contains: "use client"
    - path: "src/components/reflection-card.tsx"
      provides: "'use client' two-textarea card - RHF + zodResolver + debounced autosave + char counter + Saved indicator"
      contains: "upsertReflectionAction"
    - path: "src/server/services/goals.ts"
      provides: "Appends copyGoalsFromLastMonth transaction (shells-only, idempotent, clamped target_days)"
      exports: ["copyGoalsFromLastMonth"]
    - path: "src/server/actions/goals.ts"
      provides: "Appends copyGoalsFromLastMonthAction (zero-arg)"
      exports: ["copyGoalsFromLastMonthAction"]
    - path: "tests/actions.copyGoals.test.ts"
      provides: "Vitest suite: shells-only copy, idempotency guard, target_days clamp"
      contains: "describe"
  key_links:
    - from: "src/components/welcome-to-month.tsx"
      to: "src/server/actions/goals.ts"
      via: "import { copyGoalsFromLastMonthAction } + useTransition + revalidated route"
      pattern: "copyGoalsFromLastMonthAction"
    - from: "src/components/reflection-card.tsx"
      to: "src/server/actions/reflections.ts"
      via: "import { upsertReflectionAction } + setTimeout debounce + onBlur"
      pattern: "upsertReflectionAction"
    - from: "src/app/(protected)/dashboard/[month]/page.tsx"
      to: "src/components/welcome-to-month.tsx"
      via: "conditional render when goals.length===0 && priorMonthHasGoals"
      pattern: "WelcomeToMonth"
    - from: "src/app/(protected)/dashboard/[month]/page.tsx"
      to: "src/components/reflection-card.tsx"
      via: "render when status !== future; hydrate from getReflectionForMonth"
      pattern: "ReflectionCard"
---

<objective>
Finish Phase 3 by delivering the three remaining UI surfaces and the copy-from-last-month action: install shadcn Textarea, add `copyGoalsFromLastMonth` service + action, build `WelcomeToMonth` and `ReflectionCard` client components, wire both into the route page (replacing the Plan 04 TODO stubs), and run full-phase manual UAT.

Purpose: MNAV-03 (Copy-from-last-month) + MNAV-04 (Welcome trigger on month transitions) + POLSH-04 (Reflection field). Also closes GOAL-05 end-to-end by enabling future-month pre-planning via the same Welcome card when navigated forward.
Output: One shadcn install, one new service function + action, two client components, two route-page wirings, one dedicated test file, and human UAT sign-off.
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
<!-- Contracts this plan consumes -->

From Plan 01:
```typescript
// src/lib/schemas/reflections.ts
export const reflectionFormSchema: z.ZodSchema  // raw strings, for RHF
export const upsertReflectionSchema: z.ZodSchema // transform empty to null
export type ReflectionFormInput = { whatWorked: string; whatDidnt: string }
export type UpsertReflectionInput = { month: string; whatWorked: string | null; whatDidnt: string | null }
```

From Plan 03:
```typescript
// src/server/actions/reflections.ts
export async function upsertReflectionAction(input: UpsertReflectionInput): Promise<ActionResult<{ savedAt: string }>>
// src/server/db/queries.ts
export async function getReflectionForMonth(userId, month): Promise<{whatWorked, whatDidnt} | null>
export async function countGoalsInMonth(userId, month): Promise<number>
```

From Phase 2 (src/server/services/goals.ts) - existing pattern to copy for the new copyGoalsFromLastMonth:
```typescript
export async function createGoal(userId: string, userTz: string, input: CreateGoalInput) {
  const month = monthBucket(new Date(), userTz)  // server-derived
  return db.transaction(async (tx) => { ... tx.insert(goals).values({...}).returning() ... })
}
```

From Phase 2 (src/server/db/schema.ts):
```typescript
export const goals: PgTable      // columns: id, userId, month, title, type, position, targetCount, currentCount, targetDays
export const tasks: PgTable      // columns: id, goalId, label, isDone, position
// habit_check_ins: NOT copied per D-21
// progress_entries: NOT copied per D-21
```

From Plan 04 (route page TODO markers):
```
// TODO (Plan 05): render <WelcomeToMonth ... /> when goals.length===0 && priorMonthHasGoals
// TODO (Plan 05): render <ReflectionCard ... /> when status !== future
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install shadcn Textarea + add copyGoalsFromLastMonth service + copyGoalsFromLastMonthAction + tests</name>
  <files>src/components/ui/textarea.tsx, src/server/services/goals.ts, src/server/actions/goals.ts, tests/actions.copyGoals.test.ts</files>

  <read_first>
    - /Users/rathtana.duong/gsd-tutorial/src/components/ui/ (existing shadcn primitives for style reference)
    - /Users/rathtana.duong/gsd-tutorial/src/server/services/goals.ts (post-Plan-02: already has ReadOnlyMonthError on updateGoal/deleteGoal; createGoal is the transaction + month-derivation analog)
    - /Users/rathtana.duong/gsd-tutorial/src/server/actions/goals.ts (createGoalAction is the action-shape analog; resolveUserTz helper defined)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-RESEARCH.md §Pattern 6 (full copyGoalsFromLastMonth implementation lines 591-648 - copy verbatim)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-CONTEXT.md D-21, D-22, D-23 (semantics lock)
    - /Users/rathtana.duong/gsd-tutorial/tests/actions.goals.test.ts (mock-Supabase + mock-db fixture pattern to replicate)
  </read_first>

  <action>
    Step 1 - Install shadcn Textarea:
    ```bash
    npx shadcn@latest add textarea
    ```
    This creates `src/components/ui/textarea.tsx`. No other config changes.

    Step 2 - Append to `src/server/services/goals.ts` (after the existing exports):

    ```typescript
    import { subMonths, getDaysInMonth } from "date-fns"
    import { sql, and, eq } from "drizzle-orm"  // ensure already imported; add sql if missing

    /**
     * D-21: Copy goals from the prior month into the target month (server-derived).
     * Shells only: count currentCount=0, checklist tasks.isDone=false,
     * habit_check_ins NOT copied, progress_entries NOT copied.
     * D-22: Clamp target_days to getDaysInMonth(toMonth) when source > destination days.
     * D-23: Idempotent - abort if target month already has goals.
     */
    export async function copyGoalsFromLastMonth(
      userId: string,
      userTz: string,
    ): Promise<{ copiedCount: number; alreadyHadGoals: boolean }> {
      const now = new Date()
      const toMonth = monthBucket(now, userTz)
      const fromMonth = subMonths(toMonth, 1)
      const toMonthStr = toMonth.toISOString().slice(0, 10)
      const fromMonthStr = fromMonth.toISOString().slice(0, 10)
      const daysInToMonth = getDaysInMonth(toMonth)

      return db.transaction(async (tx) => {
        // D-23 idempotency guard inside the transaction
        const existing = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(goals)
          .where(and(eq(goals.userId, userId), eq(goals.month, toMonthStr)))
        if ((existing[0]?.count ?? 0) > 0) {
          return { copiedCount: 0, alreadyHadGoals: true }
        }

        const sources = await tx
          .select()
          .from(goals)
          .where(and(eq(goals.userId, userId), eq(goals.month, fromMonthStr)))
          .orderBy(goals.position, goals.createdAt)

        if (sources.length === 0) {
          return { copiedCount: 0, alreadyHadGoals: false }
        }

        let copied = 0
        for (const src of sources) {
          const clampedTargetDays =
            src.type === "habit" && src.targetDays != null && src.targetDays > daysInToMonth
              ? daysInToMonth
              : src.targetDays

          const [newGoal] = await tx
            .insert(goals)
            .values({
              userId,
              month: toMonthStr,
              title: src.title,
              type: src.type,
              position: src.position,
              targetCount: src.type === "count" ? src.targetCount : null,
              currentCount: src.type === "count" ? 0 : null,
              targetDays: src.type === "habit" ? clampedTargetDays : null,
            })
            .returning()

          if (src.type === "checklist") {
            const sourceTasks = await tx
              .select()
              .from(tasks)
              .where(eq(tasks.goalId, src.id))
              .orderBy(tasks.position, tasks.createdAt)
            if (sourceTasks.length > 0) {
              await tx.insert(tasks).values(
                sourceTasks.map((t) => ({
                  goalId: newGoal.id,
                  label: t.label,
                  position: t.position,
                  isDone: false,
                  doneAt: null,
                })),
              )
            }
          }
          // habit_check_ins + progress_entries INTENTIONALLY not copied (D-21)
          copied++
        }
        return { copiedCount: copied, alreadyHadGoals: false }
      })
    }
    ```

    Step 3 - Append to `src/server/actions/goals.ts`:

    ```typescript
    import { copyGoalsFromLastMonth } from "@/server/services/goals"

    export async function copyGoalsFromLastMonthAction(): Promise<
      ActionResult<{ copiedCount: number; alreadyHadGoals: boolean }>
    > {
      const supabase = await getSupabaseServerClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { ok: false, error: "Not authenticated." }
      const userTz = await resolveUserTz(user.id)
      try {
        const result = await copyGoalsFromLastMonth(user.id, userTz)
        revalidatePath("/dashboard", "layout")
        return { ok: true, data: result }
      } catch {
        return { ok: false, error: "Couldn't copy last month's goals. Please try again." }
      }
    }
    ```

    The signature is `()` - ZERO arguments. Server derives months. Closes Pitfall 3 (client-supplied month tampering).

    Step 4 - Create `tests/actions.copyGoals.test.ts` with at least 6 cases:
    - Test 1 - Shells-only: prior month has 3 goals (1 count target=5, 1 checklist with 3 tasks, 1 habit target_days=20). After action, target month has 3 goals with currentCount=0, 3 tasks all isDone=false, habit target_days=20, zero habit_check_ins, zero progress_entries.
    - Test 2 - Empty prior month: prior month has no goals -> returns `{copiedCount: 0, alreadyHadGoals: false}`.
    - Test 3 - Idempotency: target month already has 1 goal -> returns `{copiedCount: 0, alreadyHadGoals: true}` (no new rows inserted).
    - Test 4 - Clamp-yes: source habit target_days=31, toMonth has 30 days -> new goal target_days=30.
    - Test 5 - Clamp-no: source habit target_days=20, toMonth has 30 days -> new goal target_days=20.
    - Test 6 - Unauthenticated -> `{ok: false, error: "Not authenticated."}`.

    Reuse the mock-Supabase + mock-db pattern from `tests/actions.goals.test.ts`.
  </action>

  <verify>
    <automated>npx vitest run tests/actions.copyGoals.test.ts</automated>
  </verify>

  <acceptance_criteria>
    - `src/components/ui/textarea.tsx` exists (shadcn install succeeded)
    - `grep -n "export async function copyGoalsFromLastMonth" src/server/services/goals.ts` returns a match
    - `grep -n "alreadyHadGoals: true" src/server/services/goals.ts` returns a match (idempotency return shape)
    - `grep -n "getDaysInMonth(toMonth)" src/server/services/goals.ts` returns a match (D-22 clamp)
    - `grep -n "currentCount: src.type === \"count\" ? 0 : null" src/server/services/goals.ts` returns a match (shells-only D-21)
    - `grep -n "isDone: false" src/server/services/goals.ts` returns a match (checklist shells-only)
    - `grep -n "export async function copyGoalsFromLastMonthAction()" src/server/actions/goals.ts` returns a match (ZERO args, closes Pitfall 3)
    - `grep -n "monthBucket(new Date(), userTz)" src/server/services/goals.ts` - at least one match in the new function (server-derived toMonth)
    - `tests/actions.copyGoals.test.ts` exists with at least 6 test cases
    - `npx vitest run tests/actions.copyGoals.test.ts` exits 0
  </acceptance_criteria>

  <done>
    Textarea primitive installed. copyGoalsFromLastMonth service + action live with server-derived months, idempotency, target_days clamp, shells-only transfer. Tests lock the contract.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create WelcomeToMonth client component</name>
  <files>src/components/welcome-to-month.tsx</files>

  <read_first>
    - /Users/rathtana.duong/gsd-tutorial/src/components/create-goal-dialog.tsx lines 100-120 (server-action invocation + Loader2 loading + inline Alert error pattern)
    - /Users/rathtana.duong/gsd-tutorial/src/components/empty-state.tsx (Card primitive composition reference)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-UI-SPEC.md §WelcomeToMonth Layout (lines 525-535) + §WelcomeToMonth Card Interactive Behavior
  </read_first>

  <action>
    Create `src/components/welcome-to-month.tsx`:

    ```typescript
    'use client'

    import { useState, useTransition, type ReactNode } from 'react'
    import { Loader2 } from 'lucide-react'
    import { Alert, AlertDescription } from '@/components/ui/alert'
    import { Button } from '@/components/ui/button'
    import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
    import { copyGoalsFromLastMonthAction } from '@/server/actions/goals'

    interface Props {
      monthYearLabel: string       // "April 2026"
      priorMonthLabel: string      // "March"
      fallbackSlot: ReactNode      // Phase 2 EmptyState to show when user chooses "Start fresh"
    }

    export function WelcomeToMonth({ monthYearLabel, priorMonthLabel, fallbackSlot }: Props) {
      const [isPending, startTransition] = useTransition()
      const [error, setError] = useState<string | null>(null)
      const [startedFresh, setStartedFresh] = useState(false)

      if (startedFresh) {
        // D-20: dismissed for the page session via React state; no DB flag, no sessionStorage
        return <>{fallbackSlot}</>
      }

      function onCopyClick() {
        setError(null)
        startTransition(async () => {
          const result = await copyGoalsFromLastMonthAction()
          if (!result.ok) {
            setError(result.error)
          }
          // On success, Next.js revalidates the route; new goal cards render where the Welcome used to be.
        })
      }

      return (
        <Card className="p-6">
          <CardHeader className="p-0 pb-4 space-y-2">
            <CardTitle className="text-2xl font-semibold">Welcome to {monthYearLabel}.</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Carry forward from {priorMonthLabel} or start fresh?
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant="default"
                disabled={isPending}
                onClick={onCopyClick}
                className="min-h-11"
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Copy from last month'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setStartedFresh(true)}
                className="min-h-11"
              >
                Start fresh
              </Button>
            </div>
            {error && (
              <Alert variant="destructive" aria-live="polite">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )
    }
    ```

    Adherence notes:
    - Error copy "Couldn't copy last month's goals. Please try again." comes from Task 1 action's error-path return; UI displays `result.error` directly. UI-SPEC verbatim.
    - On success, NO explicit dismiss - the Welcome trigger in the route page becomes false because goals exist now; `revalidatePath` re-renders the shell; WelcomeToMonth unmounts naturally.
    - "Start fresh" uses simple React state per D-20 - no persistence, page-session memory only.
    - Buttons stack vertically on xs, side-by-side on sm+ (per UI-SPEC layout).
  </action>

  <verify>
    <automated>npx tsc --noEmit -p .</automated>
  </verify>

  <acceptance_criteria>
    - `src/components/welcome-to-month.tsx` starts with `'use client'`
    - `grep -n "Welcome to " src/components/welcome-to-month.tsx` returns a match
    - `grep -n "Carry forward from" src/components/welcome-to-month.tsx` returns a match (UI-SPEC copy)
    - `grep -n "Copy from last month" src/components/welcome-to-month.tsx` returns a match
    - `grep -n "Start fresh" src/components/welcome-to-month.tsx` returns a match
    - `grep -n "copyGoalsFromLastMonthAction" src/components/welcome-to-month.tsx` returns a match
    - `grep -n "useTransition" src/components/welcome-to-month.tsx` returns a match
    - `grep -n "Loader2" src/components/welcome-to-month.tsx` returns a match (loading spinner)
    - `grep -n "setStartedFresh" src/components/welcome-to-month.tsx` returns a match (D-20 React-state dismiss)
    - `grep -n "fallbackSlot" src/components/welcome-to-month.tsx` returns a match (EmptyState prop pipe-through)
    - `npx tsc --noEmit -p .` exits 0
  </acceptance_criteria>

  <done>
    WelcomeToMonth ships with primary Copy button (invokes zero-arg action), secondary Start-fresh button (React-state dismiss rendering fallback EmptyState slot), inline Alert on error, Loader2 loading. UI-SPEC copy verbatim.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create ReflectionCard client component with RHF + debounced autosave + char counter</name>
  <files>src/components/reflection-card.tsx</files>

  <read_first>
    - /Users/rathtana.duong/gsd-tutorial/src/components/create-goal-dialog.tsx (RHF + zodResolver setup pattern)
    - /Users/rathtana.duong/gsd-tutorial/src/components/earlier-day-popover.tsx lines 29-38 (useEffect + local state pattern)
    - /Users/rathtana.duong/gsd-tutorial/src/components/ui/textarea.tsx (just installed)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-RESEARCH.md §Pattern 8 (debounced-autosave snippet lines 746-814)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-UI-SPEC.md §ReflectionCard Layout (lines 562-595) + §ReflectionCard Interaction Contract
  </read_first>

  <action>
    Create `src/components/reflection-card.tsx`:

    ```typescript
    'use client'

    import { useEffect, useRef, useState, useTransition } from 'react'
    import { useForm } from 'react-hook-form'
    import { zodResolver } from '@hookform/resolvers/zod'
    import { PenLine } from 'lucide-react'
    import { Alert, AlertDescription } from '@/components/ui/alert'
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
    import { Label } from '@/components/ui/label'
    import { Textarea } from '@/components/ui/textarea'
    import { cn } from '@/lib/utils'
    import {
      reflectionFormSchema,
      type ReflectionFormInput,
    } from '@/lib/schemas/reflections'
    import { upsertReflectionAction } from '@/server/actions/reflections'

    const DEBOUNCE_MS = 800

    interface Props {
      monthIsoDate: string     // "YYYY-MM-DD" first-of-month
      monthYearLabel: string   // "April 2026"
      initial: { whatWorked: string | null; whatDidnt: string | null } | null
    }

    function counterClass(n: number): string {
      if (n >= 280) return 'text-destructive'
      if (n >= 250) return 'text-warning-foreground bg-warning-muted inline-block rounded px-1'
      return 'text-muted-foreground'
    }

    export function ReflectionCard({ monthIsoDate, monthYearLabel, initial }: Props) {
      const form = useForm<ReflectionFormInput>({
        resolver: zodResolver(reflectionFormSchema),
        defaultValues: {
          whatWorked: initial?.whatWorked ?? '',
          whatDidnt: initial?.whatDidnt ?? '',
        },
      })
      const { register, watch } = form
      const [isPending, startTransition] = useTransition()
      const [savedAt, setSavedAt] = useState<number | null>(null)
      const [saveError, setSaveError] = useState<string | null>(null)
      const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
      const isMountedRef = useRef(false)

      const ww = watch('whatWorked')
      const wd = watch('whatDidnt')

      function save() {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        startTransition(async () => {
          const result = await upsertReflectionAction({
            month: monthIsoDate,
            whatWorked: ww,
            whatDidnt: wd,
          })
          if (result.ok) {
            const stamp = Date.now()
            setSavedAt(stamp)
            setSaveError(null)
            setTimeout(() => {
              setSavedAt((current) => (current === stamp ? null : current))
            }, 1500)
          } else {
            setSaveError(result.error)
          }
        })
      }

      // Debounced autosave - skip the initial mount to avoid harmless empty-null UPSERT on page load.
      useEffect(() => {
        if (!isMountedRef.current) {
          isMountedRef.current = true
          return
        }
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => save(), DEBOUNCE_MS)
        return () => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [ww, wd])

      const onBlur = () => save()

      return (
        <Card className="p-6">
          <CardHeader className="p-0 pb-4">
            <div className="flex items-center gap-2">
              <PenLine className="size-4 text-muted-foreground" />
              <CardTitle className="text-2xl font-semibold">Reflection &mdash; {monthYearLabel}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="what-worked">What worked</Label>
              <Textarea
                id="what-worked"
                maxLength={280}
                className="min-h-[88px] max-h-[240px] resize-none"
                placeholder="One thing that went right this month..."
                {...register('whatWorked', { onBlur })}
              />
              <div className="flex items-center justify-end">
                <span
                  aria-live="polite"
                  aria-atomic="true"
                  className={cn('text-xs tabular-nums', counterClass(ww.length))}
                >
                  {ww.length}/280
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="what-didnt">What didn&apos;t</Label>
              <Textarea
                id="what-didnt"
                maxLength={280}
                className="min-h-[88px] max-h-[240px] resize-none"
                placeholder="One thing to change next month..."
                {...register('whatDidnt', { onBlur })}
              />
              <div className="flex items-center justify-end">
                <span
                  aria-live="polite"
                  aria-atomic="true"
                  className={cn('text-xs tabular-nums', counterClass(wd.length))}
                >
                  {wd.length}/280
                </span>
              </div>
            </div>

            {saveError && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{saveError}</AlertDescription>
              </Alert>
            )}

            <div className="h-5 flex items-center justify-end">
              <span
                aria-live="polite"
                className={cn(
                  'text-sm font-semibold text-success-foreground motion-safe:transition-opacity motion-safe:duration-1000',
                  savedAt ? 'opacity-100' : 'opacity-0',
                )}
              >
                Saved
              </span>
            </div>
          </CardContent>
        </Card>
      )
    }
    ```

    Adherence points:
    - `maxLength={280}` is UX only; server Zod enforces (Pitfall 8).
    - Counter color: muted when < 250, warning-amber 250-279, destructive at 280. UI-SPEC locked.
    - "Saved" indicator reuses Phase 2 `--color-success-*` tokens; Tailwind `motion-safe:*` - instant on `prefers-reduced-motion: reduce`.
    - No autofocus (UI-SPEC - autofocus would steal from dashboard scan).
    - Future-month guard is in the ROUTE PAGE (D-28); this component does not gate by month. Server action has defense-in-depth too (Plan 03 Task 4).
    - D-27: editable on past AND current - component does not gate; route page renders it for both.
  </action>

  <verify>
    <automated>npx tsc --noEmit -p .</automated>
  </verify>

  <acceptance_criteria>
    - `src/components/reflection-card.tsx` starts with `'use client'`
    - `grep -n "Reflection " src/components/reflection-card.tsx` returns a match (title)
    - `grep -n "What worked" src/components/reflection-card.tsx` returns a match
    - `grep -n "What didn" src/components/reflection-card.tsx` returns a match
    - `grep -n "maxLength={280}" src/components/reflection-card.tsx` returns at least two matches
    - `grep -n "PenLine" src/components/reflection-card.tsx` returns a match (icon prefix)
    - `grep -n "DEBOUNCE_MS = 800" src/components/reflection-card.tsx` returns a match
    - `grep -n "text-destructive" src/components/reflection-card.tsx` returns a match (counter 280)
    - `grep -n "text-warning-foreground" src/components/reflection-card.tsx` returns a match (counter 250-279)
    - `grep -n "upsertReflectionAction" src/components/reflection-card.tsx` returns a match
    - `grep -n "onBlur" src/components/reflection-card.tsx` returns a match (blur-flush per D-29)
    - `grep -n "setTimeout" src/components/reflection-card.tsx` returns at least two matches (debounce + Saved fade)
    - `grep -n "autoFocus\|autofocus" src/components/reflection-card.tsx` returns zero matches (UI-SPEC: no autofocus)
    - `npx tsc --noEmit -p .` exits 0
  </acceptance_criteria>

  <done>
    ReflectionCard renders two 280-char textareas with live counter color-shifts, debounced autosave (blur + 800ms idle), Saved indicator fade, inline Alert on failure. No autofocus. UI-SPEC copy verbatim.
  </done>
</task>

<task type="auto">
  <name>Task 4: Wire WelcomeToMonth + ReflectionCard into [month]/page.tsx (replace Plan 04 TODO stubs)</name>
  <files>src/app/(protected)/dashboard/[month]/page.tsx</files>

  <read_first>
    - /Users/rathtana.duong/gsd-tutorial/src/app/(protected)/dashboard/[month]/page.tsx (Plan 04 output - locate both "TODO (Plan 05)" comment markers)
    - /Users/rathtana.duong/gsd-tutorial/src/components/welcome-to-month.tsx (Task 2 - Props signature)
    - /Users/rathtana.duong/gsd-tutorial/src/components/reflection-card.tsx (Task 3 - Props signature)
    - /Users/rathtana.duong/gsd-tutorial/src/server/db/queries.ts (getReflectionForMonth - Plan 03)
  </read_first>

  <action>
    Step 1 - Add imports at the top of `[month]/page.tsx`:
    ```typescript
    import { WelcomeToMonth } from "@/components/welcome-to-month"
    import { ReflectionCard } from "@/components/reflection-card"
    import { getReflectionForMonth } from "@/server/db/queries"
    import { subMonths } from "date-fns"  // add if not already imported from Plan 04
    ```

    Step 2 - Fetch reflection data BEFORE the return JSX (add right after the existing goals + priorMonthHasGoals queries):
    ```typescript
    const reflection = status !== "future"
      ? await getReflectionForMonth(user.id, viewedMonth)
      : null
    ```

    Step 3 - Replace the first TODO marker (the `goals.length === 0 && priorMonthHasGoals` branch which Plan 04 left as a fallback EmptyState) with a WelcomeToMonth render:

    ```typescript
    ) : goals.length === 0 && priorMonthHasGoals ? (
      <WelcomeToMonth
        monthYearLabel={monthYearLabel}
        priorMonthLabel={format(subMonths(viewedMonth, 1), "MMMM")}
        fallbackSlot={
          <EmptyState
            monthYearLabel={monthYearLabel}
            createButtonSlot={<NewGoalButton daysInMonthDefault={daysInMonth} />}
          />
        }
      />
    ) : goals.length === 0 ? (
    ```

    Step 4 - Replace the second TODO marker (after the goal-list render block, before the closing fragment) with a conditional ReflectionCard:

    ```typescript
    {status !== "future" && (
      <ReflectionCard
        monthIsoDate={viewedIsoDate}
        monthYearLabel={monthYearLabel}
        initial={reflection}
      />
    )}
    ```

    Step 5 - Delete both `TODO (Plan 05)` comment lines entirely. Neither TODO marker should remain in the final file.

    Step 6 - Verify build + manual smoke:
    ```bash
    npm run build
    npm run dev
    ```
    Manual nav checklist:
    - `/dashboard/[current-month]` + prior-month has goals + current has zero -> WelcomeToMonth renders
    - `/dashboard/[current-month]` + prior-month has zero + current has zero -> Phase 2 EmptyState (no Welcome)
    - `/dashboard/[current-month]` + goals -> DashboardShell + ReflectionCard at bottom
    - `/dashboard/[past-month]` + goals -> PastMonthReadOnly + ReflectionCard at bottom (D-27 editable on past)
    - `/dashboard/[next-month]` -> DashboardShell progress-disabled; NO ReflectionCard (D-28)
  </action>

  <verify>
    <automated>npm run build</automated>
  </verify>

  <acceptance_criteria>
    - `grep -n "WelcomeToMonth" src/app/\(protected\)/dashboard/\[month\]/page.tsx` returns a match
    - `grep -n "ReflectionCard" src/app/\(protected\)/dashboard/\[month\]/page.tsx` returns a match
    - `grep -n "getReflectionForMonth" src/app/\(protected\)/dashboard/\[month\]/page.tsx` returns a match
    - `grep -n "TODO (Plan 05)" src/app/\(protected\)/dashboard/\[month\]/page.tsx` returns zero matches
    - `grep -n "status !== \"future\"" src/app/\(protected\)/dashboard/\[month\]/page.tsx` returns at least one match (Reflection future-gate)
    - `grep -n "fallbackSlot={" src/app/\(protected\)/dashboard/\[month\]/page.tsx` returns a match
    - `grep -n "priorMonthLabel={format(subMonths" src/app/\(protected\)/dashboard/\[month\]/page.tsx` returns a match
    - `npm run build` exits 0
  </acceptance_criteria>

  <done>
    Both Plan 04 TODO markers are removed. Route page mounts WelcomeToMonth and ReflectionCard at the correct conditional sites. Build succeeds.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: Full-phase manual UAT checkpoint (MNAV-01..04, GOAL-05, POLSH-04, past-month read-only 403)</name>
  <files>src/app/(protected)/dashboard/[month]/page.tsx, src/components/welcome-to-month.tsx, src/components/reflection-card.tsx, src/components/month-navigator.tsx, src/components/past-month-read-only.tsx, src/components/past-empty-state.tsx, src/server/services/goals.ts, src/server/services/progress.ts, src/server/actions/reflections.ts</files>

  <read_first>
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-CONTEXT.md (D-01..D-30 in full before UAT)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-UI-SPEC.md §Visual Regression Guardrails (lines 672-684)
    - /Users/rathtana.duong/gsd-tutorial/.planning/ROADMAP.md §Phase 3 Success Criteria (items 1-5)
  </read_first>

  <action>
    This task is a human-gated verification checkpoint. The developer follows the itemized 27-step UAT script in the <how-to-verify> block below. No code changes are authored during this task — it exists to confirm that the Phase 3 product behavior matches CONTEXT/UI-SPEC/ROADMAP before handing off to /gsd-verify-work.

    Execute exactly the steps in <how-to-verify> in order. If any step fails, STOP and log the failure in the SUMMARY file instead of typing "approved"; spawn a follow-up plan to close the gap before declaring Phase 3 done.

    The task is "blocking" at the plan gate — downstream verification and milestone close cannot proceed until the human resume-signal is received.
  </action>

  <what-built>
    All Phase 3 code is landed across five plans:
    - Plan 01: time helpers (compareMonth, formatMonthSegment, parseMonthSegment), monthSegmentSchema, reflectionSchema
    - Plan 02: ReadOnlyMonthError service-layer enforcement on all goal + progress writes
    - Plan 03: month_reflections table + RLS + CHECK + UPSERT service/action + countGoalsInMonth + getReflectionForMonth
    - Plan 04: /dashboard -> /dashboard/[current-month] redirect, dynamic route with branching render, MonthNavigator, PastMonthReadOnly, PastEmptyState, GoalCard variant refactor
    - Plan 05: WelcomeToMonth, ReflectionCard, copyGoalsFromLastMonth service + action, route wiring

    Time to confirm end-to-end product feel before declaring Phase 3 done.
  </what-built>

  <how-to-verify>
    Run `npm run dev` and authenticate as a test user. Then verify each of the following:

    **MNAV-01 (URL-routed navigation):**
    1. Visit `/dashboard` -> browser redirects to `/dashboard/2026-04` (today is 2026-04-20; current month per user's timezone)
    2. Click `<` arrow -> URL becomes `/dashboard/2026-03`; browser back button returns to `/dashboard/2026-04`; browser forward returns to March
    3. Press keyboard `Left` on the dashboard -> URL changes (same as clicking); confirm no-op when focus is inside a textarea
    4. Click `Today` button (visible when not on current month) -> URL returns to `/dashboard/2026-04`
    5. Visit `/dashboard/abc` -> Next.js 404 page
    6. Visit `/dashboard/2026-13` -> 404
    7. Visit `/dashboard/2026-06` (three months out) -> 404 (future-cap enforced)

    **MNAV-02 (Past-month read-only, layered defense):**
    8. Navigate to `/dashboard/2026-03` with at least one prior-month goal -> PastMonthReadOnly renders; kebab menus are absent; count stepper is absent; checklist checkboxes are `disabled` with muted fill; habit grid is non-interactive; PaceChip is suppressed; habit grid miss cells are muted NOT red
    9. Open devtools -> Network -> replay a POST to /dashboard that targets a past-month goal (or use curl with the session cookie). Assert the response is `{ok: false, error: "This month is archived."}` (service-layer enforcement — closes PITFALLS line 259 acceptance test)

    **MNAV-03 (Copy-from-last-month):**
    10. With prior-month goals present and current month empty -> WelcomeToMonth renders with "Welcome to April 2026." headline + "Carry forward from March or start fresh?" body
    11. Click "Copy from last month" -> Loader2 spins -> new goal cards appear matching prior-month shells (count currentCount=0, checklist tasks unchecked, habit grid empty)
    12. Click "Copy from last month" a second time (double-click scenario) -> idempotency guard; no duplicate rows (manual verify via Supabase dashboard goal count)
    13. Click "Start fresh" (on a fresh page load with the Welcome showing) -> Welcome unmounts; Phase 2 EmptyState renders; "Add your first goal" still works

    **MNAV-04 (Welcome trigger preconditions):**
    14. Log in as a brand-new user (no prior-month goals) with zero current-month goals -> NO Welcome prompt; Phase 2 EmptyState shows
    15. Same user creates a goal -> Welcome trigger now false (goals exist); no Welcome on re-render

    **GOAL-05 (Future-month pre-planning):**
    16. Navigate to `/dashboard/2026-05` (next month) -> MonthNavigator renders; next-arrow is disabled (current+1 cap); dashboard allows creating a goal -> goal persists with month=2026-05-01; navigation back to April does not show it
    17. Attempt to increment progress on a future-month goal from the UI -> stepper is disabled with hint tooltip "Available when May starts" (D-11)

    **POLSH-04 (Reflection):**
    18. On current month, ReflectionCard is at the bottom; type in "What worked"; counter goes from 0 -> 249 (muted) -> 250 (amber) -> 280 (destructive; hard-blocks further typing via browser maxLength)
    19. Pause typing -> after ~800ms, "Saved" indicator flashes; refresh the page -> reflection content persists
    20. On past month (D-27) -> ReflectionCard still editable; same counter + autosave behavior
    21. On future month -> ReflectionCard is NOT rendered (D-28)

    **Visual regression guardrails (UI-SPEC §Visual Regression):**
    22. Past-month progress bar fill is emerald (`--color-primary`), NOT grey - confirm visually
    23. Past-month habit grid hits are emerald, misses are muted - no red anywhere in the app
    24. `grep -R "bg-destructive\|bg-red-\|×\|✗" src/components/goal-card src/components/habit-grid.tsx src/components/past-*.tsx src/components/welcome-to-month.tsx src/components/reflection-card.tsx src/components/month-navigator.tsx` returns zero matches (outside Reflection's over-280 counter which is PERMITTED)
    25. `grep -n "missed\|failed\|broken\|lost" src/components/` returns zero matches (punitive-language list)

    **Full suite:**
    26. `npx vitest run` -> green
    27. `npm run build` -> green
  </how-to-verify>

  <resume-signal>
    Type "approved" AND paste the answers to:
    - Past-month 403 check (step 9): paste the response body from the replayed request
    - Copy idempotency (step 12): paste the goal count before/after the double-click
    - Counter color shift (step 18): confirm all three bands observed
    - Visual regression grep (steps 24, 25): paste the output (expected: zero matches in forbidden locations)

    If anything failed, describe the failure so a follow-up task can fix it before phase sign-off.
  </resume-signal>

  <acceptance_criteria>
    - User types "approved" after exercising every UAT step above
    - Past-month curl/replay returns `{ok: false, error: "This month is archived."}`
    - Copy idempotency confirmed (no duplicate rows)
    - Counter color shift observed at 250 and 280 boundaries
    - No red X, no "missed N days" copy anywhere; grep commands in steps 24-25 return zero matches in forbidden locations
    - Full `npx vitest run` green; `npm run build` green
  </acceptance_criteria>

  <done>
    Full Phase 3 UAT complete. All six requirements (GOAL-05, MNAV-01, MNAV-02, MNAV-03, MNAV-04, POLSH-04) verified end-to-end including the service-layer 403 on past-month mutation attempts.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser -> copyGoalsFromLastMonthAction | Attacker could replay zero-arg action in rapid succession or with forged session |
| browser -> upsertReflectionAction | Textarea content untrusted; may exceed 280 chars via API bypass |
| WelcomeToMonth client -> server action | Loading state must disable the button during isPending to prevent double-fire |
| ReflectionCard client -> server action | Debounced autosave fires on value change; race possible with rapid onBlur |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-17 | Tampering | `copyGoalsFromLastMonthAction` with client-supplied months | mitigate | Action signature is `()` - ZERO input params; server derives `toMonth` via `monthBucket(new Date(), userTz)` (D-21). Closes Pitfall 3. |
| T-03-18 | Tampering | Rapid double-click on "Copy from last month" -> duplicate rows | mitigate | Idempotency guard inside `db.transaction` (SELECT COUNT before INSERT); `disabled={isPending}` on the Copy button closes the double-click window. Pitfall 4 addressed. |
| T-03-19 | Tampering | Reflection paste of >280 chars via API bypass | mitigate | Zod `.max(280)` in `upsertReflectionSchema` server-side (Plan 01 + Plan 03); HTML `maxLength={280}` is UX only. |
| T-03-20 | Denial of Service | Reflection autosave hammers DB every keystroke | mitigate | 800ms debounce; `onBlur` immediate flush; UNIQUE(user_id, month) makes each save a single UPSERT. |
| T-03-21 | Information Disclosure | `copyGoalsFromLastMonth` FROM another user's month | mitigate | Service function scopes both SELECT and INSERT by `userId` (authenticated session); RLS on `goals` enforces the same at the DB layer. |
| T-03-22 | Elevation of Privilege | Past-month reflection save after month-end lock (if some user intuits this) | accept | D-27 explicitly allows late reflections; unpunitive product rule. No time-based gate. |
</threat_model>

<verification>
- `npm run build` exits 0
- `npx vitest run` - full suite green (including new tests/actions.copyGoals.test.ts)
- Manual UAT: all 27 steps complete; user types "approved" with evidence
- `rg "TODO (Plan 05)" src/` returns zero matches
- `rg "bg-destructive\|bg-red-\|×\|✗" src/components/goal-card src/components/habit-grid.tsx src/components/past-*.tsx` returns zero matches
</verification>

<success_criteria>
- Textarea primitive installed; WelcomeToMonth + ReflectionCard shipped
- copyGoalsFromLastMonth service + zero-arg action delivers shells-only copy with idempotency + target_days clamp
- Route page mounts Welcome + Reflection at correct conditional sites
- Full UAT verifies all six Phase 3 requirements (GOAL-05, MNAV-01, MNAV-02, MNAV-03, MNAV-04, POLSH-04) including the past-month 403 defense
- Visual regression guardrails (emerald past-month, no red X, no punitive copy) all hold
</success_criteria>

<output>
After completion, create `.planning/phases/03-month-navigation-history-reflection/03-05-SUMMARY.md` capturing:
- UAT completion status and any issues found
- Actual behavior of the second Copy-click (expected: idempotent no-op returning `alreadyHadGoals: true`)
- Any debounce-timing tweaks made (if 800ms felt wrong in UAT, adjust within 500-1000ms range)
- Final verification output: `rg "OutOfMonthError"`, `rg "TODO (Plan 05)"`, forbidden-color grep
- Phase 3 sign-off readiness for /gsd-verify-work
</output>
