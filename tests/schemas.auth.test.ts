import { describe, it, expect } from "vitest"
import {
  signUpSchema,
  signInSchema,
  resetRequestSchema,
  updatePasswordSchema,
} from "../src/lib/schemas/auth"

describe("signUpSchema", () => {
  it("accepts valid signup input", () => {
    const result = signUpSchema.safeParse({
      email: "user@example.com",
      password: "hunter2hunter2",
      confirmPassword: "hunter2hunter2",
      timezone: "America/Los_Angeles",
    })
    expect(result.success).toBe(true)
  })

  it("defaults timezone to UTC when omitted", () => {
    const result = signUpSchema.safeParse({
      email: "user@example.com",
      password: "hunter2hunter2",
      confirmPassword: "hunter2hunter2",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.timezone).toBe("UTC")
    }
  })

  it("rejects invalid email with exact UI-SPEC copy", () => {
    const result = signUpSchema.safeParse({
      email: "not-an-email",
      password: "hunter2hunter2",
      confirmPassword: "hunter2hunter2",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path[0] === "email")?.message
      expect(msg).toBe("Enter a valid email address")
    }
  })

  it("rejects password shorter than 8 with exact UI-SPEC copy", () => {
    const result = signUpSchema.safeParse({
      email: "user@example.com",
      password: "short",
      confirmPassword: "short",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path[0] === "password")?.message
      expect(msg).toBe("Password must be at least 8 characters")
    }
  })

  it("rejects mismatched confirmPassword with exact UI-SPEC copy", () => {
    const result = signUpSchema.safeParse({
      email: "user@example.com",
      password: "hunter2hunter2",
      confirmPassword: "different!",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msg = result.error.issues.find(
        (i) => i.path[0] === "confirmPassword",
      )?.message
      expect(msg).toBe("Passwords do not match")
    }
  })
})

describe("signInSchema", () => {
  it("accepts any non-empty password", () => {
    const result = signInSchema.safeParse({
      email: "user@example.com",
      password: "x",
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid email with exact UI-SPEC copy", () => {
    const result = signInSchema.safeParse({
      email: "nope",
      password: "anything",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path[0] === "email")?.message
      expect(msg).toBe("Enter a valid email address")
    }
  })

  it("rejects empty password with exact UI-SPEC copy", () => {
    const result = signInSchema.safeParse({
      email: "user@example.com",
      password: "",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path[0] === "password")?.message
      expect(msg).toBe("Enter your password")
    }
  })
})

describe("resetRequestSchema", () => {
  it("accepts valid email", () => {
    const result = resetRequestSchema.safeParse({ email: "user@example.com" })
    expect(result.success).toBe(true)
  })

  it("rejects invalid email with exact UI-SPEC copy", () => {
    const result = resetRequestSchema.safeParse({ email: "bad" })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path[0] === "email")?.message
      expect(msg).toBe("Enter a valid email address")
    }
  })
})

describe("updatePasswordSchema", () => {
  it("accepts matched passwords >= 8 chars", () => {
    const result = updatePasswordSchema.safeParse({
      password: "hunter2hunter2",
      confirmPassword: "hunter2hunter2",
    })
    expect(result.success).toBe(true)
  })

  it("rejects password shorter than 8 with exact UI-SPEC copy", () => {
    const result = updatePasswordSchema.safeParse({
      password: "short",
      confirmPassword: "short",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msg = result.error.issues.find((i) => i.path[0] === "password")?.message
      expect(msg).toBe("Password must be at least 8 characters")
    }
  })

  it("rejects mismatched confirmPassword with exact UI-SPEC copy", () => {
    const result = updatePasswordSchema.safeParse({
      password: "hunter2hunter2",
      confirmPassword: "hunter2different",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msg = result.error.issues.find(
        (i) => i.path[0] === "confirmPassword",
      )?.message
      expect(msg).toBe("Passwords do not match")
    }
  })
})
