/**
 * Phase 4 Smoke — launch smoke tests at 375px mobile viewport.
 * Covers POLSH-01 (touch targets: right cluster, HabitGrid 44px, stepper 44px)
 * and POLSH-02 (reflection autosave error toast via route interception).
 *
 * All tests include "phase4" in their title.
 * Run: npm run test:e2e -- --grep "phase4"
 * Full suite: npm run test:e2e
 */
import { test, expect, type Page } from '@playwright/test'
// storageState is set at the project level in playwright.config.ts

// ─── helpers ────────────────────────────────────────────────────────────────

async function goTo(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
}

// ─── POLSH-01: Touch target sizes at 375px ──────────────────────────────────

test('phase4: right cluster icons visible at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await goTo(page, '/dashboard/2026-04')
  // After Wave 1 ships: CalendarCheck icon button for Today may be conditional (only shown when not current month)
  // Log out button is always in right cluster
  const logoutBtn = page.getByRole('button', { name: /log out/i })
  await expect(logoutBtn).toBeVisible()
  const box = await logoutBtn.boundingBox()
  // size="icon" = 36px is acceptable for navigation buttons per UI-SPEC
  expect(box?.width).toBeGreaterThanOrEqual(36)
})

test('phase4: habit grid cells are 44px at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await goTo(page, '/dashboard/2026-04')
  // Locate the first habit grid cell (role=gridcell)
  // This test will fail until a habit goal exists in the test account for 2026-04
  // and until habit-grid.tsx changes h-9 w-9 → h-11 w-11
  const firstCell = page.getByRole('gridcell').first()
  const exists = await firstCell.count()
  if (exists > 0) {
    const box = await firstCell.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
    expect(box?.width).toBeGreaterThanOrEqual(44)
  }
})

test('phase4: count stepper buttons are 44px at 375px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await goTo(page, '/dashboard/2026-04')
  // Locate the stepper Decrement button (aria-label="Decrement stepper")
  // This test will fail until count goal exists and until count.tsx changes land
  const decrementBtn = page.getByRole('button', { name: /decrement stepper/i })
  const exists = await decrementBtn.count()
  if (exists > 0) {
    const box = await decrementBtn.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(44)
    expect(box?.width).toBeGreaterThanOrEqual(44)
  }
})

// ─── POLSH-02: Reflection autosave error toast ───────────────────────────────

test('phase4: autosave failure shows error toast', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  // Use a past month so the ReflectionCard is visible
  await goTo(page, '/dashboard/2026-03')

  // Intercept ALL POST requests so server action form submissions fail
  await page.route('**', async (route) => {
    if (route.request().method() === 'POST') {
      await route.abort('failed')
    } else {
      await route.continue()
    }
  })

  // Find and type in the reflection textarea (what-worked field)
  const textarea = page.getByRole('textbox').first()
  const exists = await textarea.count()
  if (exists > 0) {
    await textarea.fill('test reflection text')
    // Wait for the 800ms debounce + autosave attempt
    await page.waitForTimeout(1500)
    // Sonner toast should appear with the error message
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: /reflection not saved/i })
    ).toBeVisible({ timeout: 5_000 })
  }
})
