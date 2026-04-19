import { describe, it, expect } from 'vitest'
import {
  createGoalSchema,
  updateGoalSchema,
  incrementCountSchema,
  toggleTaskSchema,
  upsertHabitCheckInSchema,
  backfillCountSchema,
  undoLastMutationSchema,
} from '../src/lib/schemas/goals'

// Nil UUID is always valid per RFC 4122 (special-cased in Zod 4 pattern)
const VALID_UUID = '00000000-0000-0000-0000-000000000000'
// Use a proper v4 UUID for the second constant (Zod 4 enforces RFC 4122 version + variant nibbles)
const VALID_UUID_2 = 'a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0'

describe('createGoalSchema — count branch', () => {
  it('accepts valid count goal', () => {
    const result = createGoalSchema.safeParse({ type: 'count', title: 'Read books', targetCount: 5 })
    expect(result.success).toBe(true)
  })

  it('rejects count goal missing targetCount', () => {
    const result = createGoalSchema.safeParse({ type: 'count', title: 'Read books' })
    expect(result.success).toBe(false)
  })

  it('rejects targetCount=0 with UI-SPEC copy', () => {
    const result = createGoalSchema.safeParse({ type: 'count', title: 'x', targetCount: 0 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path.includes('targetCount'))?.message
      expect(msg).toBe('Target must be greater than 0')
    }
  })

  it('rejects empty title with UI-SPEC copy', () => {
    const result = createGoalSchema.safeParse({ type: 'count', title: '', targetCount: 5 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path.includes('title'))?.message
      expect(msg).toBe('Name is required')
    }
  })

  it('accepts optional notes field', () => {
    const result = createGoalSchema.safeParse({ type: 'count', title: 'Read', targetCount: 5, notes: 'Any book counts' })
    expect(result.success).toBe(true)
  })
})

describe('createGoalSchema — checklist branch', () => {
  it('accepts valid checklist goal with ≥1 task', () => {
    const result = createGoalSchema.safeParse({
      type: 'checklist',
      title: 'My checklist',
      tasks: [{ label: 'Task 1', position: 0 }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty tasks array with "Add at least one task."', () => {
    const result = createGoalSchema.safeParse({
      type: 'checklist',
      title: 'My checklist',
      tasks: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path.includes('tasks'))?.message
      expect(msg).toBe('Add at least one task.')
    }
  })

  it('rejects task with empty label', () => {
    const result = createGoalSchema.safeParse({
      type: 'checklist',
      title: 'My checklist',
      tasks: [{ label: '', position: 0 }],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path.includes('label'))?.message
      expect(msg).toBe('Task name is required')
    }
  })

  it('accepts multiple tasks', () => {
    const result = createGoalSchema.safeParse({
      type: 'checklist',
      title: 'Shopping',
      tasks: [
        { label: 'Milk', position: 0 },
        { label: 'Eggs', position: 1 },
        { label: 'Bread', position: 2 },
      ],
    })
    expect(result.success).toBe(true)
  })
})

describe('createGoalSchema — habit branch', () => {
  it('accepts valid habit goal', () => {
    const result = createGoalSchema.safeParse({ type: 'habit', title: 'Exercise', targetDays: 20 })
    expect(result.success).toBe(true)
  })

  it('rejects targetDays=0 with UI-SPEC copy', () => {
    const result = createGoalSchema.safeParse({ type: 'habit', title: 'x', targetDays: 0 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path.includes('targetDays'))?.message
      expect(msg).toBe('Goal must be at least 1')
    }
  })

  it('rejects targetDays=32 with UI-SPEC copy', () => {
    const result = createGoalSchema.safeParse({ type: 'habit', title: 'x', targetDays: 32 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path.includes('targetDays'))?.message
      expect(msg).toBe('Goal can be at most 31')
    }
  })

  it('accepts targetDays=31 (max valid)', () => {
    const result = createGoalSchema.safeParse({ type: 'habit', title: 'Daily', targetDays: 31 })
    expect(result.success).toBe(true)
  })
})

describe('createGoalSchema — discriminator rejects cross-type pollution', () => {
  it('rejects {type: "count", tasks: [...]} when targetCount missing (real discriminator test)', () => {
    // Extra `tasks` field is ignored by discriminated union (object branches are not strict by default)
    const r = createGoalSchema.safeParse({ type: 'count', title: 'x', targetCount: 5, tasks: [{ label: 'a', position: 0 }] })
    expect(r.success).toBe(true)
    // REAL discriminator test: missing required field for the selected branch fails
    const r2 = createGoalSchema.safeParse({ type: 'count', title: 'x', tasks: [{ label: 'a', position: 0 }] })
    expect(r2.success).toBe(false)
  })

  it('rejects unknown type', () => {
    const result = createGoalSchema.safeParse({ type: 'other', title: 'x' } as never)
    expect(result.success).toBe(false)
  })

  it('rejects missing type field entirely', () => {
    const result = createGoalSchema.safeParse({ title: 'x', targetCount: 5 } as never)
    expect(result.success).toBe(false)
  })
})

describe('updateGoalSchema', () => {
  it('requires goalId in addition to create fields', () => {
    // Without goalId → fails
    const r1 = updateGoalSchema.safeParse({ type: 'count', title: 'Read', targetCount: 5 })
    expect(r1.success).toBe(false)

    // With goalId → succeeds
    const r2 = updateGoalSchema.safeParse({ type: 'count', title: 'Read', targetCount: 5, goalId: VALID_UUID })
    expect(r2.success).toBe(true)
  })

  it('rejects malformed goalId UUID', () => {
    const result = updateGoalSchema.safeParse({ type: 'count', title: 'Read', targetCount: 5, goalId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('incrementCountSchema', () => {
  it('rejects delta=0', () => {
    const result = incrementCountSchema.safeParse({ goalId: VALID_UUID, delta: 0, undoId: VALID_UUID_2 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path.includes('delta'))?.message
      expect(msg).toBe('Delta cannot be zero')
    }
  })

  it('accepts positive delta', () => {
    const result = incrementCountSchema.safeParse({ goalId: VALID_UUID, delta: 1, undoId: VALID_UUID_2 })
    expect(result.success).toBe(true)
  })

  it('accepts negative delta (stepper correction)', () => {
    const result = incrementCountSchema.safeParse({ goalId: VALID_UUID, delta: -1, undoId: VALID_UUID_2 })
    expect(result.success).toBe(true)
  })

  it('requires undoId as valid uuid', () => {
    const result = incrementCountSchema.safeParse({ goalId: VALID_UUID, delta: 1, undoId: 'not-uuid' })
    expect(result.success).toBe(false)
  })
})

describe('toggleTaskSchema / upsertHabitCheckInSchema / backfillCountSchema / undoLastMutationSchema', () => {
  it('toggleTaskSchema accepts valid input', () => {
    const result = toggleTaskSchema.safeParse({ goalId: VALID_UUID, taskId: VALID_UUID_2, isDone: true, undoId: VALID_UUID })
    expect(result.success).toBe(true)
  })

  it('toggleTaskSchema rejects malformed goalId', () => {
    const result = toggleTaskSchema.safeParse({ goalId: 'bad', taskId: VALID_UUID_2, isDone: true, undoId: VALID_UUID })
    expect(result.success).toBe(false)
  })

  it('upsertHabitCheckInSchema accepts valid input', () => {
    const result = upsertHabitCheckInSchema.safeParse({
      goalId: VALID_UUID,
      checkInDate: '2026-04-15',
      isChecked: true,
      undoId: VALID_UUID_2,
    })
    expect(result.success).toBe(true)
  })

  it('upsertHabitCheckInSchema rejects invalid date format', () => {
    const result = upsertHabitCheckInSchema.safeParse({
      goalId: VALID_UUID,
      checkInDate: '04/15/2026',
      isChecked: true,
      undoId: VALID_UUID_2,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path.includes('checkInDate'))?.message
      expect(msg).toBe('Invalid date')
    }
  })

  it('backfillCountSchema accepts valid input', () => {
    const result = backfillCountSchema.safeParse({
      goalId: VALID_UUID,
      loggedLocalDate: '2026-04-10',
      delta: 2,
      undoId: VALID_UUID_2,
    })
    expect(result.success).toBe(true)
  })

  it('backfillCountSchema rejects invalid loggedLocalDate format', () => {
    const result = backfillCountSchema.safeParse({
      goalId: VALID_UUID,
      loggedLocalDate: '04/01/2026',
      delta: 1,
      undoId: VALID_UUID_2,
    })
    expect(result.success).toBe(false)
  })

  it('undoLastMutationSchema accepts valid uuid', () => {
    const result = undoLastMutationSchema.safeParse({ undoId: VALID_UUID })
    expect(result.success).toBe(true)
  })

  it('undoLastMutationSchema rejects malformed undoId', () => {
    const result = undoLastMutationSchema.safeParse({ undoId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})
