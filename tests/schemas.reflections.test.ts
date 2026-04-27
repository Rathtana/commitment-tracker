import { describe, it, expect } from 'vitest'
import { upsertReflectionSchema, reflectionFormSchema } from '../src/lib/schemas/reflections'

describe('upsertReflectionSchema (server)', () => {
  it('accepts valid input with text in both fields', () => {
    const result = upsertReflectionSchema.safeParse({
      month: '2026-04-01',
      whatWorked: 'ok',
      whatDidnt: 'ok',
    })
    expect(result.success).toBe(true)
  })

  it('rejects bad month format', () => {
    const result = upsertReflectionSchema.safeParse({
      month: 'bad',
      whatWorked: null,
      whatDidnt: null,
    })
    expect(result.success).toBe(false)
  })

  it('rejects whatWorked over 280 characters', () => {
    const result = upsertReflectionSchema.safeParse({
      month: '2026-04-01',
      whatWorked: 'x'.repeat(281),
      whatDidnt: null,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path.includes('whatWorked'))?.message
      expect(msg).toBe("That's a bit long — try trimming it to under 280 characters.")
    }
  })

  it('accepts whatWorked at exactly 280 characters', () => {
    const result = upsertReflectionSchema.safeParse({
      month: '2026-04-01',
      whatWorked: 'x'.repeat(280),
      whatDidnt: null,
    })
    expect(result.success).toBe(true)
  })

  it('transforms empty string and whitespace-only to null (D-30)', () => {
    const result = upsertReflectionSchema.safeParse({
      month: '2026-04-01',
      whatWorked: '',
      whatDidnt: '   ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.whatWorked).toBe(null)
      expect(result.data.whatDidnt).toBe(null)
    }
  })

  it('transforms null inputs to null (passthrough)', () => {
    const result = upsertReflectionSchema.safeParse({
      month: '2026-04-01',
      whatWorked: null,
      whatDidnt: null,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.whatWorked).toBe(null)
      expect(result.data.whatDidnt).toBe(null)
    }
  })
})

describe('reflectionFormSchema (client)', () => {
  it('accepts empty strings (for counter display)', () => {
    const result = reflectionFormSchema.safeParse({ whatWorked: '', whatDidnt: '' })
    expect(result.success).toBe(true)
  })

  it('accepts strings at exactly 280 characters', () => {
    const result = reflectionFormSchema.safeParse({
      whatWorked: 'x'.repeat(280),
      whatDidnt: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejects strings over 280 characters with UI-SPEC error copy', () => {
    const result = reflectionFormSchema.safeParse({
      whatWorked: 'x'.repeat(281),
      whatDidnt: '',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path.includes('whatWorked'))?.message
      expect(msg).toBe("That's a bit long — try trimming it to under 280 characters.")
    }
  })
})
