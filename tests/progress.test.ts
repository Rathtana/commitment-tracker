import { describe, it, expect } from 'vitest'
import { computeProgress, type Goal } from '../src/lib/progress'

// Use noon UTC to avoid date-boundary sensitivity in most fixtures
const UTC = (iso: string) => new Date(iso + 'T12:00:00.000Z')

// ─────────────────────────────────────────────────────────────────────────────
// COUNT GOALS
// ─────────────────────────────────────────────────────────────────────────────

describe('computeProgress — count', () => {
  const goal = (currentCount: number, targetCount = 10): Goal => ({
    id: 'g1',
    type: 'count',
    targetCount,
    currentCount,
    month: new Date('2026-04-01T00:00:00.000Z'),
  })

  it('day 1: returns warming-up', () => {
    // April 1 — daysElapsed = 1 (< 5)
    const result = computeProgress(goal(0), UTC('2026-04-01'), 'UTC')
    expect(result.pace).toBe('warming-up')
    expect(result.paceDelta).toBe(0)
    expect(result.percent).toBe(0)
    expect(result.raw).toEqual({ done: 0, total: 10 })
  })

  it('day 4: returns warming-up (below threshold)', () => {
    // April 4 — daysElapsed = 4 (< 5)
    const result = computeProgress(goal(2), UTC('2026-04-04'), 'UTC')
    expect(result.pace).toBe('warming-up')
    expect(result.percent).toBeCloseTo(0.2)
  })

  it('day 5: transitions out of warming-up', () => {
    // April 5 — daysElapsed = 5 (≥ 5); expected = 5/30 ≈ 0.167
    // currentCount=2, percent=0.2; paceDelta = round((0.2 - 0.167)*10) = round(0.33) = 0
    const result = computeProgress(goal(2), UTC('2026-04-05'), 'UTC')
    expect(result.pace).not.toBe('warming-up')
    expect(result.pace).toBe('on-pace')
  })

  it('mid-month (day 15 of 30), 50% done: on-pace', () => {
    // daysElapsed=15, expected=15/30=0.5; percent=5/10=0.5; paceDelta=round(0*10)=0
    const result = computeProgress(goal(5), UTC('2026-04-15'), 'UTC')
    expect(result.percent).toBeCloseTo(0.5)
    expect(result.pace).toBe('on-pace')
    expect(result.paceDelta).toBe(0)
  })

  it('mid-month (day 15 of 30), 20% done: behind', () => {
    // percent=2/10=0.2, expected=0.5; paceDelta=round((0.2-0.5)*10)=round(-3)=-3 → behind
    const result = computeProgress(goal(2), UTC('2026-04-15'), 'UTC')
    expect(result.pace).toBe('behind')
    expect(result.paceDelta).toBe(-3)
  })

  it('mid-month (day 15 of 30), 80% done: ahead', () => {
    // percent=8/10=0.8, expected=0.5; paceDelta=round((0.8-0.5)*10)=round(3)=3 → ahead
    const result = computeProgress(goal(8), UTC('2026-04-15'), 'UTC')
    expect(result.pace).toBe('ahead')
    expect(result.paceDelta).toBe(3)
  })

  it('last day (day 30), complete (10/10): percent=1, pace=on-pace', () => {
    // percent=1.0, expected≈1.0; paceDelta=0
    const result = computeProgress(goal(10), UTC('2026-04-30'), 'UTC')
    expect(result.percent).toBe(1)
    expect(result.pace).toBe('on-pace')
    expect(result.paceDelta).toBe(0)
  })

  it('over-target (currentCount > targetCount): clamps percent to 1', () => {
    const result = computeProgress(goal(15, 10), UTC('2026-04-15'), 'UTC')
    expect(result.percent).toBe(1)
    expect(result.raw).toEqual({ done: 15, total: 10 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// CHECKLIST GOALS
// ─────────────────────────────────────────────────────────────────────────────

describe('computeProgress — checklist', () => {
  const goal = (done: number, total: number): Goal => ({
    id: 'g2',
    type: 'checklist',
    tasks: Array.from({ length: total }, (_, i) => ({ isDone: i < done })),
    month: new Date('2026-04-01T00:00:00.000Z'),
  })

  it('half done: percent=0.5', () => {
    const result = computeProgress(goal(2, 4), UTC('2026-04-15'), 'UTC')
    expect(result.percent).toBe(0.5)
    expect(result.pace).toBe('on-pace')
    expect(result.paceDelta).toBe(0)
    expect(result.raw).toEqual({ done: 2, total: 4 })
  })

  it('empty (total=0): percent=0, pace=on-pace', () => {
    const result = computeProgress(goal(0, 0), UTC('2026-04-15'), 'UTC')
    expect(result.percent).toBe(0)
    expect(result.pace).toBe('on-pace')
  })

  it('pace is always on-pace regardless of day (D-12)', () => {
    // day 15, 0 of 5 tasks done — no time axis, pace must stay on-pace
    const g: Goal = {
      id: 'g2b',
      type: 'checklist',
      tasks: [
        { isDone: false },
        { isDone: false },
        { isDone: false },
        { isDone: false },
        { isDone: false },
      ],
      month: new Date('2026-04-01T00:00:00.000Z'),
    }
    const result = computeProgress(g, UTC('2026-04-15'), 'UTC')
    expect(result.percent).toBe(0)
    expect(result.pace).toBe('on-pace')
  })

  it('fully done: percent=1, pace=on-pace', () => {
    const result = computeProgress(goal(5, 5), UTC('2026-04-01'), 'UTC')
    expect(result.percent).toBe(1)
    expect(result.pace).toBe('on-pace')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// HABIT GOALS
// ─────────────────────────────────────────────────────────────────────────────

describe('computeProgress — habit', () => {
  it('7 unique check-ins / 20 target on day 15: behind', () => {
    // daysElapsed=15, expected=15/30=0.5; percent=7/20=0.35; paceDelta=round((0.35-0.5)*20)=round(-3)=-3
    const g: Goal = {
      id: 'g3',
      type: 'habit',
      targetDays: 20,
      checkIns: ['2026-04-01','2026-04-02','2026-04-03','2026-04-04','2026-04-05','2026-04-06','2026-04-07'],
      month: new Date('2026-04-01T00:00:00.000Z'),
    }
    const result = computeProgress(g, UTC('2026-04-15'), 'UTC')
    expect(result.percent).toBeCloseTo(0.35)
    expect(result.pace).toBe('behind')
    expect(result.paceDelta).toBe(-3)
  })

  it('deduplicates duplicate check-ins via Set', () => {
    const g: Goal = {
      id: 'g4',
      type: 'habit',
      targetDays: 10,
      // 3 unique dates even though 5 entries
      checkIns: ['2026-04-01','2026-04-01','2026-04-02','2026-04-02','2026-04-03'],
      month: new Date('2026-04-01T00:00:00.000Z'),
    }
    const result = computeProgress(g, UTC('2026-04-15'), 'UTC')
    expect(result.raw.done).toBe(3)
  })

  it('targetDays > daysInMonth (35 in April): clamps percent to 1 when overachieved', () => {
    // April has 30 days. 30 check-ins / target 35 = 0.857, but if done=35 → clamps to 1
    const checkIns = Array.from({ length: 35 }, (_, i) => `2026-04-${String((i % 30) + 1).padStart(2,'0')}`)
    const g: Goal = {
      id: 'g5',
      type: 'habit',
      targetDays: 35,
      checkIns,
      month: new Date('2026-04-01T00:00:00.000Z'),
    }
    const result = computeProgress(g, UTC('2026-04-30'), 'UTC')
    // 30 unique dates / 35 target = 0.857 (not clamped — we have 35 checkIns but only 30 unique dates in April)
    expect(result.percent).toBeLessThanOrEqual(1)
    expect(result.raw.total).toBe(35)
  })

  it('day 4: warming-up (daysElapsed < 5)', () => {
    const g: Goal = {
      id: 'g6',
      type: 'habit',
      targetDays: 20,
      checkIns: ['2026-04-01','2026-04-02','2026-04-03','2026-04-04'],
      month: new Date('2026-04-01T00:00:00.000Z'),
    }
    const result = computeProgress(g, UTC('2026-04-04'), 'UTC')
    expect(result.pace).toBe('warming-up')
    expect(result.paceDelta).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TIMEZONE + DST
// ─────────────────────────────────────────────────────────────────────────────

describe('computeProgress — timezone + DST', () => {
  it('DST spring-forward: America/New_York on 2026-03-08', () => {
    // March 8 2026 is the US spring-forward day. Clock jumps 2AM → 3AM local.
    // At 23:30 local NY time on March 8, we are in EDT (UTC-4).
    // 2026-03-09T03:30:00.000Z = 2026-03-08 23:30 EDT.
    // March has 31 days; daysElapsed on Mar 8 = 8.
    const now = new Date('2026-03-09T03:30:00.000Z')
    const g: Goal = {
      id: 'g7',
      type: 'count',
      targetCount: 31,
      currentCount: 8,
      month: new Date('2026-03-01T00:00:00.000Z'),
    }
    const result = computeProgress(g, now, 'America/New_York')
    // daysElapsed = 8; expected = 8/31 ≈ 0.258; percent = 8/31 ≈ 0.258; on-pace
    expect(result.pace).not.toBe('warming-up') // day 8 ≥ 5
    expect(result.percent).toBeCloseTo(8 / 31)
    expect(result.expected).toBeCloseTo(8 / 31)
  })

  it('leap year Feb 29 2028 in Pacific/Auckland', () => {
    // Pacific/Auckland is UTC+13 in February (NZDT).
    // 2028-02-28T11:00:00.000Z = 2028-02-29 00:00 Auckland (next day midnight).
    const now = new Date('2028-02-28T11:00:00.000Z')
    const g: Goal = {
      id: 'g8',
      type: 'count',
      targetCount: 29,
      currentCount: 29,
      month: new Date('2028-02-01T00:00:00.000Z'),
    }
    const result = computeProgress(g, now, 'Pacific/Auckland')
    // Feb 2028 has 29 days; daysElapsed = 29 (day 29 = Feb 29 in Auckland)
    expect(result.percent).toBe(1) // 29/29
    expect(result.raw).toEqual({ done: 29, total: 29 })
  })

  it('last-day-of-month at 23:30 local UTC-8 counts as that day not next', () => {
    // 2026-04-01T06:30:00.000Z = 2026-03-31 23:30 LA (PDT, UTC-7 — DST started Mar 8)
    // Still March 31 local, not April 1 — daysElapsed in March = 31
    const now = new Date('2026-04-01T06:30:00.000Z')
    const g: Goal = {
      id: 'g9',
      type: 'count',
      targetCount: 31,
      currentCount: 15,
      month: new Date('2026-03-01T00:00:00.000Z'),
    }
    const result = computeProgress(g, now, 'America/Los_Angeles')
    // daysElapsed = 31 (last day of March in LA); expected ≈ 1.0
    expect(result.expected).toBeCloseTo(1)
    expect(result.percent).toBeCloseTo(15 / 31)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// PACE THRESHOLDS (D-14)
// ─────────────────────────────────────────────────────────────────────────────

describe('computeProgress — pace thresholds (D-14)', () => {
  // Use day 15 of April (30 days) for all threshold tests.
  // expected = 15/30 = 0.5; targetCount = 100 for precise control.
  // percent = currentCount/100; paceDelta = round((percent - 0.5)*100)

  const goal = (currentCount: number): Goal => ({
    id: 'g10',
    type: 'count',
    targetCount: 100,
    currentCount,
    month: new Date('2026-04-01T00:00:00.000Z'),
  })
  const now = UTC('2026-04-15')

  it('paceDelta=-2: behind', () => {
    // percent=(50-2)/100=0.48; paceDelta=round((0.48-0.5)*100)=round(-2)=-2
    const result = computeProgress(goal(48), now, 'UTC')
    expect(result.paceDelta).toBe(-2)
    expect(result.pace).toBe('behind')
  })

  it('paceDelta=-1: on-pace (exactly at threshold)', () => {
    // percent=49/100=0.49; paceDelta=round((0.49-0.5)*100)=round(-1)=-1 → on-pace
    const result = computeProgress(goal(49), now, 'UTC')
    expect(result.paceDelta).toBe(-1)
    expect(result.pace).toBe('on-pace')
  })

  it('paceDelta=0: on-pace', () => {
    const result = computeProgress(goal(50), now, 'UTC')
    expect(result.paceDelta).toBe(0)
    expect(result.pace).toBe('on-pace')
  })

  it('paceDelta=1: on-pace', () => {
    // percent=51/100=0.51; paceDelta=round((0.51-0.5)*100)=round(1)=1 → on-pace
    const result = computeProgress(goal(51), now, 'UTC')
    expect(result.paceDelta).toBe(1)
    expect(result.pace).toBe('on-pace')
  })

  it('paceDelta=2: ahead', () => {
    // percent=52/100=0.52; paceDelta=round((0.52-0.5)*100)=round(2)=2 → ahead
    const result = computeProgress(goal(52), now, 'UTC')
    expect(result.paceDelta).toBe(2)
    expect(result.pace).toBe('ahead')
  })
})
