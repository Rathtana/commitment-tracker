import { notFound, redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { addMonths, format, getDaysInMonth, isSameMonth, subMonths } from "date-fns"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"
import {
  compareMonth,
  formatMonthSegment,
  monthBucket,
  parseMonthSegment,
} from "@/lib/time"
import { monthSegmentSchema } from "@/lib/schemas/month"
import {
  countGoalsInMonth,
  getMonthDashboard,
} from "@/server/db/queries"
import { MonthNavigator } from "@/components/month-navigator"
import { DashboardShell, NewGoalButton } from "@/components/dashboard-shell"
import { EmptyState } from "@/components/empty-state"
import { PastMonthReadOnly } from "@/components/past-month-read-only"
import { PastEmptyState } from "@/components/past-empty-state"
import { WelcomeToMonth } from "@/components/welcome-to-month"
import { ReflectionCard } from "@/components/reflection-card"
import { getReflectionForMonth } from "@/server/db/queries"
import { signOutAction } from "@/server/actions/auth"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface PageProps {
  params: Promise<{ month: string }>
}

export default async function DashboardMonthPage({ params }: PageProps) {
  const { month: segment } = await params
  const parsed = monthSegmentSchema.safeParse(segment)
  if (!parsed.success) notFound()

  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [userRow] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)
  const userTz = userRow?.timezone ?? "UTC"

  const now = new Date()
  const currentMonth = monthBucket(now, userTz)
  const viewedMonth = parseMonthSegment(parsed.data)
  const status = compareMonth(viewedMonth, currentMonth)

  // D-06: future cap = current + 1 only
  const nextAllowed = addMonths(currentMonth, 1)
  if (status === "future" && !isSameMonth(viewedMonth, nextAllowed)) notFound()

  const isNextDisabled = isSameMonth(viewedMonth, nextAllowed)
  const monthYearLabel = format(viewedMonth, "MMMM yyyy")
  const daysInMonth = getDaysInMonth(viewedMonth)
  const viewedIsoDate = viewedMonth.toISOString().slice(0, 10)
  const currentIsoDate = currentMonth.toISOString().slice(0, 10)
  const currentSegment = formatMonthSegment(currentMonth)
  const isCurrent = status === "current"

  const goals = await getMonthDashboard(user.id, viewedMonth)

  const priorMonthHasGoals =
    status === "past"
      ? false
      : (await countGoalsInMonth(user.id, subMonths(viewedMonth, 1))) > 0

  const reflection = status !== "future"
    ? await getReflectionForMonth(user.id, viewedMonth)
    : null

  // Header right-cluster: past months have no NewGoal button (D-12 UI layer)
  // Today button: only when viewed != current (D-08)
  const rightCluster = (
    <>
      {!isCurrent && (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/${currentSegment}`} aria-label="Return to this month">Today</Link>
        </Button>
      )}
      {status !== "past" && goals.length > 0 && (
        <NewGoalButton daysInMonthDefault={daysInMonth} />
      )}
      <form action={signOutAction}>
        <Button type="submit" variant="outline" size="sm">Log out</Button>
      </form>
    </>
  )

  return (
    <>
      <MonthNavigator
        viewedMonthIso={viewedIsoDate}
        currentMonthIso={currentIsoDate}
        isNextDisabled={isNextDisabled}
        monthYearLabel={monthYearLabel}
        rightCluster={rightCluster}
      />

      {status === "past" && goals.length === 0 ? (
        <PastEmptyState
          monthYearLabel={monthYearLabel}
          currentMonthSegment={currentSegment}
        />
      ) : status === "past" ? (
        <PastMonthReadOnly goals={goals} now={now} userTz={userTz} />
      ) : goals.length === 0 && priorMonthHasGoals ? (
        <WelcomeToMonth
          monthYearLabel={monthYearLabel}
          priorMonthLabel={format(subMonths(viewedMonth, 1), "MMMM")}
          fallbackSlot={
            <EmptyState
              monthYearLabel={monthYearLabel}
              createButtonSlot={<NewGoalButton daysInMonthDefault={daysInMonth} />}
            />
          }
        />
      ) : goals.length === 0 ? (
        <EmptyState
          monthYearLabel={monthYearLabel}
          createButtonSlot={<NewGoalButton daysInMonthDefault={daysInMonth} />}
        />
      ) : (
        <DashboardShell
          initialGoals={goals}
          userTz={userTz}
          nowIso={now.toISOString()}
          daysInMonthDefault={daysInMonth}
          monthContext={status === "future" ? "future" : "current"}
          monthYearLabel={monthYearLabel}
        />
      )}

      {status !== "future" && (
        <ReflectionCard
          monthIsoDate={viewedIsoDate}
          monthYearLabel={monthYearLabel}
          initial={reflection}
        />
      )}
    </>
  )
}
