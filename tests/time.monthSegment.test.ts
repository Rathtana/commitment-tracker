import { describe, it, expect } from 'vitest'
import { formatMonthSegment, parseMonthSegment } from '../src/lib/time'

describe('formatMonthSegment()', () => {
  it('formats April 2026 as "2026-04"', () => {
    const date = new Date('2026-04-01T00:00:00.000Z')
    expect(formatMonthSegment(date)).toBe('2026-04')
  })

  it('formats December 2025 as "2025-12"', () => {
    const date = new Date('2025-12-01T00:00:00.000Z')
    expect(formatMonthSegment(date)).toBe('2025-12')
  })

  it('formats February 2024 (leap) as "2024-02"', () => {
    const date = new Date('2024-02-01T00:00:00.000Z')
    expect(formatMonthSegment(date)).toBe('2024-02')
  })
})

describe('parseMonthSegment()', () => {
  it('"2026-04" parses to midnight UTC first of April 2026', () => {
    const result = parseMonthSegment('2026-04')
    expect(result.toISOString()).toBe('2026-04-01T00:00:00.000Z')
  })

  it('"2026-04" parses to getUTCDate() === 1', () => {
    const result = parseMonthSegment('2026-04')
    expect(result.getUTCDate()).toBe(1)
  })

  it('"2025-12" parses to December (getUTCMonth() === 11)', () => {
    const result = parseMonthSegment('2025-12')
    expect(result.getUTCMonth()).toBe(11)
  })
})

describe('formatMonthSegment + parseMonthSegment round-trip', () => {
  it('round-trips "2026-04"', () => {
    expect(formatMonthSegment(parseMonthSegment('2026-04'))).toBe('2026-04')
  })

  it('round-trips "2025-12"', () => {
    expect(formatMonthSegment(parseMonthSegment('2025-12'))).toBe('2025-12')
  })
})
