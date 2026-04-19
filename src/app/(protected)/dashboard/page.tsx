import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { format, getDaysInMonth } from "date-fns"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"
import { monthBucket } from "@/lib/time"
import { getMonthDashboard } from "@/server/db/queries"
import { DashboardShell, NewGoalButton } from "@/components/dashboard-shell"
import { EmptyState } from "@/components/empty-state"
import { signOutAction } from "@/server/actions/auth"
import { Button } from "@/components/ui/button"

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Load user timezone
  const [userRow] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, user.id)).limit(1)
  const userTz = userRow?.timezone ?? "UTC"

  const now = new Date()
  const month = monthBucket(now, userTz)
  const goals = await getMonthDashboard(user.id, month)
  const monthYearLabel = format(month, "MMMM yyyy")
  const daysInMonthDefault = getDaysInMonth(month)

  return (
    <>
      <header className="mb-2 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{monthYearLabel}</h1>
        <div className="flex items-center gap-2">
          {goals.length > 0 && (
            <NewGoalButton daysInMonthDefault={daysInMonthDefault} />
          )}
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">Log out</Button>
          </form>
        </div>
      </header>

      {goals.length === 0 ? (
        <EmptyState
          monthYearLabel={monthYearLabel}
          createButtonSlot={
            <NewGoalButton daysInMonthDefault={daysInMonthDefault} />
          }
        />
      ) : (
        <DashboardShell
          initialGoals={goals}
          userTz={userTz}
          nowIso={now.toISOString()}
          daysInMonthDefault={daysInMonthDefault}
        />
      )}
    </>
  )
}
