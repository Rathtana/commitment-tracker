import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

/**
 * Auth surfaces — pathnames that should be accessible to unauthenticated users
 * AND (with a few exceptions) redirect logged-in users AWAY from them.
 *
 * Route-group parens like (auth) / (protected) do NOT appear in request.nextUrl.pathname
 * (PATTERNS.md CRITICAL RULES) — we match real URLs like "/login", never "/(auth)/login".
 */
const AUTH_ROUTES = new Set<string>([
  "/login",
  "/signup",
  "/auth/reset",
  "/auth/reset/complete",
  "/auth/verify",
  "/auth/error",
])

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () =>
        request.cookies.getAll().map((c) => ({
          name: c.name,
          value: c.value,
        })),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  // CRITICAL: getUser() is the only correct API here — refreshes the session
  // if expired and validates JWT signature server-side. Must run on every
  // request or RSC session reads will see stale/expired users (Pitfalls 1 + 2).
  // Do NOT swap this for the cached-claims alternative (forbidden server-side).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isAuthRoute = AUTH_ROUTES.has(pathname)
  const isCallback = pathname.startsWith("/auth/callback")
  const isPublic = isAuthRoute || isCallback

  // Redirect unauthenticated users to /login for any protected path
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Redirect logged-in users away from auth surfaces,
  // EXCEPT /auth/reset/complete (requires a live session from /auth/callback)
  // and /auth/verify (confirmation landing for the verify link).
  if (
    user &&
    isAuthRoute &&
    pathname !== "/auth/reset/complete" &&
    pathname !== "/auth/verify"
  ) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
