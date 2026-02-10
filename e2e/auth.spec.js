/**
 * E2E: Auth flow
 *
 * Login → verify dashboard → logout → redirect to /login
 */

import { test, expect, loginViaUI, logoutViaUI, TEST_USER } from './fixtures.js'

test.describe('Auth flow', () => {
  test('login shows dashboard, then logout redirects to /login', async ({ page }) => {
    // 1. Navigate to login page
    await page.goto('/login')
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible()

    // 2. Login
    await loginViaUI(page)

    // 3. Dashboard is visible (greeting contains user name or generic text)
    await expect(page.locator('h1, h2').first()).toBeVisible()

    // 4. Verify we're on the dashboard
    await expect(page).toHaveURL('/')

    // 5. Logout
    await logoutViaUI(page)

    // 6. Should be back on login
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible()
  })

  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/login')

    await page.locator('[data-testid="login-identifier"]').fill('nonexistent_user')
    await page.locator('[data-testid="login-password"]').fill('wrong_password_123')
    await page.locator('[data-testid="login-submit"]').click()

    // Should stay on login page and show error
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible({ timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('unauthenticated access redirects to /login', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })
})
