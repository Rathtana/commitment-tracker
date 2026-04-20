# Phase 3: Month Navigation, History & Reflection - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver URL-routed month switching across past, current, and next-month views; honest read-only enforcement on past months at both the API and UI layers; next-month pre-planning; an intentional 1st-of-month "Welcome to [Month]" moment with Copy-from-last-month or Start-fresh; and an optional two-field reflection ("what worked / what didn't") on current and past months.

**In scope:**
- `/dashboard/[month]` dynamic route (`YYYY-MM` segment). `/dashboard` (no segment) redirects to the current month's canonical path.
- Month-nav header: `← [Month Year] →` with a `Today` button shown only when not on current month. Keyboard shortcuts `←` / `→` while dashboard focused.
- Future-month bound: current + 1 only (next month). Prev unbounded.
- Future-month goals: fully mutable (create, edit, delete) until the clock crosses 00:00 on the 1st of that month.
- Past-month read-only at every layer: service 403 on goal/progress writes (generalize the existing `OutOfMonthError` path), UI hides kebab menus entirely, bar/stepper/checkbox/habit-grid are fully frozen with no optimistic wiring, Sonner undo toasts do not mount on past routes.
- Past-month empty deep-link (`/dashboard/[pre-signup-month]`): minimal "No goals in [Month Year]" + "Back to current month" button. No Welcome prompt.
- "Welcome to [Month]" prompt: rendered ONLY when the current month has zero goals AND the immediately prior month had at least one goal. Two buttons — "Copy from last month" and "Start fresh". Click either and the prompt is gone for this month (no persistence needed).
- Copy-from-last-month semantics: new goal rows with `title`, `type`, `target_count`, `target_days`, `notes`, `position` copied. Count `current_count = 0`. Checklist `tasks` copied fresh (`is_done = false`, `done_at = null`). Habit `habit_check_ins` NOT copied. `target_days` carried literally and clamped to the new month's `days_in_month` only when the literal value would exceed it.
- Reflection: bottom-of-list card "Reflection — [Month Year]", two textareas ("What worked" / "What didn't"), 280-char soft limit per field with a live counter, editable on current + past months always, not shown on future months. New `month_reflections` table.

**Not in scope (deferred to Phase 4):**
- Mobile-responsive final pass at 375px and 44px touch targets
- Error-toast / inline-error hardening so failed saves never silently drop input
- Production deploy hardening (cookie flags, CLS, reset rate limiting)

</domain>

<decisions>
## Implementation Decisions

### URL Routing & Navigation

- **D-01:** URL shape is `/dashboard/[month]` where `[month]` is `YYYY-MM` (e.g., `/dashboard/2026-04`). Matches ARCHITECTURE.md §Recommended Project Structure. Deep-linkable, browser back/forward works natively (distinct route segments), and the server component can fetch at the route level using the segment.
- **D-02:** `/dashboard` (no segment) server-side redirects to `/dashboard/[current-month]` computed via `monthBucket(new Date(), userTz).toISOString().slice(0, 7)`. The existing `src/app/(protected)/dashboard/page.tsx` becomes that redirect; the render lives in `src/app/(protected)/dashboard/[month]/page.tsx`.
- **D-03:** Parse + validate the `[month]` segment with Zod (`/^\d{4}-\d{2}$/`) in the route component. Invalid segments render a 404 (or redirect to current month — planner's call; do not swallow silently).
- **D-04:** Month-nav header layout: `← [Month Year] →` with prev-arrow on the left of the title and next-arrow on the right. A `Today` button appears to the right of the next-arrow ONLY when the viewed month is not the current month. This replaces the existing `page.tsx:30` header shape.
- **D-05:** Prev-arrow is always enabled (unbounded history). Next-arrow is disabled (greyed, `aria-disabled="true"`, no click) when viewing current month + 1 (the cap from D-06).
- **D-06:** Future-month bound = **next month only**. Users cannot navigate past current-month + 1. Rationale: simplest mental model, matches "pre-set before month begins" literally, prevents scatter of half-formed plans.
- **D-07:** Keyboard shortcuts: `←` and `→` when the dashboard route is mounted and focus is not in an input/textarea. Respect disabled-arrow state (no-op when at next-month cap).
- **D-08:** `Today` button links to `/dashboard/[current-month]`. Shown only when `viewed_month !== current_month`.

### Future-Month Goals

- **D-09:** Future-month goals (month = current + 1) are **fully mutable** — users can create, edit title/target/tasks/notes, and delete. Identical CRUD surface as current-month goals. No separate "planning mode" concept.
- **D-10:** When the clock crosses 00:00 on the 1st of the planned month, that month becomes "current" (still fully mutable) and the user's prior month transitions from "current" to "past" (enforced by the service-layer month check at request time — no scheduled job).
- **D-11:** Progress logging (increment, toggleTask, markHabit, backfill, undo) is **blocked on future-month goals** — the service already throws `OutOfMonthError` when `goal.month !== monthBucket(now, userTz)`. This is reused unchanged. Users only log progress against the current month. (Future-month goals have `current_count = 0` and no check-ins / no completed tasks until their month arrives.)

### Past-Month Read-Only Enforcement

- **D-12:** Past-month read-only is **layered defense**: (a) service returns 403 on any write touching a past-month goal (generalize the existing `OutOfMonthError` to a broader `ReadOnlyMonthError` — rename or add a sibling error); (b) the UI simply does not render the mutation affordances.
- **D-13:** Past-month goal cards: **hide the kebab menu entirely**. No Edit, no Delete, no "Log for earlier day". The card is visually frozen. This is the cleanest "portfolio of wins" framing per PITFALLS.md §Retention and SUMMARY.md §52.
- **D-14:** Past-month interactive elements (progress bar animation, count stepper, checklist checkboxes, habit grid cells) are **fully frozen, non-interactive**: no hover, no cursor-pointer, no click handlers. Progress bar renders at historical fill with no spring animation. Habit grid cells render hit/miss state but don't respond to taps. `useOptimistic` is NOT wired up on past-month routes.
- **D-15:** Sonner undo toast provider / goal-progress listeners do **not mount** on past-month routes. Zero surface area for a past-month mutation toast.
- **D-16:** Direct deep-link to a past month with no goals (e.g., `/dashboard/2025-12` when the user signed up in 2026-04): render a minimal empty state — headline "No goals in [Month Year]", body "You didn't have goals tracked this month.", and a `Back to current month` button linking to `/dashboard/[current-month]`. No Welcome prompt, no Copy-from-last-month offer on past-empty views.
- **D-17:** The route determines past/current/future via `compareMonth(viewed_month, current_month, userTz)` → `'past' | 'current' | 'future'`. Export this from `src/lib/time.ts` alongside `today` and `monthBucket`. Pure function, Vitest fixture suite extends the Phase 1 D-23 pattern.

### Welcome to [Month] + Copy-from-Last-Month

- **D-18:** The "Welcome to [Month]" prompt renders ONLY when all three are true: (a) viewed_month is current OR future; (b) viewed_month has zero goals for this user; (c) the immediately prior month has at least one goal for this user. So a first-ever user (no prior goals) sees Phase 2's existing empty state, not the Welcome. A returning user on the 1st of a new month sees Welcome if they haven't pre-planned.
- **D-19:** Welcome layout: a distinct card above the empty state (or replacing the empty state entirely when it triggers). Copy: `"Welcome to [Month Year]."` headline; body `"Carry forward from [Prior Month] or start fresh?"`; two buttons — primary `"Copy from last month"` and secondary `"Start fresh"`.
- **D-20:** `"Start fresh"` dismisses the prompt for the current page session only (React state). No DB flag, no session-storage write. Once the user creates any goal, the Welcome trigger becomes false naturally and won't reappear.
- **D-21:** `copyGoalsFromLastMonth(userId, fromMonth, toMonth, userTz)` server action copies goal shells: for each goal in `fromMonth`, INSERT a new `goals` row in `toMonth` with `title`, `type`, `target_count`, `target_days`, `notes`, `position` copied. Count `current_count = 0`. Checklist → INSERT fresh `tasks` rows with `label`, `position` copied but `is_done = false`, `done_at = null`. Habit → NO `habit_check_ins` copied (each month is a fresh habit month). `progress_entries` NOT copied. All in one transaction. Server re-derives `toMonth` from `monthBucket` — month is not trusted from the client.
- **D-22:** Habit `target_days` on copy: carry the literal value UNLESS it exceeds the new month's `days_in_month` (e.g., copying `target_days=31` from a 31-day month to a 30-day month), in which case clamp to `days_in_month`. Most users chose a number below 28 so this clamp rarely fires.
- **D-23:** Copy is idempotent at the business level: the Welcome prompt only renders when the target month is empty, so the user cannot double-click copy into duplicate rows. If a race condition slips through (double-click), the transaction tolerates it — re-checking `SELECT COUNT(*) FROM goals WHERE user_id=? AND month=?` before insert and aborting if non-zero, returning the existing goal list.

### Reflection Field (POLSH-04)

- **D-24:** New table `month_reflections`:
  ```sql
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid()
  user_id        uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE
  month          DATE        NOT NULL CHECK (EXTRACT(DAY FROM month) = 1)
  what_worked    text        NULL
  what_didnt     text        NULL
  created_at     timestamptz NOT NULL DEFAULT now()
  updated_at     timestamptz NOT NULL DEFAULT now()
  UNIQUE (user_id, month)
  ```
  RLS: all four CRUD ops restricted to `user_id = auth.uid()` via `crudPolicy()` co-located with the schema (D-20 of Phase 1 pattern).
- **D-25:** Reflection card placement: bottom of the goal list in the 720px single-column layout. Title: `"Reflection — [Month Year]"`. Two textareas stacked vertically: `"What worked"` (placeholder: `"One thing that went right…"`) and `"What didn't"` (placeholder: `"One thing to change next month…"`). Visual weight = equivalent to a goal card but with a muted background or different border to distinguish it.
- **D-26:** 280-character soft limit per field (tweet-sized — honors the "two-line" spirit of POLSH-04). Live character counter under each textarea in muted text; turns amber at 250, red at 280, submit hard-blocks above 280. Server re-validates via Zod in `src/lib/schemas/reflections.ts`.
- **D-27:** Reflection is **editable on current and past months always** — no lock after month-end, no restriction to a "last N days" window. Users can revise years later. Respects user autonomy and legitimate late additions. The past-month read-only rule applies to goals and progress math, not to the retrospective reflection.
- **D-28:** Reflection is **not shown on future months** (nothing to reflect on yet). Route-level check: if `compareMonth(viewed_month) === 'future'`, don't render the Reflection card.
- **D-29:** Save UX: debounced autosave (server action on blur or after ~800ms idle), no explicit Save button. Use the same `{ ok: true } / { ok: false, error }` action shape as `src/server/actions/auth.ts` and `src/server/actions/goals.ts`. Show a small "Saved" indicator briefly on success. Phase 2's baseline optimistic-UI error handling applies; Phase 4 hardens.
- **D-30:** Empty reflection = no row in `month_reflections`. UPSERT on first save via `ON CONFLICT (user_id, month) DO UPDATE`.

### Claude's Discretion

- Exact 404 vs redirect behavior for an invalid `[month]` segment (D-03) — planner's call, but do not swallow silently
- Whether the Welcome prompt replaces the empty state or renders above it (both are acceptable; the decision hinges on visual weight and copy voicing)
- Exact copy voicing for Welcome headline/body, reflection placeholders, past-empty-month copy
- Animation details for month transitions (motion `<AnimatePresence>` on the dashboard content between month routes is nice-to-have but not required — success criterion #1 doesn't demand animation)
- Prev/next arrow icon choice (lucide-react `ChevronLeft` / `ChevronRight` likely)
- Whether the `ReadOnlyMonthError` is a rename of `OutOfMonthError` or a new sibling class — either is fine, naming is planner's preference
- Exact debounce timing for reflection autosave (somewhere 500–1000ms)
- Whether `compareMonth` lives in `src/lib/time.ts` or a new `src/lib/month.ts` — pattern preference
- The visual distinction between the Reflection card and goal cards (muted border, background tint, icon prefix — all acceptable)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope & Requirements
- `.planning/ROADMAP.md` §Phase 3 — Goal statement, success criteria, requirement mapping (GOAL-05, MNAV-01..04, POLSH-04)
- `.planning/REQUIREMENTS.md` §Goals (GOAL-05), §Month Navigation & History (MNAV-01..04), §Polish (POLSH-04) — acceptance criteria per requirement

### Stack & Architecture (unchanged from Phase 1/2 — do not re-decide)
- `CLAUDE.md` §Technology Stack — Pinned versions: Next 16.2.4, React 19.2.5, Tailwind 4.2.2, shadcn 3.5, Motion 12.38, Supabase, Drizzle 0.45, Zod 4.3, date-fns 4.1, `@date-fns/tz`
- `.planning/research/ARCHITECTURE.md` §Recommended Project Structure (lines 66–105) — `/dashboard/[month]/` URL shape justification, lib/month.ts colocation, server-component month fetch
- `.planning/research/ARCHITECTURE.md` §Pattern 4 (Month-Scoped Queries with `date_trunc('month', ...)`) — `goals.month` as `DATE` first-of-month, exact-match queries
- `.planning/research/ARCHITECTURE.md` §Component Responsibilities (line 57) — Month Navigator is a Client Component reading month from URL; Domain Services enforce read-only at service layer, not UI-only

### Pitfalls to Prevent in This Phase
- `.planning/research/PITFALLS.md` §Pitfall 4 (Month-boundary UX makes users feel they lost data) — Drives D-18..D-20 Welcome prompt design, D-21 copy-forward-without-progress, D-19 explicit affordance not silent rollover
- `.planning/research/PITFALLS.md` §Debt line 181 ("Defer past-months read-only enforcement to UI only — NEVER; enforce on the API not just the button state") — Drives D-12 layered defense
- `.planning/research/PITFALLS.md` §"Looks Done But Isn't" line 259 — Verify by sending a PATCH to a past-month goal; must 403
- `.planning/research/PITFALLS.md` §Pitfall-to-Phase Mapping line 303 (Past-month editability) — Server returns 403 on writes, not just UI disabled
- `.planning/research/PITFALLS.md` §Pitfall 1 (Streak anxiety / no punishing UX) — Past months are a portfolio of wins, not a regret trigger. No red X on past-month habit grids, no "you missed N days last month" framing anywhere.
- `.planning/research/SUMMARY.md` §Phase 3 (lines 111–117) — Research synthesis: `getMonthDashboard` query reuse, server-side write guard is the difference, explicit Welcome prompt with Copy/Fresh, three empty-state variants

### Phase Foundations (locked — do not re-decide)
- `.planning/phases/01-foundations-auth/01-CONTEXT.md` — Schema CHECK (`goals.month = first of month`), timezone strategy (`today` / `monthBucket`), Supabase CLI + drizzle-kit migration flow, RLS `crudPolicy()` pattern, middleware, `user.timezone` per-user auth
- `.planning/phases/02-goals-dashboard-three-types/02-CONTEXT.md` — Polymorphic `goals` + typed children (`tasks`, `habit_check_ins`, `progress_entries`), `getMonthDashboard(userId, month)` already parameterized on month (reuse for past/current/future), `OutOfMonthError` pattern in services (generalize for Phase 3), identical progress-bar component across types, Motion spring-physics custom component, dashboard layout 720px single column, Tailwind v4 `@theme` tokens (never override `--spacing-*`), Vitest pure-function testing
- `.planning/phases/02-goals-dashboard-three-types/02-UI-SPEC.md` (if present) — Card anatomy, header shape, empty-state visual language. Phase 3 extends without contradicting.

### Codebase Integration Points (already in repo)
- `src/lib/time.ts` — `today(now, userTz)`, `monthBucket(now, userTz)`. Phase 3 extends with `compareMonth(viewed, current, userTz): 'past' | 'current' | 'future'` and month-string parse/format helpers.
- `src/server/db/queries.ts` — `getMonthDashboard(userId, month)` already parameterized. Phase 3 calls it with ANY valid month (past/current/future) unchanged.
- `src/server/db/schema.ts` — Existing Drizzle schema. Phase 3 adds `month_reflections` table + RLS policies via `crudPolicy()`.
- `src/server/services/progress.ts` + `src/server/services/goals.ts` — Existing `OutOfMonthError` at line 19 of progress.ts. Phase 3 generalizes (rename or sibling) to `ReadOnlyMonthError` with a layered message and applies it to ALL write paths for past months.
- `src/app/(protected)/dashboard/page.tsx` — Current entry point. Phase 3 converts this into the `/dashboard` → `/dashboard/[current-month]` redirect and creates `src/app/(protected)/dashboard/[month]/page.tsx` for the real render.
- `src/lib/schemas/` — Pattern for canonical Zod schemas (`auth.ts`, `goals.ts`). Phase 3 adds `reflections.ts` + a shared `monthSegmentSchema` for the URL segment.
- `src/components/dashboard-shell.tsx`, `src/components/empty-state.tsx` — Existing dashboard chrome. Phase 3 extends with a `MonthNavigator` header component and a `WelcomeToMonth` card. Existing `EmptyState` stays as the zero-goals-ever variant; new `PastEmptyState` covers D-16.

### Project-Level Constraints
- `.planning/PROJECT.md` §Core Value, §Constraints, §Key Decisions — Visual feedback is the draw, month-scoped, past months read-only (Key Decision), manual logging only
- `.planning/STATE.md` §Accumulated Context — Prior decisions carried forward

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`src/lib/time.ts`** — `today(now, userTz)` and `monthBucket(now, userTz)` are pure and tested (Phase 1 D-13, D-23). Phase 3 imports both and extends with `compareMonth(viewed, current, userTz)` and `formatMonthSegment(month): 'YYYY-MM'` / `parseMonthSegment('YYYY-MM'): Date`.
- **`src/server/db/queries.ts`** — `getMonthDashboard(userId, month)` is already parameterized on month. Phase 3 calls it with past/current/future months unchanged. The `< 30 lines of SQL` budget (PITFALLS §3) holds.
- **`src/server/services/progress.ts`** + **`src/server/services/goals.ts`** — `OutOfMonthError` already enforces "current month only" for progress writes. Phase 3 generalizes this: rename to `ReadOnlyMonthError` (or add sibling) and apply to `updateGoal`, `deleteGoal`, `createGoal` (block past-month creation) in addition to all progress paths. Future-month goals remain fully mutable; progress writes on them continue to throw because `goal.month !== monthBucket(now, userTz)`.
- **`src/server/db/schema.ts`** — Phase 3 adds a single new table (`month_reflections`) following the Phase 1 RLS pattern (`crudPolicy()` co-located). No changes to existing tables.
- **`src/app/(protected)/dashboard/page.tsx`** — Current static current-month page. Phase 3 repurposes this file as the `/dashboard` → `/dashboard/[current-month]` redirect and moves the real render to `[month]/page.tsx`.
- **`src/components/dashboard-shell.tsx`**, **`empty-state.tsx`**, **`earlier-day-popover.tsx`** — Phase 2 dashboard chrome. Phase 3 adds `MonthNavigator.tsx` (header prev/next/today + keyboard listener), `WelcomeToMonth.tsx` (the Copy/Fresh card), `PastEmptyState.tsx` (the D-16 "No goals in [Month]" view), and `ReflectionCard.tsx` (the two-textarea bottom card).
- **shadcn primitives already installed:** `Alert, Button, Card, Form, Input, Label, Dialog, AlertDialog, DropdownMenu, Sonner, Checkbox, Popover`. Phase 3 needs: `Textarea` (for reflection), possibly `Skeleton` for month-transition loading. No new external libraries.
- **Zod canonical schemas** — `src/lib/schemas/auth.ts` + `goals.ts` blueprint. Phase 3 adds `reflections.ts` (`reflectionSchema` with 280-char soft limits) and exports a shared `monthSegmentSchema` (regex `/^\d{4}-\d{2}$/`).

### Established Patterns

- **Zod canonical schemas** shared across client form resolver + server action re-validation (pattern from 02-CONTEXT.md D-20)
- **Drizzle schema as source of truth** for tables AND RLS policies via `crudPolicy()`; `drizzle-kit generate` emits to `./supabase/migrations/`; `supabase db push --linked` propagates (Phase 1 D-09, Phase 2 D-09). Same pattern for the new `month_reflections` table.
- **Server-authoritative month** — server actions NEVER trust month from the client body; they re-derive via `monthBucket(new Date(), userTz)` or validate a client-passed month against known state. Copy-from-last-month server action resolves `fromMonth = monthBucket(new Date(), userTz) - 1 month` server-side.
- **`@supabase/ssr` session refresh** in `middleware.ts`; every server action calls `getSupabaseServerClient().auth.getUser()` to resolve `userId`. RLS = defense in depth; services still assert ownership.
- **Route group convention** — `src/app/(protected)/dashboard/*` (gated by middleware). `src/app/(protected)/dashboard/[month]/page.tsx` inherits this. The literal `dashboard` segment has meaning to middleware, per STATE.md Plan 01-05 lesson.
- **Tailwind v4 `@theme` tokens** in `src/app/globals.css`. Phase 3 introduces no new core tokens. Reuse the muted/background/border scale already defined.
- **Vitest pure-function testing** — `src/lib/time.ts` already has the D-23 fixture suite. Extend for `compareMonth` with fixtures covering: current month, current-1 (past), current+1 (future), DST month, leap year Feb boundary.

### Integration Points

- **`src/app/(protected)/dashboard/page.tsx`** becomes a 1-line server-side redirect to `/dashboard/[current-month]`. No other routes consume this path today.
- **`src/app/(protected)/dashboard/[month]/page.tsx`** is the new real render. Receives `params.month` as `'YYYY-MM'`; validates via `monthSegmentSchema`; computes `viewedMonth = parseMonthSegment(params.month)`; calls `compareMonth(viewedMonth, monthBucket(now, userTz), userTz)` to branch into past / current / future views.
- **`src/server/services/progress.ts`** — `OutOfMonthError` generalization touches `incrementCount`, `backfillCount`, `toggleTask`, `upsertHabitCheckIn`, `undoLastMutation`. Add equivalent guards in `src/server/services/goals.ts` for `updateGoal` (block past-month) and `deleteGoal` (block past-month). Goal creation for past months is blocked by the same rule (past is immutable).
- **`middleware.ts`** — No changes expected; `/dashboard/[month]` lives under the same `(protected)` route group and authentication gate.
- **`src/lib/time.ts`** — Extend in-place. All new helpers (`compareMonth`, `formatMonthSegment`, `parseMonthSegment`) are pure and test-covered.
- **`src/server/db/schema.ts`** — Append `month_reflections` and its `crudPolicy()` call. `drizzle-kit generate` picks it up; `supabase db push --linked` applies.
- **`src/server/actions/`** — Add `reflections.ts` (upsertReflectionAction) and extend the existing actions file for copy-from-last-month (`copyGoalsFromLastMonthAction`). Past-month mutation attempts in existing actions now surface `ReadOnlyMonthError` → 403 response shape.

</code_context>

<specifics>
## Specific Ideas

- **URL shape is the deep-linking contract.** `/dashboard/[YYYY-MM]` is canonical. Every internal link in the app (prev, next, Today, back-to-current) must emit this shape. If the planner is tempted to use query params or client-only state, reject — success criterion #1 requires deep links and browser back/forward to work.
- **Past months are a portfolio of wins, never a regret trigger.** Hide kebabs, freeze interactions, no red X anywhere, no "you missed N days" framing. PITFALLS §Pitfall 1 is unambiguous: past-month UX must never punish. Same design philosophy as Phase 2 habit grid.
- **Layered defense or bust.** Service-layer 403 on past-month writes is not optional. The UI hiding the kebab is insufficient — a replayed network request, a curl, or a bug in the client must not corrupt history. The planner MUST include a test that sends a PATCH directly to a past-month goal and asserts a 403/error response (PITFALLS §line 259 acceptance test).
- **Welcome prompt is research-locked.** PITFALLS §Pitfall 4 identifies silent month rollover as a product-feel failure. The "Welcome to [Month]" with Copy/Fresh is a first-class design decision, not optional polish. Test at a real month transition before declaring Phase 3 done.
- **Copy is shells, never progress.** Progress on a new month is earned, not transferred. `current_count = 0`, `tasks.is_done = false`, no `habit_check_ins` copied, no `progress_entries` copied. SUMMARY.md line 116 explicitly warns against the copy-forward anti-pattern.
- **Server re-derives `fromMonth` and `toMonth`.** Client never dictates which months participate in the copy. Server computes `toMonth = monthBucket(new Date(), userTz)` and `fromMonth = toMonth - 1 month`. Closes a class of timezone/replay bugs.
- **Reflection is retrospective, not load-bearing.** Editable always, no lock, no month-end trigger. The "what worked / what didn't" is honest journaling, not a completion artifact. POLSH-04's "two-line" constraint is honored by the 280-char-per-field soft limit.
- **Future = next month only.** The user chose a tight bound deliberately. Plans scattered 6 months out degrade the monthly rhythm. If users push back on this in Phase 4+ dogfooding, the bound can widen — but start tight.
- **No copy-forward anti-pattern.** Never auto-duplicate goals into a new month. Always user-initiated (Welcome prompt → Copy button). Silent carry is explicitly rejected by PITFALLS §Pitfall 4.

</specifics>

<deferred>
## Deferred Ideas

- **Month-picker dropdown / calendar for distant navigation** — Prev/next arrows + Today button are sufficient for v1. Add a picker in Phase 4+ if users complain about arrow-click fatigue deep in history.
- **Unlimited / 3-months-forward pre-planning** — Rejected in favor of next-month-only (D-06). Revisit post-launch if users request it.
- **Persistent "Start fresh" dismissal (DB flag or sessionStorage)** — Rejected; once a goal exists, the Welcome trigger is false anyway. Reconsider if users report prompt-resurrection bugs.
- **Copy-goal-to-current-month action from a past-month view** — Requires a past-month kebab with a narrow "Copy to current" item. Adds scope. Evaluate in Phase 4+ based on usage.
- **Telemetry on Welcome prompt interactions** — "Copy clicked" vs "Start fresh" vs "dismissed by creating a goal" would inform whether the default should flip. Defer; no analytics infra in v1.
- **End-of-month reflection push notification / email prompt** — Out of scope (no notifications in v1 per PITFALLS §Integration and PROJECT.md out-of-scope).
- **Mobile 375px pass on the new month-nav header, Welcome card, Reflection card** — Phase 4 (POLSH-01).
- **Error-toast hardening for reflection autosave failures** — Phase 2 ships baseline optimistic behavior; Phase 4 (POLSH-02) hardens. Phase 3 ships acceptable defaults.
- **`ReadOnlyMonthError` → HTTP 403 response shape standardization** — Planner decides whether this is a `{ ok: false, error: { code: 'READ_ONLY_MONTH' }}` convention or a status-code change. Either is acceptable; keep it consistent with Phase 2's action-result shape.
- **Animated month transitions (Motion `<AnimatePresence>`)** — Nice-to-have visual flourish but not a requirement; success criterion #1 doesn't demand animation. Planner's call to include or defer.
- **Reflection rich-text or multi-field structure** — v1 is two plain-text fields. Per-goal reflections or rich text are v2 (REQUIREMENTS.md v2 NOTE-01 has a related per-goal-notes concept).

</deferred>

---

*Phase: 03-month-navigation-history-reflection*
*Context gathered: 2026-04-20*
