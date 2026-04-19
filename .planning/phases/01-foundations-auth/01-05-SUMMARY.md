---
phase: 01-foundations-auth
plan: 05
subsystem: auth
tags: [ui, auth-forms, shadcn, react-hook-form, zod, tailwind-v4]

requires:
  - phase: 01-foundations-auth
    plan: 01
    provides: "Next 16 scaffold + shadcn (Button, Card, Input, Label, Form, Alert) + Tailwind v4 @theme tokens + Geist font"
  - phase: 01-foundations-auth
    plan: 03
    provides: "public.goals with GOAL-04 CHECK + RLS policies — exercised directly by UAT Scenario 7 in the Supabase SQL Editor"
  - phase: 01-foundations-auth
    plan: 04
    provides: "5 server actions (signUp/signIn/signOut/requestPasswordReset/updatePassword), 4 Zod schemas, middleware, /auth/callback, @/ vitest alias"
provides:
  - "src/app/(auth)/layout.tsx — shared centered-card layout (max-w-sm) for all 5 auth surfaces"
  - "src/app/(auth)/login/page.tsx — Server Component with ?reset=success one-time Alert + LoginForm"
  - "src/app/(auth)/signup/page.tsx — SignUpForm wrapper"
  - "src/app/(auth)/auth/reset/page.tsx — ResetPasswordForm wrapper (AUTH-05 request side)"
  - "src/app/(auth)/auth/reset/complete/page.tsx — UpdatePasswordForm wrapper (post-PKCE callback)"
  - "src/app/(auth)/auth/verify/page.tsx — 'Email verified' success Server Component (AUTH-02)"
  - "src/app/(auth)/auth/error/page.tsx — 'Verification failed' Server Component"
  - "src/app/page.tsx — D-02-compliant landing stub: 'Welcome, {email}' + outline logout + 'Your goals are coming in Phase 2.'"
  - "src/components/auth/password-input.tsx — 44x44 Eye/EyeOff toggle with dynamic aria-label"
  - "src/components/auth/login-form.tsx — RHF + zodResolver(signInSchema) → signInAction"
  - "src/components/auth/signup-form.tsx — RHF + zodResolver(signUpSchema) + Intl.DateTimeFormat timezone capture → signUpAction"
  - "src/components/auth/reset-password-form.tsx — RHF + zodResolver(resetRequestSchema) → requestPasswordResetAction"
  - "src/components/auth/update-password-form.tsx — RHF + zodResolver(updatePasswordSchema) → updatePasswordAction"
  - "tests/auth.forms.shape.test.ts — 5 shape assertions locking component exports"
affects: [02-goals, 02-goal-create, 03-progress, 04-dashboard]

tech-stack:
  added: []
  patterns:
    - "Zod 4 input/output divergence with RHF: schemas using z.default() produce a z.input<> shape that differs from z.infer<> (= output). RHF holds form state in the input shape; server actions consume the output shape. SignUpForm types useForm<z.input<typeof signUpSchema>>, then casts/augments at submit to match SignUpInput. Downstream forms follow the same pattern for any schema with defaults."
    - "Client-side timezone capture at submit time (not form init): signup-form reads Intl.DateTimeFormat().resolvedOptions().timeZone inside onSubmit and merges into the action payload. Default value 'UTC' in RHF defaults keeps the schema type happy even before the capture runs."
    - "Route-group elision invariant: src/app/(auth)/layout.tsx applies to all children regardless of sub-path, so nesting /auth/verify under src/app/(auth)/auth/verify/ keeps the shared card layout while producing the /auth/* URLs that middleware + server actions expect."
    - "Tailwind v4 @theme collision rule: do NOT define --spacing-xs/--spacing-sm/... named tokens in @theme. Tailwind v4 derives max-w-sm/md/lg AND padding/gap/space utilities from these names × --spacing multiplier. Overriding them collapses max-w-* to the literal override value. Only define --color-*, --font-*, and the singular --spacing if a custom base unit is wanted."

key-files:
  created:
    - src/components/auth/password-input.tsx
    - src/components/auth/login-form.tsx
    - src/components/auth/signup-form.tsx
    - src/components/auth/reset-password-form.tsx
    - src/components/auth/update-password-form.tsx
    - src/app/(auth)/layout.tsx
    - src/app/(auth)/login/page.tsx
    - src/app/(auth)/signup/page.tsx
    - src/app/(auth)/auth/reset/page.tsx
    - src/app/(auth)/auth/reset/complete/page.tsx
    - src/app/(auth)/auth/verify/page.tsx
    - src/app/(auth)/auth/error/page.tsx
    - tests/auth.forms.shape.test.ts
  modified:
    - src/app/page.tsx
    - src/app/globals.css
    - .planning/phases/01-foundations-auth/01-UI-SPEC.md

key-decisions:
  - "Zod 4 + RHF type inference gap handled via z.input<typeof schema> as the form-state type (not z.infer which returns output). SignUpForm types useForm<z.input<typeof signUpSchema>> and merges the runtime timezone at onSubmit to match the action's SignUpInput output type. Avoids `as any` casts and keeps full type-safety inside the form."
  - "Auth route paths: reset/verify/error nested UNDER src/app/(auth)/auth/ (not at (auth) root) because Plan 04 middleware AUTH_ROUTES + server action redirectTo URLs hardcode /auth/* paths. Route-group paren elision means the shared card layout still applies; the physical path just mirrors the URL."
  - "Tailwind v4 --spacing-* named tokens are reserved — removing them from globals.css @theme restored max-w-sm to its 384px default. The UI-SPEC has been corrected in the same fix commit so Phases 2/3/4 do not re-introduce the collision."

patterns-established:
  - "Auth form skeleton (shared across all 4 forms): 'use client' → useForm<SchemaInput>({ resolver: zodResolver(schema) }) → FormField per field using shadcn Form primitives → PasswordInput where relevant → destructive Alert aria-live='polite' for errors.root.message → Button with Loader2 spinner when isSubmitting."
  - "Server-action return contract: { error?: string } means error branch; no-error = server has redirected (control does not return). Forms only call setError('root', { message }) on error; successful submits rely on the server-side redirect."
  - "Tailwind v4 token hygiene: in globals.css @theme, scope custom tokens to --color-*, --font-*, and semantic design tokens. NEVER override --spacing-xs/sm/md/lg/xl/2xl (they power max-w, w-, h-, p-, m-, gap-, space-). The singular --spacing base unit IS safe to override."

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05]

duration: "~26min (incl. ~22min UAT checkpoint)"
completed: 2026-04-19
---

# Phase 01 Plan 05: Auth UI + Landing Stub Summary

**All 5 client auth forms (login, signup, reset-request, reset-complete, update-password, shared PasswordInput), the (auth) centered-card layout, 6 auth route pages under /auth/*, and the D-02-compliant landing stub — all wired to Plan 04 server actions, tested green against Supabase dev, and UAT-approved across 8 blocking scenarios.**

## Performance

- **Duration:** ~26 min wall-clock (primary agent build ~4 min; UAT checkpoint + token-collision fix ~22 min)
- **Started:** 2026-04-19T04:01:27Z (first commit `2946176`)
- **Completed:** 2026-04-19T04:26:25Z (checkpoint resume + SUMMARY write)
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify)
- **Files created:** 13 (5 components + 6 pages + 1 layout + 1 test)
- **Files modified:** 3 (src/app/page.tsx, src/app/globals.css, 01-UI-SPEC.md)

## Accomplishments

- **All 6 auth surfaces render per UI-SPEC:** login, signup, reset, reset/complete, verify, error — each with exact heading copy and max-w-sm card layout
- **Landing stub is D-02-compliant:** exactly one heading + one tagline + logout button, zero dashboard scaffolding
- **Full end-to-end auth loop verified against live Supabase dev project:** signup → email verify → login → landing → logout → reset → update → relogin (Scenarios 1-5, 7-9 all passed)
- **GOAL-04 CHECK + cross-user RLS proven end-to-end via Supabase SQL Editor** (UAT Scenario 7) — exercises Plan 03's migration directly
- **npm run build → exit 0:** all 11 routes compiled cleanly
- **npx vitest run → 39/39 passed** (34 prior + 5 new shape tests in auth.forms.shape.test.ts)
- **npx tsc --noEmit → exit 0**
- **Zero client-rendered passwords:** React auto-escape + no dangerouslySetInnerHTML + RHF reset() on success (T-1-05-01, T-1-05-02)
- **44x44 Eye/EyeOff toggle** with dynamic aria-label ("Show password" ↔ "Hide password")

## Task Commits

1. **Task 1 RED: Failing shape tests for auth UI components** — `2946176` (test) — 5 assertions: PasswordInput, LoginForm, SignUpForm, ResetPasswordForm, UpdatePasswordForm each export the expected component
2. **Task 1 GREEN: Auth client forms + PasswordInput + auth layout** — `7b87638` (feat) — 5 components + (auth)/layout.tsx; handles Zod 4 input/output divergence via z.input<> on SignUpForm
3. **Task 2: 6 auth route pages + D-02 landing stub** — `c4fe900` (feat) — all 6 pages + src/app/page.tsx landing
4. **Task 2 Rule-1 fix: Move reset/verify/error under /auth/*** — `7c6c5ed` (fix) — URLs must match middleware AUTH_ROUTES + server-action redirectTo URLs from Plan 04; moved files into src/app/(auth)/auth/ so URLs are /auth/reset, /auth/verify, /auth/error
5. **Rule-1 fix (applied during UAT checkpoint): Remove colliding --spacing-* tokens** — `d51d2ed` (fix) — Tailwind v4 derives max-w-sm from --spacing-sm; overriding it in @theme collapsed the auth card from 384px to 8px. Removed the named --spacing scale from globals.css AND corrected 01-UI-SPEC.md so downstream phases don't re-ship the bug.

**Plan metadata:** this commit — `docs(01-05): complete auth UI + landing stub plan`

## Files Created/Modified

### Client components (Task 1, commit `7b87638`)
- `src/components/auth/password-input.tsx` — forwardRef wrapper around shadcn Input; 44x44 Eye/EyeOff toggle
- `src/components/auth/login-form.tsx` — SignInInput form; redirects on server-side success
- `src/components/auth/signup-form.tsx` — SignUpInput form; Intl.DateTimeFormat timezone capture on submit; local success state with UI-SPEC verify-email copy
- `src/components/auth/reset-password-form.tsx` — ResetRequestInput form; local sent state with enumeration-safe copy
- `src/components/auth/update-password-form.tsx` — UpdatePasswordInput form; server redirects to /login?reset=success

### Layout (Task 1, commit `7b87638`)
- `src/app/(auth)/layout.tsx` — `<main>` with flex min-h-screen items-center justify-center + max-w-sm card wrapper + "Commitment Tracker" wordmark

### Pages (Task 2, commits `c4fe900` and `7c6c5ed`)
- `src/app/(auth)/login/page.tsx` — Server Component: reads awaitable `searchParams.reset` + renders one-time Alert above LoginForm
- `src/app/(auth)/signup/page.tsx` — SignUpForm wrapper
- `src/app/(auth)/auth/reset/page.tsx` — ResetPasswordForm wrapper (path corrected in `7c6c5ed`)
- `src/app/(auth)/auth/reset/complete/page.tsx` — UpdatePasswordForm wrapper (path corrected in `7c6c5ed`)
- `src/app/(auth)/auth/verify/page.tsx` — Email-verified Server Component (path corrected in `7c6c5ed`)
- `src/app/(auth)/auth/error/page.tsx` — Verification-failed Server Component (path corrected in `7c6c5ed`)

### Landing (Task 2, commit `c4fe900`)
- `src/app/page.tsx` — Replaced Plan 01 placeholder with D-02 landing stub; calls `getSupabaseServerClient()` + `auth.getUser()`, renders "Welcome, {user.email}" + outline logout form action={signOutAction} + "Your goals are coming in Phase 2."

### Tests (Task 1 RED, commit `2946176`)
- `tests/auth.forms.shape.test.ts` — 5 module-shape assertions (matches Plan 04 TDD pattern — full UI interaction coverage delegated to UAT)

### Modified during UAT fix (commit `d51d2ed`)
- `src/app/globals.css` — removed colliding `--spacing-xs/sm/md/lg/xl/2xl` named tokens (9 lines deleted) so Tailwind's built-in container sizes work
- `.planning/phases/01-foundations-auth/01-UI-SPEC.md` — stripped the named --spacing scale from the @theme example + added a note that Tailwind v4 reserves these tokens for max-w-*/w-*/p-*/gap-*/space-* derivation

## UAT Outcomes (Task 3 checkpoint)

User ran the 8 blocking UAT scenarios against the live Supabase dev project (`npm run dev` on http://localhost:3000) and typed **"approved"** after all passed. Full breakdown:

| # | Scenario | Blocking? | Outcome |
|---|----------|-----------|---------|
| 1 | Happy-path signup (AUTH-01, AUTH-02) — form validation + verification email + public.users.timezone write | blocking | PASSED |
| 2 | Unverified login blocked (AUTH-02 gate) — inline Alert + no auth cookie set | blocking | PASSED |
| 3 | Email verify → /auth/verify → login → / landing → session persists across browser restart (AUTH-02, AUTH-03) | blocking | PASSED |
| 4 | Logout → /login → cookies cleared (AUTH-04) | blocking | PASSED |
| 5 | Password reset happy path + ?reset=success one-time Alert + relogin + SAME reset link single-use failure on second click (AUTH-05) | blocking | PASSED |
| 6 | **16-min reset-link expiry (AUTH-05, D-17)** | async follow-up (non-blocking) | **NOT_YET_OBSERVED** — see below |
| 7 | GOAL-04 CHECK rejects non-first-of-month INSERT + cross-user RLS hides other users' rows (exercises Plan 03 directly via Supabase SQL Editor) | blocking | PASSED |
| 8 | Accessibility smoke: keyboard tab order, emerald focus ring, password toggle aria-label flip, 44x44 touch targets | blocking | PASSED |
| 9 | Stale-token refresh: delete sb-*-auth-token cookie → middleware redirects to /login (AUTH-03 edge) | blocking | PASSED |

### Scenario 6 (async) — Reset-link expiry after 16 minutes

**Status: NOT_YET_OBSERVED at checkpoint resume time.**

Per the Plan 01-05 checkpoint design (T-1-05-10 mitigation), this scenario is explicitly async and does NOT block the resume-signal. The user requested a second reset email during Scenario 5 step "Start a 16-minute timer" (approximate timestamp: during the UAT window ending ~2026-04-19T04:26Z); the second email's link was not clicked. The 16-minute timer will elapse during or shortly after the checkpoint resume.

**Expected behavior when the user eventually clicks the stale link:** lands on /auth/error OR /auth/reset/complete with an expired-link error string ("This reset link has expired. Request a new one." — from Plan 04 `updatePasswordAction` error branch).

**If the link still works after 16 min** → the Supabase dashboard's reset-token validity setting (D-17 = 900 seconds) from Plan 01 checkpoint step 7 is misconfigured. Action: file a gap-closure against Plan 01's Supabase dashboard config (toggle: Authentication → Email Templates → Password recovery → expiry setting).

**This is the only open acceptance item for AUTH-05; server-side enforcement (Supabase 15-min default) + UI error path are already in place.** Marking AUTH-05 complete because the server-side contract is frozen + reset flow passed end-to-end in Scenario 5; the async 16-min observation will be recorded out-of-band (no blocker on phase verification).

## Decisions Made

See `key-decisions` in frontmatter. Primary decision: **Zod 4 input/output divergence handled via `z.input<typeof schema>` as the RHF form-state type.** Zod 4's stricter input/output separation means schemas with `.default()` (like `signUpSchema.timezone = z.string().default('UTC')`) produce different shapes for parsed output vs raw input. RHF holds raw input; the server action consumes parsed output. Typing `useForm<z.input<typeof signUpSchema>>` then mapping to `SignUpInput` at submit (via the timezone capture that always sets a value) keeps both sides type-safe without an `as any` escape hatch.

Secondary: **Auth routes nested under `src/app/(auth)/auth/`** instead of `src/app/(auth)/` directly. The route-group parentheses elide from the URL, so physical file path can add an extra `auth` segment to produce the `/auth/verify`, `/auth/reset`, `/auth/reset/complete`, `/auth/error` URLs that Plan 04's middleware AUTH_ROUTES + server-action redirectTo URLs expect. The shared card layout still applies because layout.tsx lives at the (auth) root.

Tertiary: **Tailwind v4 @theme spacing token hygiene.** The original 01-UI-SPEC.md @theme example included `--spacing-xs: 4px; --spacing-sm: 8px; --spacing-md: 16px; ...`. Tailwind v4 derives max-w-sm (384px) / max-w-md (448px) / max-w-lg (512px) from those same token names — defining them collapsed the auth card to 8px wide. Fix: scope custom tokens to --color-*, --font-*, and the singular --spacing base unit if wanted. Updated UI-SPEC so downstream phases start on the corrected pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Wrong route paths for reset/verify/error pages**
- **Found during:** Task 2 first build
- **Issue:** Plan files placed reset/verify/error at `src/app/(auth)/reset/`, `(auth)/verify/`, `(auth)/error/` — these resolve to `/reset`, `/verify`, `/error` because route-group parens elide. Plan 04's middleware AUTH_ROUTES, `emailRedirectTo` (`${origin}/auth/callback?next=/auth/verify`), and `resetPasswordForEmail` `redirectTo` all hardcode `/auth/*` URLs. Users clicking the verify link would 404.
- **Fix:** Nested the three pages under `src/app/(auth)/auth/` so the URLs become `/auth/reset`, `/auth/reset/complete`, `/auth/verify`, `/auth/error` — matching what Plan 04 emits. Route-group parens still apply the shared card layout.
- **Files modified:** Relocated `src/app/(auth)/reset/page.tsx` → `src/app/(auth)/auth/reset/page.tsx`, same pattern for `reset/complete`, `verify`, `error`.
- **Verification:** `npm run build` lists `/auth/error`, `/auth/reset`, `/auth/reset/complete`, `/auth/verify` in the Route tree; login page "Forgot your password?" link targets `/auth/reset` and resolves.
- **Committed in:** `7c6c5ed`

**2. [Rule 2 — Missing Critical] Zod 4 + RHF input/output type divergence**
- **Found during:** Task 1 GREEN, SignUpForm type-check
- **Issue:** Plan's code sample typed `useForm<SignUpInput>` where `SignUpInput` is `z.infer<>` output. Zod 4 distinguishes input from output for schemas with `.default()`; RHF form state is the INPUT shape, not the output. `zodResolver(signUpSchema)` is generic over both, but the form component's state type must match input. Without this fix, the form's `defaultValues` would type-error on `timezone: "UTC"` (output type is `string`, input type is `string | undefined`).
- **Fix:** Typed `useForm<z.input<typeof signUpSchema>>`; at onSubmit, built a complete `SignUpInput` object by merging in the runtime `Intl.DateTimeFormat().resolvedOptions().timeZone` value.
- **Files modified:** `src/components/auth/signup-form.tsx`
- **Verification:** `npx tsc --noEmit` → exit 0
- **Committed in:** `7b87638` (part of Task 1 GREEN)

**3. [Rule 1 — Bug] Tailwind v4 --spacing-* token collision (phase defect, not task defect)**
- **Found during:** Task 3 UAT Scenario 1 — user screenshotted the /login card and it was collapsed to ~8px wide, with text wrapping char-by-char
- **Issue:** `src/app/globals.css` (written in Plan 01 from the UI-SPEC @theme example) included a named spacing scale: `--spacing-xs: 4px; --spacing-sm: 8px; --spacing-md: 16px; --spacing-lg: 24px; --spacing-xl: 32px; --spacing-2xl: 48px;`. Tailwind v4 derives max-w-sm (384px), max-w-md (448px), etc. from those same token names. The auth layout uses `max-w-sm` to constrain the card to 384px — with the override, max-w-sm resolved to 8px, collapsing the card.
- **Fix:** Deleted the named --spacing-* tokens from globals.css @theme (9 lines removed). Components in this plan use Tailwind utilities (p-4, gap-6, space-y-4, max-w-sm) that derive from the singular `--spacing` base × numeric multiplier, so no component needed updating. ALSO fixed the token example in `.planning/phases/01-foundations-auth/01-UI-SPEC.md` so Phases 2/3/4 planners don't reintroduce the collision.
- **Files modified:** `src/app/globals.css`, `.planning/phases/01-foundations-auth/01-UI-SPEC.md`
- **Verification:** User hard-reloaded /login after the fix and confirmed the card renders correctly (384px wide, centered, typography + spacing per UI-SPEC). UAT then proceeded through all remaining blocking scenarios.
- **Committed in:** `d51d2ed`

---

**Total deviations:** 3 auto-fixed (1 Rule 2 — Zod 4 typing; 2 Rule 1 — wrong route paths + Tailwind token collision).

**Impact on plan:** All three fixes were necessary for correctness. Deviation #3 is notable as a **phase defect** (bug in the UI-SPEC, not the plan) — fixing it at its source (UI-SPEC.md) prevents recurrence in Phases 2/3/4. No scope creep. Zero threat-model changes.

## Threat Flags

None. The threat model covered all 10 STRIDE entries (T-1-05-01..T-1-05-10) and no new surface was introduced during execution.

## Issues Encountered

- **Tailwind v4 --spacing-* collision** was not caught by automated checks (`tsc`, `vitest`, `next build` all pass with the collision — it's a pure-visual regression). Caught only by UAT Scenario 1 visual verification. Lesson: phases that introduce visual design tokens need a smoke-render screenshot check in automated CI, OR UI-SPEC reviewers need to know the Tailwind v4 reserved-token list. Captured as a Phase 4 polish follow-up.
- **UAT duration:** 8 blocking scenarios took ~20 minutes of active human time (vs ~15 min estimated). Scenario 5 (reset flow) and Scenario 7 (SQL Editor CHECK + RLS) were the longest; both require context-switching to external tools.
- **No Supabase API surprises.** All Plan 04 server actions behaved as documented.

## Authentication Gates

None in the plan's automated portion. The UAT checkpoint (Task 3) IS the authentication gate for Phase 1 — it exercises every auth surface against the live Supabase dev project. No separate auth gate was required.

## Requirements Completed

Frontmatter declares `requirements: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05]`. All five are now **complete** (server-side from Plan 04 + client-side from this plan, verified end-to-end via UAT).

| Requirement | Status | What this plan delivers | UAT coverage |
|-------------|--------|-------------------------|--------------|
| **AUTH-01** (email/password signup) | complete | SignUpForm with RHF + zodResolver; timezone auto-capture at submit | Scenario 1 PASSED |
| **AUTH-02** (email verification link) | complete | /auth/verify success page + /auth/error failure page; signup form's verify-email success state | Scenarios 1, 2, 3 PASSED |
| **AUTH-03** (login + persistent session) | complete | LoginForm → signInAction; session persists across browser restart; middleware redirects on stale cookie | Scenarios 3, 9 PASSED |
| **AUTH-04** (logout) | complete | Landing stub header: `<form action={signOutAction}>` → outline Log out button | Scenario 4 PASSED |
| **AUTH-05** (password reset with 15-min expiry) | complete | ResetPasswordForm + UpdatePasswordForm + /auth/reset/complete page + ?reset=success one-time Alert; single-use enforced by Supabase | Scenario 5 PASSED; Scenario 6 async (NOT_YET_OBSERVED at resume) |

## User Setup Required

None. Plan 01 checkpoint (Supabase dashboard config — email-confirm ON, redirect allow-list, 15-min reset-token validity) is still the operative setup for AUTH-05 expiry semantics.

## Next Phase Readiness

**Phase 2 (goals CRUD):** unblocked. Auth is fully shippable:
- Users can sign up → verify → log in → see landing → log out → reset password
- Middleware guards every non-auth route
- `src/app/page.tsx` landing stub is the natural mount point for Phase 2's dashboard (replace the "coming in Phase 2" stub with the real dashboard shell)
- `getSupabaseServerClient()` factory + `auth.getUser()` pattern ready to be reused in Phase 2 RSCs
- RLS policies (Plan 03) already scope all queries to `user_id = auth.uid()`

**Open follow-ups carried forward:**
- Scenario 6 (16-min reset expiry) — record actual outcome when the user clicks the stale second reset link; file gap-closure against Plan 01 if link still works
- Phase 4 polish: consider adding a visual-smoke CI check (Playwright screenshot + pixel diff on /login + /signup) to catch Tailwind token collisions earlier
- Phase 4 polish: Lighthouse a11y score baseline — not measured in this plan (checkpoint did manual keyboard + focus-ring + touch-target smoke but did not run Lighthouse)
- Next 16 `middleware.ts` → `proxy.ts` rename (deferred from Plan 04) still applies

## Self-Check: PASSED

- File check — `test -f src/components/auth/password-input.tsx` → FOUND
- File check — `test -f src/components/auth/login-form.tsx` → FOUND
- File check — `test -f src/components/auth/signup-form.tsx` → FOUND
- File check — `test -f src/components/auth/reset-password-form.tsx` → FOUND
- File check — `test -f src/components/auth/update-password-form.tsx` → FOUND
- File check — `test -f src/app/(auth)/layout.tsx` → FOUND
- File check — `test -f src/app/(auth)/login/page.tsx` → FOUND
- File check — `test -f src/app/(auth)/signup/page.tsx` → FOUND
- File check — `test -f src/app/(auth)/auth/reset/page.tsx` → FOUND
- File check — `test -f src/app/(auth)/auth/reset/complete/page.tsx` → FOUND
- File check — `test -f src/app/(auth)/auth/verify/page.tsx` → FOUND
- File check — `test -f src/app/(auth)/auth/error/page.tsx` → FOUND
- File check — `test -f src/app/page.tsx` → FOUND
- File check — `test -f tests/auth.forms.shape.test.ts` → FOUND
- Commit check — `2946176` (Task 1 RED) → FOUND in git log
- Commit check — `7b87638` (Task 1 GREEN) → FOUND in git log
- Commit check — `c4fe900` (Task 2) → FOUND in git log
- Commit check — `7c6c5ed` (Task 2 Rule-1 fix) → FOUND in git log
- Commit check — `d51d2ed` (Tailwind token collision Rule-1 fix) → FOUND in git log
- Verification — `npx tsc --noEmit` → exit 0
- Verification — `npx vitest run` (with DATABASE_URL) → exit 0, 39/39 passed
- Verification — `npm run build` → exit 0, 11 routes compiled
- UAT — 8 blocking scenarios PASSED per user "approved" signal
- UAT — Scenario 6 (async) recorded as NOT_YET_OBSERVED

## TDD Gate Compliance

Task 1 followed the TDD cycle:

- `test(01-05): add failing shape tests for auth UI components` — commit `2946176` (RED)
- `feat(01-05): auth client forms + PasswordInput + auth layout` — commit `7b87638` (GREEN, later than RED)

Task 2 was `type="auto"` (not TDD) — page wrappers are thin composition with no branch logic worth a dedicated unit test; full coverage comes from the UAT checkpoint + `next build` type-checking + `npx vitest run` still passing.

REFACTOR gate not used — implementations are already minimal.

---
*Phase: 01-foundations-auth*
*Plan: 05 — auth UI + landing stub (completes AUTH-01..05 end-to-end)*
*Completed: 2026-04-19*
