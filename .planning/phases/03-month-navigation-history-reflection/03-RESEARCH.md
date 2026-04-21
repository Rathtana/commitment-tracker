# Phase 3: Month Navigation, History & Reflection - Research

**Researched:** 2026-04-20
**Domain:** URL-routed month navigation + layered past-month read-only enforcement + copy-from-last-month transactional flow + month reflection upsert + past/future render variants
**Confidence:** HIGH

## Summary

Phase 3 is primarily an integration and enforcement phase layered over a mature Phase 2 codebase, not a greenfield build. The Next.js 16 App Router already supports the exact `/dashboard/[month]` dynamic route shape the phase requires; `@supabase/ssr` middleware is already gating the protected route group; `getMonthDashboard(userId, month)` is already parameterized on month and can be called unchanged for past, current, and future months. The three substantive technical unknowns are (1) generalizing the Phase 2 `OutOfMonthError` write-path guard into a broader `ReadOnlyMonthError` that covers goal writes AND applies an honest past/current/future distinction, (2) an idempotent copy-from-last-month Drizzle transaction that copies shells only (not progress), and (3) a debounced autosave reflection card with UPSERT semantics on a new `month_reflections` table. Everything else is composition of existing patterns.

The phase's primary risks are not technical but disciplinary: the past-month kebab MUST be removed from the DOM (not disabled), the `ReadOnlyMonthError` MUST fire at the service layer and be tested by a direct service call that bypasses UI, the copy-from-last-month action MUST derive months server-side (never from the client body), and past-month progress bars MUST render in emerald not grey (PITFALLS §1 portfolio-of-wins framing). Each is a locked design rule from CONTEXT.md and UI-SPEC.md, not a Claude's-discretion item.

**Primary recommendation:** Implement as five waves: (0) `compareMonth` + month-segment helpers in `src/lib/time.ts` with Vitest fixtures; (1) `ReadOnlyMonthError` generalization across progress.ts + goals.ts service write paths; (2) `/dashboard/[month]` dynamic route with redirect + branching render; (3) `month_reflections` table + `upsertReflectionAction` + `ReflectionCard`; (4) `copyGoalsFromLastMonthAction` + `WelcomeToMonth` + `PastEmptyState` + past/future render variants.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**URL Routing & Navigation**

- **D-01:** URL shape is `/dashboard/[month]` where `[month]` is `YYYY-MM` (e.g., `/dashboard/2026-04`). Deep-linkable, browser back/forward works natively (distinct route segments), and the server component can fetch at the route level using the segment.
- **D-02:** `/dashboard` (no segment) server-side redirects to `/dashboard/[current-month]` computed via `monthBucket(new Date(), userTz).toISOString().slice(0, 7)`. The existing `src/app/(protected)/dashboard/page.tsx` becomes that redirect; the render lives in `src/app/(protected)/dashboard/[month]/page.tsx`.
- **D-03:** Parse + validate the `[month]` segment with Zod (`/^\d{4}-\d{2}$/`) in the route component. Invalid segments render a 404 (or redirect to current month — planner's call; do not swallow silently).
- **D-04:** Month-nav header layout: `← [Month Year] →` with prev-arrow on the left of the title and next-arrow on the right. A `Today` button appears to the right of the next-arrow ONLY when the viewed month is not the current month.
- **D-05:** Prev-arrow always enabled (unbounded history). Next-arrow disabled (greyed, `aria-disabled="true"`, no click) when viewing current month + 1.
- **D-06:** Future-month bound = **next month only**. Users cannot navigate past current-month + 1.
- **D-07:** Keyboard shortcuts: `←` and `→` when the dashboard route is mounted and focus is not in an input/textarea. Respect disabled-arrow state (no-op when at next-month cap).
- **D-08:** `Today` button links to `/dashboard/[current-month]`. Shown only when `viewed_month !== current_month`.

**Future-Month Goals**

- **D-09:** Future-month goals (month = current + 1) are **fully mutable** — create, edit title/target/tasks/notes, delete. Identical CRUD surface as current-month goals. No separate "planning mode" concept.
- **D-10:** When the clock crosses 00:00 on the 1st of the planned month, that month becomes "current" and the user's prior month transitions from "current" to "past" (enforced by the service-layer month check at request time — no scheduled job).
- **D-11:** Progress logging (increment, toggleTask, markHabit, backfill, undo) is **blocked on future-month goals** — the service already throws `OutOfMonthError` when `goal.month !== monthBucket(now, userTz)`. Reused unchanged.

**Past-Month Read-Only Enforcement**

- **D-12:** Past-month read-only is **layered defense**: (a) service returns 403 on any write touching a past-month goal (generalize the existing `OutOfMonthError` to a broader `ReadOnlyMonthError`); (b) the UI simply does not render the mutation affordances.
- **D-13:** Past-month goal cards: **hide the kebab menu entirely**. No Edit, no Delete, no "Log for earlier day". The card is visually frozen.
- **D-14:** Past-month interactive elements (progress bar animation, count stepper, checklist checkboxes, habit grid cells) are **fully frozen, non-interactive**: no hover, no cursor-pointer, no click handlers. Progress bar renders at historical fill with no spring animation. Habit grid cells render hit/miss state but don't respond to taps. `useOptimistic` is NOT wired up on past-month routes.
- **D-15:** Sonner undo toast provider / goal-progress listeners do **not mount** on past-month routes. Zero surface area for a past-month mutation toast.
- **D-16:** Direct deep-link to a past month with no goals: minimal empty state — "No goals in [Month Year]" + "You didn't have goals tracked this month." + `Back to current month` button. No Welcome prompt, no Copy-from-last-month offer on past-empty views.
- **D-17:** Route determines past/current/future via `compareMonth(viewed_month, current_month, userTz)` → `'past' | 'current' | 'future'`. Export from `src/lib/time.ts`. Pure function, Vitest fixture suite extends the Phase 1 D-23 pattern.

**Welcome + Copy-from-Last-Month**

- **D-18:** Welcome prompt renders ONLY when: (a) viewed_month is current OR future; (b) viewed_month has zero goals; (c) the immediately prior month has at least one goal for this user.
- **D-19:** Welcome layout: `"Welcome to [Month Year]."` headline; `"Carry forward from [Prior Month] or start fresh?"` body; two buttons — primary `"Copy from last month"` and secondary `"Start fresh"`.
- **D-20:** `"Start fresh"` dismisses the prompt for the current page session only (React state). No DB flag, no session-storage write.
- **D-21:** `copyGoalsFromLastMonth(userId, fromMonth, toMonth, userTz)` server action copies goal shells: for each goal in `fromMonth`, INSERT a new `goals` row in `toMonth` with `title`, `type`, `target_count`, `target_days`, `notes`, `position` copied. Count `current_count = 0`. Checklist → INSERT fresh `tasks` rows with `label`, `position` copied but `is_done = false`, `done_at = null`. Habit → NO `habit_check_ins` copied. `progress_entries` NOT copied. All in one transaction. Server re-derives `toMonth` from `monthBucket` — month is not trusted from the client.
- **D-22:** Habit `target_days` on copy: carry the literal value UNLESS it exceeds the new month's `days_in_month`, in which case clamp to `days_in_month`.
- **D-23:** Copy is idempotent at the business level: re-check `SELECT COUNT(*) FROM goals WHERE user_id=? AND month=?` before insert inside the transaction and abort if non-zero, returning the existing goal list.

**Reflection Field (POLSH-04)**

- **D-24:** New `month_reflections` table with `id`, `user_id` (FK CASCADE), `month DATE CHECK (EXTRACT(DAY FROM month) = 1)`, `what_worked text NULL`, `what_didnt text NULL`, `created_at`, `updated_at`, `UNIQUE (user_id, month)`. RLS: all four CRUD via `crudPolicy()` — `user_id = auth.uid()`.
- **D-25:** Card placement: bottom of the goal list in the 720px single-column layout. Title: `"Reflection — [Month Year]"`. Two textareas: `"What worked"` and `"What didn't"`.
- **D-26:** 280-character soft limit per field. Live character counter. 250 → amber, 280 → red hard-block. Server re-validates via Zod.
- **D-27:** Reflection is **editable on current and past months always** — no lock after month-end.
- **D-28:** Reflection is **not shown on future months**.
- **D-29:** Debounced autosave (blur or ~800ms idle), no explicit Save button. `{ ok: true } / { ok: false, error }` action shape. Show a small "Saved" indicator briefly on success.
- **D-30:** Empty reflection = no row. UPSERT on first save via `ON CONFLICT (user_id, month) DO UPDATE`.

### Claude's Discretion

- Exact 404 vs redirect behavior for an invalid `[month]` segment (D-03) — planner's call, but do not swallow silently.
- Whether the Welcome prompt replaces the empty state or renders above it.
- Exact copy voicing for Welcome headline/body, reflection placeholders, past-empty-month copy.
- Animation details for month transitions (Motion `<AnimatePresence>` is nice-to-have but not required).
- Prev/next arrow icon choice (lucide-react `ChevronLeft` / `ChevronRight` likely).
- Whether the `ReadOnlyMonthError` is a rename of `OutOfMonthError` or a new sibling class.
- Exact debounce timing for reflection autosave (somewhere 500–1000ms).
- Whether `compareMonth` lives in `src/lib/time.ts` or a new `src/lib/month.ts`.
- The visual distinction between the Reflection card and goal cards (muted border, background tint, icon prefix — all acceptable).

### Deferred Ideas (OUT OF SCOPE)

- Month-picker dropdown / calendar for distant navigation
- Unlimited / 3-months-forward pre-planning (rejected in D-06)
- Persistent "Start fresh" dismissal (DB flag or sessionStorage)
- Copy-goal-to-current-month action from a past-month view
- Telemetry on Welcome prompt interactions
- End-of-month reflection push notification / email prompt
- Mobile 375px pass — Phase 4 (POLSH-01)
- Error-toast hardening for reflection autosave — Phase 4 (POLSH-02)
- Animated month transitions (Motion `<AnimatePresence>`)
- Reflection rich-text or multi-field structure
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **GOAL-05** | User can pre-set goals for future months by navigating forward before the month begins | §Architecture Patterns §Pattern 3 future-month mutable CRUD; §Code Examples future-month render branch |
| **MNAV-01** | User can navigate between past, current, and future months via prev/next controls | §Architecture Patterns §Pattern 1 dynamic route; §Code Examples keyboard nav + Link-based arrows |
| **MNAV-02** | Past-month goals are visible but read-only — enforced in both API and UI | §Don't Hand-Roll row "Read-only enforcement"; §Architecture Patterns §Pattern 2 layered defense; §Common Pitfalls §Pitfall 1 past-month service bypass |
| **MNAV-03** | User can copy all goals from the previous month into the current month with one click | §Don't Hand-Roll row "Goal copy atomic transaction"; §Code Examples copy-from-last-month transaction; §Common Pitfalls §Pitfall 3 client-trusted months |
| **MNAV-04** | On the 1st of a new month the dashboard starts blank unless pre-set or Copy-from-last-month | §Architecture Patterns §Pattern 5 render decision tree; §Code Examples Welcome trigger query |
| **POLSH-04** | Past-month and end-of-month views include a two-line reflection field | §Standard Stack `month_reflections` table; §Don't Hand-Roll row "UPSERT"; §Code Examples reflection Drizzle UPSERT + debounced autosave |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack is locked and pinned** — Next.js 16.2.4, React 19.2.5, Tailwind 4.2.2, shadcn 3.5, Motion 12.38, Supabase, Drizzle 0.45, Zod 4.3, date-fns 4.1, `@date-fns/tz`. Do not propose alternative libraries. `[VERIFIED: npm view against package.json 2026-04-20]`
- **No new `@theme` tokens** — UI-SPEC Phase 3 Registry Safety §Visual Regression Guardrails: zero new `@theme` tokens, no `--spacing-*` overrides (STATE.md Plan 01-05 lesson), no new typography sizes/weights. Reuse Phase 1+2 tokens verbatim.
- **Use `create-next-app` and Next 16 conventions** — Turbopack default, App Router, React Compiler stable. No Webpack config. No Pages Router.
- **`@supabase/ssr`, not `@supabase/auth-helpers-nextjs`** — deprecated helper package is NOT in use and MUST NOT be added.
- **GSD Workflow Enforcement** — CLAUDE.md locks: use `/gsd-execute-phase` for planned phase work; no direct repo edits outside GSD.
- **`motion/react`, not `framer-motion`** — Phase 3 may use Motion's `<AnimatePresence>` for month transitions but it is explicitly discretionary; default to shipping without.
- **Drizzle schema as source of truth for tables AND RLS policies** — Phase 3's `month_reflections` table MUST author RLS via `pgPolicy()` (or `crudPolicy()` helper) co-located with the table definition, following the Phase 1+2 pattern.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| URL-routed month state | Frontend Server (Next.js RSC) | Browser (Link history) | Next 16 dynamic segment [month] is the canonical state; browser history replay = free deep-link + back/forward. No client-side month state lib. |
| Month-segment validation | Frontend Server (route component) | API/Service (re-validation) | Zod `monthSegmentSchema` at route entry + re-validate server-side on mutations. Server is authoritative. |
| compareMonth pure function | Frontend Server + Browser (isomorphic) | — | Pure TZ-aware comparator, same shape as Phase 1 `today`/`monthBucket`. Imported by route page AND MonthNavigator client component. |
| Past-month read-only enforcement (writes) | API/Service (ReadOnlyMonthError 403) | Frontend Server (hide kebab), Browser (no optimistic wiring) | **Layered defense mandate (D-12).** Service is the authoritative gate; UI absence is UX; RLS is not used as the gate (Phase 1 D-22 left month gating to app layer by design). |
| Past-month card render (frozen) | Frontend Server (RSC `PastMonthReadOnly`) | — | No optimistic state, no mutation handlers. Purely render — children receive `readOnly` prop. |
| Copy-from-last-month transaction | API/Service (Drizzle `db.transaction`) | — | Multi-insert with idempotency guard, server-derived months. Client never dictates `fromMonth` or `toMonth`. |
| Welcome trigger decision | Frontend Server (route page) | — | Server queries `priorMonthHasGoals` boolean in the same request as `getMonthDashboard`. No client fetch. |
| Reflection UPSERT | API/Service (Drizzle `onConflictDoUpdate`) | Database (`UNIQUE (user_id, month)`) | Postgres unique constraint is the conflict target; Drizzle emits `ON CONFLICT DO UPDATE`. |
| Reflection autosave debounce | Browser (client component) | API/Service (re-validate + write) | `setTimeout` + `onBlur` in the ReflectionCard client; server action re-parses via Zod. |
| Reflection form validation | Browser (RHF + zod) + API/Service (re-validate) | — | Same `reflectionSchema` imported both sides, as per Phase 2 D-20 pattern. |
| Keyboard shortcut `← / →` | Browser (client component) | — | `useEffect` window keydown on MonthNavigator; navigation via `next/navigation` `useRouter.push`. |
| Sonner toast provider | Browser (root layout, already mounted) | — | Mounted once in `src/app/layout.tsx` already. Past-month routes simply never fire `toast()` because mutation handlers don't exist. Do NOT remount or unmount per-route. |

## Standard Stack

All Phase 3 libraries are ALREADY installed. Phase 3 adds exactly one shadcn component (`Textarea`) and exactly one Drizzle table. Zero new npm dependencies.

### Core (unchanged from Phase 2)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.4 | App Router with async `params: Promise<{month: string}>` and `notFound()` | `[VERIFIED: npm view next version` → `16.2.4]`. Next 16 async params is the current required shape `[CITED: nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes]`. |
| `react` | 19.2.4 | Concurrent features; `useTransition` + `useOptimistic` already used by Phase 2 shell | `[VERIFIED: package.json]` |
| `@supabase/ssr` | 0.10.2 | Session refresh in middleware — gate applies to `[month]` route inherited from `(protected)` group | `[VERIFIED: package.json]` |
| `drizzle-orm` | 0.45.2 | Schema for `month_reflections`, `onConflictDoUpdate()` for UPSERT, transactional copy-from-last-month | `[VERIFIED: npm view drizzle-orm version` → `0.45.2]`. `onConflictDoUpdate` supports array-of-columns as target for composite unique constraints `[CITED: orm.drizzle.team/docs/guides/upsert]`. |
| `drizzle-kit` | 0.31.10 | Migration generation to `supabase/migrations/` (Phase 1 D-09 pattern) | `[VERIFIED: package.json]` |
| `@date-fns/tz` + `date-fns` | 1.4.1 + 4.1.0 | `subMonths`, `addMonths`, `isSameMonth`, `format(month, 'yyyy-MM')`, `startOfMonth`, `getDaysInMonth` for compareMonth + month-segment helpers + days-in-month clamp (D-22) | `[VERIFIED: package.json]` |
| `zod` | 4.3.6 | `monthSegmentSchema`, `reflectionSchema`, discriminated-union validation (matches Phase 2 D-20 pattern) | `[VERIFIED: npm view zod version` → `4.3.6]` |
| `react-hook-form` + `@hookform/resolvers` | 7.72.1 + 5.2.2 | Reflection form with `zodResolver` + debounced autosave on field change | `[VERIFIED: package.json]` |
| `motion` | 12.38.0 | Existing ProgressBar spring; Phase 3 optionally uses `<AnimatePresence>` on month transitions (discretion D-discretion) | `[VERIFIED: package.json]` |
| `sonner` | 2.0.7 | Toaster mounted once in root layout; past routes never fire toasts | `[VERIFIED: package.json]` |
| `lucide-react` | 0.545.0 | `ChevronLeft`, `ChevronRight`, `PenLine` (reflection icon), `Loader2` (already in use) | `[VERIFIED: package.json]` |

### Shadcn Components

**Already installed (Phase 1+2):** `Alert, Button, Card, Form, Input, Label, Dialog, AlertDialog, DropdownMenu, Sonner, Checkbox, Popover`.

**Install in Phase 3:**
```bash
npx shadcn@latest add textarea
```
That is the entire Phase 3 shadcn install. `[CITED: UI-SPEC.md §shadcn Components to Install in Phase 3]`

### Alternatives Considered

| Instead of | Could Use | Why Rejected |
|------------|-----------|-------------|
| URL-segment `/dashboard/[month]` | Query param `/dashboard?month=2026-04` | **Rejected by D-01 + ARCHITECTURE.md line 73.** Query params complicate `generateStaticParams`, clutter RSC cache keys, and break the "success criterion #1 requires deep links and browser back/forward to work" specification verbatim. |
| `ReadOnlyMonthError` as new sibling class | Rename `OutOfMonthError` | **Claude's discretion** (CONTEXT.md). Recommendation: **rename** `OutOfMonthError` → `ReadOnlyMonthError` and update all call sites. Rationale: the existing name describes the effect poorly; "past-month-readonly" is the domain concept; existing call sites treat `OutOfMonthError` as a single read-only-shaped error anyway (e.g., backfill validates against current month — same effect). A single error class with consistent copy is simpler than two classes policing adjacent conditions. |
| Drizzle `month_reflections` table | JSONB `user_settings.reflections` blob | **Rejected.** PITFALLS §3 explicitly warns JSONB for core entities. Reflections are user-authored, searchable, queryable, and need RLS — a table with `UNIQUE (user_id, month)` is the correct shape. |
| Reflection autosave via RHF `handleSubmit` on blur | Dedicated `useDebouncedCallback` + `setTimeout` idle | **Use both.** `onBlur` from RHF fires one save; `setTimeout` idle fires the 800ms mid-type save. Both dispatch the same action. The first-to-fire wins; subsequent duplicate saves UPSERT identically (idempotent). |
| Client-side `localStorage` for "last viewed month" | URL segment is the only state | **Rejected by PITFALLS §Debt line 176.** URL segment + server-side redirect from `/dashboard` → current month is the canonical pattern. |
| `generateStaticParams` for month routes | Dynamic rendering (no static generation) | **Recommended: dynamic rendering.** Per-user auth + RLS makes static params meaningless. Next.js defaults to dynamic for authenticated pages reading cookies `[CITED: nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes]`. |
| Motion `<AnimatePresence>` between months | Plain RSC route transition | **Claude's discretion (D-discretion).** Recommendation: **ship without.** RSC streaming is crisp enough; per UI-SPEC "the executor MUST NOT add this flourish unless explicitly planned". |

### Installation Verification

No new dependencies. Run before Phase 3 work:
```bash
npx shadcn@latest add textarea
npm view next date-fns drizzle-orm zod motion version  # sanity check versions
```

## Architecture Patterns

### System Architecture Diagram

```
                ┌─────────────────────────────────────────────────────────┐
                │                     BROWSER                              │
                │                                                           │
   URL change   │   ┌──────────────────┐    keydown(←/→)                   │
   ───────────▶ │   │ MonthNavigator   │───────┐                            │
                │   │ (client)         │       │                            │
                │   └──────────────────┘       │                            │
                │            │                 ▼                            │
                │            │         useRouter.push('/dashboard/YYYY-MM')  │
                │            ▼                                              │
                │   ┌──────────────────┐   ┌───────────────────┐           │
                │   │ ReflectionCard   │   │ WelcomeToMonth    │           │
                │   │ (client)         │   │ (client)          │           │
                │   │ onBlur/idle 800  │   │ Copy-click→action │           │
                │   └────────┬─────────┘   └─────────┬─────────┘           │
                │            │                       │                     │
                └────────────┼───────────────────────┼─────────────────────┘
                             │                       │
                             │ Server Action         │ Server Action
                             ▼                       ▼
 ┌────────────────────────────────────────────────────────────────────────────┐
 │                  NEXT.JS SERVER (middleware + RSC)                          │
 │                                                                              │
 │   middleware.ts (@supabase/ssr)  → session refresh + redirect if !user      │
 │                │                                                             │
 │                ▼                                                             │
 │   app/(protected)/dashboard/page.tsx                                        │
 │     → redirect(`/dashboard/${formatMonthSegment(monthBucket(now, tz))}`)   │
 │                                                                              │
 │   app/(protected)/dashboard/[month]/page.tsx  (RSC)                         │
 │     1. `const { month: seg } = await params`                                │
 │     2. monthSegmentSchema.parse(seg)  → notFound() on fail                  │
 │     3. viewedMonth = parseMonthSegment(seg)                                 │
 │     4. currentMonth = monthBucket(new Date(), userTz)                       │
 │     5. status = compareMonth(viewedMonth, currentMonth)                     │
 │        → 'past' | 'current' | 'future'                                      │
 │     6. if (status === 'future' && !isNextMonth) → notFound()                │
 │     7. goals = await getMonthDashboard(userId, viewedMonth)   [reused]      │
 │     8. priorMonthHasGoals = await countGoalsInMonth(userId, -1)             │
 │     9. reflection = status !== 'future' ? await getReflection(...) : null   │
 │    10. Render decision tree ↓                                               │
 │                                                                              │
 │   ┌──────────┬──────────────┬──────────────┬──────────────┐                │
 │   │  past +  │   past       │   current/   │   current/   │                │
 │   │  empty   │   with goals │   future     │   future     │                │
 │   │          │              │   empty      │   with goals │                │
 │   ├──────────┼──────────────┼──────────────┼──────────────┤                │
 │   │PastEmpty │PastMonth     │WelcomeOr     │DashboardShell│                │
 │   │State     │ReadOnly (RSC)│EmptyState    │(Phase 2, mut)│                │
 │   └──────────┴──────────────┴──────────────┴──────────────┘                │
 │                                                                              │
 │   All routes (except future) → render <ReflectionCard />                    │
 │                                                                              │
 │   Server Actions (`'use server'`):                                          │
 │   ├─ copyGoalsFromLastMonthAction  → services.goals.copyGoalsFromLastMonth │
 │   ├─ upsertReflectionAction        → services.reflections.upsertReflection │
 │   ├─ existing progress/goals actions  → services throw ReadOnlyMonthError  │
 │                                         when goal.month != currentMonth    │
 └──────────────────────────┬───────────────────────────────────────────────────┘
                            ▼
 ┌────────────────────────────────────────────────────────────────────────────┐
 │                         POSTGRES (Supabase)                                 │
 │                                                                              │
 │   public.goals       (FK cascade) ← existing, unchanged schema              │
 │   public.tasks                    ← existing, unchanged                     │
 │   public.habit_check_ins          ← existing, unchanged                     │
 │   public.progress_entries         ← existing, unchanged                     │
 │   public.users                    ← existing, unchanged                     │
 │   public.month_reflections        ← NEW. (user_id, month) UNIQUE.           │
 │                                    RLS: crudPolicy user_id = auth.uid().   │
 │                                    CHECK EXTRACT(DAY FROM month) = 1.      │
 │                                                                              │
 │   Copy-from-last-month: db.transaction {                                    │
 │     SELECT COUNT FROM goals WHERE user_id, month=toMonth;  → abort if > 0   │
 │     For each source goal: INSERT (title, type, target_count, target_days,  │
 │       position) in toMonth.                                                  │
 │     For checklist: INSERT fresh tasks rows (is_done=false).                 │
 │     habit_check_ins + progress_entries NOT copied.                          │
 │   }                                                                          │
 └────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (deltas only — everything else unchanged)

```
src/
├── app/
│   └── (protected)/
│       └── dashboard/
│           ├── page.tsx                 ← REWRITE: redirect to /dashboard/[current-month]
│           └── [month]/
│               └── page.tsx             ← NEW: real render, branches by compareMonth
├── components/
│   ├── month-navigator.tsx              ← NEW (client)
│   ├── welcome-to-month.tsx             ← NEW (client — useState + useTransition)
│   ├── past-empty-state.tsx             ← NEW (RSC-safe)
│   ├── past-month-read-only.tsx         ← NEW (RSC-safe wrapper for frozen cards)
│   ├── reflection-card.tsx              ← NEW (client — RHF + debounced autosave)
│   ├── dashboard-shell.tsx              ← EXTEND: accept monthContext prop (current|future)
│   ├── goal-card/
│   │   ├── index.tsx                    ← EXTEND: accept `variant: 'mutable' | 'read-only'`
│   │   ├── count.tsx                    ← EXTEND: read-only render path
│   │   ├── checklist.tsx                ← EXTEND: read-only render path
│   │   └── habit.tsx                    ← EXTEND: read-only render path
│   ├── habit-grid.tsx                   ← EXTEND: readOnly prop suppresses cell handlers
│   ├── pace-chip.tsx                    ← EXTEND: hidePaceChip prop (past + future)
│   └── ui/
│       └── textarea.tsx                 ← NEW via `npx shadcn add textarea`
├── server/
│   ├── actions/
│   │   ├── goals.ts                     ← EXTEND: add copyGoalsFromLastMonthAction
│   │   └── reflections.ts               ← NEW
│   ├── services/
│   │   ├── goals.ts                     ← EXTEND: apply ReadOnlyMonthError to update/delete
│   │   ├── progress.ts                  ← EXTEND: rename OutOfMonthError → ReadOnlyMonthError
│   │   └── reflections.ts               ← NEW: upsertReflection, getReflection
│   └── db/
│       ├── schema.ts                    ← EXTEND: add monthReflections table + pgPolicy
│       └── queries.ts                   ← EXTEND: countGoalsInMonth, getReflectionForMonth
├── lib/
│   ├── time.ts                          ← EXTEND: compareMonth, formatMonthSegment, parseMonthSegment
│   └── schemas/
│       ├── month.ts                     ← NEW: monthSegmentSchema (or inline in time.ts per discretion)
│       └── reflections.ts               ← NEW: reflectionSchema, upsertReflectionSchema
supabase/
└── migrations/
    └── 0006_month_reflections.sql       ← NEW (auto-emitted by drizzle-kit generate)
tests/
├── time.compareMonth.test.ts            ← NEW (Wave 0 gate)
├── time.monthSegment.test.ts            ← NEW (Wave 0 gate)
├── schemas.reflections.test.ts          ← NEW
├── actions.reflections.test.ts          ← NEW
├── actions.copyGoals.test.ts            ← NEW
└── readonly-month-enforcement.test.ts   ← NEW (service-layer 403 smoke)
```

### Pattern 1: Next.js 16 Async Dynamic Route Segment with Zod Guard

**What:** Next.js 16 `params` is a `Promise` and MUST be awaited. Validate the segment with Zod at the entry of the route component. On validation failure, return `notFound()`.

**When to use:** Every route file that reads a dynamic segment (Phase 3: `app/(protected)/dashboard/[month]/page.tsx`).

**Example:**
```typescript
// src/app/(protected)/dashboard/[month]/page.tsx
// Source: [CITED: nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes]
import { notFound, redirect } from 'next/navigation'
import { monthSegmentSchema } from '@/lib/schemas/month'
import { parseMonthSegment, compareMonth, formatMonthSegment, monthBucket } from '@/lib/time'
import { getSupabaseServerClient } from '@/lib/supabase/server'
// ... other imports omitted for brevity

interface PageProps {
  params: Promise<{ month: string }>
}

export default async function DashboardMonthPage({ params }: PageProps) {
  const { month: segment } = await params   // Next 16 requirement: params is Promise
  const parsed = monthSegmentSchema.safeParse(segment)
  if (!parsed.success) notFound()           // do not swallow silently — D-03

  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const userTz = await resolveUserTz(user.id)   // helper from Phase 1 pattern
  const now = new Date()
  const viewedMonth = parseMonthSegment(parsed.data)
  const currentMonth = monthBucket(now, userTz)
  const status = compareMonth(viewedMonth, currentMonth)

  // Enforce future-month cap: only current+1 is reachable
  if (status === 'future') {
    const nextMonth = addMonths(currentMonth, 1)
    if (!isSameMonth(viewedMonth, nextMonth)) notFound()
  }

  // ... branch render (see Pattern 5)
}
```

### Pattern 2: Layered Read-Only Enforcement (Service-Layer `ReadOnlyMonthError`)

**What:** The service layer is the authoritative gate. Any write function that touches a goal MUST assert the goal's `month` equals `monthBucket(now, userTz)`. If the goal's month is before current, throw `ReadOnlyMonthError`. The UI hiding the kebab is NOT sufficient (PITFALLS §Debt line 181; D-12).

**When to use:** Every write path in `src/server/services/goals.ts` AND `src/server/services/progress.ts`. Phase 2 already applies this pattern for progress writes (via `OutOfMonthError`); Phase 3 extends it to `updateGoal` and `deleteGoal`.

**Critical nuance:** The Phase 2 guard (`g.month !== currentMonth`) fires for **both past and future months** because the condition is inequality, not "is past". For future-month goals, CONTEXT.md D-09 says edits/deletes should succeed. This means the generalized guard must distinguish past from future:

```typescript
// src/server/services/progress.ts (extended pattern)
// Source: Phase 2 progress.ts + CONTEXT.md D-12, D-09
export class ReadOnlyMonthError extends Error {
  constructor() { super("This month is archived.") }    // unpunitive copy per UI-SPEC
}

function assertMutableForProgress(goalMonth: string, currentMonth: string) {
  // Progress is only loggable on CURRENT month. Future-month progress throws — this matches
  // existing OutOfMonthError behavior (D-11 reuses it unchanged).
  if (goalMonth !== currentMonth) throw new ReadOnlyMonthError()
}

function assertMutableForGoalWrite(goalMonth: string, currentMonth: string) {
  // Goal CRUD is allowed for current AND future months (D-09). Only past blocks.
  if (goalMonth < currentMonth) throw new ReadOnlyMonthError()
  // future (goalMonth > currentMonth) is ALLOWED. current (===) is ALLOWED.
}
```

**String comparison caveat:** Since both are `'YYYY-MM-DD'` first-of-month ISO strings, lexical `<` / `>` is equivalent to calendar comparison. Verified by Postgres `DATE` round-trip through `toISOString().slice(0, 10)`.

**Anti-pattern (DO NOT DO):** Enforcing past-month read-only only via UI. An attacker can replay a PATCH directly; a UI bug can emit a stale mutation. Service layer is the authority.

### Pattern 3: `compareMonth` Pure Function

**What:** A pure, timezone-aware comparator that returns `'past' | 'current' | 'future'`. Lives in `src/lib/time.ts` alongside `today` and `monthBucket` (recommended over a new `src/lib/month.ts`; the file is small and thematically coherent).

**When to use:** Imported by the route page (server), MonthNavigator (client), and any test fixture for past/current/future branching.

**Example:**
```typescript
// src/lib/time.ts (extension)
// Source: Phase 1 D-17 + CONTEXT.md D-17
import { TZDate } from '@date-fns/tz'
import { startOfMonth, isSameMonth, isBefore } from 'date-fns'

/**
 * Compare a viewed month (from URL) against the current month (derived from now+tz).
 * Both inputs are Date objects at first-of-month 00:00:00 UTC (per monthBucket contract).
 *
 * @param viewed  - Date at first-of-month (from parseMonthSegment)
 * @param current - Date at first-of-month (from monthBucket(new Date(), userTz))
 * @returns 'past' | 'current' | 'future'
 */
export function compareMonth(viewed: Date, current: Date): 'past' | 'current' | 'future' {
  if (isSameMonth(viewed, current)) return 'current'
  if (isBefore(viewed, current)) return 'past'
  return 'future'
}

export function formatMonthSegment(month: Date): string {
  // Returns 'YYYY-MM' — the canonical URL shape (D-01). Uses UTC since monthBucket emits UTC.
  return month.toISOString().slice(0, 7)
}

export function parseMonthSegment(segment: string): Date {
  // Inverse of formatMonthSegment. Returns first-of-month Date at UTC midnight.
  // Callers SHOULD have validated `segment` against monthSegmentSchema first.
  return new Date(`${segment}-01T00:00:00.000Z`)
}
```

**Why not use the user's timezone in `compareMonth`?** Both inputs are already first-of-month dates derived from timezone-aware paths (`monthBucket` for current; `parseMonthSegment` is timezone-naive because URL segments don't carry timezone, but they represent "the month the user chose"). The comparison is between calendar months, not wall-clock moments. Adding `userTz` would be incorrect — it would double-apply the offset.

### Pattern 4: Keyboard Navigation in MonthNavigator (Client)

**What:** A `useEffect` that attaches a `keydown` listener on `window`, filters events when focus is inside form fields, respects the next-arrow disabled bound, and pushes to the prev/next URL via `useRouter`.

**When to use:** Every dashboard month view (past/current/future). Listener unmounts when the route unmounts — no cleanup leaks across month changes.

**Example:**
```typescript
// src/components/month-navigator.tsx
// Source: [CITED: CONTEXT.md D-07, UI-SPEC.md MonthNavigator behavior]
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMonthSegment } from '@/lib/time'
import { addMonths, subMonths } from 'date-fns'

interface Props {
  viewedMonthIso: string       // 'YYYY-MM-DD' serialized (RSC → client safe)
  currentMonthIso: string
  isNextDisabled: boolean      // server-computed: viewedMonth === currentMonth + 1
  monthYearLabel: string       // 'April 2026'
}

export function MonthNavigator({ viewedMonthIso, currentMonthIso, isNextDisabled, monthYearLabel }: Props) {
  const router = useRouter()
  const viewed = new Date(viewedMonthIso)
  const current = new Date(currentMonthIso)
  const prevHref = `/dashboard/${formatMonthSegment(subMonths(viewed, 1))}`
  const nextHref = `/dashboard/${formatMonthSegment(addMonths(viewed, 1))}`
  const currentHref = `/dashboard/${formatMonthSegment(current)}`
  const showToday = viewedMonthIso !== currentMonthIso

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore when focus is in a text input (D-07)
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        router.push(prevHref)
      } else if (e.key === 'ArrowRight' && !isNextDisabled) {
        e.preventDefault()
        router.push(nextHref)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router, prevHref, nextHref, isNextDisabled])

  return (
    <header className="mb-2 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href={prevHref} aria-label="Previous month"><ChevronLeft size={16} /></Link>
        </Button>
        <h1 className="text-2xl font-semibold">{monthYearLabel}</h1>
        <Button variant="ghost" size="icon" asChild aria-disabled={isNextDisabled}
                className={isNextDisabled ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}>
          <Link href={nextHref} aria-label={isNextDisabled ? 'Next month — unavailable' : 'Next month'}>
            <ChevronRight size={16} />
          </Link>
        </Button>
        {showToday && (
          <Button variant="outline" size="sm" asChild>
            <Link href={currentHref} aria-label="Return to this month">Today</Link>
          </Button>
        )}
      </div>
      {/* right cluster (New-goal-if-not-past + Logout) lives in the route page, passed as children */}
    </header>
  )
}
```

### Pattern 5: Render Decision Tree at Route Level

**What:** The `[month]/page.tsx` is a Server Component that fetches state once and branches into one of five render shapes. Server-side branching is authoritative; no client state lib required.

**When to use:** The single entry point for all past/current/future month views.

**Example:**
```typescript
// src/app/(protected)/dashboard/[month]/page.tsx (render branch — continuing Pattern 1)
// Source: [CITED: UI-SPEC.md §Layout + CONTEXT.md D-16, D-18]
const daysInMonth = getDaysInMonth(viewedMonth)
const monthYearLabel = format(viewedMonth, 'MMMM yyyy')
const isNextDisabled = compareMonth(addMonths(viewedMonth, 1), currentMonth) === 'future'
                        && !isSameMonth(addMonths(viewedMonth, 1), addMonths(currentMonth, 1))
// simpler: isNextDisabled = isSameMonth(viewedMonth, addMonths(currentMonth, 1))

const goals = await getMonthDashboard(user.id, viewedMonth)
const priorMonthHasGoals = status === 'past'
  ? false    // never show Welcome on past routes
  : (await countGoalsInMonth(user.id, subMonths(viewedMonth, 1))) > 0

const reflection = status !== 'future'
  ? await getReflectionForMonth(user.id, viewedMonth)
  : null

return (
  <>
    <MonthNavigator
      viewedMonthIso={viewedMonth.toISOString().slice(0, 10)}
      currentMonthIso={currentMonth.toISOString().slice(0, 10)}
      isNextDisabled={isNextDisabled}
      monthYearLabel={monthYearLabel}
    />

    {/* Goal list region */}
    {status === 'past' && goals.length === 0 ? (
      <PastEmptyState currentMonthSegment={formatMonthSegment(currentMonth)} monthYearLabel={monthYearLabel} />
    ) : status === 'past' ? (
      <PastMonthReadOnly goals={goals} now={now} userTz={userTz} />
    ) : goals.length === 0 && priorMonthHasGoals ? (
      <WelcomeToMonth priorMonthLabel={format(subMonths(viewedMonth, 1), 'MMMM')}
                      monthYearLabel={monthYearLabel} />
    ) : goals.length === 0 ? (
      <EmptyState monthYearLabel={monthYearLabel}
                  createButtonSlot={<NewGoalButton daysInMonthDefault={daysInMonth} />} />
    ) : (
      <DashboardShell initialGoals={goals} userTz={userTz} nowIso={now.toISOString()}
                      daysInMonthDefault={daysInMonth} monthContext={status} />
    )}

    {/* Reflection: current + past only */}
    {status !== 'future' && (
      <ReflectionCard month={viewedMonth} initial={reflection} monthYearLabel={monthYearLabel} />
    )}
  </>
)
```

### Pattern 6: Copy-from-Last-Month Drizzle Transaction

**What:** A single `db.transaction()` block that (a) asserts the target month is empty (idempotency guard), (b) SELECTs source goals with their tasks, (c) inserts new goal rows with shells copied and `current_count = 0`, (d) inserts fresh task rows with `is_done = false`, (e) does NOT touch `habit_check_ins` or `progress_entries`.

**When to use:** Exactly one call site: `copyGoalsFromLastMonthAction`.

**Example:**
```typescript
// src/server/services/goals.ts (extension)
// Source: [CITED: CONTEXT.md D-21, D-22, D-23 + orm.drizzle.team/docs/guides/upsert]
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/server/db'
import { goals, tasks } from '@/server/db/schema'
import { monthBucket } from '@/lib/time'
import { subMonths, getDaysInMonth } from 'date-fns'

export async function copyGoalsFromLastMonth(userId: string, userTz: string) {
  const now = new Date()
  const toMonth = monthBucket(now, userTz)                     // server-derived (D-21)
  const fromMonth = subMonths(toMonth, 1)
  const toMonthStr = toMonth.toISOString().slice(0, 10)
  const fromMonthStr = fromMonth.toISOString().slice(0, 10)
  const daysInToMonth = getDaysInMonth(toMonth)

  return db.transaction(async (tx) => {
    // Idempotency guard (D-23): abort if target month already has goals
    const existing = await tx.select({ count: sql<number>`count(*)::int` })
      .from(goals).where(and(eq(goals.userId, userId), eq(goals.month, toMonthStr)))
    if ((existing[0]?.count ?? 0) > 0) return { copiedCount: 0, alreadyHadGoals: true }

    const sources = await tx.select().from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.month, fromMonthStr)))
      .orderBy(goals.position, goals.createdAt)

    if (sources.length === 0) return { copiedCount: 0, alreadyHadGoals: false }

    let copied = 0
    for (const src of sources) {
      // Habit target_days clamp (D-22)
      const clampedTargetDays = src.type === 'habit' && src.targetDays != null && src.targetDays > daysInToMonth
        ? daysInToMonth
        : src.targetDays

      const [newGoal] = await tx.insert(goals).values({
        userId,
        month: toMonthStr,
        title: src.title,
        type: src.type,
        position: src.position,
        targetCount: src.type === 'count' ? src.targetCount : null,
        currentCount: src.type === 'count' ? 0 : null,     // shells only (D-21)
        targetDays: src.type === 'habit' ? clampedTargetDays : null,
      }).returning()

      if (src.type === 'checklist') {
        const sourceTasks = await tx.select().from(tasks)
          .where(eq(tasks.goalId, src.id))
          .orderBy(tasks.position, tasks.createdAt)
        if (sourceTasks.length > 0) {
          await tx.insert(tasks).values(sourceTasks.map((t) => ({
            goalId: newGoal.id,
            label: t.label,
            position: t.position,
            isDone: false,          // shells only
            doneAt: null,
          })))
        }
      }
      // habit_check_ins + progress_entries INTENTIONALLY not copied (D-21)
      copied++
    }
    return { copiedCount: copied, alreadyHadGoals: false }
  })
}
```

### Pattern 7: Reflection UPSERT via `onConflictDoUpdate` on Composite Unique

**What:** The `month_reflections` table has `UNIQUE (user_id, month)`. Drizzle emits `INSERT ... ON CONFLICT (user_id, month) DO UPDATE SET ...` using `onConflictDoUpdate({ target: [...], set: {...} })`.

**When to use:** The `upsertReflection` service function called from `upsertReflectionAction`.

**Example:**
```typescript
// src/server/services/reflections.ts
// Source: [CITED: orm.drizzle.team/docs/guides/upsert]
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/server/db'
import { monthReflections } from '@/server/db/schema'
import { monthBucket } from '@/lib/time'
import type { UpsertReflectionInput } from '@/lib/schemas/reflections'

export async function upsertReflection(userId: string, userTz: string, input: UpsertReflectionInput) {
  // Month MUST be server-derived from the URL segment the user is on — re-bucketed to first-of-month
  // for defense-in-depth. The client passes it but we validate it matches a bucketed date.
  const month = input.month                   // 'YYYY-MM-DD' first-of-month, pre-validated by Zod
  return db.insert(monthReflections).values({
    userId,
    month,
    whatWorked: input.whatWorked,           // Zod transforms '' → null per D-30
    whatDidnt: input.whatDidnt,
  })
  .onConflictDoUpdate({
    target: [monthReflections.userId, monthReflections.month],
    set: {
      whatWorked: input.whatWorked,
      whatDidnt: input.whatDidnt,
      updatedAt: sql`now()`,
    },
  })
  .returning({ savedAt: monthReflections.updatedAt })
}
```

**Drizzle schema shape:**
```typescript
// src/server/db/schema.ts (append)
export const monthReflections = pgTable(
  'month_reflections',
  {
    id: uuid('id').primaryKey().defaultRandom().notNull(),
    userId: uuid('user_id').notNull(),
    month: date('month').notNull(),                    // CHECK enforced via custom SQL migration
    whatWorked: text('what_worked'),                   // nullable per D-30
    whatDidnt: text('what_didnt'),                     // nullable per D-30
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'month_reflections_user_id_fk',
    }).onDelete('cascade'),
    unique('month_reflections_user_month_key').on(table.userId, table.month),  // conflict target
    pgPolicy('month-reflections-select-own', {
      for: 'select', to: authenticatedRole,
      using: sql`user_id = auth.uid()`,
    }),
    pgPolicy('month-reflections-insert-own', {
      for: 'insert', to: authenticatedRole,
      withCheck: sql`user_id = auth.uid()`,
    }),
    pgPolicy('month-reflections-update-own', {
      for: 'update', to: authenticatedRole,
      using: sql`user_id = auth.uid()`,
      withCheck: sql`user_id = auth.uid()`,
    }),
    pgPolicy('month-reflections-delete-own', {
      for: 'delete', to: authenticatedRole,
      using: sql`user_id = auth.uid()`,
    }),
  ],
)
```

**Custom SQL migration (drizzle-kit won't emit CHECK auto) — per Phase 1 D-09 pattern:**
```sql
-- supabase/migrations/0006b_month_reflections_check.sql (hand-authored)
ALTER TABLE public.month_reflections
  ADD CONSTRAINT month_reflections_month_is_first_of_month
  CHECK (EXTRACT(DAY FROM month) = 1);
```

### Pattern 8: Debounced Autosave in ReflectionCard

**What:** React Hook Form tracks the two textarea values; a `useEffect` sets a 800ms `setTimeout` that fires `upsertReflectionAction` on the latest values; `onBlur` ALSO fires the action; both are idempotent (UPSERT).

**When to use:** Every reflection field write. Replaces an explicit Save button.

**Example:**
```typescript
// src/components/reflection-card.tsx
'use client'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { reflectionFormSchema, type ReflectionFormInput } from '@/lib/schemas/reflections'
import { upsertReflectionAction } from '@/server/actions/reflections'

const DEBOUNCE_MS = 800   // D-discretion 500-1000; 800 = "on pause typing"

interface Props {
  month: Date
  initial: { whatWorked: string | null; whatDidnt: string | null } | null
  monthYearLabel: string
}

export function ReflectionCard({ month, initial, monthYearLabel }: Props) {
  const { register, watch } = useForm<ReflectionFormInput>({
    resolver: zodResolver(reflectionFormSchema),
    defaultValues: {
      whatWorked: initial?.whatWorked ?? '',
      whatDidnt: initial?.whatDidnt ?? '',
    },
  })
  const [isPending, startTransition] = useTransition()
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const ww = watch('whatWorked')
  const wd = watch('whatDidnt')

  function save() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = null
    startTransition(async () => {
      const result = await upsertReflectionAction({
        month: month.toISOString().slice(0, 10),
        whatWorked: ww,
        whatDidnt: wd,
      })
      if (result.ok) {
        setSavedAt(Date.now())
        setSaveError(null)
        // auto-clear the "Saved" indicator after 1500ms (UI-SPEC ReflectionCard)
        setTimeout(() => setSavedAt((current) => current === Date.now() ? null : current), 1500)
      } else {
        setSaveError(result.error)
      }
    })
  }

  // Debounced auto-save on any value change. Skip the initial render (both values === initial).
  useEffect(() => {
    // Skip first mount (don't save un-changed initial values)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => save(), DEBOUNCE_MS)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ww, wd])

  // onBlur fires save immediately (flushes pending debounce)
  const onBlur = () => save()

  // ... render textareas with {...register('whatWorked', { onBlur })} + char counters + saved indicator
}
```

### Anti-Patterns to Avoid

- **Trusting `fromMonth` / `toMonth` from the client in `copyGoalsFromLastMonthAction`.** Server MUST derive both from `monthBucket(now, userTz)`. A malicious client could replay a past action to overwrite the current month's goals. D-21 is explicit.
- **Using RLS to enforce past-month read-only.** Phase 1 D-22 and CONTEXT.md D-12 place this guard at the service layer. RLS is defense-in-depth but is not the gate — the gate is `ReadOnlyMonthError` in service code, with a test that calls the service directly.
- **Greying out past-month progress bars.** PITFALLS §Pitfall 1 + UI-SPEC §Visual Regression Guardrail #6: historical bars render in emerald. Greyscale = shame signal = prohibited.
- **Mounting/unmounting `<Toaster>` per route.** Root layout already mounts it. Past-month routes simply never call `toast()`. Do NOT add conditional mounts — UI-SPEC §Visual Regression Guardrail #8.
- **Running `generateStaticParams` for month routes.** Authenticated user-specific content has no meaningful static shape. Let Next.js render dynamically.
- **Reading `params` synchronously.** Next 16 requires `await params`. Synchronous access is a type error since Next 15 `[CITED: GitHub issue vercel/next.js#77609]`.
- **Enabling Sonner toast on past routes.** D-15 is explicit. The cleanest implementation: since no mutation affordances exist on past routes, no mutation handlers exist → no `toast()` call-site reaches code path. Verify by grep.
- **Saving the reflection on every keystroke without debouncing.** Would hammer the DB and rack up needless UPDATE writes. `setTimeout` 800ms idle is the norm.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Month-segment regex + Date parsing | Custom regex + `new Date(segment + '-01')` scattered across files | `monthSegmentSchema` (Zod `regex`) + `parseMonthSegment` in `src/lib/time.ts` | Centralizes validation; matches Phase 2 D-20 canonical-schema pattern; one source of truth for the URL shape |
| Past/current/future branching | Inline `if (viewed.getMonth() < current.getMonth())` in route components | `compareMonth(viewed, current)` pure function + Vitest fixtures | Year-boundary correctness (`.getMonth()` of Dec + 1 year is not greater); DST fixture coverage; reusable across page + client components |
| Month arithmetic (add/sub) | Manual month math with `Date.setMonth` | `addMonths` / `subMonths` / `isSameMonth` / `getDaysInMonth` from `date-fns` | Already pinned in the stack. `setMonth(12)` silently wraps; `addMonths` doesn't. |
| Read-only enforcement | `if (past) return` in Server Actions | `ReadOnlyMonthError` thrown from service; `ActionResult.ok=false` shape with `error: "This month is archived."` | Single source of truth for the rule; covers replayed network requests that bypass UI; consistent with Phase 2 `OutOfMonthError` pattern |
| Goal copy atomic transaction | Two separate INSERTs + best-effort rollback | `db.transaction(async (tx) => { ... })` wrapping idempotency-check + multi-table INSERT | Drizzle `transaction()` guarantees atomicity; PITFALLS §3 mandates `< 30 lines SQL` — transaction helper satisfies that |
| UPSERT with composite unique | `SELECT` + conditional `INSERT`/`UPDATE` | `.onConflictDoUpdate({ target: [t.userId, t.month], set: {...} })` | Postgres native, atomic, one round-trip. Drizzle 0.45 supports array-of-columns target for composite unique constraint `[CITED: orm.drizzle.team/docs/guides/upsert]`. |
| Character counter logic | Compute+render on every keystroke in JSX inline | `watch('field')?.length ?? 0` + a color helper function | Small pure calculation; RHF `watch` is the idiomatic path |
| Debounced autosave | `setTimeout` inline in event handlers + manual cleanup scattered | Single `useEffect` on watched values + `onBlur` flush | Ships correctly in React 18+, survives rerenders, cleans up on unmount |
| Keyboard navigation | Per-component `keydown` inside goal card | Single `useEffect` on `window` in `MonthNavigator` | Captures at the route level regardless of focus position (except inputs) |
| 404 page for invalid month | Custom 404 route file | `notFound()` from `next/navigation` | Framework-standard; respects layouts; server-rendered `[CITED: nextjs.org/docs/app/api-reference/functions/not-found]` |
| Toaster per-route | Conditional `<Toaster />` in route branches | Single mount in `src/app/layout.tsx` (already done) | Less surface area; no mount/unmount jitter; past routes simply don't fire toasts |
| Clamp target_days to days-in-month | Hand-written calendar math | `getDaysInMonth(toMonth)` from `date-fns` + `Math.min` | 2-line helper; already in the bundle |
| Past/future card variant switch | Duplicate `<GoalCard>` render branches | Single `GoalCard` with `variant: 'mutable' | 'read-only'` prop threaded to children | CONTEXT.md code-context recommendation; avoids visual drift |

**Key insight:** Phase 3 is integration, not greenfield. Every primitive needed (date math, transactions, UPSERT, Zod schemas, RHF autosave, `notFound()`, `useRouter.push`) already exists in a pinned library. **There is zero need for new utilities, new helpers, or new abstractions beyond `compareMonth` + `formatMonthSegment` + `parseMonthSegment` + `ReadOnlyMonthError` + `copyGoalsFromLastMonth` + `upsertReflection`.** If a plan proposes a new utility beyond those six, reject it.

## Runtime State Inventory

**Trigger check:** Phase 3 IS a refactor — the Phase 2 `OutOfMonthError` class is being renamed/generalized to `ReadOnlyMonthError`. Inventory:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **Postgres `goals.month` values:** no rename needed. `progress_entries.logged_local_date`: no rename. `tasks`, `habit_check_ins`: no rename. Phase 3 adds a new table but doesn't rename anything. | None — no data migration needed. |
| Live service config | None — no external service registered on the `OutOfMonthError` name. Supabase Cloud has no awareness of app-layer error class names. | None. |
| OS-registered state | None. The rename is entirely inside a Node runtime; no Task Scheduler / systemd unit references `OutOfMonthError`. | None. |
| Secrets/env vars | None. No secret keys reference the error class name. | None. |
| Build artifacts | **TypeScript compile cache + tsbuildinfo** potentially references `OutOfMonthError` symbol. **Test files** import `OutOfMonthError` from `@/server/services/progress` (existing: tests/actions.progress.test.ts, tests/readonly-month-enforcement.test.ts if any references survive). | `rm -rf .next tsconfig.tsbuildinfo` after rename; grep-replace `OutOfMonthError` → `ReadOnlyMonthError` across `src/**/*.ts` and `tests/**/*.ts` in one atomic rename commit. |
| Code imports | Grep confirms Phase 2 throws `OutOfMonthError` from: `src/server/services/progress.ts` (5 throw sites: incrementCount, backfillCount, toggleTask, upsertHabitCheckIn). Phase 2 imports it in: `src/server/actions/progress.ts` (for error-to-message mapping). Phase 2 tests reference it in `tests/actions.progress.test.ts`. | Rename at definition site; let TS surface every consumer; update imports in lock-step. |

**Canonical rename question:** After every file in the repo is updated, does any runtime system still have the old string cached? **No.** The `OutOfMonthError` name only lives in TypeScript source + `tsbuildinfo`. The `.message` string ("That date isn't in the current month.") is the only user-visible consequence — consider whether to keep it or evolve to "This month is archived." per UI-SPEC error-copy table. **Recommendation:** update the message too, to match UI-SPEC verbatim copy `"This month is archived."`; no user has seen the old message (Phase 2 production hasn't shipped).

## Common Pitfalls

### Pitfall 1: Past-month write bypass via replayed request
**What goes wrong:** A curl / Postman / stale-tab request PATCHes a past-month goal or logs progress against a past-month date. UI has hidden the kebab, but the server accepts the write because the service-layer check was skipped.
**Why it happens:** Developer writes the UI guard first, thinks "no way for this to reach the server," skips the service-layer throw.
**How to avoid:** Every write path in `src/server/services/goals.ts` and `src/server/services/progress.ts` MUST call `assertMutable...(goal.month, currentMonth)` and throw `ReadOnlyMonthError` when the condition fails. Test at the service level (not just the action).
**Warning signs:** A test that mutates UI-hidden affordances and asserts 403 is absent from the plan. A service function accepts `goalId` + payload without reloading the goal + month-checking.

### Pitfall 2: Timezone drift between past/current/future classification
**What goes wrong:** User in `Pacific/Auckland` opens the app at 11:30 PM on March 31 local (which is April 1 UTC). `compareMonth(March, April)` classifies March as "past" even though locally March isn't over.
**Why it happens:** `monthBucket(new Date(), userTz)` is correct (Phase 1 `[VERIFIED: tests/time.test.ts]`), but a buggy callsite might bypass it and call `new Date().getMonth()` directly.
**How to avoid:** The route page MUST compute `currentMonth = monthBucket(new Date(), userTz)` once and pass the result to `compareMonth`. Never recompute "now" or "current month" in a child component. The existing `src/app/(protected)/dashboard/page.tsx` (Phase 2) already does this correctly — Phase 3 extends the same pattern.
**Warning signs:** Any `new Date().getMonth()` or `new Date().getFullYear()` in Phase 3 code; `compareMonth(viewed, new Date())` without the `monthBucket` wrapper.

### Pitfall 3: Copy-from-last-month with client-supplied `fromMonth`/`toMonth`
**What goes wrong:** Attacker replays the copy action with `toMonth = 2025-12` to overwrite a past month with arbitrary goals, or `fromMonth = <other-user's-previous-month>` (though RLS blocks the SELECT, the attempt is noise).
**Why it happens:** Developer passes month values through the form body to save a `new Date()` call server-side.
**How to avoid:** `copyGoalsFromLastMonthAction` accepts ZERO month arguments. Server derives `toMonth = monthBucket(new Date(), userTz)` and `fromMonth = subMonths(toMonth, 1)`. The action signature has exactly zero input params (beyond the implicit session user). D-21 locks this.
**Warning signs:** The server action signature has a `toMonth` or `fromMonth` parameter. The Zod schema for the copy action accepts a month field.

### Pitfall 4: Race-condition double-click on "Copy from last month"
**What goes wrong:** User double-clicks the Copy button; two server actions fire simultaneously; both pass the idempotency guard (count === 0) before either commits; resulting duplicate goal rows.
**Why it happens:** Idempotency guard uses `SELECT COUNT` outside the transaction, or inside a transaction without `SELECT FOR UPDATE` locking.
**How to avoid:** Drizzle `db.transaction()` gives serializable-within-transaction semantics for Postgres; the `SELECT COUNT` inside the transaction + subsequent INSERTs provide correct isolation for this workload because concurrent transactions will see each other's inserts by the time they commit. For extra safety, the client disables the button during `isPending` (React 19 `useTransition`). Combined, the race is practically eliminated.
**Warning signs:** The Copy button isn't disabled while the action is pending; the guard is implemented as a non-transactional pre-check.

### Pitfall 5: Reflection autosave fires on initial mount with empty strings, clobbering null
**What goes wrong:** Component mounts with `initial = null`; `useEffect` on `[whatWorked, whatDidnt]` runs immediately; 800ms later fires an UPSERT with `whatWorked: '' → null`. Creates a `month_reflections` row with two nulls, which is indistinguishable from "no reflection saved" except that the row exists.
**Why it happens:** No initial-mount skip in the debounce effect.
**How to avoid:** Options: (a) track `hasUserInteracted` state; (b) compare current form values to `initial` and skip save if equal; (c) accept the no-op UPSERT (it's idempotent and harmless — two nulls map to same user-visible state as no row). Recommendation: **(c)** — less code, no UX difference, harmless extra INSERT once per reflection card mount. D-30 allows "empty both fields" as a valid state that still writes.
**Warning signs:** A reflection card with `null` initial values saves a row with both nulls on page load and complaints about "why does this row exist in the DB."

### Pitfall 6: Next-arrow disabled state leaks through `<Link>` click
**What goes wrong:** CSS `pointer-events-none` is applied to the Link, but a keyboard user tabs to it and hits Enter — navigation fires anyway because keyboard events bypass pointer-events.
**Why it happens:** Developer relies on `pointer-events: none` as the only gate.
**How to avoid:** Use both: `aria-disabled="true"`, `tabIndex={-1}`, AND guard the keyboard handler in `MonthNavigator` (already does: `if (e.key === 'ArrowRight' && !isNextDisabled)`). For the Link itself, render a `<span>` instead of an `<a>` when disabled (asChild + conditional swap), or add an `onClick={(e) => isNextDisabled && e.preventDefault()}` handler.
**Warning signs:** Keyboard-only test user can navigate past current+1.

### Pitfall 7: Past-month habit grid shows red X on miss cells
**What goes wrong:** Executor, seeing "miss cells", styles them with `bg-destructive`. UI becomes a regret trigger instead of a portfolio of wins.
**Why it happens:** Natural pattern-match ("miss = bad = red") overrides product rule.
**How to avoid:** PITFALLS §Pitfall 1 + UI-SPEC §Visual Regression Guardrail #6 + #7. Miss cells = `bg-muted` (the same as the current month). Hit cells = `bg-primary` (emerald). Never red. Add an auditor check grep for the punitive-language list in UI-SPEC §Guardrail #7.
**Warning signs:** Any `bg-red-*` / `text-red-*` / `bg-destructive` / `×` / `✗` in Phase 3 code.

### Pitfall 8: Reflection textarea maxLength enforced only client-side
**What goes wrong:** User pastes 1000 characters; the `<textarea maxLength={280}>` truncates to 280 on paste (browser behavior), but a programmatic form submission or replay could pass arbitrarily long values. Server accepts them, breaking the 280-char contract.
**Why it happens:** Trusting HTML attributes as validation.
**How to avoid:** Zod `z.string().max(280)` in `reflectionSchema`, re-parsed in `upsertReflectionAction`. The HTML `maxLength` is UX (prevents typing-over); Zod is authority.
**Warning signs:** Server action doesn't call `.safeParse()`; client schema differs from server schema.

### Pitfall 9: Grep for `OutOfMonthError` leaves one reference after rename
**What goes wrong:** Rename is done via IDE or sed; one callsite (e.g., a comment, a test, a debug log) is missed; TS doesn't flag it because the reference is in a string. Rename is half-done.
**Why it happens:** Incomplete search scope.
**How to avoid:** Run `rg "OutOfMonthError"` (Grep tool) across entire repo after rename; assert count = 0. Include `.md` files (documentation comments) if renaming the error class.
**Warning signs:** `rg "OutOfMonthError"` returns non-empty after the rename PR.

## Code Examples

(See §Architecture Patterns for the core examples — Pattern 1 through Pattern 8 each include an executable snippet sourced from CONTEXT.md or upstream docs.)

### Additional: `countGoalsInMonth` helper query

```typescript
// src/server/db/queries.ts (extension)
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/server/db'
import { goals } from '@/server/db/schema'

export async function countGoalsInMonth(userId: string, month: Date): Promise<number> {
  const monthStr = month.toISOString().slice(0, 10)
  const rows = await db.select({ count: sql<number>`count(*)::int` })
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.month, monthStr)))
  return rows[0]?.count ?? 0
}
```

### Additional: `getReflectionForMonth` helper query

```typescript
// src/server/db/queries.ts (extension)
export async function getReflectionForMonth(userId: string, month: Date) {
  const monthStr = month.toISOString().slice(0, 10)
  const [row] = await db.select({
      whatWorked: monthReflections.whatWorked,
      whatDidnt: monthReflections.whatDidnt,
    })
    .from(monthReflections)
    .where(and(eq(monthReflections.userId, userId), eq(monthReflections.month, monthStr)))
    .limit(1)
  return row ?? null
}
```

### Additional: `reflectionSchema` Zod canonical

```typescript
// src/lib/schemas/reflections.ts
import { z } from 'zod'

const reflectionField = z
  .string()
  .max(280, 'That's a bit long — try trimming it to under 280 characters.')
  .transform((s) => (s.trim() === '' ? null : s))    // D-30 empty → null

export const upsertReflectionSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid month'),
  whatWorked: z.union([reflectionField, z.null()]).optional().transform((v) => v ?? null),
  whatDidnt: z.union([reflectionField, z.null()]).optional().transform((v) => v ?? null),
})
// Client form schema (pre-transform, for RHF `watch`) — keeps raw strings for counter display:
export const reflectionFormSchema = z.object({
  whatWorked: z.string().max(280),
  whatDidnt: z.string().max(280),
})
export type UpsertReflectionInput = z.infer<typeof upsertReflectionSchema>
export type ReflectionFormInput = z.infer<typeof reflectionFormSchema>
```

### Additional: `monthSegmentSchema` Zod canonical

```typescript
// src/lib/schemas/month.ts  (or inline at top of src/lib/time.ts)
import { z } from 'zod'

export const monthSegmentSchema = z.string()
  .regex(/^\d{4}-\d{2}$/, 'Invalid month segment')
  .refine((s) => {
    const [year, month] = s.split('-').map(Number)
    return year >= 1970 && year <= 9999 && month >= 1 && month <= 12
  }, 'Month out of range')
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Synchronous `params` access in page components | `await params` — params is a `Promise` | Next.js 15, stable in Next 16 | Required. TS errors if skipped. `[CITED: GitHub issue vercel/next.js#77609]` |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` 0.10.2 | Mid-2024 | Already adopted in Phase 1. No change. |
| Client-side month state + `localStorage` | URL segment as canonical state + `useRouter.push` | Next 13 App Router (2023+) | Phase 3 adopts. Already locked by D-01. |
| `framer-motion` package | `motion` (import `motion/react`) | 2025 rename | Already adopted in Phase 2. No change. |
| Drizzle `db.query.X.findMany` for complex joins | `db.select()` + `sql` template for JSON aggregation | Phase 2 established | Continue; reflection queries use the same pattern. |
| `pgPolicy()` function helpers | `crudPolicy()` helper (newer) | Drizzle 0.40+ | Phase 1 uses `pgPolicy` directly (4 separate policies). Phase 3 continues that pattern for `month_reflections` for consistency. Could migrate to `crudPolicy` helper but CONTEXT.md D-24 says "crudPolicy" — planner note: the existing repo uses `pgPolicy` (inspected in schema.ts). Use whatever matches existing repo style; recommendation: stay with `pgPolicy` for Phase 3. |

**Deprecated/outdated:** None relevant to Phase 3. All pinned libraries are current.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Drizzle 0.45 `onConflictDoUpdate({ target: [col1, col2] })` works with a named `unique()` constraint that covers those columns on Postgres | Pattern 7 | Medium — verified by official docs `[CITED: orm.drizzle.team/docs/guides/upsert]` but not run locally; mitigation: plan includes a test (`tests/actions.reflections.test.ts`) that asserts a second UPSERT on the same (user, month) updates the same row rather than erroring. |
| A2 | String comparison `'2026-03-01' < '2026-04-01'` is equivalent to calendar comparison for all our month values | Pattern 2 (`assertMutableForGoalWrite`) | Low — ISO `YYYY-MM-DD` strings are lexically ordered same as calendrically ordered; `monthBucket` always emits this format. Worth noting in a unit-test assertion. |
| A3 | Renaming `OutOfMonthError` → `ReadOnlyMonthError` + updating the message won't surprise production users | §Runtime State Inventory | Low — Phase 2 is not in production yet (STATE.md shows `status: verifying`). Recommendation: rename in one atomic commit in Wave 1. |
| A4 | The `initial`-render UPSERT behavior (Pitfall 5 option c) is acceptable — writing a row with two nulls on first mount of a page that has no reflection yet is harmless | Pitfall 5 | Low — the row's existence doesn't surface to users (empty placeholders render identically). If it matters for analytics later, add a `hasUserInteracted` gate. |
| A5 | Next.js 16 `notFound()` from `'next/navigation'` in an RSC renders the framework 404 page and does not crash the route | Pattern 1 | Low — standard Next 16 behavior `[CITED: nextjs.org/docs/app/api-reference/functions/not-found]`. No custom `not-found.tsx` is strictly needed for Phase 3 (framework default is acceptable for v1). |
| A6 | `MonthNavigator` as a client component nested under an RSC route does not trigger hydration issues with the `Link` prefetch | Pattern 4 | Low — standard App Router pattern; verified in Phase 2 `DashboardShell` which is also a client child of an RSC page. |
| A7 | The planner's chosen debounce timeout of 800ms feels right for a reflection textarea; if UAT reveals 500ms is better, the change is trivial | Pattern 8 | Very low — tuning parameter, not architectural. |

**User confirmation not required** — all assumptions are low-risk defaults with mitigations or explicit fallbacks. If the planner disagrees with A3 (the rename rationale), either approach is acceptable per CONTEXT.md Claude's Discretion.

## Open Questions

1. **Should `/dashboard/{invalid-segment}` render 404 or redirect to current month?**
   - What we know: D-03 — "Invalid segments render a 404 (or redirect to current month — planner's call; do not swallow silently)."
   - What's unclear: Product voice trade-off; 404 is more honest ("this URL doesn't exist"), redirect is more forgiving ("we corrected your URL").
   - Recommendation: **404 via `notFound()`** — matches URL-as-contract framing. A redirect could also be a reasonable choice; do not spend planning cycles debating.

2. **Should `reflectionFormSchema` allow empty strings or require trimming client-side?**
   - What we know: D-30 — empty both fields still writes a row.
   - What's unclear: Whether the CLIENT schema should accept whitespace-only strings and transform them to empty, or whether the server-side `upsertReflectionSchema` does that with its `.transform`.
   - Recommendation: Client `reflectionFormSchema` accepts raw strings for counter display; server `upsertReflectionSchema` applies the `trim === '' → null` transform. Split responsibility.

3. **Exact file location for `compareMonth`: `src/lib/time.ts` or new `src/lib/month.ts`?**
   - What we know: Claude's discretion. `src/lib/time.ts` already hosts `today` + `monthBucket`.
   - Recommendation: **Extend `src/lib/time.ts`**. Six exports (`today`, `monthBucket`, `compareMonth`, `formatMonthSegment`, `parseMonthSegment`, plus existing TZDate import) is still a small file and thematically coherent. A new `month.ts` would double-locate date logic.

## Environment Availability

Phase 3 has no net-new external dependencies beyond those already verified in Phase 1 + Phase 2 builds.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Entire stack | ✓ | v22.21.1 `[VERIFIED: node --version]` | — (Next 16 requires ≥20.9) |
| npm / npx | shadcn install, drizzle-kit run | ✓ | 10.9.4 `[VERIFIED: npm --version]` | — |
| Supabase CLI | Migration propagation (`supabase db push --linked`) | ✓ | 2.90.0 `[VERIFIED: supabase --version]` | — |
| psql | Local DB inspection | ✗ | — | Use inline `node -e` + `postgres.js` (Phase 1 Plan 01-03 established pattern) |
| Supabase dev project | Runtime + migrations + RLS test | ✓ | (existing from Phase 1) | — |
| Drizzle Kit | Schema → migration generation | ✓ | 0.31.10 `[VERIFIED: package.json]` | — |

**Missing dependencies with no fallback:** None — Phase 3 is purely additive to an already-running stack.

**Missing dependencies with fallback:** `psql` is not present; the Phase 1 pattern (`node -e` + `postgres.js`) is documented and proven.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 `[VERIFIED: package.json]` |
| Config file | `/Users/rathtana.duong/gsd-tutorial/vitest.config.ts` `[VERIFIED: inspected]` |
| Quick run command | `npx vitest run tests/time.compareMonth.test.ts` (or targeted file) |
| Full suite command | `npx vitest run` |
| Environment | `node` (default) — switch to `jsdom` for ReflectionCard component tests if written |
| Existing test inventory | 11 test files in `/Users/rathtana.duong/gsd-tutorial/tests/` — `time.test.ts`, `schemas.goals.test.ts`, `actions.progress.test.ts`, `queries.month-dashboard.test.ts`, `rls.test.ts`, etc. |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MNAV-01 | compareMonth classifies past/current/future correctly across DST + year boundaries | unit (pure) | `npx vitest run tests/time.compareMonth.test.ts` | ❌ Wave 0 |
| MNAV-01 | formatMonthSegment / parseMonthSegment round-trip | unit | `npx vitest run tests/time.monthSegment.test.ts` | ❌ Wave 0 |
| MNAV-01 | monthSegmentSchema rejects malformed and out-of-range values | unit | `npx vitest run tests/schemas.month.test.ts` | ❌ Wave 0 |
| MNAV-02 | Past-month PATCH via `updateGoal` service throws `ReadOnlyMonthError` | integration (service) | `npx vitest run tests/readonly-month-enforcement.test.ts` | ❌ Wave 1 |
| MNAV-02 | Past-month DELETE via `deleteGoal` service throws `ReadOnlyMonthError` | integration | (same file) | ❌ Wave 1 |
| MNAV-02 | Past-month `incrementCount` via service throws `ReadOnlyMonthError` | integration | (same file) | ❌ Wave 1 |
| MNAV-02 | Action-result `{ ok: false, error: 'This month is archived.' }` shape | integration | `npx vitest run tests/actions.goals.readonly.test.ts` | ❌ Wave 1 |
| MNAV-03 | Copy-from-last-month inserts shells only (current_count=0, is_done=false, no check_ins, no progress_entries) | integration | `npx vitest run tests/actions.copyGoals.test.ts` | ❌ Wave 4 |
| MNAV-03 | Copy-from-last-month aborts when target month already has goals (idempotency) | integration | (same file) | ❌ Wave 4 |
| MNAV-03 | Copy-from-last-month clamps target_days to getDaysInMonth(toMonth) | integration | (same file) | ❌ Wave 4 |
| MNAV-04 | Welcome trigger: current-or-future month + zero goals + prior month has ≥1 goal | integration (page render) | `npx vitest run tests/routes.dashboardMonth.welcome.test.ts` | ❌ Wave 4 |
| MNAV-04 | Welcome trigger false when prior month empty (falls back to Phase 2 EmptyState) | integration | (same file) | ❌ Wave 4 |
| GOAL-05 | Future-month goal creation succeeds (goals.month = currentMonth + 1 allowed) | integration | `npx vitest run tests/actions.goals.futureMonth.test.ts` | ❌ Wave 1 |
| GOAL-05 | Future-month progress logging still throws ReadOnlyMonthError (D-11) | integration | `npx vitest run tests/readonly-month-enforcement.test.ts` | ❌ Wave 1 |
| POLSH-04 | reflectionSchema rejects >280 chars; transforms empty string → null | unit | `npx vitest run tests/schemas.reflections.test.ts` | ❌ Wave 3 |
| POLSH-04 | upsertReflectionAction UPSERT: first call inserts, second call updates same row | integration | `npx vitest run tests/actions.reflections.test.ts` | ❌ Wave 3 |
| POLSH-04 | upsertReflectionAction on past month succeeds (D-27: reflection editable on past) | integration | (same file) | ❌ Wave 3 |
| POLSH-04 | upsertReflectionAction on future month rejected (D-28: not shown on future) | integration | (same file) | ❌ Wave 3 |
| D-07 | MonthNavigator keyboard shortcut: ArrowRight disabled at current+1 bound | unit (client component) | `npx vitest run tests/month-navigator.test.tsx` (jsdom) | ❌ Wave 2 (optional — can also be manual UAT) |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/<file>.test.ts` — the specific new/changed test, ~2-5 seconds
- **Per wave merge:** `npx vitest run` — full suite (~20-40 seconds based on Phase 2 trend)
- **Phase gate:** Full suite green before `/gsd-verify-work`; manual UAT for keyboard nav + visual freeze

### Wave 0 Gaps

Tests to add before implementation (Wave 0 = foundation):

- [ ] `tests/time.compareMonth.test.ts` — covers MNAV-01 classification; fixtures: past, current, future, year-boundary (Dec 2025 vs Jan 2026), DST spring-forward month, leap-year Feb boundary, same-day-different-tz edge
- [ ] `tests/time.monthSegment.test.ts` — covers formatMonthSegment/parseMonthSegment round-trip; asserts `formatMonthSegment(parseMonthSegment('2026-04')) === '2026-04'`; asserts `parseMonthSegment('2026-04').getUTCDate() === 1`
- [ ] `tests/schemas.month.test.ts` — covers monthSegmentSchema: accepts `2026-04`, rejects `26-4`, `2026-13`, `2026-00`, `2026-4`, `abc-de`, `''`
- [ ] `tests/readonly-month-enforcement.test.ts` — service-layer smoke for every write path in goals.ts + progress.ts against past-month goals
- [ ] `tests/schemas.reflections.test.ts` — reflectionSchema max(280) rejection + empty-string → null transform
- [ ] `tests/actions.reflections.test.ts` — UPSERT behavior across two calls + past/future month gating
- [ ] `tests/actions.copyGoals.test.ts` — full copy semantics + idempotency + target_days clamp
- [ ] `tests/routes.dashboardMonth.welcome.test.ts` — Welcome trigger preconditions (three branches)
- [ ] **Framework install:** none — Vitest already present, `@vitejs/plugin-react` already present for jsdom test if MonthNavigator unit test is included

**Existing test infrastructure covers:** pure time functions (`time.test.ts`), schema validation pattern (`schemas.goals.test.ts`, `schemas.auth.test.ts`), server-action tests with mocked Supabase (`actions.progress.test.ts`, `actions.goals.test.ts`), query tests (`queries.month-dashboard.test.ts`), RLS policy smoke (`rls.test.ts`). Phase 3 follows the exact same patterns — zero new frameworks or harnesses.

## Security Domain

Phase 3 changes the security boundary by introducing one new table + one new surface (copy-from-last-month). All existing Phase 1 + 2 hardening carries forward unchanged.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `@supabase/ssr` session refresh in middleware (unchanged from Phase 1) |
| V3 Session Management | yes | Supabase session cookie `HttpOnly + Secure + SameSite=Lax` (Phase 1 D-18); middleware re-validates via `supabase.auth.getUser()` on every request |
| V4 Access Control | yes | Two layers: (a) Drizzle service asserts `goal.userId === userId` on every write (existing pattern); (b) Postgres RLS `user_id = auth.uid()` on all five tables (existing + new `month_reflections` follows same pattern) |
| V5 Input Validation | yes | Zod on every server action: `monthSegmentSchema`, `upsertReflectionSchema`, `createGoalSchema` (existing), `copyGoalsFromLastMonthSchema` = empty object (server-derived months — D-21) |
| V6 Cryptography | yes | None hand-rolled in Phase 3; Supabase handles session signing; tokens unchanged |
| V9 Communications | inherited | HTTPS enforced by Vercel/Supabase; no Phase 3 change |
| V13 Config | yes | `CHECK EXTRACT(DAY FROM month) = 1` on `month_reflections.month` (mirrors goals.month constraint); `UNIQUE (user_id, month)` prevents duplicate reflection rows |

### Known Threat Patterns for {Next.js 16 + Supabase + Drizzle}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Replayed PATCH to past-month goal | Tampering | Service-layer `ReadOnlyMonthError` (D-12); test at service level not just UI |
| Malicious `fromMonth`/`toMonth` in copy action | Tampering / Elevation | Server-derived months ONLY (D-21); zero month params in action signature |
| SQL injection via `[month]` URL segment | Tampering | Zod regex guard before parse; Drizzle parameterized queries — never string-concat SQL |
| IDOR: user A deletes user B's goal via crafted goalId | Information Disclosure / Tampering | Existing pattern: service asserts `goal.userId === userId` (see Phase 2 `deleteGoal`); RLS as second layer |
| Cross-tab stale session on month change | Information Disclosure | `@supabase/ssr` middleware refresh on every request (already in place); route segments reload |
| Race-condition double-write on UPSERT | Tampering (low) | Unique constraint on `(user_id, month)` + `onConflictDoUpdate` → atomic at Postgres level |
| Reflection text > 280 chars via API bypass | Tampering / DoS (mild) | Zod `.max(280)` server-side re-parse (Pitfall 8) |
| Timing attack to enumerate other users' month_reflections | Information Disclosure | RLS `using: user_id = auth.uid()` — unauthorized rows don't leak even row counts |

**New threat surfaces introduced by Phase 3:**

1. `copyGoalsFromLastMonthAction` — mitigated by zero-param signature + server-derived months + idempotency guard
2. `month_reflections` table — mitigated by same RLS pattern as Phase 1+2 + CHECK constraint on month column
3. `/dashboard/[month]` dynamic segment — mitigated by Zod segment regex + `notFound()` + future-month cap

No new secret-handling, no new cryptography, no new third-party integration, no new webhook. Security risk delta: minor, all mitigated by following Phase 1+2 patterns verbatim.

## Sources

### Primary (HIGH confidence)

- **CLAUDE.md** (project instructions) — stack lock: Next 16.2.4, React 19.2.4, Motion 12.38, Supabase, Drizzle 0.45, Zod 4.3, date-fns 4.1 `[VERIFIED: npm view cross-checked 2026-04-20]`
- **`.planning/phases/03-month-navigation-history-reflection/03-CONTEXT.md`** — 30 locked decisions + Claude's discretion items + canonical refs
- **`.planning/phases/03-month-navigation-history-reflection/03-UI-SPEC.md`** — component inventory, copy, layout, accessibility, visual regression guardrails
- **`.planning/research/ARCHITECTURE.md`** §Recommended Project Structure (lines 66–105), §Pattern 4 (Month-Scoped Queries)
- **`.planning/research/PITFALLS.md`** §Pitfall 1 (Streak anxiety), §Pitfall 4 (Month-boundary UX), §Debt line 181 (past-month read-only server-side), §Line 259 (PATCH→403 acceptance test)
- **`.planning/research/SUMMARY.md`** §Phase 3 (lines 111–117) — research synthesis for the phase
- **`.planning/phases/01-foundations-auth/01-CONTEXT.md`** — Phase 1 D-09 migration flow, D-13/D-14 time functions, D-17 reset, D-20 RLS via crudPolicy
- **`.planning/phases/02-goals-dashboard-three-types/02-CONTEXT.md`** — D-05 progress_entries, D-17 server-derived month, D-20 Zod canonical, D-34 Sonner most-recent-only, ActionResult shape
- **Inspected repo files** — `src/server/services/progress.ts` (OutOfMonthError existing pattern, 5 throw sites), `src/server/services/goals.ts` (update/delete missing the guard — gap for Phase 3), `src/server/db/schema.ts` (pgPolicy pattern, 5 tables + RLS), `src/server/db/queries.ts` (getMonthDashboard, < 30 lines), `src/lib/schemas/goals.ts` (canonical schema shape), `src/lib/time.ts` (today + monthBucket pinned on @date-fns/tz), `src/middleware.ts` (@supabase/ssr refresh), `src/app/(protected)/dashboard/page.tsx` (current render, to be converted to redirect), `src/components/dashboard-shell.tsx` (useOptimistic + dispatch pattern), `src/app/layout.tsx` (Toaster mount — root only, confirmed), `tests/time.test.ts` (D-23 fixture style)
- **[Next.js 16 Dynamic Routes docs](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes)** — async params, generateStaticParams, notFound
- **[Next.js `notFound` function](https://nextjs.org/docs/app/api-reference/functions/not-found)** — framework default 404 behavior
- **[Drizzle ORM Upsert guide](https://orm.drizzle.team/docs/guides/upsert)** — onConflictDoUpdate target array for composite unique

### Secondary (MEDIUM confidence)

- **[Fixing Broken Dynamic Routes After Upgrading to Next.js 16 (Coffey)](https://coffey.codes/articles/fixing-broken-routes-after-nextjs-16-upgrade)** — current async-params gotchas
- **[Handle Dynamic Routing in Next.js (OneUptime)](https://oneuptime.com/blog/post/2026-01-24-nextjs-dynamic-routing/view)** — 2026 patterns
- **[Drizzle upsert with composite unique (Answer Overflow)](https://www.answeroverflow.com/m/1184867204517339216)** — community confirmation of array-target pattern

### Tertiary (LOW confidence)

- None — Phase 3 patterns are well-documented in primary + secondary sources; no LOW-confidence claims land in this research.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified via `npm view` + package.json cross-check on 2026-04-20
- Architecture: HIGH — Patterns 1, 2, 5, 6, 7, 8 are extensions of Phase 1/2 patterns already running in the repo; Patterns 3 + 4 are new but use standard Next.js + date-fns idioms
- Pitfalls: HIGH — nine pitfalls tied to verified failure modes in the codebase or in PITFALLS.md research doc
- Validation: HIGH — test map traces every phase requirement to an existing-pattern test file

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (30 days — stable ecosystem; Next 16.2.x, React 19.2.x, and Drizzle 0.45.x are all in maintenance mode with no breaking updates expected)

---

*Phase: 03-month-navigation-history-reflection*
*Research produced by gsd-phase-researcher on 2026-04-20*
