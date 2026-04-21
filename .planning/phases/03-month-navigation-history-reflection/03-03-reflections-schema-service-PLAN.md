---
phase: 03-month-navigation-history-reflection
plan: 3
type: execute
wave: 1
depends_on: [1]
files_modified:
  - src/server/db/schema.ts
  - supabase/migrations/0006_month_reflections.sql
  - supabase/migrations/0007_month_reflections_check.sql
  - src/server/db/queries.ts
  - src/server/services/reflections.ts
  - src/server/actions/reflections.ts
  - tests/actions.reflections.test.ts
  - tests/rls.test.ts
autonomous: false
requirements: [POLSH-04, MNAV-04]
user_setup:
  - service: supabase
    why: "Migration push requires linked Supabase project from Phase 1 (drizzle-kit generate emits SQL; supabase db push --linked propagates)"
    env_vars: []
    dashboard_config: []
tags: [schema, migration, service, blocking-push]

must_haves:
  truths:
    - "month_reflections table exists in Drizzle schema with columns (id, user_id, month, what_worked, what_didnt, created_at, updated_at), FK cascade on user_id, UNIQUE(user_id, month), and four pgPolicy RLS blocks"
    - "Migration 0006 emitted by drizzle-kit; migration 0007 hand-authored adds CHECK EXTRACT(DAY FROM month) = 1 (Phase 1 D-09 pattern)"
    - "supabase db push --linked propagates both migrations to the linked dev project (BLOCKING gate)"
    - "upsertReflection service uses onConflictDoUpdate targeting [user_id, month]; empty-both-fields is a valid UPSERT with both null (D-30)"
    - "upsertReflectionAction enforces compareMonth(viewedMonth, currentMonth) !== 'future' server-side (D-28 — future months cannot save reflections)"
    - "getReflectionForMonth returns null when no row exists; countGoalsInMonth returns integer count (Welcome trigger precondition helper)"
    - "RLS smoke test confirms user A cannot SELECT user B's reflection row"
  artifacts:
    - path: "src/server/db/schema.ts"
      provides: "monthReflections pgTable + four pgPolicy blocks (select/insert/update/delete for authenticated user_id = auth.uid())"
      contains: "pgTable(\"month_reflections\""
    - path: "supabase/migrations/0006_month_reflections.sql"
      provides: "Drizzle-generated CREATE TABLE + RLS policies"
      contains: "CREATE TABLE"
    - path: "supabase/migrations/0007_month_reflections_check.sql"
      provides: "Hand-authored CHECK constraint enforcing first-of-month"
      contains: "EXTRACT(DAY FROM month) = 1"
    - path: "src/server/services/reflections.ts"
      provides: "upsertReflection (onConflictDoUpdate)"
      exports: ["upsertReflection", "FutureMonthReflectionError"]
    - path: "src/server/actions/reflections.ts"
      provides: "upsertReflectionAction — ActionResult shape, auth guard, server-side viewedMonth future-check"
      exports: ["upsertReflectionAction"]
    - path: "src/server/db/queries.ts"
      provides: "Appends countGoalsInMonth + getReflectionForMonth helpers"
      contains: "export async function countGoalsInMonth"
    - path: "tests/actions.reflections.test.ts"
      provides: "UPSERT insert-then-update behavior + past-month allowed + future-month rejected + empty-string → null transform"
      contains: "describe('upsertReflectionAction"
  key_links:
    - from: "src/server/db/schema.ts"
      to: "supabase/migrations/0006_month_reflections.sql"
      via: "drizzle-kit generate"
      pattern: "CREATE TABLE.*month_reflections"
    - from: "supabase/migrations/0007_month_reflections_check.sql"
      to: "supabase db push --linked"
      via: "Supabase CLI applies to linked dev project"
      pattern: "ALTER TABLE.*month_reflections"
    - from: "src/server/services/reflections.ts"
      to: "drizzle-orm"
      via: "onConflictDoUpdate({ target: [monthReflections.userId, monthReflections.month], set: { ... } })"
      pattern: "onConflictDoUpdate"
    - from: "src/server/actions/reflections.ts"
      to: "src/lib/schemas/reflections.ts"
      via: "import upsertReflectionSchema + UpsertReflectionInput"
      pattern: "upsertReflectionSchema"
---

<objective>
Wave 1 parallel with Plan 02: add the `month_reflections` table + RLS + CHECK migration + UPSERT service + server action + DB query helpers. Includes the mandatory `[BLOCKING]` schema push task so Supabase is authoritative before Wave 2 consumers read the table.

Purpose: POLSH-04 (reflection persistence) + MNAV-04 (Welcome trigger uses `countGoalsInMonth(priorMonth) > 0` to decide whether to offer Copy-from-last-month vs. Phase 2 EmptyState). Both land in the DB layer here; UI components in Plan 04/05 consume.
Output: Drizzle schema extension + 2 migrations (auto + hand-authored) + service + action + 2 query helpers + test coverage + live Supabase push.
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
@CLAUDE.md

<interfaces>
<!-- Contracts this plan consumes and produces -->

From src/server/db/schema.ts (existing goals-table analog to replicate verbatim):
```typescript
// lines 54-102: goals table with FK cascade + 4 pgPolicy blocks
pgTable("goals", { ... }, (table) => [
  foreignKey({ columns: [table.userId], foreignColumns: [users.id], name: "goals_user_id_fk" }).onDelete("cascade"),
  pgPolicy("goals-select-own", { for: "select", to: authenticatedRole, using: sql`user_id = auth.uid()` }),
  pgPolicy("goals-insert-own", { for: "insert", to: authenticatedRole, withCheck: sql`user_id = auth.uid()` }),
  pgPolicy("goals-update-own", { for: "update", to: authenticatedRole, using: sql`user_id = auth.uid()`, withCheck: sql`user_id = auth.uid()` }),
  pgPolicy("goals-delete-own", { for: "delete", to: authenticatedRole, using: sql`user_id = auth.uid()` }),
])
// imports: pgTable, uuid, text, timestamp, date, pgPolicy, foreignKey, unique (NEW — import from drizzle-orm/pg-core)
// sql helper: import { sql } from "drizzle-orm"
// authenticatedRole: import { authenticatedRole } from "drizzle-orm/supabase"
```

Existing migration 0001 hand-authored pattern (for reference on 0007):
```sql
-- supabase/migrations/0001_custom_constraints.sql (Phase 1)
ALTER TABLE public.goals
  ADD CONSTRAINT goals_month_is_first_of_month
  CHECK (EXTRACT(DAY FROM month) = 1);
```

From Plan 01 (required):
```typescript
// src/lib/schemas/reflections.ts
export const upsertReflectionSchema: z.ZodSchema<UpsertReflectionInput>
export type UpsertReflectionInput = { month: string; whatWorked: string | null; whatDidnt: string | null }
```

From src/server/actions/progress.ts (ActionResult shape + resolveUserTz to replicate):
```typescript
type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }
async function resolveUserTz(userId: string): Promise<string> {
  const [row] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1)
  return row?.timezone ?? "UTC"
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add monthReflections table + RLS policies to Drizzle schema</name>
  <files>src/server/db/schema.ts</files>

  <read_first>
    - /Users/rathtana.duong/gsd-tutorial/src/server/db/schema.ts (entire file — append at end; match exact import style + pgPolicy + foreignKey pattern from goals table lines 54-102)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-RESEARCH.md lines 690-729 (canonical Drizzle schema shape, copy verbatim)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-CONTEXT.md D-24 (column specification including CHECK, UNIQUE, RLS)
  </read_first>

  <action>
    Step 1: Verify `unique` is imported from `drizzle-orm/pg-core` at the top of schema.ts (line 1-13 block). If not, add it to the existing import list.

    Step 2: APPEND to the end of `src/server/db/schema.ts` (do not modify any existing table definition):

    ```typescript
    // ---------- public.month_reflections (POLSH-04 / D-24) ----------
    export const monthReflections = pgTable(
      "month_reflections",
      {
        id: uuid("id").primaryKey().defaultRandom().notNull(),
        userId: uuid("user_id").notNull(),
        month: date("month").notNull(), // CHECK enforced via hand-authored migration 0007
        whatWorked: text("what_worked"), // nullable per D-30
        whatDidnt: text("what_didnt"),   // nullable per D-30
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
      },
      (table) => [
        foreignKey({
          columns: [table.userId],
          foreignColumns: [users.id],
          name: "month_reflections_user_id_fk",
        }).onDelete("cascade"),
        unique("month_reflections_user_month_key").on(table.userId, table.month),
        pgPolicy("month-reflections-select-own", {
          for: "select",
          to: authenticatedRole,
          using: sql`user_id = auth.uid()`,
        }),
        pgPolicy("month-reflections-insert-own", {
          for: "insert",
          to: authenticatedRole,
          withCheck: sql`user_id = auth.uid()`,
        }),
        pgPolicy("month-reflections-update-own", {
          for: "update",
          to: authenticatedRole,
          using: sql`user_id = auth.uid()`,
          withCheck: sql`user_id = auth.uid()`,
        }),
        pgPolicy("month-reflections-delete-own", {
          for: "delete",
          to: authenticatedRole,
          using: sql`user_id = auth.uid()`,
        }),
      ],
    )
    ```
  </action>

  <verify>
    <automated>npx tsc --noEmit -p .</automated>
  </verify>

  <acceptance_criteria>
    - `grep -n "monthReflections = pgTable(" src/server/db/schema.ts` returns a match
    - `grep -n "\"month_reflections\"" src/server/db/schema.ts` returns a match (table name literal)
    - `grep -c "pgPolicy(\"month-reflections-" src/server/db/schema.ts` returns exactly 4 (four RLS policies)
    - `grep -n "unique(\"month_reflections_user_month_key\")" src/server/db/schema.ts` returns a match
    - `grep -n "month_reflections_user_id_fk" src/server/db/schema.ts` returns a match
    - `grep -n "onDelete(\"cascade\")" src/server/db/schema.ts` — this line appears (FK cascade)
    - `npx tsc --noEmit -p .` exits 0 (no type errors introduced)
  </acceptance_criteria>

  <done>
    `monthReflections` table defined with UNIQUE + FK + 4 pgPolicy blocks. TypeScript compiles. Pre-existing goals/tasks/etc. tables untouched.
  </done>
</task>

<task type="auto">
  <name>Task 2: Generate migration 0006 via drizzle-kit + hand-author migration 0007 for CHECK constraint</name>
  <files>supabase/migrations/0006_month_reflections.sql, supabase/migrations/0007_month_reflections_check.sql</files>

  <read_first>
    - /Users/rathtana.duong/gsd-tutorial/supabase/migrations/0001_custom_constraints.sql (Phase 1 hand-authored CHECK pattern — replicate structure exactly for 0007)
    - /Users/rathtana.duong/gsd-tutorial/supabase/migrations/0003_polymorphic_check.sql (Phase 2 hand-authored pattern if present — same style)
    - /Users/rathtana.duong/gsd-tutorial/drizzle.config.ts (confirms output path is `./supabase/migrations/`)
  </read_first>

  <action>
    Step 1: Run `npx drizzle-kit generate` from the repo root. It emits `supabase/migrations/0006_<drizzle-chosen-suffix>.sql` containing the CREATE TABLE + RLS. If the filename is not `0006_month_reflections.sql`, rename it (or if drizzle picked a different number because of existing migrations state, use whatever next integer it chose and adjust references throughout this plan accordingly — record actual filename in SUMMARY).

    Step 2: Hand-author `supabase/migrations/0007_month_reflections_check.sql` (use the next sequential number after the drizzle-kit-generated file):

    ```sql
    -- Phase 3 / D-24: month_reflections.month must be first-of-month.
    -- drizzle-kit doesn't emit CHECK constraints from table definitions — Phase 1 D-09 pattern.
    ALTER TABLE public.month_reflections
      ADD CONSTRAINT month_reflections_month_is_first_of_month
      CHECK (EXTRACT(DAY FROM month) = 1);
    ```

    Step 3: Do NOT run `supabase db push` in this task — that is the [BLOCKING] Task 3 below. The plan sequences generate → push → consume so that review is possible.
  </action>

  <verify>
    <automated>test -f supabase/migrations/0006_*.sql && test -f supabase/migrations/0007_month_reflections_check.sql && grep -q "CREATE TABLE" supabase/migrations/0006_*.sql && grep -q "EXTRACT(DAY FROM month) = 1" supabase/migrations/0007_month_reflections_check.sql && echo "migrations-ready"</automated>
  </verify>

  <acceptance_criteria>
    - File matching `supabase/migrations/0006_*.sql` exists (drizzle-kit generated; may have its own suffix)
    - File `supabase/migrations/0007_month_reflections_check.sql` exists (hand-authored)
    - The 0006 file contains `CREATE TABLE` AND `month_reflections` literals
    - The 0006 file contains `CREATE POLICY` or `ALTER TABLE` for RLS (drizzle-kit emits policies as separate statements — grep for either)
    - The 0007 file contains the exact literal `EXTRACT(DAY FROM month) = 1`
    - The 0007 file contains `ALTER TABLE public.month_reflections`
    - The 0007 file contains the constraint name `month_reflections_month_is_first_of_month`
  </acceptance_criteria>

  <done>
    Both migration files present on disk. 0006 was auto-generated; 0007 was hand-authored for the CHECK. Neither has been pushed yet — Task 3 handles that.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: [BLOCKING] supabase db push --linked to propagate migrations to Supabase dev project</name>
  <files>supabase/migrations/0006_month_reflections.sql, supabase/migrations/0007_month_reflections_check.sql</files>

  <read_first>
    - /Users/rathtana.duong/gsd-tutorial/.planning/STATE.md §Accumulated Context (Phase 1 Plan 01-03 note: "psql not available locally; post-push verification uses inline node -e + postgres.js"; "shell env loading standardised to set -a; source .env.local; set +a")
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-RESEARCH.md §Environment Availability (Supabase CLI 2.90.0 verified)
  </read_first>

  <what-built>
    Drizzle schema extension landed (Task 1). Two SQL migrations generated (Task 2): `0006_month_reflections.sql` (drizzle-kit — CREATE TABLE + 4 RLS policies + UNIQUE + FK) and `0007_month_reflections_check.sql` (hand-authored — CHECK first-of-month). Neither has been applied to the remote Supabase dev project yet.
  </what-built>

  <action>
    Run both commands in sequence from the repo root. First the push:
    ```bash
    set -a; source .env.local; set +a
    npx supabase db push --linked
    ```
    If the command is non-TTY and prompts require "y" confirmation, run with `--yes` (or pre-accept via config). If `supabase db push` fails due to missing login / project link, surface the error — do NOT swallow.

    Then verify the table and CHECK exist on the remote DB (psql is not available locally — use Phase 1 established `node -e` + postgres.js inline pattern):
    ```bash
    node -e "
    const { default: postgres } = await import('postgres');
    const sql = postgres(process.env.DATABASE_URL);
    const t = await sql\`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='month_reflections'\`;
    const c = await sql\`SELECT con.conname FROM pg_constraint con JOIN pg_class cls ON cls.oid = con.conrelid WHERE cls.relname='month_reflections' AND con.conname='month_reflections_month_is_first_of_month'\`;
    const p = await sql\`SELECT policyname FROM pg_policies WHERE tablename='month_reflections'\`;
    console.log(JSON.stringify({ table: t.length, check: c.length, policies: p.length }));
    await sql.end();
    "
    ```
    Expect output: `{"table":1,"check":1,"policies":4}`.
  </action>

  <how-to-verify>
    1. Confirm `supabase db push --linked` completed without error (exit 0)
    2. The inline node verification prints `{"table":1,"check":1,"policies":4}` — table exists, CHECK constraint exists, 4 RLS policies exist
    3. If any count is wrong (0 table, 0 check, <4 policies), the push did NOT land cleanly and the planner must intervene

    On approval, type "approved" or paste the verification JSON output.
  </how-to-verify>

  <resume-signal>
    Type "approved" with the verification JSON output `{"table":1,"check":1,"policies":4}` — or describe the failure so we can fix migrations before proceeding.
  </resume-signal>

  <acceptance_criteria>
    - `supabase db push --linked` exits 0 (visible in user confirmation)
    - Inline node verification returns `{"table":1,"check":1,"policies":4}` exactly — table present, CHECK present, 4 RLS policies present
    - User explicitly types "approved" to unblock downstream tasks
  </acceptance_criteria>

  <done>
    Both migrations applied to the linked Supabase dev project; live DB has the month_reflections table + CHECK + 4 RLS policies. User has confirmed with the verification JSON.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: upsertReflection service + getReflectionForMonth + countGoalsInMonth queries + upsertReflectionAction + tests</name>
  <files>src/server/services/reflections.ts, src/server/db/queries.ts, src/server/actions/reflections.ts, tests/actions.reflections.test.ts, tests/rls.test.ts</files>

  <read_first>
    - /Users/rathtana.duong/gsd-tutorial/src/server/actions/progress.ts (replicate imports + `ActionResult` + `resolveUserTz` + `getSupabaseServerClient` + auth guard pattern verbatim)
    - /Users/rathtana.duong/gsd-tutorial/src/server/services/progress.ts (Drizzle `db.transaction` + error-class pattern)
    - /Users/rathtana.duong/gsd-tutorial/src/server/db/queries.ts (append-at-end pattern for new helpers)
    - /Users/rathtana.duong/gsd-tutorial/src/lib/schemas/reflections.ts (Plan 01 output — upsertReflectionSchema shape + UpsertReflectionInput type)
    - /Users/rathtana.duong/gsd-tutorial/src/lib/time.ts (monthBucket, compareMonth, parseMonthSegment from Plan 01)
    - /Users/rathtana.duong/gsd-tutorial/.planning/phases/03-month-navigation-history-reflection/03-RESEARCH.md §Pattern 7 (onConflictDoUpdate canonical) + §Additional code helpers (countGoalsInMonth, getReflectionForMonth full impls)
    - /Users/rathtana.duong/gsd-tutorial/tests/actions.progress.test.ts (mock-Supabase + mock-db pattern to replicate)
    - /Users/rathtana.duong/gsd-tutorial/tests/rls.test.ts (existing RLS smoke pattern — append month_reflections cases)
  </read_first>

  <behavior>
    upsertReflection service:
    - Test 1: First call inserts a new month_reflections row (1 row present after)
    - Test 2: Second call for same (userId, month) UPDATES the existing row (still 1 row; updatedAt changed; values match second call)
    - Test 3: Empty string inputs (`whatWorked: ''`, `whatDidnt: ''`) after Zod transform result in NULL columns in DB

    upsertReflectionAction:
    - Test 4: Unauthenticated → `{ ok: false, error: "Not authenticated." }`
    - Test 5: Invalid Zod input (whatWorked > 280 chars) → `{ ok: false, error: "Invalid input." }`
    - Test 6: Past-month reflection save succeeds (D-27 — editable on past always)
    - Test 7: Current-month reflection save succeeds
    - Test 8: Future-month reflection save REJECTED → `{ ok: false, error: "Reflections aren't available for future months." }` (D-28 server-side gate)
    - Test 9: Successful save returns `{ ok: true, data: { savedAt: <ISO string> } }`

    Query helpers:
    - Test 10: `countGoalsInMonth(userId, month)` returns 0 when no goals exist for that month, correct integer otherwise
    - Test 11: `getReflectionForMonth(userId, month)` returns `null` when no row exists; returns `{whatWorked, whatDidnt}` object when row exists

    RLS smoke (extend tests/rls.test.ts):
    - Test 12: User A's SELECT of month_reflections with user_id=B returns zero rows under authenticated role (RLS enforces `user_id = auth.uid()`)
  </behavior>

  <action>
    Step 1 (RED): Write `tests/actions.reflections.test.ts` with tests 1-9, matching the Supabase-mock pattern used in `tests/actions.progress.test.ts`. Extend `tests/rls.test.ts` with test 12. Add tests 10-11 inline in `tests/actions.reflections.test.ts` or create a dedicated `tests/queries.reflections.test.ts` (planner choice — tests 10-11 are small, keep in actions test file for simplicity). Run → fail.

    Step 2 (GREEN — queries): Append to `src/server/db/queries.ts`:

    ```typescript
    // at top of file if not present:
    import { monthReflections } from "@/server/db/schema"

    /**
     * Count goals for (user, month). Used by Plan 04/05 Welcome trigger: priorMonthHasGoals = count > 0.
     * Phase 3 D-18 precondition helper.
     */
    export async function countGoalsInMonth(userId: string, month: Date): Promise<number> {
      const monthStr = month.toISOString().slice(0, 10)
      const rows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(goals)
        .where(and(eq(goals.userId, userId), eq(goals.month, monthStr)))
      return rows[0]?.count ?? 0
    }

    /**
     * Fetch the reflection row for (user, month). Returns null when no row exists (D-30).
     */
    export async function getReflectionForMonth(
      userId: string,
      month: Date,
    ): Promise<{ whatWorked: string | null; whatDidnt: string | null } | null> {
      const monthStr = month.toISOString().slice(0, 10)
      const [row] = await db
        .select({
          whatWorked: monthReflections.whatWorked,
          whatDidnt: monthReflections.whatDidnt,
        })
        .from(monthReflections)
        .where(and(eq(monthReflections.userId, userId), eq(monthReflections.month, monthStr)))
        .limit(1)
      return row ?? null
    }
    ```

    Step 3 (GREEN — service): Create `src/server/services/reflections.ts`:

    ```typescript
    import { sql } from "drizzle-orm"
    import { db } from "@/server/db"
    import { monthReflections } from "@/server/db/schema"
    import type { UpsertReflectionInput } from "@/lib/schemas/reflections"

    export class FutureMonthReflectionError extends Error {
      constructor() {
        super("Reflections aren't available for future months.")
      }
    }

    export async function upsertReflection(
      userId: string,
      input: UpsertReflectionInput,
    ): Promise<{ savedAt: Date }> {
      const [row] = await db
        .insert(monthReflections)
        .values({
          userId,
          month: input.month,
          whatWorked: input.whatWorked,
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
      return { savedAt: row.savedAt }
    }
    ```

    Step 4 (GREEN — action): Create `src/server/actions/reflections.ts`:

    ```typescript
    "use server"

    import { revalidatePath } from "next/cache"
    import { eq } from "drizzle-orm"
    import { getSupabaseServerClient } from "@/lib/supabase/server"
    import { db } from "@/server/db"
    import { users } from "@/server/db/schema"
    import {
      upsertReflectionSchema,
      type UpsertReflectionInput,
    } from "@/lib/schemas/reflections"
    import { upsertReflection, FutureMonthReflectionError } from "@/server/services/reflections"
    import { monthBucket, compareMonth } from "@/lib/time"

    type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }

    async function resolveUserTz(userId: string): Promise<string> {
      const [row] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1)
      return row?.timezone ?? "UTC"
    }

    export async function upsertReflectionAction(
      input: UpsertReflectionInput,
    ): Promise<ActionResult<{ savedAt: string }>> {
      const parsed = upsertReflectionSchema.safeParse(input)
      if (!parsed.success) return { ok: false, error: "Invalid input." }

      const supabase = await getSupabaseServerClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { ok: false, error: "Not authenticated." }
      const userTz = await resolveUserTz(user.id)

      // D-28: reject future-month reflections server-side (defense in depth — UI already hides the card)
      const viewedMonth = new Date(`${parsed.data.month.slice(0, 7)}-01T00:00:00.000Z`)
      const currentMonth = monthBucket(new Date(), userTz)
      if (compareMonth(viewedMonth, currentMonth) === "future") {
        return { ok: false, error: "Reflections aren't available for future months." }
      }

      try {
        const { savedAt } = await upsertReflection(user.id, parsed.data)
        revalidatePath(`/dashboard/${parsed.data.month.slice(0, 7)}`)
        return { ok: true, data: { savedAt: savedAt.toISOString() } }
      } catch (e) {
        if (e instanceof FutureMonthReflectionError) {
          return { ok: false, error: "Reflections aren't available for future months." }
        }
        return { ok: false, error: "Couldn't save reflection. Please try again." }
      }
    }
    ```

    Step 5: Tests must pass. Run the full suite to catch regressions.
  </action>

  <verify>
    <automated>npx vitest run tests/actions.reflections.test.ts tests/rls.test.ts</automated>
  </verify>

  <acceptance_criteria>
    - `src/server/services/reflections.ts` exists; `grep -n "export async function upsertReflection" src/server/services/reflections.ts` returns a match
    - `grep -n "onConflictDoUpdate" src/server/services/reflections.ts` returns a match with `target: [monthReflections.userId, monthReflections.month]`
    - `src/server/actions/reflections.ts` exists; `grep -n "export async function upsertReflectionAction" src/server/actions/reflections.ts` returns a match
    - `grep -n "compareMonth(viewedMonth, currentMonth) === \"future\"" src/server/actions/reflections.ts` returns a match (D-28 server-side future-month gate)
    - `grep -n "Reflections aren't available for future months" src/server/actions/reflections.ts` returns at least one match
    - `grep -n "export async function countGoalsInMonth" src/server/db/queries.ts` returns a match
    - `grep -n "export async function getReflectionForMonth" src/server/db/queries.ts` returns a match
    - `tests/actions.reflections.test.ts` exists with at least 9 test cases covering insert/update/past/future/unauthenticated/invalid
    - `npx vitest run tests/actions.reflections.test.ts tests/rls.test.ts` exits 0
  </acceptance_criteria>

  <done>
    Service + action + two query helpers exist, Zod-validated, RLS-tested, with UPSERT confirmed against live DB via test infrastructure. Future-month reflections rejected at the action layer per D-28.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → upsertReflectionAction | Untrusted textarea content crosses here; month field is untrusted |
| server action → service | user.id from authenticated session is trusted; input already Zod-parsed |
| service → Postgres | UNIQUE constraint (user_id, month) is the atomic conflict target; CHECK enforces first-of-month |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-06 | Tampering | `upsertReflectionAction` (textarea exceeds 280 chars via API) | mitigate | Zod `.max(280)` in `upsertReflectionSchema` re-parses server-side (Pitfall 8 from RESEARCH); HTML maxLength is UX-only. |
| T-03-07 | Tampering | `upsertReflectionAction` with future-month payload | mitigate | Server-side `compareMonth(viewedMonth, currentMonth) === 'future'` gate rejects with explicit error (D-28). |
| T-03-08 | Information Disclosure | Cross-user reflection SELECT | mitigate | RLS policy `user_id = auth.uid()` on month_reflections; verified by rls.test.ts extension (test 12). |
| T-03-09 | Tampering | Race on double-UPSERT for same (user, month) | mitigate | `UNIQUE (user_id, month)` constraint at Postgres level + `onConflictDoUpdate` is atomic; concurrent writes serialize correctly. |
| T-03-10 | Denial of Service | Flooding reflections table with rows for a single user across many months | accept | Low-frequency writes (auto-save debounced 800ms; one row per user per month); UNIQUE prevents explosion. No need for rate limit in v1 (POLSH-02 is Phase 4). |
| T-03-11 | Tampering | Month column accepts non-first-of-month value via direct API | mitigate | CHECK constraint `EXTRACT(DAY FROM month) = 1` (migration 0007) — Postgres rejects at the DB layer. |
</threat_model>

<verification>
- `npx vitest run tests/actions.reflections.test.ts tests/rls.test.ts` green
- Inline node verification after push: `{"table":1,"check":1,"policies":4}`
- Full `npx vitest run` — no regression
</verification>

<success_criteria>
- Drizzle schema + 2 migrations authoritatively applied to Supabase dev project (user-confirmed)
- `upsertReflection` uses atomic `onConflictDoUpdate` — UPSERT test (insert → update same row) passes
- `upsertReflectionAction` rejects future-month reflection saves server-side (D-28 defense in depth)
- `countGoalsInMonth` + `getReflectionForMonth` helpers available for Plan 04/05 consumers
- RLS smoke confirms cross-user read is blocked
</success_criteria>

<output>
After completion, create `.planning/phases/03-month-navigation-history-reflection/03-03-SUMMARY.md` capturing:
- Exact migration filenames (drizzle-kit-chosen suffix if any)
- Verification JSON confirming table + CHECK + 4 policies exist on remote DB
- Any drift between RESEARCH schema spec and actual Drizzle emit (e.g., policy naming)
- Confirmation that `FutureMonthReflectionError` is not used outside the action (defensive class, not critical path) — or whether service throws it too
</output>
