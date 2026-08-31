const { readFileSync } = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const mobileRoot = path.join(__dirname, '..', '..');
const appPath = path.join(mobileRoot, 'App.tsx');
const appSource = readFileSync(appPath, 'utf8');
const sessionRestorePath = path.join(mobileRoot, 'sessionRestore.ts');
const sessionRestoreSource = readFileSync(sessionRestorePath, 'utf8');
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

const restoreExpression = findVariableInitializer('restoreStoredSession');
const compiledSessionRestore = ts.transpileModule(sessionRestoreSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const sessionRestoreModule = { exports: {} };
new Function('module', 'exports', compiledSessionRestore)(
  sessionRestoreModule,
  sessionRestoreModule.exports,
);
const { runStoredSessionRestore } = sessionRestoreModule.exports;

const createRestoreHarness = ({
  refreshToken = 'stored-refresh',
  cookieStores = [
    { csrftoken: { value: 'csrf-value' } },
  ],
  response = {
    ok: true,
    status: 200,
    body: { access: 'new-access', refresh: 'new-refresh' },
  },
  bridgeSuccess = true,
  fetchBarrier = null,
} = {}) => {
  const observations = {
    abandonReasons: [],
    bridgeCalls: [],
    clearAllCount: 0,
    cookieReads: 0,
    fetchCalls: [],
    navigateCount: 0,
    secureDeletes: [],
  };
  const SecureStore = {
    getItemAsync: async () => refreshToken,
    deleteItemAsync: async (key) => observations.secureDeletes.push(key),
  };
  const CookieManager = {
    get: async () => {
      const index = Math.min(observations.cookieReads, cookieStores.length - 1);
      observations.cookieReads += 1;
      return cookieStores[index];
    },
    clearAll: async () => {
      observations.clearAllCount += 1;
    },
  };
  const fetch = async (url, options) => {
    observations.fetchCalls.push({ url, options });
    if (fetchBarrier) await fetchBarrier;
    return {
      ok: response.ok,
      status: response.status,
      json: async () => response.body,
    };
  };
  const initiateSessionBridge = async (...args) => {
    observations.bridgeCalls.push(args);
    return bridgeSuccess;
  };
  const navigateToPendingUrl = () => {
    observations.navigateCount += 1;
  };
  const csrfHeadersFrom = () => ({ 'X-CSRFToken': 'csrf-value' });
  const abandonRestore = (reason) => {
    observations.abandonReasons.push(reason);
    return false;
  };
  const quietConsole = {
    error: () => {},
    log: () => {},
  };
  const restoreGenerationRef = { current: 0 };
  const restorePromiseRef = { current: null };

  const compiled = ts.transpileModule(
    `const restoreStoredSession = ${restoreExpression};
module.exports = { restoreStoredSession };`,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const module = { exports: {} };
  const instantiate = new Function(
    'module',
    'exports',
    'SecureStore',
    'CookieManager',
    'API_URL',
    'csrfHeadersFrom',
    'fetch',
    'initiateSessionBridge',
    'navigateToPendingUrl',
    'console',
    'runStoredSessionRestore',
    'hasAuthCookies',
    'abandonRestore',
    'restoreGenerationRef',
    'restorePromiseRef',
    compiled,
  );
  instantiate(
    module,
    module.exports,
    SecureStore,
    CookieManager,
    'https://api.maeil1dok.app',
    csrfHeadersFrom,
    fetch,
    initiateSessionBridge,
    navigateToPendingUrl,
    quietConsole,
    runStoredSessionRestore,
    sessionRestoreModule.exports.hasAuthCookies,
    abandonRestore,
    restoreGenerationRef,
    restorePromiseRef,
  );

  return {
    observations,
    restoreStoredSession: module.exports.restoreStoredSession,
  };
};

module.exports = {
  createRestoreHarness,
  runStoredSessionRestore,
};
