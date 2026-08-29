const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// `storeArtifactChannel.ts` is what the unit tests read; the CLI imports a plain
// `.mjs` twin because it runs under bare node with no transpiler. Two copies of a
// rule drift silently, and a drifted copy here means the release gate passes a
// binary the tests would have rejected. This asserts they agree on real inputs.
function loadTs(name) {
  const filePath = path.join(__dirname, '..', name);
  const transpiled = ts.transpileModule(fs.readFileSync(filePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filePath,
  });
  const instance = new Module(filePath, module);
  instance.filename = filePath;
  instance.paths = Module._nodeModulePaths(path.dirname(filePath));
  instance._compile(transpiled.outputText, filePath);
  return instance.exports;
}

const source = loadTs('storeArtifactChannel.ts');

const PLIST = '<key>EXUpdatesRequestHeaders</key><dict><key>expo-channel-name</key><string>production</string></dict>';
const MANIFEST = 'android:value="{&quot;expo-channel-name&quot;:&quot;preview&quot;}"';

test('the CLI twin agrees with the tested source on every rule', async () => {
  const twin = await import(path.join(__dirname, '..', 'scripts', 'storeArtifactChannelRuntime.mjs'));

  assert.equal(twin.CHANNEL_HEADER, source.CHANNEL_HEADER);
  for (const input of [PLIST, '<plist><dict/></plist>', '']) {
    assert.equal(twin.extractIosChannel(input), source.extractIosChannel(input), input.slice(0, 30));
  }
  for (const input of [MANIFEST, '{"expo-channel-name":"production"}', 'nothing here']) {
    assert.equal(twin.extractAndroidChannel(input), source.extractAndroidChannel(input), input.slice(0, 30));
  }
  for (const found of [null, 'preview', 'production']) {
    const a = twin.judgeChannel({ platform: 'ios', found, expected: 'production' });
    const b = source.judgeChannel({ platform: 'ios', found, expected: 'production' });
    assert.deepEqual(a, b, String(found));
  }
});
