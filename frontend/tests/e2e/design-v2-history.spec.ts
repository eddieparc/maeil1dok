import { expect, test } from './fixtures/api';
import type { Page } from '@playwright/test';

const statsOk = {
  success: true,
  stats: {
    total_chapters_read: 3,
    books_read: 1,
    books_completed: 0,
    current_streak: 2,
    books_progress: { jhn: { read: 3, total: 21 } },
  },
};

const datesOk = { success: true, dates: ['2026-09-01'] };
const failBody = { success: false, stats: statsOk.stats } as never;
const datesFail = { success: false, dates: [] } as never;

const recordHistoryReads = (page: Page) => {
  const stats: string[] = [];
  const dates: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (request.method() !== 'GET') return;
    if (url.includes('/api/v1/todos/bible/personal-records/stats/')) stats.push(url);
    if (url.includes('/api/v1/todos/bible/personal-records/dates/')) dates.push(url);
  });
  return { stats, dates };
};

const holdAuthUser = async (page: Page) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/auth/user/', async (route) => {
    await held;
    await route.fallback();
  });
  return { release };
};

test('keeps personal history pending until an unknown session resolves to guest', async ({ page, api }) => {
  // Given
  const reads = recordHistoryReads(page);
  api.get('/api/v1/todos/bible/personal-records/stats/', failBody, 500);
  api.get('/api/v1/todos/bible/personal-records/dates/', datesFail, 500);
  const gate = await holdAuthUser(page);
  // When
  await page.goto('/bible/history');
  // Then
  await expect(page.locator('[data-state="pending"]')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('[data-state="guest"]')).toHaveCount(0);
  gate.release();
  await expect(page.locator('[data-state="guest"]')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('[data-action="login"]')).toBeVisible();
  expect(reads.stats).toHaveLength(0);
  expect(reads.dates).toHaveLength(0);
});

test('loads personal history once an unknown session resolves to authenticated', async ({ page, api }) => {
  // Given
  await api.authenticate();
  const reads = recordHistoryReads(page);
  api.get('/api/v1/todos/bible/personal-records/stats/', statsOk);
  api.get('/api/v1/todos/bible/personal-records/dates/', datesOk);
  const gate = await holdAuthUser(page);
  // When
  await page.goto('/bible/history');
  await expect(page.locator('[data-state="pending"]')).toBeVisible();
  expect(reads.stats).toHaveLength(0);
  gate.release();
  // Then
  await expect(page.locator('[data-state="ready"]')).toBeVisible();
  await expect(page.locator('.summary-cards')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(reads.stats).toHaveLength(1);
  expect(reads.dates).toHaveLength(1);
});

test('drops in-flight personal history reads when auth is lost without mutating auth', async ({ page, api }) => {
  // Given
  await api.authenticate();
  const reads = recordHistoryReads(page);
  api.get('/api/v1/todos/bible/personal-records/stats/', statsOk);
  api.get('/api/v1/todos/bible/personal-records/dates/', datesOk);
  await page.goto('/bible/history');
  await expect(page.locator('[data-state="ready"]')).toBeVisible();
  expect(reads.stats).toHaveLength(1);
  api.get('/api/v1/todos/bible/personal-records/stats/', failBody, 500);
  api.get('/api/v1/todos/bible/personal-records/dates/', datesFail, 500);
  // When
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'auth', newValue: null })));
  // Then
  await expect(page.locator('[data-state="guest"]')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(reads.stats).toHaveLength(1);
  expect(reads.dates).toHaveLength(1);
});

test('keeps calendar when only statistics fail', async ({ page, api }) => {
  // Given
  await api.authenticate();
  api.get('/api/v1/todos/bible/personal-records/stats/', failBody, 500);
  api.get('/api/v1/todos/bible/personal-records/dates/', datesOk);
  // When
  await page.goto('/bible/history');
  // Then
  await expect(page.locator('[data-retry="stats"]')).toBeVisible();
  await expect(page.locator('[data-retry="dates"]')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(1);
});

test('keeps statistics when only dates fail', async ({ page, api }) => {
  // Given
  await api.authenticate();
  api.get('/api/v1/todos/bible/personal-records/stats/', statsOk);
  api.get('/api/v1/todos/bible/personal-records/dates/', datesFail, 500);
  // When
  await page.goto('/bible/history');
  // Then
  await expect(page.locator('.summary-cards')).toBeVisible();
  await expect(page.locator('[data-retry="dates"]')).toBeVisible();
  await expect(page.locator('[data-retry="stats"]')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(1);
});

test('retries a failed statistics request without refetching dates', async ({ page, api }) => {
  // Given
  await api.authenticate();
  const reads = recordHistoryReads(page);
  api.get('/api/v1/todos/bible/personal-records/stats/', failBody, 500);
  api.get('/api/v1/todos/bible/personal-records/dates/', datesOk);
  await page.goto('/bible/history');
  await expect(page.locator('[data-retry="stats"]')).toBeVisible();
  api.get('/api/v1/todos/bible/personal-records/stats/', statsOk);
  // When
  await page.locator('[data-retry="stats"]').click();
  // Then
  await expect(page.locator('.summary-cards')).toBeVisible();
  await expect(page.locator('[data-retry="stats"]')).toHaveCount(0);
  expect(reads.stats).toHaveLength(2);
  expect(reads.dates).toHaveLength(1);
});
