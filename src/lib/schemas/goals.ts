import { z } from "zod"

/**
 * Canonical Zod schemas for every goal + progress surface.
 * Imported by:
 *   - Server actions (src/server/actions/goals.ts, src/server/actions/progress.ts) for server-side re-validation
 *   - Client forms (Plan 02-03 create/edit dialog, Plan 02-04 backfill popover) via zodResolver for client-side validation
 *
 * Error copy is verbatim from 02-UI-SPEC.md §Copywriting Contract Create Dialog —
 * changing a string here changes every form that imports it.
 *
 * Month is server-derived (D-17, 02-RESEARCH.md Pitfall 9) — monthBucket(new Date(), user.timezone)
 * inside the server action. Month is NOT a form input.
 */

// ---------- Shared fields ----------
export const titleField = z.string().min(1, "Name is required").max(200, "Title is too long")
export const notesField = z.string().max(2000, "Notes are too long").optional()
export const targetCountField = z.number().int("Target must be a whole number").positive("Target must be greater than 0")
export const targetDaysField = z.number().int("Goal must be a whole number").min(1, "Goal must be at least 1").max(31, "Goal can be at most 31")
export const goalIdField = z.string().uuid()
export const undoIdField = z.string().uuid()
export const isoDateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date")

// ---------- Create (discriminated union) ----------
const baseCreateGoal = z.object({
  title: titleField,
  notes: notesField,
})

export const createCountGoalSchema = baseCreateGoal.extend({
  type: z.literal("count"),
  targetCount: targetCountField,
})

export const createChecklistGoalSchema = baseCreateGoal.extend({
  type: z.literal("checklist"),
  tasks: z
    .array(
      z.object({
        label: z.string().min(1, "Task name is required"),
        position: z.number().int().nonnegative(),
      }),
    )
    .min(1, "Add at least one task."),
})

export const createHabitGoalSchema = baseCreateGoal.extend({
  type: z.literal("habit"),
  targetDays: targetDaysField,
})

export const createGoalSchema = z.discriminatedUnion("type", [
  createCountGoalSchema,
  createChecklistGoalSchema,
  createHabitGoalSchema,
])

// ---------- Update (discriminated union — type read-only but included for narrowing) ----------
export const updateCountGoalSchema = createCountGoalSchema.extend({ goalId: goalIdField })
export const updateChecklistGoalSchema = createChecklistGoalSchema.extend({ goalId: goalIdField })
export const updateHabitGoalSchema = createHabitGoalSchema.extend({ goalId: goalIdField })
export const updateGoalSchema = z.discriminatedUnion("type", [
  updateCountGoalSchema,
  updateChecklistGoalSchema,
  updateHabitGoalSchema,
])

// ---------- Delete ----------
export const deleteGoalSchema = z.object({ goalId: goalIdField })

// ---------- Progress mutations ----------
export const incrementCountSchema = z.object({
  goalId: goalIdField,
  delta: z.number().int().refine((n) => n !== 0, "Delta cannot be zero"),
  undoId: undoIdField,
})

export const toggleTaskSchema = z.object({
  goalId: goalIdField,
  taskId: z.string().uuid(),
  isDone: z.boolean(),
  undoId: undoIdField,
})

export const upsertHabitCheckInSchema = z.object({
  goalId: goalIdField,
  checkInDate: isoDateField,
  isChecked: z.boolean(),
  undoId: undoIdField,
})

export const backfillCountSchema = z.object({
  goalId: goalIdField,
  loggedLocalDate: isoDateField,
  delta: z.number().int().refine((n) => n !== 0, "Delta cannot be zero"),
  undoId: undoIdField,
})

export const undoLastMutationSchema = z.object({
  undoId: undoIdField,
})

// ---------- Type exports ----------
export type CreateGoalInput = z.infer<typeof createGoalSchema>
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>
export type DeleteGoalInput = z.infer<typeof deleteGoalSchema>
export type IncrementCountInput = z.infer<typeof incrementCountSchema>
export type ToggleTaskInput = z.infer<typeof toggleTaskSchema>
export type UpsertHabitCheckInInput = z.infer<typeof upsertHabitCheckInSchema>
export type BackfillCountInput = z.infer<typeof backfillCountSchema>
export type UndoLastMutationInput = z.infer<typeof undoLastMutationSchema>
