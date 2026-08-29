import { defineConfig, devices } from '@playwright/test';

const host = '127.0.0.1';
const port = 3019;
const baseURL = `http://${host}:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: 'list',
  // The specs wait on explicit readiness signals, never on elapsed time, so this
  // is an upper bound rather than a sleep: a fast run is still fast.
  //
  // It is raised because `workers: 1` makes the alphabetically first spec absorb
  // the dev server's first on-demand route compile. Locally that cost is already
  // cached and the default 5s never binds; on a clean CI checkout it does, and
  // `bible-behavior.spec.ts` failed twice for exactly that reason while passing
  // locally every time. A test that passes on timing luck is a broken test.
  expect: { timeout: 20_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --host ${host} --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NUXT_DEVTOOLS: 'false',
      NUXT_PUBLIC_API_BASE: 'http://127.0.0.1:8019',
      NUXT_PUBLIC_BIBLE_CACHE_URL: 'http://127.0.0.1:8019',
      NUXT_PUBLIC_GOOGLE_CLIENT_ID: 'playwright-google-client',
      NUXT_PUBLIC_GOOGLE_REDIRECT_URI: `${baseURL}/auth/google/callback`,
    },
  },
});
