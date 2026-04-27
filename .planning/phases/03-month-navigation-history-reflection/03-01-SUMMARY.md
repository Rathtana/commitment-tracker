---
phase: 03-month-navigation-history-reflection
plan: 01
subsystem: time
tags: [date-fns, zod, tdd, vitest, time, schemas, url-segments, reflections]

# Dependency graph
requires:
  - phase: 01-foundations-auth
    provides: src/lib/time.ts with today + monthBucket exports; date-fns + @date-fns/tz installed
  - phase: 02-goal-progress-tracking
    provides: src/lib/schemas/goals.ts as canonical Zod field pattern to replicate

provides:
  - compareMonth(viewed, current): 'past'|'current'|'future' — year/DST/leap-safe month comparator
  - formatMonthSegment(date): 'YYYY-MM' URL segment serializer
  - parseMonthSegment(segment): inverse — UTC midnight first-of-month Date
  - monthSegmentSchema: Zod regex + range refine for /dashboard/[month] URL param validation
  - upsertReflectionSchema: server-side schema with empty/whitespace→null transform (D-30)
  - reflectionFormSchema: client-side schema preserving raw strings for char counter
  - UpsertReflectionInput, ReflectionFormInput type exports

affects:
  - 03-02 (reflection service uses upsertReflectionSchema)
  - 03-03 (month navigation uses compareMonth + formatMonthSegment + parseMonthSegment)
  - 03-04 (route page guards on monthSegmentSchema, parses via parseMonthSegment, branches on compareMonth)
  - 03-05 (Welcome trigger formats month labels via formatMonthSegment)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD: RED tests first (failing import) → GREEN implementation → verify all pass"
    - "Server/client schema split: server schema transforms empty→null (D-30); client schema raw strings for RHF watch"
    - ".nullable() chaining on Zod fields rather than z.union([field, z.null()]) — preserves inner error messages"
    - "formatMonthSegment uses toISOString().slice(0,7) — no date-fns needed for UTC-pinned first-of-month dates"

key-files:
  created:
    - src/lib/schemas/month.ts
    - src/lib/schemas/reflections.ts
    - tests/time.compareMonth.test.ts
    - tests/time.monthSegment.test.ts
    - tests/schemas.month.test.ts
    - tests/schemas.reflections.test.ts
  modified:
    - src/lib/time.ts (appended 3 new exports; existing today/monthBucket untouched)

key-decisions:
  - "compareMonth takes two pre-bucketed UTC Date objects — no userTz param to avoid double-applying offset"
  - "formatMonthSegment uses toISOString().slice(0,7) instead of date-fns format — inputs are already UTC midnight so no TZ conversion needed"
  - "monthSegmentSchema uses .refine() for year/month range — regex alone cannot reject month=13 or year<1970"
  - "upsertReflectionSchema uses .nullable() chaining (not z.union) — z.union loses inner .max() error messages when both branches fail"
  - "Server/client schema split per D-30: server transforms empty→null, client preserves raw strings for char counter"
  - "No new npm dependencies — date-fns isSameMonth/isBefore already available from Phase 1 install"

patterns-established:
  - "time.ts extension pattern: append to existing file, do NOT create src/lib/month.ts (RESEARCH §Open Q3)"
  - "Zod nullable field pattern: z.string().max(N, msg).transform(...).nullable() not z.union([field, z.null()])"

requirements-completed: [MNAV-01, POLSH-04]

# Metrics
duration: 4min
completed: 2026-04-27
---

# Phase 3 Plan 1: Foundations — Time Helpers and Schemas Summary

**Five pure time helpers (compareMonth, formatMonthSegment, parseMonthSegment) plus monthSegmentSchema and split server/client reflectionSchemas, all TDD-locked with 35 passing Vitest assertions.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-27T03:44:47Z
- **Completed:** 2026-04-27T03:48:27Z
- **Tasks:** 2
- **Files modified:** 7 (1 modified, 6 created)

## Accomplishments

- Extended `src/lib/time.ts` with `compareMonth`, `formatMonthSegment`, `parseMonthSegment` — the three pure helpers every downstream Plan 03-03 through 03-05 imports
- Created `src/lib/schemas/month.ts` with `monthSegmentSchema` — the canonical Zod guard for `/dashboard/[month]` URL param validation (regex shape + year/month range refine)
- Created `src/lib/schemas/reflections.ts` with split server/client schemas: `upsertReflectionSchema` (empty→null transform per D-30) and `reflectionFormSchema` (raw strings for char counter)
- 35 test assertions across 4 new Vitest files; full suite 155/155 pass (rls.test.ts pre-existing DB-only exclusion unchanged)

## Task Commits

1. **Task 1: Extend time.ts with compareMonth + formatMonthSegment + parseMonthSegment** - `e5a80c0` (feat)
2. **Task 2: Create monthSegmentSchema + reflectionSchemas + Vitest suites** - `3915ff1` (feat)

## Files Created/Modified

- `src/lib/time.ts` — appended compareMonth, formatMonthSegment, parseMonthSegment; isSameMonth/isBefore added to date-fns import
- `src/lib/schemas/month.ts` — monthSegmentSchema (YYYY-MM regex + 1970–9999 year, 01–12 month refine)
- `src/lib/schemas/reflections.ts` — upsertReflectionSchema (server, empty→null), reflectionFormSchema (client, raw), type exports
- `tests/time.compareMonth.test.ts` — 7 cases: current, past, future, year-boundary ×2, leap-Feb, DST-March
- `tests/time.monthSegment.test.ts` — 8 cases: format ×3, parse ×3, round-trip ×2
- `tests/schemas.month.test.ts` — 11 cases: 4 valid, 7 rejection shapes
- `tests/schemas.reflections.test.ts` — 9 cases: server valid/bad-month/280-limit/empty→null; client empty/limit/over-limit

## Decisions Made

- `compareMonth` takes two pre-bucketed Date objects with no `userTz` param — both inputs are already UTC midnight first-of-month, adding TZ would double-apply the offset
- `formatMonthSegment` uses `toISOString().slice(0, 7)` rather than `date-fns format()` — inputs are UTC-pinned so no conversion needed; simpler and avoids a TZ edge case
- `monthSegmentSchema` uses `.refine()` for range validation — regex `/^\d{4}-\d{2}$/` alone cannot reject month=13 or year=1969
- Server/client schema split per D-30: server schema transforms empty/whitespace→null; client schema preserves raw strings so `reflectionFormSchema` + RHF `watch` can display `whatWorked.length` live

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] z.union loses inner .max() error message — switched to .nullable() chaining**
- **Found during:** Task 2 (schema implementation)
- **Issue:** Plan's `z.union([reflectionFieldServer, z.null()])` pattern causes Zod 4 to report "Invalid input" instead of the UI-SPEC error copy when a string exceeds 280 chars — both union branches fail and Zod surfaces a generic union-level message
- **Fix:** Changed to `reflectionFieldServer.nullable()` chaining; `.nullable()` wraps the same string+transform field without creating a union, so the `.max()` error message propagates correctly
- **Files modified:** `src/lib/schemas/reflections.ts`
- **Verification:** `tests/schemas.reflections.test.ts` "rejects whatWorked over 280 characters" now receives exact UI-SPEC copy; all 20 schema tests pass
- **Committed in:** `3915ff1` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in plan's suggested Zod union pattern)
**Impact on plan:** Fix was necessary to lock the UI-SPEC verbatim error string. No scope creep; the schema's logical contract is identical to the plan spec.

## Issues Encountered

None beyond the Zod union fix above.

## User Setup Required

None — no external service configuration required. All work is pure TypeScript/Zod, no DB touch.

## Next Phase Readiness

- All five time.ts exports ready: `today`, `monthBucket`, `compareMonth`, `formatMonthSegment`, `parseMonthSegment`
- `monthSegmentSchema` ready for Plan 03-04 route page guard
- `upsertReflectionSchema` ready for Plan 03-02/03-03 reflection service re-parse
- `reflectionFormSchema` ready for Plan 03-05 reflection form client-side validation + char counter
- No blockers

## Self-Check: PASSED

- FOUND: src/lib/time.ts
- FOUND: src/lib/schemas/month.ts
- FOUND: src/lib/schemas/reflections.ts
- FOUND: tests/time.compareMonth.test.ts
- FOUND: tests/time.monthSegment.test.ts
- FOUND: tests/schemas.month.test.ts
- FOUND: tests/schemas.reflections.test.ts
- FOUND: .planning/phases/03-month-navigation-history-reflection/03-01-SUMMARY.md
- Commits e5a80c0 and 3915ff1 verified in git log

---
*Phase: 03-month-navigation-history-reflection*
*Completed: 2026-04-27*
