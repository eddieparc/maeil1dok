import { test, expect } from '@playwright/test'

test.describe('Hasena page', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/hasena')
    await page.waitForURL(/\/login/)
    await expect(page).toHaveURL(/\/login/)
  })

  test('does not render hasena content when unauthenticated', async ({ page }) => {
    await page.goto('/hasena')
    await page.waitForURL(/\/login/)

    // Hasena-specific elements should not be present after redirect
    await expect(page.getByTestId('youtube-player')).not.toBeVisible()
    await expect(page.getByTestId('hasena-streak')).not.toBeVisible()
    await expect(page.getByTestId('hasena-complete-toggle')).not.toBeVisible()
  })
})
