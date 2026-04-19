import type { Goal } from '@/lib/progress'
import { CountCard } from './count'
import { ChecklistCard } from './checklist'
import { HabitCard } from './habit'

export interface GoalCardHandlers {
  onCountIncrement: (goalId: string, delta: number) => void
  onCountBackfill: (goalId: string, loggedLocalDate: string, delta: number) => void
  onChecklistToggle: (goalId: string, taskId: string, isDone: boolean, taskLabel: string) => void
  onHabitToggle: (goalId: string, localDate: string, isChecked: boolean) => void
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
      return <ChecklistCard goal={goal} now={now} userTz={userTz} handlers={handlers} />
    case 'habit':
      return <HabitCard goal={goal} now={now} userTz={userTz} handlers={handlers} />
    default: {
      const _exhaustive: never = goal
      return null
    }
  }
}
