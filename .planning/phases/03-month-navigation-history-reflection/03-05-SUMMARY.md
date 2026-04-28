---
phase: 03-month-navigation-history-reflection
plan: 5
subsystem: ui+service
tags: [welcome, reflection, copy-goals, autosave, debounce, UAT]

# Dependency graph
requires:
  - 03-01 (monthBucket, compareMonth, monthSegmentSchema)
  - 03-02 (ReadOnlyMonthError — copyGoalsFromLastMonth respects past-month guard)
  - 03-03 (upsertReflectionAction, getReflectionForMonth, countGoalsInMonth)
  - 03-04 ([month]/page.tsx TODO stubs for WelcomeToMonth + ReflectionCard)
  - 02 (EmptyState, DashboardShell, NewGoalButton, goals/tasks DB schema)

provides:
  - copyGoalsFromLastMonth service: shells-only, idempotent, target_days clamped (D-21/22/23)
  - copyGoalsFromLastMonthAction: zero-arg server action, revalidatePath layout
  - WelcomeToMonth 'use client': Copy/Start-fresh buttons, Loader2 on pending, inline Alert
  - ReflectionCard 'use client': RHF + zodResolver, debounced autosave (800ms), onBlur flush
  - ReflectionCard char counter: muted < 250, amber 250–279, destructive ≥ 280
  - ReflectionCard Saved indicator: opacity-100 on save, fades after 3s (300ms transition)
  - [month]/page.tsx wired: WelcomeToMonth + ReflectionCard replace TODO stubs
  - Playwright E2E suite: 23 tests covering all Phase 3 UAT steps (e2e/phase3-uat.spec.ts)
  - Seed script: scripts/seed-test-data.mjs for past-month UAT data

affects:
  - Phase 4 (all Phase 3 requirements now verified — Phase 4 can begin)

# Tech tracking
tech-stack:
  added:
    - "@playwright/test": E2E testing suite
    - "scripts/seed-test-data.mjs": one-time DB seed for UAT
  patterns:
    - "serverValuesRef pattern: useRef captures server-loaded initial values; effect only fires autosave when ww/wd differ from those values — prevents React Strict Mode double-invocation spurious save"
    - "TZDate('UTC') for display ops: date-fns addMonths/subMonths/format/getDaysInMonth use local timezone by default; wrapping UTC-midnight Date in TZDate(...,'UTC') forces UTC month arithmetic — fixes month-label-one-behind bug"
    - "Playwright opacity check: opacity:0 is 'visible' to Playwright; check toHaveClass(/opacity-100/) instead of toBeVisible() for opacity-toggled indicators"
    - "locator.clear() + pressSequentially: clear() does Ctrl+A+Delete (fires input event for RHF), pressSequentially types per-keystroke — reliable React Hook Form watch() update in E2E"
    - "shells-only copy: INSERT goals without currentCount/isDone/check_ins — D-21 compliance"
    - "idempotency guard: SELECT COUNT before INSERT in transaction; return alreadyHadGoals:true if target month already has goals — D-23"

key-files:
  created:
    - src/components/ui/textarea.tsx (shadcn install)
    - src/components/welcome-to-month.tsx
    - src/components/reflection-card.tsx
    - tests/actions.copyGoals.test.ts (7 vitest tests)
    - e2e/auth.setup.ts
    - e2e/phase3-uat.spec.ts (23 Playwright tests)
    - playwright.config.ts
    - scripts/seed-test-data.mjs
  modified:
    - src/server/services/goals.ts (+ copyGoalsFromLastMonth)
    - src/server/actions/goals.ts (+ copyGoalsFromLastMonthAction)
    - src/app/(protected)/dashboard/[month]/page.tsx (WelcomeToMonth + ReflectionCard wired; TZDate fix)
    - src/components/month-navigator.tsx (TZDate fix for prev/next href computation)
    - src/components/reflection-card.tsx (serverValuesRef Strict Mode fix; 3s display; 300ms transition)
    - package.json (+ test:e2e, test:e2e:ui scripts)
    - .gitignore (+ playwright artifacts)

key-decisions:
  - "serverValuesRef replaces isMountedRef: React Strict Mode double-invokes effects; isMountedRef is already true on second invocation and triggers a spurious save of initial values. Comparing against server-loaded values instead cleanly handles both Strict Mode and real edits."
  - "TZDate('UTC') for all display ops in [month]/page.tsx and MonthNavigator: date-fns addMonths/subMonths on a UTC-midnight Date uses local timezone offset, causing April 1 00:00 UTC → March 31 PDT → 'March 2026' label + wrong nav hrefs. Fix wraps all display/arithmetic in TZDate(...,'UTC')."
  - "Playwright toHaveClass(/opacity-100/) not toBeVisible(): Playwright considers opacity:0 as visible (only checks display:none / visibility:hidden). The Saved indicator is always in the DOM; class check is the correct way to detect it."
  - "Start-fresh dismiss is React state only: no DB flag, no sessionStorage — D-20 compliance. Revisiting the page shows WelcomeToMonth again (which is correct)."

# Metrics
duration: ~4h (includes Playwright setup, bug investigation, UAT)
completed: 2026-04-27
tasks_completed: 5 (+ UAT + bug fixes)
files_changed: 14
---

# Phase 03 Plan 05: Welcome, Reflection & Copy-Goals — Summary

WelcomeToMonth + ReflectionCard client components, copyGoalsFromLastMonth service/action, route page wiring, full UAT with Playwright automation. Three timezone/autosave bugs found and fixed during UAT.

## Performance

- **Duration:** ~4h (automated execution + UAT + bug investigation)
- **Completed:** 2026-04-27
- **Tasks:** 5 automated + UAT checkpoint
- **Files created/modified:** 14

## Accomplishments

- **Task 1:** shadcn Textarea installed; `copyGoalsFromLastMonth` service appended to `src/server/services/goals.ts` (shells-only, D-21/22/23 compliant); `copyGoalsFromLastMonthAction` zero-arg server action; `tests/actions.copyGoals.test.ts` with 7 vitest tests (all green)
- **Task 2:** `src/components/welcome-to-month.tsx` — Copy/Start-fresh buttons, Loader2 spinner, inline destructive Alert, Start-fresh dismiss via React state only (D-20)
- **Task 3:** `src/components/reflection-card.tsx` — RHF + zodResolver, 800ms debounce, onBlur flush, 280-char counter with three color bands, Saved indicator (300ms fade, 3s display), `serverValuesRef` pattern for Strict Mode safety
- **Task 4:** `src/app/(protected)/dashboard/[month]/page.tsx` — WelcomeToMonth + ReflectionCard replace the two Plan 04 TODO stubs; reflection fetched from `getReflectionForMonth`; `TZDate` applied to all display operations
- **Task 5 (UAT):** Playwright installed; 23-test E2E suite created; 3 bugs found and fixed; 20/23 tests pass (3 correctly skipped — require empty April state)

## Bugs Found and Fixed During UAT

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Month labels one behind (April → "March 2026") | `date-fns` `format()`/`getDaysInMonth()` use local PDT timezone on UTC-midnight Date | Wrap in `TZDate(viewedMonth, "UTC")` before all display ops in `[month]/page.tsx` |
| Navigation arrows skip/wrong month (< from March → January, > from March → March) | `addMonths`/`subMonths` in `MonthNavigator` use local PDT context on UTC-midnight Date | Wrap `viewedMonthIso` in `TZDate(..., "UTC")` before nav href computation |
| Autosave spurious save on page load (Strict Mode dev) | React Strict Mode double-invokes effects; `isMountedRef` already `true` on second invocation | Replace `isMountedRef` with `serverValuesRef` — only save when values differ from server-loaded initial |

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | de88c6e | feat(03-05): install Textarea + add copyGoalsFromLastMonth service/action + tests |
| 2 | 1fa1de3 | feat(03-05): create WelcomeToMonth client component with copy/fresh buttons |
| 3 | 2f37b92 | feat(03-05): create ReflectionCard with RHF + debounced autosave + char counter |
| 4 | d193574 | feat(03-05): wire WelcomeToMonth + ReflectionCard into [month]/page.tsx |

## Playwright E2E Suite

23 tests in `e2e/phase3-uat.spec.ts` covering all 27 UAT steps:
- Steps 1–4: Navigation arrows + keyboard + Today button ✅
- Steps 5–7: Invalid/out-of-bounds routes → 404 ✅
- Steps 8–9: Past-month read-only + mutation guard ✅
- Step 10: April dashboard renders valid content ✅ (steps 11, 13 skipped — need empty April)
- Steps 16–17: Future month cap + disabled steppers ✅ (step 17 skipped — no future goals)
- Steps 18–21: ReflectionCard counter + autosave + past editable + future hidden ✅
- Steps 22–23: Visual regression — no red on past months ✅
- Timezone regression: all 3 month-label tests ✅

Run with: `set -a; source .env.local; set +a && npm run test:e2e`

## Deviations from Plan

- **TZDate fix added (not in plan):** Month label timezone bug discovered during UAT; `TZDate` applied to `[month]/page.tsx` and `MonthNavigator`. Root cause: date-fns uses local timezone on UTC-midnight dates.
- **serverValuesRef pattern (not in plan):** Autosave Strict Mode bug discovered during Playwright UAT; `isMountedRef` replaced with `serverValuesRef` comparison.
- **Playwright suite added (not in plan):** UAT automated via Playwright instead of manual 27-step checklist; permanently available as regression suite.
- **Seed script added (not in plan):** `scripts/seed-test-data.mjs` to populate March/February 2026 test data.

## Self-Check: PASSED

- FOUND: src/components/ui/textarea.tsx
- FOUND: src/components/welcome-to-month.tsx
- FOUND: src/components/reflection-card.tsx
- FOUND: src/server/services/goals.ts (copyGoalsFromLastMonth exported)
- FOUND: src/server/actions/goals.ts (copyGoalsFromLastMonthAction exported)
- FOUND: tests/actions.copyGoals.test.ts (7 tests, all green)
- FOUND: e2e/phase3-uat.spec.ts (23 tests, 20 pass, 3 correctly skipped)
- Commits de88c6e, 1fa1de3, 2f37b92, d193574 all in git log
- `npm run build`: green
- `npx vitest run`: 189/189 tests pass (rls.test.ts pre-existing env gate)
- `npm run test:e2e`: 20 pass, 3 skipped, 0 fail
