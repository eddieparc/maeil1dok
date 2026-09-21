const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// nativeApi.ts imports ./authTokens — register a .ts loader so the transpiled
// CommonJS require() can resolve it.
require.extensions['.ts'] = (moduleInstance, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  moduleInstance._compile(transpiled.outputText, filename);
};

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
  AuthExpiredError,
  buildApiUrl,
  buildAuthedHeaders,
  createApiFetch,
} = loadModule('api/nativeApi.ts');

const response = (status, body = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

test('buildApiUrl joins base and path without double slashes', () => {
  assert.equal(
    buildApiUrl('https://api.maeil1dok.app', '/api/v1/auth/verify/'),
    'https://api.maeil1dok.app/api/v1/auth/verify/',
  );
  assert.equal(
    buildApiUrl('https://api.maeil1dok.app/', '/api/v1/auth/verify/'),
    'https://api.maeil1dok.app/api/v1/auth/verify/',
  );
  assert.equal(
    buildApiUrl('https://api.maeil1dok.app/', 'api/v1/auth/verify/'),
    'https://api.maeil1dok.app/api/v1/auth/verify/',
  );
});

test('buildAuthedHeaders attaches the bearer token and merges extras', () => {
  assert.deepEqual(buildAuthedHeaders('tok'), {
    Authorization: 'Bearer tok',
  });
  assert.deepEqual(buildAuthedHeaders('tok', { 'Content-Type': 'application/json' }), {
    Authorization: 'Bearer tok',
    'Content-Type': 'application/json',
  });
});

test('apiFetch attaches the bearer token to the request', async () => {
  const calls = [];
  const apiFetch = createApiFetch({
    baseUrl: 'https://api.maeil1dok.app',
    getAccessToken: () => 'tok-1',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return response(200, { ok: true });
    },
    refresh: async () => null,
  });

  const res = await apiFetch('/api/v1/auth/verify/');
  assert.equal(res.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.maeil1dok.app/api/v1/auth/verify/');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok-1');
});

test('apiFetch refreshes once on 401 and retries with the new token', async () => {
  const calls = [];
  let token = 'stale';
  const apiFetch = createApiFetch({
    baseUrl: 'https://api.maeil1dok.app',
    getAccessToken: () => token,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return response(calls.length === 1 ? 401 : 200);
    },
    refresh: async () => {
      token = 'fresh';
      return { access: 'fresh', refresh: 'fresh-refresh' };
    },
  });

  const res = await apiFetch('/api/v1/auth/verify/');
  assert.equal(res.status, 200);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer stale');
  assert.equal(calls[1].init.headers.Authorization, 'Bearer fresh');
});

test('apiFetch throws AuthExpiredError when the retry is also 401', async () => {
  let refreshCalls = 0;
  const apiFetch = createApiFetch({
    baseUrl: 'https://api.maeil1dok.app',
    getAccessToken: () => 'tok',
    fetchImpl: async () => response(401),
    refresh: async () => {
      refreshCalls += 1;
      return { access: 'fresh', refresh: 'fresh-refresh' };
    },
  });

  await assert.rejects(() => apiFetch('/api/v1/auth/verify/'), AuthExpiredError);
  assert.equal(refreshCalls, 1, 'refresh must run exactly once');
});

test('apiFetch throws AuthExpiredError when the refresh itself fails', async () => {
  const apiFetch = createApiFetch({
    baseUrl: 'https://api.maeil1dok.app',
    getAccessToken: () => 'tok',
    fetchImpl: async () => response(401),
    refresh: async () => null,
  });

  await assert.rejects(() => apiFetch('/api/v1/auth/verify/'), AuthExpiredError);
});

test('apiFetch does not refresh on non-401 failures', async () => {
  let refreshCalls = 0;
  const apiFetch = createApiFetch({
    baseUrl: 'https://api.maeil1dok.app',
    getAccessToken: () => 'tok',
    fetchImpl: async () => response(500),
    refresh: async () => {
      refreshCalls += 1;
      return { access: 'fresh', refresh: 'fresh-refresh' };
    },
  });

  const res = await apiFetch('/api/v1/auth/verify/');
  assert.equal(res.status, 500);
  assert.equal(refreshCalls, 0);
});
