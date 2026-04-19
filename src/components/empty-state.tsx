import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProgressBar } from "@/components/progress-bar"
import type { ReactNode } from "react"

interface EmptyStateProps {
  monthYearLabel: string   // e.g. "April 2026"
  // Plan 02-03 will replace this with a real open-dialog trigger (client component)
  createButtonSlot?: ReactNode
}

function ExampleCard({ title }: { title: string }) {
  return (
    <Card className="pointer-events-none opacity-50">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ProgressBar percent={0.4} ariaLabel={`${title} example — 40% progress`} />
      </CardContent>
    </Card>
  )
}

export function EmptyState({ monthYearLabel, createButtonSlot }: EmptyStateProps) {
  return (
    <section className="flex flex-col items-center gap-8 pt-8">
      <h2 className="max-w-md text-center text-2xl font-semibold">
        It&apos;s {monthYearLabel}. What do you want to commit to?
      </h2>
      <div className="flex w-full flex-col gap-4">
        <ExampleCard title="Count — Read 5 books" />
        <ExampleCard title="Checklist — Home renovation" />
        <ExampleCard title="Habit — Meditate daily" />
      </div>
      {createButtonSlot ?? (
        <Button size="lg" disabled aria-label="Add your first goal (wired in Plan 02-03)">
          <Plus className="mr-2 h-4 w-4" /> Add your first goal
        </Button>
      )}
    </section>
  )
}
