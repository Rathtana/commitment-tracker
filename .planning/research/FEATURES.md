# Feature Research

**Domain:** Monthly commitment / goal-tracking web app (single-user, public product)
**Researched:** 2026-04-17
**Confidence:** MEDIUM-HIGH (strong on ecosystem patterns; medium on novel combinations since monthly-cadence + three-types + dashboard-first is not a dominant template in existing apps)

## Research Framing

The ecosystem is crowded with two dominant shapes:
1. **Daily habit trackers** (Streaks, Loop, Way of Life, Habitica's "Dailies") — optimized for streaks, one checkbox per day
2. **Long-horizon goal trackers** (Strides, Lifetick, Griply) — optimized for SMART goals with open-ended deadlines

This product sits in the *middle* with a **monthly cadence**. That's a deliberate UX choice: a month is long enough to accommodate count-based goals ("read 5 books") and task lists, but short enough to preserve the "fresh start" moment monthly-reset communities already practice with paper planners. The research should not default to "build another daily habit tracker" — the monthly rhythm changes what's table stakes.

**Two findings shape everything below:**
- **Streak psychology is a trap when done naively.** Research on abstinence violation effect and gamification counterproductivity (Habitica study) shows all-or-nothing streak counters cause users to quit entirely after one break. For a product that must survive daily use by its builder and appeal publicly, streaks need forgiving design or reframing.
- **Progress bars ARE the product.** The PROJECT.md is explicit: visual feedback is the draw, not a garnish. Every feature decision should reinforce "user opens app, sees bars move" — anything that competes for that moment of attention is suspect.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist for a public goal/habit tracker in 2026. Missing these = product feels incomplete and users leave.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Email/password auth + session persistence | Public product; user expects their data survives logout | LOW | Covered in PROJECT.md Active requirements. Keep to email+password for v1; OAuth is v2. |
| Create/edit/delete a goal | Baseline CRUD; non-negotiable | LOW | Delete must be confirmable (accidental taps). Edit only applies to current/future months. |
| Three goal types: count-based, task checklist, habit/streak | Called out as equal-priority in PROJECT.md constraints | MEDIUM | Data model must cleanly separate — do not paper over the distinction. See Architecture research for schema. |
| Log progress (increment count, check task, toggle habit day) | Core interaction loop; the thing users do daily | LOW-MEDIUM | Must be ONE tap/click from dashboard. Anything more kills daily use. |
| Dashboard showing all current-month goals at a glance | Called out as "the draw" in PROJECT.md | MEDIUM | No drill-down required for the baseline action (logging). Scroll is acceptable; pagination is not. |
| Visual progress bar per goal | Central to the value prop — "bars moving is the draw" | MEDIUM | All three goal types must render a meaningful bar. Count: X/Y filled. Checklist: completed/total. Habit: days-done/days-elapsed-in-month (NOT days-done/days-in-month, see below). |
| Goal name + target + optional notes | Baseline data per goal | LOW | Notes field is optional but expected — users want to remember *why* a goal matters. |
| Past months are viewable (read-only) | Users want to feel progress over time | MEDIUM | PROJECT.md explicitly includes this. Navigate by month selector. Don't allow edits. |
| Mobile-responsive web | PROJECT.md constraint; web is the only platform in v1 | MEDIUM | Dashboard must look correct on phone (progress bars stack vertically, single-column). Touch targets >= 44px. |
| Logout | Basic account hygiene | LOW | Trivial but users panic if absent on a public product. |
| Password reset | Expected for any public login system | LOW-MEDIUM | Email-based flow. Can use auth library (e.g., NextAuth, Supabase Auth) to avoid rolling your own. |
| New-month behavior (current month persists until user sets new) | PROJECT.md Active requirement | LOW-MEDIUM | On day 1 of new month, dashboard still shows last month's goals (editable carryover) until user acts. Needs a "copy goals to new month" affordance to reduce setup friction. |
| Basic error states (save failed, offline) | Users lose trust without them | LOW | Toast/inline errors; must not lose user input. |

### Differentiators (Competitive Advantage)

Features where the monthly + three-types + dashboard-first combination unlocks real advantages over the Streaks/Habitica/Strides crowd.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Month as the unit of commitment** | Most competitors force a daily or open-ended deadline. A month is a natural "chapter" — long enough for real goals, short enough that failure isn't catastrophic. This is already a distinct positioning. | LOW (it's a design decision, not code) | Make the month visible and celebrated in the UI (big month/year header on dashboard). |
| **Pace-aware progress bars** | A bar that just shows "3/5 books" is dumb mid-month. "3/5 books, you're on pace" or "behind by 1" turns the bar into a motivator. | MEDIUM | Compute: expected progress = (days_elapsed / days_in_month) * target. Render as a subtle "pace line" on the bar or a colored zone. Applies to count-based and habit goals; checklist can skip. |
| **Unified dashboard across three goal types** | Strides and Griply come closest, but most trackers treat types as separate tabs. A single scrollable dashboard where a "read 5 books" bar sits next to a "meditate daily" bar is genuinely rare. | MEDIUM | Cards should be visually consistent despite underlying type differences — same bar chrome, same tap-to-log pattern. |
| **Future-month pre-planning** | PROJECT.md allows setting goals ahead. Users planning a "clean eating May" in mid-April is a real workflow most trackers don't support (they're current-moment focused). | LOW-MEDIUM | Month selector should let user go forward as well as back. Empty future months get a "Plan for [month]" CTA. |
| **Read-only history as motivation surface** | Past months become a portfolio of wins. Competitors often bury history or charge for it. | LOW-MEDIUM | Past-month view should feel complete, with an "at the end of [month]" summary line ("Completed 4 of 6 goals"). |
| **Forgiving habit tracking (no punishing streak counter)** | Research shows streak counters cause quitting after one break. An alternative: "X days this month" as the metric. Missing a day still hurts (the bar doesn't fill that day) but doesn't reset anything. | LOW | This is primarily a design choice: don't show a "current streak: 0" counter that zeroes out. Show "17 of 30 days" — still motivating, still honest, no catastrophic fail-state. |
| **"Copy from last month" on new-month setup** | Reduces friction of the monthly ritual. Users who want continuity get it in one click; users who want reset get a blank slate. | LOW | Crucial for retention — without this, the first of every month is an off-ramp. |
| **End-of-month reflection prompt (lightweight)** | Monthly-reset communities already do this with paper. A two-line "what worked / what didn't" field per month makes history more meaningful and is a natural close-out. | LOW | Optional. Shown on last 3 days of month and on archived month view. NOT a hard gate. |
| **Direct-to-action dashboard** | No tabs, no menus, no drill-down to log progress. Tapping a count goal increments. Tapping a task checks it. Tapping a habit marks today. This is the whole game. | MEDIUM | Requires careful optimistic UI + undo (see pitfalls). |
| **Weekday/month-label design** | Monthly grid for habits (not just a bar) shows which specific days were hit. This is the classic "paper habit tracker" visual users already love. | MEDIUM | For habit goals, offer a mini-calendar view alongside the bar. Can be click-to-toggle historical days within the current month. |

### Anti-Features (Deliberately NOT Built)

Features that look appealing but would dilute the product, create maintenance burden, or contradict the core value prop.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Social feeds / friends / accountability partners** | Habitica's party system is popular; "public accountability works" is folk wisdom | PROJECT.md explicitly out of scope. Social features add auth complexity, moderation burden, privacy considerations, and distract from the personal-use focus. Builder's own daily use is the success metric. | Keep single-user. Revisit only after validated. |
| **Punishing streak counters (zero on break)** | Duolingo-style streaks drive engagement in short term | Research shows abstinence violation effect: users quit entirely after one break. Bad for a product the builder must use daily (one sick day and motivation collapses). | Use "X of N days this month" — never resets catastrophically. |
| **Gamification layer (XP, levels, avatars, pets)** | Habitica's RPG layer is popular | Study on Habitica shows counterproductive effects (punishment during productive-but-busy periods, extrinsic motivation crowding out intrinsic). Also visually competes with progress bars for the "draw" role. | The progress bar IS the reward. Let it be. |
| **Financial stakes (Beeminder-style)** | Loss aversion is motivating for some | Requires payment infrastructure, creates anxiety that's "not healthy for everyone," tiny target user overlap with a simple monthly tracker. | Out of scope. Very different product. |
| **Complex category hierarchies / tags / folders** | "Organize by Health / Work / Personal" feels clean | Categories force users to commit to taxonomies before they know what they want to track. Monthly scope is already a container. Adds UI for zero value at <20 goals. | Flat list. If needed later, a single optional color or emoji per goal is plenty. |
| **Trend charts across many months** | "Show me my progress over the year" sounds valuable | PROJECT.md out of scope for v1. Requires design work for low-frequency value. Month-over-month comparison via history view is enough. | Read-only month archive. Add charts post-validation if users ask. |
| **Automatic progress sources (HealthKit, Strava, calendar)** | Less manual logging sounds better | PROJECT.md out of scope. Each integration is its own product, with auth/API/edge-cases. Kills focus. | Manual logging only. It's an active ritual, not a bug. |
| **Editing past months** | "I forgot to log last Tuesday" | PROJECT.md out of scope. Editing history corrupts the "portfolio of honest wins" that makes history motivating. | Forgive missed-day entries within the current month only. Past months freeze on the 1st. |
| **Complex recurring goal logic (weekly, 3x/week, "weekdays only")** | "Gym 3x a week" is a real user need | Weekly cadence within monthly scope is a significant UX complication: what happens to the bar when week boundaries don't align with the month? Target the simpler case first. | Count-based for "3x/week" → target of 12-13 over a month. Habit type stays daily. Revisit if users complain. |
| **Notifications/push reminders in v1** | Every habit-tracker listicle says reminders matter | True but expensive: push infra, PWA setup, timing heuristics, notification fatigue management. Not all table-stakes battles are worth fighting in v1. See section below — email reminders can be a lightweight v1.x. | Ship without notifications. Builder's own daily use proves whether the dashboard pull alone works. Add email-based reminders post-validation. |
| **Goal templates / pre-made goals** | "I don't know what to track" | Real problem, but templates presume a taxonomy (see categories) and make the product feel prescriptive. | Empty-state example goals (see below) without "add with one tap" — user types their own. |
| **Shareable goal pages / public profile** | Growth-loop thinking | Single-user scope. Moderation burden. Privacy. Skip entirely. | None. |
| **AI goal coaching / suggestions** | "2026 trend" | Adds LLM cost, latency, correctness risk, privacy implications for what is fundamentally a visual-feedback product. | None in v1. |
| **Dark mode as a launch feature** | Common modern expectation | Table stakes for sites that live at night. For a tracker opened briefly each day, system-preference-respecting default CSS is enough. | Respect `prefers-color-scheme` via CSS; don't build a manual toggle until asked. |

### Notification/Reminder Expectations (Detailed)

Habit-tracker listicles universally list reminders as essential. For this product specifically, the analysis is more nuanced:

- **v1: No reminders.** Web app, no mobile push available without PWA infra. Builder's own daily use is the acid test — if the dashboard itself is compelling, the app will pull users back without notifications. If it's not, no reminder saves it.
- **v1.x (post-launch): Optional daily email at user-selected time.** One email, batched — "Your goals for [month], day X of Y" with progress summary and click-to-log link. Uses cron + transactional email (SendGrid/Resend). Low complexity, high legibility.
- **Explicit anti-pattern: per-goal reminders.** Multiple reminders per user per day = fatigue. Research: "one perfectly-timed reminder" > many reminders.
- **Never: re-engagement emails.** ("We miss you!" "Your streak is at risk!") These are growth-hack patterns that violate user trust. The product's job is to be worth returning to.

### Onboarding Expectations (First-Run Experience)

Best-practice research: empty states are onboarding, one clear CTA, positive tone, no user-blame language.

For this product, a very light onboarding is appropriate:

1. **Sign-up → land on empty dashboard for current month.** No tour overlay, no checklist.
2. **Empty dashboard shows:** a friendly headline ("It's [Month]. What do you want to commit to?"), 2-3 example goal ideas rendered as greyed-out cards (not clickable to auto-add — just to show what goals look like once the user has some), and a single prominent "Add your first goal" CTA.
3. **First "add goal" flow should require users to pick a goal type.** This is the one piece of education that can't be skipped — the three types are the product's vocabulary. Use clear descriptions with a tiny example for each ("Count: Read 5 books", "Checklist: Home renovation steps", "Habit: Meditate daily").
4. **After first goal created, dashboard now shows one real card + the "Add goal" button.** No confetti, no tour — the bar is the reward.
5. **After 3 goals, gentle inline hint:** "Tap your goal to log progress" (if no progress has been logged). Dismissible, never reappears.

**Explicitly skip:** multi-step tours, welcome videos, email-verification-before-use walls, "invite friends" nags, "set your timezone" prompts (infer it), persona quizzes ("Are you a planner or doer?"), pre-populated starter goals.

### Empty-State Design (Dashboard with Zero Goals)

The empty dashboard is the single most sensitive screen in the product. A new user with zero goals sees it; a user on day 1 of a new month who hasn't set goals yet sees it; a user who deleted everything sees it. Three distinct copy treatments:

| Context | Headline | Body | CTA |
|---------|----------|------|-----|
| First-ever login | "It's [Month]. What do you want to commit to?" | Short explainer + 3 greyed example cards demonstrating the three types | "Add your first goal" |
| New month, no goals yet | "New month, fresh start." | "Your [previous month] goals are archived. Pick up where you left off, or start fresh." | Two buttons: "Copy from [previous month]" + "Start blank" |
| Deleted all goals mid-month | "Clean slate." | "When you're ready, start with one goal." | "Add a goal" |

Empty-state design anti-pattern: the same "You have no goals!" screen for all three contexts. Ship them distinct from day one — it's a small amount of code that drastically improves the product's emotional intelligence.

## Feature Dependencies

```
[Auth / Account]
    └──requires──> nothing (foundation)

[Goal CRUD (month-scoped)]
    └──requires──> [Auth]

[Three goal types (schema)]
    └──requires──> [Goal CRUD]

[Progress logging (increment/check/toggle)]
    └──requires──> [Three goal types]
    └──requires──> [Goal CRUD]

[Dashboard (current month, all goals, progress bars)]
    └──requires──> [Progress logging]
    └──enhances───> [Empty state design]

[Month navigation / past-month read-only view]
    └──requires──> [Dashboard]
    └──requires──> [Goal CRUD (has month field)]

[Future-month planning]
    └──requires──> [Month navigation]

[Copy goals from last month]
    └──requires──> [Future-month planning]
    └──requires──> [Month navigation]

[Pace-aware progress (behind/on-pace)]
    └──enhances──> [Progress bars]
    └──requires──> [Progress logging]

[Habit mini-calendar view]
    └──enhances──> [Dashboard]
    └──requires──> [Habit goal type]

[End-of-month reflection prompt]
    └──enhances──> [Month navigation]
    └──requires──> [Past-month view]

[Email reminders (post-v1)]
    └──requires──> [Auth email confirmed]
    └──requires──> [Dashboard]
```

### Dependency Notes

- **Everything downstream of [Three goal types (schema)] is gated on that schema being right.** Getting the data model correct for count/checklist/habit in a unified way is the single highest-leverage decision in the roadmap. See Architecture research.
- **Dashboard is NOT blocked by past-month view.** Current-month dashboard + progress logging is a shippable slice; past-month navigation can come in a later phase.
- **Pace-aware progress is a cheap enhancement with outsized emotional impact** — can ship in phase 1 or defer to phase 2 depending on roadmap pressure. It's a small pure function, not a subsystem.
- **Copy-from-last-month is critical the first time a user crosses a month boundary.** If it lands after most early users have already hit the new-month friction, the feature is late.

## MVP Definition

### Launch With (v1) — The Non-Negotiable Slice

This is what ships to make the product real. Removing any of these breaks the value prop.

- [ ] **Email/password signup + login + logout + session** — public product, required from day 1
- [ ] **Create/edit/delete goal** — CRUD, with month field (default to current)
- [ ] **Three goal types with distinct progress shapes** — count (with target), checklist (with task rows), habit (with per-day toggles)
- [ ] **Log progress in one click/tap from dashboard** — optimistic update
- [ ] **Dashboard: all current-month goals, visual progress bars, single scrollable list** — mobile-responsive
- [ ] **Month navigation (past + future)** — simple prev/next arrows or month dropdown
- [ ] **Past months are read-only** — enforced in API and UI
- [ ] **Pre-set goals for future months** — just let user navigate forward and add
- [ ] **Current-month goals persist across the month boundary** — until user explicitly sets up next month
- [ ] **Empty-state screens (3 variants)** — first-ever, new-month, deleted-all
- [ ] **Pace indicator on count/habit bars** — "on pace" / "behind by N" micro-copy
- [ ] **Password reset via email** — public product expectation
- [ ] **Basic error handling + toasts** — save failures must not silently drop data

### Add After Validation (v1.x)

Ship once v1 is validated in real daily use.

- [ ] **"Copy goals from last month" button** — trigger: first new-month transition after launch
- [ ] **Optional per-goal notes field (rich text or markdown)** — trigger: users want context on goals
- [ ] **End-of-month reflection prompt** — trigger: after 2-3 completed months, validate the monthly ritual
- [ ] **Habit mini-calendar (grid view for habit goals)** — trigger: users ask to see which specific days they hit
- [ ] **Daily email reminder (optional, opt-in, single batched email)** — trigger: observation that some users drop off mid-month
- [ ] **Undo on progress log (5-second toast)** — trigger: first accidental-tap complaint
- [ ] **Delete-goal confirmation modal** — trigger: ship with v1 actually; promoted out of v1.x if budget allows

### Future Consideration (v2+)

Defer until product-market fit is established.

- [ ] **Trend view across multiple months** — only if users ask; expensive design work for low-frequency use
- [ ] **OAuth sign-in (Google/Apple)** — if sign-up friction appears in funnel data
- [ ] **PWA + push notifications** — only if email reminders validate the need for reminders at all
- [ ] **Goal sharing / public profile** — explicitly deferred; social is out of scope per PROJECT.md
- [ ] **Native mobile apps** — explicitly out of scope per PROJECT.md
- [ ] **Auto-sync integrations (HealthKit, Strava, etc.)** — explicitly out of scope per PROJECT.md
- [ ] **Team/shared goals** — explicitly out of scope per PROJECT.md
- [ ] **Advanced recurring goal logic (weekly cadence, weekdays only)** — revisit if count-based doesn't cover the use case
- [ ] **Color/emoji per goal** — lightest possible categorization if users ask

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Email auth + session | HIGH | LOW | P1 |
| Goal CRUD with month field | HIGH | LOW | P1 |
| Three goal types (schema + UI) | HIGH | MEDIUM | P1 |
| Progress logging (1-click from dashboard) | HIGH | MEDIUM | P1 |
| Dashboard with all goals + progress bars | HIGH | MEDIUM | P1 |
| Responsive design (mobile browser) | HIGH | MEDIUM | P1 |
| Month navigation (past/future) | HIGH | LOW | P1 |
| Past-month read-only enforcement | MEDIUM | LOW | P1 |
| Empty-state design (3 variants) | HIGH | LOW | P1 |
| Pace indicator on bars | HIGH | LOW | P1 |
| Password reset | MEDIUM | MEDIUM | P1 |
| Copy-from-last-month | HIGH | LOW | P2 |
| End-of-month reflection | MEDIUM | LOW | P2 |
| Habit mini-calendar view | MEDIUM | MEDIUM | P2 |
| Per-goal notes | MEDIUM | LOW | P2 |
| Optional email reminders | MEDIUM | MEDIUM | P2 |
| Undo on progress log | LOW-MEDIUM | LOW | P2 |
| Cross-month trend charts | LOW (initially) | HIGH | P3 |
| OAuth | LOW (initially) | MEDIUM | P3 |
| PWA + push | LOW | HIGH | P3 |
| Social / sharing | — (anti-feature for v1) | HIGH | OUT |
| Gamification layer | — (anti-feature) | HIGH | OUT |
| Integrations | — (anti-feature per PROJECT.md) | HIGH | OUT |

**Priority key:**
- P1: Must have for launch — cutting these breaks the product
- P2: Post-launch — add within first few weeks based on real use
- P3: Future — defer until validated need
- OUT: Anti-feature, deliberately not built

## Competitor Feature Analysis

| Feature | Habitica | Streaks | Strides | Griply | **This Product** |
|---------|----------|---------|---------|--------|------------------|
| Goal types | Habits + Dailies + To-Dos | Daily habits only | Habit + Target + Average + Project | Goals + linked habits | **Count + Checklist + Habit (equal-weight, month-scoped)** |
| Time scope | Open-ended | Daily | Open-ended | Mixed | **Monthly (enforced)** |
| Primary visual | Character sheet | Streak numbers | Charts + bars | Unified insights dashboard | **Progress bars, dashboard-first** |
| Streak treatment | Punishing (die in dungeon) | Core metric | Option among several | Soft | **"X of N days this month" — no punishing reset** |
| Social | Party/guild system | None | None | None | **None (deliberate)** |
| Gamification | Heavy (RPG) | Subtle animations | None | None | **None (anti-feature)** |
| Platform | iOS/Android/web | iOS only | iOS only | iOS + web | **Web only, responsive** |
| Onboarding | Character creation (heavy) | Minimal | Goal wizard | Light | **Minimal — 1 CTA, empty state as onboarding** |
| Notifications | Push | Push + widgets | Push | Push | **None in v1 → email opt-in v1.x** |
| History/archive | Limited | Calendar view | Charts | Insights dash | **Read-only past months, month-navigable** |
| Future planning | Not really | No | Deadline-based | Yes | **Explicit future-month pre-planning** |

**Where this product wins:**
- Month-scoped goals with three equal types is a unique positioning — no strong competitor.
- Dashboard-first with all types in one view is rare; most competitors silo by type.
- Deliberate no-gamification + no-punishing-streaks stance differentiates from Habitica/Duolingo-style.
- Future-month pre-planning is underserved.

**Where competitors win (and this product accepts):**
- Mobile apps (native) — out of scope by design.
- Integrations (HealthKit, etc.) — out of scope by design.
- Gamification for users who want it — different target user.

## Quality Gate Self-Check

- [x] Categories are clear (Table Stakes / Differentiators / Anti-Features explicitly separated)
- [x] Complexity noted for each feature (LOW / MEDIUM / HIGH on every row)
- [x] Dependencies between features identified (dedicated section + notes)
- [x] Tailored to THIS product (monthly cadence, three-types, dashboard-first invoked throughout; not a generic habit-tracker list)
- [x] Notification/reminder expectations addressed explicitly
- [x] Onboarding expectations addressed explicitly
- [x] Empty-state design addressed explicitly (three context variants)

## Sources

**Competitor analysis:**
- [Mindful Suite — Ultimate Guide to Best Habit Tracker Apps 2026](https://www.mindfulsuite.com/reviews/best-habit-tracker-apps)
- [Reclaim.ai — 10 Best Habit Tracker Apps of 2026](https://reclaim.ai/blog/habit-tracker-apps)
- [Cohorty — Ultimate Guide to Habit Tracker Apps 2026 Comparison](https://blog.cohorty.app/the-ultimate-guide-to-habit-tracker-apps/)
- [Akiflow — Beeminder vs Habitica Comparison](https://akiflow.com/blog/beeminder-vs-habitica)
- [Griply — Goal Planner, Habit Tracker & Task Manager](https://griply.app/)
- [Strides — Goal & Habit Tracker](https://www.stridesapp.com/)

**Psychology & streak design:**
- [Polygon — Why Streaks Fail for Habits](https://www.polygonapp.io/blog/why-streaks-fail-for-habits)
- [Workbrighter — The Habit Streak Paradox](https://workbrighter.co/habit-streak-paradox/)
- [Cohorty — The Psychology of Streaks](https://www.cohorty.app/blog/the-psychology-of-streaks-why-they-work-and-when-they-backfire)
- [Smashing Magazine — Designing A Streak System: UX And Psychology of Streaks](https://www.smashingmagazine.com/2026/02/designing-streak-system-ux-psychology/)
- [ScienceDirect — Counterproductive effects of gamification (Habitica study)](https://www.sciencedirect.com/science/article/abs/pii/S1071581918305135)

**Dashboard & progress bar design:**
- [Domo — What Is a Progress Bar? Types, Examples, Design Tips](https://www.domo.com/learn/charts/progress-bars)
- [Justinmind — Dashboard Design Best Practices](https://www.justinmind.com/ui-design/dashboard-design-best-practices-ux)
- [LogRocket — The Goal Gradient Effect: Boosting User Engagement](https://blog.logrocket.com/ux-design/goal-gradient-effect/)
- [Cohorty — Progress Bars and Visual Rewards Psychology](https://blog.cohorty.app/progress-bars-and-visual-rewards-psychology/)

**Empty state & onboarding:**
- [UserOnboard — Onboarding UX Patterns: Empty States](https://www.useronboard.com/onboarding-ux-patterns/empty-states/)
- [Smashing Magazine — Role Of Empty States In User Onboarding](https://www.smashingmagazine.com/2017/02/user-onboarding-empty-states-mobile-apps/)
- [NN/G — Designing Empty States in Complex Applications](https://www.nngroup.com/articles/empty-state-interface-design/)
- [SetProduct — Empty State UI Design: From Zero to App Engagement](https://www.setproduct.com/blog/empty-state-ui-design)

**Notifications:**
- [Cohorty — Best Habit Tracker Apps with Reminders 2026](https://blog.cohorty.app/best-habit-tracker-apps-with-reminders/)

**Monthly cadence / reset patterns:**
- [Bloom Daily Planners — The Power of a Reset](https://bloomplanners.com/blogs/on-the-blog/thepowerofareset)
- [Develop Good Habits — Printable Habit Tracker Templates](https://www.developgoodhabits.com/habit-tracker-template/)

---
*Feature research for: Monthly commitment / goal-tracking web app*
*Researched: 2026-04-17*
