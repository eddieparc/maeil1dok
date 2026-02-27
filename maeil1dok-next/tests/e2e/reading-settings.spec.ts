import { test, expect } from '@playwright/test'

test.describe('Reading settings panel', () => {
  test('bible page shows error when unauthenticated', async ({ page }) => {
    await page.goto('/bible?book=GEN&chapter=1&version=GAE')
    // Auth error triggers error boundary
    await expect(page.locator('text=오류가 발생했습니다')).toBeVisible()
  })

  test('reading settings button is not accessible without auth', async ({ page }) => {
    await page.goto('/bible?book=GEN&chapter=1&version=GAE')
    await expect(page.locator('text=오류가 발생했습니다')).toBeVisible()

    // Reading settings gear button should not be present on error page
    await expect(page.locator('[aria-label="읽기 설정 열기"]')).not.toBeVisible()
  })

  test('reading settings panel is not visible without auth', async ({ page }) => {
    await page.goto('/bible?book=GEN&chapter=1&version=GAE')
    await expect(page.locator('text=오류가 발생했습니다')).toBeVisible()

    // Settings panel content should not be visible
    await expect(page.locator('text=읽기 설정')).not.toBeVisible()
    await expect(page.locator('text=글꼴')).not.toBeVisible()
    await expect(page.locator('text=테마')).not.toBeVisible()
  })
})
