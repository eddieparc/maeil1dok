import { defineConfig, devices } from '@playwright/test'

const playwrightPort = Number(process.env.PLAYWRIGHT_PORT ?? '3000')
const usePlaywrightWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER !== '1'

export default defineConfig({
  testDir: './tests/e2e',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${playwrightPort}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /visual-regression.*\.spec\.ts/,
      dependencies: ['setup']
    },
    {
      name: 'visual-regression',
      testMatch: /visual-regression\.spec\.ts/,
      use: {
        viewport: { width: 390, height: 844 },
        colorScheme: 'light'
      },
      dependencies: ['setup']
    },
    {
      name: 'visual-regression-dark',
      testMatch: /visual-regression-dark\.spec\.ts/,
      testIgnore: /visual-regression-dark\.spec\.ts/,
      use: {
        viewport: { width: 390, height: 844 },
        colorScheme: 'dark'
      },
      dependencies: ['setup']
    }
  ],
  ...(usePlaywrightWebServer
    ? {
        webServer: {
          command: `npm run dev -- --port ${playwrightPort}`,
          url: `http://localhost:${playwrightPort}`,
          reuseExistingServer: !process.env.CI,
        },
      }
    : {}),
})
