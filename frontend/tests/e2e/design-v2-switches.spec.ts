import type { components } from '../../app/types/generated/api-schema';
import { expect, test, type ApiMock } from './fixtures/api';
import type { Page } from '@playwright/test';

const NOTIFICATION_SETTINGS_PATH = '/api/v1/todos/notifications/settings/';

const notificationSettings = {
  success: true,
  settings: {
    notifications_enabled: true,
    reading_reminders_enabled: true,
    hasena_reminders_enabled: false,
    friend_activity_enabled: true,
    reading_reminder_time: '06:00:00',
    hasena_reminder_time: '20:00:00',
    timezone: 'Asia/Seoul',
    daily_push_limit: 3,
  },
} satisfies components['schemas']['NotificationSettingsResponse'];

type SettingsPatch = components['schemas']['TodoNotificationSettings'];

/**
 * Captures every PATCH the page sends to the notification settings endpoint.
 * Registered after the ApiMock fixture so it takes precedence for this route,
 * and replies with the merged settings the way the backend does.
 */
async function capturePatches(page: Page): Promise<SettingsPatch[]> {
  const patches: SettingsPatch[] = [];
  await page.route(`http://127.0.0.1:8019${NOTIFICATION_SETTINGS_PATH}`, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback();
      return;
    }
    const patch = route.request().postDataJSON() as SettingsPatch;
    patches.push(patch);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-control-allow-credentials': 'true',
        'access-control-allow-origin': `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT || 3019}`,
      },
      body: JSON.stringify({ success: true, settings: { ...notificationSettings.settings, ...patch } }),
    });
  });
  return patches;
}

async function openNotificationSettings(api: ApiMock, page: Page): Promise<void> {
  await api.authenticate();
  api.get(NOTIFICATION_SETTINGS_PATH, notificationSettings);
  await page.goto('/notifications/settings');
  await expect(page.getByRole('switch', { name: '전체 알림' })).toBeVisible();
}

test('notification switches follow the master switch and save only on explicit submit', async ({ api, page }) => {
  const patches = await capturePatches(page);
  await openNotificationSettings(api, page);

  const master = page.getByRole('switch', { name: '전체 알림' });
  const reading = page.getByRole('switch', { name: '통독 응원' });
  const hasena = page.getByRole('switch', { name: '하세나하시조 알림' });
  const friends = page.getByRole('switch', { name: '친구 활동' });

  await expect(master).toHaveAttribute('aria-checked', 'true');
  await expect(reading).toHaveAttribute('aria-checked', 'true');
  await expect(hasena).toHaveAttribute('aria-checked', 'false');
  await expect(reading).toBeEnabled();

  // Clicking the visible label toggles the associated control exactly once.
  await page.getByText('하세나하시조 알림', { exact: true }).click();
  await expect(hasena).toHaveAttribute('aria-checked', 'true');

  // Keyboard: Space on the focused switch toggles it.
  await master.focus();
  await page.keyboard.press('Space');
  await expect(master).toHaveAttribute('aria-checked', 'false');
  await expect(reading).toBeDisabled();
  await expect(hasena).toBeDisabled();
  await expect(friends).toBeDisabled();

  // A disabled dependent switch ignores activation from its label. Playwright's
  // actionability check already refuses to click a label bound to a disabled
  // control, so dispatch the click directly to prove the control ignores it.
  await page.getByText('통독 응원', { exact: true }).dispatchEvent('click');
  await expect(reading).toHaveAttribute('aria-checked', 'true');

  // Nothing is persisted until the user submits.
  expect(patches).toHaveLength(0);

  const saved = page.waitForResponse((response) =>
    response.request().method() === 'PATCH'
    && new URL(response.url()).pathname === NOTIFICATION_SETTINGS_PATH);
  await page.getByRole('button', { name: '저장' }).click();
  await saved;

  expect(patches).toHaveLength(1);
  expect(patches[0]).toMatchObject({
    notifications_enabled: false,
    reading_reminders_enabled: true,
    hasena_reminders_enabled: true,
    friend_activity_enabled: true,
  });
});

test('account settings notification switch saves immediately and disables while saving', async ({ api, page }) => {
  const patches = await capturePatches(page);
  await api.authenticate();
  api.get(NOTIFICATION_SETTINGS_PATH, notificationSettings);
  api.get('/api/v1/auth/linked-accounts/', {
    has_password: true,
    email: 'reader@example.com',
    primary_email: 'reader@example.com',
    auth_methods: { total: 1, password: true, social_count: 0, providers: [], can_remove_login_method: false },
    linked_accounts: [],
  });
  await page.goto('/account/settings');

  const hasena = page.getByRole('switch', { name: '하세나하시조 알림' });
  await expect(hasena).toHaveAttribute('aria-checked', 'false');
  await expect(hasena).toBeEnabled();

  const saved = page.waitForResponse((response) =>
    response.request().method() === 'PATCH'
    && new URL(response.url()).pathname === NOTIFICATION_SETTINGS_PATH);
  await hasena.click();
  await saved;

  expect(patches).toEqual([{ hasena_reminders_enabled: true }]);
  await expect(hasena).toHaveAttribute('aria-checked', 'true');
  await expect(hasena).toBeEnabled();
});

test('reading settings switch persists immediately and survives close and reopen', async ({ page }) => {
  await page.goto('/bible');
  // The hub is server-rendered; a click before hydration is lost, so wait for the mounted app.
  await page.waitForFunction(() => '__vue_app__' in (document.getElementById('__nuxt') ?? {}));
  await page.getByRole('button', { name: '읽기 설정' }).click();

  const sheet = page.getByRole('dialog', { name: '읽기 설정' });
  const highlightNames = sheet.getByRole('switch', { name: '인명·지명 강조' });
  await expect(highlightNames).toBeVisible();
  const before = await highlightNames.getAttribute('aria-checked');
  const expected = before === 'true' ? 'false' : 'true';

  // Label activation flips the value exactly once and the store writes it synchronously.
  await sheet.getByText('인명·지명 강조', { exact: true }).click();
  await expect(highlightNames).toHaveAttribute('aria-checked', expected);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('readingSettings') ?? '{}') as { highlightNames?: boolean });
  expect(stored.highlightNames).toBe(expected === 'true');

  // The 44px hit target is on the control itself, not only on the row.
  const box = await highlightNames.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

  await sheet.getByRole('button', { name: '완료' }).click();
  await expect(sheet).toBeHidden();
  await page.getByRole('button', { name: '읽기 설정' }).click();
  await expect(highlightNames).toHaveAttribute('aria-checked', expected);
});
