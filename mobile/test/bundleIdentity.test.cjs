const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadBundleIdentityModule() {
  const filePath = path.join(__dirname, '..', 'bundleIdentity.ts');
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
  EMBEDDED_UPDATE_ID,
  UNKNOWN_VALUE,
  resolveBundleIdentity,
  formatBundleIdentityLine,
  formatBundleIdentityLabel,
} = loadBundleIdentityModule();

test('Given an applied OTA update When resolving identity Then the update id is carried verbatim', () => {
  const identity = resolveBundleIdentity({
    updateId: '9f1c2d34-5678-4abc-9def-0123456789ab',
    runtimeVersion: '1.2.2',
    channel: 'production',
    isEmbeddedLaunch: false,
    appVersion: '1.2.2',
  });

  assert.equal(identity.updateId, '9f1c2d34-5678-4abc-9def-0123456789ab');
  assert.equal(identity.isEmbedded, false);
  assert.equal(identity.runtimeVersion, '1.2.2');
  assert.equal(identity.channel, 'production');
});

test('Given an embedded launch When resolving identity Then it reads embedded, not unknown', () => {
  // This distinction is the whole point of the surface: "no OTA has been applied"
  // and "we could not read the update id" are different answers to the reach
  // question. Collapsing them makes the H1 verdict unfalsifiable.
  const identity = resolveBundleIdentity({
    updateId: null,
    runtimeVersion: '1.2.2',
    channel: 'production',
    isEmbeddedLaunch: true,
    appVersion: '1.2.2',
  });

  assert.equal(identity.updateId, EMBEDDED_UPDATE_ID);
  assert.equal(identity.isEmbedded, true);
  assert.notEqual(identity.updateId, UNKNOWN_VALUE);
});

test('Given no update information at all When resolving identity Then every field degrades to unknown', () => {
  const identity = resolveBundleIdentity({});

  assert.equal(identity.updateId, UNKNOWN_VALUE);
  assert.equal(identity.runtimeVersion, UNKNOWN_VALUE);
  assert.equal(identity.channel, UNKNOWN_VALUE);
  assert.equal(identity.isEmbedded, false);
});

test('Given non-string update fields When resolving identity Then they are rejected rather than coerced', () => {
  const identity = resolveBundleIdentity({
    updateId: 42,
    runtimeVersion: { major: 1 },
    channel: ['production'],
    appVersion: 1.2,
  });

  assert.equal(identity.updateId, UNKNOWN_VALUE);
  assert.equal(identity.runtimeVersion, UNKNOWN_VALUE);
  assert.equal(identity.channel, UNKNOWN_VALUE);
  assert.equal(identity.appVersion, UNKNOWN_VALUE);
});

test('Given an identity When formatting the log line Then it is greppable and carries the id verbatim', () => {
  const identity = resolveBundleIdentity({
    updateId: '9f1c2d34-5678-4abc-9def-0123456789ab',
    runtimeVersion: '1.2.2',
    channel: 'production',
    isEmbeddedLaunch: false,
    appVersion: '1.2.2',
  });
  const line = formatBundleIdentityLine(identity);

  assert.ok(line.startsWith('[BundleIdentity]'), line);
  assert.ok(line.includes('9f1c2d34-5678-4abc-9def-0123456789ab'), line);
  assert.ok(line.includes('runtime=1.2.2'), line);
  assert.equal(line.includes('\n'), false);
});

test('Given an identity When formatting the on-screen label Then it fits one line and stays readable', () => {
  const identity = resolveBundleIdentity({
    updateId: '9f1c2d34-5678-4abc-9def-0123456789ab',
    runtimeVersion: '1.2.2',
    channel: 'production',
    isEmbeddedLaunch: false,
    appVersion: '1.2.2',
  });
  const label = formatBundleIdentityLabel(identity);

  assert.equal(label.includes('\n'), false);
  assert.ok(label.includes('1.2.2'), label);
  assert.ok(label.includes('9f1c2d34'), label);
});

test('Given an embedded launch When formatting the on-screen label Then it says so instead of showing an id', () => {
  const label = formatBundleIdentityLabel(
    resolveBundleIdentity({ runtimeVersion: '1.2.2', isEmbeddedLaunch: true, channel: 'production' }),
  );

  assert.ok(label.includes(EMBEDDED_UPDATE_ID), label);
});

test('Given an embedded launch that still carries an update id Then isEmbeddedLaunch wins', () => {
  // Measured on a real Android launch: expo-updates reports the EMBEDDED bundle's
  // own uuid in `updateId`, so "id is present" does NOT mean an OTA was applied.
  // Reading presence as reach is exactly the false-positive H1 exists to prevent.
  const identity = resolveBundleIdentity({
    updateId: '251d5f1a-4d2b-4efe-9137-448b7007b851',
    runtimeVersion: '1.2.2',
    channel: 'production',
    isEmbeddedLaunch: true,
    appVersion: '1.2.2',
  });

  assert.equal(identity.isEmbedded, true);
  assert.ok(formatBundleIdentityLabel(identity).includes(EMBEDDED_UPDATE_ID));
  assert.ok(formatBundleIdentityLine(identity).includes('embedded=true'));
  // The raw id stays readable — it identifies WHICH embedded bundle is running.
  assert.equal(identity.updateId, '251d5f1a-4d2b-4efe-9137-448b7007b851');
});

test('Given an applied OTA When formatting Then the line says it is not embedded', () => {
  const identity = resolveBundleIdentity({
    updateId: '9f1c2d34-5678-4abc-9def-0123456789ab',
    runtimeVersion: '1.2.2',
    channel: 'production',
    isEmbeddedLaunch: false,
    appVersion: '1.2.2',
  });

  assert.ok(formatBundleIdentityLine(identity).includes('embedded=false'));
  assert.ok(formatBundleIdentityLabel(identity).includes('9f1c2d34'));
});
