const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadPush(options = {}) {
  const calls = [];
  const storage = options.storage ?? new Map();
  const modules = {
    'expo-notifications': {
      AndroidImportance: { DEFAULT: 3 },
      async getPermissionsAsync() {
        calls.push('read');
        return { status: options.permission ?? 'undetermined', granted: options.permission === 'granted' };
      },
      async requestPermissionsAsync() { calls.push('prompt'); return { status: 'granted', granted: true }; },
      async setNotificationChannelAsync() { calls.push('channel'); },
      async getExpoPushTokenAsync() {
        calls.push('token');
        options.onTokenRequested?.();
        return { data: 'ExpoPushToken[device]' };
      },
    },
    'expo-secure-store': {
      async getItemAsync(key) {
        if (options.storageError) throw new Error('keychain unavailable');
        return storage.get(key) ?? null;
      },
      async setItemAsync(key, value) { storage.set(key, value); },
    },
    'expo-crypto': { randomUUID: () => '4a27689b-0b9c-4c4e-b849-9bad38ca2dd9' },
    'expo-device': { isDevice: true },
    'expo-constants': { expoConfig: { extra: { eas: { projectId: 'qa' } } } },
    'react-native': { Platform: { OS: options.platform ?? 'ios' } },
  };
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../nativePush.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => modules[name], module, module.exports);
  return { ...module.exports, calls, storage };
}

function appClosure(name, context, ownerOverride) {
  const owner = ownerOverride ?? (['registerForPushNotifications', 'handleMessage'].includes(name)
    ? 'screens/WebViewScreen.tsx'
    : name === 'setBetaMode' ? 'navigation/AppStackContext.tsx'
      : 'App.tsx');
  const file = path.join(__dirname, '..', owner);
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function visit(node) {
    if (name === 'notificationEffect' && ts.isCallExpression(node)
      && node.expression.getText(source) === 'useEffect'
      && node.arguments[0]?.getText(source).includes('Notifications.addPushTokenListener')) {
      expression = node.arguments[0].getText(source);
    }
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) {
      expression = ts.isCallExpression(node.initializer)
        ? node.initializer.arguments[0].getText(source) : node.initializer.getText(source);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(expression, `App must wire ${name}`);
  const compiled = ts.transpileModule(`return (${expression})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Function(...Object.keys(context), compiled)(...Object.values(context));
}

test('startup token discovery never asks for notification permission', async () => {
  const native = loadPush();
  const injected = [];
  const register = appClosure('registerForPushNotifications', {
    WEB_APP_URL: 'https://maeil1dok.app',
    authStatus: 'signedIn',
    pushRuntime: { sync: () => native.readNativePushState('push:status', 'push:changed') },
    currentWebViewUrlRef: { current: 'https://maeil1dok.app/notifications/settings' },
    webViewRef: { current: { injectJavaScript: script => injected.push(script) } },
    ...native,
    setPushToken() {},
  });

  await register();

  assert.equal(native.calls.includes('prompt'), false);
  assert.equal(injected.length, 1);
});

test('repeated native token callbacks cannot recursively renew the Expo token', async () => {
  let listener;
  let tokenRequests = 0;
  const work = [];
  const native = loadPush({
    permission: 'granted',
    onTokenRequested() {
      // The iOS SDK emits didRegister on each token query, even for the same token.
      // Bound the faulty implementation so its repeated network calls can be asserted.
      if (++tokenRequests < 3) listener({ type: 'ios', data: 'same-apns-token' });
    },
  });
  const context = {
    WEB_APP_URL: 'https://maeil1dok.app',
    authStatus: 'signedIn',
    pushRuntime: { sync: () => native.readNativePushState('push:status', 'push:changed') },
    betaMode: false,
    currentWebViewUrlRef: { current: 'https://maeil1dok.app/' },
    webViewRef: { current: { injectJavaScript() {} } },
    handledNotificationRef: { current: null },
    lastNativePushTokenRef: { current: null },
    handleDeepLink() {},
    setPushToken() {},
    ...native,
    Notifications: {
      addNotificationResponseReceivedListener: () => ({ remove() {} }),
      getLastNotificationResponseAsync: async () => null,
      addPushTokenListener(callback) { listener = callback; return { remove() {} }; },
    },
    AppState: { addEventListener: () => ({ remove() {} }) },
  };
  const register = appClosure('registerForPushNotifications', context);
  context.registerForPushNotifications = () => {
    const pending = register();
    work.push(pending);
    return pending;
  };
  const cleanup = appClosure('notificationEffect', context)();
  listener({ type: 'ios', data: 'same-apns-token' });
  for (let index = 0; index < work.length; index++) await work[index];
  assert.equal(native.calls.filter(call => call === 'token').length, 1);
  cleanup();
});

test('Android explicit enable creates a channel before requesting permission and obtains a token', async () => {
  const native = loadPush({ platform: 'android' });

  const result = await native.readNativePushState('push:enable', 'enable-1');

  assert.deepEqual(native.calls, ['read', 'channel', 'prompt', 'channel', 'token']);
  assert.equal(result.permission, 'granted');
  assert.equal(result.token, 'ExpoPushToken[device]');
});

test('concurrent status calls share one durable installation identity', async () => {
  const native = loadPush();

  const [first, second] = await Promise.all([
    native.readNativePushState('push:status', 'one'),
    native.readNativePushState('push:status', 'two'),
  ]);

  assert.equal(first.installationId, second.installationId);
  assert.equal(native.storage.size, 1);
});

test('disable keeps the cached token to revoke its server registration without another prompt', async () => {
  const native = loadPush({ permission: 'granted' });
  await native.readNativePushState('push:status', 'initial');
  native.calls.length = 0;

  const disabled = await native.readNativePushState('push:disable', 'off');

  assert.equal(disabled.token, 'ExpoPushToken[device]');
  assert.deepEqual(native.calls, ['read']);
});

test('revoked permission after process restart retains the token needed for server revocation', async () => {
  const beforeRestart = loadPush({ permission: 'granted' });
  await beforeRestart.readNativePushState('push:status', 'before');
  const afterRestart = loadPush({ permission: 'denied', storage: beforeRestart.storage });

  const state = await afterRestart.readNativePushState('push:status', 'after');

  assert.equal(state.permission, 'denied');
  assert.equal(state.token, 'ExpoPushToken[device]');
  assert.equal(afterRestart.calls.includes('prompt'), false);
});

test('unavailable keychain returns a bridge error instead of an unhandled rejection', async () => {
  const native = loadPush({ storageError: true });

  const state = await native.readNativePushState('push:status', 'locked-device');

  assert.equal(state.requestId, 'locked-device');
  assert.equal(state.token, null);
  assert.equal(typeof state.error, 'string');
  assert.equal(native.calls.includes('prompt'), false);
});

test('push navigation stays inside known app routes and rejects lookalike origins', () => {
  const native = loadPush();
  assert.equal(native.pushDestination('/bible?book=jhn&chapter=3', 'https://maeil1dok.app', 'https://maeil1dok.app'),
    'maeil1dok://bible?book=jhn&chapter=3');
  for (const url of ['//evil.test/bible', '/\\evil.test/bible', 'https://evil.test/bible', '/auth/login', '/bibleevil']) {
    assert.equal(native.pushDestination(url, 'https://maeil1dok.app', 'https://maeil1dok.app'), null, url);
  }
  assert.equal(native.isPushBridgeOrigin('https://maeil1dok.app.evil.test/', 'https://maeil1dok.app'), false);
  assert.equal(native.isPushBridgeOrigin('https://beta.maeil1dok.app/', 'https://maeil1dok.app'), false);
  assert.equal(native.isPushBridgeOrigin('https://maeil1dok.app/notifications', 'https://maeil1dok.app'), true);
});

test('a production notification cannot navigate the beta stack', () => {
  const native = loadPush();
  assert.equal(native.pushDestination('/hasena', 'https://beta.maeil1dok.app', 'https://maeil1dok.app'), null);
});

for (const [origin, nextOrigin] of [
  ['https://maeil1dok.app', 'https://beta.maeil1dok.app'],
  ['https://beta.maeil1dok.app', 'https://maeil1dok.app'],
  ['https://maeil1dok.app', 'https://maeil1dok.app'],
]) {
  test(`a disposed notification lookup cannot navigate after ${origin} changes to ${nextOrigin}`, { timeout: 5000 }, async () => {
    // Given: the original environment is still looking up its launch notification.
    const native = loadPush();
    let resolveResponse;
    const response = new Promise(resolve => { resolveResponse = resolve; });
    const currentWebViewUrlRef = { current: origin };
    const navigations = [];
    const handledNotificationRef = { current: null };
    const cleanup = appClosure('notificationEffect', {
      WEB_APP_URL: origin,
      betaMode: origin === 'https://beta.maeil1dok.app',
      currentWebViewUrlRef,
      handledNotificationRef,
      lastNativePushTokenRef: { current: null },
      handleDeepLink: event => navigations.push(event.url),
      registerForPushNotifications() {},
      ...native,
      Notifications: {
        addNotificationResponseReceivedListener: () => ({ remove() {} }),
        getLastNotificationResponseAsync: () => response,
        clearLastNotificationResponseAsync: async () => {},
        addPushTokenListener: () => ({ remove() {} }),
      },
      AppState: { addEventListener: () => ({ remove() {} }) },
    })();

    // When: the user switches environments before the old lookup resolves.
    currentWebViewUrlRef.current = nextOrigin;
    cleanup();
    resolveResponse({
      notification: { request: {
        identifier: 'old-environment-notification',
        content: { data: { origin, url: '/bible?book=jhn&chapter=3' } },
      } },
    });
    await response;

    // Then: the obsolete callback neither navigates nor consumes that notification.
    assert.deepEqual(navigations, []);
    assert.equal(handledNotificationRef.current, null);
  });
}

test('a cold-start deep link is retained until native navigation is ready', () => {
  const pendingDeepLinkRef = { current: null };
  const handle = appClosure('handleDeepLink', {
    WEB_APP_URL: 'https://maeil1dok.app',
    APP_SCHEME: 'maeil1dok',
    navigationRef: { isReady: () => false },
    pendingDeepLinkRef,
    mapWebPathToRoute: () => ({ type: 'web' }),
    controllerRef: { current: { navigateToUrl() {} } },
    buildDeepLinkNavigationUrl: (url, origin) => new URL(url.replace('maeil1dok://', ''), origin).href,
    buildLocationAssignmentScript: url => `window.location.href=${JSON.stringify(url)}`,
  });

  handle({ url: 'maeil1dok://bible?book=jhn&chapter=3' });

  assert.equal(pendingDeepLinkRef.current, 'maeil1dok://bible?book=jhn&chapter=3');
});

test('a ready notification destination retains the requested chapter in the reader', () => {
  const destinations = [];
  const handle = appClosure('handleDeepLink', {
    WEB_APP_URL: 'https://maeil1dok.app',
    APP_SCHEME: 'maeil1dok',
    navigationRef: { isReady: () => true, navigate: (...args) => destinations.push(args) },
    pendingDeepLinkRef: { current: null },
    mapWebPathToRoute: () => ({ type: 'tab', name: 'Bible' }),
    controllerRef: { current: { navigateToUrl: url => destinations.push(url) } },
    buildDeepLinkNavigationUrl: () => 'https://maeil1dok.app/bible?book=jhn&chapter=3',
  });
  handle({ url: 'maeil1dok://bible?book=jhn&chapter=3' });
  assert.deepEqual(destinations, ['https://maeil1dok.app/bible?book=jhn&chapter=3']);
});

test('a cold notification is delivered once after native navigation becomes ready', { timeout: 5000 }, async () => {
  const origin = 'https://beta.maeil1dok.app';
  const native = loadPush();
  const response = { notification: { request: {
    identifier: 'cold-reading',
    content: { data: { origin, url: '/bible?book=jhn&chapter=3' } },
  } } };
  const launchResponse = Promise.resolve(response);
  const destinations = [];
  const pendingDeepLinkRef = { current: null };
  let ready = false;
  let receive;
  let cleared = 0;
  const context = {
    WEB_APP_URL: origin,
    APP_SCHEME: 'maeil1dok',
    betaMode: true,
    currentWebViewUrlRef: { current: origin },
    pendingDeepLinkRef,
    handledNotificationRef: { current: null },
    lastNativePushTokenRef: { current: null },
    navigationRef: { isReady: () => ready },
    mapWebPathToRoute: () => ({ type: 'tab', name: 'Bible' }),
    controllerRef: { current: { navigateToUrl: url => destinations.push(url) } },
    buildDeepLinkNavigationUrl: url => new URL(url.replace('maeil1dok://', ''), origin).href,
    registerForPushNotifications() {},
    ...native,
    Notifications: {
      addNotificationResponseReceivedListener(callback) {
        receive = callback;
        return { remove() {} };
      },
      getLastNotificationResponseAsync: () => launchResponse,
      clearLastNotificationResponseAsync: async () => { cleared++; },
      addPushTokenListener: () => ({ remove() {} }),
    },
    AppState: { addEventListener: () => ({ remove() {} }) },
  };
  context.handleDeepLink = appClosure('handleDeepLink', context);
  const cleanup = appClosure('notificationEffect', context)();
  try {
    await launchResponse;
    assert.deepEqual(destinations, []);
    ready = true;
    appClosure('handleNavigationReady', context)();
    receive(response);
    assert.deepEqual(destinations, [`${origin}/bible?book=jhn&chapter=3`]);
    assert.equal(cleared, 1);
    assert.equal(pendingDeepLinkRef.current, null);
  } finally {
    cleanup();
  }
});

test('beta toggle persists before remounting and clears the previous environment destination', { timeout: 5000 }, async () => {
  // Given: a cold-start destination is queued while durable storage is pending.
  let finishWrite;
  const write = new Promise(resolve => { finishWrite = resolve; });
  let finishSwitch;
  const switched = new Promise(resolve => { finishSwitch = resolve; });
  const modes = [];
  const pendingUrlRef = { current: 'https://maeil1dok.app/bible?book=jhn&chapter=3' };
  const pending = [];
  const currentWebViewUrlRef = { current: 'https://maeil1dok.app/' };
  const handle = appClosure('handleMessage', {
    isPushBridgeRequest: () => false,
    resolveStack: () => ({ web: 'https://beta.maeil1dok.app' }),
    setBetaMode: appClosure('setBetaMode', {
      transitionRef: { current: commit => commit() },
      BETA_MODE_STORAGE_KEY: 'maeil1dok_beta_mode',
      SecureStore: { setItemAsync: () => write },
      setBetaModeState: value => modes.push(value),
    }),
    pendingUrlRef,
    setPendingUrl: value => pending.push(value),
    firstLoadDoneRef: { current: true },
    currentWebViewUrlRef,
    setIsLoading() {},
    setWebViewKey: finishSwitch,
  });

  // When: beta is enabled before storage acknowledges the change.
  handle({ nativeEvent: { data: JSON.stringify({ type: 'beta:set', enabled: true }) } });
  try {
    assert.deepEqual(modes, []);
  } finally {
    finishWrite();
  }
  await switched;

  // Then: only the committed environment is mounted, without an old destination.
  assert.deepEqual(modes, [true]);
  assert.equal(currentWebViewUrlRef.current, 'https://beta.maeil1dok.app');
  assert.equal(pendingUrlRef.current, null);
  assert.deepEqual(pending, [null]);
});

test('foreground token refresh uses the single native registration owner', async () => {
  let synchronized = 0;
  const native = loadPush();
  const register = appClosure('registerForPushNotifications', {
    WEB_APP_URL: 'https://maeil1dok.app',
    authStatus: 'signedIn',
    currentWebViewUrlRef: { current: 'https://maeil1dok.app/' },
    webViewRef: { current: null },
    setPushToken() {},
    isPushBridgeOrigin: native.isPushBridgeOrigin,
    readNativePushState: async () => { throw new Error('bypassed registration owner'); },
    pushRuntime: {
      async sync() { synchronized++; return { token: 'ExpoPushToken[device]' }; },
    },
  });
  await register();
  assert.equal(synchronized, 1);
});

test('environment persistence waits for the native subscription transition', { timeout: 5000 }, async () => {
  let release;
  const suspended = new Promise(resolve => { release = resolve; });
  const events = [];
  const change = appClosure('setBetaMode', {
    transitionRef: { current: async commit => { await suspended; await commit(); } },
    SecureStore: { async setItemAsync() { events.push('persist'); } },
    BETA_MODE_STORAGE_KEY: 'beta',
    setBetaModeState() { events.push('switch'); },
  });
  const changed = change(true);
  try {
    assert.deepEqual(events, []);
  } finally {
    release();
  }
  await changed;
  assert.deepEqual(events, ['persist', 'switch']);
});

test('the profile tab beta control does not remount the old environment while switching', { timeout: 5000 }, async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const remounts = [];
  let didSwitch;
  const switched = new Promise(resolve => { didSwitch = resolve; });
  const handler = appClosure('handleMessage', {
    setBetaMode: () => pending,
    resolveStack: () => ({ web: 'https://beta.maeil1dok.app' }),
    currentUrlRef: { current: 'https://maeil1dok.app' },
    firstLoadDoneRef: { current: true },
    pendingUrlRef: { current: null },
    setIsLoading() {},
    setWebViewKey() { remounts.push('new'); didSwitch(); },
    isPushBridgeRequest: () => false,
  }, 'screens/WebViewTabScreen.tsx');
  handler({ nativeEvent: { data: JSON.stringify({ type: 'beta:set', enabled: true }) } });
  try {
    assert.deepEqual(remounts, []);
  } finally {
    release();
  }
  await switched;
  assert.deepEqual(remounts, ['new']);
});

test('signed-out profile can await a durable beta switch without a WebView', async () => {
  const changes = [];
  const toggle = appClosure('handleBetaToggle', {
    setBetaMode: async enabled => { changes.push(enabled); },
    Alert: { alert() {} },
  }, 'navigation/RootNavigator.tsx');
  await toggle(true);
  await toggle(false);
  assert.deepEqual(changes, [true, false]);
});
