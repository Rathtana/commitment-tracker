'use client'

import * as React from 'react'
import { startOfMonth, endOfMonth, eachDayOfInterval, getDay, format } from 'date-fns'
import { TZDate } from '@date-fns/tz'
import { cn } from '@/lib/utils'

interface HabitGridProps {
  month: Date
  checkIns: string[]   // ISO 'YYYY-MM-DD'
  now: Date
  userTz: string
  onToggle: (localDate: string, willBeChecked: boolean) => void
}

export function HabitGrid({ month, checkIns, now, userTz, onToggle }: HabitGridProps) {
  const start = startOfMonth(month)
  const end = endOfMonth(month)
  const days = eachDayOfInterval({ start, end })
  const leading = getDay(start)
  const totalCells = 42
  const trailing = totalCells - leading - days.length

  const localNow = new TZDate(now.getTime(), userTz)
  const todayStr = format(localNow, 'yyyy-MM-dd')
  const checkSet = React.useMemo(() => new Set(checkIns), [checkIns])

  // Roving tabindex: first enabled cell gets tabIndex=0 initially
  const [focusedIso, setFocusedIso] = React.useState<string | null>(null)
  const firstEnabled = days.find((d) => format(d, 'yyyy-MM-dd') <= todayStr)
  const defaultFocusIso = firstEnabled ? format(firstEnabled, 'yyyy-MM-dd') : null
  const activeIso = focusedIso ?? defaultFocusIso

  function ariaLabelFor(iso: string, isHit: boolean, isToday: boolean, isFuture: boolean) {
    const human = format(new Date(iso + 'T00:00:00'), 'MMMM d')
    if (isFuture) return `${human} — future`
    if (isToday) return `${human} — today, ${isHit ? 'done' : 'not yet done'}`
    return `${human} — ${isHit ? 'done' : 'not done'}`
  }

  function onCellKeyDown(e: React.KeyboardEvent, iso: string, isFuture: boolean) {
    const idx = days.findIndex((d) => format(d, 'yyyy-MM-dd') === iso)
    if (idx === -1) return
    const move = (delta: number) => {
      let next = idx + delta
      while (next >= 0 && next < days.length) {
        const niso = format(days[next], 'yyyy-MM-dd')
        if (niso <= todayStr) { setFocusedIso(niso); return }
        next += delta > 0 ? 1 : -1
      }
    }
    if (e.key === 'ArrowRight') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(7) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-7) }
    else if ((e.key === 'Enter' || e.key === ' ') && !isFuture) {
      e.preventDefault()
      onToggle(iso, !checkSet.has(iso))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground" aria-hidden>
        {['S','M','T','W','T','F','S'].map((l, i) => <div key={i}>{l}</div>)}
      </div>
      <div role="grid" className="grid grid-cols-7 gap-1" aria-label={`Habit grid for ${format(month, 'MMMM yyyy')}`}>
        {Array.from({ length: leading }, (_, i) => <div key={`lead-${i}`} aria-hidden />)}
        {days.map((d) => {
          const iso = format(d, 'yyyy-MM-dd')
          const isHit = checkSet.has(iso)
          const isToday = iso === todayStr
          const isFuture = iso > todayStr
          const label = ariaLabelFor(iso, isHit, isToday, isFuture)
          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              disabled={isFuture}
              tabIndex={iso === activeIso ? 0 : -1}
              onFocus={() => setFocusedIso(iso)}
              onClick={() => !isFuture && onToggle(iso, !isHit)}
              onKeyDown={(e) => onCellKeyDown(e, iso, isFuture)}
              aria-label={label}
              aria-pressed={isHit}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-md text-xs tabular-nums',
                isHit && !isToday && 'bg-primary text-primary-foreground',
                !isHit && !isToday && !isFuture && 'bg-muted text-muted-foreground',
                isToday && isHit && 'bg-primary text-primary-foreground ring-2 ring-ring ring-offset-2 ring-offset-card',
                isToday && !isHit && 'bg-muted text-foreground ring-2 ring-ring ring-offset-2 ring-offset-card',
                isFuture && 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed',
                !isFuture && 'hover:bg-muted/80',
              )}
            >
              {format(d, 'd')}
            </button>
          )
        })}
        {Array.from({ length: Math.max(0, trailing) }, (_, i) => <div key={`trail-${i}`} aria-hidden />)}
      </div>
    </div>
  )
}
