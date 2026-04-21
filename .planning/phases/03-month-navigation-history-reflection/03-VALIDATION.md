---
phase: 3
slug: month-navigation-history-reflection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x (extends Phase 1 D-23 fixture pattern) |
| **Config file** | `vitest.config.ts` (existing from Phase 1) |
| **Quick run command** | `npx vitest run --changed` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --changed`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Planner fills this table after plan creation; checker verifies coverage against phase_req_ids.*

---

## Wave 0 Requirements

- [ ] `src/lib/time.test.ts` — extend fixture suite for `compareMonth`, `formatMonthSegment`, `parseMonthSegment`
- [ ] `src/lib/schemas/reflections.test.ts` — `reflectionSchema` validation (280-char limit, trim-to-null)
- [ ] `src/lib/schemas/month-segment.test.ts` — `monthSegmentSchema` regex `/^\d{4}-\d{2}$/`
- [ ] Test fixtures for past/current/future/DST/leap boundaries

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Past-month curl/replay returns 403 on PATCH | MNAV-02 | Integration test with actual auth session; may belong in e2e later | `curl -X POST /api/actions/updateGoal with past-month goal ID → expect ReadOnlyMonthError` |
| Welcome prompt renders at real month transition (00:00 1st) | MNAV-03 | System clock behavior | Wait or fake system date; observe Welcome card renders |
| Keyboard shortcuts `←`/`→` while focus outside inputs | MNAV-01 | Browser interaction | Open dashboard, press arrows, verify URL changes |
| Motion spring-physics progress bar animates on current, static on past | POLSH-04 / D-14 | Visual correctness | Navigate past-month; observe progress bar renders at final fill without spring |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
