import { describe, it, expect, afterEach, vi } from 'vitest'
import { today, monthBucket } from '../src/lib/time'

describe('today()', () => {
  afterEach(() => vi.useRealTimers())

  it('UTC-8: 11:30 PM on March 31 → March 31', () => {
    // 2026-04-01 07:30 UTC = 2026-03-31 23:30 America/Los_Angeles (UTC-7 DST, or UTC-8 PST)
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
