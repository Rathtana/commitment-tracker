# Pitfalls Research

**Domain:** Monthly commitment / goal-tracking web app (count, checklist, habit-streak goals)
**Researched:** 2026-04-17
**Confidence:** HIGH for product pitfalls (multiple sources converge), HIGH for timezone/month-boundary (well-documented in engineering literature), MEDIUM for schema pitfalls (opinionated, multiple valid patterns)

---

## Critical Pitfalls

### Pitfall 1: Streak anxiety replaces intrinsic motivation

**What goes wrong:**
Users open the app to preserve a number instead of because the habit serves them. When a streak eventually breaks (travel, illness, life), the user feels shame and abandons the tool entirely. Research: "one missed day can trigger complete abandonment to avoid the painful loss mechanic." This is the top reason habit-tracker users quit in weeks 2-4.

**Why it happens:**
Streaks exploit loss aversion (losing hurts ~2x more than gaining feels good). This works for 2-3 weeks, then flips: the fear of losing the streak becomes larger than the benefit of the habit. Motivation shifts from intrinsic ("I want to read") to extrinsic ("I can't break 47 days"). When the habit finally depends on the counter, any reset collapses the whole practice.

**How to avoid:**
- Do NOT make the streak counter the hero metric on the dashboard. Keep it present but secondary to the progress bar.
- Build in flexibility from day one: "skip day" or "life happens" marker that does not reset the streak (some habit apps call these "freeze tokens" or "planned rest").
- For habit goals, show completion rate (e.g., 22/30 days = 73%) alongside or instead of streak length — 80% adherence produces nearly identical long-term outcomes and is psychologically survivable.
- Consider a "rolling 30-day" completion view instead of a raw streak count.
- Never shame the user on a miss. No red X, no broken-chain animation. A gap in the grid is enough.

**Warning signs:**
- Builder-as-user notices anxiety before opening the app on a bad day.
- The urge to "fake" a log entry to preserve a streak.
- Skipping the real activity because the streak already broke ("why bother today").
- UI spec mentions "penalties," "punishments," or "levels lost."

**Phase to address:**
Goal-type implementation phase (specifically the habit/streak type). Design decision must be made BEFORE the habit type ships — retrofitting streak-flexibility is painful because users anchor on whatever the first behavior was.

---

### Pitfall 2: Timezone / DST bugs at day and month boundaries

**What goes wrong:**
A user logs a habit at 11:30 PM local time. The server stores it in UTC, which is already tomorrow in UTC. The next day's dashboard shows yesterday as incomplete and today as already complete. Or: user travels from NYC to London, returns three days later, and the app resets their streak because "days" were computed from UTC boundaries that didn't match the user's lived days. Peer-reviewed research of 7 top habit apps found 5 exhibited streak resets within 12 hours of simulated transatlantic travel. For a *monthly* tracker this is worse: a log entry made at 11:30 PM on March 31 could silently land in April's bucket if UTC vs local gets mixed.

**Why it happens:**
JavaScript's `Date` object aggressively converts to/from UTC in the user's local timezone, creating constant off-by-one errors. Storing only UTC loses the information needed to answer "what local day was this?" DST transitions create "ghost times" (2:34 AM on spring-forward day doesn't exist) and "doubled times" (1:30 AM happens twice on fall-back day). Month arithmetic in `Date` silently wraps (`setMonth(12)` gives February of next year).

**How to avoid:**
- Store each log entry as BOTH a UTC timestamp AND the user's local date string (`YYYY-MM-DD`) at time of entry, plus the IANA timezone identifier (`America/New_York`, not `EST`). Query "did I do it today" against the local date string, not UTC arithmetic.
- For month-scoped goals, the month key is `YYYY-MM` in the user's timezone at the time the goal was created. Do not derive it from UTC on every read.
- Use a modern date library: Temporal API (Chrome 144+ as of Jan 2026, Firefox 139+) or `date-fns-tz` / `Luxon` as a polyfill. Avoid raw `Date` math for anything involving days.
- Ask the user's timezone once at signup, store it, and allow override in settings. Detect changes and prompt before silently re-bucketing data.
- Write tests for: spring-forward day, fall-back day, New Year's Eve at 11:59 PM, last day of February, leap year, user traveling across timezones.
- Treat "today" as a computed function of (now, user_tz) — never a raw `new Date()`.

**Warning signs:**
- Bug reports like "my streak reset overnight" or "my log entry is on the wrong day."
- Dashboard shows zero progress after midnight but the user remembers logging.
- Month-picker navigation produces different totals depending on when you load the page.
- Any code path where `toISOString()` is used to derive a day.

**Phase to address:**
Data-model / foundations phase (before any goal logging ships). Timezone strategy is a load-bearing decision — fixing it after data accumulates requires a migration.

---

### Pitfall 3: Over-engineered polymorphic schema for three goal types

**What goes wrong:**
Builder creates a generic `goals` table with a `type` column and a nullable grab-bag of columns (`target_count`, `tasks_json`, `habit_schedule`). Over time this evolves into a JSONB `config` blob, then into an EAV-style attributes table. Queries grow complex, type-specific validation lives in application code, and adding a 4th goal type requires touching every query. Conversely, the *opposite* over-engineering is creating 3 fully-separate tables with duplicated user/month/ownership logic, making "show all goals for this month" require 3 UNION queries.

**Why it happens:**
The three goal types share a lot (owner, month, title, visibility, progress bar) but diverge in their progress shape (integer count, list of booleans, date-keyed map). Developers either over-unify ("one table to rule them all") or over-split ("each type is its own world"). GitLab and most DB schema guides recommend against single-table inheritance for precisely this reason, but splitting without a shared parent is also painful.

**How to avoid:**
- Use a shared `goals` table for the common attributes (id, user_id, month, title, type, created_at, archived_at) — this is the parent row and powers dashboard queries.
- Use a separate child table per goal type (`goal_counts`, `goal_checklists`, `goal_habits`) with a 1:1 FK to `goals`. This is "class table inheritance."
- Progress logs go in a `goal_logs` table with a polymorphic shape — but constrained: (goal_id, logged_at_utc, logged_local_date, value_numeric, value_task_id). Use CHECK constraints so only the relevant value column is populated per goal type.
- Resist JSONB for goal configuration until you have a validated 4th goal type. JSONB is the right answer eventually; it is the wrong first answer.
- Write the dashboard query first. If "show all goals with progress for month X" takes more than ~30 lines of SQL, the schema is wrong.

**Warning signs:**
- Adding a new goal type requires touching >3 files outside the new type's module.
- The dashboard query has a `CASE WHEN type = ...` ladder.
- Nullable columns outnumber NOT NULL columns in the `goals` table.
- Type-specific logic lives on the client because the server "doesn't know" the type.

**Phase to address:**
Data-model / foundations phase. Schema shape must be decided before any goal type ships — all three goal types should be modeled together even if only one ships first, so the shape survives.

---

### Pitfall 4: Month-boundary UX makes users feel they lost data

**What goes wrong:**
On the 1st of the month, the user opens the app and sees an empty dashboard. Previous month's goals are gone with no visible affordance to "bring them forward." Or the app silently carries every goal into the new month and the user feels their progress disappeared (full reset). Or the "past months" view is buried three clicks deep and the user doesn't know their history still exists. Monthly cadence is the product's rhythm — if the rollover feels broken, the product feels broken.

**Why it happens:**
There are 3 reasonable monthly-rollover behaviors (carry forward, start fresh, ask the user), and picking the wrong one without a visible history escape hatch feels like data loss. Users who open the app on the 1st are in their most vulnerable retention moment — they need to feel oriented, not confused.

**How to avoid:**
- Make the past-months view a first-class navigation element (not a menu item). A month-picker or left/right arrows at the top of the dashboard.
- On the 1st of a new month, show a "Welcome to [Month Name]" affordance that explicitly offers options: "Carry over recurring habits," "Start fresh," "Copy from last month." Never do this silently.
- Visible rollover animation or transition — the user should SEE the old month move to history, not wake up to a blank screen.
- "Current month's goals persist until the user sets new ones for the next month" (from PROJECT.md) — make this rule visible. If April 1st arrives and March goals are still showing, add a banner: "You're viewing March's goals. Ready to plan April?"
- Never delete or archive progress on rollover. Past months are read-only (per PROJECT.md) but must be reachable in 1 click.

**Warning signs:**
- Builder-as-user feels disoriented on the 1st of the month.
- Need to explain "where did my goals go?" in support / docs.
- Past-months view requires scrolling or menu-diving to find.
- Any rollover behavior that happens automatically without a visible trace.

**Phase to address:**
Dashboard / month-navigation phase. Must be tested at least once in production at a real month boundary before declaring the feature done — simulate if needed by faking the current date in dev.

---

### Pitfall 5: Dashboard becomes demotivating when progress is slow or sparse

**What goes wrong:**
Research shows that when progress bars display slow initial progress, abandonment rates increase and subjective experience is more negative than when progress looks fast. For a monthly tracker on day 3, a "1/30" habit progress bar shows a sliver of fill that feels worse than no bar at all. Empty grids and thin bars shame the user. The dashboard — the product's core draw — becomes the thing the user avoids.

**Why it happens:**
Goal-gradient effect: users accelerate as they approach completion, decelerate at the start. A visible bar at 3% looks failed. Multiple goals all showing thin bars compounds the effect — the dashboard says "you're failing at everything."

**How to avoid:**
- Use "endowed progress" where honest: show the current day's position in the month, not just raw fill. A habit at day 3 of 30 with 2 check-ins is "2/3 expected" (66%), not "2/30" (7%). Display the on-pace version prominently, raw version on hover.
- For brand-new goals in the first few days, show a different visual state entirely: "just started" / "warming up" instead of a tiny progress sliver.
- Give users positive reinforcement for logging activity, not only for completion. The act of checking in should feel good even on a day where the bar barely moves.
- Avoid shame visuals: no red, no X, no "behind schedule" warnings unless the user opts into them.
- Test the dashboard at day 1, day 3, day 15, and day 29 of a simulated month. If any of those feels bad, iterate.

**Warning signs:**
- Builder-as-user avoids opening the app early in the month.
- Progress bars at 5-15% fill look worse than at 0%.
- Dashboard emotional response is "ugh" instead of "let's go."
- Need to caveat screenshots with "this is mid-month."

**Phase to address:**
Dashboard / visual-design phase. Test with the builder's real usage during weeks 1 and 2 of a real month — artificial seed data will not surface this.

---

### Pitfall 6: Onboarding asks for too much before showing value

**What goes wrong:**
New user signs up, lands on a multi-step goal-creation wizard asking for goal type, target, schedule, reminder time, category, color. They bounce before seeing the dashboard. Research: 72% of users abandon apps during onboarding that requires too many steps early, and users who experience core value within 5-15 minutes are 3x more likely to retain. For this app the "aha moment" is *seeing a progress bar move* — anything that delays that is harmful.

**Why it happens:**
Builders want the data model to be complete before the user interacts. But the user's first session should end with at least one satisfying bar-move, not with a finished configuration.

**How to avoid:**
- Post-signup, land the user on a dashboard with one pre-populated example goal they can interact with immediately, OR a single-field "what's one thing you want to do this month?" that creates a goal in 1 click with sensible defaults.
- Defer goal-type choice: let the user start with the simplest type (count), and offer to "convert this into a habit" or "add a checklist" once they've logged once.
- Do not require email verification before first interaction. Send verification in the background, let the user use the product, gate only irreversible actions (e.g., password change) behind verification.
- First-session success = one goal created AND one progress log submitted. If either doesn't happen, onboarding has failed.

**Warning signs:**
- Signup-to-first-log time > 2 minutes.
- Multi-step wizard before dashboard appears.
- Tooltips or coach-marks explaining the UI (sign that the UI isn't self-explanatory).
- Builder-as-user, on a fresh account, feels the urge to skip steps.

**Phase to address:**
Auth + onboarding phase. Measure first-session success directly (did they log progress?). If not, onboarding needs iteration before moving on.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store only UTC timestamps, derive local dates on read | Simple schema, one column | Every "did I do it today" query must know the user's tz at query time; travel breaks streaks | NEVER for a tracker with day-based semantics |
| Use `new Date()` directly for "today" | Zero dependencies | Silent drift across midnight, DST bugs, month-boundary errors | Only for non-user-facing logging |
| Single `goals.config` JSONB column for all goal types | Flexible, easy to ship type #1 | Type-specific validation moves to app code; indexes on nested fields are painful; schema drift | Short-term prototype only — migrate before type #3 |
| Rely on client-side localStorage for "last viewed month" | Instant navigation state | State desyncs on login from new device; stale data on revisit | Acceptable as a hint, never as source of truth |
| Let the browser cache API responses indefinitely | Fast perceived perf | Users see stale progress after logging from another tab/device | NEVER without explicit invalidation strategy |
| Skip email verification entirely ("solo product, I trust users") | Ship auth faster | Account recovery becomes impossible; orphaned accounts accumulate | NEVER for a public product |
| Store password reset tokens as predictable user IDs | Simple reset flow | Trivially brute-forceable; account takeover risk | NEVER — use crypto-random tokens with short expiry |
| Inline all progress-bar animations with CSS `width` transitions | Easy to implement | Layout thrash, jank on low-end devices, LCP regressions | Acceptable if bars update < 1x/sec; otherwise use `transform: scaleX` |
| Defer "past months read-only" enforcement to UI only | Ships v1 faster | Server-side edits remain possible; bugs in UI let users corrupt history | NEVER — enforce on the API, not just the button state |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Auth provider (NextAuth / Clerk / Supabase Auth) | Trusting the default session cookie settings without setting `Secure`, `HttpOnly`, `SameSite=Lax` in production | Verify cookie flags in the network tab on production domain before shipping auth |
| Password reset email | Using a user-PII-derived token (user_id hash) | Generate `crypto.randomBytes(32)`-equivalent, single-use, 15-minute expiry, stored hashed server-side |
| Email provider (SES / Resend / Postmark) | Relying only on delivery for reset emails, no rate limit | Rate-limit password reset requests per-email AND per-IP; log reset attempts |
| Database hosted Postgres (Neon / Supabase / Railway) | Missing index on `(user_id, month)` compound lookup | Add the composite index before any dashboard load — it will be the hottest query |
| CDN / hosting (Vercel / Netlify) | Caching authenticated API responses at the edge | Explicitly set `Cache-Control: private, no-store` on any endpoint returning user data |
| Session storage | Storing session in URL query param (seen in some SSR frameworks) | Use HttpOnly cookies, never URL params; verify no session token leaks to client-visible props |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 on dashboard (query each goal's logs separately) | Dashboard load time scales linearly with goal count | Single query with LATERAL join or aggregated subquery returning all goals + current progress | At ~15-20 goals per user, or any user with a long history |
| Animating progress bars via `width` + re-render on every log | Jank when multiple bars update; layout shift (CLS regression) | Use `transform: scaleX()` (or `translateX`) + `will-change: transform`; update with CSS transition, not JS per-frame | Noticeable on low-end devices; shows in Lighthouse CLS score |
| Loading every past month on dashboard mount | Slow initial load; memory growth for long-term users | Load current month only; lazy-load past months on navigation | After ~6 months of user history |
| No index on `(user_id, logged_local_date)` in logs table | "Did I log today" query slows as logs grow | Composite index on the exact query shape | After ~1k logs per user |
| Progress-bar re-animates from 0 on every re-render | Visual flicker; feels "twitchy" | Persist from-value in component state; animate only on real change | Immediately — user-visible on first use |
| Polling for updates instead of optimistic UI | Progress bar doesn't move until server round-trip (300-800ms) | Optimistic update immediately, reconcile on response | Immediately — user-perceived latency |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Not invalidating server-side session on logout (only clearing client cookie) | Stolen session cookie remains valid after user "logs out" | Invalidate session in the session store on logout; use a server-side session allowlist, not stateless-only JWTs |
| Password reset tokens that don't expire or are reusable | Old reset links become persistent account takeover vectors | Single-use, 15-minute expiry, invalidated on use AND on password change |
| Missing rate limit on login and password-reset endpoints | Credential stuffing, reset-email abuse | Per-IP and per-email rate limits (e.g., 5 attempts / 15 min); lockout with exponential backoff |
| Authorization checks only on UI routes, not API routes | User A accesses User B's goals by guessing IDs | Every API handler verifies `goal.user_id === session.user_id` — enforce at query level with Row-Level Security if available |
| Trusting client-supplied timezone for server logic | Malicious client can log progress into arbitrary months/days | Accept client tz as a hint; validate against user's stored tz; flag mismatches |
| Logging full request bodies including session tokens | Tokens leak to log aggregator / error tracker | Sanitize sensitive headers and cookies before logging; redact `Authorization` and `Cookie` headers in Sentry/Datadog integrations |
| No CSRF protection on state-changing endpoints | Attacker can log progress or delete goals on behalf of logged-in user | Use SameSite=Lax cookies + CSRF tokens on non-GET endpoints; verify framework defaults before shipping |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Streak counter as hero metric | Streak anxiety; abandonment after first break | Progress bar + completion rate as hero; streak secondary |
| No "life happens" skip / rest-day affordance | Users stop logging entirely when a perfect run becomes impossible | Explicit "skip today" that preserves streak or shows an intentional gap |
| Silent month rollover | Users feel data was lost; bounce on the 1st | Visible rollover prompt with clear options (carry, fresh, copy) |
| Tiny progress bars on new goals | Day 3 feels like failure | "On-pace" view or "warming up" visual state for first week |
| Past-months view buried in menu | Users don't realize history is preserved | Month-picker at top of dashboard; 1-click access |
| Log-progress button below the fold | Friction on the highest-frequency action | Primary action visible above fold on every goal card |
| Requiring goal-type choice upfront in onboarding | Paralysis before first value | Default to simplest type (count); allow conversion later |
| Progress bar animates from 0 on every page load | Feels fake, distracting, eventually annoying | Animate only on actual change; persist display state |
| Undo-free "mark complete" on habits | One misclick feels punishing | Allow unchecking same-day logs; confirm destructive cross-day edits |
| Forgetting to mobile-test the dashboard | Responsive web promise breaks on phone browsers | Dashboard must be usable at 375px width; it will be the primary form factor for most check-ins |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Auth:** Often missing: server-side session invalidation on logout — verify by logging out and replaying the cookie in Postman; must 401.
- [ ] **Password reset:** Often missing: token expiry and single-use — verify by using a reset link twice, and by using one older than 15 minutes.
- [ ] **Daily logging:** Often missing: DST-day handling — test by setting system clock to the spring-forward day and logging at 2:30 AM local.
- [ ] **Month rollover:** Often missing: the actual behavior on the 1st — test by setting system clock to March 31 at 11:58 PM, log progress, advance to April 1 at 12:02 AM, verify log is in March and dashboard shows April correctly.
- [ ] **Timezone handling:** Often missing: traveler scenario — test by changing system tz, logging progress, and changing back.
- [ ] **Past months:** Often missing: server-side read-only enforcement — verify by sending a PATCH to a past-month goal; must 403.
- [ ] **Progress bars:** Often missing: animation on actual value change (not mount) — verify with React DevTools that the from-value persists across renders.
- [ ] **Dashboard:** Often missing: empty-state for brand-new users — verify by signing up a fresh account; first screen must not be blank.
- [ ] **Onboarding:** Often missing: path from signup to first log in under 2 minutes — verify with a stopwatch on a new account.
- [ ] **Mobile browser:** Often missing: touch-target sizing on progress-log buttons — verify at 375px with thumb-reach testing.
- [ ] **Habit streaks:** Often missing: explicit "skip / rest day" affordance — verify by asking "what do I do when I'm sick?" Needs a real answer in the UI.
- [ ] **Goal types:** Often missing: server-side validation that a count-type goal can't receive a checklist-type log — verify by crafting a bad request.
- [ ] **Session cookies:** Often missing: Secure + HttpOnly + SameSite=Lax in production — verify in browser devtools on the deployed URL.
- [ ] **API authorization:** Often missing: per-request user_id check — verify by attempting to read a known-other-user goal ID; must 403/404.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Timezone strategy wrong (stored only UTC, users complain streak reset on travel) | HIGH | Backfill local date + tz for existing logs using best-effort (user's stored tz at log time), migrate schema, add dual-write, announce the fix, offer streak-restore for affected users |
| Schema over-unified (single `goals` table with JSONB config) | MEDIUM | Add new type-specific tables, dual-write for a release, migrate reads, drop JSONB columns after validation |
| Schema over-split (3 separate tables with no parent) | MEDIUM | Introduce shared `goals` parent table via migration, backfill parent rows, add FK, refactor dashboard query |
| Streak anxiety reports / churn data | LOW | Add "skip day" affordance; change hero metric from streak to completion rate; communicate to users as a feature, not a fix |
| Month-rollover confusion | LOW | Add explicit rollover prompt and visible month navigation; can be hotfixed |
| Auth session not invalidated on logout | LOW-MEDIUM | Add server-side session store + allowlist check; force-logout all sessions on deploy |
| Progress bar jank (CLS regression) | LOW | Swap `width` transitions for `transform: scaleX`; add `will-change`; ship fix same-day |
| Dashboard N+1 query on goals | LOW-MEDIUM | Rewrite to single aggregated query; add composite index; verify with EXPLAIN |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Streak anxiety replaces intrinsic motivation | Habit-type implementation phase | Builder's daily-use test for 30 days; "life happens" affordance present; streak is secondary visual |
| Timezone / DST bugs at boundaries | Foundations / data-model phase | Unit tests for DST days, month boundaries, timezone travel; local date + tz stored per log |
| Over-engineered polymorphic schema | Foundations / data-model phase | Dashboard query is < 30 lines; adding a 4th goal type is a thought experiment reviewed before schema lock |
| Month-boundary UX data loss | Dashboard / month-navigation phase | Real month transition survived in staging / builder use; rollover is visible and reversible |
| Slow progress = demotivating dashboard | Dashboard / visual-design phase | Dashboard tested at day 1, 3, 15, 29 of a real or simulated month; feels good at each |
| Onboarding asks too much | Auth + onboarding phase | Signup-to-first-log under 2 minutes; no multi-step wizard before dashboard |
| Session management (logout invalidation, reset tokens) | Auth phase | Manual test: logout + cookie replay returns 401; reset link single-use and 15-min expiry |
| N+1 / missing indexes | Dashboard / backend phase | EXPLAIN plan reviewed; composite indexes on (user_id, month) and (goal_id, logged_local_date) |
| Progress-bar jank / CLS | Dashboard / visual-design phase | Lighthouse CLS < 0.1; DevTools performance recording shows no layout thrash on log |
| Past-month editability | Data model + API phase | Server returns 403 on writes to past-month goals, not just UI disabled |
| Mobile browser breakage | Dashboard / visual-design phase | 375px viewport pass; thumb-reach pass on primary actions |

---

## Sources

### Product psychology pitfalls (streak, gamification, abandonment, onboarding, visual feedback)
- [Why Do 90% of People Quit Habit Trackers Within 30 Days? — Moore Momentum](https://mooremomentum.com/blog/why-do-90-of-people-quit-habit-trackers-within-30-days/)
- [The Psychology of Streaks: Why They Work (And When They Backfire) — Cohorty](https://blog.cohorty.app/the-psychology-of-streaks-why-they-work-and-when-they-backfire/)
- [The Habit Streak Paradox — Work Brighter](https://workbrighter.co/habit-streak-paradox/)
- [Why Streaks Fail for Habits — Polygon](https://www.polygonapp.io/blog/why-streaks-fail-for-habits)
- [Breaking The Chain: Why Streak Features Fail ADHD Users — Klarity](https://www.helloklarity.com/post/breaking-the-chain-why-streak-features-fail-adhd-users-and-how-to-design-better-alternatives/)
- [Counterproductive effects of gamification (Habitica study) — ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S1071581918305135)
- [Gamification in Habit Tracking: Research + Real User Data — Cohorty](https://www.cohorty.app/blog/gamification-in-habit-tracking-does-it-work-research-real-user-data)
- [Knowledge Cuts Both Ways: When Progress Bars Backfire — Irrational Labs](https://irrationallabs.com/blog/knowledge-cuts-both-ways-when-progress-bars-backfire/)
- [Goal-Gradient Effect and the Psychology of Progress Bars — Bootcamp / Medium](https://medium.com/design-bootcamp/goal-gradient-effect-and-the-psychology-of-progress-bars-df6fd889fd8e)
- [Why Users Drop Off During Onboarding — SaaS Factor](https://www.saasfactor.co/blogs/why-users-drop-off-during-onboarding-and-how-to-fix-it)
- [App onboarding: How to fix drop-off points — PostHog](https://posthog.com/blog/how-to-find-and-fix-app-onboarding-drop-off)

### Technical: timezone / DST / date handling
- [How to Handle Date and Time Correctly to Avoid Timezone Bugs — dev.to](https://dev.to/kcsujeet/how-to-handle-date-and-time-correctly-to-avoid-timezone-bugs-4o03)
- [How a Time Zone Change Could Break Your Apps — Alberto Varela](https://www.albertovarela.net/blog/2025/10/time-zone-change-break-apps/)
- [Temporal API — MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal)
- [Common Timestamp Pitfalls and How to Avoid Them — DatetimeApp](https://www.datetimeapp.com/learn/common-timestamp-pitfalls)
- [Why Is My Ai Habit Tracker Resetting Streaks After Timezone Changes — Alibaba](https://www.alibaba.com/product-insights/why-is-my-ai-habit-tracker-resetting-streaks-after-timezone-changes-during-travel.html)
- [Best practices for timestamps and time zones in databases — Tinybird](https://www.tinybird.co/blog/database-timestamps-timezones)

### Technical: schema / polymorphism
- [Choosing a Database Schema for Polymorphic Data — DoltHub](https://www.dolthub.com/blog/2024-06-25-polymorphic-associations/)
- [Single Table Inheritance — GitLab Docs (recommends against)](https://docs.gitlab.com/development/database/single_table_inheritance/)
- [Table Inheritance Patterns: Single Table vs. Class Table vs. Concrete Table — Medium](https://medium.com/@artemkhrenov/table-inheritance-patterns-single-table-vs-class-table-vs-concrete-table-inheritance-1aec1d978de1)

### Technical: auth / session / password reset
- [What Is Broken Authentication? — QAwerk](https://qawerk.com/blog/what-is-broken-authentication/)
- [Password Reset Best Practices — Authgear](https://www.authgear.com/post/authentication-security-password-reset-best-practices-and-more)
- [Broken Session Management Vulnerability — SecureFlag](https://knowledge-base.secureflag.com/vulnerabilities/broken_authentication/broken_session_management_vulnerability.html)

### Technical: caching / state / progress bars
- [Why Your UI Won't Update: Debugging Stale Data and Caching — freeCodeCamp](https://www.freecodecamp.org/news/why-your-ui-wont-update-debugging-stale-data-and-caching-in-react-apps/)
- [Creating a jank free media progress bar — Medium](https://medium.com/@ralphholzmann/creating-a-jank-free-media-progress-bar-3f31db3d1c43)
- [Complex Animations Causing Jank? Optimize Your CSS Animations — Pixel Free Studio](https://blog.pixelfreestudio.com/complex-animations-causing-jank-optimize-your-css-animations/)

---
*Pitfalls research for: Monthly commitment / goal-tracking web app*
*Researched: 2026-04-17*
