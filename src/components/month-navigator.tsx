'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addMonths, subMonths } from 'date-fns'
import { Button } from '@/components/ui/button'
import { formatMonthSegment } from '@/lib/time'

interface Props {
  viewedMonthIso: string         // 'YYYY-MM-DD' — UTC first-of-month from the route page
  currentMonthIso: string        // 'YYYY-MM-DD'
  isNextDisabled: boolean        // server-computed: viewedMonth === currentMonth + 1
  monthYearLabel: string         // 'April 2026'
  rightCluster?: ReactNode        // Conditional children: [Today] [NewGoal] [Logout] — route wires visibility
}

export function MonthNavigator({
  viewedMonthIso,
  currentMonthIso,
  isNextDisabled,
  monthYearLabel,
  rightCluster,
}: Props) {
  const router = useRouter()
  const viewed = new Date(viewedMonthIso)
  const prevHref = `/dashboard/${formatMonthSegment(subMonths(viewed, 1))}`
  const nextHref = `/dashboard/${formatMonthSegment(addMonths(viewed, 1))}`

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // D-07: ignore when focus is inside an input/textarea/contenteditable
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        router.push(prevHref)
      } else if (e.key === 'ArrowRight' && !isNextDisabled) {
        e.preventDefault()
        router.push(nextHref)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router, prevHref, nextHref, isNextDisabled])

  return (
    <header className="mb-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href={prevHref} aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{monthYearLabel}</h1>
        {isNextDisabled ? (
          <Button
            variant="ghost"
            size="icon"
            disabled
            aria-disabled="true"
            aria-label="Next month — unavailable"
            title="Next month — unavailable"
            className="opacity-50 cursor-not-allowed"
          >
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" asChild>
            <Link href={nextHref} aria-label="Next month">
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        )}
      </div>
      {rightCluster && <div className="flex items-center gap-2">{rightCluster}</div>}
    </header>
  )
}
