import { NextResponse, type NextRequest } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase/server"

/**
 * Supabase email-verify + password-reset PKCE callback.
 *
 * Email-verify link (from signUpAction): ?code=...&next=/auth/verify
 * Password-reset link (from requestPasswordResetAction): ?code=...&next=/auth/reset/complete
 *
 * On success: redirect to the `next` path (same origin — `${origin}${next}`
 * prevents cross-domain open-redirect). On failure: redirect to /auth/error.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/auth/verify"

  if (code) {
    const supabase = await getSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
