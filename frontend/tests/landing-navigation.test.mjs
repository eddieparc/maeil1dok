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

const homeHeroSource = await readFile(
  new URL('../app/components/home-v2/HomeHero.vue', import.meta.url),
  'utf8',
);

const readingCardStackSource = await readFile(
  new URL('../app/components/home-v2/ReadingCardStack.vue', import.meta.url),
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

const logoSurfaceSources = await Promise.all([
  '../app/components/Header.vue',
  '../app/pages/login.vue',
  '../app/pages/register-email.vue',
  '../app/pages/register.vue',
  '../app/pages/auth/forgot-password.vue',
  '../app/pages/auth/google/setup.vue',
  '../app/pages/auth/kakao/setup.vue',
  '../app/pages/auth/reset-password.vue',
  '../app/pages/auth/verify-email.vue',
].map(async (path) => ({
  path,
  source: await readFile(new URL(path, import.meta.url), 'utf8'),
})));

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
  assert.match(quickAccessSource, /<SettingsIcon/, 'plan management pill should show a settings icon');
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
  assert.match(floatingNavBlock, /background:\s*#fff/, 'landing floating nav should use an opaque white background');
  assert.doesNotMatch(floatingBottomBarSource, /backdrop-filter/, 'common floating bottom bar should not use glass blur');
  assert.doesNotMatch(floatingBottomBarBlock, /background:\s*rgba\(/, 'common floating bottom bar should not use a translucent background');
  assert.match(floatingBottomBarBlock, /background:\s*#fff/, 'common floating bottom bar should use an opaque white background');
});

test('landing quick access cards align icon and title in one row', () => {
  const subCardBlock = quickAccessSource.match(/\.sub-card\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  const cardMainBlock = quickAccessSource.match(/\.card-main\s*\{[\s\S]*?\n\}/)?.[0] ?? '';

  assert.match(subCardBlock, /display:\s*flex/, 'quick access cards should use a row layout');
  assert.match(subCardBlock, /align-items:\s*center/, 'quick access card icons and labels should align in one row');
  assert.match(cardMainBlock, /display:\s*flex/, 'tongdok main link should use a row layout');
});

test('landing html is not edge cached', () => {
  assert.match(nuxtConfigSource, /'\/':\s*\{\s*headers:\s*\{\s*'cache-control':\s*'no-store'/s, 'landing root route should not serve stale HTML');
});

test('landing auth copy waits for auth initialization', () => {
  assert.match(homeHeroSource, /isAuthPending/, 'hero greeting should have an auth-loading state');
  assert.match(readingCardStackSource, /isAuthPending/, 'reading card should have an auth-loading state');
  assert.match(homeHeroSource, /useLandingAuthState/, 'hero should use the landing auth state helper');
  assert.match(readingCardStackSource, /useLandingAuthState/, 'reading card should use the landing auth state helper');
  assert.match(quickAccessSource, /useLandingAuthState/, 'landing profile cards should use the same first-paint auth state');
  assert.match(floatingNavSource, /useLandingAuthState/, 'floating profile link should use the same first-paint auth state');
  assert.match(landingAuthStateSource, /readCachedAuthUser/, 'landing auth state should read cached users for refresh');
  assert.match(landingAuthStateSource, /isFirstPaintPending/, 'landing auth state should hide only the hydration first paint');
  assert.match(landingAuthStateSource, /const isFirstPaintPending = computed\(\(\) => !hasHydrated\.value\);/, 'landing auth state should keep SSR and hydration output aligned');
  assert.match(landingAuthStateSource, /auth\.isInitialized\.value \? null : cachedUser\.value/, 'stale cached users should disappear after auth settles unauthenticated');
  assert.match(landingAuthStateSource, /hasHydrated\.value = true/, 'landing auth state should not stay pending forever');
  assert.doesNotMatch(homeHeroSource, /data-allow-mismatch/, 'hero should not suppress hydration mismatch warnings');
  assert.doesNotMatch(readingCardStackSource, /data-allow-mismatch/, 'reading card should not suppress hydration mismatch warnings');
  assert.match(readingCardStackSource, /if \(isAuthPending\.value\) return;/, 'reading card click handler should not route while auth is loading');
});

test('landing logo is eager and preloaded for first paint', () => {
  const logoBlock = landingPageSource.match(/<NuxtImg[\s\S]*?class="logo-img"[\s\S]*?\/>/)?.[0] ?? '';

  assert.doesNotMatch(logoBlock, /loading="lazy"/, 'first viewport landing logo should not be lazy loaded');
  assert.match(logoBlock, /loading="eager"/, 'first viewport landing logo should load eagerly');
  assert.match(landingPageSource, /rel:\s*'preload'/, 'first viewport landing logo should be preloaded');
  assert.match(landingPageSource, /href:\s*'\/images\/logo-transparent\.png'/, 'first viewport landing logo preload should target the concrete asset');
  assert.match(logoBlock, /fetchpriority="high"/, 'first viewport landing logo should have a high priority hint');
  assert.match(logoBlock, /width="/, 'first viewport landing logo should reserve width');
  assert.match(logoBlock, /height="/, 'first viewport landing logo should reserve height');
});

test('above the fold app logos are not lazy loaded', () => {
  for (const { path, source } of logoSurfaceSources) {
    const logoBlock = source.match(/<NuxtImg[\s\S]*?src="\/images\/logo-transparent\.png"[\s\S]*?\/>/)?.[0] ?? '';

    assert.notEqual(logoBlock, '', `${path} should render the Maeil1Dok logo`);
    assert.doesNotMatch(logoBlock, /loading="lazy"/, `${path} logo should not be lazy loaded`);
    assert.match(logoBlock, /loading="eager"/, `${path} logo should load eagerly`);
  }
});

test('keeps expected adjacent route links', () => {
  assert.match(quickAccessSource, /to="\/intro"/, 'landing quick access should keep /intro');
});
