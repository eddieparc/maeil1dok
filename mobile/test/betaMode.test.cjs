const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTsModule(fileName) {
  const filePath = path.join(__dirname, '..', fileName);
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filePath,
  });

  const moduleInstance = new Module(filePath, module);
  moduleInstance.filename = filePath;
  moduleInstance.paths = Module._nodeModulePaths(path.dirname(filePath));
  moduleInstance._compile(transpiled.outputText, filePath);
  return moduleInstance.exports;
}

const {
  BETA_MODE_STORAGE_KEY,
  PROD_STACK,
  BETA_STACK,
  parseBetaModeFlag,
  resolveStack,
} = loadTsModule('betaMode.ts');

const { shouldAllowWebViewNavigation, isFatalWebViewError } = loadTsModule('webviewNavigation.ts');

// --- betaMode pure logic -------------------------------------------------

test('SecureStore key matches the shared contract', () => {
  assert.equal(BETA_MODE_STORAGE_KEY, 'maeil1dok_beta_mode');
});

test('stack table matches the shared contract', () => {
  assert.deepEqual(PROD_STACK, {
    web: 'https://maeil1dok.app',
    api: 'https://api.maeil1dok.app',
  });
  // Beta serves frontend AND api on the same origin.
  assert.deepEqual(BETA_STACK, {
    web: 'https://beta.maeil1dok.app',
    api: 'https://beta.maeil1dok.app',
  });
});

test('parseBetaModeFlag treats only the literal "1" as enabled', () => {
  assert.equal(parseBetaModeFlag('1'), true);
  for (const value of ['0', null, undefined, '', 'true', 'yes', ' 1 ', '2']) {
    assert.equal(parseBetaModeFlag(value), false, `must be false: ${JSON.stringify(value)}`);
  }
});

test('resolveStack returns the prod stack when disabled and beta when enabled', () => {
  assert.deepEqual(resolveStack(false), PROD_STACK);
  assert.deepEqual(resolveStack(true), BETA_STACK);
});

// --- navigation policy with extraOrigins ---------------------------------

const PROD_OPTIONS = {
  webAppUrl: 'https://maeil1dok.app',
  apiUrl: 'https://api.maeil1dok.app',
  extraOrigins: [
    'https://maeil1dok.app',
    'https://api.maeil1dok.app',
    'https://beta.maeil1dok.app',
  ],
};

test('extraOrigins makes the beta stack first-party on the main frame', () => {
  assert.equal(
    shouldAllowWebViewNavigation(
      { url: 'https://beta.maeil1dok.app/bible', isTopFrame: true },
      PROD_OPTIONS,
    ),
    true,
  );
  // Without extraOrigins the same URL stays blocked (unconfigured subdomain).
  assert.equal(
    shouldAllowWebViewNavigation(
      { url: 'https://beta.maeil1dok.app/bible', isTopFrame: true },
      { webAppUrl: PROD_OPTIONS.webAppUrl, apiUrl: PROD_OPTIONS.apiUrl },
    ),
    false,
  );
});

test('extraOrigins matching is exact origin, not suffix', () => {
  for (const url of [
    'https://evilbeta.maeil1dok.app/x',
    'https://beta.maeil1dok.app.evil.example/x',
    'http://beta.maeil1dok.app/x',
  ]) {
    assert.equal(
      shouldAllowWebViewNavigation({ url, isTopFrame: true }, PROD_OPTIONS),
      false,
      `look-alike must stay blocked: ${url}`,
    );
  }
});

test('/login on an extraOrigin is still intercepted for native login', () => {
  assert.equal(
    shouldAllowWebViewNavigation(
      { url: 'https://beta.maeil1dok.app/login', isTopFrame: true },
      PROD_OPTIONS,
    ),
    false,
  );
});

test('extraOrigins documents escalate in isFatalWebViewError', () => {
  assert.equal(
    isFatalWebViewError(
      { url: 'https://beta.maeil1dok.app/', code: -1009, description: 'offline' },
      PROD_OPTIONS,
    ),
    true,
  );
  assert.equal(
    isFatalWebViewError(
      { url: 'https://evilbeta.maeil1dok.app/', code: -1009, description: 'offline' },
      PROD_OPTIONS,
    ),
    false,
  );
});
