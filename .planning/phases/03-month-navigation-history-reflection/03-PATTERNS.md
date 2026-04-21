# Phase 3: Month Navigation, History & Reflection - Pattern Map

**Mapped:** 2026-04-20
**Files analyzed:** 14 (9 new, 5 modified)
**Analogs found:** 14 / 14

This map tells the planner exactly which existing Phase 1 / Phase 2 file each new or modified Phase 3 file should copy patterns from. Phase 3 is an **integration phase** — nearly every pattern already exists in the codebase; the planner's job is to cite the analog and follow it verbatim.

---

## File Classification

### New Files

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/app/(protected)/dashboard/[month]/page.tsx` | route / RSC entry | request-response | `src/app/(protected)/dashboard/page.tsx` | exact (same shape; adds `params` + branching) |
| `src/components/month-navigator.tsx` | component (client) | event-driven (router nav) | header block in `src/app/(protected)/dashboard/page.tsx` lines 31-41 + `src/components/dashboard-shell.tsx` NewGoalButton | role + keyboard pattern match |
| `src/components/welcome-to-month.tsx` | component (client) | request-response (server action) | `src/components/create-goal-dialog.tsx` (action + loading + error shape) | role-match |
| `src/components/past-empty-state.tsx` | component (RSC) | display-only | `src/components/empty-state.tsx` | exact (same primitive choice, same layout contract) |
| `src/components/reflection-card.tsx` | component (client) | request-response, debounced autosave | `src/components/create-goal-dialog.tsx` (RHF + zodResolver + ActionResult) + `src/components/earlier-day-popover.tsx` (local state + callback shape) | role-match + data-flow hybrid |
| `src/components/past-month-read-only.tsx` | component (RSC wrapper) | display-only | `src/components/dashboard-shell.tsx` lines 246-252 (the section mapping goals to GoalCard) | role-match (Shell minus optimistic) |
| `src/lib/schemas/reflections.ts` | schema (canonical Zod) | validation | `src/lib/schemas/goals.ts` | exact |
| `src/lib/schemas/month-segment.ts` (OR inline in `time.ts`) | schema (Zod regex) | validation | `src/lib/schemas/goals.ts` lines 22-23 (`isoDateField`) | exact-match helper |
| `src/server/actions/reflections.ts` | server action | request-response + DB write | `src/server/actions/progress.ts` | exact (ActionResult, auth guard, resolveUserTz, error mapping) |

### Modified Files

| Modified File | Role | Data Flow | Closest Analog (for the new work) | Match Quality |
|---------------|------|-----------|-----------------------------------|---------------|
| `src/lib/time.ts` | utility (pure TZ) | transform | itself (extend in-place) | same file |
| `src/server/db/schema.ts` | schema (Drizzle tables + RLS) | DDL | existing tables with user-scoped RLS (e.g. `goals` block, lines 54-102) | exact |
| `src/server/services/progress.ts` | service (mutation logic) | CRUD | itself — rename `OutOfMonthError` → `ReadOnlyMonthError` | same file |
| `src/server/services/goals.ts` | service (mutation logic) | CRUD | same file + `src/server/services/progress.ts` `OutOfMonthError` usage | role-match |
| `src/server/actions/goals.ts` | server action | request-response + DB write | `src/server/actions/goals.ts` (extend with `copyGoalsFromLastMonthAction`) | same file |
| `src/app/(protected)/dashboard/page.tsx` | route / RSC entry | redirect | `src/server/actions/auth.ts` `signOutAction` (uses `redirect("/login")`) | redirect pattern match |

---

## Pattern Assignments

### `src/lib/time.ts` (utility, pure TZ transform) — EXTEND

**Analog:** itself — the two existing exports set the shape for the three new ones.

**Existing imports + export shape** (`src/lib/time.ts` lines 1-26):
```typescript
import { TZDate } from '@date-fns/tz'
import { startOfMonth, format } from 'date-fns'

export function today(now: Date, userTz: string): string { /* ... */ }
export function monthBucket(now: Date, userTz: string): Date { /* ... */ }
```

**Copy this shape for three new exports:**
- `compareMonth(viewed: Date, current: Date): 'past' | 'current' | 'future'` — pure; no `userTz` arg (RESEARCH.md §Pattern 3 justification: both inputs are already bucketed)
- `formatMonthSegment(month: Date): string` — returns `'YYYY-MM'`; use `format(month, 'yyyy-MM')`
- `parseMonthSegment(segment: 'YYYY-MM'): Date` — inverse; return `new Date(segment + '-01T00:00:00.000Z')`

**Anti-pattern to reject:** any new `new Date().getMonth()` comparisons elsewhere in the codebase. All past/current/future checks must route through `compareMonth` (RESEARCH.md line 875).

---

### `src/lib/schemas/reflections.ts` (schema, canonical Zod) — NEW

**Analog:** `src/lib/schemas/goals.ts` — same file shape, same export style, same Phase 2 D-20 pattern.

**Imports pattern** (`src/lib/schemas/goals.ts` lines 1-14):
```typescript
import { z } from "zod"

/**
 * Canonical Zod schemas for every goal + progress surface.
 * Imported by:
 *   - Server actions (src/server/actions/goals.ts, src/server/actions/progress.ts) for server-side re-validation
 *   - Client forms (Plan 02-03 create/edit dialog, Plan 02-04 backfill popover) via zodResolver for client-side validation
 * Error copy is verbatim from 02-UI-SPEC.md §Copywriting Contract — changing a string here changes every form.
 */
```

**Field definition + discriminated union pattern** (`src/lib/schemas/goals.ts` lines 17-23, 53-57):
```typescript
export const titleField = z.string().min(1, "Name is required").max(200, "Title is too long")
export const isoDateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
// ...
export const createGoalSchema = z.discriminatedUnion("type", [
  createCountGoalSchema,
  createChecklistGoalSchema,
  createHabitGoalSchema,
])
```

**Apply to reflections.ts:**
- `reflectionField = z.string().max(280, "That's a bit long — try trimming it to under 280 characters.").transform((s) => (s.trim() === '' ? null : s))` (server-side transforms empty → null per D-30)
- `monthField = isoDateField` (first-of-month ISO string, server re-bucketed for defense in depth)
- `upsertReflectionSchema = z.object({ month: monthField, whatWorked: reflectionField.nullable(), whatDidnt: reflectionField.nullable() })`
- `reflectionFormSchema` — client variant that accepts raw strings for counter display (RESEARCH.md line 1033 recommendation: split client vs server schemas)
- Type exports at bottom: `export type UpsertReflectionInput = z.infer<typeof upsertReflectionSchema>`

---

### `src/lib/schemas/month-segment.ts` (schema, Zod regex) — NEW (or inline in `time.ts`)

**Analog:** `src/lib/schemas/goals.ts` line 23 (`isoDateField`).

**Pattern:**
```typescript
import { z } from 'zod'
export const monthSegmentSchema = z.string().regex(/^\d{4}-\d{2}$/, "Invalid month")
```

Consumed by `app/(protected)/dashboard/[month]/page.tsx` before `parseMonthSegment`. On `safeParse` failure, route calls `notFound()` (Next 16 `import { notFound } from 'next/navigation'`).

---

### `src/server/db/schema.ts` (schema, Drizzle tables + RLS) — EXTEND

**Analog:** the existing `goals` table block (lines 54-102) — single-user-scoped RLS + FK cascade + nullable/optional columns.

**Imports already present** (lines 1-15) — nothing to add.

**RLS policy pattern** (`src/server/db/schema.ts` lines 80-100 — goals table policies):
```typescript
pgPolicy("goals-select-own", {
  for: "select",
  to: authenticatedRole,
  using: sql`user_id = auth.uid()`,
}),
pgPolicy("goals-insert-own", {
  for: "insert",
  to: authenticatedRole,
  withCheck: sql`user_id = auth.uid()`,
}),
pgPolicy("goals-update-own", {
  for: "update",
  to: authenticatedRole,
  using: sql`user_id = auth.uid()`,
  withCheck: sql`user_id = auth.uid()`,
}),
pgPolicy("goals-delete-own", {
  for: "delete",
  to: authenticatedRole,
  using: sql`user_id = auth.uid()`,
}),
```

**FK cascade pattern** (lines 75-79):
```typescript
foreignKey({
  columns: [table.userId],
  foreignColumns: [users.id],
  name: "goals_user_id_fk",
}).onDelete("cascade"),
```

**Apply to `month_reflections`:** Append a new `pgTable("month_reflections", ...)` block with:
- `id: uuid().primaryKey().defaultRandom().notNull()`
- `userId: uuid("user_id").notNull()` + FK cascade to `users.id` (named `month_reflections_user_id_fk`)
- `month: date("month").notNull()` — CHECK `EXTRACT(DAY FROM month) = 1` added via hand-authored SQL migration (Phase 1 D-09 pattern, see RESEARCH.md lines 732-737)
- `whatWorked: text("what_worked")` + `whatDidnt: text("what_didnt")` (both nullable per D-30)
- `createdAt` + `updatedAt` timestamps with `withTimezone: true, defaultNow()`
- `unique("month_reflections_user_month_key").on(table.userId, table.month)` — conflict target for UPSERT
- Four `pgPolicy()` entries using `sql\`user_id = auth.uid()\`` identical to goals pattern

Full canonical shape already written out in RESEARCH.md lines 692-729 — planner copies verbatim.

---

### `src/server/services/progress.ts` (service, mutation logic) — EXTEND / RENAME

**Analog:** itself — rename `OutOfMonthError` → `ReadOnlyMonthError` and reuse every existing throw site.

**Existing error class pattern** (lines 19-23):
```typescript
export class OutOfMonthError extends Error {
  constructor() {
    super("That date isn't in the current month.")
  }
}
```

**Rename to:**
```typescript
export class ReadOnlyMonthError extends Error {
  constructor() {
    super("This month is archived.")    // unpunitive copy per UI-SPEC.md §Error / Rollback Copy
  }
}
```

Every existing throw call site in `progress.ts` (lines 60, 80, 81, 85, 121, 142, 143, 148) is already correctly gated — the throw condition `g.month !== currentMonth` covers past-month AND future-month writes unchanged.

**Update `src/server/actions/progress.ts` error mapping** (lines 40-47): rename `OutOfMonthError` import to `ReadOnlyMonthError`; update mapping copy to `"This month is archived."` (UI-SPEC.md locked copy).

---

### `src/server/services/goals.ts` (service, mutation logic) — EXTEND

**Analog:** `src/server/services/progress.ts` lines 53-61 (`incrementCount` — the canonical "load goal + assert current month + write" pattern).

**Core pattern to copy** (`progress.ts` lines 53-72):
```typescript
export async function incrementCount(userId: string, userTz: string, input: IncrementCountInput) {
  const now = new Date()
  const currentMonth = isoDate(monthBucket(now, userTz))
  const loggedLocalDate = today(now, userTz)
  return db.transaction(async (tx) => {
    const g = await loadOwnedGoal(tx, userId, input.goalId)
    if (g.type !== "count") throw new WrongGoalTypeError()
    if (g.month !== currentMonth) throw new OutOfMonthError()
    // ... write
  })
}
```

**Apply to `updateGoal` and `deleteGoal` (in `goals.ts`):**
- Accept `userTz: string` as a new parameter (already done in `createGoal` line 19)
- Inside the transaction, after the ownership check, add:
  ```typescript
  const currentMonth = monthBucket(new Date(), userTz).toISOString().slice(0, 10)
  if (existing[0].month !== currentMonth && existing[0].month < currentMonth) {
    throw new ReadOnlyMonthError()
  }
  ```
  (Past-month mutations blocked; future-month mutations allowed per D-09.)

**Also add `copyGoalsFromLastMonth(userId, userTz)`** — full implementation in RESEARCH.md lines 591-648 (copy verbatim). Key pattern echoes from `createGoal` (lines 19-47):
- `const month = monthBucket(new Date(), userTz)` (server-derived — D-21)
- `return db.transaction(async (tx) => { ... })`
- Per-source-goal: `tx.insert(goals).values({ ... }).returning()` (same shape as createGoal)
- For checklist sources: `tx.insert(tasks).values(...)` with `isDone: false` + `doneAt: null`

**New error:** `export class ReadOnlyMonthError extends Error { constructor() { super("This month is archived.") } }` — re-export from `progress.ts` for a single source of truth, OR define sibling in `goals.ts` (either acceptable per CONTEXT.md discretion).

---

### `src/server/actions/goals.ts` (server action) — EXTEND

**Analog:** itself — add `copyGoalsFromLastMonthAction` following the existing action shape (lines 31-45 `createGoalAction`).

**Action shape to copy** (lines 31-45):
```typescript
export async function createGoalAction(input: CreateGoalInput): Promise<ActionResult<{ id: string }>> {
  const parsed = createGoalSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input. Please check the form." }
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated." }
  const userTz = await resolveUserTz(user.id)
  try {
    const row = await createGoal(user.id, userTz, parsed.data)
    revalidatePath("/dashboard")
    return { ok: true, data: { id: row.id } }
  } catch {
    return { ok: false, error: "Couldn't save that change. Try again." }
  }
}
```

**Apply to `copyGoalsFromLastMonthAction`:**
- **Zero input parameters** (beyond implicit session). Signature: `export async function copyGoalsFromLastMonthAction(): Promise<ActionResult<{ copiedCount: number }>>` — server derives months (D-21, RESEARCH.md line 880).
- No `safeParse` needed (no input).
- Use `getSupabaseServerClient()` + `auth.getUser()` + `resolveUserTz` just like `createGoalAction`.
- Wrap `await copyGoalsFromLastMonth(user.id, userTz)` in try/catch.
- `revalidatePath` the current month path. Since the new `[month]` route is under `/dashboard`, `revalidatePath("/dashboard", "layout")` covers both the redirect page and all `[month]` segments.

**Error mapping for update/delete** (add to existing `updateGoalAction` and `deleteGoalAction` catch blocks): `if (e instanceof ReadOnlyMonthError) return { ok: false, error: "This month is archived." }`.

---

### `src/server/actions/reflections.ts` (server action, new file) — NEW

**Analog:** `src/server/actions/progress.ts` (entire file) — same imports, same `ActionResult`, same auth guard, same `resolveUserTz`, same error-mapping helper.

**Imports + `ActionResult` + helpers pattern** (`progress.ts` lines 1-47):
```typescript
"use server"
import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"
import { upsertReflectionSchema, type UpsertReflectionInput } from "@/lib/schemas/reflections"
import { upsertReflection } from "@/server/services/reflections"

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }

async function resolveUserTz(userId: string): Promise<string> {
  const [row] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1)
  return row?.timezone ?? "UTC"
}
```

**Action body pattern** (`progress.ts` lines 49-65):
```typescript
export async function upsertReflectionAction(input: UpsertReflectionInput): Promise<ActionResult<{ savedAt: string }>> {
  const parsed = upsertReflectionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input." }
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated." }
  const userTz = await resolveUserTz(user.id)
  try {
    const result = await upsertReflection(user.id, userTz, parsed.data)
    revalidatePath(`/dashboard/${parsed.data.month.slice(0, 7)}`)
    return { ok: true, data: { savedAt: result[0].savedAt.toISOString() } }
  } catch {
    return { ok: false, error: "Couldn't save reflection. Please try again." }
  }
}
```

**New service file:** `src/server/services/reflections.ts` — full implementation in RESEARCH.md lines 659-686 (copy verbatim; uses Drizzle `onConflictDoUpdate({ target: [monthReflections.userId, monthReflections.month], set: { ... } })`).

---

### `src/app/(protected)/dashboard/page.tsx` (route / RSC) — REWRITE to redirect

**Analog:** `src/server/actions/auth.ts` lines 109-114 (`signOutAction` — simplest `redirect()` usage).

**Redirect pattern** (`auth.ts` lines 110-113):
```typescript
const supabase = await getSupabaseServerClient()
await supabase.auth.signOut()
redirect("/login")
```

**Apply to new `page.tsx`:**
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
  const [row] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, user.id)).limit(1)
  const userTz = row?.timezone ?? "UTC"
  redirect(`/dashboard/${formatMonthSegment(monthBucket(new Date(), userTz))}`)
}
```

(Middleware already guards the route; this redirect is the inner canonical-month logic.)

---

### `src/app/(protected)/dashboard/[month]/page.tsx` (route / RSC, new) — NEW

**Analog:** the existing `src/app/(protected)/dashboard/page.tsx` (entire file, lines 1-60). Phase 3 copies its imports, user resolution, query, and render shape — and replaces the inline empty-state branch with the decision tree from UI-SPEC.md §Layout.

**Imports pattern** (`page.tsx` lines 1-12) — copy and add:
```typescript
import { notFound, redirect } from "next/navigation"          // notFound is new
import { eq } from "drizzle-orm"
import { format, getDaysInMonth } from "date-fns"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"
import { monthBucket, parseMonthSegment, compareMonth, formatMonthSegment } from "@/lib/time"
import { monthSegmentSchema } from "@/lib/schemas/month-segment"    // new
import { getMonthDashboard } from "@/server/db/queries"
// + getReflection (new query) + countGoalsInMonth (new query) for Welcome trigger
```

**Next 16 async params** (required by Next 16 — see RESEARCH.md line 824):
```typescript
export default async function DashboardPage({ params }: { params: Promise<{ month: string }> }) {
  const { month: seg } = await params
  const parsed = monthSegmentSchema.safeParse(seg)
  if (!parsed.success) notFound()
  // ...
}
```

**User resolution pattern** (existing `page.tsx` lines 15-21) — copy verbatim.

**Branching render pattern** — copy the existing `page.tsx` lines 29-59 `<header>` + ternary render shape, but:
- Replace the static `<header>` with `<MonthNavigator ... />`
- Replace the single `goals.length === 0 ? <EmptyState /> : <DashboardShell />` ternary with the four-way decision tree in UI-SPEC.md lines 498-517 (past-empty, past-with-goals, welcome/empty, current/future-with-goals)
- Append `<ReflectionCard />` below when `compareMonth !== 'future'`

**Future-month cap** (UI-SPEC + D-06):
```typescript
const isPastNextMonth = compareMonth(viewedMonth, monthBucket(addMonths(currentMonth, 1), userTz)) === 'future'
if (isPastNextMonth) notFound()
```

---

### `src/components/month-navigator.tsx` (component, client) — NEW

**Analog (layout):** the header block in `src/app/(protected)/dashboard/page.tsx` lines 31-41 — the existing title + right-cluster flex layout is the shape to preserve.

**Analog (client-side `useState` + keydown effect):** `src/components/create-goal-dialog.tsx` lines 66-81 (client-state + `useEffect` on mount).

**Header layout pattern to extend** (`page.tsx` lines 31-41):
```typescript
<header className="mb-2 flex items-center justify-between">
  <h1 className="text-2xl font-semibold">{monthYearLabel}</h1>
  <div className="flex items-center gap-2">
    {goals.length > 0 && <NewGoalButton daysInMonthDefault={daysInMonthDefault} />}
    <form action={signOutAction}>
      <Button type="submit" variant="outline" size="sm">Log out</Button>
    </form>
  </div>
</header>
```

**Apply to `MonthNavigator`:**
- Wrap left cluster in a flex with `gap-2`: `[<ChevronLeft Button>, <h1>, <ChevronRight Button>]`
- Right cluster receives conditional children as props: `todaySlot?: ReactNode`, `newGoalSlot?: ReactNode`, `logoutSlot: ReactNode` — keeps the component pure-UI; page.tsx wires server-computed conditional visibility
- Use `next/link` `<Link>` inside each arrow button for native browser history (NOT `useRouter.push` — links give free back/forward)
- Disabled-next pattern: `aria-disabled="true"`, `className="opacity-50 cursor-not-allowed pointer-events-none"` on inner Link

**Keyboard shortcut pattern** — copy structural shape from `earlier-day-popover.tsx` lines 33-38 (useEffect with cleanup):
```typescript
React.useEffect(() => {
  function onKey(e: KeyboardEvent) {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
    if (e.key === 'ArrowLeft') router.push(prevHref)
    if (e.key === 'ArrowRight' && !isNextDisabled) router.push(nextHref)
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [prevHref, nextHref, isNextDisabled, router])
```

**Icons:** `ChevronLeft`, `ChevronRight` from `lucide-react` (already imported in other files).

---

### `src/components/welcome-to-month.tsx` (component, client) — NEW

**Analog:** `src/components/create-goal-dialog.tsx` lines 105-115 (server action call + loading state + error display).

**Action invocation pattern** (`create-goal-dialog.tsx` lines 105-115):
```typescript
async function onSubmit(data: FormValues) {
  setRootError(null)
  const result = isEdit
    ? await updateGoalAction(data as UpdateGoalInput)
    : await createGoalAction(data as CreateGoalInput)
  if (!result.ok) {
    setRootError(result.error)
    return
  }
  onOpenChange(false)
}
```

**Loading + Loader2 pattern** (`create-goal-dialog.tsx` lines 310-317):
```typescript
<Button type="submit" disabled={form.formState.isSubmitting}>
  {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create goal'}
</Button>
```

**Inline error pattern** (`create-goal-dialog.tsx` lines 298-304):
```typescript
{rootError && (
  <div aria-live="polite">
    <Alert variant="destructive">
      <AlertDescription>{rootError}</AlertDescription>
    </Alert>
  </div>
)}
```

**Apply to `WelcomeToMonth`:**
- Card wrapper: `<Card className="p-6">` (see `empty-state.tsx` and UI-SPEC layout block lines 525-535)
- Two buttons side-by-side via `flex flex-col sm:flex-row gap-3`
- Primary button: `variant="default"`; clicking invokes `useTransition` + `copyGoalsFromLastMonthAction()` (zero args — server-derived months)
- Secondary button: `variant="outline"`, click sets `welcomeDismissed` state (parent-owned — UI-SPEC.md §WelcomeToMonth Interactive Behavior "Start fresh")
- Loading state: swap button children for `<Loader2 className="size-4 animate-spin" />` + `disabled={isPending}`
- On `{ok: false}`: render `<Alert variant="destructive">` below the buttons with `result.error`; component stays mounted

---

### `src/components/past-empty-state.tsx` (component, RSC) — NEW

**Analog:** `src/components/empty-state.tsx` — exact same primitive choice (`Card`, `CardHeader`, `CardContent`, `CardTitle`, `Button`).

**Layout pattern to copy** (`empty-state.tsx` lines 26-44):
```typescript
export function EmptyState({ monthYearLabel, createButtonSlot }: EmptyStateProps) {
  return (
    <section className="flex flex-col items-center gap-8 pt-8">
      <h2 className="max-w-md text-center text-2xl font-semibold">
        It&apos;s {monthYearLabel}. What do you want to commit to?
      </h2>
      {/* ... */}
    </section>
  )
}
```

**Apply to `PastEmptyState`:**
- Props: `{ monthYearLabel: string; currentMonthSegment: string }`
- Container: `<Card className="p-6">` (UI-SPEC lines 545-555) — not the full-section pattern of `EmptyState`; use Card primitive shape
- Body `<p className="text-base text-muted-foreground">You didn't have goals tracked this month.</p>`
- Back button: `<Button variant="outline" asChild className="min-h-11 w-full sm:w-auto"><Link href={\`/dashboard/${currentMonthSegment}\`}>Back to current month</Link></Button>`
- RSC-safe — no `'use client'` directive, no state, no handlers

---

### `src/components/reflection-card.tsx` (component, client) — NEW

**Analogs (hybrid):**
1. `src/components/create-goal-dialog.tsx` — RHF + zodResolver + `ActionResult` handling
2. `src/components/earlier-day-popover.tsx` lines 29-38 — local state + callback-invocation shape
3. RESEARCH.md lines 747-814 — full debounced autosave implementation (copy verbatim)

**RHF setup pattern** (`create-goal-dialog.tsx` lines 83-88):
```typescript
const form = useForm<FormValues>({
  resolver: zodResolver(isEdit ? updateGoalSchema : createGoalSchema) as any,
  defaultValues: editing ? (editing as any) : ({ type: chosenType, title: '' } as any),
})
```

**Apply to `ReflectionCard`:** use `reflectionFormSchema` (the client-side variant defined in `reflections.ts` that accepts raw strings for counter display).

**Full autosave pattern** — RESEARCH.md lines 763-814. Key moves:
- `useForm<ReflectionFormInput>({ resolver: zodResolver(reflectionFormSchema), defaultValues: initial })`
- `watch('whatWorked')` + `watch('whatDidnt')` to power the char counter + debounce trigger
- `useEffect(() => { clearTimeout(timeoutRef.current); timeoutRef.current = setTimeout(save, 800) }, [ww, wd])`
- `{...register('whatWorked', { onBlur: save })}` — blur fires immediate save
- `useTransition` for the save call; `setSavedAt(Date.now())` on `{ok: true}`

**Character counter color-class logic** (UI-SPEC.md §ReflectionCard counter colors + RESEARCH.md line 838):
```typescript
function counterClass(n: number) {
  if (n >= 280) return 'text-destructive'
  if (n >= 250) return 'text-warning-foreground bg-warning-muted inline-block rounded px-1'
  return 'text-muted-foreground'
}
```

**Textarea primitive:** install via `npx shadcn@latest add textarea` (Phase 3's only new shadcn component).

**Saved-indicator pattern** (new — but copy `aria-live="polite"` + CSS fade from UI-SPEC lines 589-594). No Motion needed; plain CSS transition.

**Note:** Do NOT autofocus — UI-SPEC.md §ReflectionCard interaction contract is explicit.

---

### `src/components/past-month-read-only.tsx` (component, RSC) — NEW

**Analog:** `src/components/dashboard-shell.tsx` lines 246-252 (the section mapping goals to GoalCards) — minus `useOptimistic`, minus handlers, minus Dialogs.

**Core render loop pattern** (`dashboard-shell.tsx` lines 246-252):
```typescript
<section className="flex flex-col gap-4" aria-label="Your goals">
  {goals.map((goal) => (
    <GoalCard key={goal.id} goal={goal} now={now} userTz={userTz} handlers={handlers} />
  ))}
</section>
```

**Apply to `PastMonthReadOnly`:**
- RSC (no `'use client'`)
- Props: `{ goals: Goal[]; now: Date; userTz: string }`
- Same `<section>` shell, same `<GoalCard />` rendering — but with an extra `variant="read-only"` prop threaded through
- NO handlers, NO useOptimistic, NO Dialog mount, NO toast call sites — the absence IS the read-only enforcement (D-15)

**Coupled change:** `GoalCard` + `CountCard` + `ChecklistCard` + `HabitCard` + `HabitGrid` + `PaceChip` gain a `variant: 'mutable' | 'read-only'` (OR `readOnly?: boolean`) prop. When read-only:
- Hide the `<DropdownMenu>` subtree entirely (D-13)
- Replace stepper / `+1` / backfill popover with nothing
- `<Checkbox checked={t.isDone} disabled />` on checklists (UI-SPEC line 396)
- `PaceChip` suppressed (UI-SPEC past-month table line 401)
- Progress bar renders frozen (no spring — pass `initial={false}` if not already; UI-SPEC line 394 says Phase 2 ProgressBar already idempotent)
- Habit-grid cells become `<div>` or `<button disabled>` with preserved `aria-label` (UI-SPEC line 398)

---

## Shared Patterns (Cross-Cutting)

### ActionResult discriminated union (every server action)

**Source:** `src/server/actions/progress.ts` line 33 + `src/server/actions/goals.ts` line 24
**Apply to:** `reflections.ts` (new), `copyGoalsFromLastMonthAction` (extension)

```typescript
type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }
```

Every Phase 3 server action returns exactly this shape. Client code branches on `result.ok`.

### Server-side user + timezone resolution (every mutation action)

**Source:** `src/server/actions/progress.ts` lines 35-38 (+ identical in `goals.ts` lines 26-29)
**Apply to:** `upsertReflectionAction`, `copyGoalsFromLastMonthAction`

```typescript
const supabase = await getSupabaseServerClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return { ok: false, error: "Not authenticated." }
const userTz = await resolveUserTz(user.id)   // private helper in same file
```

Never trust `userTz` or `userId` from the client body.

### Zod safeParse at action entry

**Source:** `src/server/actions/progress.ts` line 50 + `src/server/actions/goals.ts` line 32
**Apply to:** `upsertReflectionAction` (client input re-validated). `copyGoalsFromLastMonthAction` takes zero args so has no parse (D-21).

```typescript
const parsed = upsertReflectionSchema.safeParse(input)
if (!parsed.success) return { ok: false, error: "Invalid input." }
```

### Drizzle transaction shape

**Source:** `src/server/services/goals.ts` lines 21-46 + `src/server/services/progress.ts` lines 57-72
**Apply to:** `copyGoalsFromLastMonth` (new), `upsertReflection` (new — single-statement UPSERT doesn't strictly need a txn but wrap for consistency)

```typescript
return db.transaction(async (tx) => {
  // load
  // assert
  // insert / update
})
```

### Server-derived month (D-21 lock)

**Source:** `src/server/services/goals.ts` line 20 + `src/server/services/progress.ts` lines 55, 75-76
**Apply to:** `copyGoalsFromLastMonth` (zero client month args), `upsertReflection` (client passes month from URL, server re-validates matches a bucketed first-of-month)

```typescript
const month = monthBucket(new Date(), userTz)   // NEVER from req.body
```

### RLS crudPolicy via pgPolicy()

**Source:** `src/server/db/schema.ts` goals block lines 80-100
**Apply to:** `month_reflections` table — four pgPolicy() blocks (select/insert/update/delete) all keyed `user_id = auth.uid()`.

### revalidatePath on mutation success

**Source:** `src/server/actions/progress.ts` line 60 (`revalidatePath("/dashboard")`)
**Apply to:** Phase 3 actions — but the URL shape changes to `/dashboard/[month]`. Use `revalidatePath("/dashboard", "layout")` to cover both the redirect page and all `[month]` segments, OR `revalidatePath(\`/dashboard/${monthSegment}\`)` for the specific viewed month (both acceptable).

### shadcn Card primitive for all new "bottom-of-list" cards

**Source:** `src/components/empty-state.tsx` lines 14-24 (`ExampleCard`) + UI-SPEC.md §Layout blocks
**Apply to:** `WelcomeToMonth`, `PastEmptyState`, `ReflectionCard`

```typescript
<Card className="p-6">
  <CardHeader className="p-0 pb-4">
    <CardTitle className="text-2xl font-semibold">{title}</CardTitle>
  </CardHeader>
  <CardContent className="p-0 flex flex-col gap-3">
    {/* ... */}
  </CardContent>
</Card>
```

Never introduce a new Card-like wrapper primitive. Always Card + CardHeader + CardContent from `@/components/ui/card`.

### Next 16 async params (new in Phase 3)

**Source:** Next.js 16.2 required shape (no Phase 1/2 analog — `[month]` is the first dynamic segment in the project). RESEARCH.md line 824 cites this as mandatory.
**Apply to:** `src/app/(protected)/dashboard/[month]/page.tsx`

```typescript
export default async function DashboardPage({ params }: { params: Promise<{ month: string }> }) {
  const { month: seg } = await params
}
```

---

## No Analog Found

None. Every Phase 3 file has at least a role-match analog in the existing codebase. This phase is entirely integration work.

---

## Metadata

**Analog search scope:**
- `/Users/rathtana.duong/gsd-tutorial/src/app/**` (routes + layouts)
- `/Users/rathtana.duong/gsd-tutorial/src/components/**` (RSC + client components)
- `/Users/rathtana.duong/gsd-tutorial/src/lib/**` (pure utilities + schemas + supabase)
- `/Users/rathtana.duong/gsd-tutorial/src/server/**` (actions + services + db + queries)
- `/Users/rathtana.duong/gsd-tutorial/src/middleware.ts`

**Files scanned:** 52 TS/TSX files in `src/`

**Pattern extraction date:** 2026-04-20

---

*Phase: 03-month-navigation-history-reflection*
*Patterns mapped: 2026-04-20*
*Mapper: gsd-phase-pattern-mapper (Opus 4.7)*
