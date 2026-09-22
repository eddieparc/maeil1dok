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

const { mapWebPathToRoute } = loadModule('navigation/routeMap.ts');

test('root path maps to the Home tab', () => {
  assert.deepEqual(mapWebPathToRoute('/', ''), {
    type: 'tab',
    name: 'Home',
  });
});

test('bible section maps to the Bible tab with the deep-link URL', () => {
  assert.deepEqual(mapWebPathToRoute('/bible', ''), {
    type: 'tab',
    name: 'Bible',
    url: '/bible',
  });
  assert.deepEqual(mapWebPathToRoute('/bible/reading/genesis/1', ''), {
    type: 'tab',
    name: 'Bible',
    url: '/bible/reading/genesis/1',
  });
});

test('plan section maps to the Schedule tab', () => {
  assert.deepEqual(mapWebPathToRoute('/plan', ''), {
    type: 'tab',
    name: 'Schedule',
    url: '/plan',
  });
  assert.deepEqual(mapWebPathToRoute('/plan/2026', ''), {
    type: 'tab',
    name: 'Schedule',
    url: '/plan/2026',
  });
});

test('groups section maps to the Together tab', () => {
  assert.deepEqual(mapWebPathToRoute('/groups', ''), {
    type: 'tab',
    name: 'Together',
    url: '/groups',
  });
  assert.deepEqual(mapWebPathToRoute('/groups/12', ''), {
    type: 'tab',
    name: 'Together',
    url: '/groups/12',
  });
});

test('profile section maps to the Profile tab', () => {
  assert.deepEqual(mapWebPathToRoute('/profile/7', ''), {
    type: 'tab',
    name: 'Profile',
    url: '/profile/7',
  });
});

test('account settings falls back to the webview', () => {
  assert.deepEqual(mapWebPathToRoute('/account/settings', ''), {
    type: 'webview',
    url: '/account/settings',
  });
  assert.deepEqual(mapWebPathToRoute('/account/settings/notifications', ''), {
    type: 'webview',
    url: '/account/settings/notifications',
  });
});

test('login path maps to the login route', () => {
  assert.deepEqual(mapWebPathToRoute('/login', ''), { type: 'login' });
  assert.deepEqual(mapWebPathToRoute('/login/', ''), { type: 'login' });
});

test('unmapped paths fall back to the webview with the path preserved', () => {
  assert.deepEqual(mapWebPathToRoute('/community/post/42', ''), {
    type: 'webview',
    url: '/community/post/42',
  });
});

test('webview fallback keeps the query string', () => {
  assert.deepEqual(mapWebPathToRoute('/search', '?q=genesis'), {
    type: 'webview',
    url: '/search?q=genesis',
  });
});

test('look-alike prefixes do not leak into tabs', () => {
  // '/bible-study' is not the /bible section; '/planned' is not /plan.
  assert.deepEqual(mapWebPathToRoute('/bible-study', ''), {
    type: 'webview',
    url: '/bible-study',
  });
  assert.deepEqual(mapWebPathToRoute('/planned', ''), {
    type: 'webview',
    url: '/planned',
  });
  assert.deepEqual(mapWebPathToRoute('/account', ''), {
    type: 'webview',
    url: '/account',
  });
});

test('empty or malformed input falls back to the webview root', () => {
  assert.deepEqual(mapWebPathToRoute('', ''), { type: 'webview', url: '/' });
  assert.deepEqual(mapWebPathToRoute(null, ''), { type: 'webview', url: '/' });
  assert.deepEqual(mapWebPathToRoute(undefined, ''), { type: 'webview', url: '/' });
});
