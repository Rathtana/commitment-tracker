import { describe, it, expect, vi } from 'vitest'

vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('src/server/actions/progress.ts exports', () => {
  it('exports incrementCountAction, backfillCountAction, undoLastMutationAction', async () => {
    const mod = await import('../src/server/actions/progress')
    expect(typeof mod.incrementCountAction).toBe('function')
    expect(typeof mod.backfillCountAction).toBe('function')
    expect(typeof mod.undoLastMutationAction).toBe('function')
  })
})

describe('Zod rejection before side effects', () => {
  it('incrementCountAction rejects {delta: 0}', async () => {
    const { incrementCountAction } = await import('../src/server/actions/progress')
    const r = await incrementCountAction({ goalId: '00000000-0000-0000-0000-000000000000', delta: 0, undoId: '00000000-0000-0000-0000-000000000001' } as any)
    expect(r.ok).toBe(false)
  })
  it('incrementCountAction rejects malformed goalId', async () => {
    const { incrementCountAction } = await import('../src/server/actions/progress')
    const r = await incrementCountAction({ goalId: 'not-uuid', delta: 1, undoId: '00000000-0000-0000-0000-000000000001' } as any)
    expect(r.ok).toBe(false)
  })
  it('backfillCountAction rejects invalid ISO date', async () => {
    const { backfillCountAction } = await import('../src/server/actions/progress')
    const r = await backfillCountAction({ goalId: '00000000-0000-0000-0000-000000000000', loggedLocalDate: '4/1/2026', delta: 1, undoId: '00000000-0000-0000-0000-000000000001' } as any)
    expect(r.ok).toBe(false)
  })
  it('undoLastMutationAction rejects missing undoId', async () => {
    const { undoLastMutationAction } = await import('../src/server/actions/progress')
    const r = await undoLastMutationAction({} as any)
    expect(r.ok).toBe(false)
  })
})

describe('toggleTaskAction', () => {
  it('is exported', async () => {
    const mod = await import('../src/server/actions/progress')
    expect(typeof mod.toggleTaskAction).toBe('function')
  })
  it('rejects malformed input', async () => {
    const { toggleTaskAction } = await import('../src/server/actions/progress')
    const r = await toggleTaskAction({ goalId: 'bad', taskId: 'bad', isDone: 'yes' } as any)
    expect(r.ok).toBe(false)
  })
})

describe('undo extension for tasks', () => {
  it('undoLastMutationAction still rejects malformed undoId', async () => {
    const { undoLastMutationAction } = await import('../src/server/actions/progress')
    const r = await undoLastMutationAction({} as any)
    expect(r.ok).toBe(false)
  })
})

describe('upsertHabitCheckInAction', () => {
  it('is exported', async () => {
    const mod = await import('../src/server/actions/progress')
    expect(typeof mod.upsertHabitCheckInAction).toBe('function')
  })
  it('rejects malformed checkInDate', async () => {
    const { upsertHabitCheckInAction } = await import('../src/server/actions/progress')
    const r = await upsertHabitCheckInAction({
      goalId: '00000000-0000-0000-0000-000000000000',
      checkInDate: '4/1/2026',
      isChecked: true,
      undoId: '00000000-0000-0000-0000-000000000001',
    } as any)
    expect(r.ok).toBe(false)
  })
  it('rejects missing undoId', async () => {
    const { upsertHabitCheckInAction } = await import('../src/server/actions/progress')
    const r = await upsertHabitCheckInAction({
      goalId: '00000000-0000-0000-0000-000000000000',
      checkInDate: '2026-04-01',
      isChecked: true,
    } as any)
    expect(r.ok).toBe(false)
  })
})
