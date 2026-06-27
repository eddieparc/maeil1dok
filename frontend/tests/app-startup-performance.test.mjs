import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const authInitPluginSource = await readFile(
  new URL('../app/plugins/auth-init.client.ts', import.meta.url),
  'utf8',
);

const authServiceSource = await readFile(
  new URL('../app/composables/useAuthService.ts', import.meta.url),
  'utf8',
);

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

const extractFunctionBody = (source, functionName) => {
  const start = source.indexOf(`async function ${functionName}`);
  assert.notEqual(start, -1, `${functionName} should exist`);

  const bodyStart = source.indexOf('{', start);
  assert.notEqual(bodyStart, -1, `${functionName} should have a body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(bodyStart, index + 1);
    }
  }

  assert.fail(`${functionName} body should close`);
};

test('client auth plugin does not block app startup on network auth checks', () => {
  assert.match(authInitPluginSource, /parallel:\s*true/, 'auth plugin should be parallelized by Nuxt');
  assert.match(authInitPluginSource, /void auth\.initialize\(\)/, 'auth should start in the background');
  assert.doesNotMatch(authInitPluginSource, /await auth\.initialize\(\)/, 'app startup should not await auth network checks');
  assert.match(authInitPluginSource, /void readingSettingsStore\.initialize\(\)/, 'settings sync should not block hydration');
  assert.doesNotMatch(authInitPluginSource, /await readingSettingsStore\.initialize\(\)/, 'settings sync should stay off the critical path');
});

test('anonymous startup avoids a redundant token refresh probe', () => {
  const initializeBody = extractFunctionBody(authServiceSource, 'initialize');

  assert.match(initializeBody, /const user = cachedUser\s*\?\s*await fetchUserWithRefresh\(\)\s*:\s*await fetchUserFromApi\(\)/, 'initialize should only run refresh recovery for a cached user session');
  assert.doesNotMatch(initializeBody, /const user = await fetchUserWithRefresh\(\)/, 'anonymous startup should not always probe token refresh after auth user check');
});

test('landing page does not duplicate global auth initialization work', () => {
  assert.doesNotMatch(landingPageSource, /useAuthService/, 'landing page should not own global auth initialization');
  assert.doesNotMatch(landingPageSource, /auth\.initialize\(\)/, 'landing page should not start duplicate auth initialization');
  assert.doesNotMatch(landingAuthStateSource, /auth\.initialize\(\)/, 'landing auth helper should read current state without starting duplicate initialization');
  assert.match(landingAuthStateSource, /readCachedAuthUser\(\)/, 'landing auth helper should keep instant cached-user display');
});

test('native app WebView keeps warm caches and accelerated rendering enabled', () => {
  assert.match(mobileAppSource, /cacheEnabled=\{true\}/, 'native WebView should keep HTTP cache enabled for repeat app opens');
  assert.match(mobileAppSource, /cacheMode="LOAD_DEFAULT"/, 'Android WebView should use normal cache heuristics');
  assert.match(mobileAppSource, /androidLayerType="hardware"/, 'Android WebView should use hardware compositing');
  assert.match(mobileAppSource, /decelerationRate="normal"/, 'iOS WebView should use native-feeling scroll deceleration');
  assert.match(mobileAppSource, /pullToRefreshEnabled=\{false\}/, 'WebView should not install extra pull-to-refresh work on the startup path');
});
