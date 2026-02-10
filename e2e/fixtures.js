/**
 * Shared Playwright fixtures and helpers for FreshTrack E2E tests.
 *
 * Environment variables:
 *   TEST_USER_EMAIL    – login/email of test user (default: admin)
 *   TEST_USER_PASSWORD – password              (default: admin123)
 *   TEST_ADMIN_EMAIL   – HOTEL_ADMIN user
 *   TEST_ADMIN_PASSWORD
 */

import { test as base, expect } from '@playwright/test'

// ─── Test credentials ────────────────────────────────────────────────────────

export const TEST_USER = {
  identifier: process.env.TEST_USER_EMAIL || 'admin',
  password: process.env.TEST_USER_PASSWORD || 'admin123'
}

export const TEST_ADMIN = {
  identifier: process.env.TEST_ADMIN_EMAIL || 'admin',
  password: process.env.TEST_ADMIN_PASSWORD || 'admin123'
}

// ─── Login helper ────────────────────────────────────────────────────────────

/**
 * Log in via the UI and wait for the dashboard to load.
 * Returns after navigation to '/'.
 */
export async function loginViaUI(page, { identifier, password } = TEST_USER) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  // Fill credentials
  const identifierInput = page.locator('[data-testid="login-identifier"]')
  const passwordInput = page.locator('[data-testid="login-password"]')

  await identifierInput.fill(identifier)
  await passwordInput.fill(password)

  // Submit
  await page.locator('[data-testid="login-submit"]').click()

  // Wait for dashboard (redirect to '/')
  await page.waitForURL('/', { timeout: 15_000 })
  await expect(page).toHaveURL('/')
}

/**
 * Log out via the header user menu.
 */
export async function logoutViaUI(page) {
  // Open user menu
  await page.locator('[data-testid="user-menu-button"]').click()
  // Click logout
  await page.locator('[data-testid="logout-button"]').click()
  // Wait for redirect to login
  await page.waitForURL(/\/login/, { timeout: 10_000 })
}

// ─── Extended test fixture with auto-login ───────────────────────────────────

export const test = base.extend({
  /** Authenticated page – logs in before each test, logs out after. */
  authedPage: async ({ page }, use) => {
    await loginViaUI(page)
    await use(page)
  }
})

export { expect }
