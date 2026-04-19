import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

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
