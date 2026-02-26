import { test, expect } from '@playwright/test'

test.describe('Catchup page', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/catchup')
    await page.waitForURL(/\/login/)
    await expect(page).toHaveURL(/\/login/)
  })

  test('does not render catchup content when unauthenticated', async ({ page }) => {
    await page.goto('/catchup')
    await page.waitForURL(/\/login/)

    // Catchup-specific elements should not be present after redirect
    await expect(page.getByTestId('catchup-progress-card')).not.toBeVisible()
    await expect(page.getByTestId('catchup-today-list')).not.toBeVisible()
  })
})
