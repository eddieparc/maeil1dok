import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'node:test';
import { build } from 'esbuild';
import { compileScript, parse } from '@vue/compiler-sfc';

const require = createRequire(import.meta.url);
const Vue = require('vue');
const { createPinia, setActivePinia } = require('pinia');
const appDir = fileURLToPath(new URL('../app/', import.meta.url));
let boundary;
// Shipped setup/template, reading-position parser, Bible data, both Pinia stores,
// buttons, cards and skeletons run. Only HTTP/auth/router and the independently
// owned settings sheet are boundaries. No browser, CSS/layout or live API claims.
const bundle = await build({
  stdin: { contents: `export { default } from './components/bible/BibleHome.vue'; export { useSelectedPlanStore } from './stores/selectedPlan'; export { useSubscriptionStore } from './stores/subscription';`, resolveDir: appDir, loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
  external: ['vue', 'pinia', '@lucide/vue', 'vue-router', '#components'],
  define: { 'import.meta.client': 'true', 'import.meta.server': 'false' },
  plugins: [{ name: 'hub-runtime', setup(build) {
    build.onResolve({ filter: /(?:useApi|useAuthService|useErrorHandler|ReadingSettingsSheet\.vue)$/ }, ({ path }) => ({ path: path.split('/').at(-1), namespace: 'boundary' }));
    build.onLoad({ filter: /.*/, namespace: 'boundary' }, ({ path }) => ({ contents: path === 'ReadingSettingsSheet.vue'
      ? `import { defineComponent, h } from 'vue'; export default defineComponent({ props: ['modelValue'], emits: ['update:modelValue'], setup: (props, { emit }) => () => props.modelValue ? h('section', { 'data-settings-sheet': true }, [h('button', { 'data-action': 'close-settings', onClick: () => emit('update:modelValue', false) })]) : null });`
      : `export const ${path} = () => globalThis.__hubBoundary.${path}();`, loader: 'ts' }));
    build.onResolve({ filter: /^~\// }, ({ path }) => ({ path: resolve(appDir, path.slice(2) + (path.endsWith('.vue') ? '' : '.ts')) }));
    build.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
      const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path });
      assert.deepEqual(errors, []);
      return { contents: compileScript(descriptor, { id: path, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } }).content, loader: 'ts', resolveDir: dirname(path) };
    });
  } }],
});
const module = { exports: {} };
const NuxtLink = Vue.defineComponent({ props: ['to'], setup: (props, { slots }) => () => Vue.h('a', { href: props.to }, slots.default?.()) });
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(name => {
  if (name === 'vue-router') return { useRouter: () => boundary.router };
  if (name === '#components') return { NuxtLink };
  return require(name);
}, module, module.exports);
const { default: Hub, useSelectedPlanStore, useSubscriptionStore } = module.exports;

const observers = new Set();
let notifyQueued = false;
function changed() {
  if (notifyQueued) return;
  notifyQueued = true;
  queueMicrotask(() => { notifyQueued = false; for (const check of [...observers]) check(); });
}
class Element {
  constructor(tag, text = '') { Vue.markRaw(this); this.tag = tag; this.text = text; this.props = {}; this.children = []; this.parentNode = null; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  all(predicate) { return this.children.flatMap(child => [...(predicate(child) ? [child] : []), ...child.all(predicate)]); }
}
function remove(node) { if (node.parentNode) node.parentNode.children.splice(node.parentNode.children.indexOf(node), 1); node.parentNode = null; changed(); }
function insert(node, parent, anchor = null) { remove(node); parent.children.splice(anchor ? parent.children.indexOf(anchor) : parent.children.length, 0, node); node.parentNode = parent; changed(); }
const renderer = Vue.createRenderer({
  createElement: tag => new Element(tag), createText: text => new Element('#text', text), createComment: () => new Element('#comment'),
  setText: (node, text) => { node.text = text; changed(); }, setElementText: (node, text) => { node.text = text; node.children = []; changed(); },
  patchProp: (node, key, _old, value) => { node.props[key] = value; changed(); }, insert, remove,
  parentNode: node => node.parentNode, nextSibling: node => node.parentNode?.children[node.parentNode.children.indexOf(node) + 1] ?? null,
  setScopeId() {}, insertStaticContent() { throw new Error('Unexpected static HTML'); },
});
// Subscribe to host updates before the action. Timeout only bounds failure; no
// sleeps, polling, repeated flushes or guessed async settling intervals.
async function observe(predicate, action) {
  const signal = AbortSignal.timeout(2000);
  await new Promise((resolve, reject) => {
    const clean = () => { observers.delete(check); signal.removeEventListener('abort', abort); };
    const check = () => { if (predicate()) { clean(); resolve(); } };
    const abort = () => { clean(); reject(new Error('Expected rendered state was not observed')); };
    observers.add(check); signal.addEventListener('abort', abort, { once: true });
    action(); check();
  });
  await Vue.nextTick();
}
const pending = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const position = { book: 'psa', chapter: 23, scroll_position: 0.4, version: 'KNT' };
const subscription = { id: 40, plan_id: 7, plan_name: '테스트 통독', start_date: '2026-01-01', is_active: true, is_default: true };
const schedule = (id, start, end, is_completed = false, book_code = 'ezk') => ({ id, book: '에스겔', book_code, start_chapter: start, end_chapter: end, audio_link: null, guide_link: null, is_completed });
const emptyStats = { bookmarks: 0, notes: 0, highlights: 0, recent_records: [] };
let apps = [];
const originalGlobals = new Map(['window', 'localStorage', '__hubBoundary'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
function setup(options = {}) {
  const storage = new Map(Object.entries(options.storage ?? {}));
  if (options.position) storage.set('lastReadingPosition', JSON.stringify(options.position));
  globalThis.window = {};
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  const auth = { isAuthenticated: Vue.ref(options.authenticated ?? true), isInitialized: Vue.ref(true), isLoading: Vue.ref(false), isSessionUnknown: Vue.ref(options.offline ?? false), user: Vue.ref({ id: 1 }), initialize: async () => {} };
  const calls = [], errors = [], routes = [], events = [];
  const responses = {
    '/api/v1/todos/bible/reading-position/': () => ({ success: true, position: options.position ?? null }),
    '/api/v1/todos/bible/home-stats/': () => options.stats ?? emptyStats,
    '/api/v1/todos/plans/user/': () => ({ subscriptions: options.subscriptions ?? [], available_plans: [] }),
    '/api/v1/todos/schedules/today/': () => ({ success: true, schedules: options.schedules ?? [] }),
    ...options.responses,
  };
  boundary = {
    router: { push: route => { routes.push(route); return Promise.resolve(); } },
    useAuthService: () => auth,
    useErrorHandler: () => ({ handleSilentError: (...args) => errors.push(args) }),
    useApi: () => ({ GET: async (path, config) => { calls.push([path, config]); assert.ok(responses[path], `Unexpected HTTP request: ${path}`); return { data: await responses[path](config) }; } }),
  };
  globalThis.__hubBoundary = boundary;
  const pinia = createPinia(); setActivePinia(pinia);
  const selected = useSelectedPlanStore();
  if (options.selected !== undefined) selected.selectedPlanId = options.selected;
  const root = new Element('root');
  const app = renderer.createApp(Hub, { onContinueReading: () => events.push(['continue-reading']), onSelectBook: (...args) => events.push(['select-book', ...args]), onShowToc: () => events.push(['show-toc']) });
  app.use(pinia); app.component('NuxtLink', NuxtLink); app.config.globalProperties.$router = boundary.router;
  const all = cls => root.all(node => (node.props.class ?? '').split(' ').includes(cls));
  const find = action => root.all(node => node.props['data-action'] === action)[0];
  const view = { root, app, all, find, calls, errors, routes, events, auth, selected, storage, responses, subscriptions: useSubscriptionStore(), mount: () => { app.mount(root); apps.push(app); } };
  view.ready = () => root.children.length > 0 && all('skeleton-stats').length === 0 && all('home-content').length > 0;
  return view;
}
async function mounted(options) { const view = setup(options); await observe(view.ready, view.mount); return view; }
async function click(node) { assert.ok(node, 'Rendered action exists'); assert.ok(['button', 'a'].includes(node.tag)); const event = { preventDefault() {}, stopImmediatePropagation() {} }; node.props.onClickCapture?.(event); node.props.onClick?.(event); await Vue.nextTick(); }
afterEach(async () => {
  for (const app of apps.splice(0)) app.unmount();
  await Vue.nextTick(); observers.clear();
  for (const [key, descriptor] of originalGlobals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
});

test('first visit replaces activity/tips/records with welcome and preserves TOC event', { timeout: 5000 }, async () => {
  const view = await mounted({ authenticated: false });
  assert.equal(view.all('welcome-section').length, 1);
  assert.equal(view.all('features-section').length, 0);
  assert.equal(view.all('tips-section').length, 0);
  assert.equal(view.calls.length, 0);
  await click(view.find('welcome-toc'));
  assert.deepEqual(view.events, [['show-toc']]);
  assert.equal(view.root.all(node => node.props.href === '/plans').length, 1);
});

test('saved guest position uses real parser/version and emits unchanged continue event', { timeout: 5000 }, async () => {
  const view = await mounted({ authenticated: false, position });
  assert.equal(view.all('welcome-section').length, 0);
  assert.equal(view.all('continue-location')[0].textContent.trim(), '시편 23편');
  assert.equal(view.all('continue-meta')[0].textContent.trim(), '새한글');
  await click(view.find('continue'));
  await click(view.find('toc'));
  assert.deepEqual(view.events, [['continue-reading'], ['show-toc']]);
});

test('signed-in no-plan guidance is reachable without a today schedule', { timeout: 5000 }, async () => {
  const view = await mounted({ position });
  assert.equal(view.all('no-plan-hint').length, 1);
  assert.equal(view.all('today-card').length, 0);
  assert.ok(view.calls.some(([path]) => path === '/api/v1/todos/plans/user/'));
  assert.equal(view.calls.some(([path]) => path === '/api/v1/todos/schedules/today/'), false);
});

for (const activity of ['bookmarks', 'notes', 'highlights']) {
  test(`activity-only account with ${activity} retains activity and no-plan cards`, { timeout: 5000 }, async () => {
    const view = await mounted({ stats: { ...emptyStats, [activity]: 1 } });
    assert.equal(view.all('welcome-section').length, 0);
    assert.equal(view.all('continue-section').length, 0);
    assert.equal(view.all('today-card').length, 0);
    assert.equal(view.all('recent-section').length, 0);
    assert.equal(view.all('features-section').length, 1);
    assert.equal(view.all('no-plan-hint').length, 1);
    const activityLink = view.root.all(node => node.props.href === `/bible/${activity}`)[0];
    assert.ok(activityLink);
    assert.equal(Number(view.all('feature-count')[0].textContent), 1);
    assert.ok(view.root.all(node => node.props.href === '/plans').length);
  });
}

test('cold plan store resolves active default; progress and resume route use first unfinished schedule', { timeout: 5000 }, async () => {
  const view = await mounted({ subscriptions: [subscription], schedules: [schedule(81, 27, 27, true), schedule(82, 28, 29)] });
  assert.equal(view.all('today-card').length, 1);
  assert.equal(view.all('plan-name')[0].textContent, subscription.plan_name);
  const progress = view.root.all(node => node.props.role === 'progressbar')[0];
  assert.equal(progress.props['aria-valuenow'], 1);
  assert.equal(progress.props['aria-valuemax'], 2);
  assert.equal(view.find('tongdok').props['data-state'], 'resume');
  await click(view.find('tongdok'));
  assert.deepEqual(view.routes, [{ path: '/bible', query: { book: 'ezk', chapter: '28', tongdok: 'true', schedule: '82', plan: '7' } }]);
});

test('completed today state is derived and cannot restart completed work', { timeout: 5000 }, async () => {
  const view = await mounted({ subscriptions: [subscription], schedules: [schedule(81, 27, 29, true)] });
  assert.equal(view.find('tongdok').props['data-state'], 'completed');
  assert.equal(view.find('tongdok').props.disabled, true);
  assert.equal(view.root.all(node => node.props.role === 'progressbar')[0].props['aria-valuenow'], 1);
});

test('zero progress starts today, stale stored plan falls back to active subscription', { timeout: 5000 }, async () => {
  const view = await mounted({ storage: { selectedPlanId: '999' }, subscriptions: [subscription], schedules: [schedule(81, 27, 29)] });
  assert.equal(view.find('tongdok').props['data-state'], 'start');
  assert.deepEqual(view.calls.find(([path]) => path === '/api/v1/todos/schedules/today/')[1], { params: { plan_id: 7 } });
});

test('activity counts, conditional tips and recent records come from home stats', { timeout: 5000 }, async () => {
  const records = [{ book: 'psa', chapter: 119, read_date: null }, { book: 'jhn', chapter: 3, read_date: '2026-09-06' }];
  const view = await mounted({ stats: { ...emptyStats, bookmarks: 2, recent_records: records } });
  assert.equal(view.all('feature-count')[0].textContent, '2');
  assert.equal(view.root.all(node => node.props['data-tip'] === 'bookmarks').length, 0);
  assert.equal(view.root.all(node => node.props['data-tip']).length, 2);
  const rows = view.all('recent-record');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].tag, 'button');
  assert.equal(rows[0].children.some(node => node.tag === 'time'), false);
  await click(rows[0]);
  assert.deepEqual(view.events, [['select-book', 'psa', 119]]);
  assert.deepEqual(view.root.all(node => node.tag === 'a' && ['/bible/bookmarks', '/bible/notes', '/bible/highlights', '/bible/history'].includes(node.props.href)).map(node => node.props.href), ['/bible/bookmarks', '/bible/notes', '/bible/highlights', '/bible/history']);
});

test('tips can be dismissed with zero activity and stay dismissed after remount', { timeout: 5000 }, async () => {
  const view = await mounted({ authenticated: false, position });
  await click(view.find('dismiss-tips'));
  assert.equal(view.storage.get('bible_tips_dismissed'), 'true');
  assert.equal(view.all('tips-section').length, 0);
  const next = await mounted({ authenticated: false, position, storage: Object.fromEntries(view.storage) });
  assert.equal(next.all('tips-section').length, 0);
});

test('three activities suppress tips; header search and settings use real navigation/control contract', { timeout: 5000 }, async () => {
  const view = await mounted({ position, stats: { ...emptyStats, notes: 3 } });
  assert.equal(view.all('tips-section').length, 0);
  assert.equal(view.find('search').props.href, '/bible/search');
  await click(view.find('settings'));
  assert.equal(view.root.all(node => node.props['data-settings-sheet']).length, 1);
  await click(view.find('close-settings'));
  assert.equal(view.root.all(node => node.props['data-settings-sheet']).length, 0);
  assert.deepEqual(view.routes, []);
});

test('loading waits for subscription and stats; rejected stats show retry, not first visit', { timeout: 5000 }, async () => {
  const stats = pending();
  const view = setup({ responses: { '/api/v1/todos/bible/home-stats/': () => stats.promise } });
  await observe(() => view.all('skeleton-stats').length === 1, view.mount);
  assert.equal(view.all('welcome-section').length, 0);
  await observe(view.ready, () => stats.reject(new Error('offline')));
  assert.equal(view.all('welcome-section').length, 0);
  assert.equal(view.root.all(node => node.props.role === 'alert').length, 1);
  assert.equal(view.errors.length, 1);
  view.responses['/api/v1/todos/bible/home-stats/'] = () => emptyStats;
  await observe(() => view.all('welcome-section').length === 1, () => { void click(view.find('retry')); });
  assert.equal(view.root.all(node => node.props.role === 'alert').length, 0);
});

test('subscription failure is not no-plan; failed schedule is not an empty schedule', { timeout: 5000 }, async () => {
  const view = await mounted({ position, responses: { '/api/v1/todos/plans/user/': () => { throw new Error('offline'); } } });
  assert.equal(view.all('no-plan-hint').length, 0);
  assert.equal(view.root.all(node => node.props.role === 'alert').length, 1);
  view.responses['/api/v1/todos/plans/user/'] = () => ({ subscriptions: [subscription], available_plans: [] });
  view.responses['/api/v1/todos/schedules/today/'] = () => ({ success: false, schedules: [] });
  await observe(() => view.all('schedule-error').length === 1, () => { void click(view.find('retry')); });
  assert.equal(view.all('no-schedule').length, 0);
});

test('active plan with no schedule shows genuine empty schedule for a returning reader', { timeout: 5000 }, async () => {
  const view = await mounted({ position, subscriptions: [subscription] });
  assert.equal(view.all('no-schedule').length, 1);
  assert.equal(view.all('no-plan-hint').length, 0);
  assert.equal(view.all('today-card').length, 0);
});

test('unknown offline auth does not become a guest welcome', { timeout: 5000 }, async () => {
  const view = await mounted({ authenticated: false, offline: true });
  assert.equal(view.all('welcome-section').length, 0);
  assert.equal(view.root.all(node => node.props.role === 'alert').length, 1);
  assert.equal(view.all('tips-section').length, 0);
  let revalidations = 0;
  view.auth.revalidate = async () => { revalidations++; view.auth.isSessionUnknown.value = false; view.auth.isAuthenticated.value = true; return true; };
  await observe(() => view.all('welcome-section').length === 1, () => { void click(view.find('retry')); });
  assert.equal(revalidations, 1);
});

test('selected-plan changes refresh schedule; late old-plan response cannot overwrite current plan', { timeout: 5000 }, async () => {
  const later = pending();
  const other = { ...subscription, id: 41, plan_id: 8, plan_name: '다른 통독', is_default: false };
  const view = await mounted({ position, subscriptions: [subscription, other], schedules: [schedule(81, 27, 29)] });
  view.responses['/api/v1/todos/schedules/today/'] = config => config.params.plan_id === 8 ? later.promise : { success: true, schedules: [schedule(91, 30, 31)] };
  await observe(() => view.calls.some(([path, config]) => path === '/api/v1/todos/schedules/today/' && config.params.plan_id === 8), () => { view.selected.setSelectedPlanId(8); });
  await observe(() => view.all('schedule-location')[0]?.textContent.includes('30'), () => { view.selected.setSelectedPlanId(7); });
  later.resolve({ success: true, schedules: [schedule(99, 1, 2)] });
  await later.promise;
  await Vue.nextTick();
  await click(view.find('tongdok'));
  assert.equal(view.routes[0].query.schedule, '91');
  assert.equal(view.routes[0].query.plan, '7');
});

test('storage write failure is visible and does not block reading', { timeout: 5000 }, async () => {
  const view = await mounted({ authenticated: false, position });
  globalThis.localStorage.setItem = () => { throw new DOMException('Storage unavailable', 'SecurityError'); };
  await click(view.find('dismiss-tips'));
  assert.equal(view.all('tips-section').length, 0);
  assert.equal(view.root.all(node => node.props.role === 'alert').length, 1);
  assert.equal(view.errors.length, 1);
  await click(view.find('continue'));
  assert.deepEqual(view.events, [['continue-reading']]);
});

test('date-only records retain calendar days across DST and omit invalid dates', { timeout: 5000 }, async t => {
  // Time is the behavior here; freeze Date, never a timer or sleep.
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 2, 9, 0, 30).getTime() });
  const view = await mounted({ stats: { ...emptyStats, recent_records: [
    { book: 'gen', chapter: 1, read_date: '2026-03-09' },
    { book: 'gen', chapter: 2, read_date: '2026-03-08' },
    { book: 'gen', chapter: 3, read_date: '2026-03-07' },
    { book: 'gen', chapter: 4, read_date: '2026-02-31' },
  ] } });
  const dates = view.root.all(node => node.tag === 'time');
  assert.deepEqual(dates.map(node => node.props.datetime), ['2026-03-09', '2026-03-08', '2026-03-07']);
  assert.deepEqual(dates.map(node => node.textContent), ['오늘', '어제', '2일 전']);
});
