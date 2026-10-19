const assert = require('node:assert/strict');
const test = require('node:test');

const { instantiateClosure } = require('./helpers/appClosureHarness.cjs');

test('successful Kakao return navigates the issued session bridge immediately', async () => {
  const observations = {
    navigateCount: 0,
    showLogin: [],
  };
  // completeLogin is the post-login seam inside LoginScreen: bridge, persist
  // the session, dismiss the modal, then navigate the WebView.
  const completeLogin = instantiateClosure('completeLogin', {
    initiateSessionBridge: async () => true,
    signInWithTokens: async () => {},
    dismissLogin: () => observations.showLogin.push(false),
    navigateToPendingUrl: () => {
      observations.navigateCount += 1;
    },
    controller: { remountWebView: () => {} },
  });
  const handleKakaoLogin = instantiateClosure('handleKakaoLogin', {
    kakaoLogin: async () => ({ accessToken: 'kakao-access' }),
    setIsSubmitting: () => {},
    API_URL: 'https://api.maeil1dok.app',
    NATIVE_CLIENT_OBSERVATION_HEADERS: {
      'X-Client': 'shell',
      'X-App-Platform': 'android',
      'X-App-Version': '1.2.3',
    },
    fetch: async () => ({
      json: async () => ({
        access: 'maeil-access',
        refresh: 'maeil-refresh',
      }),
    }),
    completeLogin,
    navigateToSocialSignup: () => {},
    formatNativeAuthError: (data, fallback) => fallback,
    WEB_APP_URL: 'https://maeil1dok.app',
    Alert: { alert: () => {} },
    isErrorWithCode: () => false,
    console: { error: () => {} },
  });

  await handleKakaoLogin();

  assert.equal(observations.navigateCount, 1);
  assert.deepEqual(observations.showLogin, [false]);
});

test('pending bridge URL survives until the hidden WebView remounts', () => {
  const consumeUrl = 'https://api.example.test/session/consume/?code=one-time';
  const pendingUrlRef = { current: consumeUrl };
  const pendingStates = [];
  const injected = [];
  const webViewRef = { current: null };
  const navigateToPendingUrl = instantiateClosure('navigateToPendingUrl', {
    pendingUrlRef,
    setPendingUrl: (value) => pendingStates.push(value),
    webViewRef,
    firstLoadDoneRef: { current: true },
    JSON,
  });

  navigateToPendingUrl();
  assert.equal(pendingUrlRef.current, consumeUrl);
  assert.deepEqual(pendingStates, []);

  webViewRef.current = {
    injectJavaScript: (script) => injected.push(script),
  };
  navigateToPendingUrl();

  assert.equal(pendingUrlRef.current, null);
  assert.deepEqual(pendingStates, [null]);
  assert.equal(injected.length, 1);
  assert.match(injected[0], /session\/consume/);
});

test('pending URL is not consumed before the first loadEnd', () => {
  // Regression: a menu tap queues /notice while the WebView is still on its
  // initial load. Injecting then loses the navigation silently — the URL must
  // stay queued until handleLoadEnd flips firstLoadDoneRef.
  const pendingUrlRef = { current: 'https://web.example.test/notice' };
  const injected = [];
  const webViewRef = {
    current: { injectJavaScript: (script) => injected.push(script) },
  };
  const firstLoadDoneRef = { current: false };
  const navigateToPendingUrl = instantiateClosure('navigateToPendingUrl', {
    pendingUrlRef,
    setPendingUrl: () => {},
    webViewRef,
    firstLoadDoneRef,
    JSON,
  });

  navigateToPendingUrl();
  assert.equal(pendingUrlRef.current, 'https://web.example.test/notice');
  assert.equal(injected.length, 0);

  firstLoadDoneRef.current = true;
  navigateToPendingUrl();
  assert.equal(pendingUrlRef.current, null);
  assert.equal(injected.length, 1);
  assert.match(injected[0], /notice/);
});

test('session bridge preserves a queued destination as the consume next', async () => {
  const pendingUrlRef = { current: 'https://web.example.test/notice' };
  const initiateSessionBridge = instantiateClosure('initiateSessionBridge', {
    console: { error: () => {}, log: () => {} },
    SecureStore: { setItemAsync: async () => {} },
    CookieManager: { get: async () => ({}) },
    API_URL: 'https://api.example.test',
    NATIVE_CLIENT_OBSERVATION_HEADERS: {},
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ code: 'one-time' }),
    }),
    csrfHeadersFrom: () => ({}),
    WEB_APP_URL: 'https://web.example.test',
    buildSessionBridgeConsumeUrl: ({ apiUrl, code, currentUrl }) =>
      `${apiUrl}/api/v1/auth/session/consume/?code=${code}&next=${encodeURIComponent(currentUrl)}`,
    currentWebViewUrlRef: { current: 'https://web.example.test/' },
    pendingUrlRef,
    setPendingUrl: () => {},
  });

  assert.equal(await initiateSessionBridge('access', 'refresh'), true);
  const consumeUrl = new URL(pendingUrlRef.current);
  assert.equal(consumeUrl.searchParams.get('next'), 'https://web.example.test/notice');
});

test('session bridge never reuses a stale consume URL as next', async () => {
  const staleConsume = 'https://api.example.test/api/v1/auth/session/consume/?code=spent';
  const pendingUrlRef = { current: staleConsume };
  const initiateSessionBridge = instantiateClosure('initiateSessionBridge', {
    console: { error: () => {}, log: () => {} },
    SecureStore: { setItemAsync: async () => {} },
    CookieManager: { get: async () => ({}) },
    API_URL: 'https://api.example.test',
    NATIVE_CLIENT_OBSERVATION_HEADERS: {},
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ code: 'fresh-code' }),
    }),
    csrfHeadersFrom: () => ({}),
    WEB_APP_URL: 'https://web.example.test',
    buildSessionBridgeConsumeUrl: ({ apiUrl, code, currentUrl }) =>
      `${apiUrl}/api/v1/auth/session/consume/?code=${code}&next=${encodeURIComponent(currentUrl)}`,
    currentWebViewUrlRef: { current: 'https://web.example.test/' },
    pendingUrlRef,
    setPendingUrl: () => {},
  });

  assert.equal(await initiateSessionBridge('access', 'refresh'), true);
  const consumeUrl = new URL(pendingUrlRef.current);
  assert.equal(consumeUrl.searchParams.get('code'), 'fresh-code');
  assert.equal(consumeUrl.searchParams.get('next'), 'https://web.example.test/');
});

test('session bridge requests a frontend-relative redirect path', async () => {
  const pendingUrlRef = { current: null };
  const pendingStates = [];
  const initiateSessionBridge = instantiateClosure('initiateSessionBridge', {
    console: { error: () => {}, log: () => {} },
    SecureStore: { setItemAsync: async () => {} },
    CookieManager: { get: async () => ({}) },
    API_URL: 'https://api.example.test',
    NATIVE_CLIENT_OBSERVATION_HEADERS: {
      'X-Client': 'shell',
      'X-App-Platform': 'android',
      'X-App-Version': '1.2.3',
    },
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ code: 'one-time' }),
    }),
    csrfHeadersFrom: () => ({}),
    WEB_APP_URL: 'https://web.example.test',
    buildSessionBridgeConsumeUrl: ({ apiUrl, code }) =>
      `${apiUrl}/api/v1/auth/session/consume/?code=${code}&next=%2F`,
    currentWebViewUrlRef: { current: 'https://web.example.test/' },
    pendingUrlRef,
    setPendingUrl: (value) => pendingStates.push(value),
  });

  assert.equal(await initiateSessionBridge('access', 'refresh'), true);
  const consumeUrl = new URL(pendingUrlRef.current);
  assert.equal(consumeUrl.searchParams.get('next'), '/');
  assert.deepEqual(pendingStates, [pendingUrlRef.current]);
});
