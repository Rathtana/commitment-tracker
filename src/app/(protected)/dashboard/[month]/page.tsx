import { notFound, redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { addMonths, format, getDaysInMonth, isSameMonth, subMonths } from "date-fns"
import { TZDate } from "@date-fns/tz"
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
import { CalendarCheck, LogOut } from "lucide-react"

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

  // Use UTC-pinned dates for all display ops — plain Date at UTC midnight reads as
  // the prior day in negative-offset timezones (e.g. PDT), causing month labels to
  // appear one month behind.
  const utcViewed = new TZDate(viewedMonth, "UTC")
  const utcCurrent = new TZDate(currentMonth, "UTC")

  // D-06: future cap = current + 1 only
  const nextAllowed = new TZDate(addMonths(utcCurrent, 1), "UTC")
  if (status === "future" && !isSameMonth(utcViewed, nextAllowed)) notFound()

  const isNextDisabled = isSameMonth(utcViewed, nextAllowed)
  const monthYearLabel = format(utcViewed, "MMMM yyyy")
  const daysInMonth = getDaysInMonth(utcViewed)
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
        <Button
          variant="outline"
          className="h-9 w-9 gap-1.5 md:w-auto md:px-3"
          aria-label="Return to this month"
          title="Return to this month"
          asChild
        >
          <Link href={`/dashboard/${currentSegment}`}>
            <CalendarCheck className="size-4" />
            <span className="hidden md:inline">Today</span>
          </Link>
        </Button>
      )}
      {status !== "past" && goals.length > 0 && (
        <NewGoalButton daysInMonthDefault={daysInMonth} />
      )}
      <form action={signOutAction}>
        <Button
          type="submit"
          variant="outline"
          className="h-9 w-9 gap-1.5 md:w-auto md:px-3"
          aria-label="Log out"
          title="Log out"
        >
          <LogOut className="size-4" />
          <span className="hidden md:inline">Log out</span>
        </Button>
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
          priorMonthLabel={format(new TZDate(subMonths(utcViewed, 1), "UTC"), "MMMM")}
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
