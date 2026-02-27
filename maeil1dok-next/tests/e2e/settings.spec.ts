import { test, expect } from '@playwright/test'

test.describe('Settings page', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForURL(/\/login/)
    await expect(page).toHaveURL(/\/login/)
  })

  test('does not render settings content when unauthenticated', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForURL(/\/login/)

    // Settings-specific elements should not be present after redirect
    await expect(page.locator('text=계정 설정')).not.toBeVisible()
    await expect(page.locator('text=프로필')).not.toBeVisible()
    await expect(page.locator('text=보안')).not.toBeVisible()
    await expect(page.locator('text=알림')).not.toBeVisible()
  })
})
