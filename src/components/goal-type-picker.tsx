'use client'

import { Target, ListChecks, Flame } from 'lucide-react'

type GoalType = 'count' | 'checklist' | 'habit'

interface GoalTypePickerProps {
  onSelect: (type: GoalType) => void
}

const options: { type: GoalType; heading: string; body: string; Icon: typeof Target }[] = [
  {
    type: 'count',
    heading: 'Count',
    body: 'Track a number you want to hit — "read 5 books" or "run 40 miles".',
    Icon: Target,
  },
  {
    type: 'checklist',
    heading: 'Checklist',
    body: 'Check off a set of finite tasks — "renovate the spare room" or "launch v1".',
    Icon: ListChecks,
  },
  {
    type: 'habit',
    heading: 'Habit',
    body: 'Mark days you showed up — "meditate daily" or "write 20 of 30 days".',
    Icon: Flame,
  },
]

export function GoalTypePicker({ onSelect }: GoalTypePickerProps) {
  return (
    <div className="flex flex-col gap-3">
      {options.map(({ type, heading, body, Icon }) => (
        <button
          key={type}
          type="button"
          onClick={() => onSelect(type)}
          className="flex min-h-24 flex-col items-start gap-1 rounded-lg border border-border p-4 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">{heading}</span>
          </div>
          <p className="text-sm text-muted-foreground">{body}</p>
        </button>
      ))}
    </div>
  )
}
