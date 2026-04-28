# Phase 4: Launch Polish - Research

**Researched:** 2026-04-27
**Domain:** Mobile responsiveness, error UX hardening, production deploy verification
**Confidence:** HIGH — all findings based on direct codebase reads; no assumptions about existing code state

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** MonthNavigator right cluster uses icon-only on mobile, icon+label at `md:` breakpoint. Mapping: Today → `CalendarCheck`, New Goal → `Plus`, Log out → `LogOut`. Single-row header — no stacking, no dropdown.
- **D-02:** All icon-only buttons in right cluster must have `title` and `aria-label` attributes following the existing chevron pattern (`aria-label="Previous month"`).
- **D-03:** HabitGrid cells: `h-9 w-9` → `h-11 w-11` (44px) unconditionally at all breakpoints. Day-label header auto-resizes with column width.
- **D-04:** CountCard stepper ±buttons get `h-11 w-11` via `className` override on `size="icon"`. Apply button: `h-9` minimum.
- **D-05:** ReflectionCard autosave failures show `toast.error('Reflection not saved — check your connection')`. Remove existing `saveError` state and `Alert` block. Textarea input preserved via RHF state.
- **D-06:** Auth forms audit pass — check login, signup, reset-password, update-password for silent-drop paths. Fix gaps; don't add complexity where coverage exists.
- **D-07:** Phase 4 actually deploys to Vercel production: push to main, verify env vars in Vercel dashboard, smoke test on live URL.
- **D-08:** Cookie verification via Browser DevTools on live URL. Inspect `sb-*` cookies for Secure + HttpOnly + SameSite=Lax flags. Manual check, no automated test.
- **D-09:** Supabase rate limiting: navigate to Supabase Auth Settings, confirm "Enable rate limiting" is active. Document in UAT checklist. No code change needed.

### Claude's Discretion

- Exact lucide-react icon choice for Today button (options: `CalendarArrowLeft`, `CalendarCheck`, `Home`)
- Tailwind breakpoint for icon → icon+label transition (`md:` is natural default)
- CLS verification: Lighthouse on live Vercel URL via Chrome DevTools or web.dev/measure
- Exact wording of new toast error messages (keep consistent with existing Sonner copy)
- Whether Apply stepper button stays `size="sm"` with explicit `h-9` or becomes `size="default"`

### Deferred Ideas (OUT OF SCOPE)

- Playwright E2E cookie flag assertions against deployed domain
- App-level password reset rate limiting (Supabase default is sufficient)
- PWA / push notifications
- Trend charts / month-over-month view
- Dark mode toggle
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POLSH-01 | Dashboard and all core flows are mobile-responsive with touch targets ≥ 44px | Codebase audit confirms exact files and class names to change: habit-grid.tsx `h-9 w-9`, count.tsx `size="icon"` (= size-9 per button.tsx), right cluster at 375px |
| POLSH-02 | Failed saves surface through error toasts or inline errors — user input is never silently dropped | ReflectionCard has inline Alert block that needs replacement; all four auth forms already use `setError("root")` + `<Alert variant="destructive">` + `aria-live="polite"` pattern |
</phase_requirements>

---

## Summary

Phase 4 is a targeted polish sprint on three already-built areas: (1) mobile layout/touch-target hardening, (2) error surface completeness, and (3) production deploy verification. The codebase is in excellent shape for this phase — the patterns needed for all changes already exist in the repo.

The mobile work has three components. MonthNavigator's `rightCluster` ReactNode is assembled in the RSC `[month]/page.tsx` (lines 87-101) as raw `<Button>` elements with no icon structure yet — these need to be rebuilt with icon + `<span className="hidden md:inline">` label. HabitGrid cells use `h-9 w-9` at line 97 of `habit-grid.tsx` — a one-line change to `h-11 w-11`. CountCard stepper ±buttons use `size="icon"` (which resolves to `size-9` = 36px in this project's button.tsx) — need `className="h-11 w-11"` overrides.

The error UX work is similarly targeted. ReflectionCard has an existing `saveError` state and inline `<Alert>` at lines 43, 69, 74, 143-147 of `reflection-card.tsx` — all four spots need to be removed and replaced with a single `toast.error()` call. All four auth forms already implement the correct pattern (`setError("root")` + `<Alert variant="destructive">` + `aria-live="polite"`) — audit confirms no silent-drop paths exist in any of the four forms.

Production deploy is a human-action workflow: push to main → Vercel auto-deploy → DevTools cookie inspection → Lighthouse CLS check → Supabase rate-limit confirmation.

**Primary recommendation:** Three code-change plans (MonthNavigator mobile, HabitGrid + CountCard touch targets, ReflectionCard toast migration) plus one production deploy + UAT plan. Auth form audit is a read-only verification — all four forms are already compliant, so no code change plan is needed.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| MonthNavigator responsive layout | Browser/Client | Frontend Server (RSC) | rightCluster is a ReactNode assembled server-side in [month]/page.tsx and rendered in the client component MonthNavigator; responsive classes live in the client render |
| HabitGrid touch target sizing | Browser/Client | — | Pure className change in the client component; no server involvement |
| CountCard stepper touch targets | Browser/Client | — | Pure className override in the client component |
| ReflectionCard autosave error | Browser/Client | API/Backend | Client fires the toast; server action (upsertReflectionAction) returns the ActionResult the client branches on |
| Auth form error coverage | Browser/Client | API/Backend | Client displays errors from server action ActionResult via setError("root") |
| Production deploy | CDN/Static | — | Vercel build + deploy; no runtime tier changes |
| Cookie flag verification | CDN/Static | API/Backend | Cookie flags set by @supabase/ssr middleware at the API/server level, delivered by Vercel HTTPS (Secure flag requires HTTPS host) |
| Lighthouse CLS | Browser/Client | CDN/Static | CLS measured in browser; primary source of layout shift risk is client-rendered motion animations and font loading |

---

## Standard Stack

### Core (unchanged from prior phases)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.4 | App Router, RSC, Server Actions | Pinned in CLAUDE.md; no change |
| React | 19.2.4 | UI runtime | Pinned in package.json |
| Tailwind CSS | v4.2 | Utility styling | `@theme` CSS-first config in globals.css; `hidden md:inline` pattern works identically in v4 |
| shadcn/ui | 3.5 (new-york) | Button, Alert, Card primitives | components.json confirmed; style=new-york |
| lucide-react | 0.545.0 | Icons | `CalendarCheck` and `LogOut` confirmed available [VERIFIED: node runtime check] |
| sonner | 2.0.7 | Toast notifications | Already imported in dashboard-shell.tsx; `toast.error()` used at lines 130/153/174/196 |
| @supabase/ssr | 0.10.2 | Cookie management, session refresh | middleware.ts already uses `createServerClient` with `setAll` cookie handler |

### Phase 4 Specific Notes

**Button size="icon" is `size-9` (36px) in this codebase.** [VERIFIED: button.tsx line 28]
The button.tsx `size` variants are:
- `icon: "size-9"` — 36px (NOT 40px as stated in CONTEXT.md's code context)
- `icon-lg: "size-10"` — 40px
- Default: `h-9`

This is important: CONTEXT.md states size="icon" is 40px but the actual button.tsx in this repo uses `size-9` (36px). The touch target gap to 44px (`h-11`) is therefore 8px, not 4px. The correction needed is the same (add `className="h-11 w-11"`), but the baseline was 36px not 40px.

**`CalendarArrowLeft` is NOT available** in lucide-react 0.545.0 installed in this project. [VERIFIED: node runtime check]
Available candidates for Today button: `CalendarCheck` (available), `Home` (available), `CalendarCheck2` (available). `CalendarCheck` is the correct choice per D-01.

---

## Architecture Patterns

### System Architecture Diagram

```
[375px mobile viewport]
         |
    [ProtectedLayout]
    max-w-[720px] px-4
    (16px padding each side = 343px content width)
         |
    [MonthNavigator - client]
    ├── Left: ChevronLeft | h1 | ChevronRight
    └── Right: rightCluster ReactNode (from RSC page)
              ├── Today: <CalendarCheck/> + <span hidden md:inline>Today</span>
              ├── New Goal: <Plus/> + <span hidden md:inline>New goal</span>
              └── Log out: <LogOut/> + <span hidden md:inline>Log out</span>
         |
    [DashboardShell / PastMonthReadOnly / EmptyState / WelcomeToMonth]
         |
    ┌────────────────────────────────────────────────┐
    │ HabitCard                                      │
    │  HabitGrid: 7×44px cells + 6×4px gaps = 332px │
    │  Fits in 343px available ✓                     │
    └────────────────────────────────────────────────┘
    ┌────────────────────────────────────────────────┐
    │ CountCard                                      │
    │  +1 button: h-11 (already correct)            │
    │  Stepper −/+: h-11 w-11 (needs fix)           │
    │  Apply: h-9 (needs fix)                        │
    └────────────────────────────────────────────────┘
         |
    [ReflectionCard - client]
    autosave error path:
      result.ok → setSavedAt()
      !result.ok → toast.error('Reflection not saved — check your connection')
         |
[Vercel Production Deploy]
    ├── HTTPS → @supabase/ssr sets Secure cookie flag automatically
    ├── middleware.ts refreshes session via getUser() on every request
    └── sb-* cookies: HttpOnly + Secure + SameSite=Lax (default by @supabase/ssr)
```

### Recommended Project Structure

No structural changes needed. All Phase 4 changes are modifications to existing files:

```
src/
├── components/
│   ├── month-navigator.tsx          # MODIFY: rightCluster button structure
│   ├── habit-grid.tsx               # MODIFY: h-9 w-9 → h-11 w-11
│   ├── reflection-card.tsx          # MODIFY: remove Alert block, add toast.error
│   └── goal-card/
│       └── count.tsx                # MODIFY: stepper buttons h-11 w-11
├── app/(protected)/dashboard/[month]/page.tsx   # MODIFY: rightCluster ReactNode
e2e/
└── phase4-smoke.spec.ts             # NEW: launch smoke tests
```

### Pattern 1: Responsive Icon+Label Button (rightCluster)

**What:** A Button that shows icon-only on mobile, icon+label on `md:` and up. The icon is always visible. The label is wrapped in `<span className="hidden md:inline">`.

**When to use:** Right cluster navigation buttons in MonthNavigator.

```tsx
// Pattern — applies to Today, New Goal, Log out buttons
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
```

**Key detail:** `size="icon"` gives `size-9` (36px square). This is acceptable for navigation buttons per UI-SPEC (POLSH-01 requires 44px for progress-logging controls specifically, not navigation). The `hidden md:inline` span naturally adds horizontal padding at `md:` — at that point the button is no longer icon-only so the label text is what expands the button width. No extra padding override needed.

**For the Log out form action button (not a Link):**

```tsx
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
```

### Pattern 2: Touch Target Override on Icon Buttons

**What:** Override `size="icon"` (36px) to 44px via explicit className.

**When to use:** Stepper ± buttons in CountCard — progress-logging controls that must meet POLSH-01 44px minimum.

```tsx
// Source: confirmed from button.tsx cva variants — className merges via cn()
<Button
  variant="outline"
  size="icon"
  className="h-11 w-11"   // overrides size-9 to 44px
  aria-label="Decrement stepper"
  disabled={progressDisabled}
  title={progressDisabled ? disabledTitle : undefined}
  onClick={() => !progressDisabled && setStepperValue((v) => v - 1)}
>
  <Minus className="h-4 w-4" />
</Button>
```

**For the Apply button** (currently `size="sm"` = `h-8`; needs `h-9` minimum per D-04):

```tsx
<Button
  variant="outline"
  size="sm"
  className="h-9"   // bumps from h-8 to h-9 (36px minimum)
  onClick={commitStepper}
  aria-label="Commit stepper delta"
>
  Apply
</Button>
```

### Pattern 3: ReflectionCard Toast Migration

**What:** Replace inline `saveError` state + `<Alert>` block with `toast.error()`. Remove three spots: state declaration, setState call in save(), and the JSX conditional.

**Before (current reflection-card.tsx):**
```tsx
const [saveError, setSaveError] = useState<string | null>(null)
// in save():
if (result.ok) {
  setSavedAt(stamp)
  setSaveError(null)
  ...
} else {
  setSaveError(result.error)
}
// in JSX:
{saveError && (
  <Alert variant="destructive" role="alert">
    <AlertDescription>{saveError}</AlertDescription>
  </Alert>
)}
```

**After (Phase 4):**
```tsx
// state declaration: remove saveError line entirely
// in save():
if (result.ok) {
  setSavedAt(stamp)
  // setSaveError(null) removed
  ...
} else {
  toast.error('Reflection not saved — check your connection')
}
// in JSX: remove the saveError Alert block entirely
// Add import: import { toast } from 'sonner'
```

**Also remove:** The `Alert` and `AlertDescription` imports from `@/components/ui/alert` if they are no longer used after removing the block. Verify at edit time.

### Pattern 4: Auth Form Error Pattern (verified compliant — no changes)

All four forms already implement the correct error pattern. Audit confirms:

| Form | `setError("root")` | `<Alert variant="destructive">` | `aria-live="polite"` | Input preserved |
|------|--------------------|---------------------------------|----------------------|-----------------|
| login-form.tsx | Line 37: `setError("root", { message: result.error })` | Lines 97-101 | Line 97 wrapper | RHF uncontrolled = yes |
| signup-form.tsx | Line 63: `setError("root", { message: result.error })` | Lines 147-151 | Line 147 wrapper | RHF uncontrolled = yes |
| reset-password-form.tsx | Line 39: `setError("root", { message: result.error })` | Lines 83-87 | Line 83 wrapper | RHF uncontrolled = yes |
| update-password-form.tsx | Line 36: `setError("root", { message: result.error })` | Lines 88-92 | Line 88 wrapper | RHF uncontrolled = yes |

**No code changes needed for auth forms.** D-06 audit is purely a verification task. The forms are compliant.

### Anti-Patterns to Avoid

- **Stacking the header to two rows on mobile:** D-01 explicitly forbids this. The header must stay single-row at 375px. The icon-only approach ensures this.
- **Adding responsive breakpoints to HabitGrid cell size:** D-03 says unconditional h-11 w-11 — do not add `sm:h-11` or similar. The math confirms it fits at 375px.
- **Using `size="icon"` (36px) for progress-logging buttons:** Only navigation buttons are exempt from 44px minimum. Stepper ±buttons are progress-logging controls and must reach 44px.
- **Keeping the saveError inline Alert in ReflectionCard:** The `<Alert>` block pushes layout down when it appears (potential CLS). The toast approach is CLS-neutral.
- **Using `CalendarArrowLeft` for Today icon:** Not available in lucide-react 0.545.0 in this repo. Use `CalendarCheck`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Responsive label hiding | Custom JS/CSS | `hidden md:inline` Tailwind utility class | Built into Tailwind v4; CSS `display: none` at mobile, `display: inline` at 768px+ |
| Toast error display | Custom error state + Alert | `toast.error()` from sonner | Already installed, already used in dashboard-shell; consistent UX |
| Cookie security flags | Manual cookie setter | `@supabase/ssr` middleware default | Sets HttpOnly + Secure (on HTTPS) + SameSite=Lax automatically per library behavior |
| Rate limiting | Custom rate-limit middleware | Supabase Auth built-in | Already active by default on all Supabase projects per D-09 |
| CLS measurement | Custom performance metrics | Chrome DevTools Lighthouse | Free, accurate, the standard tool for this metric |

**Key insight:** Every "hardening" task in Phase 4 leverages already-installed tooling. There is nothing new to install.

---

## Common Pitfalls

### Pitfall 1: button.tsx `size="icon"` is 36px in this repo, not 40px

**What goes wrong:** CONTEXT.md code context says `size="icon"` is `h-10 w-10` (40px). The actual `button.tsx` in this repo uses `size-9` which is 36px. Planning based on 40px baseline would still produce a correct fix (add h-11 w-11), but the gap is 8px not 4px.

**Why it happens:** shadcn/ui has updated its default button sizes between versions; the installed version here uses `size-9` for the `icon` variant.

**How to avoid:** Always read the actual button.tsx before writing size-related tasks. The fix is the same either way: explicit `className="h-11 w-11"` overrides to 44px.

**Warning signs:** Any test that checks for exactly `h-10` on icon buttons would fail.

### Pitfall 2: `size="icon"` + `className="h-11 w-11"` interaction in shadcn

**What goes wrong:** CVA's `cva()` produces `size-9` from `size="icon"`. When `className="h-11 w-11"` is passed, `cn()` uses `tailwind-merge` to resolve conflicts. `tailwind-merge` resolves `size-9` vs `h-11 w-11` correctly — the explicit `h-11` and `w-11` win over the shorthand `size-9`.

**Why it happens:** `size-9` is a Tailwind shorthand that sets both `h` and `w`. `tailwind-merge` treats the explicit `h-11` and `w-11` as higher priority.

**How to avoid:** This pattern already works in the codebase — the `+1` button uses `className="h-11"` on a `size="lg"` button (line 83-85 of count.tsx). Same principle applies.

**Warning signs:** None expected — if it fails, check the tailwind-merge version.

### Pitfall 3: Secure cookie flag requires HTTPS

**What goes wrong:** `@supabase/ssr` sets the `Secure` flag on cookies only when the request is served over HTTPS. On localhost (HTTP), the `Secure` flag is absent from `sb-*` cookies. Checking cookies locally would give a false negative.

**Why it happens:** This is correct browser/HTTP behavior. `Secure` means "only send over HTTPS".

**How to avoid:** Perform the cookie inspection on the live Vercel URL (HTTPS), not on `localhost`. Vercel deployments always use HTTPS, so the Secure flag will be present on production.

**Warning signs:** Cookie inspection on localhost shows no `Secure` flag — this is correct and expected. Only check on live URL.

### Pitfall 4: CLS from the existing scaleX ProgressBar animation

**What goes wrong:** The ProgressBar uses `motion/react` `scaleX` for the fill animation (from D-23 in Phase 2). `scaleX` runs on the compositor thread and does not cause CLS because it does not change layout dimensions. However, if the ProgressBar's container height is not fixed or the card layout shifts during hydration, CLS can still occur.

**Why it happens:** CLS is measured from initial render. If the server-rendered HTML has a different layout than the hydrated client layout (e.g., ProgressBar container with no explicit height), the shift is counted.

**How to avoid:** Lighthouse will surface any CLS > 0.1 after production deploy. The current implementation uses `scaleX` which is CLS-neutral per the Phase 2 research flag resolution noted in STATE.md. Expect CLS to be low. If Lighthouse flags CLS, the most likely culprit is font loading (Geist via `next/font` is preloaded by Next.js by default).

**Warning signs:** Lighthouse CLS > 0.1 on the live URL.

### Pitfall 5: Vercel env var naming — dual-key convention

**What goes wrong:** This project uses both `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the same value (STATE.md, Phase 01-01 note). The middleware reads `NEXT_PUBLIC_SUPABASE_ANON_KEY ?? NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. If only one is set in the Vercel dashboard, the other falls back correctly — but both must be consistent.

**Why it happens:** Supabase renamed the anon key to "publishable key" in their dashboard UI. The codebase handles both names for backward compatibility.

**How to avoid:** Set both key names to the same value in the Vercel environment variables dashboard. Verify by checking the live app logs after deploy.

**Warning signs:** Auth failures (redirect loop to /login) on the production domain after deploy.

### Pitfall 6: Playwright spec references aria-label not yet updated

**What goes wrong:** `phase3-uat.spec.ts` line 57 uses `getByRole('link', { name: /return to this month/i })` — this matches the current Today button's `aria-label="Return to this month"`. After Phase 4, the Today button is rebuilt with `CalendarCheck` icon + hidden label. If the `aria-label` is moved or removed, this test will fail.

**Why it happens:** Playwright locates elements by aria role + name. Changing the button structure while keeping `aria-label="Return to this month"` preserves the locator.

**How to avoid:** Keep `aria-label="Return to this month"` on the Today button (D-02 already mandates this). The existing Phase 3 UAT test (step 4) will continue passing.

---

## Code Examples

### HabitGrid cell size change (one line)

```tsx
// Source: src/components/habit-grid.tsx line 97 — current
className={cn(
  'flex h-9 w-9 items-center justify-center rounded-md text-xs tabular-nums',
  ...
)}

// After Phase 4
className={cn(
  'flex h-11 w-11 items-center justify-center rounded-md text-xs tabular-nums',
  ...
)}
```

### rightCluster full assembly in [month]/page.tsx

```tsx
// Source: src/app/(protected)/dashboard/[month]/page.tsx lines 87-101 — current structure
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

// After Phase 4 — D-01, D-02
const rightCluster = (
  <>
    {!isCurrent && (
      <Button variant="outline" size="icon" aria-label="Return to this month" title="Return to this month" asChild>
        <Link href={`/dashboard/${currentSegment}`}>
          <CalendarCheck className="size-4" />
          <span className="hidden md:inline">Today</span>
        </Link>
      </Button>
    )}
    {status !== "past" && goals.length > 0 && (
      <NewGoalButton daysInMonthDefault={daysInMonth} />
    )}
    <form action={signOutAction}>
      <Button type="submit" variant="outline" size="icon" aria-label="Log out" title="Log out">
        <LogOut className="size-4" />
        <span className="hidden md:inline">Log out</span>
      </Button>
    </form>
  </>
)
// Add to imports: CalendarCheck, LogOut from 'lucide-react'
```

**Note on NewGoalButton:** The `NewGoalButton` component (`src/components/dashboard-shell.tsx`) is a client component island that renders a `Plus` icon + "New goal" label. D-01 says it also needs the icon-only treatment. Research the NewGoalButton implementation to confirm whether the responsive treatment applies there or only in the RSC rightCluster. Per the CONTEXT.md pattern, the rightCluster passes the NewGoalButton as a ReactNode from RSC — the button's internal label handling may require a separate prop or the same hidden-label wrapper applied externally.

### ReflectionCard imports after migration

```tsx
// Remove these imports if no longer used after removing Alert block:
import { Alert, AlertDescription } from '@/components/ui/alert'

// Add this import:
import { toast } from 'sonner'
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| framer-motion | motion/react | 2025 mid-year | Already using correct import; no change |
| Supabase Auth Helpers (`@supabase/auth-helpers-nextjs`) | @supabase/ssr 0.10.2 | 2024 | Already on correct library; middleware correct |
| Tailwind config.js | CSS-first @theme in globals.css | Tailwind v4 | Already using correct approach |

---

## Codebase Audit: File-by-File Change Summary

This is the definitive list of what needs to change, verified by reading each file.

### `src/components/habit-grid.tsx`
- **Line 97:** `'flex h-9 w-9 items-center...'` → `'flex h-11 w-11 items-center...'`
- **No other changes needed.** Day label header auto-sizes with grid column. ARIA contract untouched.

### `src/components/goal-card/count.tsx`
- **Lines 93-99 (Minus button):** Add `className="h-11 w-11"` to the `size="icon"` Button
- **Lines 109-115 (Plus button):** Add `className="h-11 w-11"` to the `size="icon"` Button
- **Lines 119-123 (Apply button):** Add `className="h-9"` to the `size="sm"` Button (currently `h-8`)
- **Line 83-91 (+1 button):** Already `className="h-11"` — no change needed

### `src/components/reflection-card.tsx`
- **Line 43:** Remove `const [saveError, setSaveError] = useState<string | null>(null)`
- **Line 69:** Remove `setSaveError(null)` from the `if (result.ok)` branch
- **Line 74:** Change `setSaveError(result.error)` to `toast.error('Reflection not saved — check your connection')`
- **Lines 143-147:** Remove the `{saveError && <Alert...>}` block
- **Line 7:** Remove `import { Alert, AlertDescription } from '@/components/ui/alert'` if no longer used
- **Add:** `import { toast } from 'sonner'`

### `src/app/(protected)/dashboard/[month]/page.tsx`
- **Lines 87-101:** Rebuild `rightCluster` with icon + `<span className="hidden md:inline">` pattern
- **Line 29:** Add `CalendarCheck, LogOut` to lucide-react imports
- **Line 29 (verify):** Remove unused imports if `Button` with `size="sm"` is removed from rightCluster

### `e2e/phase4-smoke.spec.ts` (NEW FILE)
- Launch smoke test: viewport at 375px, confirm touch targets visible, confirm right cluster icons visible
- Autosave error path: intercept network, trigger reflection save failure, confirm toast appears
- Production URL test (optional, manual): smoke test steps on live Vercel URL

### `src/components/dashboard-shell.tsx` (potential)
- Read the `NewGoalButton` component implementation to determine if the icon-only responsive treatment needs to be applied there. Research below covers this.

---

## NewGoalButton Responsive Treatment

The `NewGoalButton` is assembled in `rightCluster` from RSC `[month]/page.tsx`. Looking at its import from `dashboard-shell.tsx`, it's a client component. The D-01 decision says the right cluster buttons use icon-only on mobile — this must apply to New Goal as well.

Two implementation options:
1. **Wrap externally in RSC:** The RSC `[month]/page.tsx` wraps `<NewGoalButton>` in a `<div className="[&>button]:h-11 [&>button]:w-11">` or passes a prop that controls label visibility. This is awkward because it requires the RSC to reach into the child component's layout.
2. **Add prop to NewGoalButton:** Add an `iconOnly` boolean or `showLabel` prop to NewGoalButton that toggles the `hidden md:inline` wrapper on the label text. This is the cleaner approach.

The planner should verify the NewGoalButton implementation in `dashboard-shell.tsx` and plan the responsive treatment explicitly. The research confirms the pattern exists and is easy to apply — the decision of which approach to use is left to the planner.

---

## Production Deploy Checklist (for UAT plan)

The following items are human-action checkpoints, not automatable code tasks:

| Step | Action | Pass Criteria |
|------|--------|---------------|
| 1. Env vars | Vercel dashboard → Project → Settings → Environment Variables | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` all set for Production |
| 2. Push to main | `git push origin master` → Vercel auto-deploy | Build succeeds in Vercel dashboard |
| 3. Smoke test | Login → create goal → log progress on live URL | No errors, session persists across page reload |
| 4. Cookie flags | DevTools → Application → Cookies → `sb-*` cookies | Secure + HttpOnly + SameSite=Lax all present |
| 5. Lighthouse CLS | DevTools → Lighthouse → Performance on live URL | CLS < 0.1 |
| 6. Rate limiting | Supabase dashboard → Authentication → Settings | "Enable rate limiting" confirmed active |
| 7. Auth smoke | Reset-password flow on live URL | Email received, link works, password updated |

**Required env vars for Vercel** (from .env.local audit):
- `NEXT_PUBLIC_SUPABASE_URL` — required, browser-exposed
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — required, browser-exposed (or PUBLISHABLE_KEY alias)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — required for fallback chain in middleware
- `DATABASE_URL` — required for Drizzle (server-side only; do NOT prefix NEXT_PUBLIC_)

`E2E_EMAIL` and `E2E_PASSWORD` should NOT be set in Vercel production environment — these are local dev only.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@supabase/ssr` sets HttpOnly + Secure + SameSite=Lax cookie flags by default in production (HTTPS) | Cookie Verification | If wrong, the phase would need a middleware cookie options patch; low risk — this is documented `@supabase/ssr` behavior [ASSUMED: training knowledge, not verified via official docs in this session] |
| A2 | NewGoalButton currently shows text label "New goal" alongside the Plus icon | NewGoalButton section | If wrong (icon-only already), the responsive treatment may already be in place; low risk — planner should read dashboard-shell.tsx NewGoalButton before planning |

**Note:** A1 was not verified by fetching official @supabase/ssr docs in this session. It is consistent with the Phase 1 research and existing codebase comments (`@supabase/ssr` cookie handling note in CONTEXT.md §Established Patterns), but the planner should note this is the one claim requiring DevTools verification on the live URL.

---

## Open Questions (RESOLVED)

1. **NewGoalButton responsive treatment**
   - What we know: `NewGoalButton` is imported from `dashboard-shell.tsx` and rendered in the rightCluster; D-01 mandates icon-only on mobile for all right cluster buttons
   - What's unclear: Whether NewGoalButton currently renders icon+label or icon-only; whether it accepts a `showLabel` prop
   - Recommendation: Planner reads `dashboard-shell.tsx` NewGoalButton definition and plans the responsive prop or external wrapper accordingly
   - **RESOLVED:** Plan 04-02 Task 2 wraps the existing `{label}` in `<span className="hidden md:inline">` inside `dashboard-shell.tsx` NewGoalButton and removes the `mr-2` margin from the Plus icon. No new prop needed — inline wrapper approach.

2. **Vercel project already exists vs. first deploy**
   - What we know: No `.vercel` directory exists in the repo root — the project has NOT been linked to Vercel via CLI
   - What's unclear: Whether the user has an existing Vercel project for this app or needs to create one
   - Recommendation: The UAT plan should include a step to either (a) run `vercel link` to connect to an existing project, or (b) run `vercel` to create a new project. This is a one-time human action.
   - **RESOLVED:** Plan 04-04 Task 2 (human checkpoint) covers both paths — Option A (GitHub integration, push to main auto-deploys) and Option B (`npx vercel` CLI first-time setup). User selects path at execution time.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vercel CLI | Production deploy | Not checked locally | — | Use Vercel GitHub integration (push to main → auto-deploy) |
| Node.js | Build | Available (implied by running project) | — | — |
| Playwright | E2E smoke tests | Available | 1.59.1 in package.json | — |

**No `.vercel` directory found** — the project has not been linked to Vercel via the CLI yet. The deploy approach should use the Vercel GitHub integration (push to main triggers auto-deploy) rather than `vercel deploy` CLI, or the user must run `vercel link` first.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright 1.59.1 |
| Config file | `playwright.config.ts` (project root) |
| Quick run command | `npm run test:e2e -- --grep "phase4"` |
| Full suite command | `npm run test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POLSH-01 | Right cluster icons visible at 375px | Playwright E2E | `npm run test:e2e -- --grep "375px"` | ❌ Wave 0 |
| POLSH-01 | HabitGrid cells are 44px (h-11 computed) | Playwright E2E | `npm run test:e2e -- --grep "touch target"` | ❌ Wave 0 |
| POLSH-01 | Stepper buttons are 44px | Playwright E2E | `npm run test:e2e -- --grep "stepper.*44"` | ❌ Wave 0 |
| POLSH-02 | Reflection autosave failure shows toast | Playwright E2E (intercepted) | `npm run test:e2e -- --grep "autosave.*error"` | ❌ Wave 0 |
| Phase success criterion 3 | Smoke test: login → create goal → log progress on live URL | Manual smoke test | Manual | — |
| Phase success criterion 3 | Cookie flags verified | Manual DevTools | Manual | — |
| Phase success criterion 3 | Lighthouse CLS < 0.1 | Manual Lighthouse | Manual | — |

### Sampling Rate

- **Per task commit:** `npm run test:e2e -- --grep "phase4"` (new phase4 spec only, ~30s)
- **Per wave merge:** `npm run test:e2e` (full suite including phase3-uat.spec.ts, ~2min)
- **Phase gate:** Full suite green before `/gsd-verify-work`; manual UAT checklist completed

### Wave 0 Gaps

- [ ] `e2e/phase4-smoke.spec.ts` — covers POLSH-01 (375px layout), POLSH-02 (toast on autosave failure)
- [ ] Playwright viewport configuration: the existing config uses `devices['Desktop Chrome']` — Phase 4 tests need a separate viewport config for 375px

**Note on viewport:** `playwright.config.ts` uses a single project `chromium` with `devices['Desktop Chrome']` (1280px wide). Phase 4 mobile tests should either add a new `mobile` project or use `page.setViewportSize({ width: 375, height: 812 })` in individual tests.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | @supabase/ssr session management; Supabase Auth rate limiting (D-09) |
| V3 Session Management | yes | @supabase/ssr sets HttpOnly + Secure + SameSite=Lax; middleware.ts calls getUser() on every request |
| V4 Access Control | no | RLS enforced at DB layer (established Phase 1); no new endpoints in Phase 4 |
| V5 Input Validation | yes | Auth forms use Zod schemas via @hookform/resolvers; no new inputs in Phase 4 |
| V6 Cryptography | no | Passwords handled by Supabase Auth; no custom crypto in Phase 4 |

### Known Threat Patterns for this Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Session cookie hijacking | Spoofing | HttpOnly prevents JS access; Secure prevents transmission over HTTP; SameSite=Lax prevents CSRF |
| Session fixation on deploy | Elevation of Privilege | @supabase/ssr middleware rotates tokens via getUser() refresh on every request |
| Rate limit bypass on password reset | Denial of Service | Supabase Auth built-in rate limiting (D-09 confirms enabled) |

---

## Sources

### Primary (HIGH confidence)

- Direct codebase reads (all source files) — verified file-by-file
  - `src/components/habit-grid.tsx` — confirmed `h-9 w-9` at line 97
  - `src/components/goal-card/count.tsx` — confirmed `size="icon"` on stepper buttons
  - `src/components/reflection-card.tsx` — confirmed existing `saveError` state + Alert block
  - `src/app/(protected)/dashboard/[month]/page.tsx` — confirmed rightCluster structure lines 87-101
  - `src/components/ui/button.tsx` — confirmed `size="icon"` = `size-9` (36px)
  - `src/middleware.ts` — confirmed @supabase/ssr usage
  - All four auth form components — confirmed compliant error pattern
  - `e2e/phase3-uat.spec.ts` — confirmed existing test coverage
- `node -e "require('lucide-react')"` — confirmed CalendarCheck=true, LogOut=true, CalendarArrowLeft=false

### Secondary (MEDIUM confidence)

- CONTEXT.md (04-CONTEXT.md) — locked decisions D-01 through D-09
- UI-SPEC.md (04-UI-SPEC.md) — design contract for all Phase 4 changes
- STATE.md accumulated context — Phase 1-3 decisions relevant to Phase 4

### Tertiary (LOW confidence — from training knowledge)

- `@supabase/ssr` cookie flag defaults (HttpOnly + Secure + SameSite=Lax) — consistent with Phase 1 research and codebase comments but not verified via official docs in this session [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed from package.json + node_modules
- Architecture: HIGH — all change locations confirmed from direct file reads
- Pitfalls: HIGH — pitfall 1 (button size) discovered from reading actual button.tsx; others from reasoning over read files
- Production deploy: MEDIUM — cookie flag behavior is assumed but consistent with documentation cited in prior phases

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (stable stack; 30-day validity)
