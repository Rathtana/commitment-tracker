---
status: partial
phase: 01-foundations-auth
source: [01-VERIFICATION.md]
started: 2026-04-18T00:00:00Z
updated: 2026-04-18T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. AUTH-05 async — 16-min reset token expiry
expected: The second reset email kicked off during Plan 01-05 UAT Scenario 5 should return "link expired or invalid" after 16 minutes. Verifies D-17 (Supabase dashboard token validity = 900s) was applied correctly.
result: [pending]

### 2. 01-REVIEW.md CR-01 triage — middleware drops refreshed cookies on redirect
expected: Decide whether CR-01 (`src/middleware.ts:58-76` — `NextResponse.redirect()` does not forward refreshed-token cookies) is fixed in a Phase 1 gap-closure plan before production deploy, or deferred to a tracked polish phase. Security-impacting but does not break a Phase 1 Success Criterion.
result: [pending]

### 3. 01-REVIEW.md CR-02 triage — /auth/callback open-redirect via `next` param
expected: Decide whether CR-02 (`src/app/auth/callback/route.ts:14-23` — unvalidated `next` param allows protocol-relative open-redirect) is fixed in a Phase 1 gap-closure plan before production deploy, or deferred to a tracked polish phase. Security-impacting but does not break a Phase 1 Success Criterion.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
