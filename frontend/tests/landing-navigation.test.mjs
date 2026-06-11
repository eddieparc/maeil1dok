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
  assert.match(quickAccessSource, /to="\/hasena"/, 'landing quick access should link to /hasena');
  assert.match(quickAccessSource, />하세나하시조</, 'landing quick access should show HasenaHasijo');
  assert.match(quickAccessSource, /data-testid="card-hasena"/, 'landing Hasena card should have a stable test id');
});

test('does not render tongdok plan item in landing floating nav', () => {
  assert.doesNotMatch(floatingNavSource, /to="\/plan"/, 'landing floating nav should not include /plan');
  assert.doesNotMatch(floatingNavSource, />통독표</, 'landing floating nav should not include 통독표');
});

test('does not render management item in landing floating nav', () => {
  assert.doesNotMatch(floatingNavSource, /to="\/plans"/, 'landing floating nav should not include /plans');
  assert.doesNotMatch(floatingNavSource, />관리</, 'landing floating nav should not include 관리');
});

test('keeps expected adjacent route links', () => {
  assert.match(quickAccessSource, /to="\/plans"/, 'landing quick access should keep /plans');
  assert.match(quickAccessSource, /to="\/bible"/, 'landing quick access should keep /bible');
  assert.match(quickAccessSource, /to="\/intro"/, 'landing quick access should keep /intro');
});
