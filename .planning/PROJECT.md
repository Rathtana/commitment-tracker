# Commitment Tracker

## What This Is

A web app for tracking monthly commitments. Users set multiple goals each month — count-based (e.g., "read 5 books"), task checklists, or habits — and watch a visual progress bar move as they log progress. Dashboard-first: open the app, see every goal at a glance, feel the pull to check something off. Public product, but shaped first around daily personal use.

## Core Value

The visual feedback has to feel good enough that users *want* to open the dashboard — progress bars moving is the draw, everything else supports that.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] User can sign up and log in (public product)
- [ ] User can create goals for a specific month
- [ ] User supports three goal types: count-based, task checklist, habit/streak
- [ ] User can log progress against each goal (increment count, check task, mark habit done)
- [ ] Dashboard shows all current-month goals at a glance with visual progress bars
- [ ] User can view past months' goals read-only
- [ ] User can pre-set goals for future months (not restricted to current month)
- [ ] Current month's goals persist until the user sets new ones for the next month

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Native mobile apps — web-first; responsive browser use is enough for v1
- Social / sharing / accountability features — personal use case first
- Trend charts across many months — month-over-month view is sufficient for v1
- Automatic progress sources (fitness APIs, calendar integration) — manual logging only
- Editing past months — past months are read-only history
- Team / multi-user goals — single-user accounts only

## Context

- Builder's success metric is personal daily use — if it doesn't survive that bar, it won't work publicly either.
- Visual feedback is the identified draw. The progress bar style is open (horizontal bar, ring, or multi-goal grid) and should be a deliberate design decision, not default.
- "Mixed goal types" means the data model has to cleanly handle three different progress shapes. Don't paper over the distinction.
- Month boundary is a meaningful UX moment — "new month" must feel fresh without erasing history.

## Constraints

- **Platform**: Web app only for v1 — responsive design so mobile browsers are usable, but no native apps.
- **Users**: Public product (auth required from day one), but optimize UX around a single user's daily flow before social features.
- **Scope discipline**: Three goal types are in v1 equally — resist the temptation to narrow, but also don't let scope creep add social/integrations.

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web app, not native mobile | Faster to build, responsive web covers mobile use case in v1 | — Pending |
| All three goal types in v1 | User rejected narrowing to one type; mixed support is core to the vision | — Pending |
| Manual progress logging only | Keeps scope bounded; automatic integrations are a v2+ conversation | — Pending |
| Past months read-only | Simplifies data model and preserves history as a motivator | — Pending |
| Goals are month-scoped | Monthly cadence is the product's rhythm; goals belong to a specific month | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-17 after initialization*
