# Phase 4: Launch Polish - Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** 6 (5 modify, 1 new)
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/app/(protected)/dashboard/[month]/page.tsx` | route (RSC) | request-response | itself (modify in-place) | exact |
| `src/components/month-navigator.tsx` | component (client) | request-response | itself (modify in-place) | exact |
| `src/components/habit-grid.tsx` | component (client) | event-driven | itself (modify in-place) | exact |
| `src/components/goal-card/count.tsx` | component (client) | event-driven | itself (modify in-place) | exact |
| `src/components/reflection-card.tsx` | component (client) | event-driven | `src/components/dashboard-shell.tsx` (toast.error pattern) | role-match |
| `e2e/phase4-smoke.spec.ts` | test (E2E) | request-response | `e2e/phase3-uat.spec.ts` | exact |

---

## Pattern Assignments

### `src/app/(protected)/dashboard/[month]/page.tsx` (RSC, request-response)

**Change:** Rebuild `rightCluster` (lines 87–101) with icon + `<span className="hidden md:inline">` responsive label pattern. Add `CalendarCheck` and `LogOut` to lucide-react imports. Update `NewGoalButton` call to use icon-only on mobile (via `label` prop or external wrapping).

**Current imports block** (lines 1–30):
```tsx
import { notFound, redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { addMonths, format, getDaysInMonth, isSameMonth, subMonths } from "date-fns"
import { TZDate } from "@date-fns/tz"
import { getSupabaseServerClient } from "@/lib/supabase/server"
// ...
import { signOutAction } from "@/server/actions/auth"
import { Button } from "@/components/ui/button"
import Link from "next/link"
```

**Add to lucide-react imports** — there is no lucide-react import in this file currently. Add:
```tsx
import { CalendarCheck, LogOut } from "lucide-react"
```

**Current rightCluster pattern** (lines 87–101) — the analog to replace:
```tsx
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
```

**Target pattern after Phase 4 (D-01, D-02)**:
```tsx
const rightCluster = (
  <>
    {!isCurrent && (
      <Button
        variant="outline"
        size="icon"
        aria-label="Return to this month"
        title="Return to this month"
        asChild
      >
        <Link href={`/dashboard/${currentSegment}`}>
          <CalendarCheck className="size-4" />
          <span className="hidden md:inline">Today</span>
        </Link>
      </Button>
    )}
    {status !== "past" && goals.length > 0 && (
      <NewGoalButton daysInMonthDefault={daysInMonth} label="New goal" />
      // NOTE: NewGoalButton needs responsive label treatment — see NewGoalButton section below
    )}
    <form action={signOutAction}>
      <Button
        type="submit"
        variant="outline"
        size="icon"
        aria-label="Log out"
        title="Log out"
      >
        <LogOut className="size-4" />
        <span className="hidden md:inline">Log out</span>
      </Button>
    </form>
  </>
)
```

**Existing chevron button pattern to copy** (from `src/components/month-navigator.tsx` lines 53–57 and 72–76):
```tsx
// icon-only with aria-label — the established pattern in this codebase
<Button variant="ghost" size="icon" asChild>
  <Link href={prevHref} aria-label="Previous month">
    <ChevronLeft className="size-4" />
  </Link>
</Button>

// disabled variant (lines 60–76)
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
```

**`aria-label` / `title` pattern source** (from `src/components/goal-card/count.tsx` lines 96–99):
```tsx
disabled={progressDisabled}
title={progressDisabled ? disabledTitle : undefined}
```
The right-cluster buttons are never conditionally disabled, so `title` is always set (not conditional).

---

### `src/components/dashboard-shell.tsx` — NewGoalButton (component, event-driven)

**Change:** Add responsive label support so the `label` prop text is hidden on mobile and visible at `md:`. The `NewGoalButton` has a `label` prop (line 59, default `'New goal'`) that renders as `{label}` inline after the `<Plus>` icon.

**Current NewGoalButton render** (lines 62–77):
```tsx
export function NewGoalButton({
  daysInMonthDefault,
  className,
  size = 'default',
  label = 'New goal',
}: NewGoalButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size={size} onClick={() => setOpen(true)} className={className}>
        <Plus className="mr-2 h-4 w-4" /> {label}
      </Button>
      <CreateGoalDialog open={open} onOpenChange={setOpen} daysInMonthDefault={daysInMonth} />
    </>
  )
}
```

**Target pattern** — wrap label in responsive span, add `aria-label` and `title` props, support `size="icon"` mode:
```tsx
interface NewGoalButtonProps {
  daysInMonthDefault: number
  className?: string
  size?: 'default' | 'lg' | 'icon'   // add 'icon'
  label?: string
}

export function NewGoalButton({
  daysInMonthDefault,
  className,
  size = 'default',
  label = 'New goal',
}: NewGoalButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        size={size}
        onClick={() => setOpen(true)}
        className={className}
        aria-label={label}
        title={label}
      >
        <Plus className="mr-2 h-4 w-4" />
        <span className="hidden md:inline">{label}</span>
      </Button>
      <CreateGoalDialog open={open} onOpenChange={setOpen} daysInMonthDefault={daysInMonthDefault} />
    </>
  )
}
```

**Caller in `[month]/page.tsx`** then passes `size="icon"` (or keeps default — since `hidden md:inline` applies to the span regardless of size, the `size="default"` button will show icon-only on mobile and icon+label at `md:` automatically):
```tsx
<NewGoalButton daysInMonthDefault={daysInMonth} />
// no size change needed — hidden md:inline on the span handles responsive behaviour
```

---

### `src/components/habit-grid.tsx` (component, event-driven)

**Change:** One line — `h-9 w-9` → `h-11 w-11` at line 97. Unconditional at all breakpoints.

**Current cell className** (line 97):
```tsx
className={cn(
  'flex h-9 w-9 items-center justify-center rounded-md text-xs tabular-nums',
  isHit && !isToday && 'bg-primary text-primary-foreground',
  !isHit && !isToday && !isFuture && 'bg-muted text-muted-foreground',
  isToday && isHit && 'bg-primary text-primary-foreground ring-2 ring-ring ring-offset-2 ring-offset-card',
  isToday && !isHit && 'bg-muted text-foreground ring-2 ring-ring ring-offset-2 ring-offset-card',
  isFuture && 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed',
  readOnly && 'cursor-default',
  !readOnly && !isFuture && 'hover:bg-muted/80',
)}
```

**Target** — change only the first string in `cn()`:
```tsx
className={cn(
  'flex h-11 w-11 items-center justify-center rounded-md text-xs tabular-nums',
  // ...all other conditional classes unchanged
)}
```

**Math confirmation** (from RESEARCH.md): 7 × 44px + 6 × 4px gap = 332px < 343px available at 375px. No responsive breakpoint needed; no other class changes needed.

**Day-label header** (line 69–71) — auto-resizes with grid column; no change needed:
```tsx
<div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground" aria-hidden>
  {['S','M','T','W','T','F','S'].map((l, i) => <div key={i}>{l}</div>)}
</div>
```

---

### `src/components/goal-card/count.tsx` (component, event-driven)

**Change:** Add `className="h-11 w-11"` to the Minus button (lines 93–100) and Plus button (lines 109–116). Add `className="h-9"` to the Apply button (lines 119–123). The `+1` button (lines 83–91) is already `className="h-11"` — no change.

**Current +1 button** (lines 83–91) — already correct, use as reference for h-11 pattern:
```tsx
<Button
  size="lg"
  className="h-11"
  disabled={progressDisabled}
  title={progressDisabled ? disabledTitle : undefined}
  onClick={() => !progressDisabled && handlers?.onCountIncrement(goal.id, 1)}
>
  +1
</Button>
```

**Current Minus button** (lines 93–100) — needs `className="h-11 w-11"`:
```tsx
<Button
  variant="outline"
  size="icon"
  aria-label="Decrement stepper"
  disabled={progressDisabled}
  title={progressDisabled ? disabledTitle : undefined}
  onClick={() => !progressDisabled && setStepperValue((v) => v - 1)}
>
  <Minus className="h-4 w-4" />
</Button>
```

**Target Minus button**:
```tsx
<Button
  variant="outline"
  size="icon"
  className="h-11 w-11"
  aria-label="Decrement stepper"
  disabled={progressDisabled}
  title={progressDisabled ? disabledTitle : undefined}
  onClick={() => !progressDisabled && setStepperValue((v) => v - 1)}
>
  <Minus className="h-4 w-4" />
</Button>
```

**Current Plus button** (lines 109–116) — needs `className="h-11 w-11"`:
```tsx
<Button
  variant="outline"
  size="icon"
  aria-label="Increment stepper"
  disabled={progressDisabled}
  title={progressDisabled ? disabledTitle : undefined}
  onClick={() => !progressDisabled && setStepperValue((v) => v + 1)}
>
  <Plus className="h-4 w-4" />
</Button>
```

**Target Plus button**:
```tsx
<Button
  variant="outline"
  size="icon"
  className="h-11 w-11"
  aria-label="Increment stepper"
  disabled={progressDisabled}
  title={progressDisabled ? disabledTitle : undefined}
  onClick={() => !progressDisabled && setStepperValue((v) => v + 1)}
>
  <Plus className="h-4 w-4" />
</Button>
```

**Current Apply button** (lines 119–123) — `size="sm"` = `h-8` in button.tsx; needs `className="h-9"`:
```tsx
{stepperValue !== 0 && !progressDisabled && (
  <Button variant="outline" size="sm" onClick={commitStepper} aria-label="Commit stepper delta">
    Apply
  </Button>
)}
```

**Target Apply button**:
```tsx
{stepperValue !== 0 && !progressDisabled && (
  <Button variant="outline" size="sm" className="h-9" onClick={commitStepper} aria-label="Commit stepper delta">
    Apply
  </Button>
)}
```

**Key fact from RESEARCH.md (Pitfall 2):** `tailwind-merge` inside `cn()` correctly resolves `size-9` (from `size="icon"`) vs explicit `h-11 w-11` — the explicit wins. This is confirmed by the existing `className="h-11"` on the `+1` button overriding `size="lg"`.

---

### `src/components/reflection-card.tsx` (component, event-driven)

**Change:** Remove `saveError` state (line 43), remove `setSaveError` calls (lines 69, 74), replace error branch with `toast.error()`, remove `saveError` Alert JSX block (lines 143–147), remove unused Alert imports (line 7), add `toast` import from `sonner`.

**Current imports** (lines 1–17):
```tsx
'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PenLine } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'    // REMOVE if unused after
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  reflectionFormSchema,
  type ReflectionFormInput,
} from '@/lib/schemas/reflections'
import { upsertReflectionAction } from '@/server/actions/reflections'
```

**Target imports** — remove Alert line, add toast:
```tsx
import { toast } from 'sonner'
// Remove: import { Alert, AlertDescription } from '@/components/ui/alert'
```

**Current state declaration** (line 43) — remove:
```tsx
const [saveError, setSaveError] = useState<string | null>(null)
```

**Current save() success/failure branches** (lines 66–76):
```tsx
if (result.ok) {
  const stamp = Date.now()
  setSavedAt(stamp)
  setSaveError(null)           // REMOVE this line
  setTimeout(() => {
    setSavedAt((current) => (current === stamp ? null : current))
  }, 3000)
} else {
  setSaveError(result.error)   // REPLACE with toast.error
}
```

**Target save() branches**:
```tsx
if (result.ok) {
  const stamp = Date.now()
  setSavedAt(stamp)
  setTimeout(() => {
    setSavedAt((current) => (current === stamp ? null : current))
  }, 3000)
} else {
  toast.error('Reflection not saved — check your connection')
}
```

**Current error JSX block** (lines 143–147) — remove entirely:
```tsx
{saveError && (
  <Alert variant="destructive" role="alert">
    <AlertDescription>{saveError}</AlertDescription>
  </Alert>
)}
```

**Toast.error analog** — copy call style from `src/components/dashboard-shell.tsx` (lines 130, 153, 174, 196). The exact calls in dashboard-shell.tsx use:
```tsx
toast.error('...')   // no id needed for error toasts; they don't deduplicate
```

---

### `e2e/phase4-smoke.spec.ts` (test, request-response)

**Analog:** `e2e/phase3-uat.spec.ts` — copy file header, import block, `goTo` helper, and test structure verbatim.

**File header pattern** (lines 1–15 of phase3-uat.spec.ts):
```ts
/**
 * Phase 4 Smoke — launch smoke tests at 375px viewport.
 * Covers POLSH-01 (touch targets) and POLSH-02 (autosave error toast).
 */
import { test, expect, type Page } from '@playwright/test'
// storageState is set at the project level in playwright.config.ts

// ─── helpers ────────────────────────────────────────────────────────────────

async function goTo(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
}
```

**Viewport override pattern** — `playwright.config.ts` uses `devices['Desktop Chrome']` (1280px) for the `chromium` project. Phase 4 mobile tests must call `page.setViewportSize` at the start of each mobile test:
```ts
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
})
```

**Touch target size assertion pattern** — use `boundingBox()`:
```ts
const box = await page.locator('selector').boundingBox()
expect(box?.height).toBeGreaterThanOrEqual(44)
expect(box?.width).toBeGreaterThanOrEqual(44)
```

**Network intercept pattern for autosave failure** — use `page.route()`:
```ts
await page.route('**/dashboard/**', async (route) => {
  if (route.request().method() === 'POST') {
    await route.abort('failed')
  } else {
    await route.continue()
  }
})
```

**Toast assertion pattern** — Sonner renders toasts in `[data-sonner-toaster]` / `[data-sonner-toast]`. Locate by text:
```ts
await expect(page.locator('[data-sonner-toast]').filter({ hasText: /reflection not saved/i }))
  .toBeVisible({ timeout: 5_000 })
```

**Aria-label locator pattern** (from phase3-uat.spec.ts line 57):
```ts
// Today button: keep aria-label="Return to this month" (D-02 mandates it)
await page.getByRole('link', { name: /return to this month/i }).click()
```

**Test grep tag convention** — all tests in this file should include `"phase4"` in the test title so `npm run test:e2e -- --grep "phase4"` runs only the new spec:
```ts
test('phase4: right cluster icons visible at 375px', async ({ page }) => { ... })
test('phase4: habit grid cells are 44px at 375px', async ({ page }) => { ... })
test('phase4: count stepper buttons are 44px at 375px', async ({ page }) => { ... })
test('phase4: autosave failure shows error toast', async ({ page }) => { ... })
```

---

## Shared Patterns

### Icon-only Button with aria-label + title
**Source:** `src/components/month-navigator.tsx` lines 53–77
**Apply to:** All new icon-only buttons in rightCluster (Today, Log out), existing chevron buttons are the established template
```tsx
<Button variant="ghost" size="icon" asChild>
  <Link href={href} aria-label="Previous month">
    <ChevronLeft className="size-4" />
  </Link>
</Button>
// For non-link buttons:
<Button variant="outline" size="icon" aria-label="Log out" title="Log out">
  <LogOut className="size-4" />
  <span className="hidden md:inline">Log out</span>
</Button>
```

### Responsive Label Hiding
**Source:** RESEARCH.md Pattern 1 (no existing codebase instance — first use in Phase 4)
**Apply to:** All right cluster buttons and NewGoalButton label span
```tsx
<span className="hidden md:inline">Label text</span>
```

### `h-11 w-11` Touch Target Override
**Source:** `src/components/goal-card/count.tsx` line 85 (existing `h-11` on `+1` button)
**Apply to:** Stepper Minus/Plus buttons in count.tsx
```tsx
<Button size="icon" className="h-11 w-11" ...>
```
`tailwind-merge` in `cn()` resolves `size-9` (from `size="icon"`) vs `h-11 w-11` — explicit wins.

### `title` on Conditionally Disabled Buttons
**Source:** `src/components/goal-card/count.tsx` lines 96–99
**Apply to:** All interactive buttons that may be disabled with a tooltip explanation
```tsx
disabled={progressDisabled}
title={progressDisabled ? disabledTitle : undefined}
```
For always-available buttons (right cluster nav), `title` is always set (not conditional):
```tsx
title="Return to this month"
```

### Toast Error Pattern
**Source:** `src/components/dashboard-shell.tsx` lines 130, 153, 174, 196
**Apply to:** `reflection-card.tsx` autosave failure branch
```tsx
import { toast } from 'sonner'
// ...
toast.error('Reflection not saved — check your connection')
// No id: needed — error toasts don't deduplicate
```

### ActionResult Branch Pattern
**Source:** `src/components/reflection-card.tsx` lines 66–76 (current), applies to all server action callers
```tsx
const result = await someServerAction(payload)
if (result.ok) {
  // success path
} else {
  toast.error(result.error ?? 'Fallback message')
}
```

---

## No Analog Found

No files in Phase 4 are entirely novel — all are modifications to existing files or direct extensions of established E2E patterns.

---

## Metadata

**Analog search scope:** `src/components/`, `src/app/(protected)/`, `e2e/`
**Files read:** 8 (6 target files + `e2e/auth.setup.ts` + `playwright.config.ts`)
**Pattern extraction date:** 2026-04-27
