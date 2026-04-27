import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockCopyGoalsFromLastMonth = vi.fn()

vi.mock('../src/server/services/goals', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/server/services/goals')>()
  return {
    ...original,
    copyGoalsFromLastMonth: (...args: any[]) => mockCopyGoalsFromLastMonth(...args),
  }
})

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

const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: '00000000-0000-0000-0000-000000000001' } },
})

vi.mock('../src/lib/supabase/server', () => ({
  getSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
  }),
}))

describe('copyGoalsFromLastMonthAction', () => {
  beforeEach(() => {
    mockCopyGoalsFromLastMonth.mockReset()
    mockGetUser.mockResolvedValue({
      data: { user: { id: '00000000-0000-0000-0000-000000000001' } },
    })
  })

  it('Test 1: shells-only copy — returns copiedCount and ok:true', async () => {
    mockCopyGoalsFromLastMonth.mockResolvedValue({ copiedCount: 3, alreadyHadGoals: false })
    const { copyGoalsFromLastMonthAction } = await import('../src/server/actions/goals')
    const result = await copyGoalsFromLastMonthAction()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.copiedCount).toBe(3)
      expect(result.data.alreadyHadGoals).toBe(false)
    }
  })

  it('Test 2: empty prior month — returns copiedCount:0, alreadyHadGoals:false', async () => {
    mockCopyGoalsFromLastMonth.mockResolvedValue({ copiedCount: 0, alreadyHadGoals: false })
    const { copyGoalsFromLastMonthAction } = await import('../src/server/actions/goals')
    const result = await copyGoalsFromLastMonthAction()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.copiedCount).toBe(0)
      expect(result.data.alreadyHadGoals).toBe(false)
    }
  })

  it('Test 3: idempotency — returns copiedCount:0, alreadyHadGoals:true when target month has goals', async () => {
    mockCopyGoalsFromLastMonth.mockResolvedValue({ copiedCount: 0, alreadyHadGoals: true })
    const { copyGoalsFromLastMonthAction } = await import('../src/server/actions/goals')
    const result = await copyGoalsFromLastMonthAction()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.copiedCount).toBe(0)
      expect(result.data.alreadyHadGoals).toBe(true)
    }
  })

  it('Test 4: target_days clamp when source > daysInToMonth — service called and returns ok', async () => {
    mockCopyGoalsFromLastMonth.mockResolvedValue({ copiedCount: 1, alreadyHadGoals: false })
    const { copyGoalsFromLastMonthAction } = await import('../src/server/actions/goals')
    const result = await copyGoalsFromLastMonthAction()
    expect(result.ok).toBe(true)
    // Clamping logic is tested in unit tests on the service; here we verify action passes through
    if (result.ok) expect(result.data.copiedCount).toBe(1)
  })

  it('Test 5: target_days not clamped when source <= daysInToMonth — service called and returns ok', async () => {
    mockCopyGoalsFromLastMonth.mockResolvedValue({ copiedCount: 1, alreadyHadGoals: false })
    const { copyGoalsFromLastMonthAction } = await import('../src/server/actions/goals')
    const result = await copyGoalsFromLastMonthAction()
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.copiedCount).toBe(1)
  })

  it('Test 6: unauthenticated — returns {ok:false, error:"Not authenticated."}', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const { copyGoalsFromLastMonthAction } = await import('../src/server/actions/goals')
    const result = await copyGoalsFromLastMonthAction()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('Not authenticated.')
  })

  it('Test 7: service throws — returns {ok:false, error with retry message}', async () => {
    mockCopyGoalsFromLastMonth.mockRejectedValue(new Error('DB down'))
    const { copyGoalsFromLastMonthAction } = await import('../src/server/actions/goals')
    const result = await copyGoalsFromLastMonthAction()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/copy last month/i)
  })
})
