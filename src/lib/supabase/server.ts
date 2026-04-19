import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

/**
 * Builds a Supabase server client for use inside Server Actions or RSC.
 * Uses next/headers cookies() — do NOT import this from middleware
 * (middleware uses request.cookies / response.cookies instead).
 *
 * Critical: uses the getAll/setAll cookie pattern (not get/set/remove),
 * which @supabase/ssr 0.10 requires for token refresh to persist.
 *
 * Reads NEXT_PUBLIC_SUPABASE_ANON_KEY (canonical in plan docs) with
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as fallback — both point at the
 * same sb_publishable_* value per Plan 01-01 decision.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Called from a Server Component that cannot set cookies — safe to ignore
          // if middleware is refreshing sessions (per @supabase/ssr docs).
        }
      },
    },
  })
}
