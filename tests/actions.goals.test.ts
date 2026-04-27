import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// ---------------------------------------------------------------------------
// Mocks for action-layer ReadOnlyMonthError tests (tests 9-11)
// ---------------------------------------------------------------------------

// Mock services/goals so we can control what updateGoal/deleteGoal throw
const mockUpdateGoal = vi.fn()
const mockDeleteGoal = vi.fn()
const mockCreateGoal = vi.fn()

vi.mock('../src/server/services/goals', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/server/services/goals')>()
  return {
    ...original,
    createGoal: (...args: any[]) => mockCreateGoal(...args),
    updateGoal: (...args: any[]) => mockUpdateGoal(...args),
    deleteGoal: (...args: any[]) => mockDeleteGoal(...args),
  }
})

// Mock db for resolveUserTz
vi.mock('../src/server/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ timezone: 'UTC' }]),
        }),
      }),
    }),
  },
}))

// Mock supabase auth — authenticated user
vi.mock('../src/lib/supabase/server', () => ({
  getSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: '00000000-0000-0000-0000-000000000001' } },
      }),
    },
  }),
}))

describe('src/server/actions/goals.ts module exports', () => {
  it('exports all three server actions', async () => {
    const mod = await import('../src/server/actions/goals')
    expect(typeof mod.createGoalAction).toBe('function')
    expect(typeof mod.updateGoalAction).toBe('function')
    expect(typeof mod.deleteGoalAction).toBe('function')
  })
})

describe('createGoalAction Zod rejection', () => {
  it('rejects {type: "count", title: "", targetCount: 0} with invalid_input', async () => {
    const { createGoalAction } = await import('../src/server/actions/goals')
    const result = await createGoalAction({ type: 'count', title: '', targetCount: 0 } as any)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/invalid input/i)
  })
  it('rejects unknown type', async () => {
    const { createGoalAction } = await import('../src/server/actions/goals')
    const result = await createGoalAction({ type: 'other', title: 'x' } as any)
    expect(result.ok).toBe(false)
  })
})

describe('updateGoalAction / deleteGoalAction Zod rejection', () => {
  it('updateGoalAction rejects malformed goalId', async () => {
    const { updateGoalAction } = await import('../src/server/actions/goals')
    const result = await updateGoalAction({ type: 'count', goalId: 'not-a-uuid', title: 'x', targetCount: 5 } as any)
    expect(result.ok).toBe(false)
  })
  it('deleteGoalAction rejects missing goalId', async () => {
    const { deleteGoalAction } = await import('../src/server/actions/goals')
    const result = await deleteGoalAction({} as any)
    expect(result.ok).toBe(false)
  })
})

describe('ActionResult shape', () => {
  it('returns ok:false with error string on rejection', async () => {
    const { createGoalAction } = await import('../src/server/actions/goals')
    const r = await createGoalAction({} as any)
    expect(r).toHaveProperty('ok', false)
    expect(r).toHaveProperty('error')
  })
})

// ---------------------------------------------------------------------------
// Tests 9-11: Action layer ReadOnlyMonthError mapping
// ---------------------------------------------------------------------------

describe('ReadOnlyMonthError action-layer mapping', () => {
  // Zod 4 requires valid RFC 4122 UUIDs (version nibble [1-8], variant nibble [89ab])
  const VALID_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
  const VALID_UPDATE_INPUT = {
    goalId: VALID_UUID,
    type: 'count' as const,
    title: 'Updated',
    targetCount: 5,
  }
  const VALID_DELETE_INPUT = {
    goalId: VALID_UUID,
  }

  beforeEach(() => {
    mockUpdateGoal.mockReset()
    mockDeleteGoal.mockReset()
    mockCreateGoal.mockReset()
  })

  it('Test 9: updateGoalAction returns {ok:false, error:"This month is archived."} on past-month goal', async () => {
    const { ReadOnlyMonthError } = await import('../src/server/services/goals')
    mockUpdateGoal.mockRejectedValue(new ReadOnlyMonthError())
    const { updateGoalAction } = await import('../src/server/actions/goals')
    const result = await updateGoalAction(VALID_UPDATE_INPUT as any)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('This month is archived.')
  })

  it('Test 10: deleteGoalAction returns {ok:false, error:"This month is archived."} on past-month goal', async () => {
    const { ReadOnlyMonthError } = await import('../src/server/services/goals')
    mockDeleteGoal.mockRejectedValue(new ReadOnlyMonthError())
    const { deleteGoalAction } = await import('../src/server/actions/goals')
    const result = await deleteGoalAction(VALID_DELETE_INPUT as any)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('This month is archived.')
  })

  it('Test 11: updateGoalAction returns {ok:true} on future-month goal (D-09)', async () => {
    mockUpdateGoal.mockResolvedValue(undefined)
    const { updateGoalAction } = await import('../src/server/actions/goals')
    const result = await updateGoalAction(VALID_UPDATE_INPUT as any)
    expect(result.ok).toBe(true)
  })
})
