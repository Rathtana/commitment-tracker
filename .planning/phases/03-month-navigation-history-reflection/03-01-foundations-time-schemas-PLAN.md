---
phase: 03-month-navigation-history-reflection
plan: 1
type: execute
wave: 0
depends_on: []
files_modified:
  - src/lib/time.ts
  - src/lib/schemas/month.ts
  - src/lib/schemas/reflections.ts
  - tests/time.compareMonth.test.ts
  - tests/time.monthSegment.test.ts
  - tests/schemas.month.test.ts
  - tests/schemas.reflections.test.ts
autonomous: true
requirements: [MNAV-01, POLSH-04]
tags: [time, schemas, tdd]

must_haves:
  truths:
    - "compareMonth(viewed, current) returns 'past' | 'current' | 'future' and handles year boundaries, DST months, leap years"
    - "formatMonthSegment and parseMonthSegment are inverses — round-trip preserves the canonical 'YYYY-MM' URL shape"
    - "monthSegmentSchema rejects malformed segments ('26-4', '2026-13', '2026-00', '2026-4', 'abc-de', '') and year-out-of-range"
    - "reflectionSchema (server) enforces max(280) per field and transforms empty/whitespace-only strings to null per D-30"
    - "reflectionFormSchema (client) preserves raw strings for counter display (no transform) — split client/server responsibility per D-30 and open-question #2"
  artifacts:
    - path: "src/lib/time.ts"
      provides: "Extended with compareMonth, formatMonthSegment, parseMonthSegment"
      exports: ["today", "monthBucket", "compareMonth", "formatMonthSegment", "parseMonthSegment"]
    - path: "src/lib/schemas/month.ts"
      provides: "Canonical monthSegmentSchema Zod regex for URL segment validation"
      exports: ["monthSegmentSchema"]
    - path: "src/lib/schemas/reflections.ts"
      provides: "upsertReflectionSchema (server, empty→null transform) + reflectionFormSchema (client, raw strings) + types"
      exports: ["upsertReflectionSchema", "reflectionFormSchema", "UpsertReflectionInput", "ReflectionFormInput"]
    - path: "tests/time.compareMonth.test.ts"
      provides: "Vitest suite locking compareMonth behavior across DST/year/leap boundaries"
      contains: "describe('compareMonth"
    - path: "tests/schemas.reflections.test.ts"
      provides: "Vitest suite locking 280-char limit + empty→null transform"
      contains: "describe('upsertReflectionSchema"
  key_links:
    - from: "src/lib/time.ts"
      to: "date-fns"
      via: "import { isSameMonth, isBefore, startOfMonth, format }"
      pattern: "from ['\\\"]date-fns['\\\"]"
    - from: "src/lib/schemas/reflections.ts"
      to: "zod"
      via: "z.string().max(280).transform empty→null"
      pattern: "\\.max\\(280"
---

<objective>
Wave 0 foundation for Phase 3: three new pure time helpers in `src/lib/time.ts` (`compareMonth`, `formatMonthSegment`, `parseMonthSegment`), two new Zod schema modules (`monthSegmentSchema` for the URL segment; `upsertReflectionSchema` + `reflectionFormSchema` for the reflection field), and four Vitest files locking their behavior.

Purpose: Every downstream plan imports these — the route page (Plan 04) guards on `monthSegmentSchema` + parses via `parseMonthSegment` + branches on `compareMonth`; the reflection service (Plan 03) re-parses with `upsertReflectionSchema`; the Welcome trigger (Plan 05) formats month labels. If this contract drifts, every later wave compounds it.
Output: Extended `src/lib/time.ts` + two new schema files + four new test files — all pure, no DB touch, no UI.
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
@.planning/phases/03-month-navigation-history-reflection/03-VALIDATION.md
@CLAUDE.md

<interfaces>
<!-- Existing contracts this plan extends -->

From src/lib/time.ts (Phase 1):
```typescript
import { TZDate } from '@date-fns/tz'
import { startOfMonth, format } from 'date-fns'
export function today(now: Date, userTz: string): string
export function monthBucket(now: Date, userTz: string): Date
```

From src/lib/schemas/goals.ts (Phase 2 pattern for field shapes):
```typescript
export const isoDateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")
// discriminated unions + z.infer type exports at bottom
```

From tests/time.test.ts (Phase 1 D-23 fixture style):
```typescript
describe('today', () => {
  it.each([
    { now: '...', tz: '...', expected: '...', note: '...' },
  ])('$note', ({ now, tz, expected }) => { ... })
})
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend src/lib/time.ts with compareMonth + formatMonthSegment + parseMonthSegment</name>
  <files>src/lib/time.ts, tests/time.compareMonth.test.ts, tests/time.monthSegment.test.ts</files>

  <read_first>
    - /Users/rathtana.duong/gsd-tutorial/src/lib/time.ts (current exports; extend in place, do NOT overwrite)
    - /Users/rathtana.duong/gsd-tutorial/tests/time.test.ts (Phase 1 D-23 fixture-driven `it.each` style to replicate)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-RESEARCH.md §Pattern 3 (compareMonth implementation reference)
  </read_first>

  <behavior>
    compareMonth:
    - Test 1: viewed = April 1 2026 UTC, current = April 1 2026 UTC → 'current'
    - Test 2: viewed = March 1 2026 UTC, current = April 1 2026 UTC → 'past'
    - Test 3: viewed = May 1 2026 UTC, current = April 1 2026 UTC → 'future'
    - Test 4: viewed = December 1 2025 UTC, current = January 1 2026 UTC → 'past' (year boundary)
    - Test 5: viewed = January 1 2026 UTC, current = December 1 2025 UTC → 'future' (year boundary)
    - Test 6: viewed = February 1 2024 UTC (leap), current = March 1 2024 UTC → 'past' (leap year boundary)
    - Test 7: viewed = March 1 2026 UTC (DST spring-forward month in US), current = April 1 2026 UTC → 'past' (DST month)

    formatMonthSegment:
    - Test 8: formatMonthSegment(new Date('2026-04-01T00:00:00.000Z')) === '2026-04'
    - Test 9: formatMonthSegment(new Date('2025-12-01T00:00:00.000Z')) === '2025-12'
    - Test 10: formatMonthSegment(new Date('2024-02-01T00:00:00.000Z')) === '2024-02' (leap)

    parseMonthSegment:
    - Test 11: parseMonthSegment('2026-04').toISOString() === '2026-04-01T00:00:00.000Z'
    - Test 12: parseMonthSegment('2026-04').getUTCDate() === 1 (first of month)
    - Test 13: parseMonthSegment('2025-12').getUTCMonth() === 11 (December = index 11)

    Round-trip:
    - Test 14: formatMonthSegment(parseMonthSegment('2026-04')) === '2026-04'
    - Test 15: formatMonthSegment(parseMonthSegment('2025-12')) === '2025-12'
  </behavior>

  <action>
    Step 1: Write tests FIRST (TDD RED). Create `tests/time.compareMonth.test.ts` and `tests/time.monthSegment.test.ts` mirroring the existing `tests/time.test.ts` `describe` + `it.each` fixture style.

    Step 2: Extend `src/lib/time.ts` by APPENDING (do not modify existing `today` / `monthBucket` exports):

    ```typescript
    import { TZDate } from '@date-fns/tz'
    import { startOfMonth, format, isSameMonth, isBefore } from 'date-fns'

    // ...existing `today` and `monthBucket` exports untouched...

    /**
     * Compare a viewed month (from URL) against the current month (derived from now+tz).
     * Both inputs are Date objects at first-of-month 00:00:00 UTC (per monthBucket contract).
     * No userTz param — both inputs are already bucketed; adding TZ would double-apply offset.
     * Phase 3 D-17 + RESEARCH §Pattern 3.
     */
    export function compareMonth(viewed: Date, current: Date): 'past' | 'current' | 'future' {
      if (isSameMonth(viewed, current)) return 'current'
      if (isBefore(viewed, current)) return 'past'
      return 'future'
    }

    /**
     * Serialize a first-of-month Date to the canonical 'YYYY-MM' URL segment shape.
     * Input MUST be the output of monthBucket() (UTC midnight first-of-month).
     */
    export function formatMonthSegment(month: Date): string {
      return month.toISOString().slice(0, 7)
    }

    /**
     * Inverse of formatMonthSegment. Returns a first-of-month Date at UTC midnight.
     * Callers SHOULD have validated `segment` against monthSegmentSchema first.
     */
    export function parseMonthSegment(segment: string): Date {
      return new Date(`${segment}-01T00:00:00.000Z`)
    }
    ```

    Step 3: Run tests — RED first (import fails), then GREEN after the exports land.

    Do NOT introduce a new `src/lib/month.ts` file — RESEARCH §Open Q3 recommendation + D-discretion: extend `time.ts` in place. File stays small and thematically coherent.
  </action>

  <verify>
    <automated>npx vitest run tests/time.compareMonth.test.ts tests/time.monthSegment.test.ts</automated>
  </verify>

  <acceptance_criteria>
    - `grep -n "export function compareMonth" src/lib/time.ts` returns a match
    - `grep -n "export function formatMonthSegment" src/lib/time.ts` returns a match
    - `grep -n "export function parseMonthSegment" src/lib/time.ts` returns a match
    - `grep -n "export function today" src/lib/time.ts` still returns a match (extension, not rewrite)
    - `grep -n "export function monthBucket" src/lib/time.ts` still returns a match
    - `tests/time.compareMonth.test.ts` exists and contains at minimum 7 distinct test cases (past, current, future, year-boundary past, year-boundary future, leap-Feb, DST-month)
    - `tests/time.monthSegment.test.ts` exists and contains round-trip assertions
    - `npx vitest run tests/time.compareMonth.test.ts tests/time.monthSegment.test.ts` exits 0
    - Do NOT create `src/lib/month.ts` (any such file is a rejection signal)
  </acceptance_criteria>

  <done>
    Five exports present in `src/lib/time.ts` (today, monthBucket, compareMonth, formatMonthSegment, parseMonthSegment). Two test files land with ≥ 7 + ≥ 3 cases respectively. Both test files pass.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create monthSegmentSchema + reflectionSchemas + their Vitest suites</name>
  <files>src/lib/schemas/month.ts, src/lib/schemas/reflections.ts, tests/schemas.month.test.ts, tests/schemas.reflections.test.ts</files>

  <read_first>
    - /Users/rathtana.duong/gsd-tutorial/src/lib/schemas/goals.ts (canonical Zod field pattern: isoDateField, titleField shape — replicate doc header + export style)
    - /Users/rathtana.duong/gsd-tutorial/tests/schemas.goals.test.ts (Vitest Zod assertion style to replicate)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-RESEARCH.md §Code Examples — reflectionSchema + monthSegmentSchema canonical
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-UI-SPEC.md §ReflectionCard counter thresholds + §Error / Rollback Copy (char-limit error string)
  </read_first>

  <behavior>
    monthSegmentSchema:
    - Test 1: safeParse('2026-04').success === true
    - Test 2: safeParse('2025-12').success === true
    - Test 3: safeParse('1970-01').success === true (lower bound OK)
    - Test 4: safeParse('9999-12').success === true (upper bound OK)
    - Test 5: safeParse('26-4').success === false (bad shape)
    - Test 6: safeParse('2026-13').success === false (month 13 out of range)
    - Test 7: safeParse('2026-00').success === false (month 0 out of range)
    - Test 8: safeParse('2026-4').success === false (month must be 2 digits)
    - Test 9: safeParse('abc-de').success === false
    - Test 10: safeParse('').success === false
    - Test 11: safeParse('1969-12').success === false (year below 1970)

    upsertReflectionSchema (server, has transforms):
    - Test 12: safeParse({ month: '2026-04-01', whatWorked: 'ok', whatDidnt: 'ok' }).success === true
    - Test 13: safeParse({ month: 'bad', whatWorked: null, whatDidnt: null }).success === false (bad month)
    - Test 14: safeParse({ month: '2026-04-01', whatWorked: 'x'.repeat(281), whatDidnt: null }).success === false (over 280)
    - Test 15: safeParse({ month: '2026-04-01', whatWorked: 'x'.repeat(280), whatDidnt: null }).success === true (exactly 280)
    - Test 16: safeParse({ month: '2026-04-01', whatWorked: '', whatDidnt: '   ' }).data.whatWorked === null AND .data.whatDidnt === null (D-30 empty/whitespace → null)
    - Test 17: safeParse({ month: '2026-04-01', whatWorked: null, whatDidnt: null }).data.whatWorked === null AND .data.whatDidnt === null

    reflectionFormSchema (client, no transforms):
    - Test 18: safeParse({ whatWorked: '', whatDidnt: '' }).success === true (empty strings allowed for counter display)
    - Test 19: safeParse({ whatWorked: 'x'.repeat(280), whatDidnt: '' }).success === true (at limit)
    - Test 20: safeParse({ whatWorked: 'x'.repeat(281), whatDidnt: '' }).success === false (over limit)
  </behavior>

  <action>
    Step 1: Write tests FIRST (TDD RED).

    Create `tests/schemas.month.test.ts` asserting the 11 monthSegmentSchema cases above (Zod `safeParse` `.success` pattern matching `tests/schemas.goals.test.ts`).

    Create `tests/schemas.reflections.test.ts` asserting the 9 reflection cases above. Use the EXACT error copy string from UI-SPEC.md §Error / Rollback Copy: `"That's a bit long — try trimming it to under 280 characters."` — and assert it in at least one over-280 failure case.

    Step 2: Create `src/lib/schemas/month.ts`:

    ```typescript
    import { z } from 'zod'

    /**
     * Canonical URL-segment schema for /dashboard/[month] (D-03 + Phase 3 RESEARCH §Pattern 1).
     * Enforces 'YYYY-MM' shape AND year/month range.
     * Consumed by: src/app/(protected)/dashboard/[month]/page.tsx (Plan 04).
     */
    export const monthSegmentSchema = z
      .string()
      .regex(/^\d{4}-\d{2}$/, 'Invalid month segment')
      .refine((s) => {
        const [year, month] = s.split('-').map(Number)
        return year >= 1970 && year <= 9999 && month >= 1 && month <= 12
      }, 'Month out of range')
    ```

    Step 3: Create `src/lib/schemas/reflections.ts` with server + client schemas (split per D-30 + RESEARCH Open Q2):

    ```typescript
    import { z } from 'zod'

    /**
     * Canonical Zod schemas for POLSH-04 reflections.
     * Server schema (upsertReflectionSchema) transforms empty/whitespace → null (D-30).
     * Client schema (reflectionFormSchema) preserves raw strings for the char counter + RHF `watch`.
     * Error copy is verbatim from 03-UI-SPEC.md §Error / Rollback Copy.
     */

    // Server-side: empty string → null transform (D-30). Used by upsertReflectionAction re-parse.
    const reflectionFieldServer = z
      .string()
      .max(280, "That's a bit long — try trimming it to under 280 characters.")
      .transform((s) => (s.trim() === '' ? null : s))

    export const upsertReflectionSchema = z.object({
      month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid month'),
      whatWorked: z.union([reflectionFieldServer, z.null()]).optional().transform((v) => v ?? null),
      whatDidnt: z.union([reflectionFieldServer, z.null()]).optional().transform((v) => v ?? null),
    })

    // Client-side: raw strings, no transforms — the counter displays `whatWorked.length` live.
    export const reflectionFormSchema = z.object({
      whatWorked: z.string().max(280, "That's a bit long — try trimming it to under 280 characters."),
      whatDidnt: z.string().max(280, "That's a bit long — try trimming it to under 280 characters."),
    })

    export type UpsertReflectionInput = z.infer<typeof upsertReflectionSchema>
    export type ReflectionFormInput = z.infer<typeof reflectionFormSchema>
    ```

    Step 4: Run tests → they must pass (GREEN).
  </action>

  <verify>
    <automated>npx vitest run tests/schemas.month.test.ts tests/schemas.reflections.test.ts</automated>
  </verify>

  <acceptance_criteria>
    - `src/lib/schemas/month.ts` exists and `grep -n "export const monthSegmentSchema" src/lib/schemas/month.ts` returns a match
    - `src/lib/schemas/month.ts` contains the refine() clause `year >= 1970 && year <= 9999 && month >= 1 && month <= 12`
    - `src/lib/schemas/reflections.ts` exists and contains all four exports: `upsertReflectionSchema`, `reflectionFormSchema`, `UpsertReflectionInput`, `ReflectionFormInput`
    - `grep -n "\.max(280" src/lib/schemas/reflections.ts` returns at least two matches (server + client)
    - `grep -n "That's a bit long — try trimming" src/lib/schemas/reflections.ts` returns at least one match (UI-SPEC verbatim error string)
    - `grep -n "s.trim() === ''" src/lib/schemas/reflections.ts` OR `grep -n "trim()" src/lib/schemas/reflections.ts` returns a match (D-30 empty→null transform)
    - `tests/schemas.month.test.ts` exists with at least 11 test cases
    - `tests/schemas.reflections.test.ts` exists with at least 9 test cases
    - `npx vitest run tests/schemas.month.test.ts tests/schemas.reflections.test.ts` exits 0
  </acceptance_criteria>

  <done>
    Two schema files + two test files committed. All tests pass. Server/client schema split per D-30 in place.
  </done>
</task>

</tasks>

<verification>
Run `npx vitest run tests/time.compareMonth.test.ts tests/time.monthSegment.test.ts tests/schemas.month.test.ts tests/schemas.reflections.test.ts` — all four suites green. `npx vitest run` full suite green (no regression on Phase 1/2 tests).
</verification>

<success_criteria>
- `src/lib/time.ts` exports `today`, `monthBucket`, `compareMonth`, `formatMonthSegment`, `parseMonthSegment` (five pure functions)
- `src/lib/schemas/month.ts` exports `monthSegmentSchema`
- `src/lib/schemas/reflections.ts` exports `upsertReflectionSchema`, `reflectionFormSchema`, `UpsertReflectionInput`, `ReflectionFormInput`
- Four new Vitest test files all pass; full suite regression-free
- No new npm dependencies introduced
</success_criteria>

<output>
After completion, create `.planning/phases/03-month-navigation-history-reflection/03-01-SUMMARY.md` capturing the five new pure helpers + two schema modules, any fixture bugs auto-fixed during test authoring, and the locked D-30 empty→null transform decision.
</output>
