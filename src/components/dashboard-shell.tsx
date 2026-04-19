'use client'

import { useOptimistic, useCallback, useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { Goal } from '@/lib/progress'
import { Button } from '@/components/ui/button'
import { CreateGoalDialog } from '@/components/create-goal-dialog'
import { DeleteGoalDialog } from '@/components/delete-goal-dialog'
import { GoalCard } from '@/components/goal-card'
import { incrementCountAction, backfillCountAction, undoLastMutationAction, toggleTaskAction, upsertHabitCheckInAction } from '@/server/actions/progress'
import { format } from 'date-fns'

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
  size?: 'default' | 'lg'
  label?: string
}

export function NewGoalButton({
  daysInMonthDefault,
  className,
  size = 'default',
  label = 'New goal',
}: NewGoalButtonProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size={size} onClick={() => setOpen(true)} className={className}>
        <Plus className="mr-2 h-4 w-4" /> {label}
      </Button>
      <CreateGoalDialog open={open} onOpenChange={setOpen} daysInMonthDefault={daysInMonthDefault} />
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
  const [isPending, startTransition] = useTransition()
  const now = new Date(nowIso)

  // Dialog state for create/edit/delete
  const [createOpen, setCreateOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Parameters<typeof CreateGoalDialog>[0]['editing']>(null)
  const [deletingGoal, setDeletingGoal] = useState<{ id: string; title: string } | null>(null)

  void isPending // suppress unused-var lint warning

  function showUndoToast(label: string, undoId: string, optimisticRollback: () => void) {
    toast(label, {
      id: 'progress-undo',      // D-34: single id — most-recent-only (replaces, not stacks)
      duration: 6000,           // D-32: 6-second undo window
      action: {
        label: 'Undo',
        onClick: () => {
          startTransition(async () => {
            optimisticRollback()
            await undoLastMutationAction({ undoId })
          })
        },
      },
    })
  }

  const handleCountIncrement = useCallback(
    (goalId: string, delta: number) => {
      const undoId = crypto.randomUUID()
      const goal = goals.find((g) => g.id === goalId) as Extract<Goal, { type: 'count' }> | undefined
      startTransition(async () => {
        dispatch({ type: 'count:increment', goalId, delta })
        const result = await incrementCountAction({ goalId, delta, undoId })
        if (!result.ok) {
          toast.error(result.error ?? "Couldn't save that change. Try again.")
          return
        }
        const sign = delta > 0 ? '+' : '\u2212'
        showUndoToast(
          `Logged ${sign}${Math.abs(delta)} on ${(goal as { title?: string } | undefined)?.title ?? 'goal'}`,
          undoId,
          () => dispatch({ type: 'count:increment', goalId, delta: -delta }),
        )
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goals],
  )

  const handleCountBackfill = useCallback(
    (goalId: string, loggedLocalDate: string, delta: number) => {
      const undoId = crypto.randomUUID()
      const goal = goals.find((g) => g.id === goalId) as Extract<Goal, { type: 'count' }> | undefined
      startTransition(async () => {
        dispatch({ type: 'count:increment', goalId, delta })
        const result = await backfillCountAction({ goalId, loggedLocalDate, delta, undoId })
        if (!result.ok) {
          toast.error(result.error ?? "Couldn't save that change. Try again.")
          return
        }
        showUndoToast(
          `Logged +${delta} on ${(goal as { title?: string } | undefined)?.title ?? 'goal'} \u00b7 ${loggedLocalDate}`,
          undoId,
          () => dispatch({ type: 'count:increment', goalId, delta: -delta }),
        )
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goals],
  )

  const handleChecklistToggle = useCallback(
    (goalId: string, taskId: string, isDone: boolean, taskLabel: string) => {
      const undoId = crypto.randomUUID()
      startTransition(async () => {
        dispatch({ type: 'checklist:toggle', goalId, taskId, isDone })
        const result = await toggleTaskAction({ goalId, taskId, isDone, undoId })
        if (!result.ok) {
          toast.error(result.error ?? "Couldn't save that change. Try again.")
          return
        }
        const verb = isDone ? 'Checked' : 'Unchecked'
        showUndoToast(`${verb} "${taskLabel}"`, undoId, () => {
          dispatch({ type: 'checklist:toggle', goalId, taskId, isDone: !isDone })
        })
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goals],
  )

  const handleHabitToggle = useCallback(
    (goalId: string, localDate: string, isChecked: boolean) => {
      const undoId = crypto.randomUUID()
      const goal = goals.find((g) => g.id === goalId) as (Extract<Goal, { type: 'habit' }> & { title?: string }) | undefined
      const todayStrLocal = format(new Date(nowIso), 'yyyy-MM-dd')
      startTransition(async () => {
        dispatch({ type: 'habit:toggle', goalId, localDate, isChecked })
        const result = await upsertHabitCheckInAction({ goalId, checkInDate: localDate, isChecked, undoId })
        if (!result.ok) {
          toast.error(result.error ?? "Couldn't save that change. Try again.")
          return
        }

        const isBackfill = localDate !== todayStrLocal
        let copy: string
        if (isBackfill && isChecked) copy = `Marked ${localDate} on ${goal?.title ?? 'goal'}`
        else if (isBackfill && !isChecked) copy = `Unmarked ${localDate} on ${goal?.title ?? 'goal'}`
        else if (!isBackfill && isChecked) copy = `Marked today on ${goal?.title ?? 'goal'}`
        else copy = `Unmarked today on ${goal?.title ?? 'goal'}`

        showUndoToast(copy, undoId, () => {
          dispatch({ type: 'habit:toggle', goalId, localDate, isChecked: !isChecked })
        })
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goals, nowIso],
  )

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

  const handlers = {
    onCountIncrement: handleCountIncrement,
    onCountBackfill: handleCountBackfill,
    onChecklistToggle: handleChecklistToggle,
    onHabitToggle: handleHabitToggle,
    onEdit: (goal: Goal) => {
      setEditingGoal(buildEditingGoal(goal))
      setCreateOpen(true)
    },
    onDelete: (goal: Goal) => {
      setDeletingGoal({ id: goal.id, title: (goal as { title?: string }).title ?? 'goal' })
    },
  }

  return (
    <>
      <section className="flex flex-col gap-4" aria-label="Your goals">
        {goals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} now={now} userTz={userTz} handlers={handlers} />
        ))}
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
          onOpenChange={(o) => {
            if (!o) setDeletingGoal(null)
          }}
          goalId={deletingGoal.id}
          goalTitle={deletingGoal.title}
          onDeleted={() => setDeletingGoal(null)}
        />
      )}
    </>
  )
}
