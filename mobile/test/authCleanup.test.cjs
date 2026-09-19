const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const path = require('node:path');
const ts = require('typescript');

// Closures under test live in the screen and session files. Each file is
// searched in order; the first file declaring the name wins.
const closurePaths = [
  path.join(__dirname, '..', 'screens', 'WebViewScreen.tsx'),
  path.join(__dirname, '..', 'auth', 'AuthSession.tsx'),
];
const sourceFiles = closurePaths.map((filePath) => ({
  filePath,
  sourceFile: ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  ),
}));
const authCleanupPath = path.join(__dirname, '..', 'authCleanup.ts');
const authCleanupSource = readFileSync(authCleanupPath, 'utf8');

const findVariableInitializer = (name) => {
  for (const { filePath, sourceFile } of sourceFiles) {
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
    if (initializer) return initializer.getText(sourceFile);
  }
  throw new Error(`Unable to find ${name} in ${closurePaths.join(', ')}`);
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
  // The cookie-clearing contract moved with the cleanup: AuthSession.signOut
  // now owns the clearMobileAuth call that WebViewScreen used to inline.
  const signOut = compileFunction(
    'signOut',
    [
      'useCallback',
      'CookieManager',
      'SecureStore',
      'Platform',
      'apiUrl',
      'webAppUrl',
      'clearMobileAuth',
      'accessTokenRef',
      'setAccessToken',
      'setStatus',
      'console',
    ],
    [
      (fn) => fn,
      CookieManager,
      SecureStore,
      { OS: 'android' },
      'https://api.maeil1dok.app',
      'https://maeil1dok.app',
      clearMobileAuth,
      { current: null },
      () => {},
      () => {},
      { error: () => {} },
    ],
  );

  await signOut();

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
  const signOut = async () => {
    observations.push('cleanup:start');
    signalCleanupStarted();
    await cleanupBarrier;
    observations.push('cleanup:end');
  };
  const finishNativeLogout = compileFunction(
    'finishNativeLogout',
    ['signOut', 'setWebViewKey', 'console'],
    [
      signOut,
      () => observations.push('webview:remount'),
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
    'the WebView remount must wait for sign-out cleanup',
  );
  assert.deepEqual(observations, [
    'cleanup:start',
    'cleanup:end',
    'webview:remount',
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
