const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadModule() {
  const filePath = path.join(__dirname, '..', 'appleNativeLink.ts');
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filePath,
  });
  const moduleInstance = new Module(filePath, module);
  moduleInstance.filename = filePath;
  moduleInstance.paths = Module._nodeModulePaths(path.dirname(filePath));
  moduleInstance._compile(transpiled.outputText, filePath);
  return moduleInstance.exports;
}

test('parses only bounded Apple native link requests', () => {
  const { parseAppleNativeLinkRequest } = loadModule();

  assert.equal(parseAppleNativeLinkRequest({
    type: 'auth:apple:link',
    data: { state: 'one-time-state' },
  }), 'one-time-state');
  assert.equal(parseAppleNativeLinkRequest({
    type: 'auth:apple:link',
    data: { state: '' },
  }), null);
  assert.equal(parseAppleNativeLinkRequest({
    type: 'auth:apple:link',
    data: { state: 'x'.repeat(4097) },
  }), null);
});

test('builds a credential result without placing tokens in navigation URLs', () => {
  const { buildAppleNativeLinkSuccess } = loadModule();

  assert.deepEqual(buildAppleNativeLinkSuccess({
    state: 'one-time-state',
    identityToken: 'signed-id-token',
    authorizationCode: 'authorization-code',
  }), {
    type: 'auth:apple:link:result',
    data: {
      state: 'one-time-state',
      idToken: 'signed-id-token',
      code: 'authorization-code',
    },
  });
});

test('normalizes native cancellation without leaking provider errors', () => {
  const { buildAppleNativeLinkFailure } = loadModule();

  assert.deepEqual(buildAppleNativeLinkFailure('one-time-state', true), {
    type: 'auth:apple:link:result',
    data: {
      state: 'one-time-state',
      error: 'cancelled',
    },
  });
  assert.equal(
    buildAppleNativeLinkFailure('one-time-state', false).data.error,
    'unavailable',
  );
});
