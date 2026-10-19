const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadModule(name) {
  const filePath = path.join(__dirname, '..', name);
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filePath,
  });
  const instance = new Module(filePath, module);
  instance.filename = filePath;
  instance.paths = Module._nodeModulePaths(path.dirname(filePath));
  instance._compile(transpiled.outputText, filePath);
  return instance.exports;
}

const {
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  shouldRefresh,
  parseTokenPair,
  buildRefreshBody,
  createTokenStore,
} = loadModule('api/authTokens.ts');

test('beta token replacement and logout preserve the installed production session', async () => {
  const values = new Map([
    [ACCESS_TOKEN_KEY, 'production-access'],
    [REFRESH_TOKEN_KEY, 'production-refresh'],
  ]);
  const storage = {
    getItemAsync: async key => values.get(key) ?? null,
    setItemAsync: async (key, value) => { values.set(key, value); },
    deleteItemAsync: async key => { values.delete(key); },
  };
  const production = createTokenStore(storage);
  const beta = createTokenStore(storage, true);
  assert.deepEqual(await beta.read(), { access: null, refresh: null });
  await beta.write({ access: 'beta-access', refresh: 'beta-refresh' });
  assert.deepEqual(await production.read(), { access: 'production-access', refresh: 'production-refresh' });
  assert.deepEqual(await beta.read(), { access: 'beta-access', refresh: 'beta-refresh' });
  await beta.clear();
  assert.deepEqual(await production.read(), { access: 'production-access', refresh: 'production-refresh' });
  assert.deepEqual(await beta.read(), { access: null, refresh: null });
});

test('token storage keys match the keys the WebView bridge already uses', () => {
  // The session bridge and auth cleanup both read/write these exact keys;
  // drifting here would split the token store in two.
  assert.equal(ACCESS_TOKEN_KEY, 'maeil1dok_access_token');
  assert.equal(REFRESH_TOKEN_KEY, 'maeil1dok_refresh_token');
});

test('shouldRefresh is true only for 401', () => {
  assert.equal(shouldRefresh(401), true);
  for (const status of [200, 400, 403, 404, 500, 0]) {
    assert.equal(shouldRefresh(status), false, `status ${status}`);
  }
});

test('parseTokenPair accepts a well-formed pair', () => {
  assert.deepEqual(
    parseTokenPair({ access: 'a-token', refresh: 'r-token' }),
    { access: 'a-token', refresh: 'r-token' },
  );
});

test('parseTokenPair rejects malformed payloads', () => {
  for (const input of [
    null,
    undefined,
    'nonsense',
    42,
    [],
    {},
    { access: 'a-token' },
    { refresh: 'r-token' },
    { access: 1, refresh: 'r-token' },
    { access: 'a-token', refresh: null },
  ]) {
    assert.equal(parseTokenPair(input), null, JSON.stringify(input) ?? 'undefined');
  }
});

test('buildRefreshBody serializes the refresh token', () => {
  assert.equal(buildRefreshBody('r-token'), JSON.stringify({ refresh: 'r-token' }));
});
