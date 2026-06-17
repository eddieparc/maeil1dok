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

const floatingBottomBarSource = await readFile(
  new URL('../app/components/common/FloatingBottomBar.vue', import.meta.url),
  'utf8',
);

const nuxtConfigSource = await readFile(
  new URL('../nuxt.config.ts', import.meta.url),
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
  assert.doesNotMatch(floatingNavSource, /to="\/scoreboard"/, 'landing floating nav should not include leaderboard');
  assert.doesNotMatch(floatingNavSource, /to="\/friends"/, 'landing floating nav should not include friends');
  assert.match(floatingNavSource, /to="\/bible"/, 'landing floating nav should keep Bible');
});

test('removes landing quick access description copy', () => {
  assert.doesNotMatch(quickAccessSource, />오늘 말씀 묵상</, 'landing quick access should not show Hasena description');
  assert.doesNotMatch(quickAccessSource, />전체 계획 보기</, 'landing quick access should not show plan description');
  assert.doesNotMatch(quickAccessSource, />함께 읽는 순위</, 'landing quick access should not show leaderboard description');
  assert.doesNotMatch(quickAccessSource, />읽기 동료 보기</, 'landing quick access should not show friends description');
  assert.doesNotMatch(quickAccessSource, />깊이 있는 이해</, 'landing quick access should not show intro description');
  assert.doesNotMatch(quickAccessSource, />함께 읽는 기쁨</, 'landing quick access should not show groups description');
  assert.doesNotMatch(quickAccessSource, />기록과 통계</, 'landing quick access should not show activity description');
});

test('floating nav uses an opaque background', () => {
  const floatingNavBlock = floatingNavSource.match(/\.floating-nav\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  const floatingBottomBarBlock = floatingBottomBarSource.match(/\.floating-bottom-area\s*\{[\s\S]*?\n\}/)?.[0] ?? '';

  assert.doesNotMatch(floatingNavSource, /backdrop-filter/, 'landing floating nav should not use glass blur');
  assert.doesNotMatch(floatingNavBlock, /background:\s*rgba\(/, 'landing floating nav container should not use a translucent background');
  assert.match(floatingNavBlock, /background:\s*#2C3333/, 'landing floating nav should use the solid original background');
  assert.doesNotMatch(floatingBottomBarSource, /backdrop-filter/, 'common floating bottom bar should not use glass blur');
  assert.doesNotMatch(floatingBottomBarBlock, /background:\s*rgba\(/, 'common floating bottom bar should not use a translucent background');
  assert.match(floatingBottomBarBlock, /background:\s*#2C3333/, 'common floating bottom bar should use the solid original background');
});

test('landing html is not edge cached', () => {
  assert.match(nuxtConfigSource, /'\/':\s*\{\s*headers:\s*\{\s*'cache-control':\s*'no-store'/s, 'landing root route should not serve stale HTML');
});

test('keeps expected adjacent route links', () => {
  assert.match(quickAccessSource, /to="\/intro"/, 'landing quick access should keep /intro');
});
