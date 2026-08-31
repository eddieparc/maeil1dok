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
