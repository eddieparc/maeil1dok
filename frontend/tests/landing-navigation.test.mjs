import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const quickAccessSource = await readFile(
  new URL('../app/components/home-v2/QuickAccessGrid.vue', import.meta.url),
  'utf8',
);

const floatingNavSource = await readFile(
  new URL('../app/components/home-v2/FloatingNav.vue', import.meta.url),
  'utf8',
);

test('renders hasena card on landing quick access', () => {
  assert.match(quickAccessSource, /to:\s*'\/hasena'/, 'landing quick access should link to /hasena');
  assert.match(quickAccessSource, /title:\s*'하세나'/, 'landing quick access should show Hasena');
  assert.match(quickAccessSource, /testId:\s*'card-hasena'/, 'landing Hasena card should have a stable test id');
});

test('does not render tongdok plan item in landing floating nav', () => {
  assert.doesNotMatch(floatingNavSource, /to="\/plan"/, 'landing floating nav should not include /plan');
  assert.doesNotMatch(floatingNavSource, />통독표</, 'landing floating nav should not include 통독표');
});

test('keeps expected adjacent route links', () => {
  assert.match(quickAccessSource, /to:\s*'\/plans'/, 'landing quick access should keep /plans');
  assert.match(quickAccessSource, /to:\s*'\/bible'/, 'landing quick access should keep /bible');
  assert.match(quickAccessSource, /to:\s*'\/intro'/, 'landing quick access should keep /intro');
});
