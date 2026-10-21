const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadSessionBridgeNavigationModule() {
  const filePath = path.join(__dirname, '..', 'sessionBridgeNavigation.ts');
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filePath,
  });

  const moduleInstance = { exports: {} };
  Function(
    'module',
    'exports',
    'require',
    '__filename',
    '__dirname',
    transpiled.outputText,
  )(
    moduleInstance,
    moduleInstance.exports,
    require,
    filePath,
    path.dirname(filePath),
  );
  return moduleInstance.exports;
}

const { buildSessionBridgeConsumeUrl, resolveSessionBridgeNextUrl } = loadSessionBridgeNavigationModule();
const { instantiateClosure } = require('./helpers/appClosureHarness.cjs');

test('SPA login navigation preserves the feature destination for bridge redemption and cancellation', () => {
  const web = 'https://beta.maeil1dok.app';
  const target = `${web}/groups/42?tab=board`;
  const currentWebViewUrlRef = { current: target };
  let shown = 0;
  const navigate = instantiateClosure('handleNavigationStateChange', {
    currentWebViewUrlRef, WEB_APP_URL: web, resolveSessionBridgeNextUrl,
    redactSensitiveUrl: value => value, setCanGoBack() {}, showNativeLogin: () => shown++,
    isPushBridgeOrigin: (url, origin) => new URL(url).origin === new URL(origin).origin,
    console: { log() {} },
  });
  navigate({ url: `${web}/login?redirect=${encodeURIComponent('/groups/42?tab=board')}`, canGoBack: true });
  assert.equal(shown, 1);
  assert.equal(currentWebViewUrlRef.current, target);
  assert.equal(new URL(buildSessionBridgeConsumeUrl({
    apiUrl: web, webAppUrl: web, code: 'fresh-code', currentUrl: currentWebViewUrlRef.current,
  })).searchParams.get('next'), '/groups/42?tab=board');

  const injected = [];
  const cancel = instantiateClosure('hideNativeLogin', {
    currentWebViewUrlRef,
    navigationRef: { isReady: () => true, canGoBack: () => true, goBack() {} },
    webViewRef: { current: { injectJavaScript: script => injected.push(script) } },
    buildLocationAssignmentScript: url => `window.location.href = ${JSON.stringify(url)};`,
  });
  cancel();
  const window = { location: {} };
  new Function('window', injected[0])(window);
  assert.equal(window.location.href, target);
});

for (const prefix of ['/api/v1/auth/', '/api/v1/accounts/']) {
  for (const destination of [
    'session/consume/?code=used-fixture-code',
    'session/issue/',
    'email-login/',
    'token/refresh/',
    'social-login/v2/?code=used-fixture-code',
  ]) {
    test(`excludes same-origin auth destination ${prefix}${destination}`, () => {
      const consumeUrl = new URL(buildSessionBridgeConsumeUrl({
        apiUrl: 'https://beta.maeil1dok.app',
        webAppUrl: 'https://beta.maeil1dok.app',
        code: 'fresh-fixture-code',
        currentUrl: `https://beta.maeil1dok.app${prefix}${destination}`,
      }));

      assert.equal(consumeUrl.searchParams.get('next'), '/');
      assert.equal(consumeUrl.searchParams.get('code'), 'fresh-fixture-code');
      assert.ok(!consumeUrl.toString().includes('used-fixture-code'));
    });
  }
}

test('preserves protected feature destinations on the shared beta origin', () => {
  for (const destination of [
    '/bible?book=GEN&chapter=1#verse-3',
    '/groups/42/board?sort=recent#post-7',
    '/settings?section=account#profile',
  ]) {
    const consumeUrl = new URL(buildSessionBridgeConsumeUrl({
      apiUrl: 'https://beta.maeil1dok.app',
      webAppUrl: 'https://beta.maeil1dok.app',
      code: 'fresh-fixture-code',
      currentUrl: `https://beta.maeil1dok.app${destination}`,
    }));

    assert.equal(consumeUrl.searchParams.get('next'), destination);
    assert.ok(!consumeUrl.searchParams.get('next').includes('fresh-fixture-code'));
  }
});

test('characterizes the current session bridge root redirect', () => {
  const consumeUrl = buildSessionBridgeConsumeUrl({
    apiUrl: 'https://api.maeil1dok.app',
    webAppUrl: 'https://maeil1dok.app',
    code: 'characterization-code',
  });

  assert.equal(
    new URL(consumeUrl).searchParams.get('next'),
    '/',
  );
});

test('preserves an internal page reached while session restore is in flight', () => {
  for (const currentUrl of [
    'https://maeil1dok.app/bible?book=GEN&chapter=1#verse-3',
    'https://maeil1dok.app/plan',
    'https://maeil1dok.app/groups/42/board?sort=recent&tag=a%26b#post-7',
  ]) {
    const consumeUrl = buildSessionBridgeConsumeUrl({
      apiUrl: 'https://api.maeil1dok.app',
      webAppUrl: 'https://maeil1dok.app',
      code: 'restore-code',
      currentUrl,
    });

    assert.equal(
      new URL(consumeUrl).searchParams.get('next'),
      new URL(currentUrl).pathname + new URL(currentUrl).search + new URL(currentUrl).hash,
      `session restore must not replace ${currentUrl} with the landing page`,
    );
    assert.equal(new URL(consumeUrl).searchParams.get('code'), 'restore-code');
    assert.ok(!new URL(consumeUrl).searchParams.get('next').includes('restore-code'));
  }
});

test('falls back to the landing page for unsafe or auth-only current URLs', () => {
  for (const currentUrl of [
    'https://evil.example/phishing',
    'http://maeil1dok.app/bible',
    'https://maeil1dok.app/login',
    'https://maeil1dok.app/login/reset-password',
    'https://maeil1dok.app/auth/google/callback',
    'https://maeil1dok.app/auth',
    undefined,
    null,
    '',
    '//maeil1dok.app/bible',
    'https://maeil1dok.app//evil.example/phishing',
    'https://maeil1dok.app/\\evil.example/phishing',
    'https:\\\\maeil1dok.app\\bible',
    'https://maeil1dok.app/bible?redirect=\\evil.example',
    'https://maeil1dok.app/bible#\\evil.example',
    'not-a-url',
  ]) {
    const consumeUrl = buildSessionBridgeConsumeUrl({
      apiUrl: 'https://api.maeil1dok.app',
      webAppUrl: 'https://maeil1dok.app',
      code: 'restore-code',
      currentUrl,
    });

    assert.equal(
      new URL(consumeUrl).searchParams.get('next'),
      '/',
      `unsafe restore target must fall back to root: ${currentUrl}`,
    );
  }
});
