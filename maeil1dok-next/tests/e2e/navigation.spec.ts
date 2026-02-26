import { test, expect } from '@playwright/test'

test.describe('FloatingNav', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('is visible on home page', async ({ page }) => {
    const nav = page.getByTestId('floating-nav')
    await expect(nav).toBeVisible()
  })

  test('contains all navigation tabs', async ({ page }) => {
    await expect(page.getByTestId('nav-home')).toBeVisible()
    await expect(page.getByTestId('nav-calendar')).toBeVisible()
    await expect(page.getByTestId('nav-schedule')).toBeVisible()
    await expect(page.getByTestId('nav-plans')).toBeVisible()
  })

  test('home tab links to /', async ({ page }) => {
    const homeLink = page.getByTestId('nav-home')
    await expect(homeLink).toHaveAttribute('href', '/')
  })

  test('calendar tab links to /calendar', async ({ page }) => {
    const calendarLink = page.getByTestId('nav-calendar')
    await expect(calendarLink).toHaveAttribute('href', '/calendar')
  })

  test('schedule tab links to /plan', async ({ page }) => {
    const scheduleLink = page.getByTestId('nav-schedule')
    await expect(scheduleLink).toHaveAttribute('href', '/plan')
  })

  test('plans tab links to /plans', async ({ page }) => {
    const plansLink = page.getByTestId('nav-plans')
    await expect(plansLink).toHaveAttribute('href', '/plans')
  })

  test('home tab is active on home page', async ({ page }) => {
    const homeLink = page.getByTestId('nav-home')
    // Active tab has indigo-600 background
    await expect(homeLink).toHaveClass(/bg-indigo-600/)
  })

  test('navigating to calendar activates calendar tab', async ({ page }) => {
    await page.getByTestId('nav-calendar').click()
    await page.waitForURL('/calendar')
    const calendarLink = page.getByTestId('nav-calendar')
    await expect(calendarLink).toHaveClass(/bg-indigo-600/)
  })
})

test.describe('Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('hamburger button opens menu', async ({ page }) => {
    const hamburger = page.getByTestId('hamburger-menu')
    await hamburger.click()

    const menuPanel = page.getByTestId('menu-panel')
    await expect(menuPanel).toBeVisible()
  })

  test('menu can be closed with ESC key', async ({ page }) => {
    // Open menu
    await page.getByTestId('hamburger-menu').click()
    await expect(page.getByTestId('menu-panel')).toBeVisible()

    // Press Escape
    await page.keyboard.press('Escape')

    // Menu panel should slide out (translate-x-full)
    const menuPanel = page.getByTestId('menu-panel')
    await expect(menuPanel).toHaveClass(/translate-x-full/)
  })

  test('menu can be closed by clicking overlay', async ({ page }) => {
    // Open menu
    await page.getByTestId('hamburger-menu').click()
    await expect(page.getByTestId('menu-panel')).toBeVisible()

    // Click overlay
    await page.getByTestId('menu-overlay').click()

    // Menu panel should slide out
    const menuPanel = page.getByTestId('menu-panel')
    await expect(menuPanel).toHaveClass(/translate-x-full/)
  })

  test('menu contains navigation links', async ({ page }) => {
    await page.getByTestId('hamburger-menu').click()

    const menuPanel = page.getByTestId('menu-panel')
    await expect(menuPanel.getByText('오늘일독')).toBeVisible()
    await expect(menuPanel.getByText('성경통독표')).toBeVisible()
    await expect(menuPanel.getByText('플랜 관리')).toBeVisible()
  })

  test('menu shows disabled items with "준비 중" label', async ({ page }) => {
    await page.getByTestId('hamburger-menu').click()

    const menuPanel = page.getByTestId('menu-panel')
    await expect(menuPanel.getByText('내 프로필')).toBeVisible()
    await expect(menuPanel.getByText('계정 설정')).toBeVisible()
    // Disabled items show "준비 중"
    const badges = menuPanel.getByText('준비 중')
    await expect(badges.first()).toBeVisible()
  })
})
