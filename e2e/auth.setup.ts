/**
 * Auth setup: logs in once and saves the session to a storage file.
 * All UAT tests depend on this so they don't each repeat the login flow.
 */
import { test as setup, expect } from '@playwright/test'
import path from 'path'

export const STORAGE_STATE = path.join(__dirname, '.auth/session.json')

const EMAIL = process.env.E2E_EMAIL ?? 'FILL_IN_YOUR_EMAIL'
const PASSWORD = process.env.E2E_PASSWORD ?? 'FILL_IN_YOUR_PASSWORD'

setup('authenticate', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in|log in|continue/i }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
  await page.context().storageState({ path: STORAGE_STATE })
})
