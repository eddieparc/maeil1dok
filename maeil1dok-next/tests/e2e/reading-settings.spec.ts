import { test, expect, type Page } from '@playwright/test'

const bibleUrl = '/bible?book=GEN&chapter=1&version=GAE'

async function expectLoginScreen(page: Page) {
  await expect(page.getByRole('button', { name: '카카오로 시작하기' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '이메일 또는 아이디' })).toBeVisible()
}

test.describe('Reading settings panel', () => {
  test('bible page shows login screen when unauthenticated', async ({ page }) => {
    await page.goto(bibleUrl)
    await expectLoginScreen(page)
  })

  test('reading settings button is not accessible without auth', async ({ page }) => {
    await page.goto(bibleUrl)
    await expectLoginScreen(page)

    await expect(page.locator('[aria-label="읽기 설정 열기"]')).not.toBeVisible()
  })

  test('reading settings panel is not visible without auth', async ({ page }) => {
    await page.goto(bibleUrl)
    await expectLoginScreen(page)

    await expect(page.locator('text=읽기 설정')).not.toBeVisible()
    await expect(page.locator('text=글꼴')).not.toBeVisible()
    await expect(page.locator('text=테마')).not.toBeVisible()
  })
})
