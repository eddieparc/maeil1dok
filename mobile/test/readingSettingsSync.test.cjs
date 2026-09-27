const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

// allow: SIZE_OK — the bounded write scope assigns one test file; it includes
// the executable pre-change callback baseline and deterministic I/O harness.
function load(file) {
  const filename = path.resolve(__dirname, '..', file);
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  instance.require = (id) => id.startsWith('.')
    ? load(path.relative(path.join(__dirname, '..'), path.resolve(path.dirname(filename), `${id}.ts`)))
    : require(id);
  instance._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
  return instance.exports;
}

// Execute the existing callback, not a reimplementation or source assertion.
// This opt-in baseline remains reproducible without changing BibleScreen.
function baseline(deps) {
  const filename = path.join(__dirname, '../screens/BibleScreen.tsx');
  const source = fs.readFileSync(filename, 'utf8');
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'updateReadingSetting') {
      callback = node.initializer.arguments[0].getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(callback, 'existing settings callback is available');
  const { DEFAULT_READING_SETTINGS } = load('api/readingSettings.ts');
  const ref = { current: DEFAULT_READING_SETTINGS };
  const js = ts.transpileModule(`const update = ${callback};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const update = new Function('settingsRef', 'setReadingSettings', 'AsyncStorage',
    `${js}; return update;`)(ref, (value) => { ref.current = value; }, deps.storage);
  return { setSession: async () => {}, update: async (...args) => update(...args) };
}

const create = process.env.SETTINGS_SYNC_BASELINE === '1'
  ? baseline : load('api/readingSettingsSync.ts').createReadingSettingsSync;

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function response(settings = {}, status = 200, success = true) {
  return { ok: status < 400, status, json: async () => ({ success, data: { settings } }) };
}
function harness() {
  const calls = [];
  const writes = [];
  const storage = {
    value: null,
    async getItem(key) { assert.equal(key, 'readingSettings'); return this.value; },
    async setItem(key, value) {
      assert.equal(key, 'readingSettings');
      writes.push(JSON.parse(value));
      this.value = value;
    },
  };
  const apiFetch = async (url, init = {}) => {
    calls.push({ url, ...init, body: init.body && JSON.parse(init.body) });
    return response({ font_size: 18, font_family: 'pretendard', audio_playback_rate: 1.5 });
  };
  return { calls, writes, storage, apiFetch };
}

test('signed-in edit PATCHes only the dirty theme field', { timeout: 2000 }, async () => {
  const h = harness();
  const sync = create(h);
  await sync.setSession({ key: 'prod:A', apiFetch: h.apiFetch });
  await sync.update('theme', 'dark');
  assert.deepEqual(h.calls.filter(c => c.method === 'PATCH').map(c => c.body), [{ theme: 'dark' }]);
  assert.equal(h.calls[0].url, '/api/v1/auth/reading-settings/');
  assert.equal(h.calls[1].url, '/api/v1/auth/reading-settings/update/');
  assert.equal(h.writes.length, 0);
});

if (process.env.SETTINGS_SYNC_BASELINE !== '1') {
  test('GET500 remains retryable after PATCH200 and retry hydrates only unedited fields', { timeout: 2000 }, async () => {
    const h = harness();
    let reads = 0;
    const sync = create(h);
    await sync.setSession({ key: 'A', apiFetch: async (url, init) => {
      h.calls.push({ method: init.method, body: init.body && JSON.parse(init.body) });
      if (init.method === 'PATCH') return response();
      return ++reads === 1 ? response({}, 500)
        : response({ theme: 'light', font_size: 22, audio_playback_rate: 1.5 });
    } });
    const loadError = sync.getSnapshot().syncError;
    assert.equal(loadError.operation, 'load');
    await sync.update('theme', 'dark');
    assert.equal(sync.getSnapshot().syncError, loadError);
    await sync.retry();
    assert.equal(reads, 2);
    assert.equal(sync.getSnapshot().syncError, null);
    assert.equal(sync.getSnapshot().settings.theme, 'dark');
    assert.equal(sync.getSnapshot().settings.fontSize, 22);
    assert.equal(sync.getSnapshot().settings.audioPlaybackRate, 1.5);
    assert.deepEqual(h.calls.filter(c => c.method === 'PATCH').map(c => c.body), [{ theme: 'dark' }]);
  });

  test('late GET preserves an edit even after its PATCH acknowledgment', { timeout: 2000 }, async () => {
    const h = harness();
    const get = deferred();
    const sync = create(h);
    const ready = sync.setSession({ key: 'A', apiFetch: (url, init) =>
      init?.method === 'PATCH' ? h.apiFetch(url, init) : get.promise });
    await sync.update('fontSize', 20);
    get.resolve(response({ font_size: 18, theme: 'dark' }));
    await ready;
    assert.equal(sync.getSnapshot().settings.fontSize, 20);
    assert.equal(sync.getSnapshot().settings.theme, 'dark');
  });

  test('writes serialize; an old ack cannot clear a newer edit', { timeout: 2000 }, async () => {
    const h = harness();
    const first = deferred();
    const entered = deferred();
    let patches = 0;
    const sync = create(h);
    await sync.setSession({ key: 'A', apiFetch: async (url, init) => {
      if (init?.method !== 'PATCH') return response();
      h.calls.push(JSON.parse(init.body));
      if (++patches === 1) { entered.resolve(); return first.promise; }
      return response({ font_size: 18 });
    } });
    const save = sync.update('fontSize', 18);
    await entered.promise;
    const newer = sync.update('fontSize', 20);
    assert.equal(patches, 1);
    first.resolve(response({ font_size: 18 }));
    await Promise.all([save, newer]);
    assert.deepEqual(h.calls, [{ font_size: 18 }, { font_size: 20 }]);
    assert.equal(sync.getSnapshot().settings.fontSize, 20);
    await sync.retry();
    assert.equal(patches, 2);
  });

  test('PATCH failure retains edits and retry sends only dirty fields', { timeout: 2000 }, async () => {
    const h = harness();
    let fail = true;
    const sync = create(h);
    await sync.setSession({ key: 'A', apiFetch: async (url, init) => {
      if (init?.method !== 'PATCH') return response();
      h.calls.push(JSON.parse(init.body));
      return response({}, fail ? 500 : 200);
    } });
    await sync.update('fontSize', 20);
    assert.equal(sync.getSnapshot().settings.fontSize, 20);
    assert.ok(sync.getSnapshot().syncError);
    fail = false;
    await sync.retry();
    assert.deepEqual(h.calls, [{ font_size: 20 }, { font_size: 20 }]);
    assert.equal(sync.getSnapshot().syncError, null);
  });

  test('newer refresh wins when GET responses arrive backwards', { timeout: 2000 }, async () => {
    const h = harness();
    const old = deferred();
    const latest = deferred();
    let count = 0;
    const sync = create(h);
    const initial = sync.setSession({ key: 'A', apiFetch: () => ++count === 1 ? old.promise : latest.promise });
    const refreshed = sync.refresh();
    latest.resolve(response({ font_size: 22 }));
    await refreshed;
    old.resolve(response({ font_size: 18 }));
    await initial;
    assert.equal(sync.getSnapshot().settings.fontSize, 22);
  });

  test('account and stack changes discard old GET, ack and queued writes', { timeout: 2000 }, async () => {
    const h = harness();
    const oldGet = deferred();
    const oldPatch = deferred();
    const entered = deferred();
    const sync = create(h);
    const a = sync.setSession({ key: 'prod:A', apiFetch: (url, init) => {
      if (init?.method !== 'PATCH') return oldGet.promise;
      entered.resolve();
      return oldPatch.promise;
    } });
    const edit = sync.update('fontSize', 20);
    await entered.promise;
    const queued = sync.update('theme', 'dark');
    await sync.setSession({ key: 'beta:B', apiFetch: h.apiFetch });
    oldGet.resolve(response({ font_size: 24 }));
    oldPatch.resolve(response({}, 500));
    await Promise.all([a, edit, queued]);
    assert.equal(sync.getSnapshot().settings.fontSize, 18);
    assert.equal(sync.getSnapshot().settings.theme, 'light');
    assert.equal(sync.getSnapshot().syncError, null);
    assert.equal(h.calls.length, 1);
  });

  test('guest hydration merges edits and persists untouched stored fields', { timeout: 2000 }, async () => {
    const h = harness();
    const read = deferred();
    h.storage.getItem = () => read.promise;
    const sync = create(h);
    const ready = sync.setSession({ key: 'guest', apiFetch: null });
    const edit = sync.update('theme', 'dark');
    read.resolve(JSON.stringify({ fontSize: 21, audioPlaybackRate: 1.75 }));
    await Promise.all([ready, edit]);
    assert.equal(sync.getSnapshot().settings.fontSize, 21);
    assert.equal(sync.getSnapshot().settings.theme, 'dark');
    assert.equal(h.writes.at(-1).audioPlaybackRate, 1.75);
    const restarted = create(h);
    h.storage.getItem = async () => h.storage.value;
    await restarted.setSession({ key: 'guest', apiFetch: null });
    assert.equal(restarted.getSnapshot().settings.theme, 'dark');
    assert.equal(h.calls.length, 0);
  });

  test('guest writes serialize and storage errors remain retryable', { timeout: 2000 }, async () => {
    const h = harness();
    const write = deferred();
    const entered = deferred();
    let count = 0;
    h.storage.setItem = async (key, value) => {
      h.writes.push(JSON.parse(value));
      if (++count === 1) { entered.resolve(); await write.promise; }
    };
    const sync = create(h);
    await sync.setSession({ key: 'guest', apiFetch: null });
    const first = sync.update('fontSize', 18);
    await entered.promise;
    const second = sync.update('fontSize', 20);
    assert.equal(count, 1);
    write.reject(new Error('disk full'));
    await Promise.all([first, second]);
    assert.ok(sync.getSnapshot().syncError);
    await sync.retry();
    assert.equal(h.writes.at(-1).fontSize, 20);
    assert.equal(sync.getSnapshot().syncError, null);
  });

  test('invalid GET and success:false PATCH surface failure without losing edits', { timeout: 2000 }, async () => {
    const h = harness();
    const sync = create(h);
    await sync.setSession({ key: 'A', apiFetch: async () => response({}, 200, false) });
    assert.ok(sync.getSnapshot().syncError);
    await sync.update('theme', 'dark');
    assert.ok(sync.getSnapshot().syncError);
    assert.equal(sync.getSnapshot().settings.theme, 'dark');
  });

  test('dispose suppresses late responses and notifications', { timeout: 2000 }, async () => {
    const h = harness();
    const get = deferred();
    const sync = create(h);
    const pending = sync.setSession({ key: 'A', apiFetch: () => get.promise });
    let notifications = 0;
    sync.subscribe(() => { notifications++; });
    sync.dispose();
    get.resolve(response({ font_size: 24 }));
    await pending;
    assert.equal(notifications, 0);
    assert.equal(sync.getSnapshot().settings.fontSize, 16);
  });

  test('explicit default-valued edit wins over pending hydration', { timeout: 2000 }, async () => {
    const h = harness();
    const get = deferred();
    const sync = create(h);
    const pending = sync.setSession({ key: 'A', apiFetch: (url, init) =>
      init?.method === 'PATCH' ? h.apiFetch(url, init) : get.promise });
    await sync.update('theme', 'light');
    get.resolve(response({ theme: 'dark' }));
    await pending;
    assert.equal(sync.getSnapshot().settings.theme, 'light');
  });

  test('edit scheduled at ack notification cannot fall between write and cleanup', { timeout: 2000 }, async () => {
    const h = harness();
    const sync = create(h);
    await sync.setSession({ key: 'A', apiFetch: h.apiFetch });
    const updated = deferred();
    let queued = false;
    const unsubscribe = sync.subscribe(() => {
      if (h.calls.length === 2 && !queued) {
        queued = true;
        Promise.resolve().then(() => sync.update('fontSize', 22)).then(updated.resolve, updated.reject);
      }
    });
    await sync.update('fontSize', 20);
    await updated.promise;
    unsubscribe();
    assert.deepEqual(h.calls.filter(c => c.method === 'PATCH').map(c => c.body),
      [{ font_size: 20 }, { font_size: 22 }]);
  });
}
