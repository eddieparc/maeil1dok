import { expect, test } from './fixtures/api';
import type { components } from '../../app/types/generated/api-schema';

const note = {
  id: 21, book: 'jhn', book_name: '요한복음', chapter: 3, content: 'record-alpha',
  is_private: true, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-02T00:00:00Z',
} satisfies components['schemas']['ReflectionNote'];

const bookmark = {
  id: 31, bookmark_type: 'verse', book: 'jhn', book_name: '요한복음', chapter: 3,
  start_verse: 2, end_verse: 4, title: 'bookmark-alpha', memo: 'saved-memo', color: '#FFE28A',
  created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-02T00:00:00Z',
} satisfies components['schemas']['BibleBookmark'];
const highlight = {
  id: 41, book: 'jhn', book_name: '요한복음', chapter: 3, start_verse: 2, end_verse: 4,
  color: '#FFE28A', memo: 'highlight-alpha',
  created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-02T00:00:00Z',
} satisfies components['schemas']['BibleHighlight'];

test('offers login when the notes identity resolves to guest', async ({ page, api }) => {
  // Given
  api.get('/api/v1/todos/bible/notes/', { count: 0, results: [] });
  // When
  await page.goto('/bible/notes');
  // Then
  await expect(page.locator('.empty-state a[href="/login"]')).toBeVisible();
  await expect(page.locator('.note-list')).toHaveCount(0);
});

test('offers reading when an authenticated notes list is empty', async ({ page, api }) => {
  // Given
  await api.authenticate();
  api.get('/api/v1/todos/bible/notes/', { count: 0, results: [] });
  // When
  await page.goto('/bible/notes');
  // Then
  await expect(page.locator('.empty-state a[href="/bible"]')).toBeVisible();
  await expect(page.locator('[data-testid="notes-error"]')).toHaveCount(0);
});

test('recovers the notes list when a rejected request is retried', async ({ page, api }) => {
  // Given
  await api.authenticate();
  api.get('/api/v1/todos/bible/notes/', { count: 0, results: [] }, 500);
  await page.goto('/bible/notes');
  const error = page.getByTestId('notes-error');
  await expect(error).toBeVisible();
  api.get('/api/v1/todos/bible/notes/', { count: 1, results: [note] });
  // When
  await error.getByRole('button').click();
  // Then
  await expect(page.locator('.note-list a[href="/bible/notes/21"]')).toBeVisible();
  await expect(error).toHaveCount(0);
});

test('filters notes when search is entered', async ({ page, api }) => {
  // Given
  await api.authenticate();
  api.get('/api/v1/todos/bible/notes/', { count: 2, results: [note, { ...note, id: 22, content: 'record-beta' }] });
  await page.goto('/bible/notes');
  await expect(page.locator('.note-list a')).toHaveCount(2);
  await page.getByRole('button', { name: '기록 검색' }).click();
  // When
  await page.getByRole('searchbox').fill('record-beta');
  // Then
  await expect(page.locator('.note-list a')).toHaveCount(1);
  await expect(page.locator('.note-list a')).toHaveAttribute('href', '/bible/notes/22');
});

test('refreshes notes when a resolved identity changes without navigation', async ({ page, api }) => {
  // Given
  await api.authenticate();
  api.get('/api/v1/todos/bible/notes/', { count: 1, results: [note] });
  await page.goto('/bible/notes');
  await expect(page.locator('.note-list a')).toHaveCount(1);
  api.get('/api/v1/todos/bible/notes/', { count: 1, results: [{ ...note, id: 23 }] });
  // When: the real cross-tab auth event, owned by the auth service.
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', {
    key: 'auth', newValue: JSON.stringify({ user: { id: 8, username: 'other-reader' } }),
  })));
  // Then
  await expect(page.locator('.note-list a')).toHaveAttribute('href', '/bible/notes/23');
});

for (const record of [
  { route: 'bookmarks', endpoint: '/api/v1/todos/bible/bookmarks/', value: bookmark },
  { route: 'highlights', endpoint: '/api/v1/todos/bible/highlights/', value: highlight },
] as const) {
  test(`offers login when ${record.route} resolves to guest`, async ({ page, api }) => {
    // Given
    api.get(record.endpoint, { count: 0, results: [] });
    // When
    await page.goto(`/bible/${record.route}`);
    // Then
    await expect(page.locator('.empty-state a[href="/login"]')).toBeVisible();
  });

  test(`offers reading when ${record.route} is empty`, async ({ page, api }) => {
    // Given
    await api.authenticate();
    api.get(record.endpoint, { count: 0, results: [] });
    // When
    await page.goto(`/bible/${record.route}`);
    // Then
    await expect(page.locator('.empty-state a[href="/bible"]')).toBeVisible();
  });

  test(`recovers ${record.route} when a failed list is retried`, async ({ page, api }) => {
    // Given
    await api.authenticate();
    api.get(record.endpoint, { count: 0, results: [] }, 500);
    await page.goto(`/bible/${record.route}`);
    const error = page.getByTestId(`${record.route}-error`);
    await expect(error).toBeVisible();
    api.get(record.endpoint, { count: 1, results: [record.value] });
    // When
    await error.getByRole('button').click();
    // Then
    await expect(page.locator('.record-row a')).toHaveAttribute('href', '/bible?book=jhn&chapter=3&verse=2');
  });

  test(`keeps delete independent of navigation when ${record.route} is deleted`, async ({ page, api }) => {
    // Given
    await api.authenticate();
    api.get(record.endpoint, { count: 1, results: [record.value] });
    await page.route(`**${record.endpoint}${record.value.id}/`, route => route.fulfill({
      status: 204, headers: { 'access-control-allow-origin': `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT || 3019}`, 'access-control-allow-credentials': 'true' },
    }));
    await page.goto(`/bible/${record.route}`);
    const row = page.locator('.record-row');
    await expect(row).toHaveCount(1);
    await expect(row.locator('a button')).toHaveCount(0);
    await row.getByRole('button').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // When
    await dialog.getByRole('button', { name: '삭제', exact: true }).click();
    // Then
    await expect(row).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/bible/${record.route}$`));
  });
}

test('sorts notes when oldest order is selected', async ({ page, api }) => {
  // Given
  await api.authenticate();
  api.get('/api/v1/todos/bible/notes/', { count: 2, results: [note, { ...note, id: 22, updated_at: '2026-08-03T00:00:00Z' }] });
  await page.goto('/bible/notes');
  await expect(page.locator('.note-list a').first()).toHaveAttribute('href', '/bible/notes/22');
  // When
  await page.getByRole('combobox', { name: '정렬', exact: true }).selectOption('oldest');
  // Then
  await expect(page.locator('.note-list a').first()).toHaveAttribute('href', '/bible/notes/21');
});

test('filters by book when a book is selected', async ({ page, api }) => {
  // Given
  await api.authenticate();
  api.get('/api/v1/todos/bible/bookmarks/', { count: 2, results: [bookmark, { ...bookmark, id: 32, book: 'gen' }] });
  await page.goto('/bible/bookmarks');
  await expect(page.locator('.record-row')).toHaveCount(2);
  // When
  await page.getByRole('combobox', { name: '성경 필터' }).selectOption('gen');
  // Then
  await expect(page.locator('.record-row a')).toHaveAttribute('href', '/bible?book=gen&chapter=3&verse=2');
});

test('filters stored colors when a highlight color is selected', async ({ page, api }) => {
  // Given
  await api.authenticate();
  api.get('/api/v1/todos/bible/highlights/', { count: 2, results: [highlight, { ...highlight, id: 42, chapter: 4, color: '#BFE8C4' }] });
  await page.goto('/bible/highlights');
  await expect(page.locator('.record-row')).toHaveCount(2);
  // When
  await page.getByRole('combobox', { name: '색상 필터' }).selectOption('#BFE8C4');
  // Then
  await expect(page.locator('.record-row a')).toHaveAttribute('href', '/bible?book=jhn&chapter=4&verse=2');
});

test('navigates between record routes when the native record link is followed', async ({ page, api }) => {
  // Given
  await api.authenticate();
  api.get('/api/v1/todos/bible/notes/', { count: 1, results: [note] });
  api.get('/api/v1/todos/bible/bookmarks/', { count: 1, results: [bookmark] });
  await page.goto('/bible/notes');
  await expect(page.locator('.note-list a')).toHaveCount(1);
  // When
  await page.locator('nav a[href="/bible/bookmarks"]').click();
  // Then
  await expect(page).toHaveURL(/\/bible\/bookmarks$/);
  await expect(page.locator('nav a[aria-current="page"]')).toHaveAttribute('href', '/bible/bookmarks');
  await expect(page.locator('.record-row a')).toHaveAttribute('href', '/bible?book=jhn&chapter=3&verse=2');
  await page.screenshot({ path: test.info().outputPath('records.png'), fullPage: true });
});

test('clears private notes when the identity becomes guest', async ({ page, api }) => {
  // Given
  await api.authenticate();
  api.get('/api/v1/todos/bible/notes/', { count: 1, results: [note] });
  await page.goto('/bible/notes');
  await expect(page.locator('.note-list a')).toHaveCount(1);
  // When
  await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'auth', newValue: null })));
  // Then
  await expect(page.locator('.note-list a')).toHaveCount(0);
  await expect(page.locator('.empty-state a[href="/login"]')).toBeVisible();
});
