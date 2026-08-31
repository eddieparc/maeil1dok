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

const { buildSessionBridgeConsumeUrl } = loadSessionBridgeNavigationModule();

test('characterizes the current session bridge root redirect', () => {
  const consumeUrl = buildSessionBridgeConsumeUrl({
    apiUrl: 'https://api.maeil1dok.app',
    webAppUrl: 'https://maeil1dok.app',
    code: 'characterization-code',
  });

  assert.equal(
    new URL(consumeUrl).searchParams.get('next'),
    'https://maeil1dok.app/',
  );
});

test('preserves an internal page reached while session restore is in flight', () => {
  for (const currentUrl of [
    'https://maeil1dok.app/bible?book=GEN&chapter=1#verse-3',
    'https://maeil1dok.app/plan',
  ]) {
    const consumeUrl = buildSessionBridgeConsumeUrl({
      apiUrl: 'https://api.maeil1dok.app',
      webAppUrl: 'https://maeil1dok.app',
      code: 'restore-code',
      currentUrl,
    });

    assert.equal(
      new URL(consumeUrl).searchParams.get('next'),
      currentUrl,
      `session restore must not replace ${currentUrl} with the landing page`,
    );
  }
});

test('falls back to the landing page for unsafe or auth-only current URLs', () => {
  for (const currentUrl of [
    'https://evil.example/phishing',
    'http://maeil1dok.app/bible',
    'https://maeil1dok.app/login',
    'https://maeil1dok.app/login/reset-password',
    'https://maeil1dok.app/auth/google/callback',
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
      'https://maeil1dok.app/',
      `unsafe restore target must fall back to root: ${currentUrl}`,
    );
  }
});
