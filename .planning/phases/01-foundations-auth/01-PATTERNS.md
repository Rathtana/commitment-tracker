# Phase 1: Foundations & Auth - Pattern Map

**Mapped:** 2026-04-17
**Files analyzed:** 28 planned new files (greenfield)
**Analogs found:** 0 in-repo / 28 total — ALL greenfield. External canonical patterns from RESEARCH.md used for every file.

> **Greenfield notice:** This repository contains only `CLAUDE.md`, `.claude/`, `.planning/`, and `.git/`. There is no `package.json`, no `src/`, no existing code. Every planned file is a pure creation with NO in-repo analog. Pattern assignments below cite excerpts from `01-RESEARCH.md` (this phase's research document) as the canonical source. The planner and executor MUST treat RESEARCH.md patterns as the analog and copy the referenced excerpts verbatim (with minor TypeScript adjustments).

---

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `package.json` | config | n/a | RESEARCH.md Standard Stack §Installation | greenfield — install commands only |
| `next.config.ts` | config | n/a | Next.js 16 defaults (RESEARCH.md §Pattern 1) | greenfield — framework default |
| `tsconfig.json` | config | n/a | `create-next-app` output | greenfield — framework default |
| `drizzle.config.ts` | config | n/a | RESEARCH.md §Code Examples `drizzle.config.ts` | greenfield — external example |
| `vitest.config.ts` | config | n/a | RESEARCH.md §Code Examples `vitest.config.ts` | greenfield — external example |
| `.env.local` | config | n/a | RESEARCH.md §Files and Directories | greenfield — env keys enumerated |
| `src/middleware.ts` | middleware | request-response | RESEARCH.md §Pattern 1: middleware.ts | greenfield — canonical `@supabase/ssr` template |
| `src/app/layout.tsx` | route (layout) | request-response | Next.js 16 App Router default | greenfield — framework default |
| `src/app/globals.css` | config (CSS) | n/a | RESEARCH.md §Standard Stack (Tailwind v4 `@theme`) | greenfield — Tailwind v4 CSS-first |
| `src/app/(auth)/layout.tsx` | route (layout) | request-response | Next.js App Router nested layout | greenfield — framework default |
| `src/app/(auth)/login/page.tsx` | route (page) | request-response | RESEARCH.md §Pattern 5 (login-form.tsx wrapper) | greenfield — page wraps client form |
| `src/app/(auth)/signup/page.tsx` | route (page) | request-response | RESEARCH.md §Pattern 5 | greenfield — page wraps client form |
| `src/app/(auth)/reset-password/page.tsx` | route (page) | request-response | RESEARCH.md §Pattern 5 | greenfield |
| `src/app/(auth)/update-password/page.tsx` | route (page) | request-response | RESEARCH.md §Pattern 5 | greenfield |
| `src/app/(auth)/verify-email/page.tsx` | route (page) | request-response | RESEARCH.md §System Architecture (VerificationGate) | greenfield — Server Component gate |
| `src/app/(protected)/layout.tsx` | route (layout) | request-response | RESEARCH.md §System Architecture (auth guard) | greenfield |
| `src/app/(protected)/landing/page.tsx` | route (page) | request-response | CONTEXT.md D-02 (stub: welcome + logout) | greenfield — minimal Server Component |
| `src/app/auth/callback/route.ts` | route handler | request-response | RESEARCH.md §Pitfall 7 (callback route) | greenfield — PKCE code exchange |
| `src/components/auth/login-form.tsx` | component (client) | request-response | RESEARCH.md §Pattern 5 | greenfield — canonical RHF + Zod |
| `src/components/auth/signup-form.tsx` | component (client) | request-response | RESEARCH.md §Pattern 5 | greenfield — adds timezone detection |
| `src/components/auth/reset-password-form.tsx` | component (client) | request-response | RESEARCH.md §Pattern 5 | greenfield |
| `src/components/auth/update-password-form.tsx` | component (client) | request-response | RESEARCH.md §Pattern 5 | greenfield |
| `src/components/ui/*` | component (shadcn) | n/a | shadcn CLI output (`npx shadcn@latest add button card input label form`) | greenfield — copy-paste |
| `src/server/actions/auth.ts` | server action | request-response | RESEARCH.md §System Architecture (Server Actions block) | greenfield — 5 action signatures enumerated |
| `src/server/db/schema.ts` | schema | CRUD | RESEARCH.md §Pattern 2 (Drizzle + pgPolicy) | greenfield — canonical Drizzle + Supabase RLS |
| `src/server/db/index.ts` | client helper | CRUD | RESEARCH.md §Code Examples (Drizzle DB Instance) | greenfield — postgres.js driver |
| `supabase/migrations/0000_*.sql` | migration | n/a | `drizzle-kit generate` output | greenfield — tool-generated |
| `supabase/migrations/0001_custom_constraints.sql` | migration (custom) | n/a | RESEARCH.md §Pattern 4 (trigger) + §Pitfall 3 (CHECK) | greenfield — manual SQL |
| `src/lib/time.ts` | utility (isomorphic) | transform | RESEARCH.md §Pattern 3 (today + monthBucket) | greenfield — pure functions |
| `tests/time.test.ts` | test | n/a | RESEARCH.md §Code Examples (D-23 Vitest suite) | greenfield — full fixture suite provided |

---

## Pattern Assignments

### `src/middleware.ts` (middleware, request-response)

**Analog:** RESEARCH.md §Pattern 1: middleware.ts Shape (lines 287-336 of `01-RESEARCH.md`)
**In-repo analog:** NONE (greenfield)
**Canonical source:** Context7 `/supabase/ssr` — verified 2026-04-17

**Imports pattern to copy:**
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
```

**Core pattern (copy verbatim, adjust route paths for route-group semantics):**
```typescript
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
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && request.nextUrl.pathname.startsWith('/landing')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && ['/login', '/signup', '/reset-password'].includes(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/landing', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**CRITICAL RULES (from RESEARCH.md Pitfall 1 + Pitfall 2):**
- Use `getAll`/`setAll` cookie API, NEVER `get`/`set`/`remove` (deprecated)
- Use `supabase.auth.getUser()` NOT `getSession()` (server-side JWT validation)
- The `response.cookies.set(...)` inside `setAll` is what persists refreshed tokens — do not drop this
- Route-group parens (`(auth)`, `(protected)`) do NOT appear in `request.nextUrl.pathname`; match on actual URLs (e.g., `/landing`, `/login`) — this differs from the RESEARCH.md excerpt and is a correction the executor must apply.

---

### `src/app/auth/callback/route.ts` (route handler, request-response)

**Analog:** RESEARCH.md §Pitfall 7 Supabase Auth Callback Route Missing (lines 682-719)
**In-repo analog:** NONE (greenfield)
**Canonical source:** `@supabase/ssr` official pattern (flagged ASSUMED in RESEARCH.md A2 — verify against Supabase docs during execution)

**Core pattern (copy verbatim):**
```typescript
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

**Handles:** email verification AND password reset PKCE code exchange (same endpoint, different redirect targets via `next` query param).

---

### `src/server/db/schema.ts` (schema, CRUD)

**Analog:** RESEARCH.md §Pattern 2: Drizzle Schema with Supabase RLS Policies (lines 344-426)
**In-repo analog:** NONE (greenfield)
**Canonical source:** Context7 `/drizzle-team/drizzle-orm-docs` — verified 2026-04-17

**Imports pattern:**
```typescript
import { pgTable, uuid, text, timestamp, date, pgEnum, foreignKey, pgPolicy } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { authenticatedRole, authUsers } from 'drizzle-orm/supabase'
```

**users table pattern (copy verbatim):**
```typescript
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
```

**goals table pattern (copy verbatim):**
```typescript
export const goalTypeEnum = pgEnum('goal_type', ['count', 'checklist', 'habit'])

export const goals = pgTable(
  'goals',
  {
    id: uuid('id').primaryKey().defaultRandom().notNull(),
    userId: uuid('user_id').notNull(),
    month: date('month').notNull(),
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
    pgPolicy('goals-select-own', { for: 'select', to: authenticatedRole, using: sql`user_id = auth.uid()` }),
    pgPolicy('goals-insert-own', { for: 'insert', to: authenticatedRole, withCheck: sql`user_id = auth.uid()` }),
    pgPolicy('goals-update-own', { for: 'update', to: authenticatedRole, using: sql`user_id = auth.uid()`, withCheck: sql`user_id = auth.uid()` }),
    pgPolicy('goals-delete-own', { for: 'delete', to: authenticatedRole, using: sql`user_id = auth.uid()` }),
  ]
)
```

**CRITICAL RULES:**
- Use `pgPolicy` from `drizzle-orm/pg-core`, NEVER `crudPolicy` from `drizzle-orm/neon` (Neon-specific — uses `auth.user_id()` not `auth.uid()`)
- Use `authenticatedRole` and `authUsers` from `drizzle-orm/supabase`
- The `CHECK (EXTRACT(DAY FROM month) = 1)` constraint for `goals.month` CANNOT be expressed here — it must be added in the custom SQL migration (see `supabase/migrations/0001_*.sql` below). This is RESEARCH.md Pitfall 3.

---

### `src/server/db/index.ts` (client helper, CRUD)

**Analog:** RESEARCH.md §Code Examples Drizzle DB Instance (lines 843-856)
**In-repo analog:** NONE (greenfield)
**Canonical source:** Context7 `/drizzle-team/drizzle-orm-docs`

**Full file (copy verbatim):**
```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL!

// Disable prefetch for Supabase pooler mode (Transaction mode = no PREPARE)
const client = postgres(connectionString, { prepare: false })

export const db = drizzle(client, { schema })
```

**CRITICAL RULE:** `prepare: false` is required for Supabase connection pooler (Transaction mode). Omitting it causes runtime "PREPARE not supported" errors.

---

### `src/lib/time.ts` (utility, isomorphic transform)

**Analog:** RESEARCH.md §Pattern 3: Timezone Pure Functions with @date-fns/tz (lines 434-462)
**In-repo analog:** NONE (greenfield)
**Canonical source:** Context7 `/date-fns/tz` — verified 2026-04-17

**Full file (copy verbatim):**
```typescript
import { TZDate } from '@date-fns/tz'
import { startOfMonth, format } from 'date-fns'

/**
 * Returns the user's local date as 'YYYY-MM-DD'.
 */
export function today(now: Date, userTz: string): string {
  const local = new TZDate(now.getTime(), userTz)
  return format(local, 'yyyy-MM-dd')
}

/**
 * Returns a Date representing the first day of the user's local month.
 */
export function monthBucket(now: Date, userTz: string): Date {
  const local = new TZDate(now.getTime(), userTz)
  const first = startOfMonth(local)
  return new Date(format(first, 'yyyy-MM-dd') + 'T00:00:00.000Z')
}
```

**CRITICAL RULES (from RESEARCH.md Pitfall 6):**
- Use `new TZDate(now.getTime(), userTz)` — two-argument form with timestamp first
- NEVER use `new TZDate(userTz)` — the constructor interprets a bare timezone string as a date string and returns Invalid Date
- `TZDate.tz(userTz)` is the "now in this tz" static method; only use if not starting from a known timestamp
- Use `@date-fns/tz` (first-party v4 companion), NEVER `date-fns-tz` (legacy marnusw package with different API)

---

### `tests/time.test.ts` (test)

**Analog:** RESEARCH.md §Code Examples D-23 Vitest Fixture Suite (lines 746-822)
**In-repo analog:** NONE (greenfield)
**Canonical source:** CONTEXT.md D-23 fixture requirements; TZDate behavior from Context7

**Copy verbatim from RESEARCH.md lines 746-822.** The full fixture suite covers:
- UTC-8, UTC+13, UTC+0 at 11:30 PM last-day-of-month
- DST spring-forward (March 8 2026 America/New_York)
- Leap year Feb 28 and Feb 29 (2028)
- NYE midnight UTC
- `monthBucket()` returns first-of-month for UTC-8, UTC+13 month-boundary cases
- `monthBucket()` output has `getUTCDate() === 1`

**Required imports:**
```typescript
import { describe, it, expect, afterEach, vi } from 'vitest'
import { today, monthBucket } from '../src/lib/time'
```

---

### `src/components/auth/login-form.tsx` (component, client)

**Analog:** RESEARCH.md §Pattern 5: React Hook Form + Zod + Server Actions Wiring (lines 501-544)
**In-repo analog:** NONE (greenfield)
**Canonical source:** Context7 `/react-hook-form/react-hook-form` — verified 2026-04-17

**Imports pattern:**
```typescript
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { signInAction } from '@/server/actions/auth'
```

**Core pattern (copy structure verbatim from RESEARCH.md lines 510-544).**

**shadcn `<Form>` wrapper recommended** (RESEARCH.md line 547) over plain `<form>` for consistent ARIA + field/error styling. Use `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormMessage>` from shadcn.

**Error handling pattern:**
```typescript
async function onSubmit(data: LoginFormData) {
  const result = await signInAction(data)
  if (result?.error) {
    setError('root', { message: result.error })
  }
}
```

---

### `src/components/auth/signup-form.tsx` (component, client)

**Analog:** RESEARCH.md §Pattern 5 (same as login-form) + CONTEXT.md D-12 (timezone capture)
**In-repo analog:** NONE (greenfield)

**Variation from login-form:** reads `Intl.DateTimeFormat().resolvedOptions().timeZone` at submit time and passes it to `signUpAction`. Fallback to `'UTC'` if falsy (per D-12).

**Timezone detection pattern (author this — not in RESEARCH.md verbatim):**
```typescript
async function onSubmit(data: SignUpFormData) {
  const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const result = await signUpAction({ ...data, timezone: detectedTz })
  if (result?.error) {
    setError('root', { message: result.error })
  }
}
```

**Zod schema additions:** `email`, `password` (min 8), optionally `confirmPassword` with `.refine()` to match.

---

### `src/components/auth/reset-password-form.tsx` + `update-password-form.tsx` (component, client)

**Analog:** RESEARCH.md §Pattern 5 (same shape as login-form)
**In-repo analog:** NONE (greenfield)

**Difference:**
- `reset-password-form.tsx` — single email field, calls `requestPasswordResetAction(email)`
- `update-password-form.tsx` — renders on `/update-password` after PKCE callback; single new-password field (plus confirm), calls `updatePasswordAction(newPassword)`. User is already authenticated at this point via the callback route's `exchangeCodeForSession`.

---

### `src/server/actions/auth.ts` (server action, request-response)

**Analog:** RESEARCH.md §System Architecture Server Actions block (lines 205-210) + Supabase Auth API
**In-repo analog:** NONE (greenfield)

**Action signatures to implement:**
```typescript
'use server'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { z } from 'zod'

// Shared Zod schemas (mirror client-side schemas for server-side re-validation)
const emailSchema = z.string().email()
const passwordSchema = z.string().min(8)

export async function signUpAction(input: { email: string; password: string; timezone: string }) { /* supabase.auth.signUp + update public.users.timezone */ }
export async function signInAction(input: { email: string; password: string }) { /* supabase.auth.signInWithPassword; reject if !email_confirmed_at */ }
export async function signOutAction() { /* supabase.auth.signOut() */ }
export async function requestPasswordResetAction(email: string) { /* supabase.auth.resetPasswordForEmail */ }
export async function updatePasswordAction(newPassword: string) { /* supabase.auth.updateUser({ password }) */ }
```

**Supabase client creation pattern inside each action (copy structure from `auth/callback/route.ts` pattern above):**
```typescript
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
```

**signUpAction two-step write (from RESEARCH.md Pitfall 5):**
1. `await supabase.auth.signUp({ email, password })` — creates `auth.users`, trigger fires, creates `public.users` with default `timezone='UTC'`
2. `await supabase.from('users').update({ timezone }).eq('id', user.id)` — patches the timezone. MUST `await` step 1 before step 2.

**signInAction email-verification gate (from CONTEXT.md D-16):**
After `signInWithPassword`, check `data.user?.email_confirmed_at`. If null, call `supabase.auth.signOut()` immediately and return `{ error: 'Please verify your email before signing in.' }`.

**Return shape:** `{ error?: string }` — matches the Pattern 5 `result?.error` client contract.

---

### `supabase/migrations/0000_initial_schema.sql` (migration, tool-generated)

**Analog:** `drizzle-kit generate` output from `schema.ts`
**In-repo analog:** NONE (greenfield)

Generated by running `npx drizzle-kit generate`. No manual editing for this file. Contains DDL for `public.users`, `public.goals`, FKs, enum, and RLS policy SQL emitted from `pgPolicy()` calls.

---

### `supabase/migrations/0001_custom_constraints.sql` (migration, manual)

**Analog:** RESEARCH.md §Pattern 4 (auth trigger) + §Pitfall 3 (CHECK constraint)
**In-repo analog:** NONE (greenfield)
**Canonical source:** Standard Supabase trigger pattern (flagged ASSUMED in RESEARCH.md A1)

**Full file contents (author this — compose from two RESEARCH.md excerpts):**
```sql
-- CHECK constraint: goals.month must be first-of-month (GOAL-04, D-05)
-- Cannot be expressed in Drizzle pgTable; added manually per Pitfall 3.
ALTER TABLE public.goals ADD CONSTRAINT month_is_first_of_month
  CHECK (EXTRACT(DAY FROM month) = 1);

-- auth.users → public.users trigger (D-08)
-- Supabase auth schema is internal; Drizzle cannot generate this.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, timezone)
  VALUES (NEW.id, 'UTC');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

**Generation command:** `npx drizzle-kit generate --custom --name custom_constraints` (per RESEARCH.md Pitfall 3) then paste the SQL above into the generated file.

**Verification after apply (from RESEARCH.md Pitfall 3):**
```sql
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'month_is_first_of_month';
-- Must return: CHECK ((EXTRACT(day FROM month) = (1)::numeric))
```

---

### `drizzle.config.ts` (config)

**Analog:** RESEARCH.md §Code Examples drizzle.config.ts (lines 826-839)
**In-repo analog:** NONE (greenfield)

**Full file (copy verbatim):**
```typescript
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

**CRITICAL RULE (Pitfall 4):** `out: './supabase/migrations'` is REQUIRED. Default `./drizzle/` breaks `supabase db push`.

---

### `vitest.config.ts` (config)

**Analog:** RESEARCH.md §Code Examples Vitest Config (lines 727-743)
**In-repo analog:** NONE (greenfield)

**Full file (copy verbatim):**
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
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

---

### `src/app/(auth)/layout.tsx` + `src/app/(auth)/{login,signup,reset-password,update-password,verify-email}/page.tsx` (route pages)

**Analog:** Next.js 16 App Router conventions + RESEARCH.md §System Architecture Diagram (lines 199-204)
**In-repo analog:** NONE (greenfield)

**Page shape (Server Component wrapping a Client form):**
```typescript
// src/app/(auth)/login/page.tsx
import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <main>
      <h1>Sign in</h1>
      <LoginForm />
      {/* Links to /signup, /reset-password */}
    </main>
  )
}
```

**Layout shape (centered card per RESEARCH.md line 246):**
Wrap children in a centered-card shadcn `<Card>` or equivalent Tailwind utility layout. No auth guard needed in `(auth)` group — middleware redirects authed users away.

**verify-email/page.tsx variation:** Server Component (not client) — reads user from `createServerClient` and displays "Please verify your email. Resend?" with a form that POSTs to a resend server action. Per D-16, unverified users hitting `/login` are redirected here after their login attempt is rejected.

---

### `src/app/(protected)/layout.tsx` (route layout)

**Analog:** RESEARCH.md §System Architecture (auth guard mention) + Supabase SSR patterns
**In-repo analog:** NONE (greenfield)

**Pattern:** Server Component that calls `createServerClient` + `supabase.auth.getUser()` and redirects to `/login` if no user. Defense-in-depth with middleware (middleware redirects, layout double-checks).

```typescript
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return <>{children}</>
}
```

---

### `src/app/(protected)/landing/page.tsx` (route page)

**Analog:** CONTEXT.md D-02 (minimal stub spec)
**In-repo analog:** NONE (greenfield)

**Full contents (author from D-02):**
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { signOutAction } from '@/server/actions/auth'

export default async function LandingPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(/* ... */)
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main>
      <h1>Welcome, {user?.email}</h1>
      <p>Goals coming in Phase 2</p>
      <form action={signOutAction}>
        <button type="submit">Log out</button>
      </form>
    </main>
  )
}
```

**CRITICAL:** Do NOT build dashboard shell, empty-state cards, or month routing. D-02 mandates "intentionally bare."

---

### `package.json` (config)

**Analog:** RESEARCH.md §Standard Stack Installation (lines 149-177)
**In-repo analog:** NONE (greenfield)

**Install sequence (run these exact commands per RESEARCH.md):**
```bash
npx create-next-app@16 commitment-tracker --typescript --tailwind --app --eslint --turbopack
npx shadcn@latest init
npx shadcn@latest add button card input label form
npm install @supabase/supabase-js @supabase/ssr
npm install drizzle-orm postgres
npm install -D drizzle-kit
npm install react-hook-form zod @hookform/resolvers
npm install @date-fns/tz date-fns
npm install lucide-react
npm install -D vitest @vitejs/plugin-react jsdom
```

**Version locks (from CLAUDE.md and RESEARCH.md Standard Stack table):**
Next.js 16.2.4, React 19.2.5, TypeScript 5.9.3, Tailwind 4.2.2, shadcn 3.5.0, `@supabase/supabase-js` 2.103.3, `@supabase/ssr` 0.10.2, drizzle-orm 0.45.2, drizzle-kit 0.31.10, postgres 3.4.9, react-hook-form 7.72.1, zod 4.3.0, `@hookform/resolvers` 5.2.2, `@date-fns/tz` 1.4.1, date-fns 4.1.0, lucide-react 0.545.0, Vitest latest.

---

### `.env.local` (config)

**Analog:** RESEARCH.md §Files and Directories (line 275) + Supabase SSR requirements
**In-repo analog:** NONE (greenfield)

**Required keys:**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL=          # postgres.js connection string (Supabase pooler, Transaction mode)
```

**NEVER commit:** `.env.local` must be in `.gitignore`. NEVER include `SUPABASE_SERVICE_ROLE_KEY` in client-accessible code (RESEARCH.md §Security Domain).

---

## Shared Patterns

### Authentication (server-side client creation)

**Source:** RESEARCH.md §Pattern 1 (middleware) + §Pitfall 7 (route handler)
**Apply to:** `src/middleware.ts`, `src/app/auth/callback/route.ts`, `src/app/(protected)/layout.tsx`, every function in `src/server/actions/auth.ts`

```typescript
const cookieStore = await cookies()  // or request.cookies in middleware
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
```

**Always use `supabase.auth.getUser()` server-side, never `getSession()`** (RESEARCH.md Pitfall 2).

---

### Validation (Zod + React Hook Form + Server Action re-validation)

**Source:** RESEARCH.md §Pattern 5 (lines 510-523)
**Apply to:** Every auth form (`login`, `signup`, `reset-password`, `update-password`) AND every server action in `src/server/actions/auth.ts`

**Client-side:**
```typescript
const schema = z.object({ email: z.string().email(), password: z.string().min(8) })
const { register, handleSubmit, setError, formState: { errors, isSubmitting } } =
  useForm({ resolver: zodResolver(schema) })
```

**Server-side re-validation (same schema imported into action):**
```typescript
export async function signInAction(input: unknown) {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid input' }
  // ... call supabase
}
```

**Rule:** Zod schemas for forms live in a shared location (e.g., `src/lib/schemas/auth.ts`) so both the client form and the server action import the same source-of-truth.

---

### Error Handling (return-shape contract, not thrown errors)

**Source:** RESEARCH.md §Pattern 5 (lines 525-530)
**Apply to:** Every server action in `src/server/actions/auth.ts` AND every auth form `onSubmit`

**Server action returns:** `{ error?: string }` — never throws for expected auth failures (invalid creds, unverified email, expired reset link). Throws only for infrastructure failures.

**Client form surfaces via:** `setError('root', { message: result.error })` — displayed near submit button.

---

### RLS Policy Convention

**Source:** RESEARCH.md §Pattern 2
**Apply to:** Every table in `src/server/db/schema.ts` (Phase 1: `users`, `goals`; Phase 2+: future tables)

Policy naming: `<table>-<op>-<scope>` (e.g., `goals-select-own`). Use `authenticatedRole` from `drizzle-orm/supabase` and `sql` template for `auth.uid()` comparisons. Always include `withCheck` on INSERT and UPDATE policies to prevent row ownership changes.

---

### Migration Workflow

**Source:** RESEARCH.md §Pitfall 4
**Apply to:** Every schema change (Phase 1 and beyond)

1. Edit `src/server/db/schema.ts`
2. `npx drizzle-kit generate` → produces SQL in `supabase/migrations/`
3. For constraints Drizzle cannot express (CHECK, triggers): `npx drizzle-kit generate --custom --name <name>` then paste SQL
4. `supabase start` (local) or `supabase db push --linked` (staging/prod)

**NEVER use `drizzle-kit push`** (direct DB push) — bypasses Supabase CLI migration tracking.

---

### Pure Function Isomorphism

**Source:** RESEARCH.md §Pattern 3 + CONTEXT.md D-13, D-14
**Apply to:** `src/lib/time.ts` now; in Phase 2, additional `src/lib/progress.ts` will follow the same shape

- No I/O, no side effects, no `Date.now()` inside — all inputs explicit (`now: Date`, `userTz: string`)
- Identical imports work in server AND client (no `'use server'`, no `'use client'`)
- Tested directly with Vitest fake timers — no DB, no middleware

---

## No Analog Found

**All 28 files have no in-repo analog.** This is a greenfield scaffold. The table below enumerates what each file should fall back to from RESEARCH.md since in-repo mapping is impossible:

| File | Reason | Fallback |
|------|--------|----------|
| All files | Greenfield repository — no `src/`, no `package.json`, no prior code | Use RESEARCH.md excerpts cited in each Pattern Assignment above |

---

## Metadata

**Analog search scope:** Repository root (`/Users/rathtana.duong/gsd-tutorial`). Verified contents: `CLAUDE.md`, `.claude/`, `.planning/`, `.git/`. No source directories exist.
**Files scanned:** 0 source files (none exist)
**Pattern extraction date:** 2026-04-17
**Canonical source document:** `.planning/phases/01-foundations-auth/01-RESEARCH.md` — every excerpt above cites specific line ranges in that file
**Downstream consumer:** `gsd-planner` — should reference this file's Pattern Assignments when writing per-plan "Actions" sections, and reference the Shared Patterns section for cross-cutting concerns applied across multiple plans
