import test from 'node:test';
import assert from 'node:assert/strict';
import { runtime, setup } from './helpers/reading-settings-harness.mjs';

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

test('reload before the debounce recovers the same users unacknowledged theme', async t => {
  const h = setup(t);
  const first = h.fresh();
  await first.initialize();
  first.updateSetting('theme', 'dark');
  h.server.font_size = 21;

  const reloaded = h.fresh();
  await reloaded.initialize();

  assert.equal(h.patches.length, 0);
  assert.equal(reloaded.settings.theme, 'dark');
  assert.equal(reloaded.settings.fontSize, 21);
  await reloaded.syncToServer();
  assert.equal(h.patches.length, 1);
  assert.equal(h.server.theme, 'dark');
  assert.equal(h.storage.has('readingSettings:pending'), false);

  h.server.theme = 'light';
  const afterAcknowledgement = h.fresh();
  await afterAcknowledgement.initialize();
  assert.equal(afterAcknowledgement.settings.theme, 'light');
});

test('another account cannot recover the previous accounts pending preference', async t => {
  const h = setup(t);
  const first = h.fresh();
  await first.initialize();
  first.updateSetting('theme', 'dark');
  runtime.auth.user.value = { id: 8 };

  const other = h.fresh();
  await other.initialize();

  assert.equal(other.settings.theme, 'light');
  assert.equal(h.patches.length, 0);
});

test('the login callback recovers pending edits before full store initialization', async t => {
  const h = setup(t);
  const first = h.fresh();
  await first.initialize();
  first.updateSetting('theme', 'dark');

  const reloaded = h.fresh();
  await reloaded.onLogin();

  assert.equal(reloaded.settings.theme, 'dark');
  assert.equal(h.patches.length, 0);
});

test('an account switch drops the previous accounts in-memory pending edit', async t => {
  const h = setup(t);
  const store = h.fresh();
  await store.initialize();
  store.updateSetting('theme', 'dark');
  runtime.auth.user.value = { id: 8 };

  await store.onLogin();

  assert.equal(store.settings.theme, 'light');
  assert.equal(h.patches.length, 0);
});

test('a late settings read cannot replace the next accounts preferences', { timeout: 3000 }, async t => {
  const h = setup(t);
  const store = h.fresh();
  const oldRead = deferred();
  const nextRead = deferred();
  let reads = 0;
  runtime.api.GET = async () => ++reads === 1
    ? oldRead.promise
    : { data: { success: true, data: { settings: { ...h.server } } } };
  const off = store.$onAction(({ name, after }) => {
    if (name === 'syncFromServer') after(() => {
      if (reads === 2 && !store.isLoading) { off(); nextRead.resolve(); }
    });
  });
  const initialize = store.initialize();
  runtime.auth.user.value = { id: 8 };
  await store.onLogin();
  oldRead.resolve({ data: { success: true, data: { settings: { ...h.server, theme: 'dark' } } } });

  await initialize;
  await nextRead.promise;

  assert.equal(store.settings.theme, 'light');
  assert.equal(reads, 2);
  assert.equal(h.patches.length, 0);
});

test('an old accounts acknowledgement cannot clear the next accounts same-valued edit', async t => {
  const h = setup(t);
  const store = h.fresh();
  await store.initialize();
  const oldWrite = deferred();
  const writes = [];
  runtime.api.PATCH = async (_path, body) => {
    writes.push({ userId: runtime.auth.user.value.id, body });
    return oldWrite.promise;
  };
  store.updateSetting('theme', 'dark');
  const firstWrite = store.syncToServer();
  runtime.auth.user.value = { id: 8 };
  await store.onLogin();
  store.updateSetting('theme', 'dark');
  oldWrite.resolve({ success: true });

  await firstWrite;

  assert.equal(JSON.parse(h.storage.get('readingSettings:pending')).userId, 8);
  await store.syncToServer();
  assert.deepEqual(writes.map(write => write.userId), [7, 8]);
  assert.equal(h.storage.has('readingSettings:pending'), false);
});

test('a journal does not apply to a different local settings snapshot', async t => {
  const h = setup(t);
  const first = h.fresh();
  await first.initialize();
  first.updateSetting('theme', 'dark');
  const changed = JSON.parse(h.storage.get('readingSettings'));
  h.storage.set('readingSettings', JSON.stringify({ ...changed, fontSize: 20 }));

  const reloaded = h.fresh();
  await reloaded.initialize();

  assert.equal(reloaded.settings.theme, 'light');
  assert.equal(h.patches.length, 0);
});

test('malformed recovery metadata cannot block authoritative settings', async t => {
  const h = setup(t);
  h.storage.set('readingSettings:pending', '{invalid');
  const store = h.fresh();

  await store.initialize();

  assert.equal(store.settings.theme, 'light');
  assert.equal(store.syncError, null);
  assert.equal(h.patches.length, 0);
});

test('recovery ignores keys outside the settings contract', async t => {
  const h = setup(t);
  const first = h.fresh();
  await first.initialize();
  first.updateSetting('theme', 'dark');
  const journal = JSON.parse(h.storage.get('readingSettings:pending'));
  h.storage.set('readingSettings:pending', JSON.stringify({ ...journal, keys: ['__proto__', 'notASetting'] }));

  const reloaded = h.fresh();
  await reloaded.initialize();

  assert.equal(reloaded.settings.theme, 'light');
  assert.equal(Object.hasOwn(reloaded.settings, 'notASetting'), false);
  assert.equal(h.patches.length, 0);
});
