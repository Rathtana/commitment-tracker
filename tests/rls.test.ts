import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import postgres from 'postgres'
import { randomUUID } from 'node:crypto'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error(
    'tests/rls.test.ts requires DATABASE_URL. Run: `set -a; source .env.local; set +a` before `npx vitest run tests/rls.test.ts`',
  )
}

// One pooler connection for the whole suite. prepare: false for Supabase transaction pooler.
const sql = postgres(DATABASE_URL, { max: 1, prepare: false })

// Two stable test-user UUIDs (deterministic — easier to clean up).
const USER_A = '11111111-1111-1111-1111-111111111111'
const USER_B = '22222222-2222-2222-2222-222222222222'

/**
 * Run `fn` inside a transaction as the authenticated Supabase role with
 * request.jwt.claims forged to the given user id. RLS policies see
 * `auth.uid()` = userId. Rolls back at the end so tests are hermetic.
 */
async function asUser<T>(
  userId: string,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL role = authenticated`)
    await tx.unsafe(
      `SET LOCAL request.jwt.claims = '${JSON.stringify({
        sub: userId,
        role: 'authenticated',
      })}'`,
    )
    return fn(tx)
  }) as Promise<T>
}

async function seedUsers() {
  // Insert into auth.users — the on_auth_user_created trigger (migration 0001)
  // auto-populates public.users. Direct inserts into public.users would fail
  // the users_id_fk FK (REFERENCES auth.users). This path also exercises the
  // trigger itself, so the test covers D-08 in addition to D-21/D-22.
  //
  // Requires a superuser or service-role connection. The pooler DATABASE_URL
  // from Supabase connects as the `postgres` role, which has privileges on
  // the auth schema — sufficient for this test-only workload.
  await sql`
    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      raw_user_meta_data, raw_app_meta_data,
      created_at, updated_at, email_confirmed_at, encrypted_password
    )
    VALUES
      (
        ${USER_A}, '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'rls-test-a@example.com',
        '{}'::jsonb, '{}'::jsonb,
        NOW(), NOW(), NOW(), ''
      ),
      (
        ${USER_B}, '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'rls-test-b@example.com',
        '{}'::jsonb, '{}'::jsonb,
        NOW(), NOW(), NOW(), ''
      )
    ON CONFLICT (id) DO NOTHING
  `
}

async function cleanup() {
  // Delete goals first (FK), then public.users (FK cascades from auth.users
  // anyway, but being explicit is cheaper than relying on cascade timing), then
  // auth.users — cascade will drop the matching public.users rows again if any
  // survived. ON CONFLICT DO NOTHING means seedUsers is idempotent.
  await sql`DELETE FROM public.goals WHERE user_id IN (${USER_A}, ${USER_B})`
  await sql`DELETE FROM public.users WHERE id IN (${USER_A}, ${USER_B})`
  await sql`DELETE FROM auth.users WHERE id IN (${USER_A}, ${USER_B})`
}

beforeAll(async () => {
  await cleanup()
  await seedUsers()
})

afterAll(async () => {
  await cleanup()
  await sql.end({ timeout: 5 })
})

describe('RLS: cross-user isolation (D-21, D-22)', () => {
  let goalA_id: string
  let goalB_id: string

  beforeEach(async () => {
    // Clean goals between tests; users persist.
    await sql`DELETE FROM public.goals WHERE user_id IN (${USER_A}, ${USER_B})`
    goalA_id = randomUUID()
    goalB_id = randomUUID()

    // Insert one goal per user AS that user (so WITH CHECK fires correctly).
    // type='count' requires target_count + current_count (goals_polymorphic_validity CHECK)
    await asUser(USER_A, async (tx) => {
      await tx`
        INSERT INTO public.goals (id, user_id, month, type, title, target_count, current_count)
        VALUES (${goalA_id}, ${USER_A}, '2026-04-01', 'count', 'A goal', 10, 0)
      `
    })
    await asUser(USER_B, async (tx) => {
      await tx`
        INSERT INTO public.goals (id, user_id, month, type, title, target_count, current_count)
        VALUES (${goalB_id}, ${USER_B}, '2026-04-01', 'count', 'B goal', 10, 0)
      `
    })
  })

  it('user A SELECT public.goals → only A rows (B row hidden by RLS)', async () => {
    const rows = await asUser(USER_A, (tx) => tx`SELECT id, user_id FROM public.goals`)
    expect(rows.map((r) => r.id)).toEqual([goalA_id])
  })

  it('user A UPDATE B goal → 0 rows affected (RLS filters UPDATE)', async () => {
    const result = await asUser(USER_A, (tx) =>
      tx`UPDATE public.goals SET title = 'hacked' WHERE id = ${goalB_id}`,
    )
    expect(result.count).toBe(0)

    // Sanity: B's row still has original title.
    const rows = await asUser(USER_B, (tx) =>
      tx`SELECT title FROM public.goals WHERE id = ${goalB_id}`,
    )
    expect(rows[0].title).toBe('B goal')
  })

  it('user A DELETE B goal → 0 rows affected', async () => {
    const result = await asUser(USER_A, (tx) =>
      tx`DELETE FROM public.goals WHERE id = ${goalB_id}`,
    )
    expect(result.count).toBe(0)

    const stillThere = await asUser(USER_B, (tx) =>
      tx`SELECT id FROM public.goals WHERE id = ${goalB_id}`,
    )
    expect(stillThere).toHaveLength(1)
  })

  it('user A INSERT with user_id = B → rejected by WITH CHECK', async () => {
    // Postgres raises "new row violates row-level security policy" for WITH CHECK failures.
    await expect(
      asUser(USER_A, (tx) =>
        tx`
          INSERT INTO public.goals (id, user_id, month, type, title)
          VALUES (${randomUUID()}, ${USER_B}, '2026-04-01', 'count', 'impersonation')
        `,
      ),
    ).rejects.toThrow(/row-level security/i)
  })

  it('user A SELECT public.users → only A row', async () => {
    const rows = await asUser(USER_A, (tx) => tx`SELECT id FROM public.users`)
    expect(rows.map((r) => r.id)).toEqual([USER_A])
  })

  it('user A UPDATE B user row → 0 rows affected', async () => {
    const result = await asUser(USER_A, (tx) =>
      tx`UPDATE public.users SET timezone = 'UTC' WHERE id = ${USER_B}`,
    )
    expect(result.count).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Phase 2 child-table RLS tests
// Each suite seeds one goal for USER_A (and goal/task/check-in/entry as needed),
// then verifies USER_B cannot read/mutate USER_A's child rows.
// ---------------------------------------------------------------------------

let sharedGoalA_id: string

async function seedGoalA() {
  sharedGoalA_id = randomUUID()
  await asUser(USER_A, (tx) => tx`
    INSERT INTO public.goals (id, user_id, month, type, title, target_count, current_count)
    VALUES (${sharedGoalA_id}, ${USER_A}, '2026-04-01', 'count', 'A count goal', 10, 0)
  `)
}

async function cleanChildRows() {
  await sql`DELETE FROM public.goals WHERE user_id IN (${USER_A}, ${USER_B})`
}

describe('tasks RLS', () => {
  let taskId: string

  beforeEach(async () => {
    await cleanChildRows()
    await seedGoalA()
    taskId = randomUUID()
    // Seed one task for USER_A's goal (as postgres role bypassing RLS)
    await sql`
      INSERT INTO public.tasks (id, goal_id, label)
      VALUES (${taskId}, ${sharedGoalA_id}, 'Buy groceries')
    `
  })

  it("USER_B SELECT tasks → 0 rows (A's tasks are hidden)", async () => {
    const rows = await asUser(USER_B, (tx) => tx`SELECT id FROM public.tasks WHERE id = ${taskId}`)
    expect(rows).toHaveLength(0)
  })

  it('USER_B UPDATE A task → 0 rows affected', async () => {
    const result = await asUser(USER_B, (tx) =>
      tx`UPDATE public.tasks SET label = 'hacked' WHERE id = ${taskId}`,
    )
    expect(result.count).toBe(0)
  })

  it('USER_B DELETE A task → 0 rows affected', async () => {
    const result = await asUser(USER_B, (tx) =>
      tx`DELETE FROM public.tasks WHERE id = ${taskId}`,
    )
    expect(result.count).toBe(0)
  })

  it("USER_B INSERT task with A's goal_id → rejected by WITH CHECK", async () => {
    await expect(
      asUser(USER_B, (tx) => tx`
        INSERT INTO public.tasks (id, goal_id, label)
        VALUES (${randomUUID()}, ${sharedGoalA_id}, 'stolen task')
      `),
    ).rejects.toThrow(/row-level security/i)
  })

  // Migration 0004: last_undo_id + prior_is_done columns
  it('USER_A can SELECT task including last_undo_id + prior_is_done columns (migration 0004)', async () => {
    const rows = await asUser(USER_A, (tx) =>
      tx`SELECT id, last_undo_id, prior_is_done FROM public.tasks WHERE id = ${taskId}`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(taskId)
    // Both columns are nullable; newly inserted task has nulls
    expect(rows[0].last_undo_id).toBeNull()
    expect(rows[0].prior_is_done).toBeNull()
  })

  it("USER_A UPDATE own task to set last_undo_id → 1 row affected (undo metadata write)", async () => {
    const undoId = randomUUID()
    const result = await asUser(USER_A, (tx) =>
      tx`UPDATE public.tasks SET last_undo_id = ${undoId}, prior_is_done = false WHERE id = ${taskId}`,
    )
    expect(result.count).toBe(1)
  })

  it("USER_B UPDATE A task last_undo_id → 0 rows affected (RLS blocks cross-user undo metadata write)", async () => {
    const undoId = randomUUID()
    const result = await asUser(USER_B, (tx) =>
      tx`UPDATE public.tasks SET last_undo_id = ${undoId}, prior_is_done = false WHERE id = ${taskId}`,
    )
    expect(result.count).toBe(0)
  })
})

describe('habit_check_ins RLS', () => {
  beforeEach(async () => {
    await cleanChildRows()
    await seedGoalA()
    // Change goal to habit type for this suite
    await sql`
      INSERT INTO public.goals (id, user_id, month, type, title, target_days)
      VALUES (${randomUUID()}, ${USER_A}, '2026-04-01', 'habit', 'A habit goal', 20)
    `
    // Re-fetch to get the habit goal id
    const rows = await sql`SELECT id FROM public.goals WHERE user_id = ${USER_A} AND type = 'habit' LIMIT 1`
    if (rows.length > 0) {
      await sql`
        INSERT INTO public.habit_check_ins (goal_id, check_in_date)
        VALUES (${rows[0].id}, '2026-04-01')
        ON CONFLICT DO NOTHING
      `
    }
  })

  it("USER_B SELECT habit_check_ins → 0 rows (A's check-ins hidden)", async () => {
    const rows = await asUser(USER_B, (tx) =>
      tx`SELECT goal_id FROM public.habit_check_ins WHERE check_in_date = '2026-04-01'`,
    )
    // USER_B should see none of USER_A's check-ins
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const goalIds = rows.map((r: any) => r.goal_id as string)
    const ownedByA = await sql`SELECT id FROM public.goals WHERE user_id = ${USER_A}`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aGoalIds = new Set(ownedByA.map((g: any) => g.id as string))
    const leaked = goalIds.filter((id: string) => aGoalIds.has(id))
    expect(leaked).toHaveLength(0)
  })

  it("USER_B INSERT habit_check_in with A's goal_id → rejected", async () => {
    const aGoals = await sql`SELECT id FROM public.goals WHERE user_id = ${USER_A} AND type = 'habit' LIMIT 1`
    if (aGoals.length === 0) return
    const aHabitGoalId = aGoals[0].id
    await expect(
      asUser(USER_B, (tx) => tx`
        INSERT INTO public.habit_check_ins (goal_id, check_in_date)
        VALUES (${aHabitGoalId}, '2026-04-05')
      `),
    ).rejects.toThrow(/row-level security/i)
  })
})

describe('progress_entries RLS', () => {
  let entryId: string

  beforeEach(async () => {
    await cleanChildRows()
    await seedGoalA()
    entryId = randomUUID()
    await sql`
      INSERT INTO public.progress_entries (id, goal_id, delta, logged_local_date)
      VALUES (${entryId}, ${sharedGoalA_id}, 1, '2026-04-01')
    `
  })

  it("USER_B SELECT progress_entries → 0 rows (A's entries hidden)", async () => {
    const rows = await asUser(USER_B, (tx) =>
      tx`SELECT id FROM public.progress_entries WHERE id = ${entryId}`,
    )
    expect(rows).toHaveLength(0)
  })

  it('USER_B UPDATE A progress_entry → 0 rows affected', async () => {
    const result = await asUser(USER_B, (tx) =>
      tx`UPDATE public.progress_entries SET delta = 99 WHERE id = ${entryId}`,
    )
    expect(result.count).toBe(0)
  })

  it('USER_B DELETE A progress_entry → 0 rows affected', async () => {
    const result = await asUser(USER_B, (tx) =>
      tx`DELETE FROM public.progress_entries WHERE id = ${entryId}`,
    )
    expect(result.count).toBe(0)
  })

  it("USER_B INSERT progress_entry with A's goal_id → rejected", async () => {
    await expect(
      asUser(USER_B, (tx) => tx`
        INSERT INTO public.progress_entries (id, goal_id, delta, logged_local_date)
        VALUES (${randomUUID()}, ${sharedGoalA_id}, 1, '2026-04-02')
      `),
    ).rejects.toThrow(/row-level security/i)
  })
})

describe('goals polymorphic CHECK', () => {
  it('rejects (type=count, target_count=NULL)', async () => {
    await expect(
      asUser(USER_A, (tx) => tx`
        INSERT INTO public.goals (user_id, month, type, title, target_count, current_count)
        VALUES (${USER_A}, '2026-04-01', 'count', 'bad count', NULL, 0)
      `),
    ).rejects.toThrow(/check/i)
  })

  it('rejects (type=habit, target_days=NULL)', async () => {
    await expect(
      asUser(USER_A, (tx) => tx`
        INSERT INTO public.goals (user_id, month, type, title, target_days)
        VALUES (${USER_A}, '2026-04-01', 'habit', 'bad habit', NULL)
      `),
    ).rejects.toThrow(/check/i)
  })

  it('rejects (type=checklist, target_count=5)', async () => {
    await expect(
      asUser(USER_A, (tx) => tx`
        INSERT INTO public.goals (user_id, month, type, title, target_count, current_count)
        VALUES (${USER_A}, '2026-04-01', 'checklist', 'bad checklist', 5, 0)
      `),
    ).rejects.toThrow(/check/i)
  })
})
