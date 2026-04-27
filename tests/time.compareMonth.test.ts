import { describe, it, expect } from 'vitest'
import { compareMonth } from '../src/lib/time'

describe('compareMonth()', () => {
  it('same month → current', () => {
    const viewed = new Date('2026-04-01T00:00:00.000Z')
    const current = new Date('2026-04-01T00:00:00.000Z')
    expect(compareMonth(viewed, current)).toBe('current')
  })

  it('viewed is one month before current → past', () => {
    const viewed = new Date('2026-03-01T00:00:00.000Z')
    const current = new Date('2026-04-01T00:00:00.000Z')
    expect(compareMonth(viewed, current)).toBe('past')
  })

  it('viewed is one month after current → future', () => {
    const viewed = new Date('2026-05-01T00:00:00.000Z')
    const current = new Date('2026-04-01T00:00:00.000Z')
    expect(compareMonth(viewed, current)).toBe('future')
  })

  it('viewed = Dec 2025, current = Jan 2026 → past (year boundary)', () => {
    const viewed = new Date('2025-12-01T00:00:00.000Z')
    const current = new Date('2026-01-01T00:00:00.000Z')
    expect(compareMonth(viewed, current)).toBe('past')
  })

  it('viewed = Jan 2026, current = Dec 2025 → future (year boundary)', () => {
    const viewed = new Date('2026-01-01T00:00:00.000Z')
    const current = new Date('2025-12-01T00:00:00.000Z')
    expect(compareMonth(viewed, current)).toBe('future')
  })

  it('viewed = Feb 2024 (leap), current = Mar 2024 → past (leap year boundary)', () => {
    const viewed = new Date('2024-02-01T00:00:00.000Z')
    const current = new Date('2024-03-01T00:00:00.000Z')
    expect(compareMonth(viewed, current)).toBe('past')
  })

  it('viewed = Mar 2026 (DST spring-forward month), current = Apr 2026 → past', () => {
    // March is the US DST spring-forward month; both inputs are UTC midnight first-of-month
    // so DST has no effect on the comparison (already bucketed to UTC)
    const viewed = new Date('2026-03-01T00:00:00.000Z')
    const current = new Date('2026-04-01T00:00:00.000Z')
    expect(compareMonth(viewed, current)).toBe('past')
  })
})
