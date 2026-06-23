import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const source = await readFile(
  new URL('../app/components/BibleScheduleContent.vue', import.meta.url),
  'utf8',
);

test('default plan message reads the existing auth service state', () => {
  assert.match(
    source,
    /const auth = useAuthService\(\)/,
    'component should expose the auth service as auth',
  );
  assert.doesNotMatch(
    source,
    /authStore\.isAuthenticated/,
    'template should not reference an undefined authStore binding',
  );
  assert.match(
    source,
    /showDefaultPlanMessage && !auth\.isAuthenticated\.value/,
    'default plan message should use the same authenticated ref as the script',
  );
});
