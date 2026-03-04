import { test, expect } from '@playwright/test'

test.describe('Toast System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001/test')
  })

  test('should show success toast with green styling', async ({ page }) => {
    // Click the success button
    await page.click('[data-testid="btn-success"]')

    // Wait for toast to appear
    const toast = page.locator('div[role="alert"]').first()
    await expect(toast).toBeVisible()

    // Take screenshot
    await page.screenshot({ path: '.sisyphus/evidence/task-7-toast.png' })

    // Verify green styling (success color: #059669)
    const bgColor = await toast.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    expect(bgColor).toContain('rgb(5, 150, 105)') // #059669 in RGB

    // Verify message
    await expect(toast).toContainText('Test success toast')

    // Wait for auto-dismiss (3 seconds + animation)
    await page.waitForTimeout(3500)

    // Verify toast is removed from DOM
    await expect(toast).not.toBeVisible()
  })

  test('should show error toast with red styling', async ({ page }) => {
    await page.click('[data-testid="btn-error"]')

    const toast = page.locator('div[role="alert"]').first()
    await expect(toast).toBeVisible()

    // Verify red styling (error color: #dc2626)
    const bgColor = await toast.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    expect(bgColor).toContain('rgb(220, 38, 38)') // #dc2626 in RGB

    await expect(toast).toContainText('Test error toast')
  })

  test('should show warning toast with orange styling', async ({ page }) => {
    await page.click('[data-testid="btn-warning"]')

    const toast = page.locator('div[role="alert"]').first()
    await expect(toast).toBeVisible()

    // Verify orange styling (warning color: #d97706)
    const bgColor = await toast.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    expect(bgColor).toContain('rgb(217, 119, 6)') // #d97706 in RGB

    await expect(toast).toContainText('Test warning toast')
  })

  test('should show info toast with blue styling', async ({ page }) => {
    await page.click('[data-testid="btn-info"]')

    const toast = page.locator('div[role="alert"]').first()
    await expect(toast).toBeVisible()

    // Verify blue styling (info color: #2563eb)
    const bgColor = await toast.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    expect(bgColor).toContain('rgb(37, 99, 235)') // #2563eb in RGB

    await expect(toast).toContainText('Test info toast')
  })

  test('should dismiss toast when close button is clicked', async ({ page }) => {
    await page.click('[data-testid="btn-success"]')

    const toast = page.locator('div[role="alert"]').first()
    await expect(toast).toBeVisible()

    // Click close button
    const closeButton = toast.locator('button').last()
    await closeButton.click()

    // Wait for animation
    await page.waitForTimeout(300)

    // Verify toast is removed
    await expect(toast).not.toBeVisible()
  })
})
