import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, setup } from './helpers/reading-settings-harness.mjs';

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

test('native return flushes a debounced edit before reporting ready', { timeout: 2500 }, async t => {
  const h = setup(t);
  const store = h.fresh();
  await store.initialize();
  store.updateSetting('fontSize', 22);

  assert.equal(await store.flushPending(), true);

  assert.equal(h.patches.length, 1);
  assert.equal(h.server.font_size, 22);
  assert.equal(h.storage.has('readingSettings:pending'), false);
});

test('native return does not PATCH an unchanged stale snapshot', { timeout: 2500 }, async t => {
  const h = setup(t);
  const store = h.fresh();
  await store.initialize();
  h.server.font_size = 24;

  assert.equal(await store.flushPending(), true);

  assert.equal(h.patches.length, 0);
  assert.equal(h.server.font_size, 24);
});

test('native return waits for the in-flight write and the newer edit', { timeout: 2500 }, async t => {
  const h = setup(t);
  const store = h.fresh();
  await store.initialize();
  const firstAck = deferred();
  const secondAck = deferred();
  const secondStarted = deferred();
  const writes = [];
  runtime.api.PATCH = async (_path, body) => {
    writes.push(body);
    if (writes.length === 1) await firstAck.promise;
    else { secondStarted.resolve(); await secondAck.promise; }
    Object.assign(h.server, body);
    return { success: true };
  };
  store.updateSetting('fontSize', 20);
  const first = store.syncToServer();
  store.updateSetting('fontSize', 24);
  let returned = false;
  const closing = store.flushPending().then(result => { returned = true; return result; });

  firstAck.resolve();
  await first;
  await secondStarted.promise;
  assert.equal(returned, false);
  secondAck.resolve();

  assert.equal(await closing, true);
  assert.deepEqual(writes.map(body => body.font_size), [20, 24]);
  assert.equal(h.server.font_size, 24);
  assert.equal(h.storage.has('readingSettings:pending'), false);
});

test('failed save blocks ready and retains the edit for explicit retry', { timeout: 2500 }, async t => {
  const h = setup(t);
  const store = h.fresh();
  await store.initialize();
  const save = runtime.api.PATCH;
  runtime.api.PATCH = async () => { throw new Error('offline fixture'); };
  store.updateSetting('fontSize', 22);

  assert.equal(await store.flushPending(), false);
  assert.equal(store.settings.fontSize, 22);
  assert.equal(h.server.font_size, 18);
  assert.equal(h.storage.has('readingSettings:pending'), true);

  runtime.api.PATCH = save;
  assert.equal(await store.flushPending(), true);
  assert.equal(h.server.font_size, 22);
});

test('an owner change during saving cannot authorize the old native return', { timeout: 2500 }, async t => {
  const h = setup(t);
  const store = h.fresh();
  await store.initialize();
  const acknowledgement = deferred();
  const writes = [];
  runtime.api.PATCH = async (_path, body) => {
    writes.push({ userId: runtime.auth.user.value.id, body });
    await acknowledgement.promise;
    return { success: true };
  };
  store.updateSetting('fontSize', 21);
  const saving = store.syncToServer();
  const closing = store.flushPending();
  runtime.auth.user.value = { id: 8 };
  await store.onLogin();

  acknowledgement.resolve();
  await saving;

  assert.equal(await closing, false);
  assert.equal(store.settings.fontSize, 18);
  assert.deepEqual(writes.map(write => write.userId), [7]);
});

test('guest return keeps local preferences without issuing a member PATCH', { timeout: 2500 }, async t => {
  const h = setup(t);
  runtime.auth.isAuthenticated.value = false;
  const store = h.fresh();
  await store.initialize();
  store.updateSetting('fontSize', 23);

  assert.equal(await store.flushPending(), true);

  assert.equal(JSON.parse(h.storage.get('readingSettings')).fontSize, 23);
  assert.equal(h.patches.length, 0);
});
