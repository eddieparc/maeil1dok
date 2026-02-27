import { test, expect } from '@playwright/test'

test.describe('Avatar display', () => {
  test('profile page redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/profile/test-user-id')
    await page.waitForURL(/\/login/)
    await expect(page).toHaveURL(/\/login/)
  })

  test('avatar is not visible when unauthenticated', async ({ page }) => {
    await page.goto('/profile/test-user-id')
    await page.waitForURL(/\/login/)

    // Profile avatar should not be present after redirect
    await expect(page.getByTestId('profile-header')).not.toBeVisible()
  })

  test('header profile button not visible when unauthenticated', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForURL(/\/login/)

    // Header avatar (profile button) should not be visible on login page
    await expect(page.getByTestId('profile-button')).not.toBeVisible()
  })
})
