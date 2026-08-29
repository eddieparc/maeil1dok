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
  const moduleInstance = new Module(filePath, module);
  moduleInstance.filename = filePath;
  moduleInstance.paths = Module._nodeModulePaths(path.dirname(filePath));
  moduleInstance._compile(transpiled.outputText, filePath);
  return moduleInstance.exports;
}

const {
  extractIosChannel,
  extractAndroidChannel,
  injectIosChannel,
  injectAndroidChannel,
  judgeChannel,
} = loadModule('storeArtifactChannel.ts');

const PLIST_WITH_CHANNEL = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
  <dict>
    <key>EXUpdatesRequestHeaders</key>
    <dict>
      <key>expo-channel-name</key>
      <string>production</string>
    </dict>
    <key>EXUpdatesEnabled</key>
    <true/>
    <key>EXUpdatesRuntimeVersion</key>
    <string>1.2.2</string>
  </dict>
</plist>`;

// Verbatim shape of the plist `expo prebuild` produced for the store build that
// shipped. Everything looks configured; the one key that decides reach is absent.
const PLIST_WITHOUT_CHANNEL = `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0">
  <dict>
    <key>EXUpdatesCheckOnLaunch</key>
    <string>ALWAYS</string>
    <key>EXUpdatesEnabled</key>
    <true/>
    <key>EXUpdatesRuntimeVersion</key>
    <string>1.2.1</string>
    <key>EXUpdatesURL</key>
    <string>https://u.expo.dev/abc</string>
  </dict>
</plist>`;

const MANIFEST_WITH_CHANNEL =
  '<meta-data android:name="expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY" ' +
  'android:value="{&quot;expo-channel-name&quot;:&quot;production&quot;}"/>';

const MANIFEST_WITHOUT_CHANNEL =
  '<meta-data android:name="expo.modules.updates.EXPO_UPDATE_URL" android:value="https://u.expo.dev/abc"/>';

test('Given a plist carrying the channel Then it is read back', () => {
  assert.equal(extractIosChannel(PLIST_WITH_CHANNEL), 'production');
});

test('Given the plist that actually shipped Then no channel is found', () => {
  // This is the whole defect: updates enabled, url set, runtime set, no channel.
  // The binary asks for a manifest and is answered HTTP 400 every single time.
  assert.equal(extractIosChannel(PLIST_WITHOUT_CHANNEL), null);
});

test('Given an android manifest with entity-escaped headers Then the channel is decoded', () => {
  assert.equal(extractAndroidChannel(MANIFEST_WITH_CHANNEL), 'production');
});

test('Given a compiled binary manifest Then the raw string pool still yields the channel', () => {
  // An .apk/.aab holds AndroidManifest.xml as binary XML, but the string pool
  // keeps the JSON verbatim. Reading it needs no aapt2 on the machine.
  const binaryish = '\u0000\u0003manifest\u0000{"expo-channel-name":"production"}\u0000theme';
  assert.equal(extractAndroidChannel(binaryish), 'production');
});

test('Given an android manifest without the headers key Then no channel is found', () => {
  assert.equal(extractAndroidChannel(MANIFEST_WITHOUT_CHANNEL), null);
});

test('Given a missing channel Then the verdict fails and names the consequence', () => {
  const verdict = judgeChannel({ platform: 'ios', found: null, expected: 'production' });
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /channel/i);
});

test('Given the wrong channel Then the verdict fails rather than passing silently', () => {
  // A binary on `preview` reaches nothing published to `production`. Passing this
  // would reproduce the same undeliverable release with a different symptom.
  const verdict = judgeChannel({ platform: 'android', found: 'preview', expected: 'production' });
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /preview/);
  assert.match(verdict.reason, /production/);
});

test('Given the expected channel Then the verdict passes', () => {
  assert.equal(judgeChannel({ platform: 'ios', found: 'production', expected: 'production' }).ok, true);
});

test('Given a real compiled manifest Then UTF-16 interleaving does not hide the channel', () => {
  // Measured against the actual release APK: AndroidManifest.xml is binary XML
  // whose string pool stores UTF-16LE, so every character is followed by NUL.
  // A reader that only scans the raw bytes reports "no channel" for a build that
  // has one -- a gate that always fails is a gate everyone learns to ignore.
  const utf16 = [...'{"expo-channel-name":"production"}'].map((c) => `${c}\0`).join('');
  assert.equal(extractAndroidChannel(`\0\0${utf16}\0\0`), 'production');
});


/**
 * Warning about the missing channel is not enough — after `expo prebuild` it is
 * ALWAYS missing, so a warning fires every time and stops being read. The local
 * build path has to end up with a channel, not merely be told it lacks one.
 *
 * Verified by round-trip: inject, then read back with the same reader the release
 * gate uses. Asserting on the emitted text instead would let a malformed edit pass.
 */
test('Given a prebuilt plist Then injecting makes the channel readable', () => {
  const injected = injectIosChannel(PLIST_WITHOUT_CHANNEL, 'production');
  assert.equal(extractIosChannel(injected), 'production');
  // Untouched keys survive: the file still configures updates.
  assert.match(injected, /EXUpdatesRuntimeVersion/);
  assert.match(injected, /EXUpdatesURL/);
});

test('Given a plist that already carries a channel Then injection is idempotent', () => {
  // prebuild is re-run constantly; a second pass must not nest or duplicate keys.
  const once = injectIosChannel(PLIST_WITHOUT_CHANNEL, 'production');
  const twice = injectIosChannel(once, 'production');
  assert.equal(extractIosChannel(twice), 'production');
  assert.equal(twice, once);
});

test('Given a different channel Then injection replaces rather than appends', () => {
  const production = injectIosChannel(PLIST_WITHOUT_CHANNEL, 'production');
  const preview = injectIosChannel(production, 'preview');
  assert.equal(extractIosChannel(preview), 'preview');
});

test('Given a prebuilt android manifest Then injecting makes the channel readable', () => {
  const injected = injectAndroidChannel(MANIFEST_WITHOUT_CHANNEL, 'production');
  assert.equal(extractAndroidChannel(injected), 'production');
  assert.match(injected, /EXPO_UPDATE_URL/);
});

test('Given an android manifest already carrying a channel Then injection is idempotent', () => {
  const once = injectAndroidChannel(MANIFEST_WITHOUT_CHANNEL, 'production');
  assert.equal(injectAndroidChannel(once, 'production'), once);
  assert.equal(extractAndroidChannel(injectAndroidChannel(once, 'preview')), 'preview');
});
