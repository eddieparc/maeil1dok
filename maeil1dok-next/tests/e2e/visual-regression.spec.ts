import { expect, test, type Page } from '@playwright/test'

const screenshotOptions = {
  threshold: 0.1,
  maxDiffPixelRatio: 0.001,
  maxDiffPixels: 100,
  fullPage: true,
  animations: 'disabled' as const,
  caret: 'hide' as const
}

async function capturePage(page: Page, route: string, screenshotName: string) {
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(300)
  await expect(page).toHaveScreenshot(screenshotName, screenshotOptions)
}

test.describe('Visual Regression - Light Mode', () => {
  test.describe.configure({ mode: 'serial' })

  test.use({
    viewport: { width: 390, height: 844 },
    colorScheme: 'light'
  })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('theme', 'light')
      window.localStorage.setItem('resolvedTheme', 'light')
    })
  })

  test('home page', async ({ page }) => {
    await capturePage(page, '/', 'home-light.png')
  })

  test('calendar page', async ({ page }) => {
    await capturePage(page, '/calendar', 'calendar-light.png')
  })

  test('plan page', async ({ page }) => {
    await capturePage(page, '/plan', 'plan-light.png')
  })

  test('plans page', async ({ page }) => {
    await capturePage(page, '/plans', 'plans-light.png')
  })

  test('bible page', async ({ page }) => {
    await capturePage(page, '/bible', 'bible-light.png')
  })

  test('catchup page', async ({ page }) => {
    await capturePage(page, '/catchup', 'catchup-light.png')
  })

  test('hasena page', async ({ page }) => {
    await capturePage(page, '/hasena', 'hasena-light.png')
  })

  test('intro page', async ({ page }) => {
    await capturePage(page, '/intro', 'intro-light.png')
  })

  test('profile page', async ({ page }) => {
    await capturePage(page, '/profile/test-user-id', 'profile-light.png')
  })

  test('settings page', async ({ page }) => {
    await capturePage(page, '/settings', 'settings-light.png')
  })

  test('login page', async ({ page }) => {
    await capturePage(page, '/login', 'login-light.png')
  })
})
