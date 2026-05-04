---
phase: 260503-ter
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(protected)/dashboard/[month]/page.tsx
autonomous: false
requirements:
  - QUICK-260503-ter
must_haves:
  truths:
    - "Header right-cluster buttons (Today, New goal, Log out) do not visually overlap at any viewport"
    - "Below md (<768px), Today and Log out render as 36×36 square icon buttons"
    - "At md+ (>=768px), Today and Log out auto-grow to fit their visible text labels"
    - "NewGoalButton shape (icon + label, auto-grow at md+) is mirrored by the two sibling buttons"
  artifacts:
    - path: "src/app/(protected)/dashboard/[month]/page.tsx"
      provides: "Header right-cluster with non-overlapping responsive buttons"
      contains: "h-9 w-9 gap-1.5 md:w-auto md:px-3"
  key_links:
    - from: "Today button"
      to: "Tailwind responsive sizing classes"
      via: "className replacing size='icon'"
      pattern: "h-9 w-9.*md:w-auto"
    - from: "Log out button"
      to: "Tailwind responsive sizing classes"
      via: "className replacing size='icon'"
      pattern: "h-9 w-9.*md:w-auto"
---

<objective>
Fix overlapping right-cluster buttons on the dashboard month header. The "Today" and "Log out" buttons use shadcn `size="icon"` (fixed `h-9 w-9` square, 36×36 px) but contain `<span className="hidden md:inline">…</span>` labels that become visible at ≥768px and overflow the fixed square, causing visual overlap with the adjacent NewGoalButton.

Purpose: Restore correct visual layout so the header reads cleanly at every viewport.
Output: Two-line CSS class change in the dashboard month page; visual confirmation via screenshots at 375 / 900 / 1280 viewport widths.
</objective>

<execution_context>
@/Users/rathtana/claude-projects/commitment-tracker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/rathtana/claude-projects/commitment-tracker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@src/app/(protected)/dashboard/[month]/page.tsx
@src/components/dashboard-shell.tsx

<interfaces>
<!-- Reference shape: NewGoalButton at src/components/dashboard-shell.tsx:62-84 -->
<!-- Renders WITHOUT size="icon" — auto-grows; this is the pattern to mirror. -->

```tsx
// src/components/dashboard-shell.tsx:71-80 (the pattern)
<Button
  size={size}              // 'default' — auto-grows to fit content
  onClick={() => setOpen(true)}
  className={className}
  aria-label={label}
  title={label}
>
  <Plus className="h-4 w-4" />
  <span className="hidden md:inline">{label}</span>
</Button>
```

<!-- Current broken shape in src/app/(protected)/dashboard/[month]/page.tsx -->
<!-- size="icon" forces 36×36 square; label overflow at md+ causes overlap. -->

```tsx
// Lines 91-103 — Today button (BROKEN)
<Button variant="outline" size="icon" aria-label="Return to this month" title="Return to this month" asChild>
  <Link href={`/dashboard/${currentSegment}`}>
    <CalendarCheck className="size-4" />
    <span className="hidden md:inline">Today</span>
  </Link>
</Button>

// Lines 107-118 — Log out button (BROKEN)
<Button type="submit" variant="outline" size="icon" aria-label="Log out" title="Log out">
  <LogOut className="size-4" />
  <span className="hidden md:inline">Log out</span>
</Button>
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace size="icon" with responsive className on Today and Log out buttons</name>
  <files>src/app/(protected)/dashboard/[month]/page.tsx</files>
  <action>
Edit `src/app/(protected)/dashboard/[month]/page.tsx`. Make exactly two changes:

**Change 1 — Today button (around line 91-103):**
Remove the `size="icon"` prop. Add `className="h-9 w-9 gap-1.5 md:w-auto md:px-3"`. Keep all other props (`variant="outline"`, `aria-label`, `title`, `asChild`) unchanged.

After change:
```tsx
<Button
  variant="outline"
  className="h-9 w-9 gap-1.5 md:w-auto md:px-3"
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

**Change 2 — Log out button (around line 107-118):**
Remove the `size="icon"` prop. Add `className="h-9 w-9 gap-1.5 md:w-auto md:px-3"`. Keep all other props (`type="submit"`, `variant="outline"`, `aria-label`, `title`) unchanged.

After change:
```tsx
<Button
  type="submit"
  variant="outline"
  className="h-9 w-9 gap-1.5 md:w-auto md:px-3"
  aria-label="Log out"
  title="Log out"
>
  <LogOut className="size-4" />
  <span className="hidden md:inline">Log out</span>
</Button>
```

**Why this className shape:**
- `h-9 w-9` — preserves the 36×36 square below md (label hidden, icon-only, matches prior icon-button height)
- `gap-1.5` — adds spacing between icon and label when label appears at md+
- `md:w-auto` — overrides `w-9` at md+ so the button auto-grows to fit the label
- `md:px-3` — restores horizontal padding at md+ (Tailwind `w-9` had no px, `w-auto` needs explicit padding to look right)

This mirrors the NewGoalButton pattern: icon + responsive label + auto-grow container.

**Do NOT:**
- Change anything in `src/components/dashboard-shell.tsx` (NewGoalButton is correct already)
- Touch the conditional rendering logic (`{!isCurrent && ...}`, `{status !== "past" && ...}`)
- Reorder buttons in the cluster
- Change the `<span className="hidden md:inline">` markup — it's correct; only the parent Button wrapper is wrong
- Add new components or extract a helper — this is a 2-line className change
  </action>
  <verify>
    <automated>npx tsc --noEmit && npx eslint src/app/\(protected\)/dashboard/\[month\]/page.tsx</automated>
  </verify>
  <done>
- File `src/app/(protected)/dashboard/[month]/page.tsx` no longer contains `size="icon"` for the Today or Log out buttons
- Both buttons use `className="h-9 w-9 gap-1.5 md:w-auto md:px-3"`
- TypeScript compiles with no new errors
- ESLint reports no new errors on the modified file
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Visual verification at three viewports</name>
  <what-built>
Replaced `size="icon"` with `className="h-9 w-9 gap-1.5 md:w-auto md:px-3"` on the Today and Log out buttons in the dashboard month header. Below md (<768px), buttons render as 36×36 icon-only squares. At md+ (≥768px), they auto-grow to fit the visible text label, matching the NewGoalButton sibling.
  </what-built>
  <how-to-verify>
Dev server is already running on http://localhost:3000.

1. Navigate to a non-current month (so the "Today" button renders) — e.g. http://localhost:3000/dashboard/2026-03 or any prior month with goals.

2. Test mobile viewport (≤375px):
   - Open Chrome/Firefox devtools → toggle device toolbar → set width to 375
   - Confirm: Today and Log out render as small square icon buttons (no text label visible)
   - Confirm: No visual overlap between any header buttons
   - Confirm: NewGoalButton (if rendered) shows only the "+" icon — label hidden

3. Test mid viewport (~900px):
   - Set width to 900 (above the md=768 breakpoint)
   - Confirm: Today, New goal, and Log out all show their text labels alongside icons
   - Confirm: No visual overlap — each button has its own bounding box, separated by the cluster's gap
   - Confirm: Buttons auto-fit their label widths (Today ≠ Log out width; both wider than 36px)

4. Test desktop viewport (1280px):
   - Set width to 1280
   - Confirm: Same as 900 — labels visible, no overlap, clean layout
   - Confirm: Cluster sits flush-right within the header

5. Test current month (no Today button):
   - Navigate to http://localhost:3000/dashboard/2026-04 (current month)
   - Confirm: Only NewGoalButton + Log out render; no overlap; same auto-grow behavior at md+

If Playwright auth state at `e2e/.auth/session.json` is fresh and `E2E_EMAIL`/`E2E_PASSWORD` are set, optional automated screenshot capture:
```bash
npx playwright test e2e/ux-tour.spec.ts --headed --project=chromium
```
Manual viewport check via devtools is the primary verification path.
  </how-to-verify>
  <resume-signal>Type "approved" when no overlap is visible at any viewport, or describe what's still wrong (e.g. "labels still cramped at md", "Today button too wide at 1280")</resume-signal>
</task>

</tasks>

<verification>
1. TypeScript compiles: `npx tsc --noEmit`
2. ESLint clean on modified file
3. Visual: no overlap at 375 / 900 / 1280 viewports (manual check via devtools)
4. Visual: Today and Log out buttons match NewGoalButton's responsive shape (icon-only below md, icon + label at md+)
</verification>

<success_criteria>
- Header right-cluster renders cleanly at every viewport with no button overlap
- Below md: square 36×36 icon buttons (Today, Log out)
- At md+: auto-grown buttons with icon + visible text label (Today, New goal, Log out)
- All three buttons share consistent visual rhythm — same height, similar padding, no jarring size mismatch
- No regressions: kebab menus, month navigator, goal cards, and reflection card all still render correctly
</success_criteria>

<output>
After completion, create `.planning/quick/260503-ter-fix-overlapping-right-cluster-buttons-on/260503-ter-01-SUMMARY.md` capturing:
- Files modified (1 file, 2 buttons)
- Final className applied
- Viewport check results (mobile / mid / desktop)
- Any deviation from plan (none expected)
</output>
