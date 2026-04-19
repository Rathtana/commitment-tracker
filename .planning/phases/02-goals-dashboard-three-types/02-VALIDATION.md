---
phase: 2
slug: goals-dashboard-three-types
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (to be installed in Wave 0 if not present from Phase 1) |
| **Config file** | `vitest.config.ts` (Wave 0 installs if missing) |
| **Quick run command** | `npx vitest run --changed` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --changed`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

*To be populated by gsd-planner as tasks are defined. Each row must link a task to a requirement, a test type, and an automated command — or be flagged as Manual-Only with justification.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD     | TBD  | TBD  | GOAL-01..03, PROG-01..05, DASH-01..02, POLSH-03 | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `tests/goals-schema.test.ts` — Zod ↔ Drizzle ↔ TS discriminated-union contract test (count / checklist / habit)
- [ ] `tests/progress-actions.test.ts` — Server Action unit stubs for increment / toggle / habit-mark
- [ ] `tests/progress-atomic.test.ts` — integration test proving `progress_entries` INSERT + `goals.current_count` UPDATE occur in same transaction
- [ ] `tests/pace.test.ts` — pace math edge cases (day 0, day 5 guard, mid-month goal creation, habit frequency)
- [ ] `tests/month-boundary.test.ts` — backdate allowed within current month; rejected for past/future months
- [ ] `tests/undo.test.ts` — undo reverses last progress action (reducer + server reconciliation)
- [ ] `tests/habit-grid.test.ts` — month-grid render given `progress_entries` rows; day-level hit/miss classification
- [ ] `tests/rls.test.ts` — extends Phase 1 RLS test: users cannot read/write another user's goals or progress_entries
- [ ] `tests/dashboard-render.test.ts` — dashboard renders all current-month goals with progress bar; no tabs, no drill-down
- [ ] Install shadcn components: `dialog alert-dialog dropdown-menu checkbox popover sonner` (mount `<Toaster>` once in root layout)
- [ ] Install vitest if not present from Phase 1

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Progress bar animation feels smooth (spring physics, no CLS) | POLSH-03 | Perceptual quality; CLS can be measured but "feels good" is subjective | Open dashboard, increment a count goal, observe: bar fills with spring motion, no layout shift, no jank |
| Optimistic UI latency is imperceptible | PROG-01..03 | Timing is sub-100ms; requires human perception | Increment a count, toggle a checklist item, mark habit — each should update instantly, before server round-trip |
| Habit month-grid reads at a glance without effort | DASH-01, POLSH-03 | Information density vs scanability is a design-taste judgment | Open dashboard with a habit goal mid-month; grid should clearly show hit days vs miss days without counting |
| Undo toast is discoverable but not intrusive | PROG-04 | UX quality of the toast (duration, placement, wording) | Perform a progress action; toast appears with "Undo"; disappears on its own if unused |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
