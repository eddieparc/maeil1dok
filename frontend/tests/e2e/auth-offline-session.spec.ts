import { expect, test } from './fixtures/api';
import { mockBibleChapter } from './fixtures/bible';

const cachedUser = {
  id: 73,
  username: 'offline-reader',
  nickname: '오프라인 독자',
  email: 'offline@example.com',
  profile_image: null,
  is_staff: false,
  email_verified: true,
  has_usable_password_flag: true,
};

test('offline session blocks protected action without navigating to login', async ({ page, api }) => {
  const hydrationWarnings: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (text.includes('Hydration') || text.includes('hydration')) {
      hydrationWarnings.push(text);
    }
  });

  await page.addInitScript((user) => {
    localStorage.setItem('auth', JSON.stringify({ user }));
  }, cachedUser);

  api.get('/api/v1/auth/user/', { detail: 'expired access token' } as never, 401);
  await page.route('http://127.0.0.1:8019/api/v1/auth/token/refresh/', (route) =>
    route.abort('internetdisconnected'));
  await page.route('http://localhost:8019/api/v1/auth/token/refresh/', (route) =>
    route.abort('internetdisconnected'));
  mockBibleChapter(api, {
    book: 'GEN',
    chapter: 1,
    verseCount: 2,
  });

  const refreshAttempt = page.waitForRequest((request) =>
    request.url().endsWith('/api/v1/auth/token/refresh/'));
  await page.goto('/bible?book=1&chapter=1');
  await refreshAttempt;

  expect(hydrationWarnings).toEqual([]);

  const markRead = page.getByRole('button', { name: '읽음으로 표시' });
  await expect(markRead).toBeVisible();
  await markRead.click();

  await expect(page.getByText('네트워크 연결을 확인한 후 다시 시도해주세요')).toBeVisible();
  await expect(page).toHaveURL(/\/bible\?/);
  await expect
    .poll(() => page.evaluate(() => Boolean(localStorage.getItem('auth'))))
    .toBe(true);

  await page.screenshot({
    path: '../.omo/evidence/lab-60/C1-browser-offline.png',
    fullPage: true,
  });
});
