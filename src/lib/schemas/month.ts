import { z } from 'zod'

/**
 * Canonical URL-segment schema for /dashboard/[month] (D-03 + Phase 3 RESEARCH §Pattern 1).
 * Enforces 'YYYY-MM' shape AND year/month range.
 * Consumed by: src/app/(protected)/dashboard/[month]/page.tsx (Plan 04).
 */
export const monthSegmentSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Invalid month segment')
  .refine((s) => {
    const [year, month] = s.split('-').map(Number)
    return year >= 1970 && year <= 9999 && month >= 1 && month <= 12
  }, 'Month out of range')
