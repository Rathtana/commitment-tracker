import { TZDate } from '@date-fns/tz'
import { startOfMonth, differenceInCalendarDays, getDaysInMonth } from 'date-fns'

export type Pace = 'on-pace' | 'behind' | 'ahead' | 'warming-up'

export type Goal =
  | { id: string; type: 'count'; targetCount: number; currentCount: number; month: Date; title?: string; notes?: string; position?: string }
  | { id: string; type: 'checklist'; tasks: { isDone: boolean; id?: string; label?: string; position?: number }[]; month: Date; title?: string; notes?: string; position?: string }
  | { id: string; type: 'habit'; targetDays: number; checkIns: string[]; month: Date; title?: string; notes?: string; position?: string }

export interface ProgressSnapshot {
  percent: number
  raw: { done: number; total: number }
  expected: number
  pace: Pace
  paceDelta: number
}

function paceFromDelta(delta: number): Pace {
  if (delta < -1) return 'behind'
  if (delta > 1) return 'ahead'
  return 'on-pace'
}

export function computeProgress(
  goal: Goal,
  now: Date,
  userTz: string,
): ProgressSnapshot {
  const local = new TZDate(now.getTime(), userTz)
  const monthStart = startOfMonth(local)
  const daysElapsed = differenceInCalendarDays(local, monthStart) + 1
  const daysInMonth = getDaysInMonth(monthStart)
  const expected = Math.max(0, Math.min(1, daysElapsed / daysInMonth))

  switch (goal.type) {
    case 'count': {
      const done = goal.currentCount
      const total = goal.targetCount
      const percent = total === 0 ? 0 : Math.min(1, done / total)
      if (daysElapsed < 5) return { percent, raw: { done, total }, expected, pace: 'warming-up', paceDelta: 0 }
      const paceDelta = Math.round((percent - expected) * total)
      return { percent, raw: { done, total }, expected, pace: paceFromDelta(paceDelta), paceDelta }
    }
    case 'checklist': {
      const done = goal.tasks.filter((t) => t.isDone).length
      const total = goal.tasks.length
      const percent = total === 0 ? 0 : done / total
      return { percent, raw: { done, total }, expected, pace: 'on-pace', paceDelta: 0 }
    }
    case 'habit': {
      const done = new Set(goal.checkIns).size
      const total = goal.targetDays
      const percent = total === 0 ? 0 : Math.min(1, done / total)
      if (daysElapsed < 5) return { percent, raw: { done, total }, expected, pace: 'warming-up', paceDelta: 0 }
      const paceDelta = Math.round((percent - expected) * total)
      return { percent, raw: { done, total }, expected, pace: paceFromDelta(paceDelta), paceDelta }
    }
  }
}
