import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const pageSource = await readFile(
  new URL('../app/pages/auth/apple/setup.vue', import.meta.url),
  'utf8',
);
const composableSource = await readFile(
  new URL('../app/composables/useSocialSignupSetup.ts', import.meta.url),
  'utf8',
);

test('Apple needs-signup delegates to the shared social signup composable', () => {
  assert.match(pageSource, /useSocialSignupSetup\('apple'\)/);
  assert.match(pageSource, /AuthSocialSignupForm/);
});

test('Shared social signup composable uses the signed completion contract', () => {
  assert.match(composableSource, /complete-social-signup/);
  assert.match(composableSource, /signup_token:\s*signupToken\.value/);
  assert.match(composableSource, /resolveSocialSignupError/);
  assert.match(composableSource, /modal\.alert/);
});
