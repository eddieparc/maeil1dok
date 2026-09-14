import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import { afterEach, test } from 'node:test';
import { build } from 'esbuild';
import { compileScript, parse } from '@vue/compiler-sfc';

const require = createRequire(import.meta.url);
const Vue = require('vue');
const Router = require('vue-router');
const Pinia = require('pinia');
const appDir = fileURLToPath(new URL('../app/', import.meta.url));
const cache = new Map();
let env;
const events = new EventEmitter();
const signal = () => queueMicrotask(() => events.emit('render'));
const passthrough = Vue.defineComponent({ setup: (_, { slots }) => () => Vue.h('main', [slots['header-action']?.(), slots.default?.()]) });
async function load(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const mocks = {
    '~/composables/useAuthService': 'exports.useAuthService = () => globalThis.__introEnv.auth',
    '~/composables/useToast': 'exports.useToast = () => globalThis.__introEnv.toast',
    '~/composables/useModal': 'exports.useModal = () => globalThis.__introEnv.modal',
    '~/composables/useFocusTrap': 'exports.useFocusTrap = () => ({ isTopmost: require("vue").ref(true), zIndex: require("vue").ref(100) })',
    '~/composables/useScrollLock': 'exports.useScrollLock = () => {}',
    '~/components/common/PageLayout.vue': 'module.exports = globalThis.__introEnv.layout',
    // Legacy RED-only overlay; the shipped BottomSheet and its content render normally.
    '~/components/schedule/PlanSelectorModal.vue': 'module.exports = globalThis.__introEnv.layout',
    '#app': 'exports.useRuntimeConfig = () => ({ public: { apiBase: "https://api.test" } })',
    '#imports': 'exports.useHead = () => {}',
    '#components': 'exports.NuxtLink = require("vue-router").RouterLink; exports.NuxtPage = require("vue-router").RouterView',
  };
  const result = await build({
    entryPoints: [resolve(appDir, relative)], bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
    external: ['vue', 'vue-router', 'pinia', '@lucide/vue'],
    define: { 'import.meta.client': 'true', 'import.meta.server': 'false' },
    plugins: [{ name: 'intro-runtime', setup(b) {
      b.onResolve({ filter: /^(~\/|#)/ }, ({ path }) => mocks[path] ? { path, namespace: 'mock' } : { path: resolve(appDir, path.slice(2) + (path.endsWith('.vue') || path.endsWith('.ts') ? '' : '.ts')) });
      b.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: mocks[path], loader: 'js' }));
      b.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
        const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path });
        assert.deepEqual(errors, []);
        return { contents: compileScript(descriptor, { id: path, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } }).content, loader: 'ts', resolveDir: dirname(path) };
      });
    } }],
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(name => name === 'vue' ? { ...Vue, Transition: Vue.BaseTransition } : require(name), module, module.exports);
  cache.set(relative, module.exports.default);
  return module.exports.default;
}
class Node {
  constructor(tag, text = '') { Vue.markRaw(this); this.tag = tag; this.text = text; this.props = {}; this.children = []; this.parent = null; }
  get textContent() { return this.text + this.children.map(n => n.textContent).join(''); }
  all(predicate) { return this.children.flatMap(n => [...(predicate(n) ? [n] : []), ...n.all(predicate)]); }
}
const renderer = Vue.createRenderer({
  createElement: tag => new Node(tag), createText: text => new Node('#text', text), createComment: () => new Node('#comment'),
  setText(n, text) { n.text = text; signal(); }, setElementText(n, text) { n.text = text; n.children = []; signal(); },
  patchProp(n, key, _old, value) { n.props[key] = value; signal(); },
  insert(n, p, anchor) { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); p.children.splice(anchor ? p.children.indexOf(anchor) : p.children.length, 0, n); n.parent = p; signal(); },
  remove(n) { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; signal(); },
  parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
  querySelector: () => env.body, setScopeId() {}, insertStaticContent() { throw new Error('Unexpected static content'); },
});
// Subscribe before the action; resolve only on the exact rendered state, never a sleep/poll.
function rendered(predicate, action = () => {}) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error(`Expected render state was not reached: ${JSON.stringify(env.calls)}; ${env.root?.textContent}`)); }, 2000);
    const cleanup = () => { clearTimeout(timeout); events.off('render', check); };
    const check = () => { if (predicate()) { cleanup(); resolve(); } };
    events.on('render', check);
    Promise.resolve().then(action).then(check, error => { cleanup(); reject(error); });
  });
}
const fixture = (id, plan = 7, completed = false) => ({ id, plan, plan_name: `Plan ${plan}`, book: `Book ${id}`, url_link: 'https://youtu.be/abcdefghijk', start_date: '2026-09-06', end_date: '2026-09-12', is_completed: completed, completed_at: completed ? '2026-09-06T12:00:00Z' : null });
const plans = [{ plan_id: 7, plan_name: 'Plan 7', is_default: true }, { plan_id: 8, plan_name: 'Plan 8', is_default: false }];
const originals = new Map(['window', 'document', 'localStorage', 'fetch', '__introEnv'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
async function mount(path = '/intro', state = 'authenticated', options = {}) {
  const authState = Vue.ref(state);
  const user = Vue.ref(state === 'authenticated' ? { id: 1 } : null);
  env = { body: new Node('body'), calls: [], writes: [], notices: [], prompts: [], layout: passthrough,
    auth: { authState, user, isInitialized: Vue.ref(true), isAuthenticated: Vue.computed(() => authState.value === 'authenticated'), isLoading: Vue.computed(() => authState.value === 'loading'), initialize: async () => {}, refreshToken: async () => false },
    toast: { success: value => env.notices.push(value), error: value => { env.notices.push(value); signal(); } },
    modal: { confirm: async value => { env.prompts.push(value); return true; } },
    items: [fixture(41, 7, true), fixture(42)], plans: structuredClone(plans), ...options,
  };
  globalThis.__introEnv = env;
  globalThis.window = {};
  globalThis.document = { cookie: '', addEventListener() {}, removeEventListener() {} };
  const storage = new Map(options.storedPlan ? [['selectedPlanId', String(options.storedPlan)]] : []);
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  globalThis.fetch = async (input, init) => {
    const url = new URL(input); env.calls.push([init.method, url.pathname, url.searchParams.get('plan_id')]);
    let data;
    if (init.method === 'POST') {
      const body = JSON.parse(init.body); env.writes.push(body); signal();
      if (env.write) return env.write(body);
      const item = env.items.find(item => item.id === body.video_intro_id);
      item.is_completed = body.is_completed;
      data = { id: 901, video_intro_id: body.video_intro_id, is_completed: body.is_completed, completed_at: null };
    } else if (url.pathname === '/api/v1/todos/plan/') data = env.plans;
    else if (/\/intro\/\d+\/$/.test(url.pathname)) {
      data = env.items.find(item => item.id === Number(url.pathname.split('/').at(-2)));
      if (!data) return new Response('', { status: 404 });
      const { is_completed, completed_at, ...publicItem } = data; data = publicItem;
    } else {
      if (env.read) return env.read(url);
      data = env.items.filter(item => !url.searchParams.has('plan_id') || item.plan === Number(url.searchParams.get('plan_id')));
      if (!url.pathname.includes('/user/')) data = data.map(({ is_completed, completed_at, ...item }) => item);
    }
    return Response.json(data);
  };
  const parent = await load('pages/intro.vue');
  const detail = await load('pages/intro/[id].vue');
  const children = [{ path: ':id', component: detail }];
  try { await access(resolve(appDir, 'pages/intro/index.vue')); children.push({ path: '', component: await load('pages/intro/index.vue') }); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  env.router = Router.createRouter({ history: Router.createMemoryHistory(), routes: [{ path: '/intro', component: parent, children }, { path: '/login', component: passthrough }, { path: '/plans', component: passthrough }] });
  await env.router.push(path);
  const app = renderer.createApp(Router.RouterView);
  app.use(env.router); app.use(Pinia.createPinia()); app.component('NuxtPage', Router.RouterView); app.component('NuxtLink', Router.RouterLink);
  env.app = app; env.root = new Node('root');
  app.mount(env.root);
  env.find = id => [...env.root.all(n => n.props['data-testid'] === id), ...env.body.all(n => n.props['data-testid'] === id)][0];
  return env;
}
afterEach(() => { env?.app?.unmount(); events.removeAllListeners(); for (const [key, value] of originals) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]; } });
async function click(node) {
  assert.ok(node, 'click target exists');
  const event = { button: 0, stopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, stopImmediatePropagation() { this.stopped = true; } };
  for (const handler of [node.props.onClickCapture, node.props.onClick].flat()) {
    if (handler && !event.stopped) await handler(event);
  }
  await Vue.nextTick();
}
const ready = view => rendered(() => !!view.find('intro-row-41'));

test('list uses API completion counts, canonical links and inclusive calendar-week state', { timeout: 5000 }, async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 8, 12, 23, 59).getTime() });
  const view = await mount(); await ready(view);
  assert.equal(view.find('intro-count').props['data-completed'], 1);
  assert.equal(view.find('intro-count').props['data-total'], 2);
  assert.equal(view.find('intro-link-41').props.href, '/intro/41');
  assert.equal(view.find('intro-row-41').props['data-current'], true);
  assert.equal(view.find('intro-toggle-41').props['aria-pressed'], true);
});

test('completion posts exact boolean/id, suppresses duplicates and obeys the server acknowledgement', { timeout: 5000 }, async () => {
  let acknowledge;
  const view = await mount('/intro', 'authenticated', { write: () => new Promise(resolve => { acknowledge = resolve; }) }); await ready(view);
  await rendered(() => view.writes.length === 1, () => click(view.find('intro-toggle-42')));
  assert.deepEqual(view.writes, [{ video_intro_id: 42, is_completed: true }]);
  assert.equal(view.find('intro-toggle-42').props.disabled, true);
  await click(view.find('intro-toggle-42'));
  assert.equal(view.writes.length, 1);
  assert.equal(view.find('intro-count').props['data-completed'], 1);
  await rendered(() => !view.find('intro-toggle-42').props.disabled, () => acknowledge(Response.json({ id: 902, video_intro_id: 42, is_completed: false, completed_at: null })));
  assert.equal(view.find('intro-toggle-42').props['aria-pressed'], false);
  assert.equal(view.find('intro-count').props['data-completed'], 1);
});

test('rejected completion preserves count and reports failure', { timeout: 5000 }, async () => {
  const view = await mount('/intro', 'authenticated', { write: async () => Response.json({ detail: 'denied' }, { status: 403 }) }); await ready(view);
  await rendered(() => view.notices.length === 1 && !view.find('intro-toggle-41').props.disabled, () => click(view.find('intro-toggle-41')));
  assert.equal(view.find('intro-toggle-41').props['aria-pressed'], true);
  assert.equal(view.find('intro-count').props['data-completed'], 1);
});

test('plan sheet persists selection, replaces stale saved plan and queries its actual id', { timeout: 5000 }, async () => {
  const view = await mount('/intro', 'authenticated', { storedPlan: 999, items: [fixture(41), fixture(81, 8)] }); await ready(view);
  assert.equal(localStorage.getItem('selectedPlanId'), '7');
  await rendered(() => !!view.find('intro-plan-8'), () => click(view.find('intro-plan-trigger')));
  await rendered(() => !!view.find('intro-row-81'), () => click(view.find('intro-plan-8')));
  assert.equal(localStorage.getItem('selectedPlanId'), '8');
  assert.ok(view.calls.some(call => call[1] === '/api/v1/todos/user/video/intro/' && call[2] === '8'));
  assert.equal(view.find('intro-row-41'), undefined);
});

test('guest reads public data, keeps default notice and never writes completion', { timeout: 5000 }, async () => {
  const view = await mount('/intro', 'unauthenticated', { storedPlan: 7 }); await ready(view);
  assert.ok(view.find('intro-guest-notice'));
  assert.equal(view.find('intro-count').props['data-completed'], 0);
  assert.equal(view.calls.some(call => call[1].includes('/user/')), false);
  await click(view.find('intro-toggle-41'));
  assert.equal(view.router.currentRoute.value.path, '/login');
  assert.equal(view.router.currentRoute.value.query.redirect, '/intro');
  assert.deepEqual(view.writes, []);
});

for (const path of ['/intro/41', '/intro?id=41']) {
  test(`detail is real without redirect for ${path} and restores completion`, { timeout: 5000 }, async () => {
    const view = await mount(path);
    await rendered(() => !!view.find('intro-complete'));
    assert.equal(view.router.currentRoute.value.fullPath, path);
    assert.equal(view.find('intro-video').props.src, 'https://www.youtube.com/embed/abcdefghijk');
    assert.ok(view.find('intro-video').props.title);
    assert.equal(view.find('intro-external').props.href, 'https://youtu.be/abcdefghijk');
    assert.equal(view.find('intro-complete').props['aria-pressed'], true);
    assert.equal(view.find('intro-description'), undefined);
    assert.equal(view.find('intro-duration'), undefined);
    await rendered(() => view.find('intro-complete')?.props['aria-pressed'] === false, () => click(view.find('intro-complete')));
    assert.deepEqual(view.writes, [{ video_intro_id: 41, is_completed: false }]);
  });
}

test('unresolved/offline auth does not read guest or private data and resumes on resolution', { timeout: 5000 }, async () => {
  const view = await mount('/intro', 'loading'); await Vue.nextTick();
  assert.deepEqual(view.calls, []);
  assert.equal(view.find('intro-guest-notice'), undefined);
  await rendered(() => !!view.find('intro-error'), () => { view.auth.authState.value = 'unknown-offline'; });
  assert.deepEqual(view.calls, []);
  await rendered(() => !!view.find('intro-row-41'), () => { view.auth.authState.value = 'unauthenticated'; });
  assert.ok(view.find('intro-guest-notice'));
});

test('detail route change clears old completion and validates route identifiers before API access', { timeout: 5000 }, async () => {
  const view = await mount('/intro/41'); await rendered(() => !!view.find('intro-complete'));
  await rendered(() => view.find('intro-detail')?.props['data-intro-id'] === 42 && !!view.find('intro-complete'), () => view.router.push('/intro/42'));
  assert.equal(view.find('intro-complete').props['aria-pressed'], false);
  const calls = view.calls.length;
  await rendered(() => !!view.find('intro-error'), () => view.router.push('/intro/not-an-id'));
  assert.equal(view.calls.length, calls);
});

test('successful completion increments the real list count and survives detail navigation', { timeout: 5000 }, async () => {
  const view = await mount(); await ready(view);
  await rendered(() => view.find('intro-count')?.props['data-completed'] === 2, () => click(view.find('intro-toggle-42')));
  await rendered(() => !!view.find('intro-complete'), () => click(view.find('intro-link-42')));
  assert.equal(view.router.currentRoute.value.path, '/intro/42');
  assert.equal(view.find('intro-complete').props['aria-pressed'], true);
});

test('detail outside active subscriptions remains viewable without offering a forbidden write', { timeout: 5000 }, async () => {
  const view = await mount('/intro/41', 'authenticated', { read: async () => Response.json([]) });
  await rendered(() => !!view.find('intro-subscribe'));
  assert.ok(view.find('intro-video'));
  assert.equal(view.find('intro-complete'), undefined);
  assert.ok(view.calls.some(call => call[1].includes('/user/') && call[2] === '7'));
  await click(view.find('intro-subscribe'));
  assert.equal(view.router.currentRoute.value.path, '/plans');
  assert.deepEqual(view.writes, []);
});

test('guest detail redirects back to its exact legacy URL without a private read or write', { timeout: 5000 }, async () => {
  const view = await mount('/intro?id=41', 'unauthenticated');
  await rendered(() => !!view.find('intro-complete'));
  assert.equal(view.find('intro-complete').props['aria-pressed'], false);
  await rendered(() => view.router.currentRoute.value.path === '/login', () => click(view.find('intro-complete')));
  assert.equal(view.router.currentRoute.value.query.redirect, '/intro?id=41');
  assert.equal(view.calls.some(call => call[1].includes('/user/')), false);
  assert.deepEqual(view.writes, []);
});

test('logout during a pending write clears personal counts and ignores the old acknowledgement', { timeout: 5000 }, async () => {
  let acknowledge;
  const view = await mount('/intro', 'authenticated', { write: () => new Promise(resolve => { acknowledge = resolve; }) }); await ready(view);
  let saved;
  await rendered(() => view.writes.length === 1, () => { saved = click(view.find('intro-toggle-42')); });
  await rendered(() => !!view.find('intro-guest-notice') && !!view.find('intro-row-41'), () => { view.auth.user.value = null; view.auth.authState.value = 'unauthenticated'; });
  acknowledge(Response.json({ id: 901, video_intro_id: 42, is_completed: true, completed_at: null }));
  await saved;
  assert.equal(view.find('intro-count').props['data-completed'], 0);
  assert.equal(view.find('intro-toggle-42').props['aria-pressed'], false);
  assert.deepEqual(view.notices, []);
});

test('mismatched completion acknowledgement does not confirm another video', { timeout: 5000 }, async () => {
  const view = await mount('/intro', 'authenticated', { write: async () => Response.json({ id: 901, video_intro_id: 999, is_completed: true, completed_at: null }) }); await ready(view);
  await rendered(() => view.notices.length === 1 && !view.find('intro-toggle-42').props.disabled, () => click(view.find('intro-toggle-42')));
  assert.equal(view.find('intro-count').props['data-completed'], 1);
  assert.equal(view.find('intro-toggle-42').props['aria-pressed'], false);
});

test('empty subscriptions settle instead of hanging or fetching all public intros', { timeout: 5000 }, async () => {
  const view = await mount('/intro', 'authenticated', { plans: [], storedPlan: 999 });
  await rendered(() => !!view.find('intro-count'));
  assert.equal(view.find('intro-count').props['data-total'], 0);
  assert.equal(localStorage.getItem('selectedPlanId'), null);
  assert.equal(view.calls.length, 1);
});

test('failed progress read never displays a false uncompleted action and supports retry', { timeout: 5000 }, async () => {
  const view = await mount('/intro/41', 'authenticated', { read: async () => Response.json({ detail: 'failed' }, { status: 503 }) });
  await rendered(() => !!view.find('intro-error'));
  assert.equal(view.find('intro-complete'), undefined);
  view.read = undefined;
  const retry = view.find('intro-error').all(node => node.tag === 'button')[0];
  await rendered(() => !!view.find('intro-complete'), () => click(retry));
  assert.equal(view.find('intro-complete').props['aria-pressed'], true);
});

for (const [url, external, embed] of [
  ['javascript:alert(1)', undefined, undefined],
  ['https://example.org/video', 'https://example.org/video', undefined],
  ['https://www.youtube.com/watch?v=abcdefghijk&t=5', 'https://www.youtube.com/watch?v=abcdefghijk&t=5', 'https://www.youtube.com/embed/abcdefghijk'],
]) {
  test(`video URL boundary uses only safe external links and known embed hosts: ${url}`, { timeout: 5000 }, async () => {
    const view = await mount('/intro/41', 'unauthenticated', { items: [{ ...fixture(41), url_link: url }] });
    await rendered(() => !!view.find('intro-complete'));
    assert.equal(view.find('intro-external')?.props.href, external);
    assert.equal(view.find('intro-video')?.props.src, embed);
  });
}
