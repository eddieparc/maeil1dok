import { expect, test, type Page } from '@playwright/test'

const PUBLIC_ROUTES = [
  { path: '/login', name: 'login' },
  { path: '/register-email', name: 'register-email' },
  { path: '/company', name: 'company' },
  { path: '/privacy', name: 'privacy' },
  { path: '/terms', name: 'terms' },
]

const AUTHENTICATED_ROUTES = [
  { path: '/', name: 'home' },
  { path: '/plans', name: 'plans' },
  { path: '/reading', name: 'reading' },
  { path: '/settings', name: 'settings' },
]

const VIEWPORTS = [
  { width: 390, height: 844, name: 'mobile' },
]

const COLOR_SCHEMES = ['light'] as const

async function runA11yCheck(page: Page, route: string, routeName: string, viewport: string, colorScheme: string) {
  try {
    await page.goto(route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)

    // Inject axe-core script from node_modules
    await page.addScriptTag({
      path: require.resolve('axe-core/axe.min.js'),
    })

    // Run axe-core check with WCAG AA standard
    const results = await page.evaluate(() => {
      return (window as any).axe.run({
        runOnly: {
          type: 'tag',
          values: ['wcag2aa'],
        },
      })
    })

    // Log violations (baseline - not failing)
    if (results.violations && results.violations.length > 0) {
      console.log(`\n[${colorScheme.toUpperCase()}] ${routeName} (${viewport}): ${results.violations.length} violations`)
      results.violations.forEach((violation: any) => {
        console.log(`  - ${violation.id}: ${violation.impact} (${violation.nodes.length} nodes)`)
      })
    } else {
      console.log(`\n[${colorScheme.toUpperCase()}] ${routeName} (${viewport}): ✓ No violations`)
    }
  } catch (error) {
    console.log(`\n[${colorScheme.toUpperCase()}] ${routeName} (${viewport}): Error - ${error instanceof Error ? error.message : String(error)}`)
  }
}

test.describe('Accessibility Baseline - WCAG AA', () => {
  for (const colorScheme of COLOR_SCHEMES) {
    test.describe(`${colorScheme.toUpperCase()} Mode`, () => {
      test.beforeEach(async ({ page }) => {
        await page.emulateMedia({ colorScheme: colorScheme as 'light' | 'dark' })
      })

      for (const viewport of VIEWPORTS) {
        test.describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
          test.beforeEach(async ({ page }) => {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
          })

          test.describe('Public Routes', () => {
            for (const route of PUBLIC_ROUTES) {
              test(`${route.name}`, async ({ page }) => {
                await runA11yCheck(page, route.path, route.name, viewport.name, colorScheme)
              })
            }
          })

          test.describe('Authenticated Routes', () => {
            for (const route of AUTHENTICATED_ROUTES) {
              test(`${route.name}`, async ({ page }) => {
                await runA11yCheck(page, route.path, route.name, viewport.name, colorScheme)
              })
            }
          })
        })
      }
    })
  }
})
