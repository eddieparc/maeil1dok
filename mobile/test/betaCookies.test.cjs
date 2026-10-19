const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function load(name) {
  const source = fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', compiled)(module, module.exports);
  return module.exports;
}

test('beta session cookies prevent an unnecessary stored-session restore', () => {
  const { hasAuthCookies } = load('sessionRestore.ts');
  assert.equal(hasAuthCookies({ beta_access_token: { value: 'beta-access' } }), true);
  assert.equal(hasAuthCookies({ beta_refresh_token: 'beta-refresh' }), true);
  assert.equal(hasAuthCookies({ beta_access_token: { value: '' } }), false);
});

test('beta host CSRF cookie takes precedence over a parent-domain cookie', () => {
  const { csrfHeadersFrom } = load('csrfHeader.ts');
  assert.deepEqual(csrfHeadersFrom({
    beta_csrftoken: { value: 'beta-csrf' },
    csrftoken: { value: 'parent-domain-csrf' },
  }), { 'X-CSRFToken': 'beta-csrf' });
});

test('a parent production cookie cannot satisfy the beta session scope', () => {
  const { hasAuthCookies } = load('sessionRestore.ts');
  const names = ['beta_access_token', 'beta_refresh_token'];
  assert.equal(hasAuthCookies({ access_token: 'production-access' }, names), false);
  assert.equal(hasAuthCookies({ beta_access_token: 'beta-access' }, names), true);
});

test('scoped beta logout preserves production tokens and cookies', async () => {
  const { clearMobileAuth } = load('authCleanup.ts');
  const values = new Map([
    ['maeil1dok_access_token', 'production-access'],
    ['maeil1dok_refresh_token', 'production-refresh'],
    ['maeil1dok_beta_access_token', 'beta-access'],
    ['maeil1dok_beta_refresh_token', 'beta-refresh'],
  ]);
  const cleared = [];
  await clearMobileAuth({
    platform: 'ios',
    apiUrl: 'https://beta.maeil1dok.app',
    cookieNames: ['beta_access_token', 'beta_refresh_token'],
    secureStoreTokenKeys: ['maeil1dok_beta_access_token', 'maeil1dok_beta_refresh_token'],
    clearCookieByName: async (_url, name) => { cleared.push(name); return true; },
    deleteSecureValue: async key => { values.delete(key); },
  });
  assert.deepEqual([...values], [
    ['maeil1dok_access_token', 'production-access'],
    ['maeil1dok_refresh_token', 'production-refresh'],
  ]);
  assert.deepEqual(cleared, ['beta_access_token', 'beta_access_token', 'beta_refresh_token', 'beta_refresh_token']);
});

test('beta logout clears its native and WebKit auth cookies without clearing all cookies', async () => {
  const { clearMobileAuth } = load('authCleanup.ts');
  const cleared = [];
  await clearMobileAuth({
    platform: 'ios',
    apiUrl: 'https://beta.maeil1dok.app',
    clearCookieByName: async (url, name, useWebKit) => {
      cleared.push({ url, name, useWebKit });
      return true;
    },
    setCookie: async () => { throw new Error('Unexpected cookie setter'); },
    setCookieFromResponse: async () => { throw new Error('Unexpected response setter'); },
    flushCookies: async () => {},
    deleteSecureValue: async () => {},
  });
  assert.deepEqual(cleared.filter(entry => entry.name.startsWith('beta_')), [
    { url: 'https://beta.maeil1dok.app', name: 'beta_access_token', useWebKit: false },
    { url: 'https://beta.maeil1dok.app', name: 'beta_access_token', useWebKit: true },
    { url: 'https://beta.maeil1dok.app', name: 'beta_refresh_token', useWebKit: false },
    { url: 'https://beta.maeil1dok.app', name: 'beta_refresh_token', useWebKit: true },
  ]);
  assert.ok(cleared.every(entry => ['access_token', 'refresh_token', 'beta_access_token', 'beta_refresh_token'].includes(entry.name)));
});
