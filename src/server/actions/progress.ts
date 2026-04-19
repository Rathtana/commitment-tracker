"use server"

import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"
import {
  incrementCountSchema,
  backfillCountSchema,
  undoLastMutationSchema,
  toggleTaskSchema,
  type IncrementCountInput,
  type BackfillCountInput,
  type UndoLastMutationInput,
  type ToggleTaskInput,
} from "@/lib/schemas/goals"
import {
  incrementCount,
  backfillCount,
  undoLastMutation,
  toggleTask,
  GoalNotFoundError,
  OutOfMonthError,
  WrongGoalTypeError,
  UndoNotFoundError,
  TaskNotFoundError,
} from "@/server/services/progress"

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string }

async function resolveUserTz(userId: string): Promise<string> {
  const [row] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId)).limit(1)
  return row?.timezone ?? "UTC"
}

function mapServiceError(e: unknown): string {
  if (e instanceof GoalNotFoundError) return "Goal not found or not owned by you."
  if (e instanceof OutOfMonthError) return "That date isn't in the current month."
  if (e instanceof WrongGoalTypeError) return "That action isn't valid for this goal type."
  if (e instanceof UndoNotFoundError) return "Nothing to undo."
  if (e instanceof TaskNotFoundError) return "Task not found."
  return "Couldn't save that change. Try again."
}

export async function incrementCountAction(input: IncrementCountInput): Promise<ActionResult> {
  const parsed = incrementCountSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input." }
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated." }
  const userTz = await resolveUserTz(user.id)
  try {
    await incrementCount(user.id, userTz, parsed.data)
    revalidatePath("/dashboard")
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: mapServiceError(e) }
  }
}

export async function backfillCountAction(input: BackfillCountInput): Promise<ActionResult> {
  const parsed = backfillCountSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input." }
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated." }
  const userTz = await resolveUserTz(user.id)
  try {
    await backfillCount(user.id, userTz, parsed.data)
    revalidatePath("/dashboard")
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: mapServiceError(e) }
  }
}

export async function undoLastMutationAction(input: UndoLastMutationInput): Promise<ActionResult> {
  const parsed = undoLastMutationSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input." }
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated." }
  try {
    await undoLastMutation(user.id, parsed.data)
    revalidatePath("/dashboard")
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: mapServiceError(e) }
  }
}

export async function toggleTaskAction(input: ToggleTaskInput): Promise<ActionResult> {
  const parsed = toggleTaskSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Invalid input." }
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Not authenticated." }
  const userTz = await resolveUserTz(user.id)
  try {
    await toggleTask(user.id, userTz, parsed.data)
    revalidatePath("/dashboard")
    return { ok: true, data: undefined }
  } catch (e) {
    return { ok: false, error: mapServiceError(e) }
  }
}
