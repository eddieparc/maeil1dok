const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const path = require('node:path');
const ts = require('typescript');

const appPath = path.join(__dirname, '..', 'App.tsx');
const appSource = readFileSync(appPath, 'utf8');
const authCleanupPath = path.join(__dirname, '..', 'authCleanup.ts');
const authCleanupSource = readFileSync(authCleanupPath, 'utf8');
const sourceFile = ts.createSourceFile(
  appPath,
  appSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

const findVariableInitializer = (name) => {
  let initializer = null;
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
    ) {
      initializer = node.initializer;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (!initializer) throw new Error(`Unable to find ${name} in App.tsx`);
  return initializer.getText(sourceFile);
};

const compiledAuthCleanup = ts.transpileModule(authCleanupSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const authCleanupModule = { exports: {} };
new Function('module', 'exports', compiledAuthCleanup)(
  authCleanupModule,
  authCleanupModule.exports,
);
const { clearMobileAuth } = authCleanupModule.exports;

const compileFunction = (name, dependencyNames, dependencyValues) => {
  const expression = findVariableInitializer(name);
  const compiled = ts.transpileModule(
    `const subject = ${expression}; module.exports = subject;`,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', ...dependencyNames, compiled)(
    module,
    module.exports,
    ...dependencyValues,
  );
  return module.exports;
};

test('native logout removes only Maeil1Dok auth cookies', async () => {
  const observations = {
    clearAllCalls: 0,
    cookieResponseSets: [],
    cookieSets: [],
    secureDeletes: [],
  };
  const CookieManager = {
    clearAll: async () => {
      observations.clearAllCalls += 1;
      return true;
    },
    set: async (url, cookie, useWebKit) => {
      observations.cookieSets.push({ url, cookie, useWebKit });
      return true;
    },
    setFromResponse: async (url, cookie) => {
      observations.cookieResponseSets.push({ url, cookie });
      return true;
    },
    clearByName: async () => true,
    flush: async () => {},
  };
  const SecureStore = {
    deleteItemAsync: async (key) => observations.secureDeletes.push(key),
  };
  const clearStoredAuth = compileFunction(
    'clearStoredAuth',
    [
      'CookieManager',
      'SecureStore',
      'Platform',
      'API_URL',
      'WEB_APP_URL',
      'clearMobileAuth',
    ],
    [
      CookieManager,
      SecureStore,
      { OS: 'android' },
      'https://api.maeil1dok.app',
      'https://maeil1dok.app',
      clearMobileAuth,
    ],
  );

  await clearStoredAuth();

  assert.equal(observations.clearAllCalls, 0, 'logout must not destroy unrelated cookies');
  assert.deepEqual(
    [...new Set(observations.cookieSets.map(({ cookie }) => cookie.name))].sort(),
    ['access_token', 'refresh_token'],
  );
  assert.equal(observations.cookieResponseSets.length, 4);
  assert.ok(
    observations.cookieResponseSets.every(({ cookie }) => cookie.includes('Max-Age=0')),
  );
  assert.deepEqual(observations.secureDeletes.sort(), [
    'maeil1dok_access_token',
    'maeil1dok_refresh_token',
  ]);
});

test('iOS logout clears auth cookies from native and WebKit stores only', async () => {
  const observations = {
    clearCalls: [],
    secureDeletes: [],
    setCalls: 0,
  };

  await clearMobileAuth({
    platform: 'ios',
    apiUrl: 'https://api.maeil1dok.app',
    cookieDomain: '.maeil1dok.app',
    clearCookieByName: async (url, name, useWebKit) => {
      observations.clearCalls.push({ url, name, useWebKit });
      return true;
    },
    setCookie: async () => {
      observations.setCalls += 1;
      return true;
    },
    setCookieFromResponse: async () => {
      observations.setCalls += 1;
      return true;
    },
    flushCookies: async () => {},
    deleteSecureValue: async (key) => observations.secureDeletes.push(key),
  });

  assert.deepEqual(observations.clearCalls, [
    { url: 'https://api.maeil1dok.app', name: 'access_token', useWebKit: false },
    { url: 'https://api.maeil1dok.app', name: 'access_token', useWebKit: true },
    { url: 'https://api.maeil1dok.app', name: 'refresh_token', useWebKit: false },
    { url: 'https://api.maeil1dok.app', name: 'refresh_token', useWebKit: true },
  ]);
  assert.equal(observations.setCalls, 0);
  assert.deepEqual(observations.secureDeletes.sort(), [
    'maeil1dok_access_token',
    'maeil1dok_refresh_token',
  ]);
});

test('logout cleanup completes before the WebView remounts', async () => {
  let releaseCleanup;
  let signalCleanupStarted;
  const cleanupBarrier = new Promise((resolve) => {
    releaseCleanup = resolve;
  });
  const cleanupStarted = new Promise((resolve) => {
    signalCleanupStarted = resolve;
  });
  const observations = [];
  const clearStoredAuth = async () => {
    observations.push('cleanup:start');
    signalCleanupStarted();
    await cleanupBarrier;
    observations.push('cleanup:end');
  };
  const finishNativeLogout = compileFunction(
    'finishNativeLogout',
    ['clearStoredAuth', 'setWebViewKey', 'showNativeLogin', 'console'],
    [
      clearStoredAuth,
      () => observations.push('webview:remount'),
      () => observations.push('login:show'),
      { error: () => {} },
    ],
  );

  const logout = finishNativeLogout();
  await cleanupStarted;

  const eventsBeforeCleanup = [...observations];
  releaseCleanup();
  await logout;

  assert.deepEqual(
    eventsBeforeCleanup,
    ['cleanup:start'],
    'remount and login UI must wait for cleanup',
  );
  assert.deepEqual(observations, [
    'cleanup:start',
    'cleanup:end',
    'webview:remount',
    'login:show',
  ]);
});

test('logout message invalidates restore before cleanup starts', async () => {
  const observations = [];
  const handleMessage = compileFunction(
    'handleMessage',
    [
      'invalidateStoredSessionRestore',
      'finishNativeLogout',
      'console',
    ],
    [
      () => observations.push('restore:invalidate'),
      async () => {
        observations.push('cleanup:start');
      },
      { error: () => {} },
    ],
  );

  handleMessage({
    nativeEvent: { data: JSON.stringify({ type: 'auth:logout' }) },
  });

  assert.deepEqual(observations, ['restore:invalidate', 'cleanup:start']);
});
