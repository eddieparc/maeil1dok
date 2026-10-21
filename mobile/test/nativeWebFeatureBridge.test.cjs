const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const filename = path.resolve(__dirname, '..', file);
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  instance.require = id => id.startsWith('.')
    ? load(path.relative(path.join(__dirname, '..'), path.resolve(path.dirname(filename), `${id}.ts`)))
    : require(id);
  instance._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, filename);
  return instance.exports;
}
const { buildNativeWebFeatureBootstrap, parseNativeWebFeatureReply } = load('nativeWebFeatureBridge.ts');
const { DEFAULT_READING_SETTINGS } = load('api/readingSettings.ts');
const { createReadingSettingsSync } = load('api/readingSettingsSync.ts');
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const response = settings => ({ ok: true, status: 200,
  json: async () => ({ success: true, data: { settings } }) });
const storage = () => ({
  value: null, writes: [],
  async getItem() { return this.value; },
  async setItem(_key, value) { this.value = value; this.writes.push(JSON.parse(value)); },
});

test('guest bootstrap seeds once per feature scope without erasing later web edits', () => {
  const values = new Map();
  const session = new Map();
  const localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key) };
  const sessionStorage = { getItem: key => session.get(key), setItem: (key, value) => session.set(key, value) };
  const context = { window: { location: { origin: 'https://beta.example.test' } }, localStorage, sessionStorage };
  const bootstrap = buildNativeWebFeatureBootstrap({ scope: 'first', sessionKey: 'guest:beta',
    webAppUrl: 'https://beta.example.test', settings: DEFAULT_READING_SETTINGS });
  vm.runInNewContext(bootstrap, context);
  assert.deepEqual(JSON.parse(values.get('readingSettings')), DEFAULT_READING_SETTINGS);
  values.set('readingSettings', JSON.stringify({ ...DEFAULT_READING_SETTINGS, fontSize: 24 }));

  vm.runInNewContext(bootstrap, context);

  assert.equal(JSON.parse(values.get('readingSettings')).fontSize, 24);
  assert.equal(context.window.__maeilNativeFeatureContext.scope, 'first');
});

test('member and foreign-origin documents do not receive guest cache values', () => {
  for (const [sessionKey, origin] of [['account:beta:7', 'https://beta.example.test'],
    ['guest:beta', 'https://api.other.test']]) {
    const writes = [];
    const context = { window: { location: { origin } },
      localStorage: { setItem: (...args) => writes.push(args), removeItem() {} },
      sessionStorage: { getItem: () => null, setItem() {} } };

    vm.runInNewContext(buildNativeWebFeatureBootstrap({ scope: 'first', sessionKey,
      webAppUrl: 'https://beta.example.test', settings: DEFAULT_READING_SETTINGS }), context);

    assert.deepEqual(writes, []);
  }
});

test('feature messages require the actual ready/return wire contract', () => {
  assert.deepEqual(parseNativeWebFeatureReply(JSON.stringify({ type: 'native-feature:ready', scope: 'one' })),
    { kind: 'ready', scope: 'one' });
  assert.deepEqual(parseNativeWebFeatureReply(JSON.stringify({
    type: 'native-feature:return', scope: 'one', requestId: 'close-1', ok: false,
  })), { kind: 'error', scope: 'one', requestId: 'close-1' });
  for (const value of ['{', '{}', 'null', JSON.stringify({
    type: 'native-feature:return', scope: 'one', requestId: 'close-1', ok: true, userId: 7, settings: {},
  })]) assert.equal(parseNativeWebFeatureReply(value), null);
});

test('guest web preferences persist through the existing native settings owner', async () => {
  const cache = storage();
  const sync = createReadingSettingsSync({ storage: cache });
  await sync.setSession({ key: 'guest:beta', apiFetch: null });

  assert.equal(await sync.applyWebSettings('guest:beta', { ...DEFAULT_READING_SETTINGS, fontSize: 23 }), true);

  assert.equal(sync.getSnapshot().settings.fontSize, 23);
  assert.equal(JSON.parse(cache.value).fontSize, 23);
});

test('wrong scope and partial malformed preferences cannot replace native settings', async () => {
  const cache = storage();
  const sync = createReadingSettingsSync({ storage: cache });
  await sync.setSession({ key: 'guest:beta', apiFetch: null });

  assert.equal(await sync.applyWebSettings('guest:production', DEFAULT_READING_SETTINGS), false);
  assert.equal(await sync.applyWebSettings('guest:beta', { fontSize: '23' }), false);

  assert.deepEqual(sync.getSnapshot().settings, DEFAULT_READING_SETTINGS);
  assert.equal(cache.writes.length, 0);
});

test('member return rereads the server instead of trusting or PATCHing a web snapshot', async () => {
  const cache = storage();
  const calls = [];
  const sync = createReadingSettingsSync({ storage: cache });
  await sync.setSession({ key: 'account:beta:7', apiFetch: async (_url, init) => {
    calls.push(init.method);
    return response({ font_size: 19 });
  } });

  assert.equal(await sync.applyWebSettings('account:beta:7', { ...DEFAULT_READING_SETTINGS, fontSize: 24 }), true);

  assert.deepEqual(calls, ['GET', 'GET']);
  assert.equal(sync.getSnapshot().settings.fontSize, 19);
  assert.equal(cache.writes.length, 0);
});

test('an account change while guest persistence is pending cannot acknowledge the old return', { timeout: 2500 }, async () => {
  const cache = storage();
  const started = deferred();
  const acknowledgement = deferred();
  cache.setItem = async () => { started.resolve(); await acknowledgement.promise; };
  const sync = createReadingSettingsSync({ storage: cache });
  await sync.setSession({ key: 'guest:beta', apiFetch: null });
  const applying = sync.applyWebSettings('guest:beta', { ...DEFAULT_READING_SETTINGS, fontSize: 23 });
  await started.promise;
  await sync.setSession({ key: 'account:beta:8', apiFetch: async () => response({ font_size: 18 }) });

  acknowledgement.resolve();

  assert.equal(await applying, false);
  assert.equal(sync.getSnapshot().sessionKey, 'account:beta:8');
  assert.equal(sync.getSnapshot().settings.fontSize, 18);
});
