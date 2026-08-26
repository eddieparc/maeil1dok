import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { compileScript, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import { renderToString } from '@vue/server-renderer';

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
const notificationRuntimeSource = await readFile(
  new URL('../public/notificationRuntime.js', import.meta.url),
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

const vueRuntimeExports = Object.keys(Vue)
  .filter(name => /^[A-Za-z_$][\w$]*$/.test(name) && name !== 'default')
  .map(name => `export const ${name} = globalThis.__notificationsVueRuntime.${name};`)
  .join('\n');

globalThis.__notificationsVueRuntime = Vue;
globalThis.useHead = () => {};

function notificationComponentStub(path) {
  if (path.endsWith('/PageLayout.vue')) {
    return `
      import { h } from 'vue';
      export default (props, { slots }) => h('main', [h('h1', props.title), slots.default?.()]);
    `;
  }
  if (path.endsWith('/EmptyState.vue')) {
    return `
      import { h } from 'vue';
      export default props => h('section', [h('h2', props.title), h('p', props.description)]);
    `;
  }
  if (path.endsWith('/NotificationBell.vue')) {
    return `
      import { h } from 'vue';
      export default props => h('span', { 'data-unread-count': props.count }, '알림');
    `;
  }
  return 'export default () => null;';
}

async function compileNotificationComponent(source, filename) {
  const { descriptor, errors } = parse(source, { filename });
  assert.deepEqual(errors, [], `${filename} should parse`);

  const compiled = compileScript(descriptor, {
    id: `notifications-${filename}`,
    inlineTemplate: true,
  });
  const result = await build({
    stdin: {
      contents: compiled.content,
      loader: 'ts',
      resolveDir: new URL('../', import.meta.url).pathname,
      sourcefile: filename,
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'notification-ssr-stubs',
        setup(pluginBuild) {
          pluginBuild.onResolve({ filter: /^vue$/ }, () => ({
            path: 'vue',
            namespace: 'notification-vue',
          }));
          pluginBuild.onLoad({ filter: /.*/, namespace: 'notification-vue' }, () => ({
            contents: vueRuntimeExports,
          }));
          pluginBuild.onResolve({ filter: /^vue-router$/ }, () => ({
            path: 'vue-router',
            namespace: 'notification-runtime',
          }));
          pluginBuild.onResolve({ filter: /^~\/composables\/useAuthService$/ }, () => ({
            path: 'auth',
            namespace: 'notification-runtime',
          }));
          pluginBuild.onResolve({ filter: /^~\/composables\/useNavigation$/ }, () => ({
            path: 'navigation',
            namespace: 'notification-runtime',
          }));
          pluginBuild.onResolve({ filter: /^~\/composables\/useToast$/ }, () => ({
            path: 'toast',
            namespace: 'notification-runtime',
          }));
          pluginBuild.onResolve({ filter: /^~\/stores\/notifications$/ }, () => ({
            path: 'notifications-store',
            namespace: 'notification-runtime',
          }));
          pluginBuild.onResolve({ filter: /^~\/stores\/readingSettings$/ }, () => ({
            path: 'reading-settings',
            namespace: 'notification-runtime',
          }));
          pluginBuild.onLoad({ filter: /.*/, namespace: 'notification-runtime' }, ({ path }) => {
            const stubs = {
              'vue-router': `
                export const useRoute = () => globalThis.__notificationRoute;
                export const useRouter = () => globalThis.__notificationRouter;
              `,
              auth: 'export const useAuthService = () => globalThis.__notificationAuth;',
              navigation: 'export const useNavigation = () => ({ goBack: () => {} });',
              toast: 'export const useToast = () => globalThis.__notificationToast;',
              'notifications-store': 'export const useNotificationsStore = () => globalThis.__notificationStore;',
              'reading-settings': 'export const useReadingSettingsStore = () => globalThis.__notificationReadingSettingsStore;',
            };
            return { contents: stubs[path] };
          });
          pluginBuild.onResolve({ filter: /^@lucide\/vue$/ }, () => ({
            path: 'lucide',
            namespace: 'notification-lucide',
          }));
          pluginBuild.onLoad({ filter: /.*/, namespace: 'notification-lucide' }, () => ({
            contents: `
              import { h } from 'vue';
              const Icon = (_props, { attrs }) => h('svg', attrs);
              export {
                Icon as BellIcon,
                Icon as BookOpenIcon,
                Icon as CalendarDaysIcon,
                Icon as CheckCircleIcon,
                Icon as ClipboardListIcon,
                Icon as ListIcon,
                Icon as LogInIcon,
                Icon as LogOutIcon,
                Icon as MenuIcon,
                Icon as MessageCircleIcon,
                Icon as MoonIcon,
                Icon as SettingsIcon,
                Icon as SunIcon,
                Icon as UserIcon,
                Icon as UserRoundPlusIcon,
                Icon as UsersIcon,
                Icon as XIcon,
              };
            `,
          }));
          pluginBuild.onResolve({ filter: /^~\/.*\.vue$/ }, ({ path }) => ({
            path,
            namespace: 'notification-component',
          }));
          pluginBuild.onResolve({ filter: /^\.\.\/common\/EmptyState\.vue$/ }, ({ path }) => ({
            path,
            namespace: 'notification-component',
          }));
          pluginBuild.onLoad({ filter: /.*/, namespace: 'notification-component' }, ({ path }) => ({
            contents: notificationComponentStub(path),
          }));
        },
      },
    ],
  });

  const dataUrl = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`;
  return (await import(dataUrl)).default;
}

async function loadNotificationTargetRuntime() {
  const result = await build({
    stdin: {
      contents: notificationRuntimeSource,
      loader: 'js',
      sourcefile: 'notificationRuntime.js',
    },
    bundle: false,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
  });
  const previousSelf = globalThis.self;
  const workerScope = {};
  globalThis.self = workerScope;
  try {
    const dataUrl = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`;
    await import(dataUrl);
    return workerScope.resolveNotificationTargetUrl;
  } finally {
    globalThis.self = previousSelf;
  }
}

const [
  Header,
  Menu,
  NotificationsPage,
  NotificationSettingsPage,
  DevicePushSetting,
  PageHeader,
  notificationTargetRuntime,
] = await Promise.all([
  compileNotificationComponent(headerSource, 'Header.vue'),
  compileNotificationComponent(menuSource, 'Menu.vue'),
  compileNotificationComponent(notificationsPageSource, 'notifications-index.vue'),
  compileNotificationComponent(notificationSettingsSource, 'notification-settings.vue'),
  compileNotificationComponent(devicePushSettingSource, 'DevicePushSetting.vue'),
  compileNotificationComponent(pageHeaderSource, 'PageHeader.vue'),
  loadNotificationTargetRuntime(),
]);

const NuxtLinkStub = Vue.defineComponent({
  name: 'NuxtLink',
  inheritAttrs: false,
  props: {
    to: { type: [String, Object], required: true },
  },
  setup(props, { attrs, slots }) {
    return () => Vue.h(
      'a',
      { ...attrs, href: typeof props.to === 'string' ? props.to : props.to.path },
      slots.default?.(),
    );
  },
});

const ClientOnlyStub = Vue.defineComponent({
  name: 'ClientOnly',
  setup(_, { slots }) {
    return () => slots.default?.();
  },
});

const NuxtImgStub = Vue.defineComponent({
  name: 'NuxtImg',
  setup(_, { attrs }) {
    return () => Vue.h('img', attrs);
  },
});

async function renderNotificationComponent(component, props = {}) {
  const app = Vue.createSSRApp({
    render: () => Vue.h(component, props),
  });
  app.component('NuxtLink', NuxtLinkStub);
  app.component('ClientOnly', ClientOnlyStub);
  app.component('NuxtImg', NuxtImgStub);
  app.provide('toast', { value: { show: () => {} } });
  const context = {};
  const html = await renderToString(app, context);
  return `${html}${Object.values(context.teleports ?? {}).join('')}`;
}

function useNotificationFixtures() {
  const user = {
    id: 12,
    username: 'reader',
    nickname: '말씀 독자',
    email: 'reader@example.com',
  };
  globalThis.__notificationAuth = {
    user: { value: user },
    isAuthenticated: { value: true },
    logout: async () => {},
  };
  globalThis.__notificationStore = {
    notifications: [],
    unreadNotifications: [],
    unreadCount: 3,
    settings,
    isLoading: false,
    isSaving: false,
    error: null,
    devicePush: {
      supported: false,
      permission: 'unsupported',
      subscribed: false,
      isSyncing: false,
      error: null,
    },
    fetchInbox: async () => {},
    fetchSettings: async () => {},
    syncDevicePushState: async () => {},
    markAllAsRead: async () => {},
    markAsRead: async () => {},
    updateSettings: async () => ({ success: true }),
    enableDevicePush: async () => ({ success: true }),
    disableDevicePush: async () => ({ success: true }),
  };
  globalThis.__notificationReadingSettingsStore = {
    effectiveTheme: 'light',
    initialize: () => {},
    updateSetting: () => {},
  };
  globalThis.__notificationRoute = { path: '/' };
  globalThis.__notificationRouter = { push: () => {} };
  globalThis.__notificationToast = { success: () => {}, error: () => {} };
}

test('header and menu expose a notification center without adding a bottom navigation tab', async () => {
  useNotificationFixtures();
  const [headerHtml, pageHeaderHtml, menuHtml] = await Promise.all([
    renderNotificationComponent(Header),
    renderNotificationComponent(PageHeader, { title: '회사정보' }),
    renderNotificationComponent(Menu, { isOpen: true }),
  ]);

  assert.match(headerHtml, /<a[^>]*href="\/notifications"/, 'authenticated header should render the notification route');
  assert.match(pageHeaderHtml, /<a[^>]*href="\/notifications"/, 'page header should render the notification route');
  assert.match(pageHeaderHtml, /aria-label="읽지 않은 알림 3개"/, 'page header should expose the unread count as the link accessible name');
  assert.match(menuHtml, /<a[^>]*href="\/notifications"[^>]*>[\s\S]*?내 알림[\s\S]*?<\/a>/, 'authenticated menu should render a visible notification item');
});

test('notification store models inbox, read state, and user settings contracts', () => {
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
    // 프로덕션은 생성 타입 facade(GET/POST/PATCH/path)를 쓴다. 목도 같은 표면을 제공한다.
    path: (template, params) =>
      template.replace(/\{(\w+)\}/g, (_, key) => String(params[key])),
    GET: async () => ({
      data: {
        success: true,
        unread_count: 1,
        notifications,
        settings,
      },
    }),
    PATCH: async (url, payload) => {
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
    POST: async () => ({ success: true }),
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

  globalThis.__notificationApiMock.PATCH = async () => ({
    success: false,
    message: 'Invalid timezone',
  });
  const failedUpdate = await store.updateSettings({ timezone: 'Not/AZone' });
  assert.deepEqual(failedUpdate, { success: false, error: 'Invalid timezone' });
  assert.equal(store.error, 'Invalid timezone');

  const unauthenticatedStore = useNotificationsStore();
  globalThis.__notificationApiMock = {
    GET: async () => ({
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

test('notification pages render CJK-safe Korean inbox and settings controls', async () => {
  useNotificationFixtures();
  const [inboxHtml, settingsHtml, devicePushHtml] = await Promise.all([
    renderNotificationComponent(NotificationsPage),
    renderNotificationComponent(NotificationSettingsPage),
    renderNotificationComponent(DevicePushSetting),
  ]);

  assert.match(inboxHtml, /<h1>알림<\/h1>/, 'notification center should render its heading');
  assert.match(inboxHtml, />새로운 알림이 없어요</, 'empty inbox should render its guidance');
  assert.match(settingsHtml, /<h1>알림 설정<\/h1>/, 'notification settings should render its heading');
  for (const label of ['전체 알림', '통독 응원', '하세나하시조 알림', '친구 활동']) {
    assert.match(settingsHtml, new RegExp(`>${label}<`), `notification settings should render ${label}`);
  }
  assert.match(devicePushHtml, />현재 기기 푸시 알림</, 'device push control should have a visible label');
  assert.match(settingsHtml, /<input[^>]*type="time"[^>]*value="20:00:00"/, 'reading reminder should render a time control with the saved value');
});

test('notification service worker displays OS notifications and opens app routes', async () => {
  assert.match(notificationServiceWorkerSource, /addEventListener\('push'/);
  assert.match(notificationServiceWorkerSource, /showNotification\(title,\s*options\)/);
  assert.match(notificationServiceWorkerSource, /addEventListener\('notificationclick'/);
  assert.match(notificationServiceWorkerSource, /clients\.matchAll/);
  assert.match(notificationServiceWorkerSource, /clients\.openWindow/);
  assert.match(notificationServiceWorkerSource, /\/notifications/);

  assert.equal(
    notificationTargetRuntime('/plan', 'https://maeil1dok.test'),
    'https://maeil1dok.test/plan',
  );
  assert.equal(
    notificationTargetRuntime('https://maeil1dok.test/friends', 'https://maeil1dok.test'),
    'https://maeil1dok.test/friends',
  );
  assert.equal(
    notificationTargetRuntime('https://attacker.example/phish', 'https://maeil1dok.test'),
    'https://maeil1dok.test/notifications',
  );
});
