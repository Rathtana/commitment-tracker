# Phase 2: Goals & Dashboard (Three Types) - Research

**Researched:** 2026-04-18
**Domain:** Polymorphic goal schema + React 19 optimistic dashboard with Motion-driven progress bars
**Confidence:** HIGH for stack specifics, schema shape, and the Motion/CLS pattern; MEDIUM where CONTEXT.md already locks the decision and this doc just records the "why + pitfalls" for the planner.

## Summary

Phase 2 builds on a Phase-1 foundation that already locked the shape of most decisions here: polymorphic `goals` parent with a polymorphic-validity CHECK (D-01..D-08), pure `src/lib/progress.ts` for % + pace (D-10..D-14), current-month-only scope (D-17), and pure-function timezone helpers (`today`, `monthBucket`) already ship in `src/lib/time.ts`. The "research that is actually hard" therefore collapses into five areas where downstream planning will struggle without a deliberate pass:

1. **How the discriminated-union survives end-to-end** — DB CHECK ↔ Drizzle column nullability ↔ Zod `z.discriminatedUnion("type", ...)` ↔ TypeScript exhaustiveness ↔ Server Action runtime re-validation. Any one of these five layers drifting re-introduces "impossible states."
2. **The Motion-width-vs-CLS resolution (STATE.md's open research flag).** Animating `width` on every `+1` re-renders the layout and causes CLS regression. Motion's own docs say the right pattern is: fixed-size rail track + inner fill as a `motion.div` whose `scaleX` (not `width`) animates with spring physics; `transform-origin: left`. This replaces the Radix Progress indicator entirely rather than trying to splice into shadcn's Progress component.
3. **`useOptimistic` reducer-keyed-to-goal-id.** For a dashboard with three distinct mutation types (count delta, task toggle, habit check-in insert/delete) across many cards, the right shape is a single `useOptimistic(goals, reducer)` hoisted into the dashboard client shell — per-card `useOptimistic` duplicates state and makes undo-across-goals awkward.
4. **Progress-entries table semantics for undo + backfill.** D-05 + D-06 make `progress_entries` the write-ahead log for count goals; undo is "delete latest row + reverse the cached delta in the same transaction." Habits and checklists are their own logs — the undo reducer must branch on type, not on "is there a latest progress_entries row."
5. **Pace math edge cases.** `expected = days_elapsed / days_in_month` is trivial on paper but breaks at (a) DST spring-forward, (b) goal created mid-month, (c) `target_days > days_in_month` habits, and (d) the day-5 early-month guard. A Vitest fixture suite analogous to Phase 1's `time.test.ts` is mandatory.

**Primary recommendation:** Ship the schema + progress library + progress-bar component in Wave 0 before any card type lands. Then layer count → checklist → habit in that order (simplest type validates the whole pattern first — mirrors ARCHITECTURE.md build order §2→§5). The planner should *not* parallelize the progress-bar research with card implementation — the CLS-safe pattern is load-bearing for every card.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Goal CRUD (create/edit/delete) | API / Server Action | Database (RLS + CHECK) | Zod re-validation at action boundary; RLS defense-in-depth; polymorphic-validity CHECK as last line of defense |
| Polymorphic validity (type ↔ column consistency) | Database (CHECK constraint) | API (Zod discriminated union) | DB guarantees shape; app rejects early with better UX |
| Progress logging (count / checklist / habit) | API / Server Action | Database (transaction) | Must be atomic: insert log row + update cache in one tx |
| Optimistic UI update | Browser / Client | — | React 19 `useOptimistic` with reducer keyed on goal id |
| Progress % + pace math | Shared pure module (`src/lib/progress.ts`) | — | Imported by server (authoritative render) and client (optimistic recalc) — D-10 |
| Dashboard render (list of goals + children) | Frontend Server (RSC) | Database (single-query JOIN) | One round-trip, one 30-line SQL (PITFALLS §3 budget) |
| Month resolution (current month per user) | Frontend Server (RSC) | — | `monthBucket(new Date(), user.timezone)` from `src/lib/time.ts` (Phase 1 D-13/D-14) |
| Ownership / authorization | API (service assert) | Database (RLS) | Service asserts; RLS defends (D-08 mirrors Phase 1 D-20/D-22) |
| Authentication | Phase 1 foundation | — | Reuses `getSupabaseServerClient()` + middleware — no new work in this phase |
| Undo toast display | Browser / Client | — | Sonner `<Toaster>` hoisted once in root layout; each action returns an undo handle the client wires up |
| Habit month-grid rendering | Browser / Client | — | Layout computed from `habit_check_ins` + `date-fns` `eachDayOfInterval` over the current month |
| Progress-bar animation | Browser / Client | — | `motion/react` `scaleX` + `transform-origin: left` (CLS-safe) |
| Pace "days elapsed" computation | Shared pure module | — | Pure function of `(now, userTz, month)` — no DB, no client clock drift |

## User Constraints (from CONTEXT.md)

### Locked Decisions

The 40 decisions in CONTEXT.md D-01..D-40 are locked. Rather than restate them verbatim (they're on disk), I list the ones that bind research-space most tightly:

- **D-01..D-09 (Schema & Migrations):** Class-table-inheritance with `tasks` and `habit_check_ins` child tables, polymorphic-validity CHECK on `goals`, nullable `target_count` / `current_count` / `target_days` columns on `goals`, `progress_entries` log table for count only. Drizzle-kit emits to `supabase/migrations/`. No JSONB for core entity data (ARCHITECTURE.md Anti-Pattern 2, PITFALLS §3).
- **D-06:** `goals.current_count` is a denormalized cache — every `+1` is a two-write transaction (INSERT log + UPDATE cache).
- **D-10..D-14 (Progress calc):** Pure `src/lib/progress.ts` returns `{percent, raw, expected, pace, paceDelta}`. Pace chip suppressed before day 5; checklist is always `'on-pace'`; paceDelta is in integer units, not %.
- **D-15..D-20 (Goal CRUD):** 2-step create dialog; type immutable after creation; edit reopens same Dialog prefilled; Zod discriminated union in `src/lib/schemas/goals.ts`.
- **D-21..D-26 (Dashboard layout):** Single-column ~720px; identical progress bar across types; **custom motion-based bar replacing Radix Progress indicator** (D-23 → STATE.md research flag). Cards ordered by `position ASC, created_at ASC`.
- **D-28..D-31 (Optimistic UI):** `useOptimistic` on every mutation; rollback on server error.
- **D-32..D-34 (Undo):** Sonner 6-second toast, most-recent-only (stacked undo deferred).
- **D-35..D-37 (Backfill):** Habit grid backfills by tap; count kebab has "Log for earlier day" popover; checklist has no backfill affordance.
- **D-38..D-40 (Habit grid):** 7×6 Sun–Sat calendar; cell states Hit/Miss/Today/Future; accessible button-per-cell with explicit aria-labels.

### Claude's Discretion

- Motion spring `stiffness`/`damping`/`bounce` values (CLS-safe values recommended below)
- Card hover/focus styles
- Task drag-reorder during creation (nice-to-have)
- Pace-chip amber/success color tokens (must add new tokens, not reuse `--color-destructive`)
- Copy voicing (empty-state, toast, popover labels)
- Kebab icon choice
- Grid cell tooltip on hover
- File organization under `src/components/goal-card/{count,checklist,habit}.tsx`

### Deferred Ideas (OUT OF SCOPE)

Month navigation (MNAV-01), past-month read-only enforcement (MNAV-02), future-month pre-planning UI (GOAL-05), Copy-from-last-month (MNAV-03), Welcome-to-Month prompt (MNAV-04), end-of-month reflection (POLSH-04), mobile-responsive final pass (POLSH-01), error-toast hardening (POLSH-02), card drag-reorder, per-goal color/emoji, editing `target_count` mid-month UX, task drag-reorder post-creation, stacked undo.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GOAL-01 | Create goal with name, type, target, optional notes, associated month | Zod `goals.ts` discriminated union + polymorphic CHECK; 2-step Dialog (D-15/D-16) |
| GOAL-02 | Edit goal (current or future month) | Same Dialog reopened with `type` readonly (D-18); Zod `updateGoalSchema` per type |
| GOAL-03 | Delete goal with confirmation | shadcn `<AlertDialog>` + ON DELETE CASCADE on children (D-19) |
| PROG-01 | Increment count goal from dashboard in one click | Primary `+1` button + stepper; `useOptimistic` + Server Action `incrementCountAction` (D-28); two-write transaction (D-06) |
| PROG-02 | Toggle checklist sub-task | Tap Checkbox; `useOptimistic` flips; `toggleTaskAction` (D-29); tasks table is its own log |
| PROG-03 | Mark today done on habit | Tap today cell in grid; `upsertHabitCheckInAction` inserts or deletes row in `habit_check_ins` (D-30) |
| PROG-04 | Log missed day for any prior day in current month | Habit: tap past cell (D-35); Count: kebab "Log for earlier day" Popover + date picker (D-36); Checklist: N/A (D-37) |
| PROG-05 | Undo last action via short-lived toast | Sonner 6s toast; per-type undo reducer (D-33); most-recent-only (D-34) |
| DASH-01 | All current-month goals in single scrollable list | Single-column ~720px layout (D-21); no tabs, no drill-down |
| DASH-02 | Every goal renders a progress bar | Shared motion-based progress bar component (D-22/D-23); scaleX animation |
| POLSH-03 | Habit month-grid next to bar | 7×6 calendar with Hit/Miss/Today/Future states (D-38/D-39); accessible buttons (D-40) |

## Standard Stack

### Core (all locked from Phase 1 — verified current)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `next` | 16.2.4 | App Router + Server Actions + `revalidatePath` | [VERIFIED: npm view next version → 16.2.4] |
| `react` / `react-dom` | 19.2.5 | `useOptimistic`, `startTransition`, RSC | [VERIFIED: npm view react version → 19.2.5]; React 19.2.4 is pinned in package.json — 19.2.5 is the current registry head and is safe to bump (patch) |
| `motion` | 12.38.0 | Progress-bar spring animation, list reorder, dialog enter/exit | [VERIFIED: npm view motion version → 12.38.0] |
| `drizzle-orm` | 0.45.2 | Typed schema + RLS policies (`crudPolicy` / `pgPolicy`) + migrations | [VERIFIED: npm view drizzle-orm version → 0.45.2] |
| `drizzle-kit` | 0.31.10 | Generates migration SQL into `supabase/migrations/` | [VERIFIED: already pinned, Phase 1 Plan 01-03 pattern] |
| `postgres` | 3.4.9 | Driver; used both at runtime and by inline `node -e` verification scripts | [VERIFIED: package.json lock + Phase 1] |
| `@supabase/ssr` | 0.10.2 | `getSupabaseServerClient()` already shipped in `src/lib/supabase/server.ts` | [VERIFIED: npm view @supabase/ssr version → 0.10.2] |
| `@supabase/supabase-js` | 2.103.3 | Underlying client | [VERIFIED: Phase 1] |
| `zod` | 4.3.0 (registry head 4.3.6) | `z.discriminatedUnion("type", ...)` for goals schema | [VERIFIED: npm view zod version → 4.3.6]; the 4.3.0 pin is fine (patch-range). Do NOT bump to a new minor without reading the release notes — Phase 1 (STATE Plan 01-05) already hit a Zod 4 input/output-type quirk. |
| `@hookform/resolvers` | 5.2.2 | `zodResolver` for RHF ↔ Zod 4 bridge | [VERIFIED: Phase 1] |
| `react-hook-form` | 7.72.1 | Goal-creation and edit forms | [VERIFIED: Phase 1] |
| `date-fns` | 4.1.0 | `startOfMonth`, `endOfMonth`, `eachDayOfInterval`, `getDay`, `format` for habit grid + pace math | [VERIFIED: Phase 1] |
| `@date-fns/tz` | 1.4.1 | `TZDate` — already used by `src/lib/time.ts` | [VERIFIED: Phase 1] |
| `lucide-react` | 0.545.0+ | Icons: `Plus`, `Minus`, `MoreHorizontal`, `Check`, `Target`, `List`, `Calendar` | [VERIFIED: Phase 1] |
| `clsx` + `tailwind-merge` | latest | `cn()` helper (already in `src/lib/utils.ts`) | [VERIFIED: Phase 1] |

### New This Phase

| Library / Component | Version | Purpose | Source |
|---------------------|---------|---------|--------|
| `sonner` (via shadcn `add sonner`) | 2.0.7 | Undo toasts (D-32); uniform across three types | [VERIFIED: npm view sonner version → 2.0.7] |
| shadcn `dialog` | matches shadcn 4.3.0 | Goal create/edit 2-step flow (D-15) | [CITED: ui.shadcn.com/docs/components/dialog] |
| shadcn `alert-dialog` | matches shadcn 4.3.0 | Delete confirm (D-19) | [CITED: ui.shadcn.com/docs/components/alert-dialog] |
| shadcn `dropdown-menu` | matches shadcn 4.3.0 | Card kebab menu (D-18, D-36) | [CITED: ui.shadcn.com/docs/components/dropdown-menu] |
| shadcn `checkbox` | matches shadcn 4.3.0 | Checklist task rows (D-29) | [CITED: ui.shadcn.com/docs/components/checkbox] |
| shadcn `popover` | matches shadcn 4.3.0 | "Log for earlier day" date picker + stepper (D-36) | [CITED: ui.shadcn.com/docs/components/popover] |
| shadcn `sonner` | matches shadcn 4.3.0 | Toaster wrapper around sonner (D-32) | [CITED: ui.shadcn.com/docs/components/sonner] |

**Installation (per CONTEXT.md's "components not in repo yet"):**

```bash
npx shadcn@latest add dialog alert-dialog dropdown-menu checkbox popover sonner
# sonner itself is added as a dependency by `add sonner`; no separate npm install needed.
```

[VERIFIED: shadcn docs show `npx shadcn@latest add <component>` for each of the six components above — Context7 `/shadcn-ui/ui` `progress dialog alert-dialog dropdown-menu sonner checkbox popover install`]

### Explicitly NOT Used (reaffirmed for planner)

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `framer-motion` | Deprecated package name (CLAUDE.md) | `motion` + `import { motion, AnimatePresence, useReducedMotion } from "motion/react"` |
| Radix `Progress` indicator default | D-23: CLS regression when width animates on every click (STATE.md research flag) | Custom `<div>` rail + `<motion.div>` fill with `scaleX` (pattern below) |
| JSONB `config` column on `goals` | PITFALLS §3 anti-pattern; typed children are type-safe and queryable | `target_count`, `current_count`, `target_days` columns + typed children `tasks`, `habit_check_ins` |
| Prisma | CLAUDE.md constraint | Drizzle 0.45 |
| `tailwind.config.js` | Tailwind v4 uses `@theme` in `globals.css` (CLAUDE.md) | Add new tokens inside `@theme` in `src/app/globals.css` |
| Override `--spacing-*` core tokens | STATE.md lesson from Plan 01-05 | Add distinct `--color-warning-*` / `--color-success-*` tokens for pace chip |
| Client-side date libraries other than `date-fns` + `@date-fns/tz` | Phase 1 lock | Stay on date-fns ecosystem |

## Architecture Patterns

### System Architecture Diagram

```
                                       ┌──────────────────┐
                                       │ middleware.ts    │
  Browser / Client                     │ (Phase 1, gates  │
  (React 19 + motion/react)            │  auth) — unchanged│
                                       └────────┬──────────┘
 ┌────────────────────────────┐                 │
 │ /app/(protected)/dashboard │◄────── RSC render pipeline
 │  page.tsx                  │                 │
 │  ├─ DashboardShell (client)│                 │
 │  │    useOptimistic(goals) │                 │
 │  │   ┌─GoalCard.Count──┐   │                 │
 │  │   ├─GoalCard.Checkl.│   │                 │
 │  │   └─GoalCard.Habit──┘   │                 │
 │  │   <Sonner toaster>      │                 │
 │  └─ CreateGoalDialog       │                 │
 └────────────┬───────────────┘                 │
              │ Server Action calls            │
              ▼                                 │
 ┌────────────────────────────────────────┐     │
 │ src/server/actions/                    │     │
 │  ├─ goals.ts (create/update/delete)    │     │
 │  └─ progress.ts (increment/toggleTask/ │     │
 │     markHabit/undo/backfill)           │     │
 └────────────┬───────────────────────────┘     │
              │ Zod re-validate (goals.ts, progress.ts schemas)
              │ getUser() → userId
              │ call service layer
              ▼                                 │
 ┌────────────────────────────────────────┐     │
 │ src/server/services/ (thin)            │     │
 │  goals.ts, progress.ts, month.ts       │     │
 │  - assert ownership                    │     │
 │  - assert month in current (app layer) │     │
 └────────────┬───────────────────────────┘     │
              │ typed queries                  │
              ▼                                 │
 ┌────────────────────────────────────────┐     │
 │ src/server/db/                         │     │
 │  ├─ schema.ts (extended)               │     │
 │  │   goals + tasks + habit_check_ins   │     │
 │  │   + progress_entries                │     │
 │  └─ queries.ts (new)                   │     │
 │     getMonthDashboard(userId, month)   │     │
 └────────────┬───────────────────────────┘     │
              │                                 │
              ▼                                 │
 ┌────────────────────────────────────────┐     │
 │ Supabase Postgres                      │     │
 │  - RLS on every new table              │     │
 │  - polymorphic-validity CHECK on goals │     │
 │  - ON DELETE CASCADE on children       │     │
 │  - composite PK on habit_check_ins     │     │
 └────────────────────────────────────────┘     │
              ▲                                 │
              │ revalidatePath('/') after mutation
              └─────────────────────────────────┘

Pure shared module:
 ┌────────────────────────────────────────┐
 │ src/lib/progress.ts (pure)             │
 │  computeProgress(goal, now, userTz)    │
 │  → {percent, raw, expected, pace, paceDelta}
 │                                        │
 │ Imported by:                           │
 │  - RSC dashboard render (authoritative)│
 │  - Client useOptimistic reducer (echo) │
 │  - Vitest fixtures (lock semantics)    │
 └────────────────────────────────────────┘
```

### Recommended Project Structure

Follows ARCHITECTURE.md with Phase-1-proven adaptations (auth route group, `src/server/` layout):

```
src/
├── app/
│   ├── (protected)/
│   │   └── dashboard/
│   │       └── page.tsx              # RSC — fetch current-month dashboard, render DashboardShell
│   ├── page.tsx                       # Redirect `/` → `/dashboard` (keeps Phase 1 landing logic at middleware)
│   └── globals.css                    # Add `--color-warning-*` and `--color-success-*` @theme tokens
├── components/
│   ├── goal-card/
│   │   ├── index.tsx                  # Variant picker (discriminated on goal.type)
│   │   ├── count.tsx                  # +1, stepper, "Log for earlier day" kebab item
│   │   ├── checklist.tsx              # Task rows with Checkbox
│   │   └── habit.tsx                  # Month-grid + tap-today
│   ├── progress-bar.tsx               # Custom motion-based bar (replaces Radix Progress) — shared
│   ├── pace-chip.tsx                  # Amber "behind N" / emerald "ahead N" — hidden pre day-5
│   ├── habit-grid.tsx                 # 7×6 calendar, accessible buttons, states Hit/Miss/Today/Future
│   ├── create-goal-dialog.tsx         # 2-step: type picker → per-type fields (reused for edit)
│   ├── delete-goal-dialog.tsx         # AlertDialog confirm
│   ├── earlier-day-popover.tsx        # Count backfill: date picker + stepper
│   └── dashboard-shell.tsx            # Client component: hoists useOptimistic + Sonner undo wiring
├── server/
│   ├── actions/
│   │   ├── goals.ts                   # createGoalAction, updateGoalAction, deleteGoalAction
│   │   └── progress.ts                # incrementCountAction, toggleTaskAction,
│   │                                   #   upsertHabitCheckInAction, undoLastMutationAction,
│   │                                   #   backfillCountAction
│   ├── services/                      # (thin — services can be inlined into actions if small)
│   │   ├── goals.ts
│   │   ├── progress.ts
│   │   └── month.ts                   # currentMonthForUser(userId)
│   └── db/
│       ├── schema.ts                  # EXTEND in place with tasks, habit_check_ins, progress_entries
│       ├── queries.ts                 # NEW: getMonthDashboard(userId, month)
│       └── index.ts
├── lib/
│   ├── progress.ts                    # NEW: pure computeProgress — shared client+server
│   ├── schemas/
│   │   ├── auth.ts                    # unchanged
│   │   └── goals.ts                   # NEW: Zod discriminated union create + update schemas
│   ├── time.ts                        # unchanged — import today, monthBucket
│   └── utils.ts                       # unchanged
└── middleware.ts                      # unchanged — `/dashboard` is not in AUTH_ROUTES ⇒ already protected
```

**Why this shape:**
- `src/components/goal-card/{count,checklist,habit}.tsx` matches ARCHITECTURE.md's 3-file rule verbatim.
- `dashboard-shell.tsx` is the single `'use client'` boundary that holds `useOptimistic` — keeps per-card components as thin as possible, several of which can remain RSC-safe internally.
- Extending `src/server/db/schema.ts` in-place rather than creating a new schema file keeps drizzle-kit's introspection simple (Phase 1 STATE confirms this is the established pattern).
- `src/app/(protected)/dashboard/` uses the same route-group convention as `src/app/(auth)/auth/` (Phase 1 Plan 01-05 lesson — parens for layout grouping, real segment for middleware path matching).

### Pattern 1: Polymorphic parent + typed children + class-table-inheritance CHECK

**What:** Single `goals` table holds identity + the small per-type scalar fields (`target_count`, `current_count`, `target_days`); separate child tables (`tasks`, `habit_check_ins`) hold the variable-arity payloads; a polymorphic-validity CHECK forbids impossible states. `progress_entries` is a write-ahead log for count goals only.
**When to use:** When types share real identity (user, month, title, position, progress bar) but diverge on progress shape. ARCHITECTURE.md §Pattern 1.
**Why not JSONB:** PITFALLS §3 — core entity data deserves typed columns; JSONB is for flexible edges.
**Code (Drizzle schema, extending existing `src/server/db/schema.ts`):**

```typescript
// Source: CONTEXT.md D-01..D-08 + ARCHITECTURE.md §Data Model + Drizzle rls.mdx docs

import {
  pgTable, uuid, text, timestamp, date, pgEnum, foreignKey,
  pgPolicy, integer, boolean, primaryKey, check,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { authenticatedRole } from "drizzle-orm/supabase"

// ---------- goals (existing — add nullable per-type columns + polymorphic CHECK) ----------
export const goals = pgTable(
  "goals",
  {
    // ...existing columns from Phase 1...
    targetCount: integer("target_count"),     // valid only for type='count'
    currentCount: integer("current_count"),   // valid only for type='count'
    targetDays: integer("target_days"),       // valid only for type='habit'
  },
  (table) => [
    // ...existing FKs and RLS policies...
    // Polymorphic validity CHECK (D-04): cannot be expressed in Drizzle's column API,
    // must live in a custom SQL migration (0002_*) the way 0001 handles month_is_first_of_month.
    // Additional CHECKs: current_count >= 0, target_count > 0, target_days > 0.
  ],
)

// ---------- tasks (new; D-01) ----------
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    goalId: uuid("goal_id").notNull(),
    label: text("label").notNull(),
    isDone: boolean("is_done").notNull().default(false),
    position: integer("position").notNull().default(0),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.goalId], foreignColumns: [goals.id], name: "tasks_goal_id_fk" }).onDelete("cascade"),
    // RLS: ownership flows through goal_id → goals.user_id = auth.uid() (D-08).
    pgPolicy("tasks-select-own", {
      for: "select", to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())`,
    }),
    pgPolicy("tasks-insert-own", {
      for: "insert", to: authenticatedRole,
      withCheck: sql`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())`,
    }),
    pgPolicy("tasks-update-own", {
      for: "update", to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())`,
      withCheck: sql`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())`,
    }),
    pgPolicy("tasks-delete-own", {
      for: "delete", to: authenticatedRole,
      using: sql`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())`,
    }),
  ],
)

// ---------- habit_check_ins (new; D-02) ----------
export const habitCheckIns = pgTable(
  "habit_check_ins",
  {
    goalId: uuid("goal_id").notNull(),
    checkInDate: date("check_in_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.goalId], foreignColumns: [goals.id], name: "habit_check_ins_goal_id_fk" }).onDelete("cascade"),
    // Composite PK enforces uniqueness per (goal, day) structurally (D-02).
    primaryKey({ columns: [table.goalId, table.checkInDate], name: "habit_check_ins_pk" }),
    // Same JOIN-via-goal RLS pattern as tasks (D-08).
    pgPolicy("habit-check-ins-select-own", { /* ...same EXISTS shape... */ }),
    // insert/update/delete mirror tasks.
  ],
)

// ---------- progress_entries (new; D-05) ----------
export const progressEntries = pgTable(
  "progress_entries",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    goalId: uuid("goal_id").notNull(),
    delta: integer("delta").notNull(),          // signed: +N for logging, -N for undo-of-mistake corrections
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
    loggedLocalDate: date("logged_local_date").notNull(), // user's local day this counts toward (D-05)
  },
  (table) => [
    foreignKey({ columns: [table.goalId], foreignColumns: [goals.id], name: "progress_entries_goal_id_fk" }).onDelete("cascade"),
    // RLS (D-08) — same EXISTS-JOIN shape as tasks.
  ],
)
```

**Critical:** The polymorphic-validity CHECK (D-04), plus `current_count >= 0`, `target_count > 0`, `target_days > 0`, cannot live in Drizzle's column API. They belong in a new `supabase/migrations/0002_goals_polymorphic_checks.sql` file, mirroring the Phase 1 `0001_custom_constraints.sql` pattern. Post-push verification uses the Phase 1 inline `node -e + postgres.js` pattern.

### Pattern 2: Pure `computeProgress` shared across server + client

**What:** Single pure function computes `{percent, raw, expected, pace, paceDelta}` from `(goal, now, userTz)`. Imported by RSC render (authoritative) and client `useOptimistic` reducer (echo). Pure ⇒ trivially Vitest-testable.
**When:** Always — duplicating the rule in two places guarantees drift.
**Code (illustrative signature matching D-10):**

```typescript
// Source: CONTEXT.md D-10..D-14 + ARCHITECTURE.md §Progress Computation

import { TZDate } from '@date-fns/tz'
import { startOfMonth, endOfMonth, differenceInCalendarDays, getDaysInMonth } from 'date-fns'

export type Goal =
  | { id: string; type: 'count';     targetCount: number; currentCount: number; month: Date; /* ... */ }
  | { id: string; type: 'checklist'; tasks: { isDone: boolean }[];               month: Date; /* ... */ }
  | { id: string; type: 'habit';     targetDays: number;  checkIns: string[];    month: Date; /* ... */ }

export type Pace = 'on-pace' | 'behind' | 'ahead' | 'warming-up'

export interface ProgressSnapshot {
  percent: number                // 0..1
  raw: { done: number; total: number }
  expected: number               // 0..1, expected fraction at this point in the month
  pace: Pace
  paceDelta: number              // signed integer in raw units, e.g. -2 for "behind by 2"
}

export function computeProgress(goal: Goal, now: Date, userTz: string): ProgressSnapshot {
  const local = new TZDate(now.getTime(), userTz)
  const monthStart = startOfMonth(local)
  const daysElapsed = differenceInCalendarDays(local, monthStart) + 1
  const daysInMonth = getDaysInMonth(monthStart)
  const expected = daysElapsed / daysInMonth

  switch (goal.type) {
    case 'count': {
      const done = goal.currentCount
      const total = goal.targetCount
      const percent = total === 0 ? 0 : Math.min(1, done / total)
      // D-13 early-month guard
      if (daysElapsed < 5) return { percent, raw: { done, total }, expected, pace: 'warming-up', paceDelta: 0 }
      const paceDelta = Math.round((percent - expected) * total)
      return { percent, raw: { done, total }, expected, pace: paceFromDelta(paceDelta), paceDelta }
    }
    case 'checklist': {
      const done = goal.tasks.filter(t => t.isDone).length
      const total = goal.tasks.length
      const percent = total === 0 ? 0 : done / total
      // D-12: checklist has no time axis → always on-pace
      return { percent, raw: { done, total }, expected, pace: 'on-pace', paceDelta: 0 }
    }
    case 'habit': {
      const uniqueDays = new Set(goal.checkIns).size
      const done = uniqueDays
      const total = goal.targetDays
      const percent = total === 0 ? 0 : Math.min(1, done / total)
      if (daysElapsed < 5) return { percent, raw: { done, total }, expected, pace: 'warming-up', paceDelta: 0 }
      const paceDelta = Math.round((percent - expected) * total)
      return { percent, raw: { done, total }, expected, pace: paceFromDelta(paceDelta), paceDelta }
    }
  }
}

function paceFromDelta(delta: number): Pace {
  if (delta < -1) return 'behind'
  if (delta >  1) return 'ahead'
  return 'on-pace'
}
```

**Edge cases the Vitest suite must cover (analogous to Phase 1 `time.test.ts`):**
- Day 1, day 4 (still warming-up), day 5 (threshold crosses), mid-month, last day of month
- DST spring-forward day in `America/New_York` (Phase 1 pattern already proven)
- Leap year Feb 29
- `target_days > days_in_month` (e.g., user sets 35 for a 30-day month — clamp or allow? Recommendation: allow; percent caps at 1 via Math.min)
- Goal created mid-month: `currentCount=0, daysElapsed=15` → pace chip suppresses if < day 5 since creation? **OPEN QUESTION — see below.**
- Empty checklist (`total===0` → percent=0, pace='on-pace')
- Complete (`percent===1` → pace='on-pace' regardless of delta)

### Pattern 3: Motion-based progress bar that does NOT cause CLS

**What:** Fixed-size rail track as a plain `<div>`. Inner fill is a `<motion.div>` that animates `scaleX` (not `width`), with `transform-origin: left` and `will-change: transform`. Replaces the Radix Progress indicator entirely (D-23).
**When:** Always for this product. Animating `width` triggers layout on every re-render; `transform` animations live on the compositor and don't.
**Source:** [CITED: motion.dev/docs/vue-layout-animations] — "Layout animations are performed using the `transform` style to achieve smooth framerates." [CITED: motion.dev/docs/performance] — "To ensure hardware acceleration when animating transforms with Motion, combine all transform properties into a single 'transform' string." PITFALLS Performance Trap row: "Animating progress bars via `width` + re-render on every log → jank + CLS regression → use `transform: scaleX()` (or `translateX`) + `will-change: transform`; update with CSS transition, not JS per-frame."

**Canonical code:**

```typescript
// src/components/progress-bar.tsx
// Source: motion.dev/docs/react-motion-component + PITFALLS.md Performance Traps

'use client'

import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  percent: number          // 0..1
  expected?: number        // 0..1 for the pace tick (optional)
  className?: string
  ariaLabel: string        // e.g. "Read 5 books: 3 of 5 (60%)"
}

export function ProgressBar({ percent, expected, className, ariaLabel }: ProgressBarProps) {
  const reduce = useReducedMotion()
  const clamped = Math.max(0, Math.min(1, percent))

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={ariaLabel}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      {/* Fill — scaleX(0..1) from a left origin is visually identical to width, but lives on the compositor */}
      <motion.div
        className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-primary"
        style={{ willChange: 'transform' }}
        initial={false}                                           // D-23: never re-animate from 0 on mount
        animate={{ scaleX: clamped }}
        transition={
          reduce
            ? { duration: 0 }                                     // prefers-reduced-motion users get instant updates
            : { type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }
        }
      />
      {/* Expected-line tick (pace indicator) — rendered only when provided and outside warming-up */}
      {typeof expected === 'number' && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 h-full w-px bg-foreground/40"
          style={{ left: `${Math.max(0, Math.min(1, expected)) * 100}%` }}
        />
      )}
    </div>
  )
}
```

**Why `initial={false}`:** PITFALLS Performance Trap: "Progress-bar re-animates from 0 on every re-render → Visual flicker; feels 'twitchy' → Persist from-value in component state; animate only on real change." With `initial={false}`, Motion starts the next animation from the current DOM value, not from an initial prop.

**Why `useReducedMotion`:** Accessibility — users with `prefers-reduced-motion: reduce` should see updates instantly rather than animated. Motion's hook is the canonical way ([CITED: motion.dev/docs]).

**Why a `<div>` rail not shadcn Progress:** shadcn's Progress wraps Radix UI's Progress indicator, which sets `transform: translateX(-N%)`. Customizing that with a spring animation means overriding Radix's internal style, which is brittle and re-introduces CLS risk whenever Radix updates. A thin custom div with ARIA attributes is accessible, owns its layout, and matches shadcn Progress's semantic role 1:1.

### Pattern 4: `useOptimistic` with reducer hoisted to dashboard shell

**What:** Single `useOptimistic(goalsWithChildren, reducer)` lives in `DashboardShell` (one client component). All three mutation types dispatch discriminated actions into the same reducer. Each card reads its goal from the optimistic state. On undo, the shell emits a reverse action and fires the server's undo action.
**When:** Dashboard with many cards + cross-card undo toast. Per-card `useOptimistic` would fragment state and make "most-recent-only undo" hard to implement.
**Source:** [CITED: react.dev/reference/react/useOptimistic — "Implementing Optimistic Updates with a Reducer in React"] — the shopping-cart example uses exactly this shape. Server actions dispatch an optimistic action inside `startTransition`, then `await` the network call.

**Canonical shape (pseudocode — planner to flesh out):**

```typescript
// src/components/dashboard-shell.tsx
'use client'

import { useOptimistic, startTransition, useState } from 'react'
import { toast } from 'sonner'
import { GoalCard } from '@/components/goal-card'
import { incrementCountAction, toggleTaskAction, upsertHabitCheckInAction, undoLastMutationAction } from '@/server/actions/progress'

type Action =
  | { type: 'count:increment';  goalId: string; delta: number }
  | { type: 'checklist:toggle'; goalId: string; taskId: string; isDone: boolean }
  | { type: 'habit:toggle';     goalId: string; localDate: string; isChecked: boolean }

function reducer(current: Goal[], action: Action): Goal[] {
  // Exhaustive switch on action.type; TS discriminated union guarantees compile-time coverage.
  // For 'count:increment' → update goal.currentCount in place.
  // For 'checklist:toggle' → find task, flip isDone.
  // For 'habit:toggle' → add/remove localDate from checkIns Set.
}

export function DashboardShell({ initialGoals, userTz, now }: Props) {
  const [goals, dispatch] = useOptimistic(initialGoals, reducer)
  const [undoCtx, setUndoCtx] = useState<UndoHandle | null>(null)

  async function handleIncrement(goalId: string, delta: number) {
    const undoId = crypto.randomUUID()
    startTransition(async () => {
      dispatch({ type: 'count:increment', goalId, delta })
      const result = await incrementCountAction({ goalId, delta, undoId })
      if (!result.ok) {
        toast.error(result.error ?? 'Could not save — undo in place')
        // useOptimistic auto-rolls back when initialGoals revalidates without the delta
        return
      }
      toast('Logged +' + delta, {
        action: {
          label: 'Undo',
          onClick: () => {
            // D-32..D-34: 6s window, most-recent-only
            startTransition(async () => {
              dispatch({ type: 'count:increment', goalId, delta: -delta })
              await undoLastMutationAction({ undoId })
            })
          },
        },
        duration: 6000,
      })
    })
  }

  // Similar handleToggleTask, handleToggleHabit...

  return (
    <>
      {goals.map(g => <GoalCard key={g.id} goal={g} onAction={{/* ... */}} now={now} userTz={userTz} />)}
    </>
  )
}
```

**Critical nuances:**
- `startTransition` wraps BOTH the dispatch AND the server-action await — this is what the React 19 docs require ([CITED: react.dev/reference/react/useOptimistic]). Dispatching outside a transition throws.
- Server action must accept an `undoId` the client generates, so the undo action can reverse exactly that mutation. Without a shared handle, "undo the most recent" becomes ambiguous under concurrent requests.
- `useOptimistic` state comes from the server-rendered prop; after `revalidatePath`, the fresh prop replaces optimistic state. If the server action fails, the optimistic state naturally unwinds on the next server render.

### Pattern 5: Server Action shape (Zod parse → auth → service → revalidate)

Follows Phase 1 `src/server/actions/auth.ts` shape verbatim:

```typescript
// src/server/actions/progress.ts
'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { db } from '@/server/db'
import { incrementCountSchema, type IncrementCountInput } from '@/lib/schemas/goals'

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }

export async function incrementCountAction(
  input: IncrementCountInput,
): Promise<ActionResult> {
  const parsed = incrementCountSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Invalid input.' }

  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not authenticated.' }

  // Service layer: assert ownership + month-is-current, then:
  // db.transaction(async tx => {
  //   await tx.insert(progressEntries).values({ goalId, delta, loggedLocalDate: today(...) })
  //   await tx.update(goals).set({ currentCount: sql`current_count + ${delta}` }).where(...)
  // })

  revalidatePath('/dashboard')
  return { ok: true, data: undefined }
}
```

**Source:** [VERIFIED: `src/server/actions/auth.ts`] for the shape; [CITED: nextjs.org revalidatePath docs — "Use revalidatePath in a Server Action"].

### Pattern 6: Habit grid via `date-fns` `eachDayOfInterval`

**What:** Given the goal's month and the set of `check_in_date` strings, compute the 7×6 grid layout client-side from `date-fns`.
**Source:** [VERIFIED: date-fns Context7 — `eachDayOfInterval`, `startOfMonth`, `endOfMonth`, `getDay` exist]. Weekday header "S M T W T F S" (D-38) matches date-fns's `en-US` narrow day values verbatim.
**Canonical shape:**

```typescript
import { startOfMonth, endOfMonth, eachDayOfInterval, getDay, format, isSameDay } from 'date-fns'
import { TZDate } from '@date-fns/tz'

function buildGrid(month: Date, checkIns: Set<string>, now: Date, userTz: string) {
  const start = startOfMonth(month)
  const end = endOfMonth(month)
  const days = eachDayOfInterval({ start, end })

  const leadingBlanks = getDay(start)        // 0 = Sunday → matches Sun-first layout
  const todayLocal = format(new TZDate(now.getTime(), userTz), 'yyyy-MM-dd')

  return days.map(d => ({
    dateIso: format(d, 'yyyy-MM-dd'),
    isHit: checkIns.has(format(d, 'yyyy-MM-dd')),
    isToday: format(d, 'yyyy-MM-dd') === todayLocal,
    isFuture: format(d, 'yyyy-MM-dd') > todayLocal,
  }))
  // Caller prepends `leadingBlanks` empty cells + appends trailing blanks to fill 7 × 6.
}
```

### Anti-Patterns to Avoid

- **Storing `percent` in the database.** ARCHITECTURE.md Anti-Pattern 1. Compute on read.
- **JSONB `config` column on `goals`.** PITFALLS §3, Technical Debt row ("acceptable only as a short-term prototype").
- **Mega-single-goal-card with nested conditionals.** ARCHITECTURE.md §Structure Rationale — three physical files.
- **Client-side authority on progress count.** ARCHITECTURE.md Anti-Pattern 5: lost writes between tabs. Server is source of truth.
- **Colored bars for pace.** D-25 + PITFALLS §1: no red, no shame. Bar stays emerald; pace signal is a tick + chip beside.
- **Streak counter as hero metric.** PITFALLS §1, re-confirmed by FEATURES §Anti-Features. CONTEXT.md `<specifics>` calls this "unambiguous."
- **`motion.div animate={{ width }}` on the progress bar.** PITFALLS Performance Trap + Motion docs — triggers layout on every update.
- **Per-card `useOptimistic`.** Fragments state; breaks "most-recent-only undo" semantics (D-34).
- **`animate` from 0 on every re-render.** PITFALLS Performance Trap — use `initial={false}`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Optimistic UI state | Custom reducer + rollback on error | React 19 `useOptimistic` | Built-in, transaction-aware, rolls back on server error automatically |
| Discriminated-union validation | Hand-written `if (type === 'count') { ... }` ladder | `z.discriminatedUnion("type", [...])` | Exhaustiveness, per-type error paths, 10x faster parse than `z.union` |
| Toast stack + auto-dismiss | Custom portal + setTimeout | Sonner via shadcn | Accessibility, RTL, animation queue, keyboard ESC already solved |
| Month iteration for habit grid | Nested loop with `new Date(...)` incrementing | `date-fns` `eachDayOfInterval` + `getDay` | Timezone-safe, DST-safe, already a project dep |
| Modal dialog | Custom portal + focus trap | shadcn `Dialog` (Radix-based) | Focus trap, aria, ESC, body-scroll-lock solved |
| Confirmation dialog | Second `Dialog` reused for confirm | shadcn `AlertDialog` | Role="alertdialog" semantics + proper focus behavior |
| Kebab menu | Custom popover over the card | shadcn `DropdownMenu` (Radix) | Keyboard nav, roving tabindex, RTL |
| Checkbox | Custom `<input type=checkbox>` | shadcn `Checkbox` (Radix) | Indeterminate state, aria, touch target |
| Date picker for "log earlier day" | Custom calendar | shadcn `Popover` + simple month grid (same component as habit grid) | Reuse existing habit-grid-builder logic; no extra dep |
| Progress bar animation | CSS `transition: width` | Motion `scaleX` spring (Pattern 3) | CLS-safe, GPU-accelerated, works at 60fps on low-end devices |
| RLS policy for child tables | Store `user_id` redundantly on every child row | `EXISTS(SELECT 1 FROM goals WHERE id = goal_id AND user_id = auth.uid())` | D-08; avoids denormalization + drift when ownership changes |
| Pace math | Bespoke per-card computation | Pure `computeProgress` + Vitest fixtures (Pattern 2) | Single source of truth; testable; client optimistic matches server |
| Server → client data shape | Ad-hoc JSON | Drizzle's inferred `Goal` type + Zod schema sharing types | End-to-end type safety; refactor survives compilation |

**Key insight:** Almost every "hard part" in this phase already has a battle-tested primitive in the stack Phase 1 locked. The phase's risk is not in picking libraries, it's in (1) making the Motion-based bar CLS-safe, (2) keeping the discriminated union aligned across DB / Zod / TS / Reducer, and (3) atomic log-plus-cache transactions.

## Common Pitfalls

### Pitfall 1: Motion `animate={{ width }}` re-triggers layout (CLS regression)

**What goes wrong:** Builder implements the progress bar with `<motion.div animate={{ width: '60%' }} />`. The animation looks fine at 60fps on a desktop. On mobile + many cards, Lighthouse flags CLS > 0.1 because every `+1` reflows the row containing the bar.
**Why it happens:** `width` is a layout property; changing it cascades through layout → paint → composite. Browsers can't GPU-accelerate layout.
**How to avoid:** Pattern 3 above. Rail is a fixed-size `<div>`; fill animates `scaleX` with `transform-origin: left`; `will-change: transform`; `initial={false}` to avoid re-animation on re-render.
**Warning signs:** Lighthouse CLS > 0.1 on `/dashboard`; jank when multiple bars update in parallel; visible flicker on re-render.
**Verification:** Lighthouse CLS < 0.1 (Phase 4 POLSH-02 gate also requires this) + DevTools performance recording showing no layout thrash when `+1` is clicked.
**Source:** [CITED: motion.dev/docs/performance], PITFALLS.md Performance Traps row, STATE.md §Blockers research flag.

### Pitfall 2: Discriminated-union drift between layers

**What goes wrong:** DB has the CHECK. Zod has the discriminated union. TS types are manually maintained. One of them gets out of sync (usually TS — someone adds a `targetMinutes` column and forgets the Zod schema). Runtime validation passes, but the client crashes on a field that doesn't exist, or vice versa.
**Why it happens:** Three layers, three sources of truth, no compile-time connection.
**How to avoid:**
- The Zod schema is the single source of truth for runtime shape: `type Goal = z.infer<typeof goalSchema>`.
- Export discriminator literal constants once: `export const GOAL_TYPES = ['count', 'checklist', 'habit'] as const` — import into Drizzle enum + Zod schema.
- The DB CHECK is written to mirror the Zod schema's discriminator by name, not by invented shape.
- Add a Vitest test that `GOAL_TYPES` matches `goalTypeEnum.enumValues` (Drizzle exports this).

**Warning signs:** Lint error "property 'X' does not exist on type 'Y'" after a schema change; Zod "invalid_union_discriminator" errors from Server Actions; DB CHECK violation on insert where client shows no error.
**Verification:** Wave 0 — add a contract test: `expect(goalTypeEnum.enumValues).toEqual(GOAL_TYPES)`.

### Pitfall 3: Log-write + cache-update not atomic

**What goes wrong:** `+1` writes `progress_entries` row (INSERT succeeds), then the `UPDATE goals SET current_count = current_count + 1` fails (lost connection). The log says "logged +1" but the cache says "still 0." Undo has no safe reversal path.
**Why it happens:** Two writes without `BEGIN...COMMIT`.
**How to avoid:** Always wrap in `db.transaction(async tx => { await tx.insert(progressEntries)...; await tx.update(goals)... })`. Drizzle's postgres.js driver supports this natively.
**Warning signs:** Sporadic "percent shown on dashboard doesn't match my log history" reports; undo fails or produces negative `current_count`.
**Verification:** Integration test: kill the connection between INSERT and UPDATE; assert post-recovery state has neither write (transaction rolled back).

### Pitfall 4: DST + goal-created-mid-month edge cases in pace math

**What goes wrong:** User creates a habit goal on April 15; the default pace math says "you're 15/30 expected," immediately showing "behind by 15." Demotivating on day 1 of goal.
**Why it happens:** `expected = days_elapsed / days_in_month` is global-to-the-month, not per-goal.
**How to avoid:** **OPEN QUESTION** — the D-13 early-month guard handles days 1-4 of the month, but not "goal created on day 15." Two options:
1. Pace uses `days_since_goal_creation` / `days_remaining_in_month_at_creation` (scoped per-goal) — but this fights the mental model "did I hit it this month?"
2. Pace uses global days elapsed, but suppresses pace chip for the first 5 days after *goal creation* — `warming-up` extended.
Recommendation: **Option 2.** Rationale: the psychological effect (PITFALLS §5 — "slow progress demotivates") is specifically an early-experience problem; scoping to goal creation time matches user intuition. Needs user confirmation (mark as ASSUMED).
**Warning signs:** Users complain that brand-new goals "already show I'm behind." Pace chip shows "behind by 15" on a day-old goal.
**Verification:** Vitest fixture: `computeProgress({ createdAt: 'April 15', ...count_zero }, now='April 16')` returns `pace: 'warming-up'`.

### Pitfall 5: "Today" computed from server's UTC clock instead of user's TZ

**What goes wrong:** Habit mark-today inserts `check_in_date = date(now_utc)` into `habit_check_ins`. User at 11:30pm local (UTC+13) sees yesterday highlighted, not today.
**Why it happens:** Raw `new Date()` on the server is UTC. Phase 1 solved this for `today()` and `monthBucket()` — but it's easy to forget in new code.
**How to avoid:** Every server action that writes a date MUST derive the local date via `today(new Date(), user.timezone)`. The user's tz is on `public.users.timezone` (Phase 1 D-13 / `src/server/db/schema.ts`). Look it up once per action, pass into service.
**Warning signs:** Habit grid shows "today" hit but the cell is yesterday's column. `logged_local_date` in progress_entries doesn't match what the user saw.
**Verification:** Integration test with `supabase` user at `timezone='Pacific/Auckland'`, freeze `Date.now()` to a UTC moment that is a different local day, assert the insert lands on the Auckland-local date. Phase 1's `time.test.ts` already has fixtures — extend for this.

### Pitfall 6: Sonner not hoisted → toasts fire silently

**What goes wrong:** Builder renders `<Toaster />` inside `DashboardShell`. Works on `/dashboard` but not on any future page, and sometimes loses toasts across re-renders.
**Why it happens:** `<Toaster />` is a portal — it must be mounted once in the root layout so it survives navigation.
**How to avoid:** Mount `<Toaster />` exactly once in `src/app/layout.tsx` (alongside `<body>`). All `toast(...)` calls anywhere in the tree enqueue into it.
**Warning signs:** Toasts disappear when navigating away from `/dashboard`; multiple Toasters flash simultaneously.
**Verification:** Grep for `<Toaster` — must appear exactly once, in `layout.tsx`.
**Source:** [CITED: sonner docs, GitHub emilkowalski/sonner README].

### Pitfall 7: `useOptimistic` dispatch outside `startTransition`

**What goes wrong:** React throws "optimistic state updates must be inside a transition" or the UI never updates.
**Why it happens:** React 19 requires optimistic dispatches in a transition for the reconciliation contract.
**How to avoid:** Every handler follows the shape `startTransition(async () => { dispatch(...); await serverAction(...); })`. Do NOT call `dispatch` outside the transition.
**Warning signs:** Console warning about transitions; dispatch appears to do nothing.
**Source:** [VERIFIED: Context7 /reactjs/react.dev `useOptimistic` docs — every example wraps dispatch in `startTransition`].

### Pitfall 8: RLS policy on child tables using `user_id` column that doesn't exist

**What goes wrong:** Author copies the `goals-select-own` policy for `tasks`, but `tasks` has no `user_id` column. Either migration fails, or policy silently never matches (500 error on every read).
**Why it happens:** Following the parent policy pattern instead of the child pattern.
**How to avoid:** D-08 explicitly prescribes the JOIN-via-goal_id shape: `using: sql\`EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())\``.
**Warning signs:** Dashboard query returns empty tasks/check-ins even though rows exist; migration verification script reports policy exists but user can't read their own rows.
**Verification:** Extend Phase 1's `tests/rls.test.ts` with seeded tasks + habit_check_ins, assert User A cannot read User B's rows but can read their own.

### Pitfall 9: Goal create lands in wrong month on timezone boundaries

**What goes wrong:** User creates a goal at 11:45pm local on March 31. The DB receives `INSERT ... month = '2026-04-01'` because `new Date()` on the server is already UTC April.
**Why it happens:** `monthBucket(new Date(), user.timezone)` must be called on the server with the user's timezone; calling it on the client with `Intl.DateTimeFormat().resolvedOptions().timeZone` is fine for *display*, but the write must go through server-side resolution for authority.
**How to avoid:** Every `createGoalAction` resolves month as `monthBucket(new Date(), user.timezone)` server-side. Never trust client-supplied month.
**Warning signs:** Goal appears in next month's view but "should be" in current. Progress logs span two months.
**Verification:** Existing `tests/time.test.ts` Phase 1 fixtures cover the `monthBucket` pure function — extend with a createGoalAction integration test.

### Pitfall 10: CSS tokens collide with Tailwind v4 core spacing

**What goes wrong:** Builder adds `--spacing-pace-gap: 0.25rem` to `@theme` for the pace chip layout. Tailwind v4 core tokens like `--spacing-2` stop working correctly because the builder's token shadows them in unexpected scopes.
**Why it happens:** STATE.md Plan 01-05 lesson: Tailwind v4 `@theme` `--spacing-*` names are reserved — they power `p-2`, `gap-4`, etc. Overriding any of them breaks the utility system.
**How to avoid:** New tokens use `--color-warning-*`, `--color-success-*` for pace-chip colors. Never add `--spacing-*` or `--radius-*` custom names inside `@theme` — use arbitrary values (`gap-[0.25rem]`) where a one-off is needed.
**Warning signs:** `p-2` or `gap-4` suddenly looks different after a `globals.css` edit; Tailwind CLS tests fail.
**Verification:** Grep `src/app/globals.css` for `--spacing-` or `--radius-` — must be zero new entries in Phase 2.

## Runtime State Inventory

This section is **N/A** for Phase 2 — nothing is being renamed, rebranded, or migrated. Phase 2 is pure additive implementation (new tables, new code). No grep audits on existing DB contents, no renamed keys, no OS-level registrations.

- **Stored data:** None — new tables `tasks`, `habit_check_ins`, `progress_entries` will be created empty.
- **Live service config:** None — no external service integration.
- **OS-registered state:** None — no Task Scheduler, no launchd, no pm2.
- **Secrets and env vars:** None new — reuses Phase 1's `NEXT_PUBLIC_SUPABASE_*` and `DATABASE_URL`.
- **Build artifacts:** None — Next.js + drizzle-kit auto-regenerate.

## Code Examples

### Creating a goal with Zod discriminated-union re-validation

```typescript
// src/lib/schemas/goals.ts
// Source: CONTEXT.md D-20 + Zod 4 Context7 docs (colinhacks/zod + websites/zod_dev)

import { z } from 'zod'

export const GOAL_TYPES = ['count', 'checklist', 'habit'] as const

export const baseGoalFields = {
  title: z.string().min(1, 'Give your goal a name').max(120),
  notes: z.string().max(500).optional(),
}

export const createCountGoalSchema = z.object({
  type: z.literal('count'),
  ...baseGoalFields,
  targetCount: z.number().int().positive('Target must be > 0'),
})

export const createChecklistGoalSchema = z.object({
  type: z.literal('checklist'),
  ...baseGoalFields,
  tasks: z.array(z.object({ label: z.string().min(1).max(120) })).min(1, 'Add at least one task'),
})

export const createHabitGoalSchema = z.object({
  type: z.literal('habit'),
  ...baseGoalFields,
  targetDays: z.number().int().min(1).max(31),
})

export const createGoalSchema = z.discriminatedUnion('type', [
  createCountGoalSchema,
  createChecklistGoalSchema,
  createHabitGoalSchema,
])

export type CreateGoalInput = z.infer<typeof createGoalSchema>
```

[Source: Context7 `/colinhacks/zod` — "Create Discriminated Union with z.discriminatedUnion()"]

### Atomic increment + log

```typescript
// src/server/actions/progress.ts
import { db } from '@/server/db'
import { goals, progressEntries } from '@/server/db/schema'
import { eq, sql } from 'drizzle-orm'

async function incrementCountTx(goalId: string, delta: number, localDate: string) {
  await db.transaction(async tx => {
    await tx.insert(progressEntries).values({ goalId, delta, loggedLocalDate: localDate })
    await tx.update(goals)
      .set({ currentCount: sql`${goals.currentCount} + ${delta}`, updatedAt: sql`now()` })
      .where(eq(goals.id, goalId))
  })
}
```

[Source: Context7 `/drizzle-team/drizzle-orm-docs` — DML patterns + `db.transaction` shape]

### Dashboard RSC query (30-line SQL budget)

```typescript
// src/server/db/queries.ts
// Budget: < 30 lines of SQL (PITFALLS §3 acceptance test)

import { db } from './index'
import { goals, tasks, habitCheckIns } from './schema'
import { eq, and } from 'drizzle-orm'

export async function getMonthDashboard(userId: string, month: Date) {
  // One read per collection, JOINed client-side in TS.
  // Alternative: single query with JSON aggregate subqueries — kept simple here; 3 reads << 30 lines total.
  const g = await db.select().from(goals).where(and(eq(goals.userId, userId), eq(goals.month, month)))
  const goalIds = g.map(row => row.id)
  if (goalIds.length === 0) return []

  const [t, h] = await Promise.all([
    db.select().from(tasks).where(inArray(tasks.goalId, goalIds)),
    db.select().from(habitCheckIns).where(inArray(habitCheckIns.goalId, goalIds)),
  ])

  // Assemble the discriminated-union shape expected by computeProgress + the UI
  return g.map(row => assembleGoal(row, t, h))
}
```

[Source: Context7 `/drizzle-team/drizzle-orm-docs` — select + where + inArray patterns]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `framer-motion` | `motion/react` (same API) | Mid-2025 rename | Import path change only; no behavior difference — CLAUDE.md forbids `framer-motion` |
| `transition: width` for bars | Motion `scaleX` + `transform-origin: left` | Always — web animations best practice since 2018, re-affirmed in Motion 12 | CLS-safe; GPU path |
| Per-card `useState` for optimistic values | React 19 `useOptimistic(state, reducer)` | React 19 (Dec 2024) | Automatic rollback; no manual try/catch/revert wiring |
| Pages Router + `getServerSideProps` | App Router RSC + Server Actions | Next 13 (2023), stable default in Next 16 | Auth gating via `supabase.auth.getUser()` server-side; no API route boilerplate |
| Radix Progress wrapped in shadcn | Custom `<div>` rail + `<motion.div>` fill | D-23 this phase | Full control of animation; no Radix style override fragility |
| JSONB `config` column in `goals` | Typed child tables + nullable scalar columns | Schema lock (Phase 1 research) | Dashboard query < 30 lines; type-safe queries; PITFALLS §3 compliant |
| `crypto.randomUUID()` for undo ids on the server | Same — client generates id, server echoes it back | — | Idempotency — server can de-dupe if undo fires twice |

**Deprecated / outdated for this phase:**
- `@supabase/auth-helpers-nextjs` (gone — Phase 1 uses `@supabase/ssr`, still correct)
- Using `new Date()` for "today" without a tz — Phase 1 wrote `today()`/`monthBucket()` to fix this; Phase 2 must not reintroduce the pattern.
- Adding `tailwind.config.js` — Tailwind v4 uses CSS-first `@theme`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Early-month guard should extend for the first 5 days *after goal creation*, not just first 5 days of the month | Pitfall 4 / Pattern 2 `computeProgress` | If actual behavior should be month-global, goals created mid-month will show "behind" from day 1 (PITFALLS §5 regression). Recommendation: defer to user / discuss-phase before implementing. |
| A2 | Sonner 2.0.7 is API-compatible with shadcn 4.3.0's Sonner wrapper | Standard Stack, Pattern 4 | If shadcn's wrapper lags behind, `action` + `duration` props may behave differently. Easily caught by smoke test. |
| A3 | Motion 12.38's `scaleX` animation with `useReducedMotion` satisfies Lighthouse CLS < 0.1 at the dashboard's expected goal count (~5-20) | Pattern 3 / Pitfall 1 | If measurement surprises us, the fix is `will-change: transform` tuning or switching to `translateX` (mathematically equivalent). |
| A4 | Single JOIN-style RLS policy on child tables (EXISTS-subquery) performs adequately at Phase 1/2 scale | Pattern 1 / Pitfall 8 | At 100k+ rows it might need `CREATE INDEX ON tasks(goal_id)` — but D-01 doesn't mention the index. Recommendation: planner adds `goal_id` indexes on children (matches ARCHITECTURE.md §Concrete Schema). |
| A5 | `date-fns` `getDay(startOfMonth)` returns Sunday-first weekday indices (0=Sun..6=Sat) — grid layout D-38 assumes this | Pattern 6 | [VERIFIED via date-fns docs Context7 lookup — `getDay` returns 0..6 with 0 = Sunday]. No risk — confirmed. |
| A6 | `goals.current_count` as INT with no upper bound is fine; spec says `target_count > 0` but doesn't cap it | Schema D-06 | If a user sets `target_count = 1_000_000_000`, dashboard still works because we use `Math.min(1, done/total)`. Low risk. |
| A7 | "Most-recent-only undo" (D-34) is per-user global, not per-goal | Pattern 4 | CONTEXT.md text reads "per goal at any time" — so actually **per-goal**, not global. Flagged so planner aligns; changes the undoCtx shape. |
| A8 | `public.users.timezone` is guaranteed non-null at goal-creation time (Phase 1 default 'UTC') | Pitfalls 5 + 9 | [VERIFIED — `schema.ts` has `.notNull().default("UTC")`]. No risk. |

**If the planner confirms A1 and A7 during plan creation, most of this uncertainty collapses.** The rest are low-risk engineering assumptions that will self-surface in review.

## Open Questions

1. **Pace early-month guard: month-global vs per-goal?** (see A1)
   - What we know: CONTEXT.md D-13 says "when `days_elapsed < 5`" — ambiguous between month-elapsed and since-creation.
   - What's unclear: Behavior for goals created mid-month.
   - Recommendation: Planner asks in Wave 0 Vitest fixture design; default to per-goal unless user confirms otherwise.

2. **Undo scope: per-goal or global?** (see A7)
   - What we know: D-34 says "per goal at any time."
   - What's unclear: If a user does count+1 on Goal A, then task-toggle on Goal B, does the toast for A still offer undo?
   - Recommendation: Per-goal — replace only when the same goal gets a new mutation. This matches the plain reading of D-34.

3. **Goal notes field.** GOAL-01 mentions "optional notes"; CONTEXT.md `<decisions>` never explicitly adds a `notes` column to `goals`.
   - Recommendation: Add `notes TEXT NULL` (<=500 chars Zod-enforced) to the Drizzle schema in the new migration. Low risk.

4. **`goals.position` denomination.** Phase 1 schema has `position: text("position").notNull().default("0")` — a TEXT default of "0" is unusual. Is this a Phase 1 quirk or intentional?
   - Recommendation: Planner to check the Phase 1 context for rationale. If it's a bug, Phase 2 is the right time to migrate to INT (Drizzle migration via drizzle-kit picks it up). Defensive note — don't silently convert; ask.

5. **Count-goal edit: what if user lowers `target_count` below `current_count`?**
   - What we know: Deferred ideas mentions this as "planner's judgment call."
   - What's unclear: Does the bar snap to 100% (showing over-achievement), stay visually same, or clamp?
   - Recommendation: Clamp percent via `Math.min(1, done/total)` (already in `computeProgress`). Raw display reads "8 of 5" (over-achieved). Users who complain surfaces edge case.

6. **"Log for earlier day" past-day UX: can a user log on the same day twice (once via `+1`, once via backfill)?**
   - What we know: `progress_entries` allows multiple rows per `(goal_id, date)`.
   - Recommendation: Yes — the log is additive. `(goal_id, logged_local_date)` is NOT a unique key. This matches D-05 ("signed delta supports undo + corrections").

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build + runtime | [VERIFIED via Phase 1 completion] | 20+ LTS required by Next 16 | — |
| Supabase CLI | `supabase db push --linked` in Plan XX migration task | [VERIFIED: Phase 1 uses this pattern] | Phase 1 confirmed operational | psql direct-URL run as fallback |
| Supabase Cloud project (dev) | RLS tests, `auth.users` FK | [VERIFIED: Phase 1 Plan 01-03 confirms project exists] | — | — |
| `postgres` npm driver | Drizzle + inline `node -e` verification | [VERIFIED: already in `package.json` and used by Phase 1 verification scripts] | 3.4.9 | — |
| Docker (for local Supabase) | Local dev parity | [UNKNOWN] | — | Dev against cloud project (Phase 1 pattern) |
| psql | Migration backup / manual queries | [UNKNOWN — Phase 1 STATE says "psql not available locally"] | — | Inline `node -e + postgres.js` — PROVEN in Phase 1 |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** psql — use the Phase 1 inline node pattern for any ad-hoc queries in plans.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `/Users/rathtana.duong/gsd-tutorial/vitest.config.ts` (already present — `@/` alias to `./src`, `tests/**/*.test.ts` include pattern) |
| Quick run command | `npx vitest run tests/<file>.test.ts` |
| Full suite command | `npx vitest run` |
| Coverage command | `npx vitest run --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| GOAL-01 | Zod discriminated union accepts all three types + rejects type/field mismatch | unit | `npx vitest run tests/schemas.goals.test.ts` | ❌ Wave 0 |
| GOAL-01 | `createGoalAction` re-validates + writes to DB + respects polymorphic CHECK | integration | `npx vitest run tests/actions.goals.test.ts` | ❌ Wave 0 |
| GOAL-02 | `updateGoalAction` rejects `type` change | unit | part of `tests/schemas.goals.test.ts` | ❌ Wave 0 |
| GOAL-03 | Delete cascades to tasks + habit_check_ins + progress_entries | integration | part of `tests/actions.goals.test.ts` | ❌ Wave 0 |
| PROG-01 | `incrementCountAction` performs atomic INSERT+UPDATE | integration | `tests/actions.progress.test.ts` | ❌ Wave 0 |
| PROG-01 | `useOptimistic` + server round-trip reconciles count correctly | integration (RTL) | — | Manual UAT (Phase 4 hardening) |
| PROG-02 | `toggleTaskAction` flips `is_done` + sets `done_at` | integration | part of `tests/actions.progress.test.ts` | ❌ Wave 0 |
| PROG-03 | `upsertHabitCheckInAction` writes to user-local date, not UTC | integration | part of `tests/actions.progress.test.ts` (tz fixtures) | ❌ Wave 0 |
| PROG-04 | Habit backfill accepts past dates in current month, rejects future dates | unit (service) | part of `tests/services.progress.test.ts` | ❌ Wave 0 |
| PROG-04 | Count backfill accepts past dates in current month, rejects future dates | unit (service) | part of `tests/services.progress.test.ts` | ❌ Wave 0 |
| PROG-05 | `undoLastMutationAction` reverses count / checklist / habit correctly | integration | part of `tests/actions.progress.test.ts` | ❌ Wave 0 |
| DASH-01 | `getMonthDashboard` returns assembled goals with children in one shape | integration | `tests/queries.dashboard.test.ts` | ❌ Wave 0 |
| DASH-02 | `computeProgress` returns correct percent for each goal type | unit (pure) | `tests/progress.test.ts` | ❌ Wave 0 |
| DASH-02 (pace) | `computeProgress` returns correct pace + paceDelta + warming-up cutoff | unit (pure) | part of `tests/progress.test.ts` | ❌ Wave 0 |
| POLSH-03 | Habit grid `buildGrid` produces 7×N layout with correct leading blanks | unit (pure) | `tests/habit-grid.test.ts` | ❌ Wave 0 |
| RLS on `tasks`, `habit_check_ins`, `progress_entries` | User A can't read User B's child rows | integration | extend `tests/rls.test.ts` | ✅ extend |
| Polymorphic CHECK | DB rejects `type='count' AND target_count IS NULL` | integration | `tests/migrations.schema.test.ts` | ❌ Wave 0 |
| Motion bar CLS | Lighthouse CLS < 0.1 on `/dashboard` | manual (Phase 4) | `npx @lhci/cli autorun` | Phase 4 |
| Optimistic rollback on server error | UI reverts after failed action | manual UAT | — | Human UAT |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/<file-touched>.test.ts` — fast feedback on the one file being changed
- **Per wave merge:** `npx vitest run` — full Vitest suite green before wave advance
- **Phase gate:** Full suite green + manual UAT on optimistic rollback + Lighthouse CLS spot-check before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/schemas.goals.test.ts` — Zod discriminated-union coverage
- [ ] `tests/progress.test.ts` — `computeProgress` pure fixture suite (extends Phase 1 `time.test.ts` DST/leap/boundary patterns)
- [ ] `tests/habit-grid.test.ts` — `buildGrid` layout pure test
- [ ] `tests/services.progress.test.ts` — month-boundary, backfill-date-range, ownership assertions
- [ ] `tests/actions.goals.test.ts` — CRUD end-to-end with Supabase test harness (mirrors Phase 1 `actions.auth.test.ts` shape)
- [ ] `tests/actions.progress.test.ts` — all five mutation actions + undo
- [ ] `tests/queries.dashboard.test.ts` — `getMonthDashboard` single-query shape assertion
- [ ] `tests/migrations.schema.test.ts` — polymorphic CHECK + constraint verification (mirrors Phase 1 verify script)
- [ ] Extend `tests/rls.test.ts` — tasks, habit_check_ins, progress_entries policies

*(No test-framework install gap — Vitest is already installed and configured from Phase 1.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | Handled in Phase 1 | `@supabase/ssr` middleware; `getUser()` every request |
| V3 Session Management | Handled in Phase 1 | Supabase session cookies Secure + HttpOnly + SameSite=Lax |
| V4 Access Control | **yes** | Server Actions call `getUser()` → userId; service layer asserts ownership; RLS policies on every new table as defense-in-depth (D-08) |
| V5 Input Validation | **yes** | Zod `createGoalSchema` discriminated union; Zod at every Server Action boundary (D-20); DB CHECK constraints as last line |
| V6 Cryptography | no | No cryptographic operations in this phase — reuses Supabase's password hashing + session signing |
| V7 Error Handling | yes | Server Actions return `{ok: false, error}` shapes; never leak stack traces; generic error copy per Phase 1 UI-SPEC |
| V8 Data Protection | yes | PII is limited to `auth.users.email` (owned by Supabase) + user-authored titles/notes; RLS prevents cross-user leakage |
| V10 Malicious Code | no | Not applicable to phase scope |
| V13 API | yes | Server Action inputs re-validated; cross-tenant access prevented by service-layer ownership check + RLS |

### Known Threat Patterns for Next.js + Supabase + Drizzle

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Crafted `goalId` in Server Action targets another user's goal | Tampering + EoP | Service layer asserts `goal.user_id === auth.uid()`; RLS backs up via policy; CHECK on insert via `withCheck` |
| Client sends `type='count'` for a habit goal in update | Tampering | `type` readonly in updateGoalAction (D-18); Zod schema + DB CHECK both reject |
| Optimistic UI race: two tabs both increment, cache drifts | Lost write | Atomic `db.transaction`; cache is `sql\`current_count + ${delta}\`` not client-computed |
| Mass assignment: client sends `current_count: 999` on goal create | Tampering | Zod schema omits `current_count`; server sets it to 0 on insert |
| Timezone spoofing: client sends `'Etc/GMT+12'` to land a log in a different month | Tampering | Server uses `public.users.timezone` (Phase 1 stored value), never a client-supplied tz (PITFALLS Security row) |
| SQL injection via `title` / `notes` | Tampering | Drizzle parameterizes all binds; never use `sql.raw` with user input |
| Log flooding (user creates 1M progress_entries) | DoS | Not a Phase 2 concern — rate-limiting deferred; note for Phase 4 |
| Leaking progress data to an unauthenticated user | Info disclosure | Middleware gates `/dashboard`; RSC server client calls `getUser()` with redirect-to-login on null |
| Cross-tenant habit-grid backfill (mark User B's goal via crafted `goalId`) | Tampering + EoP | Same as "Crafted goalId" — service asserts ownership; RLS policy `using: EXISTS(...)` backs up |
| Replayed undo after session expiry | EoP | Server Action calls `getUser()` — expired sessions return `{ok:false, error:'Not authenticated.'}` |

## Sources

### Primary (HIGH confidence)

- **Context7 `/reactjs/react.dev`** (fetched `useOptimistic server action formData` and `useOptimistic reducer array add remove`) — canonical `useOptimistic` + reducer patterns; confirms `startTransition` wrapping requirement
- **Context7 `/websites/motion_dev`** (fetched `animate width progress bar spring layout` and `layout animation width height scale correction`) — confirms Motion "performs layout animations using transform style" and scaleX + transform-origin pattern
- **Context7 `/drizzle-team/drizzle-orm-docs`** (fetched `rls crudPolicy supabase authenticated role` and `crudPolicy helper insert update delete`) — confirms `authenticatedRole`, `pgPolicy`, `crudPolicy` API shapes; JOIN-via-FK policy pattern
- **Context7 `/colinhacks/zod`** (fetched `discriminatedUnion infer v4`) — confirms `z.discriminatedUnion("type", [...])` API, error reporting semantics
- **Context7 `/shadcn-ui/ui`** (fetched `progress dialog alert-dialog dropdown-menu sonner checkbox popover install`) — install commands + component availability in shadcn 3.5+/4.x
- **Context7 `/vercel/next.js`** (fetched `server action revalidatePath revalidateTag App Router 16`) — Server Action + `revalidatePath` patterns for Next 16
- **Context7 `/date-fns/date-fns`** (fetched `eachDayOfInterval startOfMonth endOfMonth getDay weekday`) — confirms functions + weekday indexing
- **`npm view` (verified live):** motion 12.38.0, next 16.2.4, react 19.2.5, drizzle-orm 0.45.2, @supabase/ssr 0.10.2, zod 4.3.6, date-fns 4.1.0, sonner 2.0.7, shadcn 4.3.0
- **Phase 1 shipped code** — `src/lib/time.ts`, `src/server/db/schema.ts`, `src/server/actions/auth.ts`, `src/middleware.ts`, `src/app/globals.css`, `tests/time.test.ts`, `supabase/migrations/0001_custom_constraints.sql`
- **Phase 1 context** — `.planning/phases/01-foundations-auth/01-CONTEXT.md`
- **`.planning/research/ARCHITECTURE.md`** — Pattern 1 (polymorphic parent + typed children), Pattern 3 (server-auth + optimistic), Concrete Schema, Anti-Patterns, Suggested Build Order
- **`.planning/research/PITFALLS.md`** — §1 streak anxiety, §2 timezone/DST, §3 schema, §4 rollover UX, §5 demotivating dashboard; Performance Traps row on progress-bar width animations
- **`.planning/research/FEATURES.md`** (referenced by CONTEXT.md canonical_refs) — anti-features lock (no streak counter, no color-shift for pace)
- **CLAUDE.md** — locked stack, "What NOT to Use" constraints

### Secondary (MEDIUM confidence)

- WebSearch on "Motion React animate width vs transform scaleX progress bar CLS" — corroborated Motion's transform-first approach from multiple non-official sources
- WebSearch on "useOptimistic React 19 toast undo pattern sonner Next.js server action" — corroborated the "dispatch inside startTransition + toast handle for undo" pattern from dev.to + Robin Wieruch posts

### Tertiary (flag for validation)

- Exact Motion spring tuning values (`stiffness: 140, damping: 22, mass: 0.6`) — informed by typical Motion examples; may need tuning per visual taste. Planner should prototype values in the progress-bar task and confirm CLS stays < 0.1.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry on 2026-04-18
- Architecture: HIGH — patterns are lock-in from CONTEXT.md D-01..D-40 + Phase 1 proven practice
- Motion/CLS pattern: HIGH — Motion docs explicitly confirm `transform` is the right answer; `scaleX` + `transform-origin: left` is a web-animations-performance canon
- useOptimistic reducer pattern: HIGH — React 19 official docs provide the exact shape
- Discriminated union end-to-end: MEDIUM-HIGH — design is sound but A1 (per-goal vs month-global pace guard) and A7 (undo scope) need user confirmation before code lands
- Pitfalls: HIGH — drawn from shipped Phase 1 lessons + research corpus
- Security domain: HIGH — mitigation list is standard Next+Supabase+Drizzle; nothing novel

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (30 days — stack is stable; Zod 4 minor bumps and Next 16 patch releases could introduce new patterns, so refresh if this research sits > 30 days unused)
