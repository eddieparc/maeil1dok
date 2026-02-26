import { test, expect } from '@playwright/test'

test.describe('Bible page', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/bible')
    await page.waitForURL(/\/login/)
    await expect(page).toHaveURL(/\/login/)
  })

  test('redirects even with query params', async ({ page }) => {
    await page.goto('/bible?book=gen&chapter=1&version=GAE')
    await page.waitForURL(/\/login/)
    await expect(page).toHaveURL(/\/login/)
  })

  test('does not render bible content when unauthenticated', async ({ page }) => {
    await page.goto('/bible')
    await page.waitForURL(/\/login/)

    // Bible-specific elements should not be present after redirect
    await expect(page.getByTestId('verse-action-menu')).not.toBeVisible()
  })
})
