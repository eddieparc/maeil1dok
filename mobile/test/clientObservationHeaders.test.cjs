const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadModule() {
  const filePath = path.join(__dirname, '..', 'clientObservationHeaders.ts');
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

test('native API requests identify shell platform and bounded version', () => {
  const { buildNativeClientObservationHeaders } = loadModule();

  assert.deepEqual(
    buildNativeClientObservationHeaders({
      platform: 'android',
      appVersion: '1.2.3',
    }),
    {
      'X-Client': 'shell',
      'X-App-Platform': 'android',
      'X-App-Version': '1.2.3',
    },
  );
});

test('malformed native app versions are omitted', () => {
  const { buildNativeClientObservationHeaders } = loadModule();
  const headers = buildNativeClientObservationHeaders({
    platform: 'ios',
    appVersion: 'v'.repeat(100),
  });

  assert.deepEqual(headers, {
    'X-Client': 'shell',
    'X-App-Platform': 'ios',
  });
});
