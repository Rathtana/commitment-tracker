# Phase 4: Launch Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 04-launch-polish
**Mode:** discuss
**Areas discussed:** Mobile header layout, Habit grid touch targets, Error handling scope, Production deploy verification

---

## Mobile header layout

| Option | Description | Selected |
|--------|-------------|----------|
| Icon-only on mobile | Today → CalendarCheck, New Goal → Plus, Log out → LogOut. Labels visible md:inline. Single row stays. | ✓ |
| Stack to two rows | Two-row header on mobile — navigation on row 1, actions on row 2. More layout height. | |
| Overflow to a menu | Today + Log out collapse to a MoreHorizontal dropdown. Fewer visible taps. | |

**User's choice:** Icon-only on mobile (Recommended)
**Notes:** All icon-only buttons should have `title` attribute tooltips (in addition to `aria-label`). Following the existing chevron button pattern in MonthNavigator.

---

## Habit grid touch targets

| Option | Description | Selected |
|--------|-------------|----------|
| Larger cells everywhere | h-11 w-11 (44px) at all breakpoints. 7×44+6×4=332px < 343px available. | ✓ |
| Responsive smaller/larger | h-9 sm:h-11 — compact on mobile but doesn't meet 44px on 375px | |
| Invisible tap wrapper | Keep visual size, add padding for touch area. Complex CSS. | |

**User's choice:** Larger cells everywhere (Recommended)
**Notes:** The math confirms 44px cells fit at 375px. Unconditional — no breakpoint needed.

| Option | Description | Selected |
|--------|-------------|----------|
| Bring stepper buttons to 44px | h-11 w-11 on Minus/Plus icon buttons for consistency with +1 button. | ✓ |
| Leave as-is (40px) | 40px is close enough for a secondary control. | |

**User's choice:** Yes, bring to 44px

---

## Error handling scope

| Option | Description | Selected |
|--------|-------------|----------|
| Toast + input preserved | toast.error on reflection save failure; textarea text stays in RHF state. | ✓ |
| Inline error under textarea | Red message below field, no toast. Adds layout shift. | |
| Silent — reflection is low-stakes | Do nothing on failure; user notices on reload. | |

**User's choice:** Toast + input preserved (Recommended)
**Notes:** Toast copy: "Reflection not saved — check your connection"

| Option | Description | Selected |
|--------|-------------|----------|
| Already handled — check it | Auth forms use { ok:false, error } actions. Phase 4 audits and fixes gaps. | ✓ |
| Needs audit + toast fallback | Add explicit network error handling to ALL auth forms. | |
| Auth forms are fine as-is | Skip auth forms in Phase 4. | |

**User's choice:** Already handled — check it
**Notes:** Phase 4 does an audit pass on login, signup, reset, reset-complete. Fix gaps found; don't add complexity where coverage already exists.

---

## Production deploy verification

| Option | Description | Selected |
|--------|-------------|----------|
| Actually deploy to Vercel | Push → Vercel auto-deploy → live URL checks. Phase 4 ships. | ✓ |
| Harden code only, deploy separately | Make code production-ready; actual deploy is manual after phase. | |

**User's choice:** Actually deploy to Vercel (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Browser DevTools inspection | Application → Cookies on live URL. Document in UAT checklist. | ✓ |
| Playwright E2E cookie assertion | Automated cookie header check against deployed domain. | |
| Trust @supabase/ssr defaults | No verification — document as assumption only. | |

**User's choice:** Browser DevTools inspection (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Verify Supabase setting + document | Check Auth settings in Supabase dashboard. UAT checklist entry. No code. | ✓ |
| Add app-level rate limiting | Custom rate-limit check in password reset server action. Extra complexity. | |
| Skip — Supabase handles it | Don't add to checklist; just ship. | |

**User's choice:** Verify Supabase setting + document

---

## Claude's Discretion

- Exact lucide-react icon for "Today" button (CalendarCheck recommended, or CalendarArrowLeft)
- Tailwind breakpoint for icon → icon+label (md: is the natural default)
- CLS verification approach (Lighthouse in Chrome DevTools on live URL)
- Exact toast error wording (consistent with existing Sonner copy)
- Apply stepper button sizing choice (size="sm" with h-9 explicit, or size="default")

## Deferred Ideas

- Playwright E2E cookie assertions against deployed domain
- App-level rate limiting for password reset
- PWA / push notifications (out of scope)
- Trend charts (v2)
- Dark mode toggle (pre-existing decision: prefers-color-scheme only)
