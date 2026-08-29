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

const { CSRF_COOKIE_NAME, CSRF_HEADER_NAME, csrfHeadersFrom } = loadModule('csrfHeader.ts');

/**
 * The shell POSTs `/api/v1/auth/logout/` with `credentials: 'include'` and no CSRF
 * header. The server runs a CSRF check whenever the refresh cookie is present, so
 * that call is answered 403 and the refresh token is never blacklisted -- a logout
 * that does not stick on the server.
 *
 * A native `fetch` sends no `Origin` and no `Referer`, so the only way it can pass
 * Django's check is to carry the token from the shared cookie store explicitly.
 *
 * Kept pure so the rule is testable without a device: `CookieManager.get()` is
 * called at the call site and its result passed in.
 */
test('Given the shared cookie store Then the CSRF token becomes a header', () => {
  const headers = csrfHeadersFrom({
    csrftoken: { value: 'tok-abc', domain: '.maeil1dok.app' },
    access_token: { value: 'irrelevant' },
  });

  assert.deepEqual(headers, { [CSRF_HEADER_NAME]: 'tok-abc' });
  assert.equal(CSRF_COOKIE_NAME, 'csrftoken');
});

test('Given a plain string map Then it is read too', () => {
  // Android and iOS bindings have differed on this shape across versions.
  assert.deepEqual(csrfHeadersFrom({ csrftoken: 'tok-plain' }), {
    [CSRF_HEADER_NAME]: 'tok-plain',
  });
});

test('Given no CSRF cookie Then no header is invented', () => {
  // Sending an empty header is worse than sending none: Django compares it and
  // rejects, turning "not configured" into a confusing hard failure.
  assert.deepEqual(csrfHeadersFrom({ access_token: { value: 'x' } }), {});
  assert.deepEqual(csrfHeadersFrom({}), {});
});

test('Given a malformed cookie store Then it degrades instead of throwing', () => {
  for (const input of [null, undefined, 'nonsense', 42, [], { csrftoken: null },
                       { csrftoken: { value: '' } }, { csrftoken: { value: 7 } }]) {
    assert.deepEqual(csrfHeadersFrom(input), {}, JSON.stringify(input) ?? 'undefined');
  }
});

test('the shell logout call actually carries the header', () => {
  // The rule can be perfect while the call site forgets it, and no pure test can
  // see that. Scoped to the logout fetch block so an unrelated mention elsewhere
  // cannot satisfy it.
  const source = fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf8');
  const start = source.indexOf("auth/logout/");
  assert.notEqual(start, -1, 'logout call not found');
  const block = source.slice(Math.max(0, start - 400), start + 300);

  assert.match(block, /csrfHeadersFrom\(/);
  assert.match(block, /CookieManager\.get\(/);
});

test('the shell refresh call carries the header too', () => {
  // Not required today (the server exempts body-token requests), but the header
  // is what keeps the shell working if that exemption is ever tightened. Without
  // it the failure reappears only after the access cookie expires an hour later,
  // with nothing on screen to explain it.
  const source = fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf8');
  const start = source.indexOf('auth/token/refresh/');
  assert.notEqual(start, -1, 'refresh call not found');
  const block = source.slice(Math.max(0, start - 500), start + 400);

  assert.match(block, /csrfHeadersFrom\(/);
});
