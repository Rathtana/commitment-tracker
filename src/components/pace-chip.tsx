import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import type { Pace } from '@/lib/progress'

const paceChipVariants = cva(
  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium tabular-nums',
  {
    variants: {
      pace: {
        'on-pace': 'text-muted-foreground',
        behind: 'bg-warning-muted text-warning-foreground',
        ahead: 'bg-success-muted text-success-foreground',
      },
    },
    defaultVariants: { pace: 'on-pace' },
  },
)

interface PaceChipProps {
  pace: Pace
  paceDelta: number
  // When true (for checklist goals), chip is suppressed entirely — D-12.
  suppressForChecklist?: boolean
  className?: string
}

export function PaceChip({ pace, paceDelta, suppressForChecklist, className }: PaceChipProps) {
  // D-13 early-month guard: warming-up hides the chip
  if (pace === 'warming-up') return null
  // D-12: checklist has no time axis — suppress rather than show a meaningless "on pace"
  if (suppressForChecklist) return null

  let copy: string
  if (pace === 'behind') copy = `behind by ${Math.abs(paceDelta)}`
  else if (pace === 'ahead') copy = `ahead by ${paceDelta}`
  else copy = 'on pace'

  return <span className={cn(paceChipVariants({ pace }), className)}>{copy}</span>
}
