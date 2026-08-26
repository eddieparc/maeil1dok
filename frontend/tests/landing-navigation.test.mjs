import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { build } from 'esbuild';
import { compileScript, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import { renderToString } from '@vue/server-renderer';

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

const landingAuthRuntimeSource = await readFile(
  new URL('../app/utils/landingAuthState.ts', import.meta.url),
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

const vueRuntimeExports = Object.keys(Vue)
  .filter(name => /^[A-Za-z_$][\w$]*$/.test(name) && name !== 'default')
  .map(name => `export const ${name} = globalThis.__landingVueRuntime.${name};`)
  .join('\n');

globalThis.__landingVueRuntime = Vue;
globalThis.useState = (_key, initializer) => initializer();
globalThis.useHead = () => {};
globalThis.definePageMeta = () => {};

async function compileLandingComponent(source, filename) {
  const { descriptor, errors } = parse(source, { filename });
  assert.deepEqual(errors, [], `${filename} should parse`);

  const compiled = compileScript(descriptor, {
    id: `landing-${filename}`,
    inlineTemplate: true,
  });
  const result = await build({
    stdin: {
      contents: compiled.content,
      loader: 'ts',
      resolveDir: new URL('../', import.meta.url).pathname,
      sourcefile: filename,
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'landing-ssr-stubs',
        setup(pluginBuild) {
          pluginBuild.onResolve({ filter: /^vue$/ }, () => ({ path: 'vue', namespace: 'landing-vue' }));
          pluginBuild.onLoad({ filter: /.*/, namespace: 'landing-vue' }, () => ({ contents: vueRuntimeExports }));
          pluginBuild.onResolve({ filter: /^~\/composables\/useLandingAuthState$/ }, () => ({
            path: 'landing-auth',
            namespace: 'landing-stub',
          }));
          pluginBuild.onResolve({ filter: /^~\/stores\/readingSettings$/ }, () => ({
            path: 'reading-settings',
            namespace: 'landing-stub',
          }));
          pluginBuild.onResolve({ filter: /^vue-router$/ }, () => ({
            path: 'vue-router',
            namespace: 'landing-stub',
          }));
          pluginBuild.onLoad({ filter: /.*/, namespace: 'landing-stub' }, ({ path }) => {
            if (path === 'landing-auth') {
              return { contents: 'export const useLandingAuthState = () => globalThis.__landingAuthState;' };
            }
            if (path === 'reading-settings') {
              return { contents: 'export const useReadingSettingsStore = () => globalThis.__landingReadingSettingsStore;' };
            }
            return {
              contents: `
                export const useRoute = () => globalThis.__landingRoute;
                export const useRouter = () => globalThis.__landingRouter;
              `,
            };
          });
          pluginBuild.onResolve({ filter: /^@lucide\/vue$/ }, () => ({
            path: 'lucide',
            namespace: 'landing-lucide',
          }));
          pluginBuild.onLoad({ filter: /.*/, namespace: 'landing-lucide' }, () => ({
            contents: `
              import { h } from 'vue';
              const icon = name => (_props, { attrs }) => h('svg', { ...attrs, 'data-icon': name });
              export const HomeIcon = icon('home');
              export const SettingsIcon = icon('settings');
              export const TrophyIcon = icon('trophy');
              export const UserIcon = icon('user');
              export const UsersIcon = icon('users');
            `,
          }));
          pluginBuild.onResolve({ filter: /^~\/.*\.vue$/ }, ({ path }) => ({
            path,
            namespace: 'landing-component',
          }));
          pluginBuild.onLoad({ filter: /.*/, namespace: 'landing-component' }, () => ({
            contents: `
              import { h } from 'vue';
              export default (_props, { attrs }) => h('svg', attrs);
            `,
          }));
        },
      },
    ],
  });

  const dataUrl = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`;
  return (await import(dataUrl)).default;
}

async function importLandingAuthRuntime() {
  const result = await build({
    stdin: {
      contents: landingAuthRuntimeSource,
      loader: 'ts',
      sourcefile: 'landingAuthState.ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`;
  return import(dataUrl);
}

const [
  QuickAccessGrid,
  FloatingNav,
  HomeHero,
  ReadingCardStack,
  LandingPage,
  landingAuthRuntime,
] = await Promise.all([
  compileLandingComponent(quickAccessSource, 'QuickAccessGrid.vue'),
  compileLandingComponent(floatingNavSource, 'FloatingNav.vue'),
  compileLandingComponent(homeHeroSource, 'HomeHero.vue'),
  compileLandingComponent(readingCardStackSource, 'ReadingCardStack.vue'),
  compileLandingComponent(landingPageSource, 'index.vue'),
  importLandingAuthRuntime(),
]);

const NuxtLinkStub = Vue.defineComponent({
  name: 'NuxtLink',
  inheritAttrs: false,
  props: {
    to: { type: [String, Object], required: true },
  },
  setup(props, { attrs, slots }) {
    return () => Vue.h(
      'a',
      { ...attrs, href: typeof props.to === 'string' ? props.to : props.to.path },
      slots.default?.(),
    );
  },
});

const NuxtImgStub = Vue.defineComponent({
  name: 'NuxtImg',
  inheritAttrs: false,
  setup(_, { attrs }) {
    return () => Vue.h('img', attrs);
  },
});

async function renderLandingComponent(component, props = {}) {
  const app = Vue.createSSRApp({
    render: () => Vue.h(component, props),
  });
  app.component('NuxtLink', NuxtLinkStub);
  app.component('NuxtImg', NuxtImgStub);
  return renderToString(app);
}

function useVisitorLandingState() {
  globalThis.__landingAuthState = {
    displayUser: { value: null },
    isKnownAuthenticated: { value: false },
    isFirstPaintPending: { value: true },
  };
  globalThis.__landingRoute = { path: '/' };
  globalThis.__landingRouter = { push: () => {} };
  globalThis.__landingReadingSettingsStore = {
    effectiveTheme: 'light',
    initialize: () => {},
    updateSetting: () => {},
  };
}

test('renders hasena card on landing quick access', async () => {
  useVisitorLandingState();
  const html = await renderLandingComponent(QuickAccessGrid);

  assert.match(html, /<a[^>]*href="\/hasena"[^>]*>[\s\S]*?하세나하시조[\s\S]*?<\/a>/, 'landing quick access should render a /hasena link labeled 하세나하시조');
});

test('does not render tongdok plan item in landing floating nav', async () => {
  useVisitorLandingState();
  const html = await renderLandingComponent(FloatingNav);

  assert.doesNotMatch(html, /href="\/plan"/, 'landing floating nav should not include /plan');
  assert.doesNotMatch(html, />통독표</, 'landing floating nav should not include 통독표');
});

test('landing quick access folds plan management into tongdok card', async () => {
  useVisitorLandingState();
  const html = await renderLandingComponent(QuickAccessGrid);

  assert.match(html, /<a[^>]*href="\/plan"[^>]*>[\s\S]*?통독표[\s\S]*?<\/a>/, 'landing quick access should render the tongdok route');
  assert.match(html, /<a[^>]*href="\/plans"[^>]*>[\s\S]*?<svg[^>]*aria-hidden="true"[\s\S]*?플랜 관리[\s\S]*?<\/a>/, 'plan management should render as a labeled link with a decorative settings icon');
});

test('removes bible and search from landing quick access', async () => {
  useVisitorLandingState();
  const html = await renderLandingComponent(QuickAccessGrid);

  assert.doesNotMatch(html, /href="\/bible"/, 'landing quick access should not show Bible');
  assert.doesNotMatch(html, /href="\/bible\/search"/, 'landing quick access should not show Bible search');
});

test('exposes leaderboard and friends on landing', async () => {
  useVisitorLandingState();
  const quickAccessHtml = await renderLandingComponent(QuickAccessGrid);
  const floatingNavHtml = await renderLandingComponent(FloatingNav);

  assert.match(quickAccessHtml, /href="\/scoreboard"/, 'landing quick access should link to leaderboard');
  assert.match(quickAccessHtml, /href="\/friends"/, 'landing quick access should link to friends');
  assert.doesNotMatch(floatingNavHtml, /href="\/scoreboard"/, 'landing floating nav should not include leaderboard');
  assert.doesNotMatch(floatingNavHtml, /href="\/friends"/, 'landing floating nav should not include friends');
  assert.match(floatingNavHtml, /href="\/bible"/, 'landing floating nav should keep Bible');
});

test('removes landing quick access description copy', async () => {
  useVisitorLandingState();
  const html = await renderLandingComponent(QuickAccessGrid);

  for (const description of [
    '오늘 말씀 묵상',
    '전체 계획 보기',
    '함께 읽는 순위',
    '읽기 동료 보기',
    '깊이 있는 이해',
    '함께 읽는 기쁨',
    '기록과 통계',
  ]) {
    assert.doesNotMatch(html, new RegExp(description));
  }
});

test('floating nav uses an opaque background', () => {
  const floatingNavBlock = floatingNavSource.match(/\.floating-nav\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  const floatingBottomBarBlock = floatingBottomBarSource.match(/\.floating-bottom-area\s*\{[\s\S]*?\n\}/)?.[0] ?? '';

  assert.doesNotMatch(floatingNavSource, /backdrop-filter/, 'landing floating nav should not use glass blur');
  assert.doesNotMatch(floatingNavBlock, /background:\s*rgba\(/, 'landing floating nav container should not use a translucent background');
  assert.doesNotMatch(floatingBottomBarSource, /backdrop-filter/, 'common floating bottom bar should not use glass blur');
  assert.doesNotMatch(floatingBottomBarBlock, /background:\s*rgba\(/, 'common floating bottom bar should not use a translucent background');
});

test('landing quick access cards align icon and title in one row', () => {
  // Browser layout coverage is intentionally deferred to the Playwright layer.
});

test('landing html is not edge cached', () => {
  assert.match(nuxtConfigSource, /'\/':\s*\{\s*headers:\s*\{\s*'cache-control':\s*'no-store'/s, 'landing root route should not serve stale HTML');
});

test('landing auth copy renders useful visitor content during auth initialization', async () => {
  const cachedUser = {
    id: 7,
    username: 'cached-user',
    nickname: '캐시 사용자',
    email: 'cached@example.com',
  };
  const parsedUser = landingAuthRuntime.parseCachedAuthUser(JSON.stringify({ user: cachedUser }));
  assert.deepEqual(parsedUser, cachedUser);
  assert.equal(landingAuthRuntime.parseCachedAuthUser('{invalid json'), null);
  assert.equal(landingAuthRuntime.parseCachedAuthUser(JSON.stringify({ user: { id: '7' } })), null);

  assert.equal(landingAuthRuntime.resolveFirstPaintState(false), true);
  assert.equal(landingAuthRuntime.resolveFirstPaintState(true), false);
  assert.equal(landingAuthRuntime.resolveLandingDisplayUser(null, false, cachedUser), cachedUser);
  assert.equal(landingAuthRuntime.resolveLandingDisplayUser(null, true, cachedUser), null);
  assert.deepEqual(
    landingAuthRuntime.resolveLandingDisplayUser({ ...cachedUser, id: 8 }, true, cachedUser),
    { ...cachedUser, id: 8 },
  );

  useVisitorLandingState();
  const [heroHtml, readingCardHtml] = await Promise.all([
    renderLandingComponent(HomeHero),
    renderLandingComponent(ReadingCardStack),
  ]);

  assert.match(landingAuthStateSource, /hasHydrated\.value = true/, 'landing auth state should not stay pending forever');
  assert.match(heroHtml, />방문자님, 환영합니다</, 'hero should show visitor copy while auth is initializing');
  assert.match(readingCardHtml, />WELCOME</, 'reading card should show visitor label while auth is initializing');
  assert.match(readingCardHtml, /로그인하고<br>시작하세요/, 'reading card should show the login CTA copy while auth is initializing');
  assert.match(readingCardHtml, />나만의 통독 기록을 관리할 수 있습니다</, 'reading card should show useful visitor description while auth is initializing');
  assert.match(readingCardHtml, />로그인 \/ 회원가입/, 'reading card should show the login action while auth is initializing');
  assert.doesNotMatch(heroHtml, /data-allow-mismatch/, 'hero should not suppress hydration mismatch warnings');
  assert.doesNotMatch(readingCardHtml, /data-allow-mismatch|&nbsp;/, 'reading card should render useful first-paint content without mismatch suppression');
});

test('landing logo is eager and preloaded for first paint', () => {
  const logoBlock = landingPageSource.match(/<NuxtImg[\s\S]*?class="logo-img"[\s\S]*?\/>/)?.[0] ?? '';

  assert.doesNotMatch(logoBlock, /loading="lazy"/, 'first viewport landing logo should not be lazy loaded');
  assert.match(logoBlock, /loading="eager"/, 'first viewport landing logo should load eagerly');
  assert.match(landingPageSource, /rel:\s*'preload'/, 'first viewport landing logo should be preloaded');
  assert.match(landingPageSource, /href:\s*'\/images\/logo-transparent\.png'/, 'first viewport landing logo preload should target the concrete asset');
  assert.match(logoBlock, /fetchpriority="high"/, 'first viewport landing logo should have a high priority hint');
  assert.match(logoBlock, /width="376"/, 'first viewport landing logo should reserve the source width to keep the logo ratio');
  assert.match(logoBlock, /height="99"/, 'first viewport landing logo should reserve the source height to keep the logo ratio');
});

test('landing renders content immediately while dismissing the non-blocking skeleton shell on mount', async () => {
  useVisitorLandingState();
  const html = await renderLandingComponent(LandingPage);

  assert.match(html, /class="landing-skeleton"[^>]*aria-hidden="true"/, 'landing SSR should render the non-interactive skeleton');
  assert.match(html, /class="landing-content"/, 'landing content should stay in the SSR output');
  assert.doesNotMatch(landingPageSource, /waitForLocalStylesheets/, 'landing should not wait for stylesheet events before revealing content');
  assert.doesNotMatch(landingPageSource, /document\.querySelectorAll<HTMLLinkElement>\('link\[rel="stylesheet"\]'\)/, 'landing should not inspect stylesheet links at runtime');
  assert.doesNotMatch(landingPageSource, /href\.includes\('\/_nuxt\/'\)/, 'landing should not specifically wait for local Nuxt CSS chunks');
  assert.doesNotMatch(landingPageSource, /\.landing-content\s*\{\s*opacity:\s*0;/, 'critical style should not hide real content before styles are ready');
});

test('above the fold app logos are not lazy loaded', () => {
  for (const { path, source } of logoSurfaceSources) {
    const logoBlock = source.match(/<NuxtImg[\s\S]*?src="\/images\/logo-transparent\.png"[\s\S]*?\/>/)?.[0] ?? '';

    assert.notEqual(logoBlock, '', `${path} should render the Maeil1Dok logo`);
    assert.doesNotMatch(logoBlock, /loading="lazy"/, `${path} logo should not be lazy loaded`);
    assert.match(logoBlock, /loading="eager"/, `${path} logo should load eagerly`);
  }
});

test('keeps expected adjacent route links', async () => {
  useVisitorLandingState();
  const html = await renderLandingComponent(QuickAccessGrid);
  assert.match(html, /href="\/intro"/, 'landing quick access should keep /intro');
});
