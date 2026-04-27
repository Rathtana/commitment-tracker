import { TZDate } from '@date-fns/tz'
import { startOfMonth, format, isSameMonth, isBefore } from 'date-fns'

/**
 * Returns the user's local date as 'YYYY-MM-DD'.
 * @param now    - A UTC Date (e.g., new Date() on the server)
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
  // so Postgres DATE column receives the correct first-of-month value.
  return new Date(format(first, 'yyyy-MM-dd') + 'T00:00:00.000Z')
}

/**
 * Compare a viewed month (from URL) against the current month (derived from now+tz).
 * Both inputs are Date objects at first-of-month 00:00:00 UTC (per monthBucket contract).
 * No userTz param — both inputs are already bucketed; adding TZ would double-apply offset.
 * Phase 3 D-17 + RESEARCH §Pattern 3.
 */
export function compareMonth(viewed: Date, current: Date): 'past' | 'current' | 'future' {
  if (isSameMonth(viewed, current)) return 'current'
  if (isBefore(viewed, current)) return 'past'
  return 'future'
}

/**
 * Serialize a first-of-month Date to the canonical 'YYYY-MM' URL segment shape.
 * Input MUST be the output of monthBucket() (UTC midnight first-of-month).
 */
export function formatMonthSegment(month: Date): string {
  return month.toISOString().slice(0, 7)
}

/**
 * Inverse of formatMonthSegment. Returns a first-of-month Date at UTC midnight.
 * Callers SHOULD have validated `segment` against monthSegmentSchema first.
 */
export function parseMonthSegment(segment: string): Date {
  return new Date(`${segment}-01T00:00:00.000Z`)
}
