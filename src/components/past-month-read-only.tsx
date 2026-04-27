import type { Goal } from '@/lib/progress'
import { GoalCard } from '@/components/goal-card'

interface Props {
  goals: Goal[]
  now: Date
  userTz: string
}

/**
 * Frozen past-month goal list — no DashboardShell, no useOptimistic, no mutation handlers.
 * Per D-13, D-14, D-15 + UI-SPEC §Past-Month Read-Only Rendering.
 */
export function PastMonthReadOnly({ goals, now, userTz }: Props) {
  return (
    <section className="flex flex-col gap-4" aria-label="Your goals (archived)">
      {goals.map((goal) => (
        <GoalCard
          key={goal.id}
          goal={goal}
          now={now}
          userTz={userTz}
          variant="read-only"
        />
      ))}
    </section>
  )
}
