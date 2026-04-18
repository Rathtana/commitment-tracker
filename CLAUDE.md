<!-- GSD:project-start source:PROJECT.md -->
## Project

**Commitment Tracker**

A web app for tracking monthly commitments. Users set multiple goals each month — count-based (e.g., "read 5 books"), task checklists, or habits — and watch a visual progress bar move as they log progress. Dashboard-first: open the app, see every goal at a glance, feel the pull to check something off. Public product, but shaped first around daily personal use.

**Core Value:** The visual feedback has to feel good enough that users *want* to open the dashboard — progress bars moving is the draw, everything else supports that.

### Constraints

- **Platform**: Web app only for v1 — responsive design so mobile browsers are usable, but no native apps.
- **Users**: Public product (auth required from day one), but optimize UX around a single user's daily flow before social features.
- **Scope discipline**: Three goal types are in v1 equally — resist the temptation to narrow, but also don't let scope creep add social/integrations.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## TL;DR
- **Framework:** Next.js 16.2 (App Router) + React 19.2 + TypeScript 5.9
- **Styling + UI:** Tailwind CSS v4.2 + shadcn/ui 3.5 (Radix primitives, copy-paste components)
- **Animation:** Motion 12.38 (`motion/react`) — successor to framer-motion, same API
- **Backend:** Supabase (Postgres + Auth + RLS) — no separate API server
- **ORM:** Drizzle ORM 0.45 + drizzle-kit 0.31 (for migrations and typed queries)
- **Auth:** Supabase Auth via `@supabase/ssr` 0.10 — email/password day one, OAuth later for free
- **Forms + Validation:** React Hook Form 7.72 + Zod 4.3 + `@hookform/resolvers` 5.2
- **Hosting:** Vercel (Hobby tier) — first-class Next.js 16 + Turbopack support
- **Charts (month-over-month):** Recharts 3.8 (only if v1 ships trends; progress bars don't need a chart lib)
- **Icons:** lucide-react 0.545+
## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Next.js** | 16.2.4 | React meta-framework, routing, SSR, server actions | Turbopack is the default bundler in v16 (2–5x faster builds, 5–10x faster HMR); React Compiler is stable; App Router + Server Components simplify auth-gated data fetching. The dominant choice for React apps hosted on Vercel/Netlify in 2026. |
| **React** | 19.2.5 | UI library | 19.2 brings stable `<Activity />`, `useEffectEvent`, View Transitions, and the React Compiler (auto-memoization, zero code changes). Supported natively by Next 16. |
| **TypeScript** | 5.9.3 | Static typing | Non-negotiable for a multi-shape data model (three goal types in one schema). Catches "I passed a count-goal where a checklist-goal was expected" at compile time. |
| **Tailwind CSS** | 4.2.2 | Utility-first styling | v4 Oxide engine (Rust-based) is 100x faster incremental builds, 5x faster full builds. CSS-first config via `@theme`, built-in container queries, `@starting-style` for entrance animations, 3D transforms, and `color-mix()` — all ideal for a dashboard whose core value is visual polish. |
| **shadcn/ui** | 3.5.0 (CLI) | Copy-paste component library built on Radix | You own the code — unlike installed libraries, you can restyle the progress bar to feel exactly right for your brand. Built on Radix primitives (accessibility + keyboard nav for free). Perfect match for Tailwind v4. |
| **Motion** | 12.38.0 | Animation library (ex-framer-motion) | Dashboard animations — progress bars filling, tab transitions, month transitions, list reordering. `motion/react` import path; API-identical to framer-motion v11. React 19 compatible, hardware-accelerated scroll, `layout` animations handle the "new month feels fresh" UX moment cleanly. |
| **Supabase** | Platform (server-side) | Postgres database + Auth + Row-Level Security | Replaces the need for a separate API server. RLS lets the database itself enforce "users only see their own goals" — huge security win for a solo dev. Generous free tier (500MB DB, 50K MAU, unlimited API). Open source — no vendor lock-in (can self-host Postgres later). |
| **Drizzle ORM** | 0.45.2 | Typed SQL query builder + migrations | Tiny bundle (important for Vercel's serverless cold starts), SQL-shaped (so you can actually read queries), first-class Postgres + RLS support via `crudPolicy()` helpers for Supabase. Migrations as SQL files you commit — no hidden magic. Better fit than Prisma for serverless, and scales cleanly if the "three goal shapes" schema gets complex. |
| **Supabase Auth (via `@supabase/ssr`)** | `@supabase/ssr` 0.10.2 + `@supabase/supabase-js` 2.103.3 | Email/password + OAuth + session cookies | `@supabase/ssr` is the official SSR-cookie package for App Router — handles token refresh via middleware, server-component-safe session reads. Email/password is built-in on day one; adding Google/GitHub OAuth later is a dashboard toggle + one redirect URL. No separate auth service needed. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **drizzle-kit** | 0.31.10 | Drizzle migrations CLI | Always — generates + runs migrations from schema file. |
| **postgres** | 3.4.9 | Postgres driver (postgres.js) | Drizzle's recommended Postgres driver for serverless. Use over `pg` for smaller bundle. |
| **react-hook-form** | 7.72.1 | Form state management | Any form with >2 fields (goal-creation form — type, title, target, month). Uncontrolled inputs = fewer re-renders = smoother dashboard. |
| **zod** | 4.3.0 | Schema validation | Pairs with React Hook Form for client validation AND with server actions for API input validation. Single source of truth for the "three goal shapes" discriminated union. |
| **@hookform/resolvers** | 5.2.2 | Bridge Zod ↔ React Hook Form | Always — when using the form + validation combo. |
| **lucide-react** | 0.545.0+ | Icon library | Consistent, tree-shakeable icon set shadcn/ui uses by default. Calendar, check, flame (habits), target (counts), list (tasks) all present. |
| **date-fns** | 4.1.0 | Date utilities | Month boundaries, formatting "April 2026", checking "is this month", counting days — all trivial. Tree-shakeable. Modern replacement for Moment.js. |
| **Recharts** | 3.8.1 | React charting library | Only if v1 ships the "month-over-month view" from PROJECT.md. For just the progress bars on the dashboard, **you don't need a chart lib** — plain divs + Tailwind + Motion are simpler and more customizable. |
| **clsx** + **tailwind-merge** | latest | Class name composition | Shadcn installs these via `cn()` helper. Always present. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| **Turbopack** | Dev server + bundler | Default in Next.js 16 — no config needed. Replaces Webpack. |
| **Vercel CLI** | Deploy + env var management | `vercel env pull` syncs `.env.local` from dashboard. Auto-deploy on `git push`. |
| **Supabase CLI** | Local dev + migration management | Run local Supabase stack (Postgres + Auth) via Docker; mirror migrations to staging + prod. |
| **ESLint + Prettier** | Linting + formatting | Next.js 16 ships `eslint-config-next`; add `prettier-plugin-tailwindcss` so class order auto-sorts. |
| **Vitest** | Unit tests | Lighter and faster than Jest; native ESM; works with Next.js 16 + RSC. Skip if TDD isn't in the plan for v1. |
## Installation
# 1. Scaffold Next.js 16 with TypeScript + Tailwind v4
# 2. Initialize shadcn/ui (interactive — pick "new-york" style, zinc base color)
# 3. Add the shadcn components you'll actually need for v1
# 4. Animation (Motion, not framer-motion)
# 5. Supabase + SSR cookie helper
# 6. Drizzle + Postgres driver
# 7. Forms + validation
# 8. Utilities
# 9. (Optional — only if month-over-month charts ship in v1)
# npm install recharts
# 10. (Optional — if writing tests from day one)
# npm install -D vitest @vitejs/plugin-react @testing-library/react jsdom
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Next.js 16** | Remix / React Router 7 | If you hate Vercel and want to host anywhere without the Next-on-not-Vercel friction. Not the default in 2026 — smaller ecosystem for a solo dev. |
| **Next.js 16** | SvelteKit | If "visual polish" makes you want the tiniest bundle and smoothest transitions possible and you're OK being outside the React ecosystem. Loses access to shadcn/ui + Motion-for-React. |
| **Next.js 16** | Vite + React + Express/Hono | If you want hard separation of frontend/backend. More wiring for a solo dev; loses Server Actions, RSC-level auth gating. |
| **Supabase** | Neon + Clerk + separate API | More modular. Clerk is a better pure auth experience (0.8 / `@clerk/nextjs` 7.2). Pick this if you hate all-in-one platforms or need advanced auth features (organizations, B2B SSO). Costs more and is more moving parts for a solo dev. |
| **Supabase** | PlanetScale + Lucia / Better-Auth | PlanetScale is MySQL; loses Postgres's array/JSON features that help the "three goal shapes" schema. Better-Auth (1.6.5) is a fine modern self-hosted auth lib but you still need a DB and API layer. More work. |
| **Supabase** | Firebase | Firestore is document-based — worse fit for the relational "goals belong to a month" model. Auth is fine. Use only if you specifically want realtime + offline-first and don't care about SQL. |
| **Drizzle** | Prisma 7.7 | If you prefer a higher-level DX, don't know SQL, and are shipping a traditional server (not serverless). Prisma's bundle size and cold-start cost have improved but Drizzle still wins for Vercel serverless. |
| **Drizzle** | Kysely | Also excellent, tiny, SQL-shaped. Drizzle has better Supabase-specific RLS helpers and larger community in 2026 — pick Kysely only if you've used it before and prefer it. |
| **Drizzle** | Raw SQL (no ORM) | Legitimate option for this tiny schema (`users`, `goals`, `progress_entries`). Lose type safety and migration tooling — not worth it. |
| **Motion 12** | GSAP | GSAP is more powerful for complex timeline animations. Overkill for progress bars and page transitions; larger bundle; less React-idiomatic. Use if you end up building genuinely complex sequenced animations. |
| **Motion 12** | React Spring | Physics-based animations. Less momentum in 2026; Motion now covers spring physics too. |
| **Motion 12** | CSS animations only | Fine for the progress bars themselves (CSS `transition: width` + Tailwind v4 `@starting-style` handles a lot). You'll still want Motion for list reorders and page transitions. |
| **Vercel Hobby** | Netlify Free | Netlify's free tier permits commercial use; Vercel Hobby doesn't (technically). Use Netlify if you plan to monetize and don't want to upgrade. Slightly worse Next.js 16 feature parity. |
| **Vercel Hobby** | Cloudflare Pages / Workers | Cheaper at scale, global edge. More config work for Next.js 16 (via OpenNext). Consider once you outgrow the Vercel free tier. |
| **Vercel Hobby** | Self-host on Fly.io / Railway | Full control, cheap. More ops work for a solo dev — skip for v1. |
| **shadcn/ui** | Mantine / Chakra UI v3 / Park UI | Pre-built, "just works" component libraries. You don't own the code, so restyling the progress bar exactly the way you want it is harder. Use if you want speed over polish. |
| **shadcn/ui** | Raw Radix + hand-styled Tailwind | What shadcn gives you, minus the CLI convenience. Valid if you want even more control. |
| **Recharts** | Tremor | Dashboard-specific React charts, built on Recharts. Nice if the month-over-month view becomes elaborate. Overkill for v1. |
| **Recharts** | Visx / D3 | Full custom control. Overkill until v2+. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **`framer-motion` package** | Deprecated name since mid-2025 — the project is now `motion`, imports moved to `motion/react`. No breaking API changes, but new projects should start on the new name. | `motion` (the package) + `import { motion } from "motion/react"`. |
| **Next.js Pages Router** | Legacy. App Router + RSC + Server Actions are the default in Next.js 16 and give you simpler auth gating (read `supabase.auth.getUser()` server-side). | App Router (`app/` directory). |
| **Webpack config in `next.config.js`** | Turbopack is the default in Next.js 16. Webpack-specific config breaks. | Trust the defaults. Only add `turbopack` config if you actually need to. |
| **Tailwind CSS v3** | v4 is 5–100x faster, has `@theme` CSS-first config, native container queries, `@starting-style`, and the Oxide engine. v3 is now legacy. | Tailwind v4.2 with `@tailwindcss/postcss` (or the Vite plugin). |
| **`tailwind.config.js` (JS-based config)** | v4 uses CSS-based `@theme` configuration inside your stylesheet. The JS config is a legacy compat mode. | Define tokens in `app/globals.css` under `@theme`. |
| **Supabase Auth Helpers (`@supabase/auth-helpers-nextjs`)** | Deprecated. Replaced by `@supabase/ssr`. | `@supabase/ssr` with `createBrowserClient` / `createServerClient`. |
| **Prisma for new Vercel serverless apps** | Historically larger cold starts + heavier bundle. Drizzle is purpose-built for this shape. Prisma is fine on long-running servers. | Drizzle ORM. |
| **Moment.js** | Deprecated by its own maintainers. Huge bundle. | `date-fns` (tree-shakeable) or native `Intl`. |
| **Chart.js + react-chartjs-2** | Canvas-based — harder to style with Tailwind, harder to animate cleanly with Motion. | Recharts (SVG-based, composable) — only if you need charts. |
| **MongoDB / Firestore** | Document databases are a worse fit for the month-scoped relational model. Supabase/Postgres with JSON columns for the goal-type-specific fields is cleaner. | Supabase Postgres. |
| **Passport.js / hand-rolled JWT auth** | You are a solo dev shipping a public product. Don't hand-roll auth. RLS in Postgres + Supabase Auth is battle-tested. | Supabase Auth. |
| **Redux / Zustand for server state** | Dashboard reads server data (goals, progress). RSC + Server Actions eliminate most client state. For the bit of client state you have (optimistic progress clicks), `useState` or `useOptimistic` is enough. | React state + `useOptimistic`; consider TanStack Query (5.99) only if you end up with heavy client-side data fetching. |
| **`create-react-app`** | Officially retired. | `create-next-app` or Vite. |
## Stack Patterns by Variant
- Next.js 16 + Tailwind v4 + shadcn + Supabase
- Skip Drizzle entirely — use `supabase-js` `.from('goals').select(...)` directly against auto-generated types (`supabase gen types`)
- Skip Motion — use CSS transitions on the progress bar
- Trade-off: less type safety at query boundaries, harder to refactor schema later.
- Everything in the recommended stack, plus:
- `motion/react` `<motion.div layout>` for list reorders when checking off tasks
- `motion/react` `AnimatePresence` for month-transition flourishes
- Tailwind v4 `@starting-style` for entrance animations on goal cards
- Spring-physics progress bars via `<motion.div animate={{ width: "67%" }} transition={{ type: "spring", bounce: 0.3 }} />`
- Swap Vercel → Coolify/Dokku on a VPS (still runs Next.js 16 via standalone output)
- Swap Supabase Cloud → self-hosted Supabase (all open-source)
- No code changes needed — the stack is portable.
- Supabase free tier tops out; upgrade to Pro ($25/mo) — no code changes
- Vercel Hobby → Pro ($20/mo) — no code changes
- Add `@tanstack/react-query` 5.99 for aggressive client-side caching if server load becomes a problem.
## Version Compatibility
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next.js 16.2 | React 19.2 | Next.js 16 requires React 19 — no React 18 support. |
| Next.js 16.2 | Node.js >=20.9 | Node 18 dropped. Use Node 20 LTS or 22 LTS. |
| Tailwind CSS 4.2 | Node >=20, PostCSS 8+ | Uses Lightning CSS under the hood (Oxide). No more `tailwind.config.js` required. |
| shadcn/ui 3.5 | Tailwind v4, React 19, Next 15+/16 | Run `npx shadcn@latest init` — it detects Tailwind v4 automatically. |
| Motion 12.38 | React 18.3+ or 19.x | Works with concurrent rendering. Import from `motion/react`. |
| Drizzle ORM 0.45 | Node >=18, Postgres 13+ | Use with `postgres` driver 3.4+ for serverless. Enable `fetch_types: false` option to skip startup type introspection on edge. |
| `@supabase/ssr` 0.10 | `@supabase/supabase-js` 2.x, Next.js 13+ App Router | Middleware is required; don't skip the `middleware.ts` file. |
| Zod 4.3 | React Hook Form 7.x, `@hookform/resolvers` 3.10+ | Zod 4 is a major upgrade from Zod 3 — check resolver version supports it (5.2+ does). |
| React Compiler (stable in Next 16) | React 19.2 | Enabled by default in Next.js 16. Disable per-component via `"use no memo"` if it mis-optimizes. |
## Specific Notes for This Product
- Single `goals` table with a `type` discriminator column (`"count" | "checklist" | "habit"`) and a `config` JSONB column for type-specific fields (`target`, `tasks`, `streak_goal`).
- A separate `progress_entries` table keyed by `goal_id` + `date` — each row stores a shape-agnostic `value` plus any type-specific JSON.
- Zod discriminated union mirrors the DB shape for client/server validation.
- Drizzle's typed queries make this schema much safer than raw SQL.
- `goals.month` as `DATE` (always the 1st of the month) with an index on `(user_id, month)`.
- RLS policy: `user_id = auth.uid()` — month-past read-only is enforced at the app layer (don't allow mutations where `month < CURRENT_DATE`), not at the DB.
- `date-fns` `startOfMonth`, `format(date, "MMMM yyyy")` for display.
- Shadcn `<Progress>` renders a Radix progress primitive; swap the indicator with `<motion.div>` to get spring-physics width animations.
- Use `layoutId` on goal cards for a satisfying reorder when marking something complete.
- Tailwind v4's `color-mix()` and `@starting-style` make entrance flourishes cheap.
- Next.js + Supabase + Drizzle + Tailwind + shadcn is the most-documented combo in 2026. LLMs answer it accurately, Stack Overflow is saturated, every tutorial is this stack.
- No separate backend repo. No separate auth service. No Docker compose for local dev (use Supabase CLI's built-in local stack).
- Single deploy command: `git push` → Vercel builds.
## Sources
- `npm view next version` → 16.2.4
- `npm view react version` → 19.2.5
- `npm view tailwindcss version` → 4.2.2
- `npm view motion version` → 12.38.0
- `npm view @supabase/supabase-js version` → 2.103.3
- `npm view @supabase/ssr version` → 0.10.2
- `npm view shadcn version` → 3.5.0 (matches Context7)
- `npm view typescript version` → 5.9.3
- `npm view zod version` → 4.3.0
- `npm view drizzle-orm version` → 0.45.2
- `npm view drizzle-kit version` → 0.31.10
- `npm view postgres version` → 3.4.9
- `npm view react-hook-form version` → 7.72.1
- `npm view @hookform/resolvers version` → 5.2.2
- `npm view recharts version` → 3.8.1
- `npm view lucide-react version` → 0.545.0
- `npm view date-fns version` → 4.1.0
- `/vercel/next.js` — versions include v16.2.2, v16.1.x, v15.x
- `/facebook/react` — versions include v19_2_0, v19_1_1, v18_3_1
- `/supabase/supabase` — Supabase Postgres platform
- `/supabase/auth` — Supabase Auth server
- `/websites/motion_dev` — Motion animation library (successor to Framer Motion)
- `/shadcn-ui/ui` — versions include shadcn_3.5.0, shadcn_3_2_1, shadcn@2.9.0
- [Next.js 16 release blog](https://nextjs.org/blog/next-16) — Turbopack default, React Compiler stable, React 19.2 support
- [Next.js 16.2 release blog](https://nextjs.org/blog/next-16-2) — Adapters API stable
- [Next.js v16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Supabase SSR with Next.js App Router](https://supabase.com/docs/guides/auth/server-side/nextjs) — `@supabase/ssr` is current canonical approach
- [Supabase: Creating a server-side client](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Motion React upgrade guide](https://motion.dev/docs/react-upgrade-guide) — framer-motion → motion/react migration
- [Motion changelog](https://motion.dev/changelog) — v12 is current
- [shadcn/ui Progress component](https://ui.shadcn.com/docs/components/radix/progress) — Radix-based, ARIA-compliant
- [Tailwind CSS v4 Oxide engine deep-dive (2026)](https://dev.to/dataformathub/tailwind-css-v4-deep-dive-why-the-oxide-engine-changes-everything-in-2026-2595)
- [LogRocket: dev's guide to Tailwind CSS in 2026](https://blog.logrocket.com/tailwind-css-guide/)
- [Bytebase: Drizzle vs Prisma 2026](https://www.bytebase.com/blog/drizzle-vs-prisma/)
- [Makerkit: Drizzle vs Prisma practical comparison 2026](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma)
- [Vercel vs Netlify 2026 comparison](https://tech-insider.org/vercel-vs-netlify-2026/)
- [LogRocket: Next.js 16 overview](https://blog.logrocket.com/next-js-16-whats-new/)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
