'use client'

import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  percent: number
  expected?: number
  className?: string
  ariaLabel: string
}

export function ProgressBar({ percent, expected, className, ariaLabel }: ProgressBarProps) {
  const reduce = useReducedMotion()
  const clamped = Math.max(0, Math.min(1, percent))

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={ariaLabel}
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <motion.div
        className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-primary"
        style={{ willChange: 'transform' }}
        initial={false}
        animate={{ scaleX: clamped }}
        transition={
          reduce
            ? { duration: 0 }
            : { type: 'spring', stiffness: 140, damping: 22, mass: 0.6 }
        }
      />
      {typeof expected === 'number' && (
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 h-full w-px bg-foreground/40"
          style={{ left: `${Math.max(0, Math.min(1, expected)) * 100}%` }}
        />
      )}
    </div>
  )
}
