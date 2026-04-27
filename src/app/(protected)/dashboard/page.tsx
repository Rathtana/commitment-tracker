import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"
import { monthBucket, formatMonthSegment } from "@/lib/time"

export default async function DashboardRedirect() {
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const [row] = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)
  const userTz = row?.timezone ?? "UTC"

  redirect(`/dashboard/${formatMonthSegment(monthBucket(new Date(), userTz))}`)
}
