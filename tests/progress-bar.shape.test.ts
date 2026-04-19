import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const src = readFileSync(resolve(__dirname, '../src/components/progress-bar.tsx'), 'utf8')

describe('progress-bar.tsx invariants (STATE.md research flag resolution)', () => {
  it('uses scaleX, not width', () => {
    expect(src).toMatch(/scaleX:\s*clamped/)
    expect(src).not.toMatch(/animate=\{\{\s*width:/)
  })
  it('uses origin-left (transform-origin)', () => {
    expect(src).toMatch(/origin-left/)
  })
  it('uses initial={false}', () => {
    expect(src).toMatch(/initial=\{false\}/)
  })
  it('calls useReducedMotion', () => {
    expect(src).toMatch(/useReducedMotion\(\)/)
  })
  it('sets willChange: transform', () => {
    expect(src).toMatch(/willChange:\s*['\"]transform['\"]/)
  })
  it('imports from motion/react (not framer-motion)', () => {
    expect(src).toMatch(/from\s+['\"]motion\/react['\"]/)
    expect(src).not.toMatch(/from\s+['\"]framer-motion['\"]/)
  })
  it('fill uses bg-primary (NEVER pace-driven color)', () => {
    expect(src).toMatch(/bg-primary/)
    expect(src).not.toMatch(/bg-(warning|success|destructive)/)
  })
  it('has role="progressbar" + aria-valuenow', () => {
    expect(src).toMatch(/role=['\"]progressbar['\"]/)
    expect(src).toMatch(/aria-valuenow/)
  })
})

const repoWide = require('child_process').execSync('grep -r "framer-motion" src/ || true').toString()
describe('repo-wide: no framer-motion imports', () => {
  it('no file imports from framer-motion', () => {
    expect(repoWide.trim()).toBe('')
  })
})
