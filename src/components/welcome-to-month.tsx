'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { copyGoalsFromLastMonthAction } from '@/server/actions/goals'

interface Props {
  monthYearLabel: string    // "April 2026"
  priorMonthLabel: string   // "March"
  fallbackSlot: ReactNode   // Phase 2 EmptyState to show when user chooses "Start fresh"
}

export function WelcomeToMonth({ monthYearLabel, priorMonthLabel, fallbackSlot }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [startedFresh, setStartedFresh] = useState(false)

  if (startedFresh) {
    // D-20: dismissed for the page session via React state; no DB flag, no sessionStorage
    return <>{fallbackSlot}</>
  }

  function onCopyClick() {
    setError(null)
    startTransition(async () => {
      const result = await copyGoalsFromLastMonthAction()
      if (!result.ok) {
        setError(result.error)
      }
      // On success, Next.js revalidates the route; new goal cards render where the Welcome used to be.
    })
  }

  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-4 space-y-2">
        <CardTitle className="text-2xl font-semibold">Welcome to {monthYearLabel}.</CardTitle>
        <CardDescription className="text-base text-muted-foreground">
          Carry forward from {priorMonthLabel} or start fresh?
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            type="button"
            variant="default"
            disabled={isPending}
            onClick={onCopyClick}
            className="min-h-11"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : 'Copy from last month'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => setStartedFresh(true)}
            className="min-h-11"
          >
            Start fresh
          </Button>
        </div>
        {error && (
          <Alert variant="destructive" aria-live="polite">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
