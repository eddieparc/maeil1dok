const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function tabClosure(name, context) {
  const file = path.join(__dirname, '../screens/WebViewTabScreen.tsx');
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) {
      expression = ts.isCallExpression(node.initializer)
        ? node.initializer.arguments[0].getText(source) : node.initializer.getText(source);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(expression, `${name} must exist in the tab`);
  const compiled = ts.transpileModule(`return (${expression})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Function(...Object.keys(context), compiled)(...Object.values(context));
}

test('profile tab delegates push to the native owner and replies on its own WebView', { timeout: 5000 }, async () => {
  const requests = [];
  let reply;
  const replied = new Promise(resolve => { reply = resolve; });
  const state = { requestId: 'qa-enable', managed: true, subscribed: true };
  const handler = tabClosure('handleMessage', {
    WEB_APP_URL: 'https://beta.maeil1dok.app',
    authStatus: 'signedIn',
    isPushBridgeRequest: value => value.type === 'push:enable',
    isPushBridgeOrigin: url => url?.startsWith('https://beta.maeil1dok.app/'),
    currentUrlRef: { current: 'https://beta.maeil1dok.app/profile/7' },
    pushRuntime: { async request(...args) { requests.push(args); return state; } },
    nativePushStateScript: value => JSON.stringify(value),
    webViewRef: { current: { injectJavaScript: reply } },
    NativePushOperationError: Error,
    Platform: { OS: 'ios' },
  });
  handler({ nativeEvent: {
    url: 'https://foreign.example/',
    data: JSON.stringify({ type: 'push:enable', requestId: 'qa-enable', managed: true }),
  } });
  assert.deepEqual(requests, []);
  handler({ nativeEvent: {
    url: 'https://beta.maeil1dok.app/profile/7',
    data: JSON.stringify({ type: 'push:enable', requestId: 'qa-enable', managed: true }),
  } });
  assert.deepEqual(requests, [['push:enable', 'qa-enable']]);
  assert.deepEqual(JSON.parse(await replied), state);
});

test('profile tab restores the environment-scoped refresh token', async () => {
  const restore = tabClosure('restoreStoredSession', {
    restoreGenerationRef: { current: 0 },
    API_URL: 'https://beta.maeil1dok.app',
    tokenStore: { async read() { return { refresh: 'beta-refresh' }; } },
    SecureStore: { async getItemAsync() { return 'production-refresh'; } },
    runStoredSessionRestore: deps => deps.readRefreshToken(),
    initiateSessionBridge() {},
    injectUrl() {},
  });
  assert.equal(await restore(), 'beta-refresh');
});

test('profile tab saves session tokens through the scoped token store', async () => {
  const stored = [];
  const bridge = tabClosure('initiateSessionBridge', {
    tokenStore: { async write(pair) { stored.push(pair); } },
    SecureStore: { async setItemAsync() { stored.push('unscoped'); } },
    CookieManager: { async get() { return {}; } },
    API_URL: 'https://beta.maeil1dok.app',
    NATIVE_CLIENT_OBSERVATION_HEADERS: {},
    csrfHeadersFrom: () => ({}),
    fetch: async () => ({ ok: false }),
  });
  await bridge('beta-access', 'beta-refresh');
  assert.deepEqual(stored, [{ access: 'beta-access', refresh: 'beta-refresh' }]);
});
