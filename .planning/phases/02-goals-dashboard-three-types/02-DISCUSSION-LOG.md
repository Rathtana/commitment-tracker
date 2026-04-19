# Phase 2: Goals & Dashboard (Three Types) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 02-goals-dashboard-three-types
**Areas discussed:** Schema & progress math, Goal create/edit/delete + empty state, Dashboard cards + progress bar, Logging/undo/habit month-grid

---

## Schema & progress math

### Q1 — How should the tasks child table be shaped?

| Option | Description | Selected |
|--------|-------------|----------|
| Research shape | id uuid PK, goal_id FK cascade, label text, is_done boolean, position int, done_at timestamptz nullable. Matches ARCHITECTURE.md. | ✓ |
| Research shape + notes field | Same as above plus nullable per-task notes. | |
| Minimal (drop position + done_at) | id, goal_id, label, is_done only. | |

**User's choice:** Research shape (Recommended)
**Notes:** Matches ARCHITECTURE.md §Data Model; minimal surface; ordering column present but manual reorder UI deferred.

---

### Q2 — Where do count-goal targets live?

| Option | Description | Selected |
|--------|-------------|----------|
| On goals.target_count + current_count | Nullable columns on goals, CHECK enforces presence when type='count'. | ✓ |
| New goal_counts child table | Pure class-table-inheritance; no nullable columns but adds a join. | |
| progress_entries table (polymorphic log) | Current count = SUM(delta); strongest audit but heavier read. | |

**User's choice:** goals.target_count + current_count (Recommended)
**Notes:** We layer a progress_entries audit/log on top (see Q3) — so we get the best of both: fast cached reads + full audit trail.

---

### Q3 — How is a goal's current progress stored?

| Option | Description | Selected |
|--------|-------------|----------|
| Cached on goals + log rows for history | goals.current_count denormalized; progress_entries rows for every delta. Enables PROG-04 and PROG-05 cleanly. | ✓ |
| Computed from log rows only | No cache; dashboard aggregates on read. | |
| Cached only, no log rows | Just goals.current_count; blocks proper PROG-04 backfill. | |

**User's choice:** Cached on goals + log rows (Recommended)
**Notes:** Transactional write pattern: insert progress_entries + update cache in same tx. Undo reverses both.

---

### Q4 — What does "pace-aware" render on the progress bar?

| Option | Description | Selected |
|--------|-------------|----------|
| Pace line on bar + status chip | Raw fill + expected-line tick + pill chip ("on pace" / "behind by N" / "ahead by N"). Applies to count + habit; checklist skips. | ✓ |
| Color-zone bar only | Bar fill shifts green/amber/red based on pace. | |
| Raw fill only, no pace | Classic bar; defers pace-aware to v1.x. | |

**User's choice:** Pace line on bar + status chip (Recommended)
**Notes:** Bar color never shifts — stays emerald regardless. Aligns with PITFALLS §1 "no red, no shame." Color-zone option was rejected because shifting to red/amber reintroduces the anxiety pattern research warns against.

---

## Goal create/edit/delete + empty state

### Q1 — Where does goal creation happen?

| Option | Description | Selected |
|--------|-------------|----------|
| Dialog on the dashboard | shadcn <Dialog> overlaying dashboard; single component handles all three types via step-2 conditional rendering. | ✓ |
| Dedicated /goals/new route | Full page; classic + deep-linkable but pulls user off dashboard. | |
| Inline expanding card | Most fluid but hard to fit variable-length task list. | |

**User's choice:** Dialog on the dashboard (Recommended)
**Notes:** Motion <AnimatePresence> handles enter/exit. Stays consistent with DASH-01 "no drill-down."

---

### Q2 — How is the type picker presented?

| Option | Description | Selected |
|--------|-------------|----------|
| Step 1 of 2 — three cards with examples | Three big cards ("Count — Read 5 books" etc.); Step 2 = type-specific fields. | ✓ |
| Type is a radio at the top of one form | All fields on one screen; show/hide per-type reactively. | |
| Type as separate entry points | Three buttons on dashboard. | |

**User's choice:** Three-card Step 1 (Recommended)
**Notes:** Matches FEATURES.md §Onboarding verbatim — three types are the product's vocabulary and deserve an explicit pick.

---

### Q3 — Edit and delete: what's the affordance per card?

| Option | Description | Selected |
|--------|-------------|----------|
| Kebab menu on card with Edit + Delete | Three-dot <DropdownMenu>; Edit reopens dialog prefilled; Delete uses <AlertDialog>. | ✓ |
| Card body clickable → edit dialog | Conflicts with tap-to-log on count/habit cards. | |
| Swipe-to-delete + tap-title-to-edit | Mobile-first gesture; non-obvious on desktop. | |

**User's choice:** Kebab menu (Recommended)
**Notes:** Keeps tap-to-log hit zones distinct from edit/delete. Type is immutable after creation (implicit decision).

---

### Q4 — What does an empty dashboard (zero goals) show?

| Option | Description | Selected |
|--------|-------------|----------|
| Headline + 3 example type cards + CTA | "It's April 2026. What do you want to commit to?" + three greyed illustrative cards + "Add your first goal" CTA. | ✓ |
| Minimal CTA only | Centered button + short subhead; no type mental model. | |
| Type picker directly on the empty state | Renders the three-type picker inline; dilutes dashboard identity. | |

**User's choice:** Headline + examples + CTA (Recommended)
**Notes:** Matches FEATURES.md §Onboarding verbatim. Example cards are illustrative only — not clickable.

---

## Dashboard cards + progress bar

### Q1 — Dashboard layout at different viewports?

| Option | Description | Selected |
|--------|-------------|----------|
| Single column always, max-width container | ~720px, centered on wider screens; mobile and desktop read identically. | ✓ |
| Responsive grid: 1/2/3 columns | More goals visible but narrower bars; habit grid cramped. | |
| Masonry | Conflicts with reorder + Motion layout animations. | |

**User's choice:** Single column (Recommended)
**Notes:** Matches DASH-01 "single scrollable list." Supports the bars-moving moment uniformly across viewports.

---

### Q2 — Progress bar chrome across the three types?

| Option | Description | Selected |
|--------|-------------|----------|
| Identical bar; type-specific info around it | Same bar component everywhere; per-type detail (stepper / tasks / grid) sits above or below. | ✓ |
| Type-specific bar shapes | Count=bar, Checklist=segmented, Habit=grid-as-bar. Breaks visual consistency. | |
| Thin bar + per-type hero visual | Big count number or grid dominates; bar secondary. Dilutes the core value prop. | |

**User's choice:** Identical bar (Recommended)
**Notes:** The bar is the consistent "draw." PROJECT.md core value is unambiguous — bars moving is the product.

---

### Q3 — Pace indicator visual when behind?

| Option | Description | Selected |
|--------|-------------|----------|
| Expected-line tick + muted amber chip, bar stays emerald | Calm; no red; no shame. | ✓ |
| Bar fill shifts color by pace | Green/amber/red based on pace; faster scan. | |
| Expected-line only, no chip | Minimalist; users compute delta mentally. | |

**User's choice:** Tick + amber chip (Recommended)
**Notes:** Rejecting color-shift preserves PITFALLS §1 "no red, no shame" policy. Chip text: "on pace" / "behind by N" / "ahead by N."

---

### Q4 — Early-month visual guard (first few days)?

| Option | Description | Selected |
|--------|-------------|----------|
| Suppress pace chip before day 5 | PITFALLS §4: day-3 bars at 7% look worse than empty. Chip hides, expected-line dims. | ✓ |
| Show "warming up" state instead | Explicit label where chip would go. | |
| No early-month treatment | Chip always on; accepts demotivation risk. | |

**User's choice:** Suppress before day 5 (Recommended)
**Notes:** Research-locked design decision; not a polish item. Tunable threshold in case day-5 needs adjustment.

---

## Logging, undo & habit month-grid

### Q1 — Count-type one-click logging shape?

| Option | Description | Selected |
|--------|-------------|----------|
| Primary +1 button + inline stepper | Big +1 for daily action; -/+ stepper for corrections. useOptimistic moves bar instantly. | ✓ |
| Single tap anywhere on card = +1 | Fastest but conflicts with kebab hit zone and per-type inner surfaces. | |
| +1 only, no stepper | Smallest surface; can't log 3 at once without 3 taps. | |

**User's choice:** +1 + stepper (Recommended)
**Notes:** Covers ~95% of taps in one click; stepper handles the exceptions in-place without a separate flow.

---

### Q2 — Undo experience for PROG-05?

| Option | Description | Selected |
|--------|-------------|----------|
| Toast with Undo action, 6-second window | shadcn <Sonner>; non-blocking; uniform across types. | ✓ |
| Persistent "Recent activity" strip | Richer but scope-creep-adjacent; adds dashboard weight. | |
| Long-press or Cmd+Z only | Power-user; not discoverable. | |

**User's choice:** Toast with Undo (Recommended)
**Notes:** Only the most-recent mutation per goal is undoable. A second mutation replaces the toast.

---

### Q3 — Habit month-grid (POLSH-03) shape?

| Option | Description | Selected |
|--------|-------------|----------|
| Calendar-layout grid, weeks as rows | 7 cols Sun–Sat × up to 6 rows; familiar, weekday rhythm visible. | ✓ |
| Linear strip (one row of 28-31 cells) | Compact but loses weekday pattern. | |
| GitHub-contributions heatmap | Dense; color-intensity unused since checkins are binary. | |

**User's choice:** Calendar-layout grid (Recommended)
**Notes:** States: hit=filled, miss=empty, today=ring outline, future=dimmed. Weekday header row above grid.

---

### Q4 — Historical missed-day check-in (PROG-04) affordance?

| Option | Description | Selected |
|--------|-------------|----------|
| Tap past habit cell; count uses stepper menu | Habit grid = tap past cell toggles. Count card kebab has "Log for earlier day" → <Popover> with date picker + stepper. Tasks N/A. | ✓ |
| Dedicated "Log for..." modal per goal | Explicit + discoverable but multi-step for a quick catch-up. | |
| Only habits support backfill | Violates REQUIREMENTS PROG-04 "any prior day within the current month." | |

**User's choice:** Tap past cell + stepper menu (Recommended)
**Notes:** Checklist is genuinely N/A — task check is stateful, not date-stamped. `done_at` captures when it was done.

---

## Claude's Discretion

- Exact Motion spring physics tuning for progress-bar width (stiffness/damping/bounce)
- Card hover/focus/active styles beyond shadcn defaults
- Task drag-reorder during goal creation (minimum = type-to-add; drag is nice-to-have)
- Exact amber + success color token values for the pace chip
- Copy voicing for empty-state headline, backfill popover, and toast messages
- Kebab icon choice (lucide-react `MoreHorizontal` vs `MoreVertical`)
- Optimistic error-toast copy/placement (Phase 4 hardens)
- File organization under `src/components/goal-card/`

## Deferred Ideas

- Month navigation, past-month read-only, future pre-planning, copy-from-last-month, new-month welcome moment (Phase 3: MNAV-*, GOAL-05)
- End-of-month reflection field (Phase 3: POLSH-04)
- 375px responsive pass + error-toast hardening (Phase 4: POLSH-01, POLSH-02)
- Card drag-to-reorder on dashboard
- Per-goal color / emoji (FEATURES anti-features)
- Editing `target_count` mid-month UX detail
- Task drag-reorder after creation
- Stacked undo (more than one action at a time)
