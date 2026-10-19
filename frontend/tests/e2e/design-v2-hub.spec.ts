import { expect, test } from './fixtures/api';
import type { ApiMock } from './fixtures/api';
import { mockBibleChapter } from './fixtures/bible';
import type { components } from '../../app/types/generated/api-schema';

type Entry = components['schemas']['ProfileCalendarEntry'] & { readonly book_unit_kor?: string };
const today = '2026-09-15';
const assignment: Entry = { date: today, is_completed: false, book: '출애굽기', start_chapter: 3, end_chapter: 5, chapters: '3-5장', plan_id: 2, plan_name: '매일', color: '#000000', schedule_id: 13, schedule_text: '' };
function hub(api: ApiMock, entries: Entry[]) {
  api.get('/api/v1/todos/plans/user/', { subscriptions: [{ id: 9, plan_id: 2, plan_name: '매일', is_active: true, is_default: true, start_date: today }], available_plans: [] });
  api.get('/api/v1/auth/profile/{user_id}/', { success: true, message: 'ok', data: { profile: { id: 7, user: { id: 7, username: 'reader', nickname: '독자', profile_image: null }, bio: '', total_completed_days: 0, current_streak: 0, longest_streak: 0, joined_date: today, is_public: true, followers_count: 0, following_count: 0, is_following: false, is_mutual_follow: false } } });
  api.get('/api/v1/auth/profile/{user_id}/calendar/', { success: true, message: 'ok', data: { calendar: entries, plans: [] } });
  api.get('/api/v1/todos/stats/progress/', { success: true, plan_name: '매일', theoretical_progress: 0, user_progress: 0 });
  api.get('/api/v1/todos/schedules/', []);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(`${today}T12:00:00`) });
  await page.addInitScript(() => {
    const addEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
      addEventListener.call(this, type, listener, options);
      if (type === 'click' && this instanceof Element && this.classList.contains('continue-button')) {
        this.setAttribute('data-click-ready', 'true');
      }
    };
  });
});

test('opens the displayed assignment when saved position conflicts', async ({ api, page }) => {
  // Given today's assignment differs from the saved chapter.
  await api.authenticate();
  hub(api, [assignment]);
  mockBibleChapter(api, { book: 'exo', chapter: 3 });
  api.get('/api/v1/todos/detail/', { book: 'exo', book_kor: assignment.book, book_unit_kor: '장', chapter: '3', is_logined: true, plan_id: 2, plan_name: assignment.plan_name, plan_date: today, is_complete: false, plan_detail: [{ book: 'exo', book_kor: assignment.book, book_unit_kor: '장', start_chapter: 3, end_chapter: 5, schedule_id: 13, date: today, is_complete: false }] });
  await page.addInitScript(() => localStorage.setItem('lastReadingPosition', JSON.stringify({ book: 'jhn', chapter: 9, version: 'GAE', scroll_position: 0, updated_at: '2026-09-14T00:00:00Z' })));
  await page.goto('/');
  await expect(page.locator('.reading-card .bible-verse')).toHaveText('출애굽기 3-5장');
  // When the assignment CTA is activated after its handler is attached.
  await page.locator('.reading-card button[data-click-ready="true"]').click();
  // Then both session identity and actual passage match the assignment.
  await expect(page).toHaveURL(/book=exo/);
  const query = new URL(page.url()).searchParams;
  expect(Object.fromEntries(query)).toMatchObject({ book: 'exo', chapter: '3', plan: '2', schedule: '13', date: today, tongdok: 'true' });
  await expect(page.locator('.book-selector-trigger')).toContainText('출애굽기 3장');
  await expect(page.locator('.bible-content .verse')).toHaveCount(24);
});

test('routes guests to login when the CTA is activated', async ({ api, page }) => {
  // Given a guest hub with an installed API boundary.
  api.get('/api/v1/todos/plans/user/', { subscriptions: [], available_plans: [] });
  await page.goto('/');
  // When the card CTA is activated after hydration attaches its handler.
  await page.locator('.reading-card button[data-click-ready="true"]').click();
  // Then authentication is the destination.
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});

test('offers plan navigation when no assignment exists', async ({ api, page }) => {
  // Given an authenticated plan without today's assignment.
  await api.authenticate();
  hub(api, []);
  await page.goto('/');
  await expect(page.locator('.reading-card .progress-skeleton')).toHaveCount(0);
  // When the available CTA is activated.
  await page.locator('.reading-card button[data-click-ready="true"]').click();
  // Then no fabricated reader query is emitted.
  await expect(page).toHaveURL(/\/plan$/);
});

test('retains an actionable error when assignment loading fails', async ({ api, page }) => {
  // Given a failed calendar response, not a valid empty assignment.
  await api.authenticate();
  hub(api, []);
  api.get('/api/v1/auth/profile/{user_id}/calendar/', { success: false, message: 'offline', data: { calendar: [], plans: [] } });
  // When the hub loads.
  await page.goto('/');
  // Then the failure exposes a retry action separately from the card.
  await expect(page.locator('.load-error[role="alert"] button')).toBeEnabled();
});

for (const range of [
  { start: 3, end: 3, chapters: '3장', book: '출애굽기', unit: '장', expected: '출애굽기 3장' },
  { start: 3, end: 5, chapters: '3-5장', book: '출애굽기', unit: '장', expected: '출애굽기 3-5장' },
  { start: 3, end: 5, chapters: '3-5편', book: '시편', unit: '편', expected: '시편 3-5편' },
]) {
  test(`formats recent history once for ${range.expected}`, async ({ api, page }) => {
    // Given numeric bounds and already formatted API text.
    await api.authenticate();
    hub(api, [{ ...assignment, is_completed: true, book: range.book, start_chapter: range.start, end_chapter: range.end, chapters: range.chapters, book_unit_kor: range.unit }]);
    // When the hub renders.
    await page.goto('/');
    // Then the passage contains exactly one supplied unit.
    await expect(page.locator('.recent-records .record-link > span')).toHaveText(range.expected);
  });
}
