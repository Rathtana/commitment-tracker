'use client'

import * as React from 'react'
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns'
import { TZDate } from '@date-fns/tz'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface EarlierDayPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goalId: string
  goalTitle: string
  month: Date
  userTz: string
  now: Date
  onCommit: (loggedLocalDate: string, delta: number) => void
}

export function EarlierDayPopover({
  open,
  onOpenChange,
  month,
  userTz,
  now,
  onCommit,
}: EarlierDayPopoverProps) {
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null)
  const [amount, setAmount] = React.useState(1)

  React.useEffect(() => {
    if (!open) {
      setSelectedDate(null)
      setAmount(1)
    }
  }, [open])

  const localNow = new TZDate(now.getTime(), userTz)
  const todayStr = format(localNow, 'yyyy-MM-dd')
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })

  const canSubmit = selectedDate !== null && selectedDate < todayStr && amount > 0

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <span />
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <h4 className="text-sm font-semibold">Log for an earlier day</h4>
        <p className="mt-1 text-xs text-muted-foreground">Past days this month only.</p>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {days.map((d) => {
            const iso = format(d, 'yyyy-MM-dd')
            const disabled = iso >= todayStr
            const selected = iso === selectedDate
            return (
              <button
                key={iso}
                type="button"
                onClick={() => !disabled && setSelectedDate(iso)}
                disabled={disabled}
                aria-label={format(d, 'MMMM d')}
                aria-pressed={selected}
                className={cn(
                  'flex min-h-11 min-w-11 items-center justify-center rounded-md text-xs tabular-nums',
                  disabled && 'cursor-not-allowed opacity-50',
                  !disabled && !selected && 'hover:bg-muted',
                  selected && 'bg-primary text-primary-foreground',
                )}
              >
                {format(d, 'd')}
              </button>
            )
          })}
        </div>

        <label className="mt-3 block text-sm font-semibold">Amount</label>
        <div className="mt-1 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setAmount((a) => Math.max(1, a - 1))}
          >
            &minus;
          </Button>
          <Input readOnly value={amount} className="w-12 text-center tabular-nums" />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setAmount((a) => a + 1)}
          >
            +
          </Button>
          <span className="text-xs text-muted-foreground">times</span>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              onCommit(selectedDate!, amount)
              onOpenChange(false)
            }}
          >
            Log
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
