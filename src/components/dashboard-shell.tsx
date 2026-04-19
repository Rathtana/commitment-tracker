'use client'

import { useOptimistic, useCallback } from 'react'
import type { Goal } from '@/lib/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProgressBar } from '@/components/progress-bar'
import { PaceChip } from '@/components/pace-chip'
import { computeProgress } from '@/lib/progress'

// Discriminated action union — Waves 3/4/5 use dispatch from matching card components.
export type DashboardAction =
  | { type: 'count:increment'; goalId: string; delta: number }
  | { type: 'checklist:toggle'; goalId: string; taskId: string; isDone: boolean }
  | { type: 'habit:toggle'; goalId: string; localDate: string; isChecked: boolean }

export function dashboardReducer(current: Goal[], action: DashboardAction): Goal[] {
  switch (action.type) {
    case 'count:increment':
      return current.map((g) =>
        g.id === action.goalId && g.type === 'count'
          ? { ...g, currentCount: Math.max(0, g.currentCount + action.delta) }
          : g,
      )
    case 'checklist:toggle':
      return current.map((g) =>
        g.id === action.goalId && g.type === 'checklist'
          ? {
              ...g,
              tasks: g.tasks.map((t) =>
                (t as { id?: string }).id === action.taskId ? { ...t, isDone: action.isDone } : t,
              ),
            }
          : g,
      )
    case 'habit:toggle':
      return current.map((g) => {
        if (g.id !== action.goalId || g.type !== 'habit') return g
        const set = new Set(g.checkIns)
        if (action.isChecked) set.add(action.localDate)
        else set.delete(action.localDate)
        return { ...g, checkIns: Array.from(set).sort() }
      })
    default: {
      const _exhaustive: never = action
      return current
    }
  }
}

interface DashboardShellProps {
  initialGoals: Goal[]
  userTz: string
  nowIso: string
}

export function DashboardShell({ initialGoals, userTz, nowIso }: DashboardShellProps) {
  const [goals, dispatch] = useOptimistic(initialGoals, dashboardReducer)
  const now = new Date(nowIso)

  // Handlers wired in Waves 3-5. Exposed via context or prop-drilling; for Wave 1 a no-op placeholder.
  const handleCountIncrement = useCallback(
    (_goalId: string, _delta: number) => {
      // Plan 02-04 wires incrementCountAction + startTransition + Sonner toast.
    },
    [],
  )

  void handleCountIncrement // referenced to suppress unused-var lint warning

  return (
    <section className="flex flex-col gap-4" aria-label="Your goals">
      {goals.map((goal) => {
        const snap = computeProgress(goal, now, userTz)
        const title = (goal as { title?: string }).title ?? 'Goal'
        return (
          <Card key={goal.id}>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">{title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <ProgressBar
                  percent={snap.percent}
                  expected={snap.pace === 'warming-up' ? undefined : snap.expected}
                  ariaLabel={`${title}: ${snap.raw.done} of ${snap.raw.total} (${Math.round(snap.percent * 100)}%)`}
                  className="flex-1"
                />
                <PaceChip
                  pace={snap.pace}
                  paceDelta={snap.paceDelta}
                  suppressForChecklist={goal.type === 'checklist'}
                />
              </div>
              <p className="text-right text-xs tabular-nums text-muted-foreground">
                {snap.raw.done} of {snap.raw.total}
              </p>
              {/* Type-specific surface placeholder — Waves 3/4/5 replace with <CountCard>/<ChecklistCard>/<HabitCard> */}
            </CardContent>
          </Card>
        )
      })}
      {/* Wave 3-5 will import GoalCard/index.tsx and render per-type surfaces here instead */}
    </section>
  )
}
