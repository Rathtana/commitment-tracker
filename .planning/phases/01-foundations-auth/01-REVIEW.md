---
phase: 01-foundations-auth
reviewed: 2026-04-17T00:00:00Z
depth: standard
files_reviewed: 48
files_reviewed_list:
  - drizzle.config.ts
  - next.config.ts
  - package.json
  - postcss.config.mjs
  - tsconfig.json
  - vitest.config.ts
  - eslint.config.mjs
  - components.json
  - .env.example
  - .gitignore
  - src/app/(auth)/auth/error/page.tsx
  - src/app/(auth)/auth/reset/complete/page.tsx
  - src/app/(auth)/auth/reset/page.tsx
  - src/app/(auth)/auth/verify/page.tsx
  - src/app/(auth)/layout.tsx
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/signup/page.tsx
  - src/app/auth/callback/route.ts
  - src/app/globals.css
  - src/app/layout.tsx
  - src/app/page.tsx
  - src/components/auth/login-form.tsx
  - src/components/auth/password-input.tsx
  - src/components/auth/reset-password-form.tsx
  - src/components/auth/signup-form.tsx
  - src/components/auth/update-password-form.tsx
  - src/components/ui/alert.tsx
  - src/components/ui/button.tsx
  - src/components/ui/card.tsx
  - src/components/ui/form.tsx
  - src/components/ui/input.tsx
  - src/components/ui/label.tsx
  - src/lib/schemas/auth.ts
  - src/lib/supabase/server.ts
  - src/lib/time.ts
  - src/lib/utils.ts
  - src/middleware.ts
  - src/server/actions/auth.ts
  - src/server/db/index.ts
  - src/server/db/schema.ts
  - supabase/migrations/0000_initial_schema.sql
  - supabase/migrations/0001_custom_constraints.sql
  - tests/actions.auth.test.ts
  - tests/auth.forms.shape.test.ts
  - tests/rls.test.ts
  - tests/schemas.auth.test.ts
  - tests/time.test.ts
findings:
  critical: 2
  warning: 6
  info: 7
  total: 15
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-17
**Depth:** standard
**Files Reviewed:** 48
**Status:** issues_found

## Summary

Phase 01 (Foundations & Auth) is well-structured and defensively coded overall: Zod
schemas mirror UI-SPEC error copy verbatim, RLS policies are defined in Drizzle and
generated into migration SQL with parity, the `handle_new_user` trigger uses
`SECURITY DEFINER SET search_path = ''` per PostgreSQL hardening guidance, and the
middleware correctly uses `supabase.auth.getUser()` (not cached claims) to refresh
sessions per `@supabase/ssr` 0.10.

Two security-impacting issues deserve attention before this ships to a public URL:

1. **Middleware drops refreshed Supabase session cookies on any redirect** — both the
   "redirect unauthenticated → /login" and "redirect authenticated → /" branches
   return a brand-new `NextResponse.redirect()` that doesn't carry forward the
   cookies that `createServerClient().setAll` wrote onto the original `response`.
   This is the canonical `@supabase/ssr` Next.js middleware foot-gun and causes
   token-refresh data loss on redirected requests.
2. **`/auth/callback` forwards the `next` query param without validating it's a
   safe same-origin path** — `${origin}${next}` with `next = "//evil.com"` becomes
   `https://your-site.com//evil.com`, which most browsers + Next treat as
   protocol-relative and redirect off-origin. This is a classic open-redirect vector
   on the auth callback — an attacker can craft a phishing flow that uses your
   domain as a trust-bounce.

Warnings cover user-enumeration on signup, fragile error-message string matching,
timezone trust boundary, `??` semantics on an env-var fallback, and the dev-only
`http://localhost:3000` siteUrl fallback that would quietly mis-configure email
redirects in production.

No test files are flagged — they assert the contracts they claim to assert.

## Critical Issues

### CR-01: Middleware discards refreshed Supabase session cookies on redirect

**File:** `src/middleware.ts:58-76`
**Issue:** `createServerClient` writes refreshed-token cookies onto `response`
(line 21) via the `setAll` callback. When the middleware decides to redirect
(lines 58-62 unauth → /login, and lines 67-76 auth → /), it constructs a brand-new
`NextResponse.redirect(url)` and returns it. The original `response` — and the
refresh cookies it carries — are thrown away. Any time `getUser()` refreshes an
expired access token AND the request also triggers a redirect, the browser never
receives the new cookies, so the next request repeats the refresh (or fails auth
entirely). This is the documented pitfall in `@supabase/ssr` 0.10 Next.js guidance.

**Fix:** Copy cookies from `response` onto the redirect response before returning.
```ts
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll().map((c) => ({ name: c.name, value: c.value })),
      setAll: (cookiesToSet) => {
        // Mirror onto BOTH the request (so supabase-js sees them immediately)
        // and the response (so the browser gets them).
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const isAuthRoute = AUTH_ROUTES.has(pathname)
  const isCallback = pathname.startsWith("/auth/callback")
  const isPublic = isAuthRoute || isCallback

  if (!user && !isPublic) {
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url))
    // CRITICAL: forward refreshed cookies onto the redirect.
    response.cookies.getAll().forEach((c) =>
      redirectResponse.cookies.set(c.name, c.value, c),
    )
    return redirectResponse
  }

  if (user && isAuthRoute && pathname !== "/auth/reset/complete" && pathname !== "/auth/verify") {
    const redirectResponse = NextResponse.redirect(new URL("/", request.url))
    response.cookies.getAll().forEach((c) =>
      redirectResponse.cookies.set(c.name, c.value, c),
    )
    return redirectResponse
  }

  return response
}
```

### CR-02: Open-redirect via unvalidated `next` param in `/auth/callback`

**File:** `src/app/auth/callback/route.ts:14-23`
**Issue:** `const next = searchParams.get("next") ?? "/auth/verify"` is interpolated
into the redirect target as `${origin}${next}`. The only validation is `?? default`,
which only triggers on missing — not malicious. Crafted values break containment:
- `next = "//attacker.com/phish"` → `${origin}//attacker.com/phish`, which the URL
  parser + Next's redirect treat as `https://attacker.com/phish` (protocol-relative).
- `next = "/\\attacker.com"` → some browser URL parsers fold `\` to `/`.
- `next = "https://attacker.com"` → if `origin` is empty-ish edge case, concat fails
  open.

Because the callback is publicly reachable and appears in Supabase-sent emails, an
attacker who can trigger an email flow (signup with attacker-controlled address,
then forward the verify link) has a working open-redirect on your domain — a phishing
primitive that pivots off your brand.

**Fix:** Allow-list `next` to same-origin paths only. Reject protocol-relative and
absolute URLs.
```ts
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const rawNext = searchParams.get("next") ?? "/auth/verify"

  // Only allow paths that start with a single "/" and are not protocol-relative.
  // Additional allow-list: only the two known post-auth destinations.
  const ALLOWED_NEXT = new Set(["/auth/verify", "/auth/reset/complete"])
  const next = ALLOWED_NEXT.has(rawNext) ? rawNext : "/auth/verify"

  if (code) {
    const supabase = await getSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, origin))
    }
  }
  return NextResponse.redirect(new URL("/auth/error", origin))
}
```
Using `new URL(next, origin)` with a path that's guaranteed to start with a single
`/` forces same-origin resolution and rejects all the escape patterns above.

## Warnings

### WR-01: User enumeration leak in signup error path

**File:** `src/server/actions/auth.ts:46-55`
**Issue:** Signup returns a distinct error when the email is already registered
("An account with that email already exists. Sign in instead."). Combined with
`requestPasswordResetAction` — which is explicitly designed to NOT leak enumeration
(comment on line 128-130) — this asymmetry is itself the leak: an attacker hits
`/signup` with a list of emails and gets a boolean "registered / not registered"
oracle per email. Supabase 2.x also exposes this via the error string, but the
product can choose not to surface it.

**Fix:** Either return a generic success (mirroring the reset-email path) and let
Supabase's duplicate-email email template inform the real owner, or at minimum
align the copy with a neutral message:
```ts
if (error) {
  // Do not distinguish "already registered" from other failures — prevents
  // enumeration and matches the anti-enumeration stance of
  // requestPasswordResetAction.
  return { error: "Something went wrong. Please try again." }
}
```
Note: Supabase's default behavior when an email is re-registered is to send a
"someone tried to sign you up again" notice to the existing account — pairing
with that behavior, the generic error is sufficient.

### WR-02: Error classification relies on substring match of Supabase error messages

**File:** `src/server/actions/auth.ts:48,153-157`
**Issue:** Both `signUpAction` and `updatePasswordAction` branch on
`error.message.toLowerCase().includes("already")` / `.includes("expired")`. Supabase
does not contract these strings — they change across versions and locales. A future
`@supabase/supabase-js` upgrade can silently turn the "reset link expired" message
into "Something went wrong" for users whose link actually did expire.

**Fix:** Use the structured `error.status`, `error.code`, or `error.name` fields
from `AuthError`. For password-reset-expired specifically, `error.status === 401`
or `error.code === "session_not_found"` / `"invalid_token"` are stable checks.
```ts
if (error) {
  if (error.status === 401 || error.code === "session_not_found") {
    return { error: "This reset link has expired. Request a new one." }
  }
  return { error: "Something went wrong. Please try again." }
}
```
If the exact code set isn't obvious, log the `error` object once in dev to learn
the shape, then branch on structured fields — not the freeform `message`.

### WR-03: Timezone is trusted from client without IANA validation

**File:** `src/lib/schemas/auth.ts:27` and `src/server/actions/auth.ts:61-71`
**Issue:** `timezone: z.string().min(1).default("UTC")` accepts any non-empty
string, which is written straight into `public.users.timezone`. Drizzle
parameterizes so no SQL injection, but an arbitrary string means downstream
`TZDate(now, userTz)` throws `RangeError: Invalid time zone specified`
(`@date-fns/tz` surface). That failure path today manifests as a server-action
500 on every page load that touches `today()` or `monthBucket()` — a trivial
self-inflicted DoS for any user who tampered with the timezone value (or whose
browser returns a non-IANA value).

**Fix:** Validate against the current browser's supported IANA list at parse time.
```ts
// src/lib/schemas/auth.ts
export const timezoneField = z
  .string()
  .min(1)
  .refine(
    (tz) => {
      try {
        // Throws RangeError on invalid IANA id. Works in Node 20+ and all
        // evergreen browsers.
        new Intl.DateTimeFormat("en-US", { timeZone: tz })
        return true
      } catch {
        return false
      }
    },
    { message: "Invalid timezone" },
  )
  .default("UTC")

export const signUpSchema = z
  .object({
    email: emailField,
    password: passwordField,
    confirmPassword: z.string(),
    timezone: timezoneField,
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
```
This also hardens the future `Settings → timezone` mutation when it lands.

### WR-04: Nullish-coalescing on Supabase anon key misses empty-string env values

**File:** `src/middleware.ts:24-26` and `src/lib/supabase/server.ts:19-21`
**Issue:**
```ts
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
```
`??` only falls through for `null`/`undefined`. `.env` parsers (including Next's)
commonly emit `""` for a defined-but-empty variable. If a developer copies
`.env.example` (where the key is present but empty) without filling `ANON_KEY` but
DOES fill `PUBLISHABLE_KEY`, the middleware/server client will be created with `""`
as the anon key — Supabase will reject the JWT silently and every `getUser()` will
return `{ user: null }`, masking itself as an auth failure, not a config failure.

**Fix:** Use `||` (truthy fallback) or explicitly coerce empty to undefined.
```ts
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
if (!supabaseKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  )
}
```
Fail loudly at module-load, not at token-verify time.

### WR-05: `siteUrl()` falls back to `http://localhost:3000` in any environment

**File:** `src/server/actions/auth.ts:21-25`
**Issue:** If `NEXT_PUBLIC_SITE_URL` is not set in production (Vercel deploy where
the env-var was forgotten), every signup and password-reset email will contain
`http://localhost:3000/auth/callback?...`. Users click → goes nowhere. Supabase's
Redirect URL allow-list on the server side would also reject it, so the error
manifests as a broken verify link — a silent account-onboarding failure.

**Fix:** In production, require the env var; only fall back to localhost when
`NODE_ENV !== "production"`.
```ts
function siteUrl() {
  const url = process.env.NEXT_PUBLIC_SITE_URL
  if (url) return url
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_SITE_URL must be set in production")
  }
  return "http://localhost:3000"
}
```
Vercel also exposes `VERCEL_URL` at build/runtime — you can use
`process.env.VERCEL_URL ? \`https://${process.env.VERCEL_URL}\` : ...` as a
secondary fallback if preview deploys should auto-wire.

### WR-06: `signOutAction` has no error handling; auth-failure crashes the page

**File:** `src/server/actions/auth.ts:110-114`
**Issue:** `await supabase.auth.signOut()` can throw (network blip, expired session,
Supabase downtime). There's no try/catch; the thrown error surfaces as a Next
server-action error boundary in the client — the user sees a red screen instead of
"You've been logged out." `redirect("/login")` never runs, so the session cookie
is not visibly cleared either. For a header-bound "Log out" button this is a poor
UX degradation under transient failure.

**Fix:** Redirect regardless; the user's clear intent is "get me out."
```ts
export async function signOutAction(): Promise<void> {
  try {
    const supabase = await getSupabaseServerClient()
    await supabase.auth.signOut()
  } catch {
    // Non-fatal — we still want to send the user to /login. The next
    // middleware pass will re-validate the cookie and clear it if stale.
  }
  redirect("/login")
}
```

## Info

### IN-01: `PasswordInput` visibility toggle is not keyboard-reachable

**File:** `src/components/auth/password-input.tsx:30`
**Issue:** `tabIndex={-1}` removes the eye-toggle button from the tab order. Keyboard
users cannot toggle password visibility; screen-reader users can still activate it
via an accessibility tree traversal, but many will miss it. This is a mild a11y
regression against the WCAG "keyboard accessible" guideline.
**Fix:** Remove `tabIndex={-1}`. Rationale for keeping it out of the tab order is
weak — the conventional pattern is for the toggle to be focusable. If you want to
skip it on initial tab to keep password-field → submit flow clean, consider
`tabIndex={0}` (default) and let users opt-in.

### IN-02: `signUpAction` writes `updatedAt: new Date()` manually instead of SQL default

**File:** `src/server/actions/auth.ts:65`
**Issue:** `.set({ timezone, updatedAt: new Date() })` — `new Date()` is computed on
the Node server clock, which can drift from Postgres `NOW()`. For this specific row
that drift is invisible, but the pattern tends to metastasize. With Drizzle you can
write `updatedAt: sql\`now()\`` so the DB is the single clock source.
**Fix:** Low priority stylistic — consistent with how `defaultNow()` is used
elsewhere in the schema.

### IN-03: `today()` and `monthBucket()` use `format()` then `new Date()` — fragile timezone roundtrip

**File:** `src/lib/time.ts:24-26`
**Issue:** `new Date(format(first, 'yyyy-MM-dd') + 'T00:00:00.000Z')` is a
stringified roundtrip through UTC to "strip" the TZDate wrapper. It works (the
tests prove it) but it's indirect — a future reader sees UTC concatenation in a
timezone-aware function and reasonably worries. Consider
`new Date(Date.UTC(first.getFullYear(), first.getMonth(), 1))` for a more explicit
construction, or keep a comment block above that references the test fixture that
locks the behavior in.
**Fix:** Refactor only if a bug shows up; the tests provide strong regression cover.

### IN-04: `redirect("/")` in `signInAction` short-circuits return path but compiler still infers ActionResult

**File:** `src/server/actions/auth.ts:77-107`
**Issue:** `signInAction` returns `ActionResult` but on success throws (via Next's
`redirect` sentinel) and never returns. On the client, `result?.error` is
optional-chained, so this is fine at runtime — but the lack of an unreachable
`return` makes the intent less obvious.
**Fix:** Low priority. Adding `// redirect throws; unreachable below` as a comment
above the close-brace of the function is cheap clarity.

### IN-05: `ActionResult` is structurally `{ error?: string }` — callers can't distinguish "no-op success" from "malformed response"

**File:** `src/server/actions/auth.ts:19`
**Issue:** A future bug where an action accidentally returns `undefined` or throws
without the `error` field would look identical to success to any caller using
`result?.error`. A typed discriminated union (`{ ok: true } | { ok: false; error:
string }`) makes intent explicit.
**Fix:** Optional refactor; matters more as the action surface grows beyond 5.

### IN-06: `/auth/callback` does not log the `exchangeCodeForSession` error before redirecting to `/auth/error`

**File:** `src/app/auth/callback/route.ts:20-23`
**Issue:** When `exchangeCodeForSession` fails, the user lands on `/auth/error` with
no telemetry. In production this is fine (we don't want error details leaked to the
user), but for debugging real-user reports you'll want at least a `console.error`
that Vercel's logs capture.
**Fix:**
```ts
if (code) {
  const supabase = await getSupabaseServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (!error) return NextResponse.redirect(new URL(next, origin))
  console.error("[auth/callback] exchangeCodeForSession failed", {
    code: error.code, status: error.status, name: error.name,
  })
}
```
(Log structured fields, never the message or the `code` param itself.)

### IN-07: Drizzle schema does not explicitly call `enableRLS()` — relies on implicit policy-triggered enable

**File:** `src/server/db/schema.ts:15-95`
**Issue:** The research note in `01-RESEARCH.md` (lines 947-950) deliberately avoids
`enableRLS()` vs `withRLS()` by counting on Drizzle to emit `ENABLE ROW LEVEL
SECURITY` whenever `pgPolicy` appears on the table. The generated migration
(`0000_initial_schema.sql` lines 13, 21) confirms this worked. If a future version
of Drizzle changes that behavior (or a developer removes all policies on a table
temporarily while refactoring), RLS could silently disable. This is a contract with
Drizzle that's worth documenting inline.
**Fix:** Add a comment above each `pgTable` noting the implicit enable, and consider
a migration-lint check (query `pg_class.relrowsecurity` post-deploy — the RLS tests
in `tests/rls.test.ts` provide this indirectly but don't assert it explicitly).

---

_Reviewed: 2026-04-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
