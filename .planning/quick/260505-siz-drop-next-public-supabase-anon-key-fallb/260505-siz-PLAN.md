---
phase: 260505-siz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/middleware.ts
  - src/lib/supabase/server.ts
  - .env.local
autonomous: true
requirements:
  - QUICK-260505-siz
must_haves:
  truths:
    - "Zero references to NEXT_PUBLIC_SUPABASE_ANON_KEY remain anywhere in src/"
    - "Both Supabase server clients (middleware + server actions/RSC) read PUBLISHABLE_KEY directly with no fallback chain"
    - "TypeScript compiles cleanly (npx tsc --noEmit passes)"
    - "Login flow still works locally after the change"
  artifacts:
    - path: "src/middleware.ts"
      provides: "Middleware Supabase client reading PUBLISHABLE_KEY only"
      contains: "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    - path: "src/lib/supabase/server.ts"
      provides: "Server client reading PUBLISHABLE_KEY only, with updated docstring"
      contains: "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    - path: ".env.local"
      provides: "Local env without ANON_KEY line"
  key_links:
    - from: "src/middleware.ts"
      to: "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
      via: "direct env read (no ?? fallback)"
      pattern: "supabaseKey = process\\.env\\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    - from: "src/lib/supabase/server.ts"
      to: "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
      via: "direct env read (no ?? fallback)"
      pattern: "supabaseKey = process\\.env\\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
---

<objective>
Drop the NEXT_PUBLIC_SUPABASE_ANON_KEY ?? PUBLISHABLE_KEY fallback chain in both Supabase server-client builders. After this change, PUBLISHABLE_KEY is the single source of truth — required before Vercel deploy so we ship with only 3 env vars (URL, PUBLISHABLE_KEY, DATABASE_URL).

Purpose: Remove dual-name confusion. Supabase deprecated ANON_KEY in favor of PUBLISHABLE_KEY (sb_publishable_*); keeping the fallback risks the deploy env silently using the wrong variable.

Output: Two source files reading PUBLISHABLE_KEY directly, an updated docstring in server.ts, and .env.local cleaned of the now-orphaned ANON_KEY line.
</objective>

<execution_context>
@/Users/rathtana/claude-projects/commitment-tracker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/rathtana/claude-projects/commitment-tracker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md

<interfaces>
<!-- Current state in the two source files. Executor should make ONLY the marked changes. -->

src/middleware.ts (lines 23-26 — current):
```ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
```

Target:
```ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
```

src/lib/supabase/server.ts (lines 11-21 — current):
```ts
 * Critical: uses the getAll/setAll cookie pattern (not get/set/remove),
 * which @supabase/ssr 0.10 requires for token refresh to persist.
 *
 * Reads NEXT_PUBLIC_SUPABASE_ANON_KEY (canonical in plan docs) with
 * NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as fallback — both point at the
 * same sb_publishable_* value per Plan 01-01 decision.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
```

Target:
```ts
 * Critical: uses the getAll/setAll cookie pattern (not get/set/remove),
 * which @supabase/ssr 0.10 requires for token refresh to persist.
 *
 * Reads NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — the canonical Supabase
 * publishable key (sb_publishable_*). ANON_KEY was retired in favor of
 * PUBLISHABLE_KEY upstream.
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
```

.env.local: contains a `NEXT_PUBLIC_SUPABASE_ANON_KEY=...` line. Delete just that line; leave NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_URL, DATABASE_URL, and any other vars unchanged.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Drop ANON_KEY fallback in both Supabase clients and clean .env.local</name>
  <files>src/middleware.ts, src/lib/supabase/server.ts, .env.local</files>
  <action>
Make exactly these three edits — no other changes:

1. **src/middleware.ts** — Replace the three-line `supabaseKey` assignment (lines 24-26) with a single line:
   ```ts
   const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
   ```
   Variable name (`supabaseKey`) stays the same. The `supabaseUrl` line above it is unchanged.

2. **src/lib/supabase/server.ts** — Two sub-edits in this one file:
   - Update the docstring on lines 12-14. Replace the three lines starting with " * Reads NEXT_PUBLIC_SUPABASE_ANON_KEY..." with:
     ```
      * Reads NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — the canonical Supabase
      * publishable key (sb_publishable_*). ANON_KEY was retired in favor of
      * PUBLISHABLE_KEY upstream.
     ```
   - Replace the three-line `supabaseKey` assignment (lines 19-21) with a single line:
     ```ts
     const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
     ```

3. **.env.local** — Read the file, then remove ONLY the line beginning with `NEXT_PUBLIC_SUPABASE_ANON_KEY=`. Do not touch any other line. Do not add a trailing newline change. If the line has surrounding blank lines used as section dividers, leave at most one blank line where the deleted line was so the file stays tidy.

Do NOT rename the `supabaseKey` local variable. Do NOT change `supabaseUrl`. Do NOT touch any other file. Do NOT add tests — none exist for this env var read.
  </action>
  <verify>
    <automated>npx tsc --noEmit && ! grep -rn "NEXT_PUBLIC_SUPABASE_ANON_KEY" src/</automated>
  </verify>
  <done>
- `npx tsc --noEmit` exits 0
- `grep -rn "NEXT_PUBLIC_SUPABASE_ANON_KEY" src/` returns nothing (exit 1)
- `src/middleware.ts` and `src/lib/supabase/server.ts` each contain `supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!` on a single line (no `??` fallback)
- `src/lib/supabase/server.ts` docstring no longer mentions ANON_KEY
- `.env.local` no longer contains a line starting with `NEXT_PUBLIC_SUPABASE_ANON_KEY=`; PUBLISHABLE_KEY, URL, DATABASE_URL all preserved
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Confirm login still works locally before Vercel deploy</name>
  <what-built>
Both Supabase server clients now read PUBLISHABLE_KEY directly. Local .env.local has only the canonical key. TypeScript passes and zero ANON_KEY references remain in src/.
  </what-built>
  <how-to-verify>
1. Stop any running dev server, then run `npm run dev` (fresh process so the new .env.local is read).
2. Visit http://localhost:3000/login in a browser.
3. Sign in with an existing account.
4. Confirm: redirect to dashboard succeeds, the current month's goals load, and no auth errors appear in the dev server console or browser devtools.
5. Optional: hard-refresh the dashboard once to confirm the middleware session check still works (no flash of /login redirect).

Expected outcome: login + session refresh behave identically to before the change. If anything regresses (login fails, infinite redirect, or "Invalid API key" in console), the most likely cause is a typo in the PUBLISHABLE_KEY env var — re-check `.env.local`.
  </how-to-verify>
  <resume-signal>Type "approved" once login + dashboard load cleanly, or describe what broke.</resume-signal>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` exits 0
- `grep -rn "NEXT_PUBLIC_SUPABASE_ANON_KEY" src/` returns no matches
- Login flow verified by user (Task 2 checkpoint)
</verification>

<success_criteria>
After this plan ships, deploying to Vercel requires setting exactly 3 env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`. No ANON_KEY anywhere in code, docstrings, or local env.
</success_criteria>

<output>
After completion, create `.planning/quick/260505-siz-drop-next-public-supabase-anon-key-fallb/260505-siz-01-SUMMARY.md`
</output>
