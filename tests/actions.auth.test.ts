/**
 * Shape/contract tests for src/server/actions/auth.ts.
 *
 * We cannot easily unit-test the Supabase calls themselves without mocking
 * cookies() from next/headers (which requires a Next runtime). Instead we
 * assert that the module exports the five expected actions with the right
 * arity, and that each input-validating action rejects malformed input with
 * the correct error string before touching Supabase.
 *
 * Integration/end-to-end coverage for the real auth flow lands in Plan 01-05
 * (form → action → Supabase) and Phase 2 seed scripts.
 */

import { describe, it, expect, vi } from "vitest"

// next/headers cookies() throws outside a request scope. Mock it so the
// module under test can be imported and the safeParse-reject branches execute
// before we ever call the real supabase client.
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: () => {},
  }),
}))

// Stub redirect() so it's observable. Inside a Server Action Next wraps this
// in a thrown sentinel; in our test we just record the call.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`)
  }),
}))

describe("src/server/actions/auth.ts module exports", () => {
  it("exports all five server actions", async () => {
    const mod = await import("../src/server/actions/auth")
    expect(typeof mod.signUpAction).toBe("function")
    expect(typeof mod.signInAction).toBe("function")
    expect(typeof mod.signOutAction).toBe("function")
    expect(typeof mod.requestPasswordResetAction).toBe("function")
    expect(typeof mod.updatePasswordAction).toBe("function")
  })
})

describe("signUpAction Zod rejection", () => {
  it("rejects malformed input before touching Supabase", async () => {
    const { signUpAction } = await import("../src/server/actions/auth")
    const result = await signUpAction({
      email: "not-an-email",
      password: "short",
      confirmPassword: "short",
      timezone: "UTC",
    })
    expect(result.error).toBeDefined()
  })
})

describe("requestPasswordResetAction Zod rejection", () => {
  it("rejects malformed email with exact UI-SPEC copy", async () => {
    const { requestPasswordResetAction } = await import(
      "../src/server/actions/auth"
    )
    const result = await requestPasswordResetAction({ email: "nope" })
    expect(result.error).toBe("Enter a valid email address")
  })
})

describe("updatePasswordAction Zod rejection", () => {
  it("rejects mismatched confirmPassword before touching Supabase", async () => {
    const { updatePasswordAction } = await import(
      "../src/server/actions/auth"
    )
    const result = await updatePasswordAction({
      password: "hunter2hunter2",
      confirmPassword: "different!",
    })
    expect(result.error).toBeDefined()
  })
})
