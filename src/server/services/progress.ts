import { and, eq, sql } from "drizzle-orm"
import { db } from "@/server/db"
import { goals, progressEntries } from "@/server/db/schema"
import { today, monthBucket } from "@/lib/time"
import type {
  IncrementCountInput,
  BackfillCountInput,
  UndoLastMutationInput,
} from "@/lib/schemas/goals"

export class GoalNotFoundError extends Error {
  constructor() {
    super("Goal not found or not owned by you.")
  }
}

export class OutOfMonthError extends Error {
  constructor() {
    super("That date isn't in the current month.")
  }
}

export class WrongGoalTypeError extends Error {
  constructor() {
    super("That action isn't valid for this goal type.")
  }
}

export class UndoNotFoundError extends Error {
  constructor() {
    super("Nothing to undo.")
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function loadOwnedGoal(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string, goalId: string) {
  const [g] = await tx.select().from(goals).where(and(eq(goals.id, goalId), eq(goals.userId, userId))).limit(1)
  if (!g) throw new GoalNotFoundError()
  return g
}

export async function incrementCount(userId: string, userTz: string, input: IncrementCountInput) {
  const now = new Date()
  const currentMonth = isoDate(monthBucket(now, userTz))
  const loggedLocalDate = today(now, userTz)
  return db.transaction(async (tx) => {
    const g = await loadOwnedGoal(tx, userId, input.goalId)
    if (g.type !== "count") throw new WrongGoalTypeError()
    if (g.month !== currentMonth) throw new OutOfMonthError()
    await tx.insert(progressEntries).values({
      goalId: input.goalId,
      delta: input.delta,
      loggedLocalDate,
      undoId: input.undoId,
    })
    await tx
      .update(goals)
      .set({ currentCount: sql`GREATEST(0, ${goals.currentCount} + ${input.delta})`, updatedAt: new Date() })
      .where(eq(goals.id, input.goalId))
  })
}

export async function backfillCount(userId: string, userTz: string, input: BackfillCountInput) {
  const now = new Date()
  const currentMonthDate = monthBucket(now, userTz)
  const currentMonth = isoDate(currentMonthDate)
  const todayStr = today(now, userTz)
  // loggedLocalDate must be in current month AND strictly before today in userTz
  if (input.loggedLocalDate.slice(0, 7) !== currentMonth.slice(0, 7)) throw new OutOfMonthError()
  if (input.loggedLocalDate >= todayStr) throw new OutOfMonthError()
  return db.transaction(async (tx) => {
    const g = await loadOwnedGoal(tx, userId, input.goalId)
    if (g.type !== "count") throw new WrongGoalTypeError()
    if (g.month !== currentMonth) throw new OutOfMonthError()
    await tx.insert(progressEntries).values({
      goalId: input.goalId,
      delta: input.delta,
      loggedLocalDate: input.loggedLocalDate,
      undoId: input.undoId,
    })
    await tx
      .update(goals)
      .set({ currentCount: sql`GREATEST(0, ${goals.currentCount} + ${input.delta})`, updatedAt: new Date() })
      .where(eq(goals.id, input.goalId))
  })
}

export async function undoLastMutation(userId: string, input: UndoLastMutationInput) {
  return db.transaction(async (tx) => {
    // Try count branch (progress_entries)
    const [row] = await tx
      .select({
        id: progressEntries.id,
        goalId: progressEntries.goalId,
        delta: progressEntries.delta,
      })
      .from(progressEntries)
      .innerJoin(goals, eq(goals.id, progressEntries.goalId))
      .where(and(eq(progressEntries.undoId, input.undoId), eq(goals.userId, userId)))
      .limit(1)

    if (row) {
      await tx
        .update(goals)
        .set({ currentCount: sql`GREATEST(0, ${goals.currentCount} - ${row.delta})`, updatedAt: new Date() })
        .where(eq(goals.id, row.goalId))
      await tx.delete(progressEntries).where(eq(progressEntries.id, row.id))
      return { reversed: "count" as const }
    }

    // Plan 05: extend to search tasks by undoId metadata
    // Plan 06: extend to search habit_check_ins by undoId
    throw new UndoNotFoundError()
  })
}
