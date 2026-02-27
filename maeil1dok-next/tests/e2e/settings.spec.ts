import { test, expect } from '@playwright/test'

test.describe('Settings page', () => {
  test('shows error page when unauthenticated', async ({ page }) => {
    await page.goto('/settings')
    // Auth error triggers error boundary instead of redirect
    await expect(page.locator('text=오류가 발생했습니다')).toBeVisible()
  })

  test('does not render settings content when unauthenticated', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.locator('text=오류가 발생했습니다')).toBeVisible()

    // Settings-specific elements should not be present
    await expect(page.locator('text=계정 설정')).not.toBeVisible()
    await expect(page.locator('text=프로필')).not.toBeVisible()
    await expect(page.locator('text=보안')).not.toBeVisible()
  })

  test('error page has retry button', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible()
  })
})
