import { test, expect } from '@playwright/test'

test.describe('Avatar display', () => {
  test('profile page shows error when unauthenticated', async ({ page }) => {
    await page.goto('/profile/test-user-id')
    // Auth error triggers error boundary
    await expect(page.locator('text=오류가 발생했습니다')).toBeVisible()
  })

  test('avatar is not visible when unauthenticated', async ({ page }) => {
    await page.goto('/profile/test-user-id')
    await expect(page.locator('text=오류가 발생했습니다')).toBeVisible()

    // Profile avatar should not be present on error page
    await expect(page.getByTestId('profile-header')).not.toBeVisible()
    await expect(page.getByTestId('profile-nickname')).not.toBeVisible()
  })

  test('header profile button not visible when unauthenticated', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.locator('text=오류가 발생했습니다')).toBeVisible()

    // Header avatar (profile button) should not be visible on error page
    await expect(page.getByTestId('profile-button')).not.toBeVisible()
    await expect(page.getByTestId('profile-dropdown')).not.toBeVisible()
  })
})
