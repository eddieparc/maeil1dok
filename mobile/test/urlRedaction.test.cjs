const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadUrlRedactionModule() {
  const filePath = path.join(__dirname, '..', 'urlRedaction.ts');
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

const { redactSensitiveUrl } = loadUrlRedactionModule();

test('Given sensitive query keys with any casing When redacting Then their values are replaced', () => {
  const redacted = redactSensitiveUrl(
    'https://maeil1dok.app/callback?access=one&CODE=two&Refresh=three&Signup_Token=four&TOKEN=five&ACCESS_TOKEN=six&refresh_TOKEN=seven&Id_Token=eight&email=person@example.test&provider_id=nine&suggested_nickname=ten&profile_image=eleven',
  );

  assert.equal(
    redacted,
    'https://maeil1dok.app/callback?access=%5Bredacted%5D&CODE=%5Bredacted%5D&Refresh=%5Bredacted%5D&Signup_Token=%5Bredacted%5D&TOKEN=%5Bredacted%5D&ACCESS_TOKEN=%5Bredacted%5D&refresh_TOKEN=%5Bredacted%5D&Id_Token=%5Bredacted%5D&email=%5Bredacted%5D&provider_id=%5Bredacted%5D&suggested_nickname=%5Bredacted%5D&profile_image=%5Bredacted%5D',
  );
});

test('Given a URL with non-sensitive parts When redacting Then the host path query and hash are preserved', () => {
  const redacted = redactSensitiveUrl('https://maeil1dok.app/reading/today?tab=plan&code=secret#progress');

  assert.equal(redacted, 'https://maeil1dok.app/reading/today?tab=plan&code=%5Bredacted%5D#progress');
});

test('Given an implicit-flow token in a fragment When redacting Then the token is removed case-insensitively', () => {
  const fixtureSecret = 'fragment-token-fixture';
  const redacted = redactSensitiveUrl(
    `https://maeil1dok.app/callback#ACCESS_TOKEN=${fixtureSecret}&state=ok`,
  );

  assert.equal(redacted.includes(fixtureSecret), false);
  assert.match(redacted, /#ACCESS_TOKEN=\[redacted\]&state=\[redacted\]$/);
});

test('Given an encoded intent browser fallback token When redacting Then the decoded fallback token is removed', () => {
  const fixtureSecret = 'fallback-token-fixture';
  const encodedFallback = encodeURIComponent(
    `https://maeil1dok.app/callback?access_token=${fixtureSecret}&state=ok`,
  );
  const redacted = redactSensitiveUrl(
    `intent://maeil1dok.app/callback#Intent;S.browser_fallback_url=${encodedFallback};end`,
  );

  assert.equal(redacted.includes(fixtureSecret), false);
  assert.match(redacted, /#Intent;S\.browser_fallback_url=/);
  assert.match(
    decodeURIComponent(redacted),
    /access_token=\[redacted\]&state=\[redacted\];end$/,
  );
});

test('Given a malformed intent browser fallback token When redacting Then the raw token is still removed', () => {
  const fixtureSecret = 'malformed-fallback-token-fixture';
  const redacted = redactSensitiveUrl(
    `intent://maeil1dok.app/callback#Intent;S.browser_fallback_url=https%ZZ://maeil1dok.app/callback?access_token=${fixtureSecret};end`,
  );

  assert.equal(redacted.includes(fixtureSecret), false);
  assert.match(redacted, /access_token=\[redacted\];end$/);
});

test('Given malformed or relative URLs with sensitive keys When redacting Then the fallback is case-insensitive', () => {
  assert.equal(
    redactSensitiveUrl('/callback?CODE=secret&Access_Token=one&refresh_TOKEN=two&ID_token=three&tab=plan'),
    '/callback?CODE=[redacted]&Access_Token=[redacted]&refresh_TOKEN=[redacted]&ID_token=[redacted]&tab=plan',
  );
  assert.equal(
    redactSensitiveUrl('%%%?ToKeN=secret&ACCESS_token=one&Refresh_Token=two&id_TOKEN=three#fragment'),
    '%%%?ToKeN=[redacted]&ACCESS_token=[redacted]&Refresh_Token=[redacted]&id_TOKEN=[redacted]#fragment',
  );
});

test('Given falsy URLs When redacting Then unknown is returned', () => {
  assert.equal(redactSensitiveUrl(), 'unknown');
  assert.equal(redactSensitiveUrl(null), 'unknown');
  assert.equal(redactSensitiveUrl(''), 'unknown');
});
