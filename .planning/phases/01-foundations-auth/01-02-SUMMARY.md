---
phase: 01-foundations-auth
plan: 02
subsystem: infra
tags: [timezone, pure-functions, vitest, dst, isomorphic, date-fns-tz]

requires:
  - phase: 01-foundations-auth
    plan: 01
    provides: "Vitest 4.x config, @date-fns/tz@1.4.1, date-fns@4.1.0, tests/ dir, src/lib/ dir"
provides:
  - "today(now, userTz) — pure function returning user's local calendar date as 'YYYY-MM-DD'"
  - "monthBucket(now, userTz) — pure function returning a Date at 00:00 UTC on the first day of the user's local month (direct write target for goals.month DATE column)"
  - "tests/time.test.ts — D-23 fixture suite: 11 test cases covering UTC-8/UTC+13/UTC+0 last-day-of-month, DST spring-forward in America/New_York, leap-year Feb 28/29, NYE midnight"
  - "First Vitest suite live in the repo — the passWithNoTests safety net from Plan 01-01 is no longer load-bearing (left on as a harmless default)"
affects: [01-03-schema, 01-04-auth, 02-goals, 02-goal-create, 03-progress, 04-dashboard]

tech-stack:
  added: []
  patterns:
    - "Pure-function time module: `now` and `userTz` are always passed by the caller; the module never reads Date.now(), never touches the filesystem, never reads env vars — making every call deterministic and trivially testable."
    - "TZDate 2-argument constructor: `new TZDate(now.getTime(), userTz)` — timestamp first, IANA zone second. Single-argument form is an anti-pattern (Invalid Date)."
    - "Isomorphic time module: no `'use server'` / `'use client'` directive so both Server Actions (Phase 1) and Client Components (future optimistic-UI work) can import the same function."
    - "DATE-column write shape for Postgres: monthBucket() returns a JS Date where `toISOString().slice(0,10)` yields the exact 'YYYY-MM-DD' first-of-month string — maps cleanly to a `DATE` column with no timezone drift."

key-files:
  created:
    - src/lib/time.ts
    - tests/time.test.ts
  modified: []

key-decisions:
  - "Auto-fixed two DST-dependent fixtures (LA and NY) whose UTC timestamps assumed the wrong DST state for their stated local time. Kept the stated local-time assertions (March 31 LA, March 8 NY) and corrected the UTC input to match actual DST (PDT for LA April 1, EDT for NY March 8 after 2AM → 3AM shift). See Deviations."
  - "Did not touch vitest.config.ts `passWithNoTests: true` — leaving the flag on is harmless now that real tests exist, and removing it is a trivial future pass if CI wants stricter semantics."

patterns-established:
  - "Time module invariant: `monthBucket()` always returns a Date where `getUTCDate() === 1`. This is the app-layer mirror of the DB-layer CHECK constraint that Plan 01-03 will add on `goals.month`."
  - "TDD gate sequence for this plan: `test(01-02): …` (RED) → `feat(01-02): …` (GREEN). Visible in git log as two separate commits on master."

requirements-completed: []  # GOAL-04 touched but not completed — full completion happens in Plan 01-03 when the DB CHECK constraint is enforced.

duration: "~3 min"
completed: 2026-04-19
---

# Phase 01 Plan 02: Pure Isomorphic Time Functions Summary

**Two pure isomorphic functions (`today`, `monthBucket`) using `@date-fns/tz` TZDate + date-fns `startOfMonth`/`format`, locked behind an 11-fixture Vitest suite covering three UTC offsets, DST spring-forward, leap year, and NYE boundaries.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-19T02:17:54Z
- **Completed:** 2026-04-19T02:20:54Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files created:** 2 (`src/lib/time.ts`, `tests/time.test.ts`)

## Accomplishments

- `src/lib/time.ts` exports `today()` and `monthBucket()` — pure, deterministic, isomorphic, zero side effects
- 11/11 Vitest fixtures pass (`npx vitest run tests/time.test.ts` exits 0 with `Tests 11 passed`)
- `npx tsc --noEmit` exits 0 — no type errors
- GOAL-04 app-layer invariant upheld: `monthBucket()` always returns `getUTCDate() === 1` across UTC-8 (PDT DST boundary), UTC+13 (NZDT), UTC+0, and leap-year February
- DST spring-forward correctness demonstrated for `America/New_York` on March 8 2026 (the actual spring-forward day in 2026) — the exercised boundary is EDT, not EST as the research doc's comment originally assumed

## Task Commits

1. **Task 1 (RED): Write D-23 Vitest fixture suite** — `4ce38af` (test) — 7 `today()` + 4 `monthBucket()` fixtures. Verified failing with "Cannot find module '../src/lib/time'"
2. **Task 2 (GREEN): Implement today() + monthBucket()** — `5f7d719` (feat) — canonical TZDate + date-fns implementation; includes Rule 1 fixture bug-fix (see Deviations)

**Plan metadata:** (this commit) — `docs(01-02): complete timezone functions plan`

## Vitest Output

```
 RUN  v4.1.4 /Users/rathtana.duong/gsd-tutorial

 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  19:20:20
   Duration  879ms (transform 26ms, setup 0ms, import 750ms, tests 25ms, environment 0ms)
```

All 11 fixtures:
- `today()` — UTC-8 LA, UTC+13 Auckland, UTC UTC, DST spring-forward NY, leap-year Feb 28, leap-year Feb 29, NYE midnight
- `monthBucket()` — UTC-8 LA last-day-of-month, UTC+13 Auckland last-day-of-month, mid-month UTC, leap-year Feb

## Interface Contract Confirmation

`src/lib/time.ts` exports match the PLAN's `<interfaces>` block verbatim, so Phase 2 and downstream plans can safely import:

```typescript
import { today, monthBucket } from '@/lib/time'

export function today(now: Date, userTz: string): string
export function monthBucket(now: Date, userTz: string): Date
```

- Both functions pure (no `Date.now()`, no env reads, no I/O)
- No `'use server'` / `'use client'` directive — isomorphic
- `@date-fns/tz` + `date-fns` are the only imports

## Files Created/Modified

### Created in Task 1 (commit `4ce38af`)
- `tests/time.test.ts` — 70-line Vitest suite, 11 fixtures across 2 `describe` blocks

### Created in Task 2 (commit `5f7d719`)
- `src/lib/time.ts` — 25-line pure-function module; TZDate + `startOfMonth` + `format` pattern from 01-PATTERNS.md
- `tests/time.test.ts` — bug-fix pass (see Deviations)

## Decisions Made

See `key-decisions` in frontmatter. Summary: two DST fixture-bug fixes (Rule 1) were necessary because the research-doc fixtures used UTC timestamps that didn't actually produce the stated local time under real DST rules. The test *intent* (stated local times at month/day boundaries) was preserved; only the UTC inputs were corrected. This strengthens rather than weakens the DST guarantee — the NY fixture now exercises the actual post-spring-forward EDT boundary rather than a stale pre-spring-forward EST input.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] LA `today()` fixture had wrong UTC timestamp for stated PDT local time**
- **Found during:** Task 2 verification (first vitest run after implementing)
- **Issue:** Fixture used `2026-04-01T07:30:00.000Z` with assertion `today(now, 'America/Los_Angeles') === '2026-03-31'`. The comment tagged it as "UTC-7 DST, or UTC-8 PST", but `2026-04-01T07:30Z` is actually `2026-04-01 00:30 PDT` (UTC-7), not `2026-03-31 23:30`. DST started March 8 2026 → LA is on PDT by April 1. The correct UTC for 11:30 PM March 31 PDT is `2026-04-01T06:30:00.000Z`.
- **Fix:** Changed input timestamp from `07:30Z` to `06:30Z` and rewrote the comment to explicitly cite PDT (UTC-7, DST active).
- **Files modified:** `tests/time.test.ts`
- **Verification:** `today()` fixture passes with the corrected input
- **Committed in:** `5f7d719` (Task 2 commit)

**2. [Rule 1 — Bug] NY DST spring-forward fixture had wrong UTC timestamp + wrong DST tag**
- **Found during:** Task 2 verification
- **Issue:** Fixture used `2026-03-09T04:30:00.000Z` with comment "2026-03-08 23:30 EST (UTC-5, pre-spring-forward)" and assertion `today(now, 'America/New_York') === '2026-03-08'`. But spring-forward in 2026 happens at 2AM March 8 (clocks jump to 3AM EDT), so by 23:30 local March 8 NY is already on EDT (UTC-4). `04:30Z` = 00:30 March 9 EDT (wrong day). Correct UTC for 11:30 PM March 8 EDT is `2026-03-09T03:30:00.000Z`.
- **Fix:** Changed input timestamp from `04:30Z` to `03:30Z` and replaced the comment with an explicit explanation of the spring-forward mechanics (2AM → 3AM, so evening of March 8 is already EDT). This fixture now actually exercises the *post*-spring-forward DST boundary, which is a stronger test than the research doc's pre-spring-forward assumption.
- **Files modified:** `tests/time.test.ts`
- **Verification:** `today()` DST fixture passes with the corrected input; the test still isolates the DST-boundary correctness of TZDate + date-fns `format`.
- **Committed in:** `5f7d719` (Task 2 commit)

**3. [Rule 1 — Bug] LA `monthBucket()` fixture carried the same wrong UTC timestamp as Deviation #1**
- **Found during:** Task 2 verification
- **Issue:** Fixture used `2026-04-01T07:30:00.000Z` with assertion `monthBucket(now, 'America/Los_Angeles').toISOString().slice(0,10) === '2026-03-01'`. Same root cause as Deviation #1 — stated local time (11:30 PM March 31 LA) needs `06:30Z` input, not `07:30Z`, because LA is PDT in April.
- **Fix:** Changed input timestamp from `07:30Z` to `06:30Z` in the `monthBucket()` LA fixture, mirroring the `today()` fix.
- **Files modified:** `tests/time.test.ts`
- **Verification:** `monthBucket()` LA fixture passes; `bucket.toISOString().slice(0,10) === '2026-03-01'`
- **Committed in:** `5f7d719` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — bug fixes in test fixtures copied verbatim from research doc)
**Impact on plan:** Zero scope change. Intent of every fixture is preserved; only the UTC inputs changed to produce the local times the fixtures already asserted. The `Pacific/Auckland` and `UTC` fixtures needed no change — they were already correct. The research doc's text (01-RESEARCH.md lines 746-822) will carry forward this bug into any future copy-verbatim uses; future executors should regenerate DST timestamps with TZDate rather than trusting the doc's comments. Noting this for the research update during phase transition.

## Authentication Gates

None. This plan is pure code + tests; no network, no env vars, no external services.

## Requirements Touched (NOT yet completed)

| Requirement | Target plan | What 01-02 contributes |
|-------------|-------------|------------------------|
| GOAL-04 (goal scoped to month via DATE first-of-month) | 01-03 (schema) | `monthBucket()` produces the exact value that Plan 03's `goals.month` CHECK constraint will validate. App-layer invariant `getUTCDate() === 1` locked behind tests. |

GOAL-04 is not marked complete here — Plan 01-03 ships the actual DB column + constraint that the CHECK enforces.

## Issues Encountered

- First test run after implementing `today()` + `monthBucket()` failed 3/11 fixtures. Root cause was fixture bugs, not implementation bugs (confirmed by manual TZDate calculations). Fixed the fixtures per Rule 1 rather than the implementation, because the test *intent* (stated local times at boundaries) is the authoritative spec per the plan's `<behavior>` section.
- No DST surprises in the TZDate/date-fns behavior itself — every function output matched the manual calculation once the fixture inputs were correct. Recommendation for future DST tests: generate UTC timestamps via `new TZDate(year, month, day, hour, min, 0, tz).getTime()` rather than hand-computing from offsets, so DST state is derived from IANA data rather than comment assumptions.

## User Setup Required

None.

## Next Phase Readiness

**Plan 01-03 (Drizzle schema + RLS migration)** can execute immediately:
- `monthBucket()` is the canonical helper Plan 03's server code will call when writing `goals.month`
- The app-layer invariant (`getUTCDate() === 1`) is test-locked and will align with Plan 03's DB-layer CHECK constraint
- No missing dependencies or unresolved blockers

**Plan 01-04 (auth) and Plan 01-05 (ui-auth)** also unblocked — neither depends on the time module directly, so Plan 02 is strictly additive.

**Known follow-up:** Update `.planning/phases/01-foundations-auth/01-RESEARCH.md` lines 746-822 during phase transition to fix the three DST fixture bugs at source, so later copy-verbatim uses don't re-introduce the issue.

## Self-Check: PASSED

- File check — `test -f src/lib/time.ts` → FOUND
- File check — `test -f tests/time.test.ts` → FOUND
- Commit check — `4ce38af` (Task 1 RED) → FOUND in git log
- Commit check — `5f7d719` (Task 2 GREEN) → FOUND in git log
- Verification — `npx vitest run tests/time.test.ts` → exit 0, 11 passed
- Verification — `npx tsc --noEmit` → exit 0
- Grep check — `src/lib/time.ts` contains `import { TZDate } from '@date-fns/tz'` → MATCH
- Grep check — `src/lib/time.ts` contains `export function today` → MATCH
- Grep check — `src/lib/time.ts` contains `export function monthBucket` → MATCH
- Negative check — `src/lib/time.ts` does NOT contain `'use server'` → OK
- Negative check — `src/lib/time.ts` does NOT contain `'use client'` → OK
- Negative check — `src/lib/time.ts` does NOT contain `Date.now()` → OK

## TDD Gate Compliance

Gate sequence satisfied:
- `test(01-02): add failing test for today() and monthBucket() time functions` — commit `4ce38af` (RED gate)
- `feat(01-02): implement today() and monthBucket() pure time functions` — commit `5f7d719` (GREEN gate, later than RED)
- REFACTOR gate skipped — implementation is already minimal (25 lines, two functions, no duplication worth extracting).

---
*Phase: 01-foundations-auth*
*Plan: 02 — pure isomorphic time functions*
*Completed: 2026-04-19*
