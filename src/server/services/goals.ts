import { eq, and } from "drizzle-orm"
import { db } from "@/server/db"
import { goals, tasks } from "@/server/db/schema"
import { monthBucket } from "@/lib/time"
import type { CreateGoalInput, UpdateGoalInput } from "@/lib/schemas/goals"

export class GoalNotFoundError extends Error {
  constructor() {
    super("Goal not found or not owned by you.")
  }
}

export class GoalTypeImmutableError extends Error {
  constructor() {
    super("A goal's type cannot be changed after creation.")
  }
}

export async function createGoal(userId: string, userTz: string, input: CreateGoalInput) {
  const month = monthBucket(new Date(), userTz)
  return db.transaction(async (tx) => {
    const common = {
      userId,
      month: month.toISOString().slice(0, 10),
      title: input.title,
      type: input.type,
    }
    let row: typeof goals.$inferSelect
    if (input.type === "count") {
      const rows = await tx.insert(goals).values({ ...common, targetCount: input.targetCount, currentCount: 0 }).returning()
      row = rows[0]
    } else if (input.type === "habit") {
      const rows = await tx.insert(goals).values({ ...common, targetDays: input.targetDays }).returning()
      row = rows[0]
    } else {
      // checklist
      const rows = await tx.insert(goals).values({ ...common }).returning()
      row = rows[0]
      if (input.tasks.length > 0) {
        await tx.insert(tasks).values(
          input.tasks.map((t) => ({ goalId: row.id, label: t.label, position: t.position })),
        )
      }
    }
    return row
  })
}

export async function updateGoal(userId: string, input: UpdateGoalInput) {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(goals)
      .where(and(eq(goals.id, input.goalId), eq(goals.userId, userId)))
      .limit(1)
    if (existing.length === 0) throw new GoalNotFoundError()
    if (existing[0].type !== input.type) throw new GoalTypeImmutableError()

    if (input.type === "count") {
      await tx
        .update(goals)
        .set({ title: input.title, targetCount: input.targetCount, updatedAt: new Date() })
        .where(eq(goals.id, input.goalId))
    } else if (input.type === "habit") {
      await tx
        .update(goals)
        .set({ title: input.title, targetDays: input.targetDays, updatedAt: new Date() })
        .where(eq(goals.id, input.goalId))
    } else {
      // checklist — naive delete+re-insert (Plan 05 may refine to preserve isDone on rename)
      await tx.update(goals).set({ title: input.title, updatedAt: new Date() }).where(eq(goals.id, input.goalId))
      await tx.delete(tasks).where(eq(tasks.goalId, input.goalId))
      if (input.tasks.length > 0) {
        await tx.insert(tasks).values(
          input.tasks.map((t) => ({ goalId: input.goalId, label: t.label, position: t.position })),
        )
      }
    }
  })
}

export async function deleteGoal(userId: string, goalId: string) {
  const result = await db
    .delete(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .returning({ id: goals.id })
  if (result.length === 0) throw new GoalNotFoundError()
}
