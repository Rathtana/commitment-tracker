# Project Research Summary

**Project:** Commitment Tracker
**Domain:** Monthly commitment / goal-tracking web app (auth-gated, single-user, three goal shapes, dashboard-first, month-scoped)
**Researched:** 2026-04-17
**Confidence:** HIGH

## Executive Summary

Commitment Tracker is a visually-polished, month-scoped goal tracker built for one user's daily ritual first and public use second. The combination is distinctive: most competitors are either daily-streak habit apps (Streaks, Loop) or open-ended goal apps (Strides, Griply). The monthly cadence plus three equal-weight goal shapes (count, checklist, habit) plus dashboard-first interaction is a real gap in the market — but only if the progress bar actually feels good. The research is unambiguous that the bar IS the product; every architectural and feature decision should protect that moment of "open app, see bar move, feel pulled forward."

The recommended build is the 2026 solo-dev default: Next.js 16 + React 19 + Tailwind v4 + shadcn/ui + Motion 12 + Supabase Postgres + Drizzle ORM, deployed on Vercel. This stack composes without glue code, has first-class TypeScript support for the discriminated-union Goal type, and gives Row-Level Security in Postgres so "users only see their own data" is enforced by the database itself. The data model is a polymorphic parent (`goals` table with a `type` discriminator and a DATE-pinned `month` column) plus typed child tables (`tasks`, `habit_check_ins`) — this keeps the dashboard query simple, avoids JSONB-blob sprawl, and makes adding a 4th type later tractable.

The biggest risks are not technical plumbing but product psychology and boundary arithmetic. Streak counters done naively cause abandonment after the first break; timezone/DST bugs can silently mis-bucket logs at month boundaries; thin progress bars on day 3 look worse than empty and demotivate users. Prevention in each case is a design decision made once and made early: pace-aware progress bars instead of raw fill, "X of N days this month" instead of punishing streaks, a layered timezone strategy that stores local date plus IANA tz on every log entry. Get those three decisions right in the foundations phase and the rest of the roadmap is mostly craft.

## Key Findings

### Recommended Stack

Next.js 16 App Router with React 19 is the default React meta-framework in 2026, and Server Components + Server Actions eliminate the need for a separate API layer. Supabase provides Postgres + Auth + RLS as a single hosted service, removing the most common sources of solo-dev complexity (auth service, API server, session management). Drizzle ORM is purpose-built for Vercel's serverless runtime (tiny bundle, fast cold starts) and has first-class Supabase RLS helpers. Motion 12 (the successor to framer-motion) handles the progress-bar spring animations and layout transitions that make the dashboard feel good. The entire stack is one person's mental budget and the most-documented combination in the 2026 React ecosystem.

**Core technologies:**
- **Next.js 16.2 + React 19.2 + TypeScript 5.9** — App Router, Server Actions, RSC. Discriminated unions cleanly express three goal shapes.
- **Tailwind CSS v4.2 + shadcn/ui 3.5** — Oxide engine (100x faster builds), CSS-first `@theme` config, copy-paste components you own (critical for custom progress-bar styling).
- **Motion 12.38 (`motion/react`)** — Spring-physics progress bars, `layout` animations for reorders, `AnimatePresence` for month transitions.
- **Supabase (Postgres + Auth + RLS)** — Replaces the API layer; RLS enforces per-user data isolation at the DB.
- **Drizzle ORM 0.45 + drizzle-kit** — Typed queries, SQL-shaped migrations, fast serverless cold starts.
- **React Hook Form 7.72 + Zod 4.3** — Single source of truth for the three-goal-shape discriminated union (validates client and server).
- **date-fns 4.1** — Month boundary arithmetic and formatting (tree-shakeable; no Moment.js).

Full detail: see `.planning/research/STACK.md`.

### Expected Features

The feature research converges on two non-obvious design bets that shape everything:
1. **Streak counters are a trap.** Punishing reset-on-break mechanics drive 2-4 week abandonment. Ship "X of N days this month" instead — still motivating, never catastrophic.
2. **Pace-aware progress bars are cheap leverage.** Raw "2/30" fill at day 3 feels like failure; "2/3 expected, on pace" is honest and motivating. A small pure function, outsized emotional impact.

**Must have (table stakes):**
- Email/password auth, session persistence, password reset — public product baseline
- Goal CRUD (month-scoped, three types: count / checklist / habit)
- One-click progress logging from the dashboard (increment / check / toggle)
- Dashboard with all current-month goals + visual progress bars, mobile-responsive
- Month navigation (past read-only, future for pre-planning)
- Three distinct empty states (first-login / new-month / deleted-all)

**Should have (competitive differentiators):**
- Pace-aware progress bars (expected progress based on day-of-month)
- "Copy from last month" button at month boundaries (critical retention lever)
- Forgiving habit tracking — "X of N days this month" instead of streak counters
- Future-month pre-planning (most competitors don't support this)
- Read-only past months as a portfolio of wins

**Defer (v1.x / v2+):**
- Optional per-goal notes, end-of-month reflection, habit mini-calendar (v1.x)
- Email reminders, OAuth sign-in, undo toasts (v1.x)
- Cross-month trend charts, PWA push notifications (v2+)
- Social / sharing / gamification / integrations — explicitly out of scope per PROJECT.md

Full detail: see `.planning/research/FEATURES.md`.

### Architecture Approach

Server-authoritative state with optimistic client updates. Postgres is the single source of truth; every mutation is a Server Action that validates, writes, and returns the updated goal; the client uses `useOptimistic` so the progress bar moves instantly. The data model is a polymorphic parent (`goals` table: id, user_id, month, title, type, position + nullable per-type columns) with typed child tables (`tasks` for checklists, `habit_check_ins` for habits) — a hybrid of single-table and class-table inheritance that keeps dashboard queries simple while avoiding JSONB sprawl. Month is a `DATE` pinned to the first-of-month, enforced with a CHECK constraint so the invariant is impossible to violate at any layer above the DB.

**Major components:**
1. **Dashboard route** (`app/dashboard/[month]/page.tsx`) — RSC fetches month's goals with children in one query; URL is the month state.
2. **Goal Card variants** (`components/goal-card/{count,tasks,habit}.tsx`) — Three physical files mirror three logical types; a picker component routes by `type`.
3. **Server Actions** (`server/actions/{goals,progress}.ts`) — Thin `'use server'` entrypoints that call domain services.
4. **Domain Services** (`server/services/`) — Business logic: ownership checks, month-read-only enforcement, `computeProgress`.
5. **Pure progress function** (`lib/progress.ts`) — Isomorphic; imported by both server (authoritative) and client (optimistic). Single source of truth.
6. **Data access via Drizzle** (`server/db/`) — Schema + typed queries + migrations; Postgres RLS as defense-in-depth.

Full detail: see `.planning/research/ARCHITECTURE.md`.

### Critical Pitfalls

1. **Timezone / DST at month boundaries** — A 11:30 PM March 31 log can silently land in April if UTC-vs-local gets mixed. Store UTC timestamp + local `YYYY-MM-DD` + IANA tz on every log; compute "today" as a function of (now, user_tz); test DST days, NYE, leap year, travel scenarios. Must be decided in the foundations phase because retrofitting requires data migration.

2. **Streak anxiety replaces intrinsic motivation** — Users start opening the app to preserve a number, quit entirely on first break. Never make streak count the hero metric. Ship "X of N days this month" as the primary metric and add an explicit "skip day" affordance before any habit type is released. This is a design lock, not a feature flag.

3. **Month-boundary UX feels like data loss** — User opens app on the 1st to an empty dashboard and bounces. Show explicit "Welcome to [Month]" affordance with "Copy from last month / Start fresh" options, make past-months view a one-click first-class nav element, never archive silently. Test at a real month transition before declaring done.

4. **Slow early-month progress is demotivating** — Day-3 bars at 7% fill look worse than empty. Use pace-aware display ("2/3 expected") as the prominent visual; show raw on hover. For brand-new goals in week 1, consider a "warming up" visual state. Test dashboard emotional response at day 1, 3, 15, 29 with real builder use.

5. **Over-engineered polymorphic schema** — Either a mega `goals` table with a JSONB `config` blob (degenerates into EAV) or three fully-separate tables with no shared parent (UNION queries for every dashboard). The recommended polymorphic-parent + typed-child-tables pattern with CHECK constraints must be decided before any goal type ships. Dashboard query should be < 30 lines of SQL.

Full detail: see `.planning/research/PITFALLS.md`.

## Implications for Roadmap

Based on the four research dimensions, the roadmap should sequence so that the load-bearing foundations (auth, schema, timezone strategy, count-type walking skeleton) land first, the polymorphic data model is validated with the simplest goal type before the more complex ones ship, and pace-aware progress + month-boundary UX land before streak-heavy features. This cross-references all four research files: STACK recommends RSC + Server Actions + Drizzle; FEATURES insists pace-aware bars are a day-one differentiator; ARCHITECTURE validates the polymorphic pattern with count first; PITFALLS forces timezone + schema decisions into foundations.

### Phase 1: Foundations (Auth + Schema + Walking Skeleton)
**Rationale:** Every downstream phase depends on auth, the polymorphic schema shape, and the timezone/month-DATE invariant. Getting these right once means the rest of the roadmap is composable; getting them wrong means a painful migration later. Research shows three pitfalls (timezone/DST, over-engineered schema, session security) that must be prevented, not fixed after.
**Delivers:** Next.js 16 + Supabase + Drizzle scaffolded; email/password auth with session invalidation; `users` + `goals` (with CHECK constraints) + `tasks` + `habit_check_ins` tables migrated; pure `lib/progress.ts` function; count-type-only "create goal + increment + see bar move" loop on the current-month dashboard.
**Addresses (FEATURES):** Auth, goal CRUD (count only), progress logging, minimal dashboard, password reset.
**Uses (STACK):** Next.js 16 App Router, Supabase Auth via `@supabase/ssr`, Drizzle schema, shadcn scaffold, Tailwind v4, `useOptimistic`.
**Implements (ARCHITECTURE):** Polymorphic schema, month as DATE-pinned-to-first, layered month-boundary enforcement (DB CHECK + app guards), Server Action + Service + Data Access layering, pure progress function.
**Avoids (PITFALLS):** Timezone/DST (layered strategy from day one), over-engineered schema (pattern validated with count first), session management (verify logout invalidation, reset-token expiry), onboarding friction (signup → first log < 2 minutes).

### Phase 2: Three Goal Types + Dashboard Polish
**Rationale:** With the polymorphic pattern validated against the simplest type in Phase 1, Phase 2 extends it to the other two shapes. Per ARCHITECTURE research, count first is deliberate — the simplest shape proves the pattern, then tasks (child table) and habit (check-in table) confirm it. Adding all three in one phase groups the data-shape work and lets the `lib/progress.ts` exhaustive discriminated-union drive the completion check.
**Delivers:** Checklist type (tasks table + card + toggle action); habit type (habit_check_ins table + card + today-toggle); pace-aware progress bars on count + habit cards ("on pace" / "behind by N"); responsive mobile layout; Motion spring-physics on bar width changes; first-login empty state.
**Addresses (FEATURES):** Three goal types equal-weight, pace-aware bars, dashboard-first single-scroll list, responsive design, unified visual across types.
**Uses (STACK):** Motion 12 `motion/react` for spring-physics width animation and list reorders, Tailwind v4 `@starting-style` for entrance flourishes, shadcn `<Progress>` customized.
**Implements (ARCHITECTURE):** Child tables with FK, pure progress function extended exhaustively, optimistic UI via `useOptimistic` on all three cards.
**Avoids (PITFALLS):** Streak anxiety (habit type uses "X of N days this month" as hero, no punishing reset counter, explicit skip-day affordance), slow-progress demotivation (pace-aware view ships with bars, not later), mobile breakage (375px tested), progress-bar jank (`transform: scaleX` not `width` JS-per-frame).

### Phase 3: Month Navigation + History + Future Planning
**Rationale:** Once all three goal types work for the current month, extending to URL-based month routing unlocks past read-only view and future pre-planning simultaneously. Per ARCHITECTURE, both share the same `getMonthDashboard(userId, month)` query — the difference is a server-side write guard. Per FEATURES, future-month pre-planning is a real differentiator and past months as "portfolio of wins" is a retention lever. Per PITFALLS, month-boundary UX is where users feel data loss if done silently.
**Delivers:** `/dashboard/[month]` URL routing with prev/next navigation; past-month read-only enforcement (service + UI + API); future-month goal creation; "Welcome to [Month]" rollover prompt with Copy/Fresh options; three empty-state variants (first-login / new-month / deleted-all).
**Addresses (FEATURES):** Month navigation, past-month read-only, future-month planning, new-month behavior, empty-state design (3 variants), copy-from-last-month.
**Uses (STACK):** Next.js App Router dynamic `[month]` segment, date-fns for month arithmetic and formatting, shadcn Dialog for rollover prompt.
**Implements (ARCHITECTURE):** URL-driven month state (no client-state lib), server-side read-only enforcement (defense-in-depth beyond UI), coalesce-to-most-recent-month-with-goals logic (not silent copy-forward).
**Avoids (PITFALLS):** Silent month rollover (explicit prompt with options, visible transition), past-month editability (server returns 403 on writes, not just UI disabled), copy-forward anti-pattern (show most-recent-month instead of duplicating rows).

### Phase 4: Launch Polish
**Rationale:** With all three types, month navigation, and pace-aware bars in place, Phase 4 catches the "looks done but isn't" checklist from PITFALLS research and closes any gaps surfaced by builder's daily use. This is deliberately a narrower scope — not a grab-bag — because over-scoping launch polish is a classic delay trap.
**Delivers:** Error toasts with no input-loss; delete-goal confirmation modal; `prefers-color-scheme` dark mode via CSS; accessibility pass (Radix primitives give most of this for free); production deploy with verified cookie flags + CSRF + rate limits; Lighthouse CLS < 0.1; Vercel production env + Supabase migrations to prod.
**Addresses (FEATURES):** Basic error states, mobile-responsive final pass, logout hygiene.
**Uses (STACK):** Vercel Hobby deploy, Supabase CLI for prod migration, `sonner` toasts via shadcn.
**Implements (ARCHITECTURE):** Monitoring hooks, error boundaries, production-hardened auth flow.
**Avoids (PITFALLS):** Session-invalidation-on-logout missing, reset-token expiry missing, rate-limits missing, cookie flags wrong in prod, CLS regression from `width` animations, mobile thumb-reach failures.

### Phase 5 (Post-Launch, v1.x)
Validated-by-real-use additions, each with a clear trigger:
- Copy-from-last-month one-click button — trigger: first real month transition after launch
- End-of-month reflection prompt — trigger: after 2-3 completed months validate the ritual
- Habit mini-calendar grid view — trigger: users ask to see specific days
- Per-goal notes — trigger: users want goal context
- Daily email reminder (opt-in, single batched) — trigger: observed mid-month drop-off
- Undo toast on progress log — trigger: first accidental-tap complaint

### Phase Ordering Rationale

- **Foundations before shape.** Timezone strategy and polymorphic schema are the two decisions that are expensive to unwind later; they land in Phase 1 even though they feel infrastructural.
- **Simplest shape first.** ARCHITECTURE explicitly recommends count before tasks before habit — the pattern is proven on the easiest type before extension.
- **Pace-aware with bars, not after.** FEATURES and PITFALLS both flag that day-3 raw-fill bars demotivate; pace-aware rendering is in the phase that ships bars, not a later polish phase.
- **Habit's streak design locked before habit ships.** Per PITFALLS, retrofitting streak-flexibility is painful because users anchor on initial behavior. The "X of N days this month" framing is a Phase 2 design lock.
- **Month navigation after three types work.** Per ARCHITECTURE, past + future share the same query shape — grouping them in Phase 3 is cheaper than splitting.
- **Launch polish is narrow.** PITFALLS' "looks done but isn't" checklist drives Phase 4 — it's a defined scope, not a bucket for anything deferred.

### Research Flags

Phases likely needing deeper research during planning (`/gsd-research-phase`):
- **Phase 1 — Timezone strategy deep-dive.** The layered UTC + local-date + IANA-tz approach is well-documented but the exact Temporal vs date-fns-tz choice, plus the schema shape for `habit_check_ins.check_in_date` storage, deserves a targeted research pass before migration is written.
- **Phase 2 — Motion + shadcn Progress customization.** Replacing Radix Progress indicator with `<motion.div>` for spring-physics width animation has a specific pattern; worth a research pass to avoid CLS regression and re-animate-on-mount pitfalls.

Phases with standard patterns (can likely skip research-phase):
- **Phase 3 — Month navigation.** URL-driven dynamic routing in Next.js App Router is well-documented.
- **Phase 4 — Launch polish.** Standard production checklist; use PITFALLS "looks done but isn't" section directly.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Every core library verified via live `npm view` on 2026-04-17; Context7 entries present for Next.js, React, Supabase, shadcn, Motion; stack is the dominant 2026 combination with saturated docs. |
| Features | MEDIUM-HIGH | Table-stakes and anti-features are well-sourced across 10+ competitor + psychology references. The specific mix (monthly cadence + three types + dashboard-first) is underexplored in public writing, so "Differentiators" section is confident-but-opinionated rather than externally validated. |
| Architecture | HIGH | Component boundaries + data flow are HIGH (Next.js + RSC + Server Actions is the 2026 default and official docs are strong); schema proposal is MEDIUM-HIGH (polymorphic-parent + typed-child-tables is one of two viable shapes, recommended with explicit trade-offs and the CHECK-constraint strategy is standard Postgres practice). |
| Pitfalls | HIGH | Streak psychology + timezone/DST are extensively documented in engineering and UX literature (multiple peer-reviewed and practitioner sources converge). Schema pitfalls are MEDIUM-HIGH (opinionated but sources consistent). Recovery strategies are MEDIUM (inferred from prevention patterns). |

**Overall confidence:** HIGH. The stack is verified, the architecture is the 2026 default, the features are grounded in competitor + psychology research, and the pitfalls are the well-known traps for this domain. The three judgement calls (schema shape, streak framing, pace-aware vs raw fill) are made explicitly with rationale so the roadmapper can revisit if user validation pushes back.

### Gaps to Address

- **Exact streak-flexibility affordance.** Research says "skip day / life happens marker" — the exact UX (button, long-press, separate menu) is not specified and should be decided during Phase 2 visual design, not in the roadmap.
- **Pace-aware visual language.** "On pace" vs "behind by N" copy is specified but the visual (inline text, colored bar zone, hover tooltip) is open. Decide during Phase 2 with the builder's taste as the primary input.
- **Temporal vs date-fns-tz.** Temporal API is at Chrome 144+ / Firefox 139+ as of Jan 2026 — enough adoption for a 2026 product but a polyfill may still be needed. Research flag for Phase 1.
- **RLS policy depth.** Supabase RLS can enforce per-user data isolation at the DB, but the exact policy shape (especially for child tables joined via `goal_id`) needs a targeted pattern pass. Research flag for Phase 1.
- **Email provider for reset + v1.x reminders.** Not specified; Resend vs SendGrid vs Postmark is a Phase 1 (reset) or Phase 5 (reminders) sub-decision.

## Sources

### Primary (HIGH confidence)
- **Context7 library registry:** `/vercel/next.js`, `/facebook/react`, `/supabase/supabase`, `/supabase/auth`, `/websites/motion_dev`, `/shadcn-ui/ui`
- **Live npm version checks (2026-04-17):** next@16.2.4, react@19.2.5, tailwindcss@4.2.2, motion@12.38.0, @supabase/supabase-js@2.103.3, @supabase/ssr@0.10.2, shadcn@3.5.0, typescript@5.9.3, zod@4.3.0, drizzle-orm@0.45.2, react-hook-form@7.72.1, date-fns@4.1.0
- **Official docs:** [Next.js 16 release](https://nextjs.org/blog/next-16), [Supabase SSR with Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs), [Motion React upgrade guide](https://motion.dev/docs/react-upgrade-guide), [useOptimistic — React docs](https://react.dev/reference/react/useOptimistic), [PostgreSQL 5.11 Inheritance](https://www.postgresql.org/docs/current/ddl-inherit.html), [Temporal API — MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal)

### Secondary (MEDIUM confidence — multi-source consensus)
- Streak psychology: [Cohorty — Psychology of Streaks](https://blog.cohorty.app/the-psychology-of-streaks-why-they-work-and-when-they-backfire/), [Work Brighter — Habit Streak Paradox](https://workbrighter.co/habit-streak-paradox/), [Polygon — Why Streaks Fail](https://www.polygonapp.io/blog/why-streaks-fail-for-habits), [ScienceDirect — Habitica gamification study](https://www.sciencedirect.com/science/article/abs/pii/S1071581918305135)
- Progress-bar UX: [LogRocket — Goal-Gradient Effect](https://blog.logrocket.com/ux-design/goal-gradient-effect/), [Smashing — Streak UX](https://www.smashingmagazine.com/2026/02/designing-streak-system-ux-psychology/), [Irrational Labs — When Progress Bars Backfire](https://irrationallabs.com/blog/knowledge-cuts-both-ways-when-progress-bars-backfire/)
- Timezone/DST: [dev.to — Timezone Bugs](https://dev.to/kcsujeet/how-to-handle-date-and-time-correctly-to-avoid-timezone-bugs-4o03), [Alberto Varela — Time Zone Change Can Break Apps](https://www.albertovarela.net/blog/2025/10/time-zone-change-break-apps/), [Tinybird — Database Timestamps](https://www.tinybird.co/blog/database-timestamps-timezones)
- Schema patterns: [DoltHub — Polymorphic Data](https://www.dolthub.com/blog/2024-06-25-polymorphic-associations/), [GitLab — Single Table Inheritance](https://docs.gitlab.com/development/database/single_table_inheritance/), [Bruno Scheufler — Polymorphic Relations in Postgres](https://brunoscheufler.com/blog/2022-05-22-modeling-polymorphic-relations-in-postgres)
- Stack comparisons: [Bytebase — Drizzle vs Prisma](https://www.bytebase.com/blog/drizzle-vs-prisma/), [LogRocket — Next.js 16 Overview](https://blog.logrocket.com/next-js-16-whats-new/), [Tailwind v4 Deep Dive](https://dev.to/dataformathub/tailwind-css-v4-deep-dive-why-the-oxide-engine-changes-everything-in-2026-2595)
- Competitor analysis: [Mindful Suite — Habit Tracker Apps 2026](https://www.mindfulsuite.com/reviews/best-habit-tracker-apps), [Reclaim.ai — Habit Tracker Apps 2026](https://reclaim.ai/blog/habit-tracker-apps), [Griply](https://griply.app/), [Strides](https://www.stridesapp.com/)

### Tertiary (LOW confidence — single source or inference)
- Empty state design: [UserOnboard](https://www.useronboard.com/onboarding-ux-patterns/empty-states/), [NN/G](https://www.nngroup.com/articles/empty-state-interface-design/) — well-known patterns but specifics are opinionated
- v1.x email reminder design — inferred from notification-fatigue research, not directly sourced

### Detailed Research Files
- `.planning/research/STACK.md` — full stack rationale, alternatives, versions, compatibility
- `.planning/research/FEATURES.md` — full feature landscape, competitor matrix, prioritization
- `.planning/research/ARCHITECTURE.md` — full data model, data flow, patterns, build order
- `.planning/research/PITFALLS.md` — full pitfall catalog, recovery strategies, verification checklist

---
*Research completed: 2026-04-17*
*Ready for roadmap: yes*
