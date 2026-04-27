import { z } from 'zod'

/**
 * Canonical Zod schemas for POLSH-04 reflections.
 * Server schema (upsertReflectionSchema) transforms empty/whitespace → null (D-30).
 * Client schema (reflectionFormSchema) preserves raw strings for the char counter + RHF `watch`.
 * Error copy is verbatim from 03-UI-SPEC.md §Error / Rollback Copy.
 */

// Server-side field: nullable + empty/whitespace → null transform (D-30).
// Using .nullable() directly on the string field preserves the .max() error message
// (z.union loses inner messages when both branches fail).
const reflectionFieldServer = z
  .string()
  .max(280, "That's a bit long — try trimming it to under 280 characters.")
  .transform((s) => (s.trim() === '' ? null : s))
  .nullable()

export const upsertReflectionSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid month'),
  whatWorked: reflectionFieldServer.optional().transform((v) => v ?? null),
  whatDidnt: reflectionFieldServer.optional().transform((v) => v ?? null),
})

// Client-side: raw strings, no transforms — the counter displays `whatWorked.length` live.
export const reflectionFormSchema = z.object({
  whatWorked: z.string().max(280, "That's a bit long — try trimming it to under 280 characters."),
  whatDidnt: z.string().max(280, "That's a bit long — try trimming it to under 280 characters."),
})

export type UpsertReflectionInput = z.infer<typeof upsertReflectionSchema>
export type ReflectionFormInput = z.infer<typeof reflectionFormSchema>
