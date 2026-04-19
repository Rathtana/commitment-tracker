/**
 * Shape/contract tests for Plan 01-05 auth UI components.
 *
 * Follows the pattern established in Plan 01-04: we can't meaningfully
 * unit-test React components without pulling in @testing-library/react +
 * a jsdom environment for every file. Instead, assert module shape — that
 * each expected component is exported and is a function (React component).
 *
 * Full render/interaction verification is done via the checkpoint:human-verify
 * gate in Task 3 (the manual UAT against the live Supabase dev project).
 */

import { describe, it, expect, vi } from "vitest"

// Mock server-only module boundaries so the form files (which import server
// actions) can be loaded in the test runner without a Next.js runtime.
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}))

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}))

vi.mock("@/server/actions/auth", () => ({
  signInAction: vi.fn(async () => ({})),
  signUpAction: vi.fn(async () => ({})),
  signOutAction: vi.fn(async () => undefined),
  requestPasswordResetAction: vi.fn(async () => ({})),
  updatePasswordAction: vi.fn(async () => ({})),
}))

describe("src/components/auth/password-input.tsx", () => {
  it("exports PasswordInput component", async () => {
    const mod = await import("../src/components/auth/password-input")
    expect(mod.PasswordInput).toBeDefined()
    // forwardRef returns an object with a $$typeof symbol, not a plain fn
    expect(typeof mod.PasswordInput).toBe("object")
  })
})

describe("src/components/auth/login-form.tsx", () => {
  it("exports LoginForm component", async () => {
    const mod = await import("../src/components/auth/login-form")
    expect(typeof mod.LoginForm).toBe("function")
  })
})

describe("src/components/auth/signup-form.tsx", () => {
  it("exports SignUpForm component", async () => {
    const mod = await import("../src/components/auth/signup-form")
    expect(typeof mod.SignUpForm).toBe("function")
  })
})

describe("src/components/auth/reset-password-form.tsx", () => {
  it("exports ResetPasswordForm component", async () => {
    const mod = await import("../src/components/auth/reset-password-form")
    expect(typeof mod.ResetPasswordForm).toBe("function")
  })
})

describe("src/components/auth/update-password-form.tsx", () => {
  it("exports UpdatePasswordForm component", async () => {
    const mod = await import("../src/components/auth/update-password-form")
    expect(typeof mod.UpdatePasswordForm).toBe("function")
  })
})
