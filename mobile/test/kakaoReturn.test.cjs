const assert = require('node:assert/strict');
const test = require('node:test');

const { instantiateClosure } = require('./helpers/appClosureHarness.cjs');

test('successful Kakao return navigates the issued session bridge immediately', async () => {
  const observations = {
    navigateCount: 0,
    showLogin: [],
  };
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
    initiateSessionBridge: async () => true,
    navigateToPendingUrl: () => {
      observations.navigateCount += 1;
    },
    setShowLogin: (value) => observations.showLogin.push(value),
    setWebViewKey: () => {},
    pendingUrlRef: { current: null },
    setPendingUrl: () => {},
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
