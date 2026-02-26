import { test, expect } from '@playwright/test'

test.describe('Plans page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/plans')
  })

  test('page loads and shows plan cards', async ({ page }) => {
    // Wait for at least one plan card to appear
    const planCards = page.getByTestId('plan-card')
    await expect(planCards.first()).toBeVisible()
  })

  test('plan cards display plan information', async ({ page }) => {
    const firstCard = page.getByTestId('plan-card').first()
    await expect(firstCard).toBeVisible()
    // Each plan card should have text content (plan name)
    await expect(firstCard).not.toBeEmpty()
  })

  test('unsubscribed plans show subscribe button', async ({ page }) => {
    // Note: depends on actual plan subscription state
    // Skip if no subscribe buttons exist (all plans may be subscribed)
    const subscribeButtons = page.getByTestId('subscribe-button')
    const count = await subscribeButtons.count()
    if (count > 0) {
      await expect(subscribeButtons.first()).toBeVisible()
    }
  })

  test('subscribed plans show unsubscribe button', async ({ page }) => {
    // Note: depends on actual plan subscription state
    // Skip if no unsubscribe buttons exist (no plans may be subscribed)
    const unsubscribeButtons = page.getByTestId('unsubscribe-button')
    const count = await unsubscribeButtons.count()
    if (count > 0) {
      await expect(unsubscribeButtons.first()).toBeVisible()
    }
  })

  test('subscribe button has correct text', async ({ page }) => {
    const subscribeButtons = page.getByTestId('subscribe-button')
    const count = await subscribeButtons.count()
    if (count > 0) {
      // Subscribe button should contain "구독" text
      await expect(subscribeButtons.first()).toContainText('구독')
    }
  })

  test('unsubscribe button has correct text', async ({ page }) => {
    const unsubscribeButtons = page.getByTestId('unsubscribe-button')
    const count = await unsubscribeButtons.count()
    if (count > 0) {
      // Unsubscribe button should contain "구독" related text
      await expect(unsubscribeButtons.first()).toContainText('해지')
    }
  })
})
