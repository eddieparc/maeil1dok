import { test, expect } from '@playwright/test'

test.describe('Legal Pages', () => {
  test('terms page accessible without auth', async ({ page }) => {
    await page.goto('/terms')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('h1')).toContainText('이용약관')
    await expect(page.locator('body')).toContainText('서비스 이용약관')
  })

  test('terms page shows effective date', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.locator('body')).toContainText('2025년 1월 1일')
  })

  test('terms page shows all sections', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.locator('body')).toContainText('제1조 (목적)')
    await expect(page.locator('body')).toContainText('제2조 (정의)')
    await expect(page.locator('body')).toContainText('제10조 (고객센터)')
    await expect(page.locator('body')).toContainText('support@maeil1dok.app')
  })

  test('privacy page accessible without auth', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('h1')).toContainText('개인정보처리방침')
    await expect(page.locator('body')).toContainText('개인정보 처리방침')
  })

  test('privacy page shows all sections', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.locator('body')).toContainText('1. 개인정보의 처리 목적')
    await expect(page.locator('body')).toContainText('11. 개인정보 처리방침 변경')
    await expect(page.locator('body')).toContainText('2025년 1월 1일')
  })

  test('company page accessible without auth', async ({ page }) => {
    await page.goto('/company')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.locator('h1')).toContainText('회사정보')
    await expect(page.locator('body')).toContainText('제이지피랩스')
  })

  test('company page shows business details', async ({ page }) => {
    await page.goto('/company')
    await expect(page.locator('body')).toContainText('613-24-62749')
    await expect(page.locator('body')).toContainText('support@maeil1dok.app')
    await expect(page.locator('body')).toContainText('Vercel Inc.')
  })

  test('company page has business verification link', async ({ page }) => {
    await page.goto('/company')
    const verifyLink = page.locator('a[href*="ftc.go.kr"]')
    await expect(verifyLink).toBeVisible()
    await expect(verifyLink).toContainText('사업자정보확인')
  })
})
