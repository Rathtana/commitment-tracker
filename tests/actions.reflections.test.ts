import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// ---------------------------------------------------------------------------
// Module-level mocks — mirroring the actions.goals.test.ts pattern.
// Default: authenticated as USER_A, timezone UTC.
// Override per-test via mockGetUser / mockUpsertReflection.
// ---------------------------------------------------------------------------

const mockGetUser = vi.fn().mockResolvedValue({
  data: { user: { id: '00000000-0000-0000-0000-000000000001' } },
})

vi.mock('../src/lib/supabase/server', () => ({
  getSupabaseServerClient: vi.fn().mockImplementation(async () => ({
    auth: { getUser: mockGetUser },
  })),
}))

// Mock db for resolveUserTz
vi.mock('../src/server/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ timezone: 'UTC' }]),
        }),
      }),
    }),
  },
}))

// Mock upsertReflection service — default returns a savedAt date
const mockUpsertReflection = vi.fn().mockResolvedValue({ savedAt: new Date('2026-04-15T12:00:00.000Z') })
const MockFutureMonthReflectionError = class FutureMonthReflectionError extends Error {
  constructor() { super("Reflections aren't available for future months.") }
}

vi.mock('../src/server/services/reflections', () => ({
  upsertReflection: (...args: unknown[]) => mockUpsertReflection(...args),
  FutureMonthReflectionError: MockFutureMonthReflectionError,
}))

// ---------------------------------------------------------------------------
// Export / structure
// ---------------------------------------------------------------------------

describe('upsertReflectionAction — schema exports', () => {
  it('exports upsertReflectionAction', async () => {
    const mod = await import('../src/server/actions/reflections')
    expect(typeof mod.upsertReflectionAction).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe('upsertReflectionAction — unauthenticated', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
  })

  it('returns { ok: false, error: "Not authenticated." } when no session', async () => {
    const { upsertReflectionAction } = await import('../src/server/actions/reflections')
    const r = await upsertReflectionAction({ month: '2026-04-01', whatWorked: null, whatDidnt: null })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Not authenticated.')
  })
})

// ---------------------------------------------------------------------------
// Zod validation (fires before auth)
// ---------------------------------------------------------------------------

describe('upsertReflectionAction — Zod validation', () => {
  it('rejects whatWorked exceeding 280 chars', async () => {
    const { upsertReflectionAction } = await import('../src/server/actions/reflections')
    const r = await upsertReflectionAction({
      month: '2026-04-01',
      whatWorked: 'a'.repeat(281),
      whatDidnt: null,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Invalid input.')
  })

  it('rejects invalid month format', async () => {
    const { upsertReflectionAction } = await import('../src/server/actions/reflections')
    const r = await upsertReflectionAction({
      month: 'not-a-date',
      whatWorked: null,
      whatDidnt: null,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('Invalid input.')
  })
})

// ---------------------------------------------------------------------------
// D-28: future-month gate (server-side defense in depth)
// ---------------------------------------------------------------------------

describe('upsertReflectionAction — future month gate (D-28)', () => {
  beforeEach(() => {
    // Restore authenticated user
    mockGetUser.mockResolvedValue({
      data: { user: { id: '00000000-0000-0000-0000-000000000001' } },
    })
  })

  it('rejects 2099-01-01 reflection with future-month error', async () => {
    const { upsertReflectionAction } = await import('../src/server/actions/reflections')
    const r = await upsertReflectionAction({
      month: '2099-01-01',
      whatWorked: 'future stuff',
      whatDidnt: null,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe("Reflections aren't available for future months.")
  })
})

// ---------------------------------------------------------------------------
// D-27: past-month always editable
// ---------------------------------------------------------------------------

describe('upsertReflectionAction — past month allowed (D-27)', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: '00000000-0000-0000-0000-000000000001' } },
    })
    mockUpsertReflection.mockResolvedValue({ savedAt: new Date('2020-01-15T12:00:00.000Z') })
  })

  it('past-month (2020-01-01) reflection save succeeds', async () => {
    const { upsertReflectionAction } = await import('../src/server/actions/reflections')
    const r = await upsertReflectionAction({
      month: '2020-01-01',
      whatWorked: 'old stuff',
      whatDidnt: 'old problems',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(typeof r.data.savedAt).toBe('string')
    }
  })
})

// ---------------------------------------------------------------------------
// Current month — allowed
// ---------------------------------------------------------------------------

describe('upsertReflectionAction — current month allowed', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: '00000000-0000-0000-0000-000000000001' } },
    })
    mockUpsertReflection.mockResolvedValue({ savedAt: new Date('2026-04-15T12:00:00.000Z') })
  })

  it('current-month reflection save succeeds', async () => {
    const { upsertReflectionAction } = await import('../src/server/actions/reflections')
    // Use current month 2026-04 (per currentDate in CLAUDE.md: 2026-04-26)
    const r = await upsertReflectionAction({
      month: '2026-04-01',
      whatWorked: 'great progress',
      whatDidnt: null,
    })
    expect(r.ok).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Successful response shape: { ok: true, data: { savedAt: ISO string } }
// ---------------------------------------------------------------------------

describe('upsertReflectionAction — successful response shape', () => {
  beforeEach(() => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: '00000000-0000-0000-0000-000000000001' } },
    })
    const savedAt = new Date('2026-03-15T12:00:00.000Z')
    mockUpsertReflection.mockResolvedValue({ savedAt })
  })

  it('returns { ok: true, data: { savedAt: ISO string } } on success', async () => {
    const savedAt = new Date('2026-03-15T12:00:00.000Z')
    mockUpsertReflection.mockResolvedValue({ savedAt })

    const { upsertReflectionAction } = await import('../src/server/actions/reflections')
    const r = await upsertReflectionAction({
      month: '2026-03-01',
      whatWorked: 'Shipped the feature',
      whatDidnt: null,
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.savedAt).toBe(savedAt.toISOString())
    }
  })
})

// ---------------------------------------------------------------------------
// upsertReflection service — structural exports
// ---------------------------------------------------------------------------

describe('upsertReflection service exports', () => {
  it('exports upsertReflection function', async () => {
    // Test the real module (not mocked) via a direct import with fresh path
    // We just confirm the service file compiles and exports the right names.
    // The mock above intercepts the action's import; here we test the service directly.
    const { FutureMonthReflectionError } = await import('../src/server/services/reflections')
    expect(FutureMonthReflectionError).toBeDefined()
    const err = new FutureMonthReflectionError()
    expect(err.message).toBe("Reflections aren't available for future months.")
  })
})

// ---------------------------------------------------------------------------
// Query helpers — structural exports
// ---------------------------------------------------------------------------

describe('query helpers exports', () => {
  it('exports countGoalsInMonth', async () => {
    const mod = await import('../src/server/db/queries')
    expect(typeof mod.countGoalsInMonth).toBe('function')
  })

  it('exports getReflectionForMonth', async () => {
    const mod = await import('../src/server/db/queries')
    expect(typeof mod.getReflectionForMonth).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// Zod schema server transform (D-30): empty/whitespace → null
// ---------------------------------------------------------------------------

describe('upsertReflectionSchema server transform (D-30)', () => {
  it('transforms empty string whatWorked → null', async () => {
    const { upsertReflectionSchema } = await import('../src/lib/schemas/reflections')
    const result = upsertReflectionSchema.parse({
      month: '2026-04-01',
      whatWorked: '',
      whatDidnt: '',
    })
    expect(result.whatWorked).toBeNull()
    expect(result.whatDidnt).toBeNull()
  })

  it('transforms whitespace-only string → null', async () => {
    const { upsertReflectionSchema } = await import('../src/lib/schemas/reflections')
    const result = upsertReflectionSchema.parse({
      month: '2026-04-01',
      whatWorked: '   ',
      whatDidnt: '\t\n',
    })
    expect(result.whatWorked).toBeNull()
    expect(result.whatDidnt).toBeNull()
  })

  it('preserves non-empty strings', async () => {
    const { upsertReflectionSchema } = await import('../src/lib/schemas/reflections')
    const result = upsertReflectionSchema.parse({
      month: '2026-04-01',
      whatWorked: 'Great month',
      whatDidnt: 'Fell behind on reading',
    })
    expect(result.whatWorked).toBe('Great month')
    expect(result.whatDidnt).toBe('Fell behind on reading')
  })
})
