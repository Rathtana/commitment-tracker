import type { Goal } from '@/lib/progress'
import { CountCard } from './count'

export interface GoalCardHandlers {
  onCountIncrement: (goalId: string, delta: number) => void
  onCountBackfill: (goalId: string, loggedLocalDate: string, delta: number) => void
  onEdit: (goal: Goal) => void
  onDelete: (goal: Goal) => void
}

interface GoalCardProps {
  goal: Goal
  now: Date
  userTz: string
  handlers: GoalCardHandlers
}

export function GoalCard({ goal, now, userTz, handlers }: GoalCardProps) {
  switch (goal.type) {
    case 'count':
      return <CountCard goal={goal} now={now} userTz={userTz} handlers={handlers} />
    case 'checklist':
      // Plan 05 wires this
      return null
    case 'habit':
      // Plan 06 wires this
      return null
    default: {
      const _exhaustive: never = goal
      return null
    }
  }
}
