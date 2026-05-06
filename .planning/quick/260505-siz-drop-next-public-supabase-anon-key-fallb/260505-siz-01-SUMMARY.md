---
phase: 260505-siz
plan: 01
subsystem: auth
tags: [supabase, env-vars, middleware, server-client, publishable-key]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Supabase Auth setup with middleware.ts and src/lib/supabase/server.ts
provides:
  - PUBLISHABLE_KEY as single Supabase key source of truth in both server-client builders
  - .env.local cleaned of orphaned ANON_KEY line
  - Vercel deploy path requiring only 3 env vars (URL + PUBLISHABLE_KEY + DATABASE_URL)
affects: [vercel-deploy, supabase-auth, middleware]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Supabase server clients read NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY directly — no ?? fallback chain"

key-files:
  created: []
  modified:
    - src/middleware.ts
    - src/lib/supabase/server.ts
    - .env.local

key-decisions:
  - "PUBLISHABLE_KEY is the canonical Supabase key name (sb_publishable_*); ANON_KEY was a legacy alias — removed entirely"
  - "No fallback chain — hard assertion (!) so a missing key fails loudly at startup rather than silently using wrong key"

patterns-established:
  - "Pattern: Supabase env var reads use NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! directly, no ?? ANON_KEY fallback"

requirements-completed:
  - QUICK-260505-siz

# Metrics
duration: 15min
completed: 2026-04-29
---

# Quick Task 260505-siz Plan 01: Drop ANON_KEY Fallback Summary

**Removed NEXT_PUBLIC_SUPABASE_ANON_KEY ?? PUBLISHABLE_KEY fallback chain from both Supabase server-client builders, making PUBLISHABLE_KEY the single source of truth and reducing Vercel deploy to 3 env vars**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-29T00:00:00Z
- **Completed:** 2026-04-29T00:15:00Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 3

## Accomplishments

- Replaced three-line `?? ANON_KEY` fallback assignment with single-line `PUBLISHABLE_KEY!` direct read in `src/middleware.ts`
- Applied identical change plus updated docstring in `src/lib/supabase/server.ts` — docstring now accurately reflects ANON_KEY retirement upstream
- Removed `NEXT_PUBLIC_SUPABASE_ANON_KEY=...` line from `.env.local`, leaving PUBLISHABLE_KEY, URL, and DATABASE_URL intact
- TypeScript compilation (`npx tsc --noEmit`) clean with zero errors
- `grep -rn "NEXT_PUBLIC_SUPABASE_ANON_KEY" src/` returns zero matches
- Authed Playwright smoke test confirmed: stored session cookie → middleware permits → `/dashboard/{currentMonth}` loads → header renders

## Task Commits

1. **Task 1: Drop ANON_KEY fallback in both Supabase clients and clean .env.local** - `0ca912f` (fix)
2. **Task 2: Human-verify checkpoint** - approved (no additional commit; worktree merged to master as `36cb23a`)

## Files Created/Modified

- `src/middleware.ts` - `supabaseKey` assignment collapsed from `?? ANON_KEY` fallback to direct `PUBLISHABLE_KEY!` read (lines 24-26 → single line)
- `src/lib/supabase/server.ts` - Same `supabaseKey` collapse plus docstring updated: removed ANON_KEY mention, added canonical PUBLISHABLE_KEY description
- `.env.local` - `NEXT_PUBLIC_SUPABASE_ANON_KEY=...` line removed; all other vars preserved

## Decisions Made

- **No ?? fallback retained:** Using hard `!` assertion instead of a fallback means a missing key throws at startup rather than silently falling through to the wrong key. Fail-loud is correct for auth credentials.
- **Docstring kept accurate:** Updated server.ts JSDoc to reflect that ANON_KEY was retired upstream and PUBLISHABLE_KEY (`sb_publishable_*`) is now canonical — prevents future confusion.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All three edits were surgical; tsc, grep, and authed smoke test all passed on the first attempt.

## User Setup Required

**Vercel deploy:** Before next deploy, remove `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Vercel environment variables dashboard (if set). Only these 3 vars are needed:
1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
3. `DATABASE_URL`

No other manual configuration required.

## Next Phase Readiness

- Vercel deploy env var configuration is now unambiguous — 3 vars only
- Any new server-client usage should follow the established pattern: read `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!` directly, no fallback
- No blockers

---
*Phase: 260505-siz*
*Completed: 2026-04-29*
