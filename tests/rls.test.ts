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
    await asUser(USER_A, async (tx) => {
      await tx`
        INSERT INTO public.goals (id, user_id, month, type, title)
        VALUES (${goalA_id}, ${USER_A}, '2026-04-01', 'count', 'A goal')
      `
    })
    await asUser(USER_B, async (tx) => {
      await tx`
        INSERT INTO public.goals (id, user_id, month, type, title)
        VALUES (${goalB_id}, ${USER_B}, '2026-04-01', 'count', 'B goal')
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
