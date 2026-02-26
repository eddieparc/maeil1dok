import { test, expect } from '@playwright/test'

test.describe('Intro page', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/intro')
    await page.waitForURL(/\/login/)
    await expect(page).toHaveURL(/\/login/)
  })

  test('does not show intro content when unauthenticated', async ({ page }) => {
    await page.goto('/intro')
    await page.waitForURL(/\/login/)

    // Intro page heading should not be present after redirect
    await expect(page.getByText('성경 개론')).not.toBeVisible()
  })
})
