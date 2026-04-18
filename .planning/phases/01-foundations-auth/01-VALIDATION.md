---
phase: 1
slug: foundations-auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (latest compatible with Next.js 16 + React 19) |
| **Config file** | `vitest.config.ts` at project root — Wave 0 creates |
| **Quick run command** | `npx vitest run tests/time.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~2 seconds (pure functions, no DB, no Next.js runtime) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/time.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green + manual auth flow checklist complete
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

> Task IDs are placeholders until planner assigns plan numbers. Update after PLAN.md files land.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-XX-01 | XX | 0 | GOAL-04 / D-23 / D-13 | — | Pure `today(now, tz)` returns local YYYY-MM-DD across UTC-8/+13/0 at 11:30 PM | unit | `npx vitest run tests/time.test.ts` | ❌ W0 | ⬜ pending |
| 1-XX-02 | XX | 0 | D-23 / D-14 | — | `monthBucket(now, tz)` returns first-of-month for each offset on month-boundary timestamps | unit | `npx vitest run tests/time.test.ts` | ❌ W0 | ⬜ pending |
| 1-XX-03 | XX | 0 | D-23 | — | DST spring-forward (America/New_York): 11:30 PM on spring-forward day buckets correctly | unit | `npx vitest run tests/time.test.ts` | ❌ W0 | ⬜ pending |
| 1-XX-04 | XX | 0 | D-23 | — | Leap-year Feb 28 → Feb 29 → Mar 1 boundary; non-leap Feb 28 → Mar 1 | unit | `npx vitest run tests/time.test.ts` | ❌ W0 | ⬜ pending |
| 1-XX-05 | XX | 0 | D-23 | — | NYE midnight UTC across +13/-8 offsets (rolls into Jan 1 in +13, stays Dec 31 in -8) | unit | `npx vitest run tests/time.test.ts` | ❌ W0 | ⬜ pending |
| 1-XX-06 | XX | 1 | GOAL-04 / D-05 | T-1-01 | `goals.month` CHECK rejects any `DATE` not pinned to day = 1 | integration (DB) | `psql $DATABASE_URL -c "INSERT INTO goals (user_id, month, type, title) VALUES ('00000000-0000-0000-0000-000000000000','2026-04-15','count','x')"` — expect constraint violation exit code | ❌ W0 (migration test script) | ⬜ pending |
| 1-XX-07 | XX | 1 | D-21 / D-22 | T-1-02 | RLS: user A's session cannot SELECT or UPDATE user B's `goals` or `public.users` row | integration (DB) | `tests/rls.test.ts` with two test JWTs issued against local Supabase stack | ❌ W0 (rls.test.ts) | ⬜ pending |
| 1-XX-08 | XX | 2 | AUTH-01 / AUTH-02 | T-1-03 | Signup creates `auth.users` row, sends verification email, trigger creates `public.users` mirror with captured timezone | manual (browser) | Signup as new user → check mailbox → confirm `public.users` row exists with non-default timezone | N/A — manual | ⬜ pending |
| 1-XX-09 | XX | 2 | AUTH-02 | T-1-04 | Unverified user attempting login sees "please verify your email" message and is not issued a session cookie | manual (browser) | Sign up, do not click verification link, attempt login — expect block | N/A — manual | ⬜ pending |
| 1-XX-10 | XX | 2 | AUTH-03 | T-1-05 | Session persists across browser restart; replaying logged-out cookie returns 401 | manual (browser + curl) | Log in, close browser, reopen → still logged in. Log out, replay stale cookie via `curl` — expect 401 | N/A — manual | ⬜ pending |
| 1-XX-11 | XX | 2 | AUTH-04 | T-1-06 | Logout clears session cookie on any page | manual (browser) | Click logout from landing page → redirected to login, cookie cleared | N/A — manual | ⬜ pending |
| 1-XX-12 | XX | 2 | AUTH-05 | T-1-07 | Password reset link is single-use and expires in 15 minutes | manual (browser) | Request reset → use link once (success) → use again (failure). Wait 16 min on a fresh link — expect expiry | N/A — manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` — dev deps: `vitest`, `@vitejs/plugin-react`, `jsdom`, `@date-fns/tz`
- [ ] `vitest.config.ts` — `environment: 'node'` for time tests; `jsdom` config-path for future UI tests
- [ ] `tests/time.test.ts` — stubs for D-23 fixtures (UTC-8/+13/0 at 11:30 PM, DST, leap, NYE) covering GOAL-04 / D-13 / D-14
- [ ] `tests/rls.test.ts` — stub with two-JWT setup against local Supabase for D-21 / D-22
- [ ] `tests/migrations/goals-month-check.sql` — migration integration test script (invoked via `psql` against local Supabase)
- [ ] `src/lib/time.ts` — pure `today(now: Date, tz: string): string` and `monthBucket(now: Date, tz: string): Date`

---

## Manual-Only Verifications

> Automated tests cover the schema invariants and pure time functions. The auth loop itself (signup → verify → login → reset) requires a real mailbox and browser; Phase 1 ships these as a manual checklist because Phase 1 explicitly does not build E2E browser infrastructure.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Signup sends verification email within 30s | AUTH-02 | Requires real SMTP delivery (Supabase default SMTP) | Sign up with a valid inbox you control; confirm email arrives; click link |
| Verification unlock | AUTH-02 | Tied to the above — confirmed in the same manual run | After clicking link, log in — expect landing page access |
| Session persists across browser restart | AUTH-03 | Playwright/Cypress not part of Phase 1 scope | Log in, fully quit browser, reopen app URL — expect still logged in |
| Logout clears session | AUTH-04 | Browser cookie behavior | Click logout; attempt to visit protected route — expect redirect to login |
| Password reset 15-min expiry + single-use | AUTH-05 | Requires real email + time passage | Request reset; use link once (success); second use fails. On a fresh link, wait 16 minutes — expect expiry. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (manual tests explicitly enumerated above)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (timezone tasks chain automated; auth tasks chain through manual checklist)
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (all commands use `vitest run`, not `vitest`)
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter after planner wires tasks to Wave 0 files

**Approval:** pending
