import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const { transform } = esbuild;

const authInitPluginSource = await readFile(
  new URL('../app/plugins/auth-init.client.ts', import.meta.url),
  'utf8',
);

const authSessionPolicySource = await readFile(
  new URL('../app/composables/authSessionPolicy.ts', import.meta.url),
  'utf8',
);

const importAuthSessionPolicy = async () => {
  const { code } = await transform(authSessionPolicySource, {
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return import(`${dataUrl}#${Date.now()}-${Math.random()}`);
};

const landingAuthStateSource = await readFile(
  new URL('../app/composables/useLandingAuthState.ts', import.meta.url),
  'utf8',
);

const landingPageSource = await readFile(
  new URL('../app/pages/index.vue', import.meta.url),
  'utf8',
);

const mobileAppSource = await readFile(
  new URL('../../mobile/App.tsx', import.meta.url),
  'utf8',
);

test('client auth plugin does not block app startup on network auth checks', () => {
  assert.match(authInitPluginSource, /parallel:\s*true/, 'auth plugin should be parallelized by Nuxt');
  assert.doesNotMatch(authInitPluginSource, /await auth\.initialize\(\)/, 'app startup should not await auth network checks');
  assert.doesNotMatch(authInitPluginSource, /await readingSettingsStore\.initialize\(\)/, 'settings sync should stay off the critical path');
});

test('anonymous startup avoids a redundant token refresh probe', async () => {
  const { fetchInitialAuthUser } = await importAuthSessionPolicy();
  let directFetches = 0;
  let refreshRecoveries = 0;
  const dependencies = {
    fetchUser: async () => {
      directFetches += 1;
      return null;
    },
    fetchUserWithRefresh: async () => {
      refreshRecoveries += 1;
      return { id: 1 };
    },
  };

  assert.equal(await fetchInitialAuthUser(null, dependencies), null);
  assert.equal(directFetches, 1);
  assert.equal(refreshRecoveries, 0, 'anonymous startup must not probe token refresh');

  assert.deepEqual(await fetchInitialAuthUser({ id: 1 }, dependencies), { id: 1 });
  assert.equal(directFetches, 1);
  assert.equal(refreshRecoveries, 1, 'a cached session should use refresh recovery');
});

test('landing page does not duplicate global auth initialization work', () => {
  assert.doesNotMatch(landingPageSource, /useAuthService/, 'landing page should not own global auth initialization');
  assert.doesNotMatch(landingPageSource, /auth\.initialize\(\)/, 'landing page should not start duplicate auth initialization');
  assert.doesNotMatch(landingAuthStateSource, /auth\.initialize\(\)/, 'landing auth helper should read current state without starting duplicate initialization');
});

test('native app WebView keeps warm caches and accelerated rendering enabled', () => {
  assert.match(mobileAppSource, /cacheEnabled=\{true\}/, 'native WebView should keep HTTP cache enabled for repeat app opens');
  assert.match(mobileAppSource, /cacheMode="LOAD_DEFAULT"/, 'Android WebView should use normal cache heuristics');
  assert.match(mobileAppSource, /androidLayerType="hardware"/, 'Android WebView should use hardware compositing');
  // Was `decelerationRate="normal"`. Fabric types this prop Float and casts
  // straight to Double, so the documented string form crashed the app on launch
  // (String cannot be cast to Double, observed on the Android emulator). This
  // assertion used to pin that crash in place; 0.998 is what 'normal' meant.
  assert.match(
    mobileAppSource,
    /decelerationRate=\{DECELERATION_RATE_NORMAL\}/,
    'WebView scroll deceleration must be numeric under the new architecture',
  );
  assert.match(mobileAppSource, /DECELERATION_RATE_NORMAL = 0\.998/, 'deceleration constant should keep the native feel');
  assert.match(mobileAppSource, /pullToRefreshEnabled=\{false\}/, 'WebView should not install extra pull-to-refresh work on the startup path');
});
