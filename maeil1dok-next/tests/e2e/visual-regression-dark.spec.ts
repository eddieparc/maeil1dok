import { expect, test, type Page } from '@playwright/test'

const DARK_SCREENSHOT_OPTIONS = {
  fullPage: false,
  threshold: 0.2,
  maxDiffPixels: 250,
} as const

async function captureDarkScreenshot(page: Page, route: string, snapshotName: string) {
  await page.goto(route)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)

  expect(await page.evaluate(() => window.matchMedia('(prefers-color-scheme: dark)').matches)).toBeTruthy()

  const [htmlBackground, bodyBackground] = await Promise.all([
    page.locator('html').evaluate(el => window.getComputedStyle(el).backgroundColor),
    page.locator('body').evaluate(el => window.getComputedStyle(el).backgroundColor),
  ])

  expect(htmlBackground).not.toBe('rgb(255, 255, 255)')
  expect(bodyBackground).not.toBe('rgb(255, 255, 255)')

  await expect(page).toHaveScreenshot(snapshotName, DARK_SCREENSHOT_OPTIONS)
}

test.describe('Visual Regression - Dark Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.setViewportSize({ width: 1280, height: 720 })
  })

  test('home dark', async ({ page }) => {
    await captureDarkScreenshot(page, '/', 'home-dark.png')
  })

  test('plan dark', async ({ page }) => {
    await captureDarkScreenshot(page, '/plan', 'plan-dark.png')
  })

  test('plans dark', async ({ page }) => {
    await captureDarkScreenshot(page, '/plans', 'plans-dark.png')
  })

  test('calendar dark', async ({ page }) => {
    await captureDarkScreenshot(page, '/calendar', 'calendar-dark.png')
  })

  test('bible dark', async ({ page }) => {
    await captureDarkScreenshot(page, '/bible?book=GEN&chapter=1&version=GAE', 'bible-dark.png')
  })

  test('catchup dark', async ({ page }) => {
    await captureDarkScreenshot(page, '/catchup', 'catchup-dark.png')
  })

  test('hasena dark', async ({ page }) => {
    await captureDarkScreenshot(page, '/hasena', 'hasena-dark.png')
  })

  test('settings dark', async ({ page }) => {
    await captureDarkScreenshot(page, '/settings', 'settings-dark.png')
  })

  test('profile dark', async ({ page }) => {
    await captureDarkScreenshot(page, '/profile/test-user-id', 'profile-dark.png')
  })

  test('reading dark', async ({ page }) => {
    await captureDarkScreenshot(page, '/reading', 'reading-dark.png')
  })

  test('intro dark', async ({ page }) => {
    await captureDarkScreenshot(page, '/intro', 'intro-dark.png')
  })

  test('login dark', async ({ page }) => {
    await captureDarkScreenshot(page, '/login', 'login-dark.png')
  })
})
