import { z } from "zod"

/**
 * Canonical Zod schemas for every auth surface.
 * Imported by:
 *   - Server actions (src/server/actions/auth.ts) for server-side re-validation
 *   - Client forms (Plan 01-05) via zodResolver for client-side validation
 *
 * Error copy is verbatim from 01-UI-SPEC.md per-surface validation rules —
 * changing a string here changes every form that imports it.
 */

export const emailField = z
  .string()
  .email("Enter a valid email address")

export const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")

export const signUpSchema = z
  .object({
    email: emailField,
    password: passwordField,
    confirmPassword: z.string(),
    timezone: z.string().min(1).default("UTC"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Enter your password"),
})

export const resetRequestSchema = z.object({
  email: emailField,
})

export const updatePasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export type SignUpInput = z.infer<typeof signUpSchema>
export type SignInInput = z.infer<typeof signInSchema>
export type ResetRequestInput = z.infer<typeof resetRequestSchema>
export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>
