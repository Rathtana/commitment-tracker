'use client'

import { useOptimistic, useCallback, useState } from 'react'
import { Plus, MoreHorizontal } from 'lucide-react'
import type { Goal } from '@/lib/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ProgressBar } from '@/components/progress-bar'
import { PaceChip } from '@/components/pace-chip'
import { computeProgress } from '@/lib/progress'
import { CreateGoalDialog } from '@/components/create-goal-dialog'
import { DeleteGoalDialog } from '@/components/delete-goal-dialog'

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

// ---- NewGoalButton: client component that opens the CreateGoalDialog ----
interface NewGoalButtonProps {
  daysInMonthDefault: number
  className?: string
}

export function NewGoalButton({ daysInMonthDefault, className }: NewGoalButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)} className={className}>
        <Plus className="mr-2 h-4 w-4" /> New goal
      </Button>
      <CreateGoalDialog
        open={open}
        onOpenChange={setOpen}
        daysInMonthDefault={daysInMonthDefault}
      />
    </>
  )
}

// ---- DashboardShell ----
interface DashboardShellProps {
  initialGoals: Goal[]
  userTz: string
  nowIso: string
  daysInMonthDefault: number
}

export function DashboardShell({ initialGoals, userTz, nowIso, daysInMonthDefault }: DashboardShellProps) {
  const [goals, dispatch] = useOptimistic(initialGoals, dashboardReducer)
  const now = new Date(nowIso)

  // Dialog state for create/edit/delete
  const [createOpen, setCreateOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Parameters<typeof CreateGoalDialog>[0]['editing']>(null)
  const [deletingGoal, setDeletingGoal] = useState<{ id: string; title: string } | null>(null)

  // Handlers wired in Waves 3-5. Exposed via context or prop-drilling; for Wave 1 a no-op placeholder.
  const handleCountIncrement = useCallback(
    (_goalId: string, _delta: number) => {
      // Plan 02-04 wires incrementCountAction + startTransition + Sonner toast.
    },
    [],
  )

  void handleCountIncrement // referenced to suppress unused-var lint warning

  function buildEditingGoal(goal: Goal): Parameters<typeof CreateGoalDialog>[0]['editing'] {
    const base = {
      goalId: goal.id,
      title: (goal as { title?: string }).title ?? '',
      notes: (goal as { notes?: string }).notes,
    }
    if (goal.type === 'count') {
      return { ...base, type: 'count', targetCount: goal.targetCount }
    }
    if (goal.type === 'habit') {
      return { ...base, type: 'habit', targetDays: goal.targetDays }
    }
    // checklist
    return {
      ...base,
      type: 'checklist',
      tasks: goal.tasks.map((t, idx) => ({
        label: (t as { label?: string }).label ?? '',
        position: (t as { position?: number }).position ?? idx,
      })),
    }
  }

  return (
    <>
      <section className="flex flex-col gap-4" aria-label="Your goals">
        {goals.map((goal) => {
          const snap = computeProgress(goal, now, userTz)
          const title = (goal as { title?: string }).title ?? 'Goal'
          return (
            <Card key={goal.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold">{title}</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Options for ${title}`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setEditingGoal(buildEditingGoal(goal))
                        setCreateOpen(true)
                      }}
                    >
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setDeletingGoal({ id: goal.id, title })}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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

      {/* Create / Edit dialog */}
      <CreateGoalDialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o)
          if (!o) setEditingGoal(null)
        }}
        editing={editingGoal}
        daysInMonthDefault={daysInMonthDefault}
      />

      {/* Delete dialog */}
      {deletingGoal && (
        <DeleteGoalDialog
          open={Boolean(deletingGoal)}
          onOpenChange={(o) => { if (!o) setDeletingGoal(null) }}
          goalId={deletingGoal.id}
          goalTitle={deletingGoal.title}
          onDeleted={() => setDeletingGoal(null)}
        />
      )}
    </>
  )
}
