import { describe, it, expect } from 'vitest'
import { monthSegmentSchema } from '../src/lib/schemas/month'

describe('monthSegmentSchema', () => {
  it('accepts "2026-04" (valid)', () => {
    expect(monthSegmentSchema.safeParse('2026-04').success).toBe(true)
  })

  it('accepts "2025-12" (valid, December)', () => {
    expect(monthSegmentSchema.safeParse('2025-12').success).toBe(true)
  })

  it('accepts "1970-01" (lower year bound)', () => {
    expect(monthSegmentSchema.safeParse('1970-01').success).toBe(true)
  })

  it('accepts "9999-12" (upper year bound)', () => {
    expect(monthSegmentSchema.safeParse('9999-12').success).toBe(true)
  })

  it('rejects "26-4" (bad shape — missing digits)', () => {
    expect(monthSegmentSchema.safeParse('26-4').success).toBe(false)
  })

  it('rejects "2026-13" (month 13 out of range)', () => {
    expect(monthSegmentSchema.safeParse('2026-13').success).toBe(false)
  })

  it('rejects "2026-00" (month 0 out of range)', () => {
    expect(monthSegmentSchema.safeParse('2026-00').success).toBe(false)
  })

  it('rejects "2026-4" (month must be 2 digits)', () => {
    expect(monthSegmentSchema.safeParse('2026-4').success).toBe(false)
  })

  it('rejects "abc-de" (non-numeric)', () => {
    expect(monthSegmentSchema.safeParse('abc-de').success).toBe(false)
  })

  it('rejects "" (empty string)', () => {
    expect(monthSegmentSchema.safeParse('').success).toBe(false)
  })

  it('rejects "1969-12" (year below 1970)', () => {
    expect(monthSegmentSchema.safeParse('1969-12').success).toBe(false)
  })
})
