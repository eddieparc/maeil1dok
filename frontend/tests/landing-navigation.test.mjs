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

test('landing quick access folds plan management into tongdok card', () => {
  assert.match(quickAccessSource, /to="\/plan"/, 'landing quick access should link to /plan');
  assert.match(quickAccessSource, /to="\/plans"/, 'landing tongdok card should expose plan management');
  assert.match(quickAccessSource, /class="plan-pill"/, 'plan management should render as a pill inside the tongdok card');
});

test('removes bible and search from landing quick access', () => {
  assert.doesNotMatch(quickAccessSource, /data-testid="card-bible"/, 'landing quick access should not show Bible');
  assert.doesNotMatch(quickAccessSource, /data-testid="card-bible-search"/, 'landing quick access should not show Bible search');
});

test('exposes leaderboard and friends on landing', () => {
  assert.match(quickAccessSource, /to="\/scoreboard"/, 'landing quick access should link to leaderboard');
  assert.match(quickAccessSource, /to="\/friends"/, 'landing quick access should link to friends');
  assert.match(floatingNavSource, /to="\/scoreboard"/, 'landing floating nav should link to leaderboard');
  assert.match(floatingNavSource, /to="\/friends"/, 'landing floating nav should link to friends');
  assert.doesNotMatch(floatingNavSource, /to="\/bible"/, 'landing floating nav should not include Bible');
});

test('keeps expected adjacent route links', () => {
  assert.match(quickAccessSource, /to="\/intro"/, 'landing quick access should keep /intro');
});
