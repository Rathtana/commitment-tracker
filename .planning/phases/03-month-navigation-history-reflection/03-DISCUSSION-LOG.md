# Phase 3: Month Navigation, History & Reflection - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 03-month-navigation-history-reflection
**Areas discussed:** URL routing + nav + future months, Past-month read-only UX, Copy-from-last-month + Welcome moment, Reflection field UX

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| URL routing + nav + future months | URL shape, header nav, future bound, future edit permissions | ✓ |
| Past-month read-only UX | Kebab, interactive elements, empty deep-link, undo/toasts | ✓ |
| Copy-from-last-month + Welcome moment | When Welcome appears, what copies, habit days handling, Start fresh | ✓ |
| Reflection field UX | Placement, shape, editability, char limit | ✓ |

---

## URL routing + nav + future months

### What URL shape for the month?

| Option | Description | Selected |
|--------|-------------|----------|
| `/dashboard/[YYYY-MM]` (Recommended) | Canonical path segment — deep-linkable, back/forward works natively, matches ARCHITECTURE.md | ✓ |
| `/dashboard?month=YYYY-MM` | Query-param shape. Noisier URLs; RSC interacts differently with search params | |
| `/dashboard` with client-side state | No URL change; breaks deep-linking, rejected by success criterion #1 | |

**User's choice:** `/dashboard/[YYYY-MM]`

### How should the month-nav controls look at the top of the dashboard?

| Option | Description | Selected |
|--------|-------------|----------|
| `← April 2026 → + 'Today'` (Recommended) | Prev/next arrows flanking title, Today only when not on current month | ✓ |
| Month picker dropdown + arrows | Click month label to open calendar for quick jumps + arrows for ±1 | |
| Arrows only, no Today button | Minimal; harder to return from deep past-month browsing | |

**User's choice:** `← April 2026 → + 'Today'`

### How far forward can users pre-plan?

| Option | Description | Selected |
|--------|-------------|----------|
| Next month only (Recommended) | Prev unbounded, next capped at current+1. Simplest mental model | ✓ |
| Up to 3 months forward | A quarter of planning runway | |
| Unlimited forward | Maximum flexibility, no guardrails | |

**User's choice:** Next month only

### Editing future-month goals before that month starts — allowed?

| Option | Description | Selected |
|--------|-------------|----------|
| Full edit + delete, read-only on arrival (Recommended) | Future months fully mutable; past-month rules apply only after rollover | ✓ |
| Create-only, no edit/delete until month starts | Locked plans; frustrating on typos | |
| Edit yes, delete no | Awkward middle ground | |

**User's choice:** Full edit + delete, read-only on arrival

---

## Past-month read-only UX

### On a past-month goal card, what happens to the kebab menu?

| Option | Description | Selected |
|--------|-------------|----------|
| Hide kebab entirely (Recommended) | No three-dots icon at all. Cleanest "portfolio of wins" signal | ✓ |
| Show kebab, disable items | Visible but greyed with tooltips. Adds UI clutter | |
| Show kebab, offer only 'View' / 'Copy to current' | Affirmative read-only actions. Expands scope | |

**User's choice:** Hide kebab entirely

### Past-month interactive UI elements — what's their state?

| Option | Description | Selected |
|--------|-------------|----------|
| Fully frozen, non-interactive (Recommended) | No hover, no click handlers, no useOptimistic wiring | ✓ |
| Visible but disabled (aria-disabled) | Disabled-state buttons/checkboxes. Noisier visually | |
| Frozen + 'Past month — read-only' ribbon | Fully frozen plus a reinforcing banner | |

**User's choice:** Fully frozen, non-interactive

### Direct deep-link to a past month with no goals — what renders?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal 'No goals this month' + back button (Recommended) | Clean empty state; no Welcome prompt on past | ✓ |
| Welcome prompt (same as current) | Inconsistent with read-only; invites mutations | |
| 404 / redirect to current | Breaks deep-link success criterion #1 | |

**User's choice:** Minimal 'No goals this month' + back button

### Undo toasts, optimistic bar animations, Sonner — fire on past-month view?

| Option | Description | Selected |
|--------|-------------|----------|
| Never on past-month routes (Recommended) | useOptimistic + Sonner don't mount on past routes | ✓ |
| Render error toast on replay attempts | Defensive error toast if a mutation somehow fires | |

**User's choice:** Never on past-month routes

---

## Copy-from-last-month + Welcome moment

### When does the 'Welcome to [Month]' prompt appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Empty dashboard + prior month had goals (Recommended) | Triggers only when current is empty AND prior month had ≥1 goal | ✓ |
| Every first visit to a new month that's empty | Also fires on fresh future-month visits. Awkward persistence | |
| Always visible on current month until 1st progress logged | More aggressive nudging; noisy for pre-planners | |

**User's choice:** Empty dashboard + prior month had goals

### Copy-from-last-month — what fields carry over?

| Option | Description | Selected |
|--------|-------------|----------|
| Shells only: title, type, target, notes, position (Recommended) | Fresh rows; count=0, tasks uncompleted, habit check-ins skipped | ✓ |
| Shells + checklist tasks reset, habit check-ins skipped | Same outcome, different labeling | |
| Shells + notes, drop checklist sub-tasks | High friction; users re-type checklists every month | |

**User's choice:** Shells only

### Habit goal `target_days` when copied — auto-adjust?

| Option | Description | Selected |
|--------|-------------|----------|
| Carry literally, clamp to new month length (Recommended) | 20 stays 20 unless math forces clamp | ✓ |
| Scale proportionally | Introduces unexpected rounding | |
| Always reset to new month's days-in-month | Wrong for users who picked sub-daily targets | |

**User's choice:** Carry the number literally, clamp to new month length

### 'Start fresh' button behavior — dismiss permanently?

| Option | Description | Selected |
|--------|-------------|----------|
| Dismiss for this month only (Recommended) | React state only; no persistence needed | ✓ |
| Persist dismissal in DB | Stores `welcome_dismissed_months` array; requires migration | |
| Session storage only | Middle ground; survives nav, not new sessions | |

**User's choice:** Dismiss for this month only

---

## Reflection field UX

### Where does the reflection field live in the dashboard layout?

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom card, below all goals (Recommended) | Full-width card "Reflection — [Month]". Natural reading order | ✓ |
| Top banner, above goals | Interrupts "see progress bars first" flow | |
| Collapsible section (closed by default on current) | Adds click friction; hybrid option possible | |

**User's choice:** Bottom card, below all goals

### One field or two?

| Option | Description | Selected |
|--------|-------------|----------|
| Two textareas: 'What worked' / 'What didn't' (Recommended) | Matches POLSH-04 literal phrasing. Two columns on table | ✓ |
| One combined textarea | Loses structured prompt | |
| Two fields + optional third 'one word feeling' | Scope creep; not in requirements | |

**User's choice:** Two textareas: 'What worked' / 'What didn't'

### When is the reflection field editable?

| Option | Description | Selected |
|--------|-------------|----------|
| Editable on current + past months, always (Recommended) | User autonomy; reflections are retrospective, not load-bearing | ✓ |
| Read-only on past months after month ends | Prevents revisionism but stops legitimate late additions | |
| Editable only within current month | Most restrictive; frustrating | |

**User's choice:** Editable on current + past months, always

### Character limit and enforcement?

| Option | Description | Selected |
|--------|-------------|----------|
| 280 chars soft limit per field, counter visible (Recommended) | Tweet-sized; honors "two-line" spirit. Counter amber@250, red@280 | ✓ |
| Hard limit 500 chars per field | Loses "two-line" constraint | |
| Unlimited text | Rejected by POLSH-04 | |

**User's choice:** 280 chars soft limit per field, counter visible

---

## Claude's Discretion

- Exact 404 vs redirect for invalid `[month]` segment (D-03)
- Whether Welcome replaces or renders above the empty state (both acceptable)
- Copy voicing for Welcome, reflection placeholders, past-empty copy
- Animation details for month transitions (nice-to-have, not required)
- Prev/next arrow icon choice (lucide-react `ChevronLeft` / `ChevronRight` likely)
- `ReadOnlyMonthError` naming (rename of `OutOfMonthError` or sibling class)
- Debounce timing for reflection autosave (500–1000ms range)
- `compareMonth` colocation (`src/lib/time.ts` vs new `src/lib/month.ts`)
- Visual distinction between Reflection card and goal cards

---

## Deferred Ideas

- Month-picker dropdown / calendar for distant navigation
- Unlimited / 3-months-forward pre-planning
- Persistent "Start fresh" dismissal (DB flag or sessionStorage)
- Copy-goal-to-current-month action from past-month view
- Telemetry on Welcome prompt interactions
- End-of-month reflection push notification / email prompt
- Mobile 375px responsive pass (Phase 4 POLSH-01)
- Error-toast hardening for reflection autosave (Phase 4 POLSH-02)
- `ReadOnlyMonthError` HTTP response shape standardization
- Animated month transitions (Motion AnimatePresence)
- Reflection rich-text or multi-field structure (v2)
