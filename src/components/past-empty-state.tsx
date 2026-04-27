import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Props {
  monthYearLabel: string
  currentMonthSegment: string
}

/**
 * Minimal past-empty-month view per D-16 + UI-SPEC §PastEmptyState.
 */
export function PastEmptyState({ monthYearLabel, currentMonthSegment }: Props) {
  return (
    <Card className="p-6">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-2xl font-semibold">No goals in {monthYearLabel}.</CardTitle>
      </CardHeader>
      <CardContent className="p-0 space-y-4">
        <p className="text-base text-muted-foreground">
          You didn&apos;t have goals tracked this month.
        </p>
        <Button variant="outline" asChild className="min-h-11 w-full sm:w-auto">
          <Link href={`/dashboard/${currentMonthSegment}`}>Back to current month</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
