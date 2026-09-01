const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createRestoreHarness } = require('./helpers/sessionRestoreHarness.cjs');

test('stored-session restore returns false without a refresh token', async () => {
  const { observations, restoreStoredSession } = createRestoreHarness({
    refreshToken: null,
  });

  assert.equal(await restoreStoredSession(), false);
  assert.equal(observations.fetchCalls.length, 0);
  assert.equal(observations.clearAllCount, 0);
  assert.deepEqual(observations.secureDeletes, []);
});

test('rejected stored-session restore preserves cookies and SecureStore', async () => {
  const { observations, restoreStoredSession } = createRestoreHarness({
    response: { ok: false, status: 401, body: {} },
  });

  assert.equal(await restoreStoredSession(), false);
  assert.equal(observations.fetchCalls.length, 1);
  assert.equal(observations.clearAllCount, 0);
  assert.deepEqual(observations.secureDeletes, []);
  assert.equal(observations.navigateCount, 0);
});

test('successful stored-session restore bridges rotated tokens then navigates', async () => {
  const { observations, restoreStoredSession } = createRestoreHarness();

  assert.equal(await restoreStoredSession(), true);
  assert.equal(observations.fetchCalls.length, 1);
  assert.deepEqual(observations.bridgeCalls, [['new-access', 'new-refresh']]);
  assert.equal(observations.navigateCount, 1);

  const request = observations.fetchCalls[0];
  assert.equal(request.url, 'https://api.maeil1dok.app/api/v1/auth/token/refresh/');
  assert.equal(request.options.credentials, 'include');
  assert.equal(request.options.headers['X-CSRFToken'], 'csrf-value');
  assert.equal(request.options.headers['X-Client'], 'shell');
  assert.equal(request.options.headers['X-App-Platform'], 'android');
  assert.equal(request.options.headers['X-App-Version'], '1.2.3');
  assert.deepEqual(JSON.parse(request.options.body), { refresh: 'stored-refresh' });
});

