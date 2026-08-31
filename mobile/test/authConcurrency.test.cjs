const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  createRestoreHarness,
  runStoredSessionRestore,
} = require('./helpers/sessionRestoreHarness.cjs');

test('concurrent stored-session restores share one in-flight operation', async () => {
  let releaseFetch;
  const fetchBarrier = new Promise((resolve) => {
    releaseFetch = resolve;
  });
  const { observations, restoreStoredSession } = createRestoreHarness({ fetchBarrier });

  const first = restoreStoredSession();
  const second = restoreStoredSession();
  const sharedPromise = first === second;

  releaseFetch();
  const results = await Promise.all([first, second]);

  assert.equal(sharedPromise, true, 'callers must receive the same in-flight promise');
  assert.deepEqual(results, [true, true]);
  assert.equal(observations.fetchCalls.length, 1, 'refresh token redemption must run once');
  assert.equal(observations.bridgeCalls.length, 1, 'session bridge must run once');
  assert.equal(observations.navigateCount, 1, 'WebView navigation must run once');
});

test('a later auth request does not refresh after the bridge sets cookies', async () => {
  const { observations, restoreStoredSession } = createRestoreHarness({
    cookieStores: [
      { csrftoken: { value: 'csrf-value' } },
      { csrftoken: { value: 'csrf-value' } },
      {
        access_token: { value: 'bridged-access' },
        refresh_token: { value: 'bridged-refresh' },
        csrftoken: { value: 'csrf-value' },
      },
    ],
  });

  assert.equal(await restoreStoredSession(), true);
  assert.equal(await restoreStoredSession(), false);
  assert.equal(observations.fetchCalls.length, 1, 'serial auth requests must not loop refresh');
  assert.equal(observations.bridgeCalls.length, 1, 'serial auth requests must not loop bridge');
});

test('logout invalidates a refresh response that completes later', async () => {
  let releaseFetch;
  let signalFetchStarted;
  let restoreIsCurrent = true;
  const fetchBarrier = new Promise((resolve) => {
    releaseFetch = resolve;
  });
  const fetchStarted = new Promise((resolve) => {
    signalFetchStarted = resolve;
  });
  const observations = {
    bridgeCalls: 0,
    navigateCalls: 0,
  };

  const restore = runStoredSessionRestore({
    apiUrl: 'https://api.maeil1dok.app',
    readRefreshToken: async () => 'stored-refresh',
    readCsrfHeaders: async () => ({}),
    fetchRefresh: async () => {
      signalFetchStarted();
      await fetchBarrier;
      return {
        ok: true,
        status: 200,
        json: async () => ({ access: 'late-access', refresh: 'late-refresh' }),
      };
    },
    initiateSessionBridge: async () => {
      observations.bridgeCalls += 1;
      return true;
    },
    navigateToPendingUrl: () => {
      observations.navigateCalls += 1;
    },
    abandonRestore: () => false,
    reportError: () => {},
    isRestoreCurrent: () => restoreIsCurrent,
  });

  await fetchStarted;
  restoreIsCurrent = false;
  releaseFetch();

  assert.equal(await restore, false, 'a post-logout refresh result must be discarded');
  assert.equal(observations.bridgeCalls, 0, 'late tokens must not repopulate SecureStore');
  assert.equal(observations.navigateCalls, 0, 'late restore must not navigate the WebView');
});
