---
phase: 260503-ter
plan: "01"
subsystem: dashboard-header
tags: [bug-fix, css, responsive, tailwind]
dependency_graph:
  requires: []
  provides: [non-overlapping-right-cluster-buttons]
  affects: [src/app/(protected)/dashboard/[month]/page.tsx]
tech_stack:
  added: []
  patterns: [responsive-button-sizing, icon-to-label-expansion]
key_files:
  modified:
    - src/app/(protected)/dashboard/[month]/page.tsx
decisions:
  - "Replaced size=icon with explicit h-9 w-9 gap-1.5 md:w-auto md:px-3 to mirror NewGoalButton pattern"
metrics:
  duration: ~2min
  completed: 2026-04-29
---

# Phase 260503-ter Plan 01: Fix Overlapping Right-Cluster Buttons Summary

**One-liner:** Replaced `size="icon"` with `className="h-9 w-9 gap-1.5 md:w-auto md:px-3"` on Today and Log out buttons so they auto-grow at md+ without overlapping.

## What Was Done

Edited `src/app/(protected)/dashboard/[month]/page.tsx` — two button changes:

1. **Today button** (line ~91): Removed `size="icon"`, added `className="h-9 w-9 gap-1.5 md:w-auto md:px-3"`.
2. **Log out button** (line ~108): Removed `size="icon"`, added `className="h-9 w-9 gap-1.5 md:w-auto md:px-3"`.

**className breakdown:**
- `h-9 w-9` — preserves 36×36 square below md (icon-only mode, label hidden)
- `gap-1.5` — icon-to-label spacing when label becomes visible at md+
- `md:w-auto` — overrides `w-9` at md+ so button auto-grows to fit label text
- `md:px-3` — restores horizontal padding at md+ for correct visual weight

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1    | 767e9c0 | fix(260503-ter-01): replace size="icon" with responsive className on Today and Log out buttons |

## Verification

- TypeScript: `npx tsc --noEmit` — no errors
- ESLint: `npx eslint src/app/(protected)/dashboard/[month]/page.tsx` — no errors
- `size="icon"` no longer present on either button
- `h-9 w-9 gap-1.5 md:w-auto md:px-3` confirmed at lines 93 and 111

## Viewport Check Results

Confirmed via Playwright screenshots at three viewports on past month (April 2026), future month (June 2026), and current month (May 2026):

| Viewport | Result |
|----------|--------|
| 375px (mobile) | Today and Log out render as clean 36×36 icon-only squares — no overlap, no label visible |
| 900px (md+) | Today and Log out auto-grow to fit text labels (icon + "Today" / icon + "Log out"), proper gap spacing, no overlap, no clipping |
| 1280px (desktop) | Same as 900px — labels visible, buttons sized to content, cluster sits flush-right |

- Past month: Today button renders correctly (non-current month navigation path verified)
- Future month: Button cluster renders correctly
- Current month: Only NewGoalButton + Log out render; no overlap; correct auto-grow at md+
- Fix mirrors NewGoalButton sibling pattern exactly: `h-9 w-9 gap-1.5 md:w-auto md:px-3`

## Deviations from Plan

None — plan executed exactly as written. Two-edit CSS-class change, no structural modifications.

## Self-Check: PASSED

- File exists: `src/app/(protected)/dashboard/[month]/page.tsx` — confirmed
- Commit exists: `767e9c0` — confirmed
- No unexpected file deletions
