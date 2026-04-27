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
  /** Mutable handlers — required when variant is 'mutable' */
  handlers?: GoalCardHandlers
  /**
   * 'mutable'         — default; all interactive affordances live (Phase 2 current-month behavior)
   * 'read-only'       — past-month: no kebab, no handlers, no PaceChip (D-12/13/14/15)
   */
  variant?: 'mutable' | 'read-only'
  /**
   * When true (future-month context): kebab RENDERED (create/edit/delete allowed D-09),
   * but stepper/+1/checkbox/habit-cell handlers disabled with hint tooltip (D-11).
   * PaceChip hidden. Default false.
   */
  progressDisabled?: boolean
  /** Month label for tooltip when progressDisabled — e.g. 'May 2026' */
  monthYearLabel?: string
}

export function GoalCard({ goal, now, userTz, handlers, variant = 'mutable', progressDisabled = false, monthYearLabel }: GoalCardProps) {
  switch (goal.type) {
    case 'count':
      return <CountCard goal={goal} now={now} userTz={userTz} handlers={handlers} variant={variant} progressDisabled={progressDisabled} monthYearLabel={monthYearLabel} />
    case 'checklist':
      return <ChecklistCard goal={goal} now={now} userTz={userTz} handlers={handlers} variant={variant} progressDisabled={progressDisabled} monthYearLabel={monthYearLabel} />
    case 'habit':
      return <HabitCard goal={goal} now={now} userTz={userTz} handlers={handlers} variant={variant} progressDisabled={progressDisabled} monthYearLabel={monthYearLabel} />
    default: {
      const _exhaustive: never = goal
      return null
    }
  }
}
