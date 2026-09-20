import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { build } from 'esbuild';
import { compileScript, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import * as Icons from '@lucide/vue';

let importSequence = 0;
globalThis.__pageIcons = Icons;

const runtimeStub = path => {
  if (path === 'vue') {
    if (globalThis.__pageReactiveVue) {
      return `
        export const defineComponent = value => value;
        export const ref = globalThis.__pageReactiveVue.ref;
        export const computed = globalThis.__pageReactiveVue.computed;
        export const watch = globalThis.__pageReactiveVue.watch;
        export const nextTick = globalThis.__pageReactiveVue.nextTick;
        export const onMounted = callback => globalThis.__pageMounted.push(callback);
        export const onBeforeUnmount = () => {};
        export const onUnmounted = () => {};
      `;
    }
    return `
      export const defineComponent = value => value;
      export const ref = value => ({ value });
      export const computed = getter => ({ get value() { return getter(); } });
      export const onMounted = callback => globalThis.__pageMounted.push(callback);
      export const onBeforeUnmount = () => {};
      export const onUnmounted = () => {};
      export const nextTick = async () => {};
      export const watch = (source, callback) => globalThis.__pageWatches.push({ source, callback });
    `;
  }
  if (path === 'vue-router') {
    return 'export const useRouter = () => ({ push() {} });';
  }
  if (path.endsWith('/useAuthService')) {
    return 'export const useAuthService = () => globalThis.__pageAuth;';
  }
  if (path.endsWith('/usePlanApi')) {
    return 'export const usePlanApi = () => globalThis.__pagePlanApi;';
  }
  if (path.endsWith('/useNote')) {
    return 'export const useNote = () => globalThis.__pageRecordApi;';
  }
  if (path.endsWith('/useHighlight')) {
    return `
      export const DEFAULT_HIGHLIGHT_COLORS = [];
      export const useHighlight = () => globalThis.__pageRecordApi;
    `;
  }
  if (path.endsWith('/useBookmark')) {
    return 'export const useBookmark = () => globalThis.__pageRecordApi;';
  }
  if (path.endsWith('/useBibleData')) {
    return `
      export const BIBLE_BOOKS = { old: [], new: [] };
      export const useBibleData = () => ({ getBookName: value => value });
    `;
  }
  if (path.endsWith('/useToast')) {
    return 'export const useToast = () => ({ success() {}, error() {} });';
  }
  if (path.endsWith('/useModal')) {
    return 'export const useModal = () => ({ confirm: async () => false });';
  }
  if (path.endsWith('/useErrorHandler')) {
    return 'export const useErrorHandler = () => ({ handleApiError() {} });';
  }
  if (path.endsWith('/useTextUtils')) {
    return 'export const useTextUtils = () => ({ truncate: value => value });';
  }
  if (path.endsWith('/useApi')) {
    return 'export const useApi = () => globalThis.__pageApi ?? ({ DELETE: async () => undefined, path: value => value });';
  }
  if (path.endsWith('/stores/social')) {
    return 'export const useSocialStore = () => globalThis.__pageSocialStore;';
  }
  if (path.endsWith('/stores/hasena')) {
    return 'export const useHasenaStore = () => globalThis.__pageHasenaStore;';
  }
  if (path.endsWith('/stores/readingSettings')) {
    return `
      export const FONT_FAMILIES = {};
      export const FONT_WEIGHTS = {};
      export const useReadingSettingsStore = () => globalThis.__pageReadingSettings;
    `;
  }
  if (path.endsWith('/stores/groups')) {
    return 'export const useGroupsStore = () => globalThis.__pageGroupsStore;';
  }
  if (path.endsWith('/stores/scoreboard')) {
    return 'export const useScoreboardStore = () => globalThis.__pageScoreboardStore;';
  }
  if (path.endsWith('/useSanitize')) {
    return 'export const useSanitize = () => ({ sanitize: value => value });';
  }
  if (path.endsWith('/hasenaFormatters')) {
    return 'export const formatHasenaSummary = value => value;';
  }
  if (path.endsWith('/hasenaVideoUrl')) {
    return `
      export const buildHasenaEmbedUrl = value => value;
      export const withJsApiEnabled = value => value;
    `;
  }
  if (path === 'lodash-es') {
    return `
      export const debounce = callback => {
        const debounced = (...args) => callback(...args);
        debounced.cancel = () => {};
        return debounced;
      };
    `;
  }
  if (path.endsWith('/dateFormat')) {
    return 'export const formatKoreanDate = value => value;';
  }
  if (path === '@lucide/vue') {
    return Object.keys(Icons)
      .filter(name => name !== 'default' && /^[\w$]+$/.test(name))
      .map(name => `export const ${name} = globalThis.__pageIcons.${name};`)
      .join('\n');
  }
  return 'export default {};';
};

const loadPageSetup = async relativePath => {
  const source = await readFile(new URL(`../app/pages/${relativePath}`, import.meta.url), 'utf8');
  const { descriptor, errors } = parse(source, { filename: relativePath });
  assert.deepEqual(errors, []);
  const compiled = compileScript(descriptor, {
    id: `auth-readiness-${relativePath}`,
  });
  const result = await build({
    stdin: {
      contents: compiled.content,
      loader: 'ts',
      resolveDir: new URL('../', import.meta.url).pathname,
      sourcefile: relativePath,
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
    plugins: [{
      name: 'auth-readiness-page-stubs',
      setup(pluginBuild) {
        pluginBuild.onResolve({ filter: /.*/ }, ({ path }) => ({
          path,
          namespace: 'page-runtime',
        }));
        pluginBuild.onLoad({ filter: /.*/, namespace: 'page-runtime' }, async ({ path }) => {
          if (globalThis.__pageRealNote && path.endsWith('/useNote')) {
            return { contents: await readFile(new URL('../app/composables/useNote.ts', import.meta.url), 'utf8'), loader: 'ts' };
          }
          return { contents: runtimeStub(path) };
        });
      },
    }],
  });

  importSequence += 1;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`;
  const component = (await import(`${dataUrl}#${importSequence}`)).default;
  const createState = () => component.setup({}, { expose() {} });
  const state = globalThis.__pageEffectScope
    ? globalThis.__pageEffectScope.run(createState)
    : createState();
  assert.equal(globalThis.__pageMounted.length, 1);
  return Object.assign(globalThis.__pageMounted[0], { state });
};

const createDeferred = () => {
  let resolve;
  const promise = new Promise(resolvePromise => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const setupGlobals = () => {
  globalThis.__pageMounted = [];
  globalThis.__pageWatches = [];
  globalThis.__pageGroupsStore = { myGroups: [], error: null, fetchGroups: async () => {} };
  globalThis.computed = getter => ({ get value() { return getter(); } });
  globalThis.definePageMeta = () => {};
  globalThis.navigateTo = path => globalThis.__pageNavigations.push(path);
  globalThis.__pageNavigations = [];
  globalThis.onMounted = callback => globalThis.__pageMounted.push(callback);
  globalThis.onUnmounted = () => {};
  globalThis.ref = value => ({ value });
  globalThis.useHead = () => {};
  globalThis.useDateFormat = () => ({ formatRelativeDate: value => value });
  globalThis.watch = (source, callback) => globalThis.__pageWatches.push({ source, callback });
};

const cleanupGlobals = () => {
  globalThis.__pageEffectScope?.stop();
  for (const key of [
    '__pageReactiveVue',
    '__pageRealNote',
    '__pageEffectScope',
    '__pageAuth',
    '__pageApi',
    '__pageHasenaStore',
    '__pageGroupsStore',
    '__pageMounted',
    '__pageNavigations',
    '__pagePlanApi',
    '__pageReadingSettings',
    '__pageRecordApi',
    '__pageScoreboardStore',
    '__pageSocialStore',
    '__pageWatches',
    'computed',
    'definePageMeta',
    'navigateTo',
    'onMounted',
    'onUnmounted',
    'ref',
    'useDateFormat',
    'useHead',
    'watch',
  ]) {
    delete globalThis[key];
  }
};

test('plans page keeps its initial load pending until auth restoration', { timeout: 5000 }, async () => {
  setupGlobals();
  const authReady = createDeferred();
  const fetched = createDeferred();
  globalThis.__pageReactiveVue = Vue;
  globalThis.__pageEffectScope = Vue.effectScope();
  let fetchCount = 0;
  globalThis.__pageAuth = {
    isAuthenticated: Vue.ref(false),
    authState: Vue.ref('unknown'),
    user: Vue.ref(null),
    initialize: () => authReady.promise,
  };
  globalThis.__pagePlanApi = {
    fetchUserPlans: async () => {
      fetchCount += 1;
      fetched.resolve();
      return { subscriptions: [], available_plans: [] };
    },
    subscribeToPlan: async () => false,
    togglePlanActive: async () => false,
    deletePlanSubscription: async () => false,
  };

  try {
    const mounted = await loadPageSetup('plans/index.vue');
    let settled = false;
    const initialLoad = mounted().finally(() => {
      settled = true;
    });
    await Promise.resolve();

    assert.equal(settled, false);
    assert.equal(fetchCount, 0);

    globalThis.__pageAuth.isAuthenticated.value = true;
    globalThis.__pageAuth.authState.value = 'authenticated';
    globalThis.__pageAuth.user.value = { id: 7 };
    authReady.resolve();
    await initialLoad;
    await fetched.promise;
    assert.equal(fetchCount, 1);
  } finally {
    cleanupGlobals();
  }
});

test('friends page waits for auth restoration before redirecting or loading', { timeout: 5000 }, async () => {
  setupGlobals();
  const authReady = createDeferred();
  let readCount = 0;
  globalThis.__pageAuth = {
    isAuthenticated: { value: false },
    user: { value: null },
    initialize: () => authReady.promise,
  };
  globalThis.__pageSocialStore = {
    followUser: async () => ({ success: true }),
    unfollowUser: async () => ({ success: true }),
  };
  globalThis.__pageApi = {
    GET: async () => {
      readCount += 1;
      return { data: { success: true, data: { friends: [], followers: [], following: [] } } };
    },
    path: value => value,
  };

  try {
    const mounted = await loadPageSetup('friends.vue');
    const initialLoad = mounted();
    await Promise.resolve();

    assert.deepEqual(globalThis.__pageNavigations, []);
    assert.equal(readCount, 0);

    globalThis.__pageAuth.isAuthenticated.value = true;
    globalThis.__pageAuth.user.value = { id: 7 };
    authReady.resolve();
    await initialLoad;

    assert.deepEqual(globalThis.__pageNavigations, []);
    assert.equal(readCount, 3);
  } finally {
    cleanupGlobals();
  }
});

test('admin hasena waits for restored staff auth before loading summaries', { timeout: 5000 }, async () => {
  // The page is now a thin wrapper. Mount its real template, staff-only layout
  // and data child so neither the auth boundary nor the request can be stubbed away.
  const require = createRequire(import.meta.url);
  const vue = require('vue');
  const { createRouter, createMemoryHistory, RouterLink } = require('vue-router');
  const authReady = createDeferred(), initialized = createDeferred(), fetched = createDeferred();
  const auth = {
    isAuthenticated: vue.ref(false), isStaff: vue.ref(false), user: vue.ref(null),
    isInitialized: vue.ref(false), isLoading: vue.ref(true), isSessionUnknown: vue.ref(false),
    initialize: async () => {
      initialized.resolve();
      await authReady.promise;
      auth.isInitialized.value = true;
      auth.isLoading.value = false;
    },
  };
  const reads = [];
  const api = { GET: async (path, options) => {
    reads.push({ path, options });
    fetched.resolve();
    return { data: { success: true, summaries: [], total: 0, page: 1, page_size: 20 } };
  } };
  const appDir = new URL('../app/', import.meta.url).pathname;
  const result = await build({
    stdin: { contents: "export { default } from './pages/admin/hasena/index.vue';", resolveDir: appDir, loader: 'ts' },
    bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
    external: ['vue', 'vue-router', '@lucide/vue', '#components', '~/composables/*'],
    plugins: [{ name: 'mounted-auth-readiness', setup(builder) {
      builder.onResolve({ filter: /^~\/components\// }, ({ path }) => ({ path: resolve(appDir, path.slice(2)) }));
      builder.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
        const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path });
        assert.deepEqual(errors, []);
        return { contents: compileScript(descriptor, { id: path, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } }).content, loader: 'ts', resolveDir: dirname(path) };
      });
    } }],
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(name => {
    if (name === '~/composables/useAuthService') return { useAuthService: () => auth };
    if (name === '~/composables/useApi') return { useApi: () => api };
    if (name === '~/composables/useModal') return { useModal: () => ({ isModalOpen: () => false }) };
    if (name === '~/composables/useCdnAsset') return { useCdnAsset: () => ({ cdnAsset: p => p, cdnBase: '' }) };
    if (name === '#components') return { NuxtLink: RouterLink };
    return require(name);
  }, module, module.exports);
  const node = (tag, text = '') => ({ tag, text, props: {}, children: [], parent: null });
  const detach = child => { if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1); child.parent = null; };
  const renderer = vue.createRenderer({
    createElement: node, createText: text => node('#text', text), createComment: text => node('#comment', text),
    setText(target, text) { target.text = text; }, setElementText(target, text) { target.text = text; target.children = []; },
    patchProp(target, key, previous, value) { target.props[key] = value; },
    insert(child, parent, anchor = null) { detach(child); parent.children.splice(anchor ? parent.children.indexOf(anchor) : parent.children.length, 0, child); child.parent = parent; },
    remove: detach, parentNode: child => child.parent, nextSibling: child => child.parent?.children[child.parent.children.indexOf(child) + 1] ?? null,
    setScopeId() {}, insertStaticContent() { throw new Error('Unexpected static HTML'); },
  });
  const root = node('root');
  const find = (target, attr) => target.props[attr] !== undefined ? target : target.children.map(child => find(child, attr)).find(Boolean);
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/admin/hasena', component: module.exports.default }] });
  await router.push('/admin/hasena');
  const app = renderer.createApp(module.exports.default);
  app.use(router);
  try {
    app.mount(root);
    await initialized.promise;
    assert.equal(find(root, 'data-admin-state').props['data-admin-state'], 'loading');
    assert.equal(find(root, 'data-hasena-state'), undefined);
    assert.deepEqual(reads, []);

    auth.isAuthenticated.value = true;
    auth.isStaff.value = true;
    auth.user.value = { id: 7, is_staff: true };
    await vue.nextTick();
    assert.deepEqual(reads, [], 'staff identity alone cannot bypass unfinished initialization');
    authReady.resolve();
    await fetched.promise;
    await vue.nextTick();
    assert.equal(find(root, 'data-admin-state').props['data-admin-state'], 'staff');
    assert.ok(find(root, 'data-hasena-state'));
    assert.deepEqual(reads, [{ path: '/api/v1/todos/hasena/summaries/', options: { params: { status: 'all', page: 1, page_size: 20 } } }]);
  } finally {
    app.unmount();
  }
});

test('hasena starts public content immediately but waits for auth before private stats', { timeout: 5000 }, async () => {
  setupGlobals();
  const authReady = createDeferred();
  let authInitializeCount = 0;
  const publicReadStarted = createDeferred();
  let publicReadCount = 0;
  let statsReadCount = 0;
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { userAgent: '' },
  });
  globalThis.window = { YT: {} };
  globalThis.__pageAuth = {
    isAuthenticated: { value: false },
    isStaff: { value: false },
    initialize: () => {
      authInitializeCount += 1;
      return authReady.promise;
    },
  };
  globalThis.__pageHasenaStore = {
    isCompleted: false,
    isLoading: false,
    setCompletionStatus() {},
    fetchStats: async () => {
      statsReadCount += 1;
    },
    updateStatus: async () => {},
  };
  globalThis.__pageReadingSettings = {
    settings: {},
    initialize: async () => {},
  };
  globalThis.__pageApi = {
    GET: async path => {
      publicReadCount += 1;
      publicReadStarted.resolve();
      if (path.endsWith('/day/')) {
        return {
          data: {
            success: true,
            entry: { passage: '요한복음 1장', verses: [], video_id: 'video-1' },
            is_completed: false,
          },
        };
      }
      return { data: { success: true, summary: '요약' } };
    },
  };

  try {
    const mounted = await loadPageSetup('hasena.vue');
    let settled = false;
    const initialLoad = mounted().finally(() => {
      settled = true;
    });
    await publicReadStarted.promise;

    const stateBeforeAuthReady = {
      authInitializeCount,
      publicReadCount,
      statsReadCount,
      settled,
    };

    globalThis.__pageAuth.isAuthenticated.value = true;
    authReady.resolve();
    await initialLoad;

    assert.equal(stateBeforeAuthReady.authInitializeCount, 1);
    assert.equal(stateBeforeAuthReady.publicReadCount > 0, true);
    assert.equal(stateBeforeAuthReady.statsReadCount, 0);
    assert.equal(stateBeforeAuthReady.settled, false);
    assert.equal(publicReadCount, 2);
    assert.equal(statsReadCount, 1);
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: originalNavigator,
    });
    globalThis.window = originalWindow;
    cleanupGlobals();
  }
});

test('scoreboard loads public data with auth and decides own ranking after both finish', { timeout: 5000 }, async () => {
  setupGlobals();
  const authReady = createDeferred();
  const globalReady = createDeferred();
  let authInitializeCount = 0;
  let globalReadCount = 0;
  let ownRankingReadCount = 0;
  globalThis.__pageAuth = {
    isAuthenticated: { value: false },
    user: { value: null },
    initialize: () => {
      authInitializeCount += 1;
      return authReady.promise;
    },
  };
  globalThis.__pageScoreboardStore = {
    currentPeriod: 'month',
    selectedMonth: '2026-08',
    isLoading: false,
    globalLeaderboard: [],
    followingLeaderboard: [],
    friendsLeaderboard: [],
    myRanking: null,
    fetchGlobalLeaderboard: () => {
      globalReadCount += 1;
      return globalReady.promise;
    },
    fetchFriendsLeaderboard: async () => {},
    fetchMyRanking: async () => {
      ownRankingReadCount += 1;
    },
    setPeriod() {},
    setSelectedMonth() {},
    clearScoreboardData() {},
  };

  try {
    const mounted = await loadPageSetup('scoreboard.vue');
    const initialLoad = mounted();
    await Promise.resolve();

    assert.equal(globalReadCount, 1);
    assert.equal(authInitializeCount, 1);

    globalReady.resolve();
    await Promise.resolve();
    assert.equal(ownRankingReadCount, 0);

    globalThis.__pageAuth.isAuthenticated.value = true;
    authReady.resolve();
    await initialLoad;

    assert.equal(ownRankingReadCount, 1);
  } finally {
    cleanupGlobals();
  }
});

test('scoreboard relationship tab selected during auth waits before loading', { timeout: 5000 }, async () => {
  setupGlobals();
  const authReady = createDeferred();
  const globalReady = createDeferred();
  const relationshipReadCompleted = createDeferred();
  let relationshipReadCount = 0;
  globalThis.__pageAuth = {
    isAuthenticated: { value: false },
    user: { value: null },
    initialize: () => authReady.promise,
  };
  globalThis.__pageScoreboardStore = {
    currentPeriod: 'month',
    selectedMonth: '2026-08',
    isLoading: false,
    globalLeaderboard: [],
    followingLeaderboard: [],
    friendsLeaderboard: [],
    myRanking: null,
    fetchGlobalLeaderboard: () => globalReady.promise,
    fetchFriendsLeaderboard: async () => {
      relationshipReadCount += 1;
      relationshipReadCompleted.resolve();
    },
    fetchMyRanking: async () => {},
    setPeriod() {},
    setSelectedMonth() {},
    clearScoreboardData() {},
  };

  try {
    const mounted = await loadPageSetup('scoreboard.vue');
    const initialLoad = mounted();
    await Promise.resolve();

    const activeViewWatch = globalThis.__pageWatches.find(watch => watch.source.value === 'global');
    assert.ok(activeViewWatch);
    activeViewWatch.source.value = 'friends';
    activeViewWatch.callback();
    await Promise.resolve();
    assert.equal(relationshipReadCount, 0);

    globalThis.__pageAuth.isAuthenticated.value = true;
    authReady.resolve();
    globalReady.resolve();
    await initialLoad;
    // Missing readiness settles without a request; assert before awaiting its signal.
    assert.equal(relationshipReadCount, 1);
    await relationshipReadCompleted.promise;
  } finally {
    cleanupGlobals();
  }
});

test('scoreboard invalidates group selection and membership readiness when the auth owner changes', { timeout: 5000 }, async () => {
  setupGlobals();
  const scope = Vue.effectScope();
  globalThis.ref = Vue.ref;
  globalThis.computed = Vue.computed;
  globalThis.watch = (source, callback) => scope.run(() => Vue.watch(source, callback));
  globalThis.__pageAuth = {
    user: Vue.ref({ id: 7 }),
    isAuthenticated: Vue.ref(true),
    initialize: async () => {},
  };
  const groupRequests = [];
  const rankingRequests = [];
  globalThis.__pageGroupsStore = Vue.reactive({
    myGroups: [],
    error: null,
    fetchGroups: async filters => {
      groupRequests.push(filters);
      globalThis.__pageGroupsStore.myGroups = [{ id: globalThis.__pageAuth.user.value.id + 10 }];
    },
  });
  globalThis.__pageScoreboardStore = Vue.reactive({
    currentPeriod: 'month', selectedMonth: '2026-08', isLoading: false,
    globalLeaderboard: [], groupLeaderboard: [], friendsLeaderboard: [], followingLeaderboard: [],
    myRanking: null, error: null,
    fetchGlobalLeaderboard: async () => {},
    fetchMyRanking: async () => {},
    fetchGroupLeaderboard: async (...args) => { rankingRequests.push(args); },
  });

  try {
    const mounted = await loadPageSetup('scoreboard.vue');
    await mounted();
    const state = mounted.state;
    const firstLoaded = createDeferred();
    const stopFirst = Vue.watch(state.groupsLoaded, loaded => { if (loaded) firstLoaded.resolve(); });
    state.activeView.value = 'group';
    await firstLoaded.promise;
    stopFirst();
    assert.equal(state.selectedGroupId.value, 17);

    const invalidated = createDeferred();
    const stopInvalidated = Vue.watch(state.selectedGroupId, id => { if (id === null) invalidated.resolve(); });
    globalThis.__pageAuth.user.value = { id: 8 };
    await invalidated.promise;
    stopInvalidated();
    assert.equal(state.groupsLoaded.value, false);
    assert.deepEqual(globalThis.__pageGroupsStore.myGroups, []);
    await state.loadLeaderboard();
    assert.equal(state.selectedGroupId.value, 18);
    assert.equal(groupRequests.length, 2);
    assert.deepEqual(rankingRequests.at(-1), [18, 'month', '2026-08']);

    const loggedOut = createDeferred();
    const stopLogout = Vue.watch(state.selectedGroupId, id => { if (id === null) loggedOut.resolve(); });
    globalThis.__pageAuth.isAuthenticated.value = false;
    await loggedOut.promise;
    stopLogout();
    assert.equal(state.groupsLoaded.value, false);

    const membershipStarted = createDeferred();
    const membershipReady = createDeferred();
    globalThis.__pageGroupsStore.fetchGroups = () => {
      membershipStarted.resolve();
      return membershipReady.promise;
    };
    globalThis.__pageAuth.isAuthenticated.value = true;
    await Vue.nextTick();
    const pendingLoad = state.loadLeaderboard();
    await membershipStarted.promise;
    globalThis.__pageAuth.user.value = { id: 9 };
    await Vue.nextTick();
    globalThis.__pageGroupsStore.myGroups = [{ id: 18 }];
    membershipReady.resolve();
    await pendingLoad;
    assert.equal(state.groupsLoaded.value, false);
    assert.equal(state.selectedGroupId.value, null);
    assert.equal(rankingRequests.length, 2);
  } finally {
    scope.stop();
    cleanupGlobals();
  }
});

for (const [relativePath, collection] of [
  ['bible/notes/index.vue', 'notes'],
  ['bible/highlights/index.vue', 'highlights'],
  ['bible/bookmarks.vue', 'bookmarks'],
]) {
  test(`${relativePath} waits for resolved auth before reading private records`, { timeout: 5000 }, async () => {
    // Given an unresolved session and the real Vue identity watcher.
    setupGlobals();
    globalThis.__pageReactiveVue = Vue;
    globalThis.__pageEffectScope = Vue.effectScope();
    globalThis.__pageRealNote = true;
    const auth = {
      user: Vue.ref(null), isAuthenticated: Vue.ref(false),
      isInitialized: Vue.ref(false), isLoading: Vue.ref(true),
    };
    globalThis.__pageAuth = auth;
    globalThis.__pageRecordApi = { highlights: Vue.ref([]), deleteHighlight: async () => false };
    const requests = [];
    globalThis.__pageApi = { GET: async path => {
      requests.push(path);
      return { data: { results: [] } };
    } };
    try {
      const mounted = await loadPageSetup(relativePath);
      mounted();
      await Vue.nextTick();
      assert.deepEqual(requests, [], 'mount cannot read private data while auth is unresolved');
      // When initialization publishes the authenticated identity.
      auth.user.value = { id: 7 };
      auth.isAuthenticated.value = true;
      auth.isInitialized.value = true;
      auth.isLoading.value = false;
      await Vue.nextTick();
      // Then the watcher issues exactly one read through the actual GET boundary.
      assert.deepEqual(requests, [`/api/v1/todos/bible/${collection}/`]);
    } finally {
      cleanupGlobals();
    }
  });
}
