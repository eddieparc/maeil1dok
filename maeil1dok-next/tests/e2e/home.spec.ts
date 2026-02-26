import { test, expect } from '@playwright/test'

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('renders hero section', async ({ page }) => {
    const hero = page.getByTestId('home-hero')
    await expect(hero).toBeVisible()
  })

  test('renders reading card stack', async ({ page }) => {
    const cardStack = page.getByTestId('reading-card-stack')
    await expect(cardStack).toBeVisible()
  })

  test('renders QuickAccessGrid with "Explore" heading', async ({ page }) => {
    const grid = page.getByTestId('quick-access-grid')
    await expect(grid).toBeVisible()
    await expect(grid.getByText('Explore')).toBeVisible()
  })

  test('"통독표" card links to /plan', async ({ page }) => {
    const planCard = page.getByTestId('card-plan')
    await expect(planCard).toBeVisible()
    await expect(planCard).toHaveAttribute('href', '/plan')
    await expect(planCard.getByText('통독표')).toBeVisible()
  })

  test('"플랜 관리" card links to /plans', async ({ page }) => {
    const plansCard = page.getByTestId('card-plans')
    await expect(plansCard).toBeVisible()
    await expect(plansCard).toHaveAttribute('href', '/plans')
    await expect(plansCard.getByText('플랜 관리')).toBeVisible()
  })

  test('disabled cards show "준비 중" badge', async ({ page }) => {
    // "개론 영상", "하세나하시조", "커뮤니티", "내 활동" are disabled
    const introCard = page.getByTestId('card-intro')
    await expect(introCard).toBeVisible()
    await expect(introCard.getByText('준비 중')).toBeVisible()
  })

  test('reading card stack shows a card based on auth state', async ({ page }) => {
    // Without auth, should show login card or main card
    const cardStack = page.getByTestId('reading-card-stack')
    // At least one card should be visible
    const cards = cardStack.locator('[data-testid$="-card"]')
    await expect(cards.first()).toBeVisible()
  })
})
