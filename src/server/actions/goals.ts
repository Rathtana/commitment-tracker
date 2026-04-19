"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"
import {
  createGoalSchema,
  updateGoalSchema,
  deleteGoalSchema,
  type CreateGoalInput,
  type UpdateGoalInput,
  type DeleteGoalInput,
} from "@/lib/schemas/goals"
import {
  createGoal,
  updateGoal,
  deleteGoal,
  GoalNotFoundError,
  GoalTypeImmutableError,
} from "@/server/services/goals"

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }

async function resolveUserTz(userId: string): Promise<string> {
  const rows = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1)
  return rows[0]?.timezone ?? "UTC"
}

export async function createGoalAction(input: CreateGoalInput): Promise<ActionResult<{ id: string }>> {
  const parsed = createGoalSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input. Please check the form." }
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated." }
  const userTz = await resolveUserTz(user.id)
  try {
    const row = await createGoal(user.id, userTz, parsed.data)
    revalidatePath("/dashboard")
    return { ok: true, data: { id: row.id } }
  } catch {
    return { ok: false, error: "Couldn't save that change. Try again." }
  }
}

export async function updateGoalAction(input: UpdateGoalInput): Promise<ActionResult> {
  const parsed = updateGoalSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input. Please check the form." }
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated." }
  try {
    await updateGoal(user.id, parsed.data)
    revalidatePath("/dashboard")
    return { ok: true, data: undefined }
  } catch (e) {
    if (e instanceof GoalNotFoundError) return { ok: false, error: "Goal not found or not owned by you." }
    if (e instanceof GoalTypeImmutableError) return { ok: false, error: "A goal's type cannot be changed after creation." }
    return { ok: false, error: "Couldn't save that change. Try again." }
  }
}

export async function deleteGoalAction(input: DeleteGoalInput): Promise<ActionResult> {
  const parsed = deleteGoalSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input. Please check the form." }
  const supabase = await getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated." }
  try {
    await deleteGoal(user.id, parsed.data.goalId)
    revalidatePath("/dashboard")
    return { ok: true, data: undefined }
  } catch (e) {
    if (e instanceof GoalNotFoundError) return { ok: false, error: "Goal not found or not owned by you." }
    return { ok: false, error: "Couldn't save that change. Try again." }
  }
}
