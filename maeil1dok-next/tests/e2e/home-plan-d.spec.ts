import { test, expect } from '@playwright/test'

test.describe('Home page — Plan D features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('QuickAccessGrid contains all Plan D enabled cards', async ({ page }) => {
    const grid = page.getByTestId('quick-access-grid')
    await expect(grid).toBeVisible()

    // Plan D cards should be present and enabled
    await expect(page.getByTestId('card-hasena')).toBeVisible()
    await expect(page.getByTestId('card-intro')).toBeVisible()
    await expect(page.getByTestId('card-bible')).toBeVisible()
    await expect(page.getByTestId('card-catchup')).toBeVisible()
    await expect(page.getByTestId('card-profile')).toBeVisible()
  })

  test('Plan D cards link to correct routes', async ({ page }) => {
    await expect(page.getByTestId('card-hasena')).toHaveAttribute('href', '/hasena')
    await expect(page.getByTestId('card-intro')).toHaveAttribute('href', '/intro')
    await expect(page.getByTestId('card-bible')).toHaveAttribute('href', '/bible')
    await expect(page.getByTestId('card-catchup')).toHaveAttribute('href', '/catchup')
  })

  test('DailyStatus section is rendered', async ({ page }) => {
    const dailyStatus = page.getByTestId('daily-status')
    await expect(dailyStatus).toBeVisible()
  })
})
