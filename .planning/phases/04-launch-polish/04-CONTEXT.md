# Phase 4: Launch Polish - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the product shippable: the dashboard works on a phone the way it works on a laptop (375px, 44px touch targets, thumb-reach progress logging), failed saves never silently drop user input, and the production deploy is hardened against the standard auth/cookie/CLS regressions. This phase ends with a live Vercel deploy that passes the "looks done but isn't" checklist.

**In scope:**
- Mobile-responsive pass on the full app at 375px — MonthNavigator header overflow, HabitGrid cell sizes, CountCard stepper touch targets, auth form layouts
- Error toast / inline error hardening: reflection autosave failures, auth form error coverage audit
- Production deploy to Vercel: env vars verified, cookies inspected via DevTools on live domain, Lighthouse CLS < 0.1 on live URL, Supabase rate limiting confirmed
- UAT checklist that signs off all three success criteria

**Not in scope:**
- OAuth login (v2)
- Trend/month-over-month charts (v2)
- Social features
- Any new goal types or progress logging capabilities

</domain>

<decisions>
## Implementation Decisions

### Mobile Header Layout (D-01, D-02)

- **D-01:** MonthNavigator right cluster (Today, New Goal, Log out) uses **icon-only on mobile, icon+label at `md:` breakpoint**. Mapping: Today → `CalendarCheck` icon, New Goal → `Plus` icon (already used), Log out → `LogOut` icon. The single-row header layout stays intact — no stacking to two rows, no dropdown overflow. This follows the existing ChevronLeft/ChevronRight icon pattern already in the header.
- **D-02:** All icon-only buttons in the right cluster must have `title` attributes (e.g., `title="Return to this month"`, `title="New goal"`, `title="Log out"`) for tooltip on desktop hover. Also include `aria-label` (following the existing `aria-label="Previous month"` pattern on the chevrons).

### Habit Grid Touch Targets (D-03)

- **D-03:** Increase HabitGrid cells from `h-9 w-9` (36px) to `h-11 w-11` (44px) at **all breakpoints** — not responsive-only. Rationale: 7 × 44px + 6 × 4px gap = 332px, which fits within 343px available at 375px (375 − 2×16px padding). This is the simplest approach and meets POLSH-01 uniformly. The day-label header row (`S M T W T F S`) should grow to match cell width for alignment.

### CountCard Stepper Touch Targets (D-04)

- **D-04:** Stepper icon buttons on CountCard (Minus/Plus icons, currently `size="icon"` = 40px) should be bumped to **44px height** via explicit `className="h-11 w-11"` or equivalent. The `+1` primary button is already `h-11`. The Apply button (`size="sm"` = 36px) should also be brought to `h-9` minimum or converted to `size="default"` — it only appears conditionally when `stepperValue !== 0`, so the layout impact is bounded.

### Error Handling — Reflection Autosave (D-05)

- **D-05:** Reflection autosave failures (network error during the 800ms debounced save, or `{ ok: false }` from `upsertReflectionAction`) must show a **`toast.error('Reflection not saved — check your connection')`**. The textarea text is already preserved in React state (RHF field), so input is never lost. User retrying by typing again triggers another autosave attempt naturally.

### Error Handling — Auth Forms (D-06)

- **D-06:** Auth forms (login, signup, password reset, reset-complete) need an **audit pass** in Phase 4 — do not assume they already handle all failure modes. The server actions return `{ ok: false, error }`, but check: does the form display the error clearly? Is input preserved on failure? Are there any silent-drop paths? Fix gaps found; don't add complexity where coverage already exists.

### Production Deploy — Scope (D-07)

- **D-07:** Phase 4 **actually deploys to Vercel production**. This includes: (a) push to the main branch triggering Vercel's auto-deploy, (b) verify all required env vars are set in the Vercel project dashboard (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`/`PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` if used, etc.), (c) smoke test on the live URL.

### Production Deploy — Cookie Verification (D-08)

- **D-08:** Cookie flag verification via **Browser DevTools inspection** on the live URL. Open Application → Cookies, inspect `sb-*` Supabase session cookies, confirm `Secure`, `HttpOnly`, `SameSite=Lax` flags are present. Document result in UAT checklist. No automated test added — DevTools is sufficient for a v1 ship.

### Production Deploy — Rate Limiting (D-09)

- **D-09:** Password reset rate limiting is **handled by Supabase Auth** (on by default in all Supabase projects). Phase 4 task: navigate to Supabase project → Authentication → Settings, confirm "Enable rate limiting" is active. Document in UAT checklist. No app-level code change needed.

### Claude's Discretion

- Exact lucide-react icon choice for the "Today" button (options: `CalendarArrowLeft`, `CalendarCheck`, `Home` — pick the clearest one for the context)
- Tailwind breakpoint for icon → icon+label transition (`md:` is the natural default given the 720px max-width layout)
- CLS verification: run Lighthouse on the live Vercel URL via Chrome DevTools or web.dev/measure — score must be < 0.1
- Exact wording of all new toast error messages (keep consistent with existing Sonner copy)
- Whether the Apply stepper button (visible when `stepperValue !== 0`) stays `size="sm"` with explicit `h-9` or becomes `size="default"` — planner decides based on visual balance

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope & Requirements
- `.planning/ROADMAP.md` §Phase 4 — Goal statement, success criteria, requirement mapping (POLSH-01, POLSH-02)
- `.planning/REQUIREMENTS.md` §Polish (POLSH-01, POLSH-02) — Acceptance criteria per requirement

### Stack & Architecture (unchanged — do not re-decide)
- `CLAUDE.md` §Technology Stack — Pinned versions: Next 16.2.4, React 19.2.5, Tailwind 4.2.2, shadcn 3.5, Motion 12.38, Supabase, Drizzle 0.45, lucide-react 0.545+
- `CLAUDE.md` §Specific Notes for This Product — Tailwind v4 `@theme` token hygiene (never override `--spacing-*`), dark mode via `prefers-color-scheme` only

### Phase Foundations (locked — do not re-decide)
- `.planning/phases/02-goals-dashboard-three-types/02-CONTEXT.md` — `ActionResult<T>` pattern, Sonner toast contract (`id:'progress-undo'`, 6s duration), `computeProgress`, DashboardShell architecture
- `.planning/phases/03-month-navigation-history-reflection/03-CONTEXT.md` — MonthNavigator, ReflectionCard autosave pattern (`serverValuesRef`), TZDate UTC fix, error shape conventions

### Codebase Integration Points (already in repo)
- `src/components/month-navigator.tsx` — Current MonthNavigator; Phase 4 adds responsive icon-only right cluster
- `src/components/habit-grid.tsx` — HabitGrid; Phase 4 bumps `h-9 w-9` to `h-11 w-11`
- `src/components/goal-card/count.tsx` — CountCard stepper; Phase 4 bumps icon buttons from 40px to 44px
- `src/components/reflection-card.tsx` — ReflectionCard; Phase 4 adds `toast.error` on autosave failure
- `src/app/(auth)/` — Auth pages; Phase 4 audits error handling coverage
- `src/app/(protected)/layout.tsx` — Root protected layout: `max-w-[720px] px-4` — no change needed, already single-column

### Production Verification References
- `.planning/phases/03-month-navigation-history-reflection/03-05-SUMMARY.md` — Playwright test suite in `e2e/phase3-uat.spec.ts` (20/23 passing) — Phase 4 extends or references for smoke testing
- Supabase Auth Settings (Supabase dashboard) — Confirm rate limiting enabled
- Browser DevTools Application → Cookies — Inspect `sb-*` cookie flags on live domain

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`toast` from `sonner`** — Already used throughout `dashboard-shell.tsx` for `toast.error`. Import is available; Phase 4 adds one more call site in `reflection-card.tsx`.
- **`Button` component with `title` prop** — Already used (`title={progressDisabled ? disabledTitle : undefined}` in `count.tsx`). Same pattern for right cluster icons.
- **`aria-label` pattern** — Already on ChevronLeft/Right buttons (`aria-label="Previous month"`). Same convention for Today/NewGoal/LogOut icon buttons.
- **lucide-react icons** — `Plus`, `ChevronLeft`, `ChevronRight`, `Loader2`, `MoreHorizontal`, `Target`, `Flame`, `Minus` already imported in various files. `CalendarCheck`, `LogOut` are available from the same package.
- **Playwright E2E suite** — `e2e/phase3-uat.spec.ts` exists with `e2e/auth.setup.ts`. Phase 4 can extend this for a final launch smoke test.

### Established Patterns
- **`ActionResult<T>` shape** — `{ ok: true; data: T } | { ok: false; error: string }` used everywhere. Reflection autosave failure check: `if (!result.ok) { toast.error(result.error ?? 'Reflection not saved...') }`
- **`title` attribute on disabled buttons** — Count card already uses `title={disabledTitle}` on future-month disabled buttons. Same for icon-only right cluster.
- **Sonner `toast.error()`** — Single call, no `id:` needed (error toasts don't deduplicate). Already imported in `dashboard-shell.tsx`.
- **`size="icon"`** — shadcn Button default is `h-10 w-10` (40px). To reach 44px: `className="h-11 w-11"` override or custom size. The `h-11` class is already used on the `+1` button.
- **`@supabase/ssr` cookie handling** — Middleware in `middleware.ts` refreshes sessions; `@supabase/ssr` sets `HttpOnly`, `Secure` (in production), `SameSite=Lax` by default. Verification is a DevTools check, not a code change.

### Integration Points
- **`MonthNavigator` right cluster** — The `rightCluster` prop is a `ReactNode` assembled in the RSC `[month]/page.tsx`. Phase 4 wraps each button in a responsive `<span className="hidden md:inline">` for labels, keeping the RSC assembly location unchanged.
- **`ReflectionCard`** — The `serverValuesRef` autosave pattern is in `src/components/reflection-card.tsx`. Phase 4 adds a `toast.error` call inside the `upsertReflectionAction` failure branch.
- **`HabitGrid`** — Cell size change is in `src/components/habit-grid.tsx` grid cell `className`. The day label header row uses plain `<div>` elements; their width follows the grid column, so they auto-resize with the cells.

</code_context>

<specifics>
## Specific Ideas

- "Icon alone is fine, but add title attribute tooltips" — so the Today/New Goal/Log out icons must have both `aria-label` (for screen readers) and `title` (for pointer tooltip), following the existing chevron button pattern.
- The `+1` button on CountCard is already the right size (h-11). The stepper +/− icon buttons and Apply button need to match.
- Habit grid cells growing to 44px is unconditional — the math confirms it fits at 375px. No responsive breakpoint needed.
- Deploy is real: "actually deploy to Vercel" — push to main, watch the Vercel build, smoke test on the live URL.
- Cookie verification is manual DevTools — no need for automated cookie assertions in Playwright for v1.
- Supabase rate limiting: dashboard settings check + UAT checklist entry, no code.

</specifics>

<deferred>
## Deferred Ideas

- Playwright E2E cookie flag assertions against the deployed domain — useful for regression but overkill for v1 launch
- App-level password reset rate limiting (in addition to Supabase) — Supabase default coverage is sufficient
- PWA / push notifications — explicitly out of scope (PROJECT.md)
- Trend charts / month-over-month view — v2
- Dark mode toggle — `prefers-color-scheme` only in v1 (Phase 1 decision)

</deferred>

---

*Phase: 04-launch-polish*
*Context gathered: 2026-04-27*
