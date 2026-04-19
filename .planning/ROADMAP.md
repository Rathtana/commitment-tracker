# Roadmap: Commitment Tracker

## Overview

Commitment Tracker ships in four phases that move from load-bearing infrastructure (auth, polymorphic schema, timezone strategy) through the core daily-use loop (three goal types on a single dashboard with pace-aware progress bars) to the monthly rhythm (past read-only history, future pre-planning, month-rollover UX with reflection) and finally to launch hardening (mobile-responsive, error toasts, production deploy). Sequencing is research-driven: foundations that are expensive to retrofit land first; the polymorphic data model is validated against the simplest goal type (count) inside Phase 2 before the more complex shapes ship; and Phase 3 deliberately groups past + future month work because both share the same `getMonthDashboard(userId, month)` query shape.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundations & Auth** - Next.js + Supabase + Drizzle scaffold; email/password auth with reset; polymorphic schema with month-pinned DATE invariant; timezone strategy locked
- [ ] **Phase 2: Goals & Dashboard (Three Types)** - All three goal types creatable, editable, deletable; one-click progress logging; dashboard with pace-aware progress bars and habit month-grid
- [ ] **Phase 3: Month Navigation, History & Reflection** - URL-routed months; past read-only enforcement; future pre-planning; copy-from-last-month rollover; optional end-of-month reflection
- [ ] **Phase 4: Launch Polish** - Mobile-responsive final pass at 375px; error toasts that never silently drop input; production deploy with verified cookie flags

## Phase Details

### Phase 1: Foundations & Auth
**Goal**: User can sign up, verify email, log in, log out, and reset their password on a deployed Next.js + Supabase scaffold whose schema is ready for three goal types and whose timezone strategy is locked before any goal data accumulates.
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, GOAL-04
**Success Criteria** (what must be TRUE):
  1. A new user can sign up with email and password, receive a verification email, and reach a logged-in landing page in under 2 minutes
  2. User stays logged in across browser sessions and can log out from any page; replaying a logged-out session cookie returns 401
  3. User can request a password reset via email, use the link once within 15 minutes, and successfully set a new password
  4. The `goals` table exists with a `month DATE` column whose CHECK constraint rejects any value not pinned to the first of a month
  5. Logging a timestamp at 11:30 PM local on the last day of a month buckets it to that month (not the next) regardless of UTC offset, validated by a DST/month-boundary test suite
**Plans**: 5 plans
- [x] 01-01-PLAN.md — Scaffold Next.js 16 + shadcn + Tailwind v4 + Vitest + Drizzle config + Supabase project checkpoint
- [x] 01-02-PLAN.md — Pure isomorphic `today()` + `monthBucket()` with D-23 Vitest fixture suite (timezone, DST, leap year, NYE)
- [x] 01-03-PLAN.md — Drizzle schema (public.users + goals) + RLS policies + custom SQL migration (CHECK + trigger) + `supabase db push` [BLOCKING] + RLS stub test
- [x] 01-04-PLAN.md — `@supabase/ssr` middleware + `/auth/callback` route handler + shared Zod schemas + 5 server actions (signup/signin/signout/reset/update)
- [x] 01-05-PLAN.md — 6 auth surfaces (login/signup/reset/reset-complete/verify/error) + landing stub + password toggle + manual UAT checkpoint
**UI hint**: yes

### Phase 2: Goals & Dashboard (Three Types)
**Goal**: User opens the dashboard, sees every current-month goal at a glance with a moving progress bar, and can log progress in one click for any of the three goal shapes (count, checklist, habit) — including pace-aware feedback and a habit month-grid.
**Depends on**: Phase 1
**Requirements**: GOAL-01, GOAL-02, GOAL-03, PROG-01, PROG-02, PROG-03, PROG-04, PROG-05, DASH-01, DASH-02, POLSH-03
**Success Criteria** (what must be TRUE):
  1. User can create a goal with a name, choice of type (count / checklist / habit), target, optional notes, and an associated month — and edit or delete it (with confirmation) for current/future months
  2. The dashboard renders all current-month goals in a single scrollable list (no tabs, no drill-down) with a visual progress bar on every card reflecting completion percent
  3. User can increment a count goal in one click, toggle a checklist sub-task in one click, and mark today done on a habit goal in one tap — all directly from the dashboard with optimistic UI
  4. User can log a missed check-in for any prior day within the current month, and undo the last progress action via a short-lived toast
  5. Habit goal cards show a month-grid alongside the bar revealing which specific days were hit and which were missed (no punishing streak counter)
**Plans**: 6 plans
- [ ] 02-01-PLAN.md — Wave 0 foundation: schema (3 child tables + polymorphic CHECK) + `src/lib/progress.ts` + Zod discriminated union + shadcn installs + Sonner mount
- [ ] 02-02-PLAN.md — Wave 1 dashboard surface: motion `ProgressBar` primitive + `PaceChip` + `getMonthDashboard` query + `/dashboard` route + `DashboardShell` + empty state
- [ ] 02-03-PLAN.md — Wave 2 goal CRUD: create/update/delete server actions + 2-step CreateGoalDialog + DeleteGoalDialog AlertDialog
- [ ] 02-04-PLAN.md — Wave 3 count card: `incrementCountAction` + `backfillCountAction` + `undoLastMutationAction` + CountCard + EarlierDayPopover + Sonner undo contract
- [ ] 02-05-PLAN.md — Wave 4 checklist card: `toggleTaskAction` + tasks undo columns + ChecklistCard + undo extension
- [ ] 02-06-PLAN.md — Wave 5 habit card: `upsertHabitCheckInAction` + `habit_check_in_undos` table + HabitGrid + HabitCard + full-phase UAT
**UI hint**: yes

### Phase 3: Month Navigation, History & Reflection
**Goal**: User can move between past, current, and future months via the URL; past months are honestly read-only at every layer; future months can be pre-planned; the 1st-of-month moment feels intentional rather than empty; and completed months can carry a short reflection.
**Depends on**: Phase 2
**Requirements**: GOAL-05, MNAV-01, MNAV-02, MNAV-03, MNAV-04, POLSH-04
**Success Criteria** (what must be TRUE):
  1. User can navigate forward and backward between months via prev/next controls, and the URL reflects the current month so deep links and browser back/forward work
  2. Past-month goals are visible but cannot be edited and progress cannot be changed — both the UI hides actions and the API returns 403 on write attempts
  3. User can pre-set goals for any future month before it begins by navigating forward and creating goals there
  4. On the 1st of a new month the dashboard starts blank unless the user pre-set goals, and a visible "Welcome to [Month]" prompt offers Copy-from-last-month or Start-fresh in one click
  5. Past-month and end-of-month views show an optional two-line reflection field ("what worked / what didn't") that the user can save and revisit
**Plans**: TBD
**UI hint**: yes

### Phase 4: Launch Polish
**Goal**: The product is shippable: the dashboard works on a phone the way it works on a laptop, failed saves never silently drop user input, and the production deploy is hardened against the standard auth/cookie/CLS regressions.
**Depends on**: Phase 3
**Requirements**: POLSH-01, POLSH-02
**Success Criteria** (what must be TRUE):
  1. The dashboard and all core flows are usable at 375px width with touch targets of at least 44px — log-progress buttons sit within thumb reach
  2. Any failed save (network error, validation error, server error) surfaces through a toast or inline error and the user's input is preserved, never silently dropped
  3. Production deploy passes the "looks done but isn't" checklist: Secure + HttpOnly + SameSite=Lax cookies verified on the deployed domain, Lighthouse CLS < 0.1, password reset rate-limited
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundations & Auth | 1/5 | In progress | - |
| 2. Goals & Dashboard (Three Types) | 0/TBD | Not started | - |
| 3. Month Navigation, History & Reflection | 0/TBD | Not started | - |
| 4. Launch Polish | 0/TBD | Not started | - |

---
*Roadmap created: 2026-04-17*
*Phase 1 planned: 2026-04-17 — 5 plans across 4 waves*
*Coverage: 25/25 v1 requirements mapped*
