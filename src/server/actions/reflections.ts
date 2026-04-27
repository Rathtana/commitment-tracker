"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"
import {
  upsertReflectionSchema,
  type UpsertReflectionInput,
} from "@/lib/schemas/reflections"
import { upsertReflection, FutureMonthReflectionError } from "@/server/services/reflections"
import { monthBucket, compareMonth } from "@/lib/time"

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }

async function resolveUserTz(userId: string): Promise<string> {
  const [row] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1)
  return row?.timezone ?? "UTC"
}

export async function upsertReflectionAction(
  input: UpsertReflectionInput,
): Promise<ActionResult<{ savedAt: string }>> {
  const parsed = upsertReflectionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input." }

  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated." }
  const userTz = await resolveUserTz(user.id)

  // D-28: reject future-month reflections server-side (defense in depth — UI already hides the card)
  const viewedMonth = new Date(`${parsed.data.month.slice(0, 7)}-01T00:00:00.000Z`)
  const currentMonth = monthBucket(new Date(), userTz)
  if (compareMonth(viewedMonth, currentMonth) === "future") {
    return { ok: false, error: "Reflections aren't available for future months." }
  }

  try {
    const { savedAt } = await upsertReflection(user.id, parsed.data)
    revalidatePath(`/dashboard/${parsed.data.month.slice(0, 7)}`)
    return { ok: true, data: { savedAt: savedAt.toISOString() } }
  } catch (e) {
    if (e instanceof FutureMonthReflectionError) {
      return { ok: false, error: "Reflections aren't available for future months." }
    }
    return { ok: false, error: "Couldn't save reflection. Please try again." }
  }
}
