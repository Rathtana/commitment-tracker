'use client'

import { MoreHorizontal, ListChecks } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { ProgressBar } from '@/components/progress-bar'
import { PaceChip } from '@/components/pace-chip'
import { computeProgress, type Goal } from '@/lib/progress'
import { cn } from '@/lib/utils'
import type { GoalCardHandlers } from './index'

type ChecklistGoal = Extract<Goal, { type: 'checklist' }>

interface ChecklistCardProps {
  goal: ChecklistGoal
  now: Date
  userTz: string
  handlers: GoalCardHandlers
}

export function ChecklistCard({ goal, now, userTz, handlers }: ChecklistCardProps) {
  const snap = computeProgress(goal, now, userTz)
  const title = (goal as { title?: string }).title ?? 'Goal'
  const ariaLabel = `${title}: ${snap.raw.done} of ${snap.raw.total} done (${Math.round(snap.percent * 100)}%)`

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <ListChecks className="h-4 w-4 text-primary" /> {title}
        </CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Goal actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handlers.onEdit(goal as Goal)}>Edit</DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => handlers.onDelete(goal as Goal)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <ProgressBar percent={snap.percent} ariaLabel={ariaLabel} className="flex-1" />
          <PaceChip pace={snap.pace} paceDelta={snap.paceDelta} suppressForChecklist />
        </div>

        {goal.tasks.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">No tasks yet. Edit this goal to add some.</p>
        ) : (
          <ul className="flex flex-col">
            {goal.tasks.map((t) => {
              const taskId = t.id ?? ''
              const taskLabel = (t as { label?: string }).label ?? ''
              return (
                <li key={taskId || taskLabel} className="flex min-h-11 items-center gap-3 py-2">
                  <Checkbox
                    id={`task-${taskId}`}
                    checked={t.isDone}
                    onCheckedChange={(v) =>
                      taskId &&
                      handlers.onChecklistToggle(goal.id, taskId, Boolean(v), taskLabel)
                    }
                    aria-label={taskLabel || undefined}
                  />
                  <Label
                    htmlFor={`task-${taskId}`}
                    className={cn(
                      'flex-1 cursor-pointer text-sm',
                      t.isDone && 'font-normal text-muted-foreground line-through',
                    )}
                  >
                    {taskLabel}
                  </Label>
                </li>
              )
            })}
          </ul>
        )}

        <p className="text-right text-xs tabular-nums text-muted-foreground">
          {snap.raw.done} of {snap.raw.total} done
        </p>
      </CardContent>
    </Card>
  )
}
