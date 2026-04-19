import { TZDate } from '@date-fns/tz'
import { startOfMonth, format } from 'date-fns'

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
