# Phase 1: Foundations & Auth - Research

**Researched:** 2026-04-17
**Domain:** Next.js 16 App Router + Supabase Auth + Drizzle ORM + @date-fns/tz timezone strategy
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Phase 1 is strict ROADMAP scope — auth + schema + timezone test suite. No user-facing goal UI.
- **D-02:** Post-login landing page is a minimal stub: `"Welcome, {email}"` + logout button + `"Goals coming in Phase 2"` placeholder text. No `/dashboard` route shell, no dynamic month routing, no empty-state card component.
- **D-03:** Phase 1 migration ships exactly two tables: `public.users` and `goals`.
- **D-04:** `tasks` and `habit_check_ins` child tables deferred to Phase 2.
- **D-05:** `goals.month` is `DATE NOT NULL` with `CHECK (EXTRACT(DAY FROM month) = 1)`.
- **D-06:** `public.users`: `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`, `timezone TEXT NOT NULL DEFAULT 'UTC'`, `created_at`/`updated_at`.
- **D-07:** `goals.user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE`.
- **D-08:** Trigger on `auth.users` INSERT auto-populates `public.users`. No direct user INSERT.
- **D-09:** Drizzle-kit generates migrations; Supabase CLI propagates them.
- **D-10:** `date-fns-tz` (now `@date-fns/tz`) for server-side timezone math. No Temporal API.
- **D-11:** `public.users.timezone` is the authoritative IANA timezone. Read per request from DB.
- **D-12:** Timezone captured at signup via `Intl.DateTimeFormat().resolvedOptions().timeZone`. Defaults to `'UTC'`.
- **D-13:** Pure isomorphic `today(now: Date, userTz: string): string` returns `'YYYY-MM-DD'`.
- **D-14:** Pure isomorphic `monthBucket(now: Date, userTz: string): Date` returns first-of-month DATE.
- **D-15:** Email/password only. OAuth deferred to v2+.
- **D-16:** Email verification required before login.
- **D-17:** Password reset: 15-minute expiry, single-use (Supabase enforced). No bespoke IP rate limiting.
- **D-18:** `@supabase/ssr` middleware template defaults: `HttpOnly` + `Secure` + `SameSite=Lax`, token refresh on each server render.
- **D-19:** Supabase built-in SMTP (`noreply@mail.app.supabase.io`). 4 emails/hour rate limit on free tier.
- **D-20:** Drizzle `pgPolicy()` (see note on `crudPolicy` below) co-located with schema definitions.
- **D-21:** `public.users` RLS: SELECT and UPDATE to `id = auth.uid()`. No user INSERT or DELETE.
- **D-22:** `goals` RLS: all four CRUD ops restricted to `user_id = auth.uid()`.
- **D-23:** Vitest fake-timer fixtures: 11:30 PM last-day-of-month at UTC-8, UTC+13, UTC+0; DST spring-forward; leap-year Feb 28/29; NYE midnight.
- **D-24:** Tests target pure `today()` and `monthBucket()` directly — no DB, no middleware.

### Claude's Discretion

- Exact shape of `middleware.ts` (follow `@supabase/ssr` official template)
- Copy, layout, visual polish of auth pages beyond "functional and clean with shadcn primitives"
- Whether auth forms use shadcn `<Form>` wrapper or plain `<form>` (must use react-hook-form + zod)
- Drizzle schema file organization (one file vs split per table)
- ESLint/Prettier specifics beyond `eslint-config-next` + `prettier-plugin-tailwindcss`
- Vitest config shape (jsdom vs node environment for which tests)
- Directory layout under `src/`

### Deferred Ideas (OUT OF SCOPE)

- Custom email provider (Resend / Postmark)
- OAuth sign-in (Google / Apple)
- Password reset IP rate limiting
- Settings page to change timezone
- Temporal API migration
- `tasks` and `habit_check_ins` child tables
- Dashboard shell / empty state / month-routed URL
- Past-month write protection at RLS
- Count-goal walking skeleton
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can sign up with email and password | Supabase Auth `signUp()` + `@supabase/ssr` cookie + React Hook Form + Zod schema. Verified pattern in Context7. |
| AUTH-02 | User receives an email verification link after signup | Supabase Auth built-in email verification; configured in Supabase dashboard. Supabase built-in SMTP. |
| AUTH-03 | User can log in and stay logged in across browser sessions | `@supabase/ssr` cookie-based sessions with `middleware.ts` token refresh on every request. Verified. |
| AUTH-04 | User can log out from any page | `supabase.auth.signOut()` Server Action callable from any route. Verified. |
| AUTH-05 | User can reset a forgotten password via an emailed link | Supabase Auth `resetPasswordForEmail()` + `updateUser()` on callback. 15-min link expiry set in Supabase dashboard. |
| GOAL-04 | Every goal is scoped to a specific month (stored as a DATE pinned to the first of that month) | `goals.month DATE NOT NULL CHECK (EXTRACT(DAY FROM month) = 1)`. Verified Postgres CHECK constraint pattern. |
</phase_requirements>

---

## Summary

Phase 1 creates a greenfield Next.js 16 + Supabase + Drizzle scaffold. There is no existing code — everything is pure creation. The three hardest problems in this phase are: (1) the `@supabase/ssr` middleware wiring that must run on every request for token refresh, (2) the Drizzle `pgPolicy` co-location pattern for Supabase RLS (note: `crudPolicy` is Neon-specific — use `pgPolicy` with `drizzle-orm/supabase` imports instead), and (3) the timezone pure-function design that must be tested thoroughly before any goal data accumulates.

The `date-fns-tz` package name in D-10 refers to the timezone extension for date-fns. Since the stack uses date-fns v4.1.0, the correct package is `@date-fns/tz` (the official v4 companion), NOT the legacy `date-fns-tz` package (which targets v2/v3 and is maintained separately by marnusw). Both packages declare `date-fns ^3.0.0 || ^4.0.0` peer dependency compatibility, but `@date-fns/tz` is the first-party v4 package. Use `@date-fns/tz` and its `TZDate` class.

The `auth.users` → `public.users` trigger is standard Supabase boilerplate — a PostgreSQL trigger function that fires on `INSERT` into `auth.users` and creates a corresponding row in `public.users`. This is a raw SQL migration fragment that Drizzle-kit cannot generate (it lives in the auth schema, which is Supabase-internal). It must be a custom SQL migration file or added via Supabase dashboard.

**Primary recommendation:** Wire `middleware.ts` first (token refresh is foundational), then schema + migration, then auth UI forms, then timezone functions with tests. The test suite for `today()` / `monthBucket()` is a first-class deliverable, not a bonus.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session cookie refresh | Frontend Server (Next.js middleware) | — | `@supabase/ssr` middleware runs on every request to keep JWT fresh |
| Auth state reads (RSC) | Frontend Server (RSC) | — | `createServerClient` reads cookies server-side; never trust client state |
| Auth mutations (signup/login/logout/reset) | Frontend Server (Server Actions) | — | Server Actions avoid exposing Supabase service key; validate server-side |
| Auth form UI | Browser (Client Component) | — | React Hook Form requires client interactivity; form state is inherently client |
| Email verification | External (Supabase Auth service) | — | Supabase sends the email; app only handles the callback redirect |
| Public users table + timezone | Database / Storage | Frontend Server | Populated by trigger; read by Server Actions per request |
| Goals schema (month CHECK constraint) | Database / Storage | — | Invariant enforced at DB layer — no app tier can bypass it |
| RLS policies | Database / Storage | Frontend Server | DB enforces; Server Actions provide defense-in-depth ownership checks |
| `today()` / `monthBucket()` | Isomorphic (lib/) | — | Pure functions; called by server (authoritative) and later client (optimistic) |
| Timezone detection at signup | Browser (Client) | — | `Intl.DateTimeFormat().resolvedOptions().timeZone` runs in browser only |
| Migration generation | Build tooling (drizzle-kit) | — | Generates SQL from TypeScript schema |
| Migration application | External (Supabase CLI) | — | `supabase db push` or `supabase migration up` propagates to env |

---

## Standard Stack

### Core (Phase 1 — all required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.4 | App Router, Server Actions, middleware | Turbopack default; RSC + Server Actions eliminate separate API server |
| React | 19.2.5 | UI | Required by Next.js 16 |
| TypeScript | 5.9.3 | Static typing | Non-negotiable for discriminated union goal schema |
| Tailwind CSS | 4.2.2 | Utility-first styling | Oxide engine; CSS-first `@theme` config; no `tailwind.config.js` |
| shadcn/ui | 3.5.0 (CLI) | Auth form primitives (Input, Button, Card, Label, Form) | Copy-paste ownership; Radix a11y; matches Tailwind v4 |
| @supabase/supabase-js | 2.103.3 | Supabase client | Core Supabase SDK |
| @supabase/ssr | 0.10.2 | Cookie-based session management for App Router | Official SSR package; `createServerClient` + `createBrowserClient` |
| drizzle-orm | 0.45.2 | Typed queries + RLS policy definitions | `pgPolicy` + `drizzle-orm/supabase` exports for auth.uid() pattern |
| drizzle-kit | 0.31.10 | Migration generation CLI | `npx drizzle-kit generate` → SQL files |
| postgres | 3.4.9 | Postgres.js driver | Drizzle recommended for serverless; smaller bundle than `pg` |
| react-hook-form | 7.72.1 | Auth form state | Uncontrolled inputs; pairs with Zod |
| zod | 4.3.0 | Schema validation | Client + Server Action validation; discriminated union ready |
| @hookform/resolvers | 5.2.2 | Zod ↔ RHF bridge | Required for Zod 4 + RHF 7 pairing |
| @date-fns/tz | 1.4.1 | Timezone-aware date math | `TZDate` class; works with date-fns v4; DST-correct |
| date-fns | 4.1.0 | Date formatting utilities | `startOfMonth`, `format`, `parseISO`; tree-shakeable |
| lucide-react | 0.545.0 | Icons | shadcn default icon set |
| Vitest | latest | Unit testing | Fake timers via `vi.useFakeTimers()`; native ESM; fast |

### Supporting (Phase 1 optional but recommended)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitejs/plugin-react | latest | Vitest React transform | Required if any test imports React components |
| jsdom | latest | Browser environment for Vitest | Not needed for pure function tests; use `environment: 'node'` for `today`/`monthBucket` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@date-fns/tz` | `date-fns-tz` (marnusw, v3.2.0) | Both support date-fns v4 peer dep; `@date-fns/tz` is first-party with `TZDate` class; prefer first-party |
| `pgPolicy` (drizzle-orm) | `crudPolicy` (drizzle-orm/neon) | `crudPolicy` is Neon-specific — do NOT use for Supabase; use `pgPolicy` with `authenticatedRole` from `drizzle-orm/supabase` |
| Supabase built-in SMTP | Resend / Postmark | Swap before public marketing push; built-in is fine for Phase 1 |

**Installation (Phase 1):**
```bash
# 1. Scaffold
npx create-next-app@16 commitment-tracker --typescript --tailwind --app --eslint --turbopack
cd commitment-tracker

# 2. shadcn/ui (pick "new-york" style, zinc base color when prompted)
npx shadcn@latest init
npx shadcn@latest add button card input label form

# 3. Supabase
npm install @supabase/supabase-js @supabase/ssr

# 4. Drizzle
npm install drizzle-orm postgres
npm install -D drizzle-kit

# 5. Forms + validation
npm install react-hook-form zod @hookform/resolvers

# 6. Timezone + dates
npm install @date-fns/tz date-fns

# 7. Icons
npm install lucide-react

# 8. Tests
npm install -D vitest @vitejs/plugin-react jsdom
```

---

## Architecture Patterns

### System Architecture Diagram (Phase 1 scope)

```
[Browser]
  │  signup form (RHF + Zod) → reads Intl.DateTimeFormat().resolvedOptions().timeZone
  │  login form (RHF + Zod)
  │  password reset form (RHF + Zod)
  │  logout button → calls Server Action
  ▼
[Next.js Middleware: middleware.ts]
  │  createServerClient → supabase.auth.getUser()
  │  Refreshes token cookie on every request (CRITICAL — must run first)
  │  Redirects /dashboard → /login if unauthenticated
  ▼
[Next.js App Router (app/)]
  │
  ├─ (auth)/login/page.tsx       → LoginForm (Client Component)
  ├─ (auth)/signup/page.tsx      → SignUpForm (Client Component)
  ├─ (auth)/reset/page.tsx       → ResetPasswordForm (Client Component)
  ├─ (auth)/verify/page.tsx      → VerificationGate (Server Component)
  └─ (protected)/landing/page.tsx → "Welcome {email}" stub (Server Component)
  ▼
[Server Actions: src/server/actions/auth.ts]
  │  signUp(email, password, timezone) → supabase.auth.signUp()
  │  signIn(email, password)           → supabase.auth.signInWithPassword()
  │  signOut()                         → supabase.auth.signOut()
  │  requestPasswordReset(email)       → supabase.auth.resetPasswordForEmail()
  │  updatePassword(newPassword)       → supabase.auth.updateUser()
  ▼
[Supabase Auth Service]
  │  Sends verification email (built-in SMTP)
  │  Sends password reset email (15-min link)
  │  JWT in HttpOnly cookie (managed by @supabase/ssr)
  ▼
[Postgres: Supabase]
  │
  ├─ auth.users (Supabase-managed)
  │    └─ INSERT trigger → public.users (auto-populate)
  ├─ public.users (id, timezone, created_at, updated_at)
  │    └─ RLS: SELECT/UPDATE where id = auth.uid()
  └─ public.goals (id, user_id, month, title, type, ...)
       └─ RLS: ALL ops where user_id = auth.uid()
       └─ CHECK (EXTRACT(DAY FROM month) = 1)

[Isomorphic lib/]
  └─ time.ts: today(now, userTz) → 'YYYY-MM-DD'
              monthBucket(now, userTz) → Date (first of month)

[Tests: src/__tests__/ or tests/]
  └─ time.test.ts: Vitest fake timers, D-23 fixtures
```

### Recommended Project Structure

```
commitment-tracker/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   ├── reset-password/page.tsx
│   │   │   ├── update-password/page.tsx   # callback after reset link
│   │   │   ├── verify-email/page.tsx      # post-signup gate
│   │   │   └── layout.tsx                 # auth layout (centered card)
│   │   ├── (protected)/
│   │   │   ├── landing/page.tsx           # "Welcome, {email}" stub
│   │   │   └── layout.tsx                 # checks auth server-side
│   │   ├── auth/callback/route.ts         # Supabase OAuth/email callback handler
│   │   ├── layout.tsx                     # root layout
│   │   └── globals.css                    # Tailwind v4 @theme + base
│   ├── components/
│   │   ├── auth/
│   │   │   ├── login-form.tsx             # 'use client', RHF + Zod
│   │   │   ├── signup-form.tsx            # 'use client', RHF + Zod
│   │   │   ├── reset-password-form.tsx    # 'use client', RHF + Zod
│   │   │   └── update-password-form.tsx   # 'use client', RHF + Zod
│   │   └── ui/                            # shadcn copy-paste components
│   ├── server/
│   │   ├── actions/
│   │   │   └── auth.ts                    # 'use server' auth actions
│   │   └── db/
│   │       ├── schema.ts                  # Drizzle schema (users + goals + RLS policies)
│   │       ├── index.ts                   # drizzle() instance via postgres driver
│   │       └── migrations/               # drizzle-kit generated SQL files
│   ├── lib/
│   │   └── time.ts                        # today() + monthBucket() pure functions
│   └── middleware.ts                      # @supabase/ssr token refresh (ROOT of src)
├── tests/
│   └── time.test.ts                       # Vitest D-23 fixture suite
├── drizzle.config.ts
├── vitest.config.ts
├── .env.local                             # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL
└── next.config.ts
```

**Note:** `middleware.ts` must be at `src/middleware.ts` (or project root if not using `src/`) — Next.js only picks up the middleware from these exact locations.

### Pattern 1: middleware.ts Shape

**What:** `@supabase/ssr` middleware that refreshes the session token on every request and redirects unauthenticated users away from protected routes.

**When to use:** Always — it must run on EVERY request for the token refresh to work. Skipping this breaks RSC session reads.

```typescript
// src/middleware.ts
// Source: Context7 /supabase/ssr — verified 2026-04-17
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () =>
          request.cookies.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // CRITICAL: getUser() refreshes the session if expired.
  // Must be called in middleware for RSC session reads to work.
  const { data: { user } } = await supabase.auth.getUser()

  // Protect the landing/dashboard stub
  if (!user && request.nextUrl.pathname.startsWith('/(protected)')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect logged-in users away from auth pages
  if (user && request.nextUrl.pathname.startsWith('/(auth)')) {
    return NextResponse.redirect(new URL('/landing', request.url))
  }

  return response
}

export const config = {
  matcher: [
    // Match all routes except _next static files, api routes, and public assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Pattern 2: Drizzle Schema with Supabase RLS Policies

**What:** Drizzle `pgTable` with `pgPolicy` from `drizzle-orm/pg-core` and predefined Supabase roles from `drizzle-orm/supabase`.

**Critical finding:** `crudPolicy` is from `drizzle-orm/neon` and is Neon-specific. For Supabase, use `pgPolicy` with `authenticatedRole` and `authUid` from `drizzle-orm/supabase`.

```typescript
// src/server/db/schema.ts
// Source: Context7 /drizzle-team/drizzle-orm-docs — verified 2026-04-17
import { pgTable, uuid, text, timestamp, date, pgEnum, pgSchema } from 'drizzle-orm/pg-core'
import { pgPolicy } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase'
import { foreignKey } from 'drizzle-orm/pg-core'

// --- public.users ---
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().notNull(),
    timezone: text('timezone').notNull().default('UTC'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [authUsers.id],
      name: 'users_id_fk',
    }).onDelete('cascade'),
    pgPolicy('users-select-own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`id = auth.uid()`,
    }),
    pgPolicy('users-update-own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`id = auth.uid()`,
      withCheck: sql`id = auth.uid()`,
    }),
  ]
)

// --- goals ---
export const goalTypeEnum = pgEnum('goal_type', ['count', 'checklist', 'habit'])

export const goals = pgTable(
  'goals',
  {
    id: uuid('id').primaryKey().defaultRandom().notNull(),
    userId: uuid('user_id').notNull(),
    month: date('month').notNull(), // CHECK enforced via custom SQL in migration
    title: text('title').notNull(),
    type: goalTypeEnum('type').notNull(),
    position: text('position').notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: 'goals_user_id_fk',
    }).onDelete('cascade'),
    pgPolicy('goals-select-own', {
      for: 'select',
      to: authenticatedRole,
      using: sql`user_id = auth.uid()`,
    }),
    pgPolicy('goals-insert-own', {
      for: 'insert',
      to: authenticatedRole,
      withCheck: sql`user_id = auth.uid()`,
    }),
    pgPolicy('goals-update-own', {
      for: 'update',
      to: authenticatedRole,
      using: sql`user_id = auth.uid()`,
      withCheck: sql`user_id = auth.uid()`,
    }),
    pgPolicy('goals-delete-own', {
      for: 'delete',
      to: authenticatedRole,
      using: sql`user_id = auth.uid()`,
    }),
  ]
)
```

**Important:** The `CHECK (EXTRACT(DAY FROM month) = 1)` constraint cannot be expressed in Drizzle schema today (Drizzle does not support arbitrary table-level CHECK constraints in pgTable). Add it as a custom SQL statement in a `drizzle-kit` custom migration or a separate SQL fragment. The `drizzle-kit generate` command generates the base DDL; the CHECK must be added via `drizzle-kit generate --custom` or by manually editing the generated SQL file.

### Pattern 3: Timezone Pure Functions with @date-fns/tz

**What:** `today()` and `monthBucket()` using `TZDate` from `@date-fns/tz` to produce timezone-correct results.

```typescript
// src/lib/time.ts
// Source: Context7 /date-fns/tz — verified 2026-04-17
import { TZDate } from '@date-fns/tz'
import { startOfMonth, format } from 'date-fns'

/**
 * Returns the user's local date as 'YYYY-MM-DD'.
 * @param now   - A UTC Date (e.g., new Date() on the server)
 * @param userTz - IANA timezone string from public.users.timezone
 */
export function today(now: Date, userTz: string): string {
  const local = new TZDate(now.getTime(), userTz)
  return format(local, 'yyyy-MM-dd')
}

/**
 * Returns a Date representing the first day of the user's local month.
 * Used for goals.month writes and "current month" queries.
 * @param now    - A UTC Date
 * @param userTz - IANA timezone string
 */
export function monthBucket(now: Date, userTz: string): Date {
  const local = new TZDate(now.getTime(), userTz)
  const first = startOfMonth(local)
  // Return a plain Date at midnight UTC of the first-of-month local date
  // so Postgres DATE column receives the correct first-of-month value
  return new Date(format(first, 'yyyy-MM-dd') + 'T00:00:00.000Z')
}
```

**DST safety:** `TZDate` performs date arithmetic in the specified timezone, not the system timezone. DST transitions (e.g., 2:30 AM on spring-forward day) are handled correctly by the underlying Intl API.

### Pattern 4: auth.users → public.users Trigger

**What:** PostgreSQL trigger that fires on `auth.users` INSERT and creates a corresponding `public.users` row. This cannot be expressed in Drizzle schema (auth schema is Supabase-internal) — it requires a raw SQL migration.

```sql
-- Add this as a custom SQL fragment in the migration file
-- (or via Supabase dashboard SQL editor)
-- Source: Standard Supabase managing-user-data pattern [ASSUMED from training — Supabase docs inaccessible via WebFetch]

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, timezone)
  VALUES (NEW.id, 'UTC');  -- timezone updated by signup Server Action after auth
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

**Note:** The trigger inserts with `timezone = 'UTC'` as default. The signup Server Action, after calling `supabase.auth.signUp()`, updates `public.users.timezone` with the client-detected IANA timezone. This is a two-step write: trigger creates the row, then Server Action patches it.

**Alternative:** Pass the timezone to `signUp()` via `data` metadata and have the trigger read `NEW.raw_user_meta_data->>'timezone'`. This is cleaner but couples the trigger to client metadata shape. The two-step write is simpler to reason about for Phase 1.

### Pattern 5: React Hook Form + Zod + Server Actions Wiring

**What:** Auth forms use `useForm` + `zodResolver` for client-side validation, then call a Server Action on `handleSubmit`. Server Action re-validates with the same Zod schema before calling Supabase.

```typescript
// src/components/auth/login-form.tsx
// Source: Context7 /react-hook-form/react-hook-form — verified 2026-04-17
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signInAction } from '@/server/actions/auth'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

export function LoginForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginFormData) {
    const result = await signInAction(data)
    if (result?.error) {
      setError('root', { message: result.error })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} type="email" placeholder="Email" />
      {errors.email && <p>{errors.email.message}</p>}
      <input {...register('password')} type="password" placeholder="Password" />
      {errors.password && <p>{errors.password.message}</p>}
      {errors.root && <p>{errors.root.message}</p>}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}
```

**shadcn `<Form>` wrapper vs plain `<form>`:** Use the shadcn `<Form>` wrapper (which wraps `FormProvider` + RHF context) for consistent field/error styling via `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormMessage>`. This is the recommended approach — it integrates with shadcn `Input` and `Button` components cleanly and handles ARIA attributes. Both are valid per Claude's Discretion; shadcn `<Form>` is recommended for consistency.

### Anti-Patterns to Avoid

- **Using `supabase.auth.getSession()` in Server Components or middleware:** Returns the session from cookie without verifying the JWT signature server-side. Use `supabase.auth.getUser()` instead — it validates the JWT against Supabase's server. `getSession()` is only safe in client components where you need the session data without a server call.
- **Skipping `middleware.ts`:** Without the middleware calling `getUser()`, the session cookie is never refreshed, and server components will see expired sessions after ~1 hour.
- **Importing `crudPolicy` from `drizzle-orm/neon` for Supabase:** `crudPolicy` is Neon-specific and uses Neon's `auth.user_id()` function. Supabase uses `auth.uid()`. Use `pgPolicy` with `drizzle-orm/supabase`'s `authenticatedRole`.
- **Using `date-fns-tz` (legacy package) instead of `@date-fns/tz`:** Both declare v4 peer compat but `@date-fns/tz` is the first-party v4 package with the `TZDate` class API. The legacy package's `formatInTimeZone` / `utcToZonedTime` API is different.
- **Storing the first-of-month CHECK constraint only in Drizzle schema:** Drizzle 0.45 does not support arbitrary table-level CHECK constraints via `pgTable`. The CHECK must be added to the generated SQL migration manually or via `--custom` migration.
- **Calling Supabase auth methods directly in RSC:** Auth mutations must be in Server Actions (`'use server'`) to properly handle cookie writes. RSC can only read cookies via `createServerClient`, not write them.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session cookie management | Custom JWT cookie logic | `@supabase/ssr` middleware template | Token refresh, HttpOnly, SameSite all handled; subtle bugs in hand-rolled JWTs |
| Email verification flow | Custom token generation + email | Supabase Auth built-in | Cryptographic token generation, expiry, single-use — all handled |
| Password reset tokens | Custom crypto.randomBytes + DB table | Supabase Auth `resetPasswordForEmail()` | 15-min expiry, single-use, invalidation on password change — all free |
| Form validation | Custom validators | Zod + `@hookform/resolvers` | Edge cases in email/password validation multiply; discriminated unions for goal types later |
| Timezone offset math | `new Date().getTimezoneOffset()` | `@date-fns/tz` `TZDate` | DST transitions, ghost hours (2:30 AM spring-forward), doubled hours (fall-back) — all handled |
| First-of-month calculation | `setDate(1)` on a JS Date | `startOfMonth` from `date-fns` | `setDate(1)` in local time + UTC conversion produces wrong results near month boundaries |
| Migration state tracking | Custom migration table | `drizzle-kit` + Supabase CLI | Ordering, checksums, applied-migration tracking — do not reinvent |

**Key insight:** In this phase, every "hand-rolled" alternative introduces a class of bugs that Supabase, drizzle-kit, and @date-fns/tz already solve. The test suite for `today()`/`monthBucket()` is the one place where custom code is unavoidable — and that's precisely why the D-23 fixtures are a first-class deliverable.

---

## Common Pitfalls

### Pitfall 1: `middleware.ts` Not Refreshing Tokens (CRITICAL)

**What goes wrong:** RSC reads stale/expired user after ~1 hour. Dashboard shows logged-out state. Auth state flickers on every page load.

**Why it happens:** The session cookie is an access token with a ~1-hour expiry. Without `middleware.ts` calling `supabase.auth.getUser()` on every request, the token is never refreshed. The middleware must write the refreshed cookie back to the response, not just the request.

**How to avoid:** Use the `getAll`/`setAll` cookie pattern (not the deprecated `get`/`set`/`remove` pattern). The `response.cookies.set(...)` call in `setAll` is what writes the refreshed cookie. If only `request.cookies` are used, refreshed tokens are silently dropped.

**Warning signs:** Users report being logged out after an hour. `supabase.auth.getUser()` in an RSC returns `null` despite an active session.

### Pitfall 2: Using `getSession()` Instead of `getUser()` Server-Side

**What goes wrong:** A tampered or replayed cookie appears valid. Session appears active but is for a deleted user. Security vulnerability.

**Why it happens:** `getSession()` only reads from the cookie without server-side JWT validation. `getUser()` makes a server-side call to Supabase to verify the JWT.

**How to avoid:** Always use `supabase.auth.getUser()` in middleware and Server Actions. Use `getSession()` only on the client (browser) where the JWT is already trusted.

### Pitfall 3: Drizzle CHECK Constraint Not in Migration SQL

**What goes wrong:** `goals.month` CHECK constraint is missing from the database. App code can insert non-first-of-month dates. Phase 2 writes corrupt data.

**Why it happens:** Drizzle 0.45 `pgTable` does not support arbitrary table-level CHECK constraints. The `drizzle-kit generate` output will not include the `CHECK (EXTRACT(DAY FROM month) = 1)` constraint.

**How to avoid:** After `npx drizzle-kit generate`, manually edit the generated migration SQL to add:
```sql
ALTER TABLE goals ADD CONSTRAINT month_is_first_of_month
  CHECK (EXTRACT(DAY FROM month) = 1);
```
Or use `npx drizzle-kit generate --custom` to create a custom migration file that contains this SQL alongside the Drizzle-generated DDL.

**Verification:** After `supabase db push`, run:
```sql
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'month_is_first_of_month';
```
Must return the CHECK expression.

### Pitfall 4: drizzle-kit Output Directory vs Supabase CLI Migration Path

**What goes wrong:** Drizzle generates migrations to `./drizzle/` but Supabase CLI expects migrations in `./supabase/migrations/`. Running `supabase db push` doesn't pick up the generated files.

**Why it happens:** Default `drizzle.config.ts` `out` path is `./drizzle/`. Supabase CLI's `supabase db push` reads from `./supabase/migrations/`.

**How to avoid:** Set `out: './supabase/migrations'` in `drizzle.config.ts`. This is the recommended pattern for Supabase projects (confirmed in Context7 /drizzle-team/drizzle-orm-docs Supabase tutorial).

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'
export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './supabase/migrations',   // matches Supabase CLI expectations
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

**Migration apply commands:**
```bash
# Local dev (requires Supabase CLI + Docker)
supabase start                    # starts local Postgres + Auth
npx drizzle-kit generate          # generates SQL in supabase/migrations/
supabase db push                  # applies migrations to local

# Staging/prod
supabase db push --linked         # applies to linked Supabase project
```

### Pitfall 5: auth.users Trigger INSERT Race Condition

**What goes wrong:** `signUp()` returns success, but the subsequent Server Action that patches `public.users.timezone` fails with "row not found" because the trigger hasn't committed yet.

**Why it happens:** The `auth.users` INSERT and the trigger fire in the same transaction in Supabase (Postgres). The `signUp()` call is asynchronous — the response returns after the trigger commits, so by the time the Server Action runs, the `public.users` row exists. In practice this is not a race, but if the Server Action runs before the `signUp()` awaited promise resolves (e.g., due to a fire-and-forget pattern), the row won't exist yet.

**How to avoid:** Always `await supabase.auth.signUp()` before attempting to `UPDATE public.users`. The correct flow is:
1. `await supabase.auth.signUp({ email, password })` — creates `auth.users` row, trigger fires, `public.users` row is created
2. `await supabase.from('users').update({ timezone }).eq('id', user.id)` — row guaranteed to exist

### Pitfall 6: @date-fns/tz `TZDate` Constructor vs Static `TZDate.tz()` Method

**What goes wrong:** `new TZDate('Asia/Singapore')` produces an Invalid Date — the constructor interprets the timezone string as a date string.

**Why it happens:** The `TZDate` constructor signature mirrors the native `Date` constructor. Passing a timezone string as the first argument when no date components follow is ambiguous — it's interpreted as a date string.

**How to avoid:** Use `TZDate.tz('Asia/Singapore')` (static method) to create a "now" in a timezone. Use `new TZDate(timestamp, 'Asia/Singapore')` to create from a known timestamp.

```typescript
// WRONG
const d = new TZDate('America/New_York')  // Invalid Date

// CORRECT — current time in New York
const d = TZDate.tz('America/New_York')

// CORRECT — from a timestamp (what today() and monthBucket() use)
const d = new TZDate(now.getTime(), userTz)
```

### Pitfall 7: Supabase Auth Callback Route Missing

**What goes wrong:** After clicking the email verification link or password reset link, the user lands on a 404. Email verification never completes. Password reset flow is broken.

**Why it happens:** Supabase sends users to `<app-url>/auth/callback?code=...`. Without a route handler at `app/auth/callback/route.ts`, Next.js 404s. The code exchange (PKCE) that exchanges the one-time code for a session must happen server-side.

**How to avoid:** Create `src/app/auth/callback/route.ts`:
```typescript
// Source: @supabase/ssr official pattern [ASSUMED — training knowledge, not verified from docs URL this session]
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/landing'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`)
}
```

---

## Code Examples

### Vitest Config for Timezone Tests

```typescript
// vitest.config.ts
// Source: Context7 /vitest-dev/vitest — verified 2026-04-17
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',          // pure functions — no DOM needed
    globals: true,
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['src/lib/**/*.ts'],
    },
  },
})
```

### D-23 Vitest Fixture Suite (Timezone Tests)

```typescript
// tests/time.test.ts
// Source: test design from D-23 decisions; TZDate API from Context7 /date-fns/tz
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { today, monthBucket } from '../src/lib/time'

describe('today()', () => {
  afterEach(() => vi.useRealTimers())

  it('UTC-8: 11:30 PM on March 31 → March 31', () => {
    // 2026-04-01 07:30 UTC = 2026-03-31 23:30 America/Los_Angeles
    const now = new Date('2026-04-01T07:30:00.000Z')
    expect(today(now, 'America/Los_Angeles')).toBe('2026-03-31')
  })

  it('UTC+13: 11:30 PM on March 31 → March 31', () => {
    // 2026-03-31 10:30 UTC = 2026-03-31 23:30 Pacific/Auckland
    const now = new Date('2026-03-31T10:30:00.000Z')
    expect(today(now, 'Pacific/Auckland')).toBe('2026-03-31')
  })

  it('UTC: 11:30 PM on March 31 → March 31', () => {
    const now = new Date('2026-03-31T23:30:00.000Z')
    expect(today(now, 'UTC')).toBe('2026-03-31')
  })

  it('DST spring-forward: 11:30 PM on March 8 2026 in America/New_York', () => {
    // March 8 2026 = spring forward day in US Eastern
    // 2026-03-09 04:30 UTC = 2026-03-08 23:30 EST (UTC-5, pre-spring-forward)
    const now = new Date('2026-03-09T04:30:00.000Z')
    expect(today(now, 'America/New_York')).toBe('2026-03-08')
  })

  it('Leap year: 11:30 PM on Feb 28 in UTC → Feb 28', () => {
    const now = new Date('2028-02-28T23:30:00.000Z') // 2028 is a leap year
    expect(today(now, 'UTC')).toBe('2028-02-28')
  })

  it('Leap year: 11:30 PM on Feb 29 in UTC → Feb 29', () => {
    const now = new Date('2028-02-29T23:30:00.000Z')
    expect(today(now, 'UTC')).toBe('2028-02-29')
  })

  it('NYE midnight: 12:00 AM Jan 1 in UTC → Jan 1', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    expect(today(now, 'UTC')).toBe('2026-01-01')
  })
})

describe('monthBucket()', () => {
  it('UTC-8: 11:30 PM March 31 → March 1 (not April 1)', () => {
    const now = new Date('2026-04-01T07:30:00.000Z')
    const bucket = monthBucket(now, 'America/Los_Angeles')
    expect(bucket.toISOString().slice(0, 10)).toBe('2026-03-01')
  })

  it('UTC+13: 11:30 PM March 31 → March 1', () => {
    const now = new Date('2026-03-31T10:30:00.000Z')
    const bucket = monthBucket(now, 'Pacific/Auckland')
    expect(bucket.toISOString().slice(0, 10)).toBe('2026-03-01')
  })

  it('Returns a Date where EXTRACT(DAY) = 1', () => {
    const now = new Date('2026-04-15T12:00:00.000Z')
    const bucket = monthBucket(now, 'UTC')
    expect(bucket.getUTCDate()).toBe(1)
  })

  it('Leap year Feb: returns Feb 1', () => {
    const now = new Date('2028-02-29T12:00:00.000Z')
    const bucket = monthBucket(now, 'UTC')
    expect(bucket.toISOString().slice(0, 10)).toBe('2028-02-01')
  })
})
```

### drizzle.config.ts

```typescript
// drizzle.config.ts
// Source: Context7 /drizzle-team/drizzle-orm-docs Supabase tutorial — verified 2026-04-17
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

### Drizzle DB Instance (postgres.js driver)

```typescript
// src/server/db/index.ts
// Source: Context7 /drizzle-team/drizzle-orm-docs — verified 2026-04-17
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL!

// Disable prefetch for Supabase pooler mode (Transaction mode = no PREPARE)
const client = postgres(connectionString, { prepare: false })

export const db = drizzle(client, { schema })
```

**Note:** Supabase's connection pooler uses Transaction mode by default. Setting `prepare: false` prevents "PREPARE not supported" errors.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` 0.10 with `createServerClient` | Mid-2024 | `get/set/remove` cookie API deprecated; use `getAll/setAll` |
| `crudPolicy` from `drizzle-orm/neon` | `pgPolicy` from `drizzle-orm/pg-core` with `authenticatedRole` from `drizzle-orm/supabase` | Drizzle 0.30+ | `crudPolicy` is Neon-specific; Supabase uses different auth functions |
| `date-fns-tz` (marnusw package) | `@date-fns/tz` (first-party) with `TZDate` | date-fns v4 release | Different API: `TZDate` class replaces `formatInTimeZone`/`utcToZonedTime` |
| `tailwind.config.js` | `@theme` in `globals.css` | Tailwind v4 | JS config is legacy compat mode; CSS-first is the default |
| `drizzle-kit push` (direct DB push) | `drizzle-kit generate` → Supabase CLI push | Best practice for Supabase | Direct push bypasses Supabase CLI migration tracking |

**Deprecated/outdated:**
- `supabase.auth.getSession()` server-side: Use `getUser()` for server-side JWT validation
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr`
- `cookie.get/set/remove` in `@supabase/ssr`: Use `getAll/setAll` (current API)
- `pgTable.enableRLS()` in Drizzle: Use `pgTable.withRLS()` (since v1.0.0-beta.1)

---

## Files and Directories at End of Phase 1

```
commitment-tracker/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   ├── reset-password/page.tsx
│   │   │   ├── update-password/page.tsx
│   │   │   ├── verify-email/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (protected)/
│   │   │   ├── landing/page.tsx           # "Welcome, {email}" + logout + placeholder
│   │   │   └── layout.tsx
│   │   ├── auth/
│   │   │   └── callback/route.ts          # PKCE code exchange handler
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── auth/
│   │   │   ├── login-form.tsx
│   │   │   ├── signup-form.tsx
│   │   │   ├── reset-password-form.tsx
│   │   │   └── update-password-form.tsx
│   │   └── ui/                            # shadcn components (button, card, input, label, form)
│   ├── server/
│   │   ├── actions/
│   │   │   └── auth.ts                    # signUp, signIn, signOut, resetPassword, updatePassword
│   │   └── db/
│   │       ├── schema.ts                  # users table + goals table + pgPolicy
│   │       ├── index.ts                   # drizzle() instance
│   │       └── migrations/               # symlink/same path: supabase/migrations/ (via drizzle.config.ts out)
│   ├── lib/
│   │   └── time.ts                        # today() + monthBucket()
│   └── middleware.ts
├── supabase/
│   └── migrations/
│       ├── 0000_initial_schema.sql        # drizzle-kit generated DDL
│       └── 0001_custom_constraints.sql    # CHECK constraint + trigger SQL (manual/custom)
├── tests/
│   └── time.test.ts                       # D-23 Vitest fixture suite
├── drizzle.config.ts
├── vitest.config.ts
├── .env.local                             # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `auth.users` INSERT trigger body uses `NEW.id` to populate `public.users.id` | Pattern 4: auth trigger | Standard Supabase pattern — low risk; easily verified in Supabase dashboard SQL editor |
| A2 | `auth/callback/route.ts` handles both email verification AND password reset code exchange via `exchangeCodeForSession()` | Pitfall 7 | If Supabase uses different callback paths for email-verify vs password-reset, separate route handlers may be needed |
| A3 | `supabase db push` applies migrations from `./supabase/migrations/` in filename order | Pitfall 4 | Standard Supabase CLI behavior — verified in drizzle-supabase tutorial |
| A4 | `pgTable.withRLS()` (vs `enableRLS()`) is the correct API for Drizzle 0.45 | Schema pattern | The RLS docs note `enableRLS()` deprecated in v1.0.0-beta.1; 0.45 is pre-1.0 — confirm which method applies at 0.45 |
| A5 | Next.js 16 App Router middleware runs before RSC rendering when file is at `src/middleware.ts` | Middleware pattern | Standard Next.js behavior since v13; highly stable |

---

## Open Questions

1. **`pgTable.enableRLS()` vs `pgTable.withRLS()` at Drizzle 0.45**
   - What we know: Docs say `enableRLS()` deprecated in v1.0.0-beta.1, replaced by `withRLS()`. Current locked version is 0.45.2 (pre-1.0).
   - What's unclear: Whether 0.45 has `.withRLS()` available or only `.enableRLS()`.
   - Recommendation: Add `pgPolicy` to the table (which implicitly enables RLS when policies are added) — this works in all versions. No need to call either `enableRLS()` or `withRLS()` explicitly if policies are defined.

2. **Drizzle CHECK constraint support at 0.45**
   - What we know: Training knowledge and docs suggest Drizzle pgTable does not support arbitrary CHECK constraints inline.
   - What's unclear: Whether Drizzle 0.45 added any CHECK constraint syntax that Context7 doesn't document.
   - Recommendation: Default to the manual SQL migration approach for the `month_is_first_of_month` CHECK. Verify after `drizzle-kit generate` by inspecting the output SQL.

3. **Supabase Auth redirect URLs for local dev**
   - What we know: Supabase dashboard requires redirect URLs to be whitelisted for email verification and password reset callbacks.
   - What's unclear: Exact dashboard configuration steps for `localhost:3000` during development.
   - Recommendation: Add `http://localhost:3000/**` to Supabase dashboard Redirect URLs before testing email flows locally. This is a one-time setup step.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js 16 (requires >=20.9) | Yes | v22.21.1 | — |
| npm | Package installation | Yes | 10.9.4 | — |
| Docker | Supabase CLI local dev stack | Yes | 28.5.1 | Use Supabase cloud directly (no local Postgres) |
| Supabase CLI | Local dev + migration apply | No | — | Use Supabase cloud dashboard + `supabase db push --linked` |
| Vercel CLI | Env var sync + preview deploys | No | — | Set env vars in Vercel dashboard manually; `git push` triggers deploy |
| git | Version control | Yes | 2.33.0 | — |

**Missing dependencies with no fallback:**
- None that block execution.

**Missing dependencies with fallback:**
- **Supabase CLI:** Not installed. Install with `brew install supabase/tap/supabase` or `npm install -g supabase`. Without it, use Supabase cloud dashboard for migration apply (`supabase db push --linked` requires CLI, but migrations can also be applied via Supabase dashboard SQL editor as a manual step). **Recommend installing CLI as Wave 0 task** — it enables local DB stack and is required for `supabase db push`.
- **Vercel CLI:** Not installed. Install with `npm install -g vercel`. Without it, env vars must be set via Vercel dashboard. Deployments still work via `git push`. Recommend installing for `vercel env pull` to sync `.env.local`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (latest compatible with Next.js 16) |
| Config file | `vitest.config.ts` at project root (Wave 0 creation) |
| Quick run command | `npx vitest run tests/time.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GOAL-04 + D-05 | `goals.month` CHECK rejects non-first-of-month | manual (DB) | `supabase db push && psql -c "INSERT INTO goals(month,...) VALUES('2026-04-15',...)"` — expect constraint violation | Wave 0 (SQL script) |
| D-23 / D-13 | `today(utcTimestamp, 'America/Los_Angeles')` returns correct local date near month boundary | unit | `npx vitest run tests/time.test.ts` | Wave 0 (time.test.ts) |
| D-23 / D-14 | `monthBucket()` returns first-of-month for UTC-8, UTC+13, UTC+0 | unit | `npx vitest run tests/time.test.ts` | Wave 0 (time.test.ts) |
| D-23 | DST spring-forward: 11:30 PM on spring-forward day in America/New_York | unit | `npx vitest run tests/time.test.ts` | Wave 0 (time.test.ts) |
| D-23 | Leap year Feb 28/29 boundaries | unit | `npx vitest run tests/time.test.ts` | Wave 0 (time.test.ts) |
| D-23 | NYE midnight UTC | unit | `npx vitest run tests/time.test.ts` | Wave 0 (time.test.ts) |
| D-21 / D-22 | RLS: user A cannot read user B's goals or users row | manual (DB) | `psql` with two test JWTs; SELECT across users — expect empty result | Post-migration manual test |
| AUTH-03 | Token refresh: replaying logged-out cookie returns 401 | manual (browser) | Manual: logout, replay cookie in Postman — expect 401 | Manual test (no automated equivalent) |
| AUTH-05 | Password reset: reusing a reset link returns error | manual (browser) | Use reset link twice — second use should fail | Manual test |
| AUTH-02 | Unverified user blocked from login | manual (browser) | Sign up, skip verification email, attempt login — expect "please verify" message | Manual test |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/time.test.ts` (< 2 seconds)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full Vitest suite green + manual auth flow checklist complete before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/time.test.ts` — covers D-23 timezone fixtures (REQ GOAL-04, D-13, D-14)
- [ ] `vitest.config.ts` — Vitest configuration with `environment: 'node'`
- [ ] Framework install: `npm install -D vitest @vitejs/plugin-react jsdom` (if not already in package.json)
- [ ] `tests/` directory creation

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Supabase Auth (email/password + verification) |
| V3 Session Management | Yes | `@supabase/ssr` HttpOnly + Secure + SameSite=Lax cookies; `getUser()` server-side JWT validation |
| V4 Access Control | Yes | Drizzle `pgPolicy` RLS — each user sees only their own data |
| V5 Input Validation | Yes | Zod schemas on auth forms (client) + Server Actions (server) |
| V6 Cryptography | No (Supabase-owned) | Supabase handles JWT signing, password hashing (bcrypt), reset tokens |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cookie theft → session replay | Spoofing | HttpOnly + Secure + SameSite=Lax (default in @supabase/ssr); logout invalidates server-side session |
| Expired session not refreshed → stale auth state | Elevation of Privilege | `middleware.ts` calls `getUser()` on every request to refresh token |
| RLS bypass via service key in client code | Elevation of Privilege | Never expose `SUPABASE_SERVICE_ROLE_KEY` to client; only use anon key client-side |
| Cross-user data access via IDOR | Elevation of Privilege | RLS policies enforce `user_id = auth.uid()` at DB layer; service layer double-checks |
| Password reset token replay | Spoofing | Supabase enforces single-use + 15-min expiry; verify in manual test |
| Unverified user accessing protected routes | Spoofing | `middleware.ts` checks `email_confirmed_at`; login Server Action rejects unverified users |
| SQL injection via Drizzle `sql` template literal | Tampering | Use `sql` tagged template for expressions; parameterized queries for all user input |

---

## Sources

### Primary (HIGH confidence)

- Context7 `/supabase/ssr` — `createServerClient`, `createBrowserClient`, middleware cookie pattern (`getAll`/`setAll`)
- Context7 `/drizzle-team/drizzle-orm-docs` — `pgPolicy`, `authenticatedRole`, `authUsers`, `crudPolicy` (Neon-only clarification), `drizzle.config.ts` Supabase tutorial
- Context7 `/date-fns/tz` — `TZDate` class, `TZDate.tz()` static method, DST behavior
- Context7 `/vitest-dev/vitest` — `vi.useFakeTimers()`, `defineConfig`, `environment: 'node'`
- Context7 `/react-hook-form/react-hook-form` — `useForm` + `zodResolver`, `handleSubmit`, `setError`
- Context7 `/websites/nextjs` — `middleware.ts` matcher configuration
- `npm view @date-fns/tz version` → 1.4.1 (peerDeps: `date-fns ^3.0.0 || ^4.0.0`)
- `npm view date-fns-tz version` → 3.2.0 (legacy, peerDeps same)
- `npm view date-fns version` → 4.1.0

### Secondary (MEDIUM confidence)

- CLAUDE.md §Technology Stack — version-pinned stack, compatibility matrix
- CONTEXT.md D-01..D-24 — locked decisions
- `.planning/research/PITFALLS.md` §2 (timezone/DST bugs) + §3 (over-engineered schema)
- `.planning/research/ARCHITECTURE.md` — data model, project structure, Server Actions pattern

### Tertiary (LOW confidence — flagged as ASSUMED)

- Supabase `auth.users` INSERT trigger pattern (A1, A2) — standard pattern from training; Supabase docs URL was inaccessible via WebFetch this session
- `auth/callback/route.ts` handling both email-verify and password-reset via `exchangeCodeForSession` (A2)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via `npm view`; patterns confirmed via Context7
- Architecture: HIGH — patterns verified in Context7 for @supabase/ssr, Drizzle, date-fns/tz
- Pitfalls: HIGH — verified findings, plus ASSUMED on auth trigger pattern (clearly tagged)
- `crudPolicy` vs `pgPolicy` for Supabase: HIGH — confirmed Neon-specific import in Context7

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (30 days — stable libraries, except `@supabase/ssr` patch releases which follow the Supabase release cadence)
