import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const source = await readFile(
  new URL('../app/pages/auth/apple/setup.vue', import.meta.url),
  'utf8',
);

test('Apple needs-signup has a real setup route using the signed completion contract', () => {
  assert.match(source, /complete-social-signup/);
  assert.match(source, /signup_token:\s*signupToken\.value/);
  assert.match(source, /provider:\s*'apple'/);
  assert.match(source, /resolveSocialSignupError/);
  assert.match(source, /modal\.alert/);
});
