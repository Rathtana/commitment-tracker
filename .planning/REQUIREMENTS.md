# Requirements: Commitment Tracker

**Defined:** 2026-04-17
**Core Value:** The visual feedback has to feel good enough that users *want* to open the dashboard — progress bars moving is the draw, everything else supports that.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can sign up with email and password
- [ ] **AUTH-02**: User receives an email verification link after signup
- [ ] **AUTH-03**: User can log in and stay logged in across browser sessions
- [ ] **AUTH-04**: User can log out from any page
- [ ] **AUTH-05**: User can reset a forgotten password via an emailed link

### Goals

- [ ] **GOAL-01**: User can create a goal with a name, type (count / checklist / habit), target, optional notes, and an associated month
- [ ] **GOAL-02**: User can edit a goal that belongs to the current or a future month
- [ ] **GOAL-03**: User can delete a goal with a confirmation step
- [x] **GOAL-04**: Every goal is scoped to a specific month (stored as a DATE pinned to the first of that month)
- [ ] **GOAL-05**: User can pre-set goals for future months by navigating forward before the month begins

### Progress Logging

- [ ] **PROG-01**: User can increment a count-based goal in one click directly from the dashboard
- [ ] **PROG-02**: User can toggle a sub-task done/not-done on a checklist goal from the dashboard
- [ ] **PROG-03**: User can mark today done for a habit goal in one tap from the dashboard
- [ ] **PROG-04**: User can log a missed-day check-in for any prior day within the current month (past months stay frozen)
- [ ] **PROG-05**: User can undo the last progress action via a short-lived toast

### Dashboard

- [ ] **DASH-01**: Dashboard shows all current-month goals in a single scrollable list (no tabs, no drill-down required to log progress)
- [ ] **DASH-02**: Every goal on the dashboard renders a visual progress bar reflecting its completion percentage

### Month Navigation & History

- [ ] **MNAV-01**: User can navigate between past, current, and future months via prev/next controls
- [ ] **MNAV-02**: Past-month goals are visible but read-only (no goal edits, no progress changes) — enforced in both API and UI
- [ ] **MNAV-03**: User can copy all goals from the previous month into the current month with one click
- [ ] **MNAV-04**: On the 1st of a new month the dashboard starts blank unless the user pre-set goals or uses Copy-from-last-month

### Polish

- [ ] **POLSH-01**: Dashboard and all core flows are mobile-responsive with touch targets ≥ 44px
- [ ] **POLSH-02**: Failed saves surface through error toasts or inline errors — user input is never silently dropped
- [ ] **POLSH-03**: Habit goals render a month-grid showing which specific days were hit/missed, alongside the progress bar
- [ ] **POLSH-04**: Past-month and end-of-month views include an optional two-line reflection field ("what worked / what didn't")

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Dashboard Enhancements

- **PACE-01**: Progress bars show a pace indicator ("on pace" / "behind by N") based on days elapsed in the month
- **EMPTY-01**: Distinct empty-state copy for first-ever login, new-month-no-goals, and deleted-all-mid-month

### Retention

- **REMIND-01**: Optional opt-in daily email reminder (single batched email per user per day)
- **NOTE-01**: Per-goal rich-notes field (beyond the v1 optional notes)

### Auth Extensions

- **OAUTH-01**: OAuth sign-in (Google / Apple)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Native mobile apps (iOS / Android) | Web-first in v1; responsive browser covers mobile use case |
| Social feeds / friends / accountability partners | Single-user focus; builder's daily use is the success metric |
| Gamification (XP, levels, avatars, pets) | Competes with progress bars for "draw" role; study shows counterproductive effects |
| Punishing streak counters (zero on break) | Research: abstinence-violation-effect causes full abandonment after one break |
| Financial stakes (Beeminder-style) | Different product, adds payment infra, anxiety risk |
| Trend charts across many months | Low-frequency value; read-only month archive is sufficient for v1 |
| Automatic progress sources (HealthKit, Strava, calendar) | Each integration is its own product; kills scope focus |
| Editing past months | Corrupts "portfolio of honest wins"; past months freeze on the 1st |
| Team / shared / multi-user goals | Single-user product; no moderation or permissions burden |
| Complex recurring logic (weekly, 3x/week) | Count-based goal with monthly target covers most of this; avoid cadence math within scope |
| Category hierarchies / tags / folders | Monthly scope is already a container; premature organization |
| Push notifications / PWA in v1 | Infra cost too high for v1; email reminders are a v2 alternative |
| Goal templates / pre-made goals | Presumes taxonomy; empty-state examples suffice |
| Shareable goal pages / public profile | Social is out of scope |
| AI coaching / suggestions | Adds LLM cost/latency/privacy; not core to visual-feedback value prop |
| Manual dark-mode toggle | Respect `prefers-color-scheme`; no bespoke toggle in v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| GOAL-01 | Phase 2 | Pending |
| GOAL-02 | Phase 2 | Pending |
| GOAL-03 | Phase 2 | Pending |
| GOAL-04 | Phase 1 | Complete |
| GOAL-05 | Phase 3 | Pending |
| PROG-01 | Phase 2 | Pending |
| PROG-02 | Phase 2 | Pending |
| PROG-03 | Phase 2 | Pending |
| PROG-04 | Phase 2 | Pending |
| PROG-05 | Phase 2 | Pending |
| DASH-01 | Phase 2 | Pending |
| DASH-02 | Phase 2 | Pending |
| MNAV-01 | Phase 3 | Pending |
| MNAV-02 | Phase 3 | Pending |
| MNAV-03 | Phase 3 | Pending |
| MNAV-04 | Phase 3 | Pending |
| POLSH-01 | Phase 4 | Pending |
| POLSH-02 | Phase 4 | Pending |
| POLSH-03 | Phase 2 | Pending |
| POLSH-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-17*
*Last updated: 2026-04-17 after roadmap creation (traceability table populated)*
