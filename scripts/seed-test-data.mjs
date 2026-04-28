/**
 * One-time seed: populates March + February 2026 with test goals for UAT.
 * Run: node scripts/seed-test-data.mjs
 * Requires DATABASE_URL in env (set -a; source .env.local; set +a).
 */
import postgres from 'postgres'

const USER_ID = '76a9f1a1-908d-4429-85ad-310fedffca2d'
const DB_URL  = process.env.DATABASE_URL
if (!DB_URL) {
  console.error('Missing DATABASE_URL. Run: set -a; source .env.local; set +a')
  process.exit(1)
}

const sql = postgres(DB_URL, { max: 1 })

async function seed() {
  // ── March 2026 ──────────────────────────────────────────────────────────
  console.log('Seeding March 2026...')

  // Count goal: Read books (3/5)
  const [countGoal] = await sql`
    INSERT INTO goals (user_id, month, title, type, position, target_count, current_count)
    VALUES (${USER_ID}, '2026-03-01', 'Read books', 'count', 0, 5, 3)
    ON CONFLICT DO NOTHING
    RETURNING id
  `
  if (countGoal) console.log('  ✓ count goal: Read books')
  else console.log('  – count goal already exists, skipping')

  // Checklist goal: Home tasks (2/3 done)
  const [checklistGoal] = await sql`
    INSERT INTO goals (user_id, month, title, type, position)
    VALUES (${USER_ID}, '2026-03-01', 'Home tasks', 'checklist', 1)
    ON CONFLICT DO NOTHING
    RETURNING id
  `
  if (checklistGoal) {
    await sql`
      INSERT INTO tasks (goal_id, label, is_done, position) VALUES
        (${checklistGoal.id}, 'Clean garage',     true,  0),
        (${checklistGoal.id}, 'Fix leaky faucet', true,  1),
        (${checklistGoal.id}, 'Repaint fence',    false, 2)
    `
    console.log('  ✓ checklist goal: Home tasks (3 tasks)')
  } else {
    console.log('  – checklist goal already exists, skipping')
  }

  // Habit goal: Daily walk (20/31 days)
  const [habitGoal] = await sql`
    INSERT INTO goals (user_id, month, title, type, position, target_days)
    VALUES (${USER_ID}, '2026-03-01', 'Daily walk', 'habit', 2, 31)
    ON CONFLICT DO NOTHING
    RETURNING id
  `
  if (habitGoal) {
    const checkIns = Array.from({ length: 20 }, (_, i) => ({
      goal_id: habitGoal.id,
      check_in_date: `2026-03-${String(i + 1).padStart(2, '0')}`,
    }))
    await sql`INSERT INTO habit_check_ins ${sql(checkIns)}`
    console.log('  ✓ habit goal: Daily walk (20 check-ins)')
  } else {
    console.log('  – habit goal already exists, skipping')
  }

  // ── February 2026 ────────────────────────────────────────────────────────
  console.log('Seeding February 2026...')

  const [febGoal] = await sql`
    INSERT INTO goals (user_id, month, title, type, position, target_count, current_count)
    VALUES (${USER_ID}, '2026-02-01', 'Write journal entries', 'count', 0, 20, 14)
    ON CONFLICT DO NOTHING
    RETURNING id
  `
  if (febGoal) console.log('  ✓ count goal: Write journal entries')
  else console.log('  – Feb goal already exists, skipping')

  console.log('Done.')
  await sql.end()
}

seed().catch(e => { console.error(e); process.exit(1) })
