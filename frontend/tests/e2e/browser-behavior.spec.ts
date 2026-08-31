import type { components } from '../../app/types/generated/api-schema';
import { expect, test } from './fixtures/api';
import { mockBibleChapter } from './fixtures/bible';

const linkedAccounts = {
  has_password: true,
  email: 'reader@example.com',
  primary_email: 'reader@example.com',
  auth_methods: {
    total: 2,
    password: true,
    social_count: 1,
    providers: ['google'],
    can_remove_login_method: true,
  },
  linked_accounts: [
    {
      provider: 'google',
      provider_display: 'Google',
      email: 'reader@example.com',
      profile_image: null,
      linked_at: '2026-08-26T00:00:00Z',
      can_unlink: true,
    },
  ],
} satisfies components['schemas']['LinkedAccountsResponse'];

const scoreboard = {
  success: true,
  leaderboard: [
    {
      rank: 1,
      user: {
        id: 11,
        nickname: '모바일 독자',
        profile_image: null,
        is_me: false,
      },
      completed_days: 20,
      bible_completed_days: 14,
      hasena_completed_days: 6,
      activity_score: 20,
      progress_rate: 70,
      current_streak: 4,
      longest_streak: 9,
      current_hasena_streak: 2,
      longest_hasena_streak: 5,
      joined_at: '2026-01-01T00:00:00Z',
    },
  ],
  period: 'month',
  month: '2026-08',
  plan_id: null,
} satisfies components['schemas']['ScoreboardResponse'];

test('slash shortcut gives focus to the Bible search input', async ({ page }) => {
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

  const searchInput = page.getByPlaceholder('본문 단어를 입력하세요');
  await expect(searchInput).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-search-shortcut-ready', 'true');
  await expect(searchInput).not.toBeFocused();

  await page.keyboard.press('/');

  await expect(searchInput).toBeFocused();
});

test('BookSelector submit button navigates to the entered chapter', async ({ api, page }) => {
  mockBibleChapter(api, { book: 'gen', chapter: 1 });
  mockBibleChapter(api, { book: 'exo', chapter: 3 });
  await page.goto('/bible?book=gen&chapter=1');

  await expect(page.locator('.bible-content .verse')).toHaveCount(24);
  await page.locator('.book-selector-trigger').click();
  await page.getByRole('button', { name: '출애굽기', exact: true }).click();

  const selectorInput = page.getByPlaceholder('출애굽기 몇 장?');
  await selectorInput.fill('3');
  await page.getByRole('button', { name: '입력한 장/절로 이동' }).click();
  await expect(page.getByPlaceholder('출애굽기 3장 몇 절? (생략 가능)')).toBeFocused();

  const chapterRequest = page.waitForRequest((request) =>
    new URL(request.url()).pathname === '/api/v1/bible-cache/GAE/exo/3/');
  await page.getByRole('button', { name: '입력한 장/절로 이동' }).click();
  await chapterRequest;

  await expect(page.locator('.book-selector-trigger')).toContainText('출애굽기 3장');
  await expect(page.locator('.bible-content .verse')).toHaveCount(24);
});

test('account deletion action opens the project confirm modal', async ({ api, page }) => {
  await api.authenticate();
  api.get('/api/v1/auth/linked-accounts/', linkedAccounts);
  await page.context().addCookies([{
    name: 'access_token',
    value: 'playwright-access-token',
    url: 'http://127.0.0.1:3019',
  }]);

  const linkedAccountsResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/v1/auth/linked-accounts/');
  await page.goto('/account/settings');
  expect((await linkedAccountsResponse).status()).toBe(200);
  await expect(page.getByRole('heading', { name: '계정 설정' })).toBeVisible();
  await expect(page.getByRole('button', { name: '해제' })).toBeVisible();

  await page.getByRole('button', { name: '계정 삭제', exact: true }).click();
  await page.getByLabel('계정 비밀번호').fill('browser-password');
  await page.getByRole('button', { name: '삭제 요청' }).click();

  const dialog = page.getByRole('dialog', { name: '계정 삭제' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('삭제 요청 후 30일간 유예 기간');
  await expect(dialog.getByRole('button', { name: '취소' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '계정 삭제' })).toBeVisible();

  await dialog.getByRole('button', { name: '취소' }).click();
  await expect(dialog).toBeHidden();
});

test('Bible reader restores the saved reading position after content loads', async ({ api, page }) => {
  mockBibleChapter(api, { book: 'jhn', chapter: 3, verseCount: 90 });
  await page.addInitScript(() => {
    localStorage.setItem('lastReadingPosition', JSON.stringify({
      book: 'jhn',
      chapter: 3,
      scroll_position: 0.5,
      version: 'GAE',
      updated_at: '2026-08-26T00:00:00Z',
    }));
    window.addEventListener('scrollend', () => {
      if (window.scrollY > 0) {
        document.documentElement.dataset.readingPositionRestored = 'true';
      }
    }, { capture: true });
  });

  await page.goto('/bible');
  await expect(page.locator('.bible-content .verse')).toHaveCount(90);
  await expect(page.locator('html')).toHaveAttribute('data-reading-position-restored', 'true');

  const scroll = await page.evaluate(() => ({
    top: window.scrollY,
    maximum: document.documentElement.scrollHeight - window.innerHeight,
  }));
  expect(scroll.maximum).toBeGreaterThan(0);
  expect(scroll.top / scroll.maximum).toBeCloseTo(0.5, 1);
});

test('leaderboard row becomes a geometric mobile card at a mobile viewport', async ({ api, page }) => {
  api.get('/api/v1/todos/scoreboard/', scoreboard);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/scoreboard');

  const card = page.getByTestId('leaderboard-mobile-card');
  await expect(card).toBeVisible();
  await expect(card).toHaveCSS('display', 'grid');

  const layout = await card.evaluate((row) => {
    const box = (selector: string) => {
      const element = row.querySelector(selector);
      if (!(element instanceof HTMLElement)) throw new Error(`Missing ${selector}`);
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    const rowRect = row.getBoundingClientRect();
    return {
      card: { x: rowRect.x, y: rowRect.y, width: rowRect.width, height: rowRect.height },
      rank: box('.rank-cell'),
      user: box('.user-cell'),
      activity: box('.activity-cell'),
      progress: box('.progress-cell'),
    };
  });

  expect(layout.rank.x).toBeLessThan(layout.user.x);
  expect(layout.activity.x).toBeCloseTo(layout.user.x, 0);
  expect(layout.activity.y).toBeGreaterThan(layout.user.y);
  expect(layout.progress.x).toBeGreaterThan(layout.user.x);
  expect(layout.card.width).toBeLessThan(390);
});
