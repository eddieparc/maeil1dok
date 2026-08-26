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
