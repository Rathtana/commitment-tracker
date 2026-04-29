---
phase: 04-launch-polish
plan: "04"
subsystem: testing
tags: [playwright, e2e, vercel, supabase, auth, deployment]

requires:
  - phase: 04-02
    provides: Responsive right cluster with icon-only mobile layout
  - phase: 04-03
    provides: Touch targets upgraded, ReflectionCard toast.error migration

provides:
  - Full Playwright suite green (24/27 passed, 3 correctly skipped)
  - D-06 auth form audit complete — all four forms compliant
  - ReflectionCard network-error catch fix landed
  - Production deploy ready (env vars documented, build clean)

affects: []

tech-stack:
  added: []
  patterns:
    - "startTransition async blocks must wrap server action calls in try/catch — network aborts throw, not return { ok: false }"

key-files:
  created:
    - .planning/phases/04-launch-polish/04-04-SUMMARY.md
  modified:
    - src/components/reflection-card.tsx (try/catch around upsertReflectionAction)

key-decisions:
  - "ReflectionCard save() try/catch: network errors (fetch abort, timeout) throw TypeError rather than returning { ok: false } — catch block required alongside the else branch to guarantee toast fires on all failure modes"
  - "D-06 audit confirmed no code changes needed: all four auth forms already have setError('root') + Alert variant=destructive + aria-live='polite'"
  - "E2E_EMAIL/E2E_PASSWORD in .env.local had leading whitespace — stripped so process.env picks them up in playwright runner"
  - "3 skipped tests (Copy from last month, Start fresh, future steppers) are account-data-gated — conditional guard is correct, not a test gap"

patterns-established:
  - "Server action calls in async transitions must be wrapped in try/catch — the else { } branch only handles application-layer errors (ok: false); network layer throws"

requirements-completed:
  - POLSH-01
  - POLSH-02

duration: ~15min
completed: 2026-04-28
---

# Phase 04: Launch Polish — Plan 04 Summary

**Full Playwright suite green (24 pass / 3 skip / 0 fail), D-06 auth audit clean, ReflectionCard network-error catch fixed — app is production-ready**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-04-28
- **Tasks:** 1/2 automated (Task 2 is human deploy checkpoint — see below)
- **Files modified:** 1 (reflection-card.tsx)

## Accomplishments

- Playwright suite: 24 passed, 3 skipped (account-data-gated, correct), 0 failed
- D-06 auth form audit: all four forms (login, signup, reset-password, update-password) confirmed compliant — `setError("root")` + `Alert variant="destructive"` + `aria-live="polite"` present in every form
- Discovered and fixed a real bug: `ReflectionCard.save()` called `upsertReflectionAction` inside `startTransition` without a `try/catch`. Network aborts throw `TypeError: Failed to fetch` — the `else` branch for `{ ok: false }` is never reached. Added `catch` block so `toast.error()` fires on both application errors and network failures
- TypeScript: clean build throughout

## Task Commits

1. **Fix: ReflectionCard network error catch** — `33bdefd` (fix(04-03): catch network errors in ReflectionCard autosave)

## Files Created/Modified

- `src/components/reflection-card.tsx` — Added `try/catch` around `upsertReflectionAction` call in `save()` so network throws fire the same `toast.error()` as application `{ ok: false }` responses

## Decisions Made

- **try/catch is required alongside else:** `startTransition(async () => { ... })` does not surface uncaught promise rejections to React error boundaries in the same way. The `toast.error` must be in both the `else` branch (server returns `{ ok: false }`) and the `catch` block (network layer throws). Deduplication via a shared error message string is acceptable.
- **3 skipped tests are correct:** `step 11: Copy from last month`, `step 13: Start fresh`, `step 17: future steppers` are guarded by `if (count > 0)` checks against live goal data. The test account has no goals in certain months. This is intentional — the tests document the behaviour and skip gracefully rather than failing on account state.
- **E2E env var whitespace:** `.env.local` had two leading spaces on `E2E_EMAIL` and `E2E_PASSWORD` lines. Most dotenv parsers treat leading whitespace on key names as part of the key. Playwright does not auto-load `.env.local` — it reads from the shell environment. Stripping the spaces allows `set -a; source .env.local; set +a` to export them correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] ReflectionCard autosave missing network-error catch**
- **Found during:** Running `npm run test:e2e` — test `phase4: autosave failure shows error toast` failed
- **Issue:** `save()` called `upsertReflectionAction` without `try/catch`. Playwright's `route.abort('failed')` causes the fetch to throw `TypeError: Failed to fetch`. The `else { toast.error(...) }` branch is never reached; the promise rejects silently inside `startTransition`.
- **Fix:** Wrapped `upsertReflectionAction` call in `try/catch`; `catch` block calls `toast.error('Reflection not saved — check your connection')` matching the `else` branch
- **Files modified:** `src/components/reflection-card.tsx`
- **Verification:** Re-ran full suite — test 27 now passes; all 24 passing tests still pass
- **Committed in:** `33bdefd`

---

**Total deviations:** 1 auto-fixed (missing network error handling)
**Impact on plan:** Fix was essential for POLSH-02 correctness — without it the autosave error was silently swallowed on network failures. No scope creep.

## Task 2 — Human Deploy Checkpoint

**Status: Awaiting user action**

Task 2 is `checkpoint:human-verify` — no automated path. Required steps:

1. Push to main → connect repo at vercel.com → add 4 env vars → Deploy
2. Confirm build log exits 0
3. Smoke test on live URL (login, create goal, log progress, reload)
4. DevTools → Cookies → `sb-*` cookies: `HttpOnly` ✓ `Secure` ✓ `SameSite=Lax` ✓
5. Lighthouse → Mobile Performance → CLS < 0.1
6. Supabase Dashboard → Auth → Settings → rate limiting ON
7. Password reset flow end-to-end

Required env vars for Vercel (Production environment):

| Var | Source |
|-----|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Same value as ANON_KEY |
| `DATABASE_URL` | Supabase → Project Settings → Database → Transaction pooler connection string — **no** `NEXT_PUBLIC_` prefix |

## Issues Encountered

- `.env.local` `E2E_*` vars had leading whitespace — not picked up by shell `source`. Fixed by stripping spaces.
- First Playwright run: auth setup timed out because email field showed literal `FILL_IN_YOUR_EMAIL` (env not loaded). Root cause was the whitespace issue above.

## Next Phase Readiness

All automated gates cleared. The only remaining step is the human Vercel deploy + UAT checklist (Task 2). Once the live URL is confirmed with correct cookie flags and CLS < 0.1, Phase 4 is complete and v1.0 milestone is shipped.

---
*Phase: 04-launch-polish*
*Completed: 2026-04-28*
