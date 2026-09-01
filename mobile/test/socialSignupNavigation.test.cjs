const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadModule() {
  const filePath = path.join(__dirname, '..', 'socialSignupNavigation.ts');
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

test('social signup moves PII through sessionStorage, never the URL', () => {
  const { buildSocialSignupNavigation } = loadModule();
  const signupToken = `secret';globalThis.hacked=true;//`;
  const data = {
    provider_id: 'provider-private-id',
    email: 'private@example.test',
    suggested_nickname: 'private nickname',
    profile_image: 'https://images.example.test/private.jpg',
    signup_token: signupToken,
  };

  const navigation = buildSocialSignupNavigation(
    'https://maeil1dok.app',
    'kakao',
    data,
  );

  const parsedUrl = new URL(navigation.url);
  assert.equal(parsedUrl.pathname, '/auth/kakao/setup');
  assert.equal(parsedUrl.search, '');
  assert.equal(navigation.url.includes(signupToken), false);
  assert.equal(navigation.url.includes(data.email), false);

  const stored = new Map();
  const sessionStorage = {
    setItem(key, value) {
      stored.set(key, value);
    },
  };
  const window = { location: { href: '' } };
  Function('sessionStorage', 'window', navigation.script)(sessionStorage, window);
  assert.deepEqual(JSON.parse(stored.get('social_signup_data')), data);
  assert.equal(window.location.href, navigation.url);
  assert.equal(globalThis.hacked, undefined);
});

test('every supported provider reaches its matching setup route with the signed token', () => {
  const { buildSocialSignupNavigation } = loadModule();

  for (const provider of ['apple', 'google', 'kakao']) {
    const data = {
      provider_id: `${provider}-provider`,
      signup_token: `${provider}-signed-token`,
    };
    const navigation = buildSocialSignupNavigation(
      'https://maeil1dok.app',
      provider,
      data,
    );
    const stored = new Map();
    const window = { location: { href: '' } };

    Function('sessionStorage', 'window', navigation.script)(
      {
        setItem(key, value) {
          stored.set(key, value);
        },
      },
      window,
    );

    assert.equal(new URL(navigation.url).pathname, `/auth/${provider}/setup`);
    assert.equal(new URL(navigation.url).search, '');
    assert.equal(
      JSON.parse(stored.get('social_signup_data')).signup_token,
      data.signup_token,
    );
  }
});
