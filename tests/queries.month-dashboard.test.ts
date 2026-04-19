import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

describe('getMonthDashboard SQL budget (PITFALLS §3)', () => {
  const src = readFileSync(resolve(__dirname, '../src/server/db/queries.ts'), 'utf8')

  it('function is exported', () => {
    expect(src).toMatch(/export async function getMonthDashboard/)
  })

  it('uses a single db.select call (one round-trip)', () => {
    const matches = src.match(/\bdb\.select\(/g) ?? []
    expect(matches.length).toBe(1)
  })

  it('uses json_agg for tasks aggregation', () => {
    expect(src).toMatch(/json_agg/)
  })

  it('uses array_agg for habit check-ins', () => {
    expect(src).toMatch(/array_agg\(h\.check_in_date/)
  })

  it('orders by position ASC, created_at ASC (D-26)', () => {
    expect(src).toMatch(/asc\(goals\.position\)/)
    expect(src).toMatch(/asc\(goals\.createdAt\)/)
  })

  it('scopes query by userId AND month', () => {
    expect(src).toMatch(/eq\(goals\.userId,\s*userId\)/)
    expect(src).toMatch(/eq\(goals\.month,/)
  })

  it('emitted query body ≤ 30 non-blank SQL-relevant lines', () => {
    // Count raw lines inside the select() call block — a proxy for SQL complexity budget
    const selectBlock = src.match(/db\s*\.select\(\{[\s\S]*?\}\)[\s\S]*?orderBy\([^)]+\)/m)
    expect(selectBlock).not.toBeNull()
    const lineCount = selectBlock![0].split('\n').filter(l => l.trim().length > 0 && !l.trim().startsWith('//')).length
    expect(lineCount).toBeLessThanOrEqual(30)
  })
})
