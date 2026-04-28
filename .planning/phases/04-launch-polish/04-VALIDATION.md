---
phase: 4
slug: launch-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.59.1 |
| **Config file** | `playwright.config.ts` (project root) |
| **Quick run command** | `npm run test:e2e -- --grep "phase4"` |
| **Full suite command** | `npm run test:e2e` |
| **Estimated runtime** | ~30s (phase4 only) / ~2min (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:e2e -- --grep "phase4"`
- **After every plan wave:** Run `npm run test:e2e` (full suite, includes phase3-uat.spec.ts)
- **Before `/gsd-verify-work`:** Full suite must be green + manual UAT checklist completed
- **Max feedback latency:** 30 seconds (quick run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | POLSH-01 | — | N/A | Playwright E2E | `npm run test:e2e -- --grep "375px"` | ❌ Wave 0 | ⬜ pending |
| 4-01-02 | 01 | 1 | POLSH-01 | — | N/A | Playwright E2E | `npm run test:e2e -- --grep "touch target"` | ❌ Wave 0 | ⬜ pending |
| 4-01-03 | 01 | 1 | POLSH-01 | — | N/A | Playwright E2E | `npm run test:e2e -- --grep "touch target"` | ❌ Wave 0 | ⬜ pending |
| 4-02-01 | 02 | 1 | POLSH-02 | — | toast shown on autosave failure | Playwright E2E | `npm run test:e2e -- --grep "autosave.*error"` | ❌ Wave 0 | ⬜ pending |
| 4-03-01 | 03 | 2 | POLSH-02 | T-V2 | Auth rate limiting active | Manual | Manual (Supabase dashboard check) | — | ⬜ pending |
| 4-03-02 | 03 | 2 | POLSH-02 | T-V3 | Secure+HttpOnly+SameSite=Lax cookies | Manual | DevTools inspection on live URL | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `e2e/phase4-smoke.spec.ts` — covers POLSH-01 (right cluster icons at 375px, HabitGrid cells 44px, stepper buttons 44px) and POLSH-02 (reflection autosave error toast)
- [ ] Playwright viewport config for mobile: add `page.setViewportSize({ width: 375, height: 812 })` inside phase4 tests (or add a `mobile` project to `playwright.config.ts`)

*Note: Playwright is already installed and configured — no framework install step needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cookie flags (Secure + HttpOnly + SameSite=Lax) | Phase success criterion 3 | Secure flag only appears on live HTTPS domain; Playwright localhost tests won't see it | Open live Vercel URL → DevTools → Application → Cookies → inspect `sb-*` cookies |
| Lighthouse CLS < 0.1 | Phase success criterion 3 | CLS requires full browser render + paint metrics | Chrome DevTools → Lighthouse → Performance on live Vercel URL |
| Supabase rate limiting enabled | Phase success criterion 3, D-09 | Config setting in external Supabase dashboard | Supabase dashboard → Authentication → Settings → confirm "Enable rate limiting" active |
| Smoke test on live URL | Phase success criterion 3 | Validates full production stack (Vercel + Supabase + cookies) | Login → create goal → log progress → verify session persists on page reload |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
