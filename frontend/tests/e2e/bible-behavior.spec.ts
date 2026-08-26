import type { Page } from '@playwright/test';
import type { components } from '../../app/types/generated/api-schema';
import { expect, test } from './fixtures/api';
import { mockBibleChapter } from './fixtures/bible';

const searchResponse = {
  success: true,
  query: '브라우저 말씀',
  count: 1,
  results: [
    {
      version: 'GAE',
      book: 'jhn',
      chapter: 3,
      verse: 70,
      snippet: '회귀를 막는 브라우저 말씀 70.',
      updated_at: '2026-08-26T00:00:00Z',
    },
  ],
} satisfies components['schemas']['BibleCacheSearchResponse'];

const verse = (page: Page, number: number) => page.locator('.bible-content .verse').filter({
  has: page.locator('.verse-number').filter({
    hasText: new RegExp(`^${number}$`),
  }),
});

const grantClipboardPermissions = async (page: Page): Promise<void> => {
  await page.context().grantPermissions(
    ['clipboard-read', 'clipboard-write'],
    { origin: 'http://127.0.0.1:3019' },
  );
};

test('Bible search result deep link focuses and scrolls to the matching term', async ({ api, page }) => {
  api.get('/api/v1/bible-cache/search/', searchResponse);
  mockBibleChapter(api, { book: 'jhn', chapter: 3, verseCount: 90 });
  await page.addInitScript(() => {
    const addEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      addEventListener.call(this, type, listener, options);
      if (this === window && type === 'keydown') {
        document.documentElement.dataset.searchShortcutReady = 'true';
      }
    };
  });
  await page.goto('/bible/search');

  await expect(page.locator('html')).toHaveAttribute('data-search-shortcut-ready', 'true');
  await page.getByPlaceholder('본문 단어를 입력하세요').fill('브라우저 말씀');
  await page.getByRole('button', { name: '검색', exact: true }).click();
  await page.getByRole('link', { name: /3장 70절/ }).click();

  await expect(page.locator('.bible-content .verse')).toHaveCount(90);
  const targetVerse = verse(page, 70);
  const focusedTerm = targetVerse.locator('mark.focused-search-term');
  await expect(targetVerse).toHaveClass(/selected-verse/);
  await expect(focusedTerm).toHaveText('브라우저 말씀');
  await expect(focusedTerm).toBeInViewport();

  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test('verse selection toolbar is the topmost layer above the bottom bar', async ({ api, page }) => {
  mockBibleChapter(api, { book: 'jhn', chapter: 3 });
  await page.goto('/bible?book=jhn&chapter=3');

  await expect(page.locator('.bible-content .verse')).toHaveCount(24);
  await verse(page, 3).click();
  const toolbar = page.getByTestId('selection-action-menu');
  await expect(toolbar).toBeVisible();

  const layout = await toolbar.evaluate((menu) => {
    const bottomBar = document.querySelector('.floating-bottom-area');
    if (!(bottomBar instanceof HTMLElement)) throw new Error('Missing floating bottom bar');

    const menuRect = menu.getBoundingClientRect();
    const barRect = bottomBar.getBoundingClientRect();
    const topmost = document.elementFromPoint(
      menuRect.left + menuRect.width / 2,
      menuRect.top + menuRect.height / 2,
    );
    return {
      menuBottom: menuRect.bottom,
      barTop: barRect.top,
      isTopmost: topmost === menu || menu.contains(topmost),
    };
  });

  expect(layout.menuBottom).toBeLessThan(layout.barTop);
  expect(layout.isTopmost).toBe(true);
});

test('copy menu writes the selected verse and location to the browser clipboard', async ({ api, page }) => {
  await grantClipboardPermissions(page);
  mockBibleChapter(api, { book: 'jhn', chapter: 3 });
  await page.goto('/bible?book=jhn&chapter=3');

  await expect(page.locator('.bible-content .verse')).toHaveCount(24);
  const selectedVerse = verse(page, 4);
  const verseText = (await selectedVerse.locator('.verse-text').innerText()).trim();
  await selectedVerse.click();

  const actionToolbar = page.getByTestId('selection-action-menu');
  await actionToolbar.getByRole('button', { name: '복사', exact: true }).click();
  const copyToolbar = page.getByTestId('selection-copy-menu');
  await expect(copyToolbar).toBeVisible();
  await expect(copyToolbar.getByRole('button')).toHaveCount(4);
  await copyToolbar.getByRole('button', { name: '위치 포함' }).click();

  await expect(page.getByText('복사 완료')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `[요한복음3:4] ${verseText}`,
  );
});

test('sharing a selected verse range copies the range deep link', async ({ api, page }) => {
  await grantClipboardPermissions(page);
  mockBibleChapter(api, { book: 'jhn', chapter: 3 });
  await page.goto('/bible?book=jhn&chapter=3');

  await expect(page.locator('.bible-content .verse')).toHaveCount(24);
  expect(await page.evaluate(() => typeof navigator.share)).toBe('undefined');
  await verse(page, 6).click();
  await verse(page, 8).click();
  await expect(page.locator('.verse.selected-verse')).toHaveCount(3);

  await page.getByTestId('selection-action-menu').getByRole('button', { name: '공유' }).click();
  await expect(page.getByText('링크가 복사되었습니다')).toBeVisible();

  const origin = new URL(page.url()).origin;
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    `${origin}/bible?book=jhn&chapter=3&verse=6-8`,
  );
});

test('verse-range deep link focuses the complete range and scrolls to its start', async ({ api, page }) => {
  mockBibleChapter(api, { book: 'jhn', chapter: 3, verseCount: 90 });
  await page.goto('/bible?book=jhn&chapter=3&verse=72-74');

  await expect(page.locator('.bible-content .verse')).toHaveCount(90);
  await expect(page.locator('.verse.selected-verse')).toHaveCount(3);
  await expect(verse(page, 72)).toHaveClass(/selected-first/);
  await expect(verse(page, 73)).toHaveClass(/selected-middle/);
  await expect(verse(page, 74)).toHaveClass(/selected-last/);
  await expect(verse(page, 72)).toBeInViewport();

  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});
