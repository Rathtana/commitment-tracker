/**
 * Service-layer smoke suite for ReadOnlyMonthError enforcement.
 *
 * These tests bypass the UI entirely and call services directly, proving
 * the "403 contract" from PITFALLS §Debt line 181 + line 259:
 * "enforce on the API not just the button state; test by sending a PATCH
 * to a past-month goal; must 403."
 *
 * Decision references:
 *   D-09: future-month goal CRUD is allowed
 *   D-11: future-month progress logging is blocked (current-month only)
 *   D-12: past-month layered defense (UI + service layer)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock Drizzle db — we never hit a real database in this suite
// ---------------------------------------------------------------------------

const PAST_GOAL_ID   = '00000000-0000-0000-0000-000000000001'
const CURRENT_GOAL_ID = '00000000-0000-0000-0000-000000000002'
const FUTURE_GOAL_ID  = '00000000-0000-0000-0000-000000000003'
const USER_ID         = '00000000-0000-0000-0000-000000000004'
const USER_TZ         = 'UTC'

// Freeze "now" to 2026-04-15 UTC so months are deterministic
const FROZEN_NOW = new Date('2026-04-15T12:00:00Z')
const CURRENT_MONTH = '2026-04-01'
const PAST_MONTH    = '2026-03-01'
const FUTURE_MONTH  = '2026-05-01'

vi.setSystemTime(FROZEN_NOW)

// Build a fake goal row for a given month
function makeGoal(month: string, type: 'count' | 'checklist' | 'habit' = 'count') {
  return {
    id: month === CURRENT_MONTH ? CURRENT_GOAL_ID
        : month === PAST_MONTH ? PAST_GOAL_ID
        : FUTURE_GOAL_ID,
    userId: USER_ID,
    type,
    month,
    title: 'Test goal',
    targetCount: 5,
    currentCount: 0,
    targetDays: null,
    updatedAt: FROZEN_NOW,
    createdAt: FROZEN_NOW,
  }
}

// Mock db.transaction to execute the callback with the mock tx
function makeMockTx(goalRow: ReturnType<typeof makeGoal> | null) {
  const selectBuilder = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(goalRow ? [goalRow] : []),
    innerJoin: vi.fn().mockReturnThis(),
  }
  return {
    select: vi.fn().mockReturnValue(selectBuilder),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([goalRow ?? {}]) }),
    }),
  }
}

// We'll set the mock goal per-test
let currentMockGoal: ReturnType<typeof makeGoal> | null = null

vi.mock('../src/server/db', () => ({
  db: {
    transaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => {
      const tx = makeMockTx(currentMockGoal)
      return fn(tx)
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
    }),
  },
}))

// ---------------------------------------------------------------------------
// Helpers to import services fresh per-describe
// ---------------------------------------------------------------------------

async function getGoalsService() {
  return await import('../src/server/services/goals')
}

async function getProgressService() {
  return await import('../src/server/services/progress')
}

// ---------------------------------------------------------------------------
// updateGoal enforcement
// ---------------------------------------------------------------------------

describe('ReadOnlyMonthError — updateGoal', () => {
  const validCountInput = {
    goalId: PAST_GOAL_ID,
    type: 'count' as const,
    title: 'Updated title',
    targetCount: 10,
  }

  it('Test 1: past-month goal throws ReadOnlyMonthError', async () => {
    currentMockGoal = makeGoal(PAST_MONTH, 'count')
    const { updateGoal, ReadOnlyMonthError } = await getGoalsService()
    await expect(updateGoal(USER_ID, USER_TZ, { ...validCountInput, goalId: PAST_GOAL_ID }))
      .rejects.toBeInstanceOf(ReadOnlyMonthError)
  })

  it('Test 2: current-month goal succeeds (no throw)', async () => {
    currentMockGoal = makeGoal(CURRENT_MONTH, 'count')
    const { updateGoal } = await getGoalsService()
    await expect(updateGoal(USER_ID, USER_TZ, { ...validCountInput, goalId: CURRENT_GOAL_ID }))
      .resolves.not.toThrow()
  })

  it('Test 3: future-month goal succeeds (D-09 — future goal CRUD allowed)', async () => {
    currentMockGoal = makeGoal(FUTURE_MONTH, 'count')
    const { updateGoal } = await getGoalsService()
    await expect(updateGoal(USER_ID, USER_TZ, { ...validCountInput, goalId: FUTURE_GOAL_ID }))
      .resolves.not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// deleteGoal enforcement
// ---------------------------------------------------------------------------

describe('ReadOnlyMonthError — deleteGoal', () => {
  it('Test 4: past-month goal throws ReadOnlyMonthError', async () => {
    currentMockGoal = makeGoal(PAST_MONTH, 'count')
    const { deleteGoal, ReadOnlyMonthError } = await getGoalsService()
    await expect(deleteGoal(USER_ID, USER_TZ, PAST_GOAL_ID))
      .rejects.toBeInstanceOf(ReadOnlyMonthError)
  })

  it('Test 5: current-month goal succeeds', async () => {
    currentMockGoal = makeGoal(CURRENT_MONTH, 'count')
    const { deleteGoal } = await getGoalsService()
    await expect(deleteGoal(USER_ID, USER_TZ, CURRENT_GOAL_ID))
      .resolves.not.toThrow()
  })

  it('Test 6: future-month goal succeeds (D-09)', async () => {
    currentMockGoal = makeGoal(FUTURE_MONTH, 'count')
    const { deleteGoal } = await getGoalsService()
    await expect(deleteGoal(USER_ID, USER_TZ, FUTURE_GOAL_ID))
      .resolves.not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// incrementCount enforcement — D-11 (progress is current-month only)
// ---------------------------------------------------------------------------

describe('ReadOnlyMonthError — incrementCount (progress service)', () => {
  const validInput = {
    goalId: FUTURE_GOAL_ID,
    delta: 1,
    undoId: '00000000-0000-0000-0000-000000000099',
  }

  it('Test 7: future-month goal throws ReadOnlyMonthError (D-11 — progress current-month only)', async () => {
    currentMockGoal = makeGoal(FUTURE_MONTH, 'count')
    const { incrementCount, ReadOnlyMonthError } = await getProgressService()
    await expect(incrementCount(USER_ID, USER_TZ, { ...validInput, goalId: FUTURE_GOAL_ID }))
      .rejects.toBeInstanceOf(ReadOnlyMonthError)
  })

  it('Test 8: past-month goal throws ReadOnlyMonthError', async () => {
    currentMockGoal = makeGoal(PAST_MONTH, 'count')
    const { incrementCount, ReadOnlyMonthError } = await getProgressService()
    await expect(incrementCount(USER_ID, USER_TZ, { ...validInput, goalId: PAST_GOAL_ID }))
      .rejects.toBeInstanceOf(ReadOnlyMonthError)
  })
})
