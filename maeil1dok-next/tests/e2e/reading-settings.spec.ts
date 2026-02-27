import { test, expect } from '@playwright/test'

test.describe('Reading settings panel', () => {
  test('bible page redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/bible?book=GEN&chapter=1&version=GAE')
    await page.waitForURL(/\/login/)
    await expect(page).toHaveURL(/\/login/)
  })

  test('reading settings button is not accessible without auth', async ({ page }) => {
    await page.goto('/bible?book=GEN&chapter=1&version=GAE')
    await page.waitForURL(/\/login/)

    // Reading settings gear button should not be present after redirect
    await expect(page.locator('[aria-label="읽기 설정 열기"]')).not.toBeVisible()
  })

  test('reading settings panel is not visible without auth', async ({ page }) => {
    await page.goto('/bible?book=GEN&chapter=1&version=GAE')
    await page.waitForURL(/\/login/)

    // Settings panel content should not be visible
    await expect(page.locator('text=읽기 설정')).not.toBeVisible()
    await expect(page.locator('text=글꼴')).not.toBeVisible()
    await expect(page.locator('text=테마')).not.toBeVisible()
  })
})
