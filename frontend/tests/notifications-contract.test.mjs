import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

const headerSource = await readFile(
  new URL('../app/components/Header.vue', import.meta.url),
  'utf8',
);
const menuSource = await readFile(
  new URL('../app/components/Menu.vue', import.meta.url),
  'utf8',
);
const notificationsPageSource = await readFile(
  new URL('../app/pages/notifications/index.vue', import.meta.url),
  'utf8',
);
const notificationSettingsSource = await readFile(
  new URL('../app/pages/notifications/settings.vue', import.meta.url),
  'utf8',
);
const notificationsStoreSource = await readFile(
  new URL('../app/stores/notifications.ts', import.meta.url),
  'utf8',
);
const devicePushRuntimeSource = await readFile(
  new URL('../app/utils/devicePushRuntime.ts', import.meta.url),
  'utf8',
);
const devicePushSettingSource = await readFile(
  new URL('../app/components/notifications/DevicePushSetting.vue', import.meta.url),
  'utf8',
);
const notificationServiceWorkerSource = await readFile(
  new URL('../public/notification-sw.js', import.meta.url),
  'utf8',
);
const pageHeaderSource = await readFile(
  new URL('../app/components/PageHeader.vue', import.meta.url),
  'utf8',
);

const settings = {
  notifications_enabled: true,
  reading_reminders_enabled: true,
  hasena_reminders_enabled: true,
  friend_activity_enabled: true,
  reading_reminder_time: '20:00:00',
  hasena_reminder_time: '07:00:00',
  timezone: 'Asia/Seoul',
};

async function loadNotificationsStore() {
  const result = await build({
    entryPoints: [new URL('../app/stores/notifications.ts', import.meta.url).pathname],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'notification-store-test-stubs',
        setup(pluginBuild) {
          pluginBuild.onResolve({ filter: /^pinia$/ }, () => ({
            path: 'pinia',
            namespace: 'stubs',
          }));
          pluginBuild.onLoad({ filter: /^pinia$/, namespace: 'stubs' }, () => ({
            contents: `
              export function defineStore(_id, options) {
                return function useStore() {
                  const store = options.state();
                  for (const [key, getter] of Object.entries(options.getters || {})) {
                    Object.defineProperty(store, key, { get: () => getter(store) });
                  }
                  for (const [key, action] of Object.entries(options.actions || {})) {
                    store[key] = action.bind(store);
                  }
                  return store;
                }
              }
            `,
          }));
          pluginBuild.onResolve({ filter: /^~\/composables\/useApi$/ }, () => ({
            path: 'useApi',
            namespace: 'stubs',
          }));
          pluginBuild.onLoad({ filter: /^useApi$/, namespace: 'stubs' }, () => ({
            contents: 'export function useApi() { return globalThis.__notificationApiMock; }',
          }));
          pluginBuild.onResolve({ filter: /^~\/utils\/devicePushRuntime$/ }, () => ({
            path: 'devicePushRuntime',
            namespace: 'stubs',
          }));
          pluginBuild.onLoad({ filter: /^devicePushRuntime$/, namespace: 'stubs' }, () => ({
            contents: `
              export function isDevicePushSupported() { return false; }
              export async function readBrowserPushState() {
                return { supported: false, permission: 'unsupported', subscribed: false };
              }
              export async function subscribeCurrentDevice() {}
              export async function unsubscribeCurrentDevice() {}
            `,
          }));
        },
      },
    ],
  });

  const tempDir = await mkdtemp(join(tmpdir(), 'notifications-store-'));
  const modulePath = join(tempDir, 'notifications-store.mjs');
  await writeFile(modulePath, result.outputFiles[0].text, 'utf8');
  return import(pathToFileURL(modulePath).href);
}

test('header and menu expose a notification center without adding a bottom navigation tab', () => {
  assert.match(headerSource, /NotificationBell/);
  assert.match(headerSource, /to="\/notifications"/);
  assert.match(pageHeaderSource, /NotificationBell/);
  assert.match(pageHeaderSource, /to="\/notifications"/);
  assert.match(pageHeaderSource, /:aria-label="notificationLinkLabel"/);
  assert.match(pageHeaderSource, /읽지 않은 알림 \$\{unreadCount\}개/);
  assert.match(menuSource, /BellIcon/);
  assert.match(menuSource, /알림/);
});

test('notification store models inbox, read state, and user settings contracts', () => {
  for (const typeName of ['NotificationItem', 'NotificationSettings', 'NotificationInboxResponse', 'DevicePushState']) {
    assert.match(notificationsStoreSource, new RegExp(`interface ${typeName}\\b`));
  }
  assert.match(notificationsStoreSource, /fetchInbox\(/);
  assert.match(notificationsStoreSource, /markAsRead\(/);
  assert.match(notificationsStoreSource, /updateSettings\(/);
  assert.match(notificationsStoreSource, /enableDevicePush\(/);
  assert.match(notificationsStoreSource, /disableDevicePush\(/);
  assert.match(devicePushRuntimeSource, /\/api\/v1\/todos\/notifications\/push\/subscriptions\//);
  assert.match(devicePushRuntimeSource, /navigator\.serviceWorker\.register\('\/notification-sw\.js',\s*\{\s*scope:\s*'\/'\s*\}\)/);
  assert.match(devicePushRuntimeSource, /navigator\.serviceWorker\.ready/);
  assert.doesNotMatch(notificationsStoreSource, /:\s*any\b|ref<any>|catch\s*\([^)]*:\s*any\)/);
  assert.doesNotMatch(devicePushRuntimeSource, /:\s*any\b|ref<any>|catch\s*\([^)]*:\s*any\)/);
});

test('notification store applies API responses, rollbacks failed reads, and rejects unauthenticated payloads', async () => {
  const { useNotificationsStore } = await loadNotificationsStore();
  const store = useNotificationsStore();
  const notifications = [
    {
      id: 1,
      type: 'reading_reminder',
      title: '오늘의 통독이 기다리고 있어요',
      body: '오늘 배정된 말씀을 읽고 흐름을 이어가볼까요?',
      target_url: '/plan',
      data: {},
      actor_name: null,
      is_read: false,
      read_at: null,
      created_at: '2026-06-21T10:00:00Z',
    },
  ];

  globalThis.__notificationApiMock = {
    get: async () => ({
      data: {
        success: true,
        unread_count: 1,
        notifications,
        settings,
      },
    }),
    patch: async (url, payload) => {
      if (url.includes('/read/')) {
        throw new Error('network down');
      }
      return {
        success: true,
        settings: {
          ...settings,
          ...payload,
        },
      };
    },
    post: async () => ({ success: true }),
  };

  await store.fetchInbox();
  assert.equal(store.unreadCount, 1);
  assert.equal(store.settings.reading_reminder_time, '20:00:00');

  await store.markAsRead(1);
  assert.equal(store.notifications[0].is_read, false);
  assert.equal(store.notifications[0].read_at, null);
  assert.equal(store.unreadCount, 1);
  assert.equal(store.error, 'network down');

  const result = await store.updateSettings({ friend_activity_enabled: false });
  assert.deepEqual(result, { success: true });
  assert.equal(store.settings.friend_activity_enabled, false);

  globalThis.__notificationApiMock.patch = async () => ({
    success: false,
    message: 'Invalid timezone',
  });
  const failedUpdate = await store.updateSettings({ timezone: 'Not/AZone' });
  assert.deepEqual(failedUpdate, { success: false, error: 'Invalid timezone' });
  assert.equal(store.error, 'Invalid timezone');

  const unauthenticatedStore = useNotificationsStore();
  globalThis.__notificationApiMock = {
    get: async () => ({
      data: {
        success: false,
        message: 'Authentication required',
      },
    }),
  };

  await unauthenticatedStore.fetchInbox();
  assert.equal(unauthenticatedStore.error, 'Authentication required');
  assert.equal(unauthenticatedStore.notifications.length, 0);
});

test('notification pages render CJK-safe Korean inbox and settings controls', () => {
  assert.match(notificationsPageSource, />알림</);
  assert.match(notificationsPageSource, /새로운 알림이 없어요/);
  assert.match(notificationsPageSource, /word-break:\s*keep-all/);
  assert.match(notificationSettingsSource, />알림 설정</);
  for (const label of ['현재 기기 푸시 알림', '전체 알림', '통독 응원', '하세나하시조 알림', '친구 활동']) {
    assert.match(`${notificationSettingsSource}\n${devicePushSettingSource}`, new RegExp(label));
  }
  assert.match(notificationSettingsSource, /type="time"/);
});

test('notification service worker displays OS notifications and opens app routes', () => {
  assert.match(notificationServiceWorkerSource, /addEventListener\('push'/);
  assert.match(notificationServiceWorkerSource, /showNotification\(title,\s*options\)/);
  assert.match(notificationServiceWorkerSource, /addEventListener\('notificationclick'/);
  assert.match(notificationServiceWorkerSource, /clients\.matchAll/);
  assert.match(notificationServiceWorkerSource, /clients\.openWindow/);
  assert.match(notificationServiceWorkerSource, /url\.origin !== self\.location\.origin/);
  assert.match(notificationServiceWorkerSource, /\/notifications/);
});
