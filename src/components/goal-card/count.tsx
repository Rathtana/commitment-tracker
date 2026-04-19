'use client'

import * as React from 'react'
import { MoreHorizontal, Target, Plus, Minus } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { ProgressBar } from '@/components/progress-bar'
import { PaceChip } from '@/components/pace-chip'
import { EarlierDayPopover } from '@/components/earlier-day-popover'
import { computeProgress, type Goal } from '@/lib/progress'
import type { GoalCardHandlers } from './index'

interface CountCardProps {
  goal: Extract<Goal, { type: 'count' }>
  now: Date
  userTz: string
  handlers: GoalCardHandlers
}

export function CountCard({ goal, now, userTz, handlers }: CountCardProps) {
  const snap = computeProgress(goal, now, userTz)
  const [stepperValue, setStepperValue] = React.useState(0)
  const [earlierOpen, setEarlierOpen] = React.useState(false)
  const title = goal.title ?? 'Goal'
  const ariaLabel = `${title}: ${snap.raw.done} of ${snap.raw.total} (${Math.round(snap.percent * 100)}%)`

  function commitStepper() {
    if (stepperValue === 0) return
    handlers.onCountIncrement(goal.id, stepperValue)
    setStepperValue(0)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Target className="h-4 w-4 text-primary" /> {title}
        </CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Goal actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handlers.onEdit(goal as Goal)}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEarlierOpen(true)}>Log for earlier day</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => handlers.onDelete(goal as Goal)}>
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

        <div className="flex items-center gap-3">
          <Button
            size="lg"
            className="h-11"
            onClick={() => handlers.onCountIncrement(goal.id, 1)}
          >
            +1
          </Button>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Decrement stepper"
              onClick={() => setStepperValue((v) => v - 1)}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Input
              readOnly
              value={stepperValue}
              className="w-12 text-center tabular-nums"
              aria-label="Stepper delta"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Increment stepper"
              onClick={() => setStepperValue((v) => v + 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            {stepperValue !== 0 && (
              <Button variant="outline" size="sm" onClick={commitStepper} aria-label="Commit stepper delta">
                Apply
              </Button>
            )}
          </div>
        </div>

        <p className="text-right text-xs tabular-nums text-muted-foreground">
          {snap.raw.done} of {snap.raw.total}
        </p>
      </CardContent>

      <EarlierDayPopover
        open={earlierOpen}
        onOpenChange={setEarlierOpen}
        goalId={goal.id}
        goalTitle={title}
        month={goal.month}
        userTz={userTz}
        now={now}
        onCommit={(loggedLocalDate, delta) => handlers.onCountBackfill(goal.id, loggedLocalDate, delta)}
      />
    </Card>
  )
}
