# Architecture Research

**Domain:** Monthly commitment / goal tracker web app (single-user dashboard with mixed goal types)
**Researched:** 2026-04-17
**Confidence:** HIGH for component boundaries and data flow; MEDIUM-HIGH for schema proposal (two viable shapes presented — final choice is a judgement call but recommendation is concrete)

---

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                          BROWSER (Client)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  Dashboard   │  │  Month Nav   │  │  Goal Card (3 variants)  │ │
│  │  (current)   │  │  (past/fut)  │  │  count | tasks | habit   │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬──────────────┘ │
│         │ React Server Components + useOptimistic│                │
└─────────┼─────────────────┼─────────────────────┼─────────────────┘
          │                 │                     │ (Server Actions /
          ▼                 ▼                     ▼  RSC data fetches)
┌────────────────────────────────────────────────────────────────────┐
│                      APP SERVER (Next.js)                          │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Route Handlers / Server Actions (thin I/O layer)            │ │
│  └──────────────────────────┬───────────────────────────────────┘ │
│  ┌──────────────────────────▼───────────────────────────────────┐ │
│  │  Auth Middleware        │  Domain Services (goals, progress) │ │
│  │  (session → userId)     │  - createGoal / logProgress        │ │
│  │                         │  - computeProgress(goal)           │ │
│  │                         │  - getMonthDashboard(userId, YM)   │ │
│  └──────────────────────────┬───────────────────────────────────┘ │
│  ┌──────────────────────────▼───────────────────────────────────┐ │
│  │  Data Access Layer (typed queries → Postgres)                │ │
│  └──────────────────────────┬───────────────────────────────────┘ │
└─────────────────────────────┼──────────────────────────────────────┘
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                         POSTGRES (DB)                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  users   │  │  goals   │  │  tasks   │  │  habit_check_ins │   │
│  │          │  │ (polymo- │  │ (per-    │  │ (per-day rows)   │   │
│  │          │  │  rphic)  │  │  goal)   │  │                  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
│                              CHECK constraints enforce invariants  │
└────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Dashboard UI** | Render current-month goals with progress bars; route input events | React Server Component shell + Client Component progress bars |
| **Goal Card (3 variants)** | Render a goal in the shape appropriate to its `type` (count / tasks / habit) | Discriminated-union TS type; variant picker component |
| **Month Navigator** | Switch between months; enforces "past = read-only" at UI level | Client Component, reads month from URL (`/dashboard/2026-04`) |
| **Server Actions** | Typed server entrypoints for mutations (create goal, log progress, check task) | Next.js `'use server'` functions; call Domain Services |
| **Auth layer** | Session → `userId`; gate every query and mutation | Auth.js / Lucia / Clerk session middleware |
| **Domain Services** | Business logic: validate month ownership, compute `% complete`, enforce read-only | Plain TS functions; pure where possible, DB-aware where needed |
| **Data Access Layer** | SQL/ORM queries, transactions | Drizzle / Prisma / Kysely |
| **Postgres** | Durable store, enforces cross-row invariants via constraints | Managed Postgres (Neon / Supabase / RDS) |

---

## Recommended Project Structure

```
src/
├── app/                             # Next.js App Router
│   ├── (auth)/                      # login, signup
│   ├── dashboard/
│   │   ├── [month]/page.tsx         # /dashboard/2026-04
│   │   └── page.tsx                 # current month redirect
│   └── api/                         # Only if external clients needed
├── components/
│   ├── goal-card/
│   │   ├── count-card.tsx
│   │   ├── tasks-card.tsx
│   │   ├── habit-card.tsx
│   │   └── index.tsx                # Variant picker
│   ├── progress-bar.tsx             # Pure presentational
│   └── month-navigator.tsx
├── server/
│   ├── actions/                     # 'use server' entrypoints
│   │   ├── goals.ts                 # createGoal, deleteGoal
│   │   └── progress.ts              # increment, toggleTask, checkInHabit
│   ├── services/                    # Business logic
│   │   ├── goals.ts
│   │   ├── progress.ts              # computeProgress(goal) — single source of truth
│   │   └── month.ts                 # currentMonth(), isReadOnly(month)
│   └── db/
│       ├── schema.ts                # Drizzle/Prisma schema
│       ├── queries.ts               # Typed queries (getMonthDashboard, etc.)
│       └── migrations/
├── lib/
│   ├── month.ts                     # Month utilities (to/from YYYY-MM, firstOfMonth)
│   ├── progress.ts                  # Pure % calculation (shared client+server)
│   └── types.ts                     # Discriminated union Goal type
└── auth/                            # Auth.js or Lucia config
```

### Structure Rationale

- **`app/dashboard/[month]/`:** Month is a URL parameter, so back/forward browsing and deep links work naturally. Server component fetches month's goals at the route level.
- **`components/goal-card/{count,tasks,habit}.tsx`:** Three physical files mirror the three logical types. The variant picker gets the goal and routes to the right component — avoids one mega-component with nested conditionals.
- **`server/services/progress.ts`:** Progress calculation lives here, not in the DB or the client. It's imported by both server actions (for returning fresh data) and the dashboard query (for the list view).
- **`lib/progress.ts`:** A *pure* function version of progress calc lives in `lib/` so it can be called from the client for optimistic updates without a round-trip.
- **`lib/month.ts`:** Month arithmetic is surprisingly error-prone (timezones). One module, one convention.

---

## Architectural Patterns

### Pattern 1: Polymorphic "Goals" via Discriminated Union (RECOMMENDED)

**What:** One `goals` table holds the common columns (id, user_id, month, title, type, position). Type-specific data lives in the shape that fits each type best:
- Count-based: `target_count` and `current_count` columns on `goals` (nullable, valid when `type='count'`)
- Task checklist: a separate `tasks` child table (`id, goal_id, label, is_done, position`)
- Habit/streak: a separate `habit_check_ins` child table (`goal_id, check_in_date`) plus `target_days` on `goals`

Enforced at DB layer with a CHECK constraint:
```sql
CHECK (
  (type = 'count'  AND target_count IS NOT NULL AND current_count IS NOT NULL) OR
  (type = 'tasks'  AND target_count IS NULL     AND current_count IS NULL) OR
  (type = 'habit'  AND target_days  IS NOT NULL)
)
```

**When to use:** This is the right default for 3 goal types that share identity (month membership, ordering, title) but have fundamentally different progress shapes.

**Trade-offs:**
- **Pro:** Queries for "all goals in April 2026" are trivial — one table scan, no union.
- **Pro:** Foreign keys on `tasks.goal_id` and `habit_check_ins.goal_id` still work.
- **Pro:** CHECK constraints keep data honest; impossible states are unrepresentable.
- **Con:** `goals` has nullable columns that only apply to one type. Some developers dislike this.
- **Con:** Adding a 4th goal type means another type-specific column or child table.

**Example TypeScript type:**
```typescript
// Discriminated union — exhaustive checks "for free"
type Goal =
  | { id: string; type: 'count';  title: string; month: string; targetCount: number; currentCount: number }
  | { id: string; type: 'tasks';  title: string; month: string; tasks: Task[] }
  | { id: string; type: 'habit';  title: string; month: string; targetDays: number; checkIns: string[] };

type Task = { id: string; label: string; isDone: boolean; position: number };
```

### Pattern 2: Alternative — Separate Table Per Type (NOT RECOMMENDED HERE)

**What:** Three fully separate tables: `count_goals`, `task_goals`, `habit_goals`. No shared `goals` table.

**When to use:** If the three types diverge so heavily they share almost no common columns, or if each has complex per-type querying.

**Trade-offs:**
- **Pro:** No nullable columns; each table is tight.
- **Con:** Every "list all my goals for April" query requires `UNION ALL` of three shapes. Pagination, sorting by `position`, and month-scoping all become clunky.
- **Con:** Can't have a single `position` across goal types.
- **Con:** Polymorphic references back to "the goal" (e.g., for audit logs) become impossible without a separate identity table.

**Verdict:** Reject. The three types share real identity (a goal belongs to a month, has a title, a position, a user). Splitting them across three top-level tables fragments that identity.

### Pattern 3: Server-Authoritative State + Optimistic Client Updates

**What:** Postgres is the single source of truth. Every mutation goes through a Server Action that validates, writes, and returns the updated goal. The client uses React's `useOptimistic` to reflect the change before the round-trip completes.

**When to use:** Any dashboard with fast user interactions (incrementing a count, checking a task, marking today's habit). Waiting 200-400ms per click kills the "progress bar moving feels good" promise.

**Trade-offs:**
- **Pro:** Feels instant.
- **Pro:** On failure, `useOptimistic` auto-rolls back.
- **Con:** Requires duplicating the progress calculation in a pure client function (mitigated by putting it in `lib/progress.ts` and importing from both sides).

**Example:**
```typescript
// Client component
'use client';
const [optimisticGoal, addOptimistic] = useOptimistic(goal, (state, delta) => ({
  ...state,
  currentCount: state.currentCount + delta,
}));

async function increment() {
  addOptimistic(1);                      // bar moves immediately
  await incrementGoalAction(goal.id);    // server action confirms
}
```

### Pattern 4: Month-Scoped Queries with `date_trunc('month', ...)`

**What:** Store `month` as a `DATE` always set to the first of the month. Query with exact match, not ranges.

**When to use:** Always, for this product. See Data Model section below for full rationale.

---

## Data Model (The Hard Part)

### Month Identity — recommendation: `DATE` pinned to first-of-month

**Three options considered:**

| Option | Example | Verdict |
|--------|---------|---------|
| `VARCHAR(7)` string like `'2026-04'` | `'2026-04'` | Rejected — no date arithmetic, easy to mistype, sort lexically-okay-but-fragile, can't use Postgres date functions |
| `DATE` pinned to first of month | `2026-04-01` | **Recommended** — native date ops, `date_trunc` compatibility, orderable, indexable |
| Separate `months` table with FK | `month_id → months.id` | Rejected — over-normalization; months are a computed concept, not an entity needing its own rows |

**Recommendation: `DATE NOT NULL` with a CHECK that enforces first-of-month:**
```sql
month DATE NOT NULL CHECK (month = date_trunc('month', month)::date)
```

This makes the invariant **impossible to violate at the DB level** — no app-code bug can insert `2026-04-15`. Index on `(user_id, month)` for the primary dashboard query.

### Month Boundary Enforcement — DB + App (layered)

| Invariant | Where enforced | How |
|-----------|----------------|-----|
| `month` is first-of-month | **DB** | CHECK constraint (above) |
| Can't create a goal in a past month | **App** (service layer) | `assertMonthNotPast(month)` before insert |
| Past months are read-only | **App** (service + UI) | Service rejects mutations; UI hides action buttons |
| "Current month" for dashboard default | **App** | `date_trunc('month', now())` — no DB row needed |
| Persist current goals into next month automatically? | **No-op** — goals are explicitly month-scoped | The requirement "goals persist until user sets new ones" is satisfied by showing the most-recent-month-with-goals as "current" until the user creates goals for the new month |

**Why layered?** DB guarantees data shape (no nullable invariants). App guarantees business rules (read-only history). UI guarantees UX (don't show disabled buttons). Each layer catches a different class of mistake.

### Concrete Schema (Postgres, Drizzle-style annotations)

```sql
-- Users (minimal — rely on auth provider for profile)
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Goals: the polymorphic parent
CREATE TYPE goal_type AS ENUM ('count', 'tasks', 'habit');

CREATE TABLE goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month           DATE NOT NULL,
  title           TEXT NOT NULL,
  type            goal_type NOT NULL,
  position        INT NOT NULL DEFAULT 0,

  -- Count-type fields
  target_count    INT,
  current_count   INT,

  -- Habit-type fields
  target_days     INT,    -- e.g., 30 for "every day", 20 for "20 of 30 days"

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT month_is_first_of_month
    CHECK (month = date_trunc('month', month)::date),

  CONSTRAINT type_fields_match
    CHECK (
      (type = 'count' AND target_count IS NOT NULL AND current_count IS NOT NULL
                      AND target_days IS NULL)
      OR
      (type = 'tasks' AND target_count IS NULL AND current_count IS NULL
                      AND target_days IS NULL)
      OR
      (type = 'habit' AND target_days IS NOT NULL
                      AND target_count IS NULL AND current_count IS NULL)
    ),

  CONSTRAINT count_non_negative
    CHECK (current_count IS NULL OR current_count >= 0),

  CONSTRAINT target_positive
    CHECK (
      (target_count IS NULL OR target_count > 0) AND
      (target_days  IS NULL OR target_days  > 0)
    )
);

CREATE INDEX goals_user_month_idx ON goals(user_id, month);

-- Tasks: only populated when parent goal has type='tasks'
CREATE TABLE tasks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id    UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  label      TEXT NOT NULL,
  is_done    BOOLEAN NOT NULL DEFAULT false,
  position   INT NOT NULL DEFAULT 0,
  done_at    TIMESTAMPTZ
);

CREATE INDEX tasks_goal_idx ON tasks(goal_id);

-- Habit check-ins: one row per day completed
CREATE TABLE habit_check_ins (
  goal_id        UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  check_in_date  DATE NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (goal_id, check_in_date)
);

-- Optional but recommended: a trigger or app-level check that tasks.goal_id
-- points at a goal with type='tasks', and similarly for habit_check_ins.
-- (Postgres doesn't natively enforce this without a trigger; acceptable to
-- enforce in the service layer for simplicity in v1.)
```

### Why this schema and not JSONB?

JSONB was considered for the type-specific fields and rejected:
- Core entity data deserves typed columns. JSONB is for the "flexible edges" (settings, metadata).
- Tasks need ordering (`position`), toggling, and potentially per-task metadata later — they're real entities, not blobs.
- Habit check-ins need efficient "was today checked?" queries — a dedicated table with a composite PK is faster and clearer than a JSONB array scan.

---

## Progress Computation — where does `% complete` live?

**Recommendation: Pure function in `lib/progress.ts`, called from both client (optimistic) and server (authoritative). NOT a DB view.**

```typescript
// lib/progress.ts — pure, isomorphic
export function computePercent(goal: Goal): number {
  switch (goal.type) {
    case 'count':
      return goal.targetCount === 0
        ? 0
        : Math.min(100, Math.round((goal.currentCount / goal.targetCount) * 100));
    case 'tasks': {
      const total = goal.tasks.length;
      if (total === 0) return 0;
      const done = goal.tasks.filter(t => t.isDone).length;
      return Math.round((done / total) * 100);
    }
    case 'habit':
      return goal.targetDays === 0
        ? 0
        : Math.min(100, Math.round((goal.checkIns.length / goal.targetDays) * 100));
  }
}
```

### Why not a DB view?

| Option | Verdict | Reason |
|--------|---------|--------|
| **DB view / computed column** | Rejected | Couples presentation math to schema; hard to iterate on rounding/capping rules; can't run on the client for optimistic updates |
| **Server only** | Partial | Works, but every click requires a round-trip before the bar moves |
| **Client only** | Rejected | Duplicates rules; risks drift; server needs it too (e.g., for any future summary endpoint) |
| **Pure function imported by both** | **Recommended** | Single source of truth; works in RSC, Server Actions, and Client Components |

### Aggregation for the month-over-month history view

Past-month dashboards are rendered server-side only (they're immutable, so no optimistic needs). Use a single query that returns all goals for a month, hydrate them with their children, and compute percent per goal server-side. For the "list of past months" navigation, query `SELECT DISTINCT month FROM goals WHERE user_id = $1 ORDER BY month DESC` — cheap with the existing `(user_id, month)` index.

---

## Data Flow

### Request Flow — logging progress on a count goal

```
[User clicks "+1" on "Read 5 books"]
        ↓
[CountCard (Client Component)]
        ↓  useOptimistic(goal, +1)  →  bar visibly moves
[Server Action: incrementGoal(goalId)]
        ↓
[Auth middleware: session → userId]
        ↓
[Service: goals.increment(userId, goalId)]
        ↓   - loads goal
        ↓   - assertMonthIsCurrentOrFuture(goal.month)
        ↓   - assertOwnership(goal.user_id === userId)
        ↓   - UPDATE goals SET current_count = current_count + 1
[DB: returns updated row]
        ↓
[Service: returns updated Goal + computePercent(goal)]
        ↓
[revalidatePath('/dashboard/[month]')]
        ↓
[RSC re-renders with authoritative state — optimistic state confirmed]
```

### Request Flow — checking today's habit

```
[User taps today on "Meditate daily" grid]
        ↓
[HabitCard optimistically adds today to checkIns]
        ↓
[Server Action: toggleHabitCheckIn(goalId, today)]
        ↓
[Service]
        ↓   INSERT INTO habit_check_ins (goal_id, check_in_date) ... ON CONFLICT DO NOTHING
        ↓   (or DELETE if already checked, for toggle semantics)
        ↓
[revalidatePath(...)]
```

### Request Flow — creating a goal (including pre-setting future months)

```
[User opens "New goal" modal, picks month=2026-06, type='habit', target=20]
        ↓
[Server Action: createGoal({ month, type, title, ... })]
        ↓
[Service]
        ↓   - normalize month → date_trunc('month', month)
        ↓   - validate type-specific required fields
        ↓   - assertMonthNotPast(month)   (future or current allowed)
        ↓   - INSERT INTO goals (...)
        ↓
[revalidatePath('/dashboard/2026-06')]
```

### State Management

No dedicated client state library needed (e.g., Redux, Zustand). Next.js + React Server Components + `useOptimistic` covers it:

```
[Postgres]  —(RSC fetch)→  [Server Component]  —(props)→  [Client Component]
                                                              ↓
                                                    [useOptimistic state]
                                                              ↑
                                                    [Server Action on user input]
                                                              ↓
                                                    [revalidatePath → fresh RSC]
```

### Key Data Flows

1. **Dashboard render (read):** URL `/dashboard/2026-04` → RSC fetches `getMonthDashboard(userId, month)` → single query with joins for tasks and check-ins → renders Goal Cards → each Client Card hydrates with `useOptimistic`.
2. **Progress update (write):** Client optimistic → Server Action → Service → DB → revalidate → RSC re-render (confirmed).
3. **Month navigation:** URL change → new RSC render → new data; no client-side month state.
4. **History view:** Past month URLs work the same as current month, but UI renders with action handlers omitted (service would also reject mutations as defense-in-depth).

---

## Scaling Considerations

This is a single-user-per-account product with manual daily logging. Scale is not the primary concern — UX is. Realistic scale bounds:

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Single Next.js deploy + one managed Postgres instance. No caching needed. |
| 1k-100k users | Add read replica for dashboards if `getMonthDashboard` shows up in slow query logs. Add Redis for session cache if auth provider benefits. Per-user data stays small (maybe 20 goals × 31 days × 12 months = 7k rows/user/year). |
| 100k+ users | Partition `habit_check_ins` by month if that table grows large. Most other tables stay small per-user and scale horizontally with user-id sharding. Consider moving analytics/aggregates to a read-optimized view. |

### Scaling Priorities

1. **First bottleneck:** The dashboard query — `SELECT goals + JOIN tasks + JOIN habit_check_ins WHERE user_id = ? AND month = ?`. Fix with the `(user_id, month)` index (already specified) and selective loading.
2. **Second bottleneck:** Cold starts / serverless latency on infrequent users. Fix with a warmup ping or moving to a long-running Node runtime.
3. **Third bottleneck:** History view fetching many months at once. Fix by paginating the month list rather than hydrating all months.

---

## Anti-Patterns

### Anti-Pattern 1: Storing Progress Percent in the Database

**What people do:** Add a `percent` column to `goals` and update it on every mutation.
**Why it's wrong:** Denormalized — the column can drift from the truth (tasks/check-ins). Every increment is now a two-write transaction. Rounding rules become schema-level decisions.
**Do this instead:** Compute on read. It's cheap (a handful of integer ops per goal) and always correct.

### Anti-Pattern 2: One Mega "goals" Table with 20 Nullable Columns

**What people do:** Forecast every possible type's needs and add a column for each: `target_count`, `target_days`, `target_minutes`, `target_km`, etc.
**Why it's wrong:** The table becomes a dumping ground. CHECK constraints proliferate. New types require migrations of the parent table.
**Do this instead:** Keep the parent minimal (identity + small number of shared-ish fields); push non-trivial per-type state into child tables (`tasks`, `habit_check_ins`).

### Anti-Pattern 3: Month as a String Like `'April 2026'`

**What people do:** Store month as `'2026-04'` or `'April 2026'` for human readability.
**Why it's wrong:** Can't do date math (`month + interval '1 month'`). Sort order works by accident. Timezone conversion gets tangled. Hard to migrate later.
**Do this instead:** `DATE` at first-of-month, CHECK-enforced. Format for humans in the UI layer only.

### Anti-Pattern 4: Copying Goals Forward Each Month Automatically

**What people do:** Interpret "goals persist until user sets new ones" as "duplicate last month's goals into this month on the 1st."
**Why it's wrong:** Pollutes the data (duplicated rows that weren't user-authored), complicates "past months read-only" (which past? the duplicate?), and violates the explicit scoping rule.
**Do this instead:** Show the most-recent-month-that-has-goals as the "current" dashboard view until the user explicitly creates goals for the new calendar month. Dashboard logic: `coalesce(goals-for-currentMonth, goals-for-mostRecentMonth)`.

### Anti-Pattern 5: Letting the Client Compute Authority

**What people do:** Client increments `currentCount` locally, then "syncs" later.
**Why it's wrong:** Two tabs, two phones, lost writes. The client is not the source of truth.
**Do this instead:** Optimistic UI for speed, Server Action + DB as source of truth. `useOptimistic` rolls back on failure.

### Anti-Pattern 6: Fetching All Months and All Goals on Load

**What people do:** "I'll just load everything once and filter client-side."
**Why it's wrong:** Wasteful now; breaks at scale; makes RSC caching pointless.
**Do this instead:** One month per page load, keyed by URL.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Auth provider (Auth.js / Clerk / Lucia) | Session middleware; `userId` attached to every request | Pick in Stack research. Server Actions need access to the session via request headers. |
| Postgres host (Neon / Supabase / RDS) | Connection pool; migrations via Drizzle/Prisma | Serverless Postgres (Neon) aligns well with Next.js serverless deploys. |
| Email (optional, later) | For notifications ("new month started") | Out of scope for v1; note it as a future integration point. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Client UI ↔ Server Action | Typed function calls (framework-native) | No REST API surface needed for v1. Add `app/api/` later if mobile client ships. |
| Server Action ↔ Domain Service | Direct function call | Service validates; action is thin. |
| Service ↔ Data Access | Typed queries (Drizzle/Prisma) | No raw SQL in services except where necessary. |
| Progress calc ↔ UI | Pure function from `lib/progress.ts` | Imported by both server and client. |

---

## Suggested Build Order

Phase the build around **walking skeleton first**, then **per-type depth**:

1. **Foundation** — Auth, empty dashboard route, Postgres connection, `users` table. Verifies the plumbing.
2. **Goal skeleton + count type (simplest)** — `goals` table with the `type` discriminator and count columns only. Create/list/increment. Progress bar UI appears. This is the minimum "dashboard with a moving bar" loop.
3. **Month-scoping and navigation** — URL-based month routing, `getMonthDashboard(userId, month)`, CHECK constraint on `month`. Past-month read-only service guards.
4. **Task checklist type** — `tasks` child table, tasks card UI, toggle action. Second shape proves the polymorphic model works.
5. **Habit/streak type** — `habit_check_ins` child table, day-grid UI, check-in action. Third shape confirms the pattern.
6. **Pre-setting future months** — Enable creating goals in `month > currentMonth`. UI affordance in month navigator.
7. **Month-over-month history view** — Past-month navigation, read-only rendering, distinct-months query for the nav list.
8. **Polish** — Optimistic updates (`useOptimistic`), empty states, keyboard shortcuts, mobile responsive pass.

**Dependency notes:**
- (2) must precede (4) and (5) because the polymorphic pattern is validated with the simplest type first.
- (3) must precede (6) because future-month creation relies on month validation.
- (7) can be parallelized with (5) if team has bandwidth — past-month rendering is mostly read-only UI work.
- Progress calculation (`lib/progress.ts`) is introduced in (2) and extended in (4) and (5). Keep it exhaustive via TypeScript discriminated unions so adding a type forces an update.

---

## Sources

- [PostgreSQL Documentation: 5.11 Inheritance](https://www.postgresql.org/docs/current/ddl-inherit.html) — HIGH confidence, official docs
- [Modeling Polymorphic Relations in Postgres (Bruno Scheufler)](https://brunoscheufler.com/blog/2022-05-22-modeling-polymorphic-relations-in-postgres) — MEDIUM, independent analysis
- [Table Inheritance Patterns: STI vs CTI vs Concrete (Artem Khrienov)](https://medium.com/@artemkhrenov/table-inheritance-patterns-single-table-vs-class-table-vs-concrete-table-inheritance-1aec1d978de1) — MEDIUM
- [Rails STI vs Polymorphic Associations (Netguru)](https://www.netguru.com/blog/single-table-inheritance-rails) — MEDIUM, trade-off framing
- [Crunchy Data: 4 Ways to Create Date Bins in Postgres](https://www.crunchydata.com/blog/4-ways-to-create-date-bins-in-postgres-interval-date_trunc-extract-and-to_char) — HIGH, authoritative on `date_trunc`
- [PostgreSQL: Get First Day of Month — database.guide](https://database.guide/get-the-first-day-of-the-month-in-postgresql/) — MEDIUM, practical reference
- [JSONB PostgreSQL: How to Store & Index JSON Data (ScaleGrid)](https://scalegrid.io/blog/using-jsonb-in-postgresql-how-to-effectively-store-index-json-data-in-postgresql/) — MEDIUM, informs "JSONB for edges, not core entities"
- [Next.js Server Actions vs tRPC: 2026 Architect's Guide](https://medium.com/@factman60/next-js-server-actions-vs-trpc-a-2026-architects-guide-85cc4953bae4) — MEDIUM, current framing
- [Why You Should Use Next.js for Your SaaS (2026 Guide) — MakerKit](https://makerkit.dev/blog/tutorials/why-you-should-use-nextjs-saas) — MEDIUM
- [useOptimistic — React official docs](https://react.dev/reference/react/useOptimistic) — HIGH, official
- [Optimistic UI with Server Actions in Next.js (Mishal Suyog)](https://medium.com/@mishal.s.suyog/optimistic-ui-with-server-actions-in-next-js-a-smoother-user-experience-6b779e4293a9) — MEDIUM

---

*Architecture research for: Monthly commitment / goal tracker web app*
*Researched: 2026-04-17*
