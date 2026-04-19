import { eq, and, asc, sql } from "drizzle-orm"
import { db } from "@/server/db"
import { goals, tasks, habitCheckIns } from "@/server/db/schema"
import type { Goal } from "@/lib/progress"

/**
 * Single-round-trip dashboard query.
 * Returns all goals for the user in the given month, with their typed children
 * inlined via Postgres JSON aggregation.
 *
 * Budget: ≤ 30 lines of emitted SQL (PITFALLS §3 — if this grows, the schema is wrong).
 * Source: 02-CONTEXT.md D-21, D-26 + 02-RESEARCH.md §Dashboard query budget.
 */
export async function getMonthDashboard(
  userId: string,
  month: Date,
): Promise<Goal[]> {
  const rows = await db.select({
      id: goals.id,
      type: goals.type,
      title: goals.title,
      month: goals.month,
      position: goals.position,
      targetCount: goals.targetCount,
      currentCount: goals.currentCount,
      targetDays: goals.targetDays,
      tasks: sql<Array<{ id: string; label: string; isDone: boolean; position: number }> | null>`(
        SELECT coalesce(
          json_agg(json_build_object(
            'id', t.id, 'label', t.label, 'isDone', t.is_done, 'position', t.position
          ) ORDER BY t.position ASC, t.created_at ASC),
          '[]'::json
        )
        FROM ${tasks} t WHERE t.goal_id = ${goals.id}
      )`.as("tasks"),
      checkIns: sql<string[] | null>`(
        SELECT coalesce(array_agg(h.check_in_date::text ORDER BY h.check_in_date ASC), ARRAY[]::text[])
        FROM ${habitCheckIns} h WHERE h.goal_id = ${goals.id}
      )`.as("check_ins"),
    })
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.month, month.toISOString().slice(0, 10))))
    .orderBy(asc(goals.position), asc(goals.createdAt))

  return rows.map((r) => {
    switch (r.type) {
      case "count":
        return {
          id: r.id,
          type: "count",
          title: r.title,
          month: new Date(r.month),
          position: r.position,
          targetCount: r.targetCount!,
          currentCount: r.currentCount!,
        }
      case "checklist":
        return {
          id: r.id,
          type: "checklist",
          title: r.title,
          month: new Date(r.month),
          position: r.position,
          tasks: (r.tasks ?? []).map((t) => ({ id: t.id, label: t.label, isDone: t.isDone, position: t.position })),
        } as Goal
      case "habit":
        return {
          id: r.id,
          type: "habit",
          title: r.title,
          month: new Date(r.month),
          position: r.position,
          targetDays: r.targetDays!,
          checkIns: r.checkIns ?? [],
        }
    }
  }) as Goal[]
}
