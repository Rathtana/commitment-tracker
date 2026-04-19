"use server"

import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"
import {
  signUpSchema,
  signInSchema,
  resetRequestSchema,
  updatePasswordSchema,
  type SignUpInput,
  type SignInInput,
  type ResetRequestInput,
  type UpdatePasswordInput,
} from "@/lib/schemas/auth"

type ActionResult = { error?: string }

function siteUrl() {
  // NEXT_PUBLIC_SITE_URL is optional — dev falls back to localhost.
  // Must match the Redirect URL allow-list configured in Plan 01-01 checkpoint.
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
}

// ---------- signUpAction ----------
export async function signUpAction(
  input: SignUpInput,
): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Invalid input. Please check the form." }
  }
  const { email, password, timezone } = parsed.data

  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/auth/verify`,
    },
  })
  if (error) {
    // Supabase returns "User already registered" for existing email
    if (error.message.toLowerCase().includes("already")) {
      return {
        error:
          "An account with that email already exists. Sign in instead.",
      }
    }
    return { error: "Something went wrong. Please try again." }
  }

  // Two-step write: the on_auth_user_created trigger (Plan 01-03) creates
  // public.users with timezone='UTC'. We patch the timezone now — the await
  // on signUp guarantees the row is visible (PATTERNS.md Pitfall 5).
  const userId = data.user?.id
  if (userId && timezone && timezone !== "UTC") {
    try {
      await db
        .update(users)
        .set({ timezone, updatedAt: new Date() })
        .where(eq(users.id, userId))
    } catch {
      // Non-fatal: user can update timezone later in settings.
      // Signup already succeeded; don't surface to the user.
    }
  }

  return {}
}

// ---------- signInAction ----------
export async function signInAction(
  input: SignInInput,
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Invalid email or password." }
  }
  const { email, password } = parsed.data

  const supabase = await getSupabaseServerClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) {
    return { error: "Invalid email or password." }
  }

  // D-16: email verification is required before login. If the user is
  // unverified, sign out so we don't leave a half-session cookie behind.
  if (!data.user?.email_confirmed_at) {
    await supabase.auth.signOut()
    return {
      error:
        "Please verify your email before signing in. Check your inbox for the verification link.",
    }
  }

  redirect("/")
}

// ---------- signOutAction ----------
export async function signOutAction(): Promise<void> {
  const supabase = await getSupabaseServerClient()
  await supabase.auth.signOut()
  redirect("/login")
}

// ---------- requestPasswordResetAction ----------
export async function requestPasswordResetAction(
  input: ResetRequestInput,
): Promise<ActionResult> {
  const parsed = resetRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Enter a valid email address" }
  }
  const { email } = parsed.data

  const supabase = await getSupabaseServerClient()

  // Supabase returns success regardless of whether the email exists —
  // which is the desired behavior (prevents user enumeration per UI-SPEC).
  // 15-min + single-use expiry is enforced by Supabase (D-17 / Plan 01-01 checkpoint).
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/auth/reset/complete`,
  })

  return {}
}

// ---------- updatePasswordAction ----------
export async function updatePasswordAction(
  input: UpdatePasswordInput,
): Promise<ActionResult> {
  const parsed = updatePasswordSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Invalid input. Please check the form." }
  }
  const { password } = parsed.data

  const supabase = await getSupabaseServerClient()

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    // Session lapsed or reset link expired
    if (
      error.message.toLowerCase().includes("not authenticated") ||
      error.message.toLowerCase().includes("expired")
    ) {
      return { error: "This reset link has expired. Request a new one." }
    }
    return { error: "Something went wrong. Please try again." }
  }

  redirect("/login?reset=success")
}
