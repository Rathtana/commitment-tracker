'use client'

import { MoreHorizontal, Flame } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { ProgressBar } from '@/components/progress-bar'
import { PaceChip } from '@/components/pace-chip'
import { HabitGrid } from '@/components/habit-grid'
import { computeProgress, type Goal } from '@/lib/progress'
import type { GoalCardHandlers } from './index'

type HabitGoal = Extract<Goal, { type: 'habit' }>

interface HabitCardProps {
  goal: HabitGoal
  now: Date
  userTz: string
  handlers: GoalCardHandlers
}

export function HabitCard({ goal, now, userTz, handlers }: HabitCardProps) {
  const snap = computeProgress(goal, now, userTz)
  const title = (goal as { title?: string }).title ?? 'Goal'
  const ariaLabel = `${title}: ${snap.raw.done} of ${snap.raw.total} days this month (${Math.round(snap.percent * 100)}%)`

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Flame className="h-4 w-4 text-primary" /> {title}
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
          <ProgressBar
            percent={snap.percent}
            expected={snap.pace === 'warming-up' ? undefined : snap.expected}
            ariaLabel={ariaLabel}
            className="flex-1"
          />
          <PaceChip pace={snap.pace} paceDelta={snap.paceDelta} />
        </div>

        <HabitGrid
          month={goal.month}
          checkIns={goal.checkIns}
          now={now}
          userTz={userTz}
          onToggle={(iso, willBeChecked) => handlers.onHabitToggle(goal.id, iso, willBeChecked)}
        />

        <p className="text-right text-xs tabular-nums text-muted-foreground">
          {snap.raw.done} of {snap.raw.total} days this month
        </p>
      </CardContent>
    </Card>
  )
}
