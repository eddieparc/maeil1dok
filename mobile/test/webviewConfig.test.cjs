const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadWebViewConfigModule() {
  const filePath = path.join(__dirname, '..', 'webviewConfig.ts');
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
  DEFAULT_LEGACY_WEB_APP_URL,
  getStableBucket,
  resolveWebViewConfig,
} = loadWebViewConfigModule();

test('Given a legacy target When resolving WebView config Then legacy URL is selected', () => {
  const config = resolveWebViewConfig({
    webviewTarget: 'legacy',
    webviewLegacyUrl: 'https://legacy.example',
    webviewNextUrl: 'https://next.example',
    webviewNextPercent: 100,
    webviewInstallId: 'install-a',
  });

  assert.equal(config.webAppUrl, 'https://legacy.example/');
  assert.equal(config.selectedTarget, 'legacy');
});

test('Given kill switch enabled When target requests next Then legacy URL wins', () => {
  const config = resolveWebViewConfig({
    webviewTarget: 'next',
    webviewKillSwitch: true,
    webviewLegacyUrl: 'https://legacy.example',
    webviewNextUrl: 'https://next.example',
    webviewInstallId: 'install-a',
  });

  assert.equal(config.webAppUrl, 'https://legacy.example/');
  assert.equal(config.selectedTarget, 'legacy');
});

test('Given percentage rollout When install id is stable Then bucket selection is stable', () => {
  const first = resolveWebViewConfig({
    webviewTarget: 'percent',
    webviewNextPercent: 50,
    webviewLegacyUrl: 'https://legacy.example',
    webviewNextUrl: 'https://next.example',
    webviewInstallId: 'install-stable',
  });
  const second = resolveWebViewConfig({
    webviewTarget: 'percent',
    webviewNextPercent: 50,
    webviewLegacyUrl: 'https://legacy.example',
    webviewNextUrl: 'https://next.example',
    webviewInstallId: 'install-stable',
  });

  assert.equal(first.webAppUrl, second.webAppUrl);
  assert.equal(first.rolloutBucket, second.rolloutBucket);
  assert.equal(getStableBucket('install-stable'), first.rolloutBucket);
});

test('Given invalid next URL When target requests next Then selector falls back to legacy', () => {
  const config = resolveWebViewConfig({
    webviewTarget: 'next',
    webviewLegacyUrl: 'https://legacy.example',
    webviewNextUrl: 'not-a-url',
    webviewInstallId: 'install-a',
  });

  assert.equal(config.webAppUrl, 'https://legacy.example/');
  assert.equal(config.selectedTarget, 'legacy');
});

test('Given percentage rollout without install id When resolving config Then selector stays on legacy', () => {
  const config = resolveWebViewConfig({
    webviewTarget: 'percent',
    webviewNextPercent: 100,
    webviewLegacyUrl: 'https://legacy.example',
    webviewNextUrl: 'https://next.example',
  });

  assert.equal(config.webAppUrl, 'https://legacy.example/');
  assert.equal(config.selectedTarget, 'legacy');
});

test('Given malformed public config When resolving config Then safe defaults are used', () => {
  const config = resolveWebViewConfig({
    webviewTarget: 'unsupported',
    webviewLegacyUrl: 'ftp://legacy.example',
    webviewNextUrl: 'https://next.example',
    webviewNextPercent: 500,
    webviewInstallId: 'install-a',
  });

  assert.equal(config.webAppUrl, DEFAULT_LEGACY_WEB_APP_URL);
  assert.equal(config.selectedTarget, 'legacy');
  assert.equal(config.rolloutPercent, 0);
});
