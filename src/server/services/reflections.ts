import { sql } from "drizzle-orm"
import { db } from "@/server/db"
import { monthReflections } from "@/server/db/schema"
import type { UpsertReflectionInput } from "@/lib/schemas/reflections"

export class FutureMonthReflectionError extends Error {
  constructor() {
    super("Reflections aren't available for future months.")
  }
}

export async function upsertReflection(
  userId: string,
  input: UpsertReflectionInput,
): Promise<{ savedAt: Date }> {
  const [row] = await db
    .insert(monthReflections)
    .values({
      userId,
      month: input.month,
      whatWorked: input.whatWorked,
      whatDidnt: input.whatDidnt,
    })
    .onConflictDoUpdate({
      target: [monthReflections.userId, monthReflections.month],
      set: {
        whatWorked: input.whatWorked,
        whatDidnt: input.whatDidnt,
        updatedAt: sql`now()`,
      },
    })
    .returning({ savedAt: monthReflections.updatedAt })
  return { savedAt: row.savedAt }
}
