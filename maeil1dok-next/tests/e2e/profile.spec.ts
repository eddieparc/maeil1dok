import { test, expect } from '@playwright/test'

test.describe('Profile page', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/profile/test-user-id')
    await page.waitForURL(/\/login/)
    await expect(page).toHaveURL(/\/login/)
  })

  test('does not render profile content when unauthenticated', async ({ page }) => {
    await page.goto('/profile/test-user-id')
    await page.waitForURL(/\/login/)

    // Profile-specific elements should not be present after redirect
    await expect(page.getByTestId('profile-header')).not.toBeVisible()
    await expect(page.getByTestId('profile-nickname')).not.toBeVisible()
    await expect(page.getByTestId('profile-stats')).not.toBeVisible()
  })

  test('redirects for arbitrary profile IDs', async ({ page }) => {
    await page.goto('/profile/00000000-0000-0000-0000-000000000000')
    await page.waitForURL(/\/login/)
    await expect(page).toHaveURL(/\/login/)
  })
})
