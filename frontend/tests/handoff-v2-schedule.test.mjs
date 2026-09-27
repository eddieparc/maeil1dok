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
const appDir = fileURLToPath(new URL('../app/', import.meta.url));
const cache = new Map();
let auth, store, requests, transport, notices, prompts, confirmations, routes, scrolls, subscriptionLoader;
const boundaries = ['useApi', 'useAuthService', 'useSelectedPlanStore', 'usePlanApi', 'useToast', 'useErrorHandler', 'useAuthGuard', 'useModal', 'useScrollToElement'];
async function load(relative, realTransport = false) {
  const key = `${relative}:${realTransport}`;
  if (cache.has(key)) return cache.get(key);
  const result = await build({
    entryPoints: [resolve(appDir, relative)], bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
    external: ['vue', 'vue-router', '@lucide/vue', '#components', '#app'],
    plugins: [{ name: 'schedule-runtime', setup(builder) {
      builder.onResolve({ filter: /^~\// }, ({ path }) => {
        if ((boundaries.includes(path.split('/').at(-1)) && !(realTransport && ['useApi', 'usePlanApi'].includes(path.split('/').at(-1)))) || path.endsWith('/stores/selectedPlan') || path.endsWith('/BottomSheet.vue') || path.endsWith('/PageLayout.vue')) return { path, external: true };
        return { path: resolve(appDir, path.slice(2) + (path.endsWith('.vue') ? '' : '.ts')) };
      });
      builder.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
        const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path });
        assert.deepEqual(errors, []);
        return { contents: compileScript(descriptor, { id: path, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } }).content, loader: 'ts', resolveDir: dirname(path) };
      });
    } }],
  });
  const module = { exports: {} };
  function localRequire(name) {
    if (name === '#app') return { useRuntimeConfig: () => ({ public: { apiBase: 'https://schedule.test' } }) };
    if (name.endsWith('/useApi')) return { useApi: () => ({ GET: (path, options) => request('GET', path, options), POST: (path, body) => request('POST', path, body) }) };
    if (name.endsWith('/useAuthService')) return { useAuthService: () => auth };
    if (name.endsWith('/selectedPlan')) return { useSelectedPlanStore: () => store };
    if (name.endsWith('/usePlanApi')) return { usePlanApi: () => ({ fetchSubscriptions: () => subscriptionLoader() }) };
    if (name.endsWith('/useToast')) return { useToast: () => Object.fromEntries(['success', 'error', 'warning', 'info'].map(kind => [kind, message => notices.push([kind, message])])) };
    if (name.endsWith('/useErrorHandler')) return { useErrorHandler: () => ({ handleApiError: error => { notices.push(['api-error', error.message]); changed(); } }) };
    if (name.endsWith('/useAuthGuard')) return { useAuthGuard: () => ({ requireAuthWithPrompt: async () => { prompts.push(auth.isAuthenticated.value); return auth.isAuthenticated.value; } }) };
    if (name.endsWith('/useModal')) return { useModal: () => ({ confirm: options => { const pending = deferred(); confirmations.push({ options, ...pending }); changed(); return pending.promise; } }) };
    if (name.endsWith('/useScrollToElement')) return { useScrollToElement: () => ({ setScrollContainer() {}, scrollToElement: element => { scrolls.push(element?.props['data-date']); changed(); } }) };
    if (name.endsWith('/PageLayout.vue')) return { __esModule: true, default: { setup: (_, { slots }) => () => Vue.h('main', [Vue.h('header', slots['header-action']?.()), slots.default?.()]) } };
    if (name.endsWith('/BottomSheet.vue')) return { __esModule: true, default: { props: ['modelValue'], setup: (props, { slots }) => () => props.modelValue ? Vue.h('dialog', { open: true }, [slots.default?.(), slots.footer?.()]) : null } };
    if (name === '#components') return { NuxtLink: { props: ['to'], setup: (props, { slots }) => () => Vue.h('a', { href: props.to }, slots.default?.()) } };
    if (name === 'vue-router') return { useRouter: () => ({ push: value => { routes.push(value); changed(); } }), useRoute: () => ({ query: {}, fullPath: '/plan?fixture=1', path: '/plan' }) };
    return require(name);
  }
  new Function('require', 'module', 'exports', 'definePageMeta', result.outputFiles[0].text)(localRequire, module, module.exports, () => {});
  cache.set(key, module.exports.default ?? module.exports);
  return cache.get(key);
}
const observers = new Set();
function changed() { for (const callback of observers) queueMicrotask(callback); }
function signal(predicate) { return new Promise(resolve => { const check = () => { if (predicate()) { observers.delete(check); resolve(); } }; observers.add(check); check(); }); }
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
class Element {
  constructor(tag, text = '') { this.tag = tag; this.text = text; this.props = {}; this.children = []; this.parentNode = null; this.offsetWidth = 44; this.offsetLeft = 0; this.style = {}; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  matches(selector) { if (selector.startsWith('.')) return (this.props.class ?? '').split(' ').includes(selector.slice(1)); const attr = selector.match(/^\[([^=]+)="([^"]+)"\]$/); return attr ? String(this.props[attr[1]]) === attr[2] : this.tag === selector; }
  all(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.all(selector)]); }
  find(selector) { return this.all(selector)[0]; }
  querySelector(selector) { return this.find(selector); }
  addEventListener() {} removeEventListener() {} scrollTo(value) { this.lastScroll = value; changed(); }
}
function remove(node) { if (node.parentNode) node.parentNode.children.splice(node.parentNode.children.indexOf(node), 1); node.parentNode = null; changed(); }
const renderer = Vue.createRenderer({
  createElement: tag => new Element(tag), createText: text => new Element('#text', text), createComment: () => new Element('#comment'),
  setText(node, text) { node.text = text; changed(); }, setElementText(node, text) { node.children = []; node.text = text; changed(); },
  patchProp(node, key, _old, value) { node.props[key] = value; changed(); },
  insert(node, parent, anchor = null) { remove(node); parent.children.splice(anchor ? parent.children.indexOf(anchor) : parent.children.length, 0, node); node.parentNode = parent; changed(); },
  remove, parentNode: node => node.parentNode, nextSibling: node => node.parentNode?.children[node.parentNode.children.indexOf(node) + 1] ?? null,
  setScopeId() {}, insertStaticContent() { throw new Error('Unexpected static HTML'); },
});
const apps = [];
async function mount(relative, props = {}, realTransport = false) { const component = await load(relative, realTransport); const root = new Element('root'); const state = Vue.reactive(props); const app = renderer.createApp({ setup: () => () => Vue.h(component, state) }); app.mount(root); apps.push(app); return { root, state }; }
const monthPath = '/api/v1/todos/schedules/month/';
const nextPath = '/api/v1/todos/next-position/';
const updatePath = '/api/v1/todos/reading/update/';
const statsPath = '/api/v1/todos/stats/progress/';
function request(method, path, options) { const pending = deferred(); const entry = { method, path, options, ...pending }; requests.push(entry); changed(); if (transport) transport(entry); return pending.promise; }
function fixture(t, authenticated = true) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 8, 7, 12).getTime() });
  auth = { isLoading: Vue.ref(false), isSessionUnknown: Vue.ref(false), revalidate: async () => {}, isAuthenticated: Vue.ref(authenticated), isInitialized: Vue.ref(true), user: Vue.ref(authenticated ? { id: 7 } : null), initialize: async () => {} };
  store = Vue.reactive({ selectedPlanId: 1, initializeFromStorage() {}, setSelectedPlanId(id) { this.selectedPlanId = id; } });
  requests = []; notices = []; prompts = []; confirmations = []; routes = []; scrolls = []; transport = null;
  subscriptionLoader = async () => [{ plan_id: 1, plan_name: 'Fixture A', is_default: true }, { plan_id: 2, plan_name: 'Fixture B' }];
  globalThis.window = { innerWidth: 390, addEventListener() {}, removeEventListener() {} };
  globalThis.document = { body: { style: {} }, addEventListener() {}, removeEventListener() {}, querySelector() { return null; } };
}
const row = (id, date = '2026-09-07', done = false) => ({ id, date, book: id === 2 ? '시편' : '창세기', start_chapter: id, end_chapter: id + 1, is_completed: done });
async function calendar(t, props = {}, authenticated = true) {
  fixture(t, authenticated);
  const requested = signal(() => requests.some(r => r.path === monthPath));
  const view = await mount('components/BibleScheduleContent.vue', { initialScrollTarget: 'today', ...props });
  await requested;
  return { ...view, async settle(data = [row(1)]) { const done = signal(() => !!view.root.find('.schedule-list') || !!view.root.find('.no-schedules')); requests.filter(r => r.path === monthPath).at(-1).resolve({ data }); await done; await Vue.nextTick(); } };
}
async function click(node) { assert.ok(node, 'control exists'); assert.ok(!node.props.disabled, 'control enabled'); const event = { stopPropagation() {}, preventDefault() {} }; await node.props.onClick(event); await Vue.nextTick(); }
// Do not await async handlers while transport/confirmation is deliberately pending.
function trigger(node) { assert.ok(node, 'control exists'); assert.ok(!node.props.disabled, 'control enabled'); node.props.onClick({ stopPropagation() {}, preventDefault() {} }); }
afterEach(() => { for (const app of apps.splice(0)) app.unmount(); observers.clear(); delete globalThis.window; delete globalThis.document; });

test('monthly API forwards the year, shares no false empty duplicate, and exposes strict errors', { timeout: 5000 }, async t => {
  fixture(t); const { useScheduleApi } = await load('composables/useScheduleApi.ts'); const api = useScheduleApi();
  const first = api.fetchMonthlySchedules(1, 9, 2026, { throwOnError: true });
  const second = api.fetchMonthlySchedules(1, 9, 2026, { throwOnError: true });
  assert.deepEqual(requests[0].options.params, { plan_id: 1, month: 9, year: 2026 });
  assert.equal(requests.length, 2);
  requests[0].resolve({ data: [row(1)] }); requests[1].resolve({ data: [row(1)] });
  assert.equal((await first).length, 1); assert.equal((await second).length, 1);
  const failed = api.fetchMonthlySchedules(1, 10, 2026, { throwOnError: true });
  const rejected = assert.rejects(failed, /offline/); requests.at(-1).reject(new Error('offline')); await rejected;
  const legacy = api.fetchMonthlySchedules(1, 9);
  assert.deepEqual(requests.at(-1).options.params, { plan_id: 1, month: 9 });
  requests.at(-1).reject(new Error('legacy offline')); assert.deepEqual(await legacy, []);
  assert.equal(api.isFetchingSchedules.value, false);
});

test('calendar requests only selected year/month and shows cached-month dots plus grouped day progress', { timeout: 5000 }, async t => {
  const view = await calendar(t); assert.deepEqual(requests[0].options.params, { plan_id: 1, month: 9, year: 2026 });
  await view.settle([row(1), row(2, '2026-09-07', true), row(3, '2026-09-08', true)]);
  assert.equal(view.root.all('.schedule-item').length, 2);
  assert.equal(view.root.find('progress').props.value, 1); assert.equal(view.root.find('progress').props.max, 2);
  assert.equal(view.root.all('.month-dot').length, 1); assert.equal(view.root.find('.month-dot').props['data-progress'], 'partial');
  assert.equal(requests.filter(r => r.path === monthPath).length, 1);
  const requested = signal(() => requests.filter(r => r.path === monthPath).length === 2);
  trigger(view.root.find('[data-month="10"]')); await requested; await view.settle([]);
  await click(view.root.find('[data-month="9"]'));
  assert.equal(requests.filter(r => r.path === monthPath).length, 2); assert.equal(view.root.all('.month-dot').length, 2);
});

test('year progress summary reads stats once and degrades to empty on failure', { timeout: 5000 }, async t => {
  fixture(t); const { useScheduleApi } = await load('composables/useScheduleApi.ts'); const api = useScheduleApi();
  const pending = api.fetchYearProgress(1, 2026, { throwOnError: true });
  assert.equal(requests[0].path, statsPath);
  assert.deepEqual(requests[0].options.params, { plan_id: 1, year: 2026 });
  requests[0].resolve({ data: { success: true, monthly_progress: [{ month: 9, done: 1, total: 2 }] } });
  assert.deepEqual(await pending, [{ month: 9, done: 1, total: 2 }]);
  const missing = api.fetchYearProgress(1, 2026);
  requests[1].resolve({ data: { success: true } });
  assert.deepEqual(await missing, []);
  const rejected = assert.rejects(api.fetchYearProgress(1, 2026, { throwOnError: true }), /offline/);
  requests[2].reject(new Error('offline')); await rejected;
  const silent = api.fetchYearProgress(1, 2026);
  requests[3].reject(new Error('offline'));
  assert.deepEqual(await silent, []);
  assert.equal(api.isFetchingSchedules.value, false);
});

test('one year summary fills month dots and opened months override it live', { timeout: 5000 }, async t => {
  const view = await calendar(t);
  await view.settle([row(1), row(2, '2026-09-07', true)]);
  const summaryRequested = signal(() => requests.some(r => r.path === statsPath));
  await summaryRequested;
  const summary = requests.find(r => r.path === statsPath);
  assert.deepEqual(summary.options.params, { plan_id: 1, year: 2026 });
  assert.equal(requests.filter(r => r.path === monthPath).length, 1, 'summary replaces the 12 monthly prefetch requests');
  const dots = signal(() => view.root.all('.month-dot').length >= 4);
  summary.resolve({ data: { success: true, monthly_progress: [
    { month: 8, done: 5, total: 10 },
    { month: 9, done: 0, total: 2 },
    { month: 10, done: 3, total: 3 },
    { month: 11, done: 0, total: 0 },
  ] } });
  await dots;
  assert.equal(view.root.find('[data-month="8"]').find('.month-dot').props['data-progress'], 'partial');
  assert.equal(view.root.find('[data-month="10"]').find('.month-dot').props['data-progress'], 'completed');
  // The opened month keeps its live cache (1/2 done) over the summary's 0/2.
  assert.equal(view.root.find('[data-month="9"]').find('.month-dot').props['data-progress'], 'partial');
  // A live completion on the cached month updates the dot without a refetch.
  const posted = signal(() => requests.some(r => r.method === 'POST'));
  trigger(view.root.find('[data-checkbox="1"]'));
  await posted;
  const updated = signal(() => view.root.find('[data-month="9"]').find('.month-dot').props['data-progress'] === 'completed');
  requests.at(-1).resolve({ success: true });
  await updated;
});

test('a failed year summary leaves dots absent without breaking the loaded month', { timeout: 5000 }, async t => {
  const view = await calendar(t);
  await view.settle([row(1)]);
  const summaryRequested = signal(() => requests.some(r => r.path === statsPath));
  await summaryRequested;
  requests.find(r => r.path === statsPath).reject(new Error('offline'));
  await Vue.nextTick(); await Vue.nextTick();
  assert.equal(view.root.find('[role="alert"]'), undefined);
  assert.ok(view.root.find('.schedule-list'));
  assert.equal(view.root.all('.month-dot').length, 1, 'only the opened month keeps its dot');
});

test('year navigation refetches the summary keyed to the new year', { timeout: 5000 }, async t => {
  const view = await calendar(t);
  await view.settle([row(1)]);
  const firstSummary = signal(() => requests.some(r => r.path === statsPath));
  await firstSummary;
  requests.find(r => r.path === statsPath).resolve({ data: { success: true, monthly_progress: [{ month: 1, done: 9, total: 9 }] } });
  await signal(() => view.root.all('.month-dot').length >= 2);
  const position = signal(() => requests.some(r => r.path === nextPath));
  trigger(view.root.find('[data-target="lastIncomplete"]')); await position;
  const requested = signal(() => requests.some(r => r.path === monthPath && r.options.params.year === 2027));
  requests.at(-1).resolve({ data: { success: true, status: 'next_incomplete', date: '2027-01-03', month: 1 } });
  await requested;
  await view.settle([row(4, '2027-01-03')]);
  // The 2026 summary must not paint 2027 dots; only the opened January is dotted.
  assert.equal(view.root.all('.month-dot').length, 1);
  const secondSummary = signal(() => requests.filter(r => r.path === statsPath).length === 2);
  await secondSummary;
  assert.deepEqual(requests.filter(r => r.path === statsPath).at(-1).options.params, { plan_id: 1, year: 2027 });
});

test('a late previous-plan summary cannot erase the current plan dots', { timeout: 5000 }, async t => {
  const view = await calendar(t);
  await view.settle([row(1)]);
  await signal(() => requests.some(r => r.path === statsPath));
  const oldSummary = requests.find(r => r.path === statsPath);
  await click(view.root.find('.plan-select-button'));
  const switched = signal(() => requests.some(r => r.path === monthPath && r.options.params.plan_id === 2));
  trigger(view.root.find('[data-plan="2"]'));
  await switched;
  await view.settle([row(2)]);
  await signal(() => requests.some(r => r.path === statsPath && r.options.params.plan_id === 2));
  const newSummary = requests.find(r => r.path === statsPath && r.options.params.plan_id === 2);
  const dotted = signal(() => !!view.root.find('[data-month="8"]').find('.month-dot'));
  newSummary.resolve({ data: { success: true, monthly_progress: [{ month: 8, done: 1, total: 1 }] } });
  await dotted;
  oldSummary.resolve({ data: { success: true, monthly_progress: [{ month: 8, done: 0, total: 2 }] } });
  await oldSummary.promise;
  await Vue.nextTick();
  await Vue.nextTick();
  assert.equal(view.root.find('[data-month="8"]').find('.month-dot')?.props['data-progress'], 'completed');
});

test('mixed group optimistic failure restores each snapshot and blocks duplicate writes', { timeout: 5000 }, async t => {
  const view = await calendar(t); await view.settle([row(1), row(2, '2026-09-07', true)]);
  const checkbox = view.root.find('[data-group-checkbox="2026-09-07"]');
  const posted = signal(() => requests.some(r => r.method === 'POST')); trigger(checkbox); trigger(checkbox); await posted; await Vue.nextTick();
  assert.equal(checkbox.props.disabled, true); assert.equal(checkbox.props['aria-checked'], true);
  const rolledBack = signal(() => checkbox.props.disabled === false && checkbox.props['aria-checked'] === 'mixed');
  requests.at(-1).resolve({ success: false }); await rolledBack;
  assert.equal(view.root.find('[data-checkbox="1"]').props['aria-checked'], false);
  assert.equal(view.root.find('[data-checkbox="2"]').props['aria-checked'], true);
  assert.equal(requests.filter(r => r.method === 'POST').length, 1);
});

test('bulk checkbox selection has three stages, reverse inclusive IDs, third-click reset, rollback and success notification', { timeout: 5000 }, async t => {
  const emitted = []; const view = await calendar(t, { isBulkEditMode: true, onRangeSelect: value => emitted.push(value) });
  await view.settle([row(1, '2026-09-05', true), row(2, '2026-09-06'), row(3)]);
  await click(view.root.find('[data-group-checkbox="2026-09-07"]'));
  assert.equal(view.root.find('.bulk-edit-indicator').props['data-stage'], 1);
  await click(view.root.find('[data-group-checkbox="2026-09-05"]'));
  assert.equal(view.root.find('.bulk-edit-indicator').props['data-stage'], 2);
  assert.equal(view.root.all('.selected-range').length, 3);
  await click(view.root.find('[data-group-checkbox="2026-09-06"]'));
  assert.equal(view.root.find('.bulk-edit-indicator').props['data-stage'], 1);
  await click(view.root.find('[data-group-checkbox="2026-09-05"]'));
  const posted = signal(() => requests.some(r => r.method === 'POST')); trigger(view.root.find('[data-action="complete"]')); await posted;
  assert.deepEqual(requests.at(-1).options, { plan_id: 1, schedule_ids: [1, 2], action: 'complete' });
  const rollback = signal(() => view.root.find('[data-group-checkbox="2026-09-06"]').props['aria-checked'] === false && !view.root.find('[data-action="complete"]').props.disabled);
  requests.at(-1).resolve({ success: false }); await rollback; assert.equal(emitted.length, 0);
  const saved = signal(() => emitted.length === 1); trigger(view.root.find('[data-action="cancel"]')); await signal(() => requests.filter(r => r.method === 'POST').length === 2);
  requests.at(-1).resolve({ success: true }); await saved; await Vue.nextTick(); assert.deepEqual(emitted[0].scheduleIds, [1, 2]);
  assert.equal(view.root.find('[data-group-checkbox="2026-09-05"]').props['aria-checked'], false);
});

test('guest starts with the public default instead of a prior signed-in selection', { timeout: 5000 }, async t => {
  fixture(t, false); store.selectedPlanId = 2;
  const requested = signal(() => requests.length === 1); const view = await mount('components/BibleScheduleContent.vue'); await requested;
  assert.equal(requests[0].options.params.plan_id, 1);
  const rendered = signal(() => !!view.root.find('.no-schedules')); requests[0].resolve({ data: [] }); await rendered;
});

test('guest checkbox opens the shared auth prompt without mutation or transport', { timeout: 5000 }, async t => {
  const view = await calendar(t, {}, false); await view.settle(); await click(view.root.find('[data-group-checkbox="2026-09-07"]'));
  assert.deepEqual(prompts, [false]); assert.equal(requests.filter(r => r.method === 'POST').length, 0);
  assert.equal(view.root.find('[data-group-checkbox="2026-09-07"]').props['aria-checked'], false);
});

test('next incomplete and today switch both year and month before scoped scrolling', { timeout: 5000 }, async t => {
  const view = await calendar(t); await view.settle();
  const position = signal(() => requests.some(r => r.path === nextPath)); trigger(view.root.find('[data-target="lastIncomplete"]')); await position;
  const requested = signal(() => requests.some(r => r.path === monthPath && r.options.params.year === 2027));
  requests.at(-1).resolve({ data: { success: true, status: 'next_incomplete', date: '2027-01-03', month: 1 } }); await requested;
  const scrolled = signal(() => scrolls.includes('2027-01-03')); await view.settle([row(4, '2027-01-03')]); await scrolled;
  const today = signal(() => scrolls.at(-1) === '2026-09-07'); trigger(view.root.find('[data-target="today"]')); await today;
  assert.equal(requests.filter(r => r.path === monthPath).length, 2);
});

test('auth readiness gates fetches and an identity change invalidates cached months and old responses', { timeout: 5000 }, async t => {
  fixture(t); auth.isInitialized.value = false;
  const view = await mount('components/BibleScheduleContent.vue', { initialScrollTarget: 'today' }); await Vue.nextTick(); assert.equal(requests.length, 0);
  const firstRequest = signal(() => requests.length === 1); auth.isInitialized.value = true; await firstRequest; const old = requests[0];
  const freshRequest = signal(() => requests.length === 2); auth.user.value = { id: 8 }; await freshRequest;
  const rendered = signal(() => !!view.root.find('[data-date="2026-09-08"]')); requests[1].resolve({ data: [row(8, '2026-09-08')] }); await rendered;
  old.resolve({ data: [row(1)] }); await old.promise; await Vue.nextTick(); await Vue.nextTick();
  assert.equal(view.root.find('[data-date="2026-09-07"]'), undefined); assert.equal(view.root.all('.month-dot').length, 1);
});

test('failed month is an error with retry, not an empty cached month', { timeout: 5000 }, async t => {
  const view = await calendar(t); const failed = signal(() => !!view.root.find('[role="alert"]')); requests[0].reject(new Error('offline')); await failed;
  assert.equal(view.root.find('.no-schedules'), undefined); assert.equal(view.root.all('.month-dot').length, 0);
  const retry = signal(() => requests.length === 2); trigger(view.root.find('[data-retry="schedules"]')); await retry; await view.settle([]);
  assert.ok(view.root.find('.no-schedules')); assert.equal(view.root.find('[role="alert"]'), undefined);
});

test('normal row confirms reader route while reader modal emits the existing schedule payload directly', { timeout: 5000 }, async t => {
  const view = await calendar(t); await view.settle();
  const confirmation = signal(() => confirmations.length === 1); trigger(view.root.find('[data-schedule="1"]')); await confirmation;
  assert.equal(routes.length, 0); const navigated = signal(() => routes.length === 1); confirmations[0].resolve(true); await navigated;
  assert.equal(routes[0].path, '/bible'); assert.equal(routes[0].query.plan, '1'); assert.equal(routes[0].query.schedule, '1'); assert.equal(routes[0].query.tongdok, 'true');
  const selected = []; view.state.isModal = true; view.state.onScheduleSelect = value => selected.push(value); await Vue.nextTick();
  await click(view.root.find('[data-schedule="1"]')); assert.equal(selected[0].id, 1); assert.equal(confirmations.length, 1);
});

test('ScheduleItem renders all four existing statuses with native controls', { timeout: 5000 }, async t => {
  fixture(t);
  for (const [date, completed, status] of [['2026-09-06', true, 'completed'], ['2026-09-07', false, 'current'], ['2026-09-06', false, 'not_completed'], ['2026-09-08', false, 'upcoming']]) {
    const view = await mount('components/schedule/ScheduleItem.vue', { date, schedules: [row(2, date, completed)] });
    assert.ok(view.root.find(`.status-badge--${status}`)); assert.equal(view.root.find('[data-group-checkbox="' + date + '"]').tag, 'button');
    assert.equal(view.root.find('[data-schedule="2"]').tag, 'button');
  }
});

test('active plan sheet switches once, isolates dots by plan, and discards a late previous month', { timeout: 5000 }, async t => {
  const view = await calendar(t); await view.settle([row(1, '2026-09-07', true)]);
  const october = signal(() => requests.length === 2); trigger(view.root.find('[data-month="10"]')); await october; const old = requests[1];
  await click(view.root.find('.plan-select-button')); assert.equal(view.root.all('.plan-item').length, 2);
  const switched = signal(() => requests.length === 3); trigger(view.root.find('[data-plan="2"]')); await switched;
  assert.deepEqual(requests[2].options.params, { plan_id: 2, month: 10, year: 2026 }); assert.equal(view.root.all('.month-dot').length, 0);
  const displayed = signal(() => !!view.root.find('[data-date="2026-10-02"]')); requests[2].resolve({ data: [row(22, '2026-10-02')] }); await displayed;
  old.resolve({ data: [row(11, '2026-10-01')] }); await old.promise; await Vue.nextTick();
  assert.equal(view.root.find('[data-date="2026-10-01"]'), undefined); assert.equal(view.root.all('.month-dot').length, 1);
  assert.equal(view.root.find('dialog'), undefined);
});

test('real plan page exits bulk only after one successful API write', { timeout: 5000 }, async t => {
  fixture(t); const requested = signal(() => requests.length === 1); const view = await mount('pages/plan/index.vue'); await requested;
  const rendered = signal(() => !!view.root.find('[data-date="2026-09-07"]')); requests[0].resolve({ data: [row(1), row(2, '2026-09-08')] }); await rendered;
  await click(view.root.find('header').find('button')); assert.equal(view.root.find('.bulk-edit-indicator').props['data-stage'], 0);
  await click(view.root.find('[data-group-checkbox="2026-09-07"]')); await click(view.root.find('[data-group-checkbox="2026-09-08"]'));
  const posted = signal(() => requests.some(r => r.path === updatePath)); trigger(view.root.find('[data-action="complete"]')); await posted;
  assert.ok(view.root.find('.bulk-edit-indicator')); const exited = signal(() => !view.root.find('.bulk-edit-indicator'));
  requests.at(-1).resolve({ success: true }); await exited;
  assert.equal(requests.filter(r => r.path === updatePath).length, 1); assert.equal(view.root.find('header').find('button').props['aria-pressed'], false);
});

test('unselected plan, unknown session retry, and loading remain distinct from settled empty months', { timeout: 5000 }, async t => {
  fixture(t); store.selectedPlanId = null;
  const view = await mount('components/BibleScheduleContent.vue');
  await signal(() => !!view.root.find('.no-plan-selected')); assert.equal(requests.length, 0); assert.equal(view.root.find('.no-schedules'), undefined);
  auth.isSessionUnknown.value = true; await Vue.nextTick(); assert.ok(view.root.find('[role="alert"]')); assert.equal(view.root.find('.default-plan-indicator'), undefined);
  let retries = 0; auth.revalidate = async () => { retries++; auth.isSessionUnknown.value = false; };
  await click(view.root.find('[data-retry="schedules"]')); await signal(() => !!view.root.find('.no-plan-selected')); assert.equal(retries, 1);
  const requested = signal(() => requests.length === 1); await click(view.root.find('.plan-select-button')); trigger(view.root.find('[data-plan="1"]')); await requested; await Vue.nextTick();
  assert.equal(view.root.all('[role="status"]').length, 1);
  const empty = signal(() => !!view.root.find('.no-schedules')); requests[0].resolve({ data: [] }); await empty;
  assert.equal(view.root.find('[role="status"]'), undefined);
});

test('reader current-location navigation resolves book codes and switches year before scrolling', { timeout: 5000 }, async t => {
  const view = await calendar(t, { isModal: true, currentBook: 'gen', currentChapter: 4 }); await view.settle();
  const lookup = signal(() => requests.length === 2); trigger(view.root.find('[data-target="currentLocation"]')); await lookup;
  assert.deepEqual(requests[1].options.params, { plan_id: 1, book: 'gen', chapter: 4 });
  const requested = signal(() => requests.length === 3); requests[1].resolve({ data: { plan_date: '2025-12-20', book: 'gen', chapter: 4 } }); await requested;
  assert.deepEqual(requests[2].options.params, { plan_id: 1, year: 2025, month: 12 });
  const scrolled = signal(() => scrolls.includes('2025-12-20')); requests[2].resolve({ data: [row(4, '2025-12-20')] }); await scrolled;
  assert.ok(view.root.find('.current-location'));
});

test('a pending next-position cannot override a newer month selection', { timeout: 5000 }, async t => {
  const view = await calendar(t); await view.settle();
  const lookup = signal(() => requests.length === 2); trigger(view.root.find('[data-target="lastIncomplete"]')); await lookup; const old = requests[1];
  const requested = signal(() => requests.length === 3); trigger(view.root.find('[data-month="10"]')); await requested; await view.settle([row(10, '2026-10-01')]);
  old.resolve({ data: { success: true, status: 'next_incomplete', date: '2025-01-01', month: 1 } }); await old.promise; await Vue.nextTick();
  assert.equal(requests.length, 3); assert.equal(view.root.find('[data-month="10"]').props['aria-pressed'], true);
});

test('scroll-to-top uses the owned scroll container after the 300px threshold', { timeout: 5000 }, async t => {
  const view = await calendar(t); await view.settle(); const body = view.root.find('.schedule-body');
  body.props.onScroll({ target: { scrollTop: 300 } }); await Vue.nextTick(); assert.equal(view.root.find('.scroll-top-button'), undefined);
  body.props.onScroll({ target: { scrollTop: 301 } }); await Vue.nextTick(); await click(view.root.find('.scroll-top-button'));
  assert.deepEqual(body.lastScroll, { top: 0, behavior: 'smooth' });
});

test('failed single checkbox write and late writes from a prior identity cannot contaminate new data', { timeout: 5000 }, async t => {
  const view = await calendar(t); await view.settle(); const posted = signal(() => requests.length === 2); trigger(view.root.find('[data-group-checkbox="2026-09-07"]')); await posted;
  const rollback = signal(() => view.root.find('[data-group-checkbox="2026-09-07"]').props['aria-checked'] === false && !view.root.find('[data-group-checkbox="2026-09-07"]').props.disabled);
  requests[1].reject(new Error('offline')); await rollback;
  const secondWrite = signal(() => requests.length === 3); trigger(view.root.find('[data-group-checkbox="2026-09-07"]')); await secondWrite; const old = requests[2];
  const reloaded = signal(() => requests.length === 4); auth.user.value = { id: 9 }; await reloaded;
  const rendered = signal(() => !!view.root.find('[data-group-checkbox="2026-09-07"]')); requests[3].resolve({ data: [row(1)] }); await rendered;
  old.resolve({ success: true }); await old.promise; await Vue.nextTick();
  assert.equal(view.root.find('[data-group-checkbox="2026-09-07"]').props['aria-checked'], false);
  assert.equal(notices.filter(([kind]) => kind === 'success').length, 0);
});

// These regressions compile the real calendar -> usePlanApi -> useApi chain.
// Only fetch supplies deferred HTTP responses; the error handler records rather
// than throws, matching production's handled-error behavior.
const subscriptionPath = '/api/v1/todos/plan/';
const subscriptions = [{ plan_id: 1, plan_name: 'Fixture A', is_default: true }];
function httpFixture(t) {
  fixture(t);
  t.mock.method(globalThis, 'fetch', (url, options) => request(options.method ?? 'GET', new URL(url).pathname, options));
}
const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

for (const failure of ['network', 'http', 'invalid-payload']) {
  test(`subscription ${failure} failure renders retry, not no-plan, and recovers through real HTTP services`, { timeout: 5000 }, async t => {
    httpFixture(t);
    const requested = signal(() => requests.length === 1);
    const view = await mount('components/BibleScheduleContent.vue', {}, true);
    await requested;
    assert.equal(requests[0].path, subscriptionPath);
    assert.equal(requests[0].options.credentials, 'include');
    const settled = signal(() => !!view.root.find('[role="alert"]') || !!view.root.find('.no-plan-selected'));
    if (failure === 'network') requests[0].reject(new TypeError('offline'));
    else requests[0].resolve(jsonResponse(failure === 'http' ? { detail: 'unavailable' } : {}, failure === 'http' ? 503 : 200));
    await settled;
    assert.ok(view.root.find('[role="alert"]'), 'a subscription failure must render an alert');
    assert.equal(view.root.find('.no-plan-selected'), undefined);
    assert.equal(view.root.find('.no-schedules'), undefined);
    assert.equal(requests.length, 1);
    assert.equal(store.selectedPlanId, 1, 'failure must not erase the remembered plan');
    assert.equal(view.root.find('[data-target="today"]').props.disabled, true, 'quick navigation must not bypass failed subscription initialization');
    const retried = signal(() => requests.length === 2);
    trigger(view.root.find('[data-retry="schedules"]'));
    await retried; await Vue.nextTick();
    assert.equal(view.root.all('[role="status"]').length, 1);
    assert.equal(requests[1].path, subscriptionPath);
    const monthRequested = signal(() => requests.length === 3);
    requests[1].resolve(jsonResponse(subscriptions));
    await monthRequested;
    assert.equal(requests[2].path, monthPath);
    const rendered = signal(() => !!view.root.find('[data-schedule="1"]'));
    requests[2].resolve(jsonResponse([row(1)]));
    await rendered;
    assert.equal(view.root.find('[role="alert"]'), undefined);
    assert.equal(view.root.find('.no-plan-selected'), undefined);
  });
}

test('subscription successful empty response renders no-plan, including after error retry', { timeout: 5000 }, async t => {
  httpFixture(t);
  const requested = signal(() => requests.length === 1);
  const view = await mount('components/BibleScheduleContent.vue', {}, true);
  await requested;
  const empty = signal(() => !!view.root.find('.no-plan-selected'));
  requests[0].resolve(jsonResponse([])); await empty;
  assert.equal(view.root.find('[role="alert"]'), undefined);
  assert.equal(view.root.find('.no-schedules'), undefined);
  assert.equal(store.selectedPlanId, null);
  assert.equal(requests.length, 1);
  const reload = signal(() => requests.length === 2);
  auth.user.value = { id: 8 }; await reload;
  const settled = signal(() => !!view.root.find('[role="alert"]') || !!view.root.find('.no-plan-selected'));
  requests[1].reject(new TypeError('offline')); await settled;
  assert.ok(view.root.find('[role="alert"]'));
  const retried = signal(() => requests.length === 3);
  trigger(view.root.find('[data-retry="schedules"]')); await retried;
  const recovered = signal(() => !!view.root.find('.no-plan-selected'));
  requests[2].resolve(jsonResponse([])); await recovered;
  assert.equal(view.root.find('[role="alert"]'), undefined);
  assert.equal(requests.length, 3, 'empty subscriptions must not fetch a month');
});

test('subscription strict API propagates original failures while legacy callers keep empty fallback and summary method', { timeout: 5000 }, async t => {
  httpFixture(t);
  const { usePlanApi } = await load('composables/usePlanApi.ts', true);
  const api = usePlanApi();
  const strict = api.fetchSubscriptions({ throwOnError: true });
  const error = new TypeError('offline');
  const rejected = assert.rejects(strict, candidate => candidate === error);
  requests[0].reject(error); await rejected;
  assert.equal(api.isFetchingSubscriptions.value, false);
  const legacy = api.fetchSubscriptions();
  requests[1].resolve(jsonResponse({ detail: 'unavailable' }, 503));
  assert.deepEqual(await legacy, []);
  const empty = api.fetchSubscriptions({ throwOnError: true });
  requests[2].resolve(jsonResponse([])); assert.deepEqual(await empty, []);
  const success = api.fetchSubscriptions();
  requests[3].resolve(jsonResponse(subscriptions)); assert.deepEqual(await success, subscriptions);
  const summary = api.fetchPlanSummary(81);
  assert.equal(requests[4].path, '/api/v1/todos/plan/81/summary/');
  const progress = { completed_days: 2, total_days: 3, percent: 66.67 };
  requests[4].resolve(jsonResponse(progress)); assert.deepEqual(await summary, progress);
  assert.equal(api.isFetchingSubscriptions.value, false);
});

test('subscription strict concurrent reads never fabricate empty results and preserve legacy duplicate behavior', { timeout: 5000 }, async t => {
  httpFixture(t);
  const { usePlanApi } = await load('composables/usePlanApi.ts', true);
  const api = usePlanApi();
  const first = api.fetchSubscriptions();
  assert.deepEqual(await api.fetchSubscriptions(), []);
  const second = api.fetchSubscriptions({ throwOnError: true });
  assert.equal(requests.length, 2, 'strict reads must reach transport even while another read is pending');
  requests[0].resolve(jsonResponse(subscriptions)); assert.deepEqual(await first, subscriptions);
  assert.equal(api.isFetchingSubscriptions.value, true);
  const rejected = assert.rejects(second, { status: 503 });
  requests[1].resolve(jsonResponse({ detail: 'unavailable' }, 503)); await rejected;
  assert.equal(api.isFetchingSubscriptions.value, false);
});

test('subscription identity change starts a fresh read and a stale rejection cannot block or replace recovery', { timeout: 5000 }, async t => {
  httpFixture(t);
  const requested = signal(() => requests.length === 1);
  const view = await mount('components/BibleScheduleContent.vue', {}, true);
  await requested;
  const fresh = signal(() => requests.length === 2);
  auth.user.value = { id: 8 };
  await Vue.nextTick();
  assert.equal(requests.length, 2, 'new identity must not wait on the previous subscription request');
  await fresh;
  const rendered = signal(() => !!view.root.find('.no-plan-selected'));
  requests[1].resolve(jsonResponse([])); await rendered;
  const handled = signal(() => notices.some(([kind]) => kind === 'api-error'));
  requests[0].reject(new TypeError('old identity offline')); await handled;
  await Vue.nextTick();
  assert.ok(view.root.find('.no-plan-selected'));
  assert.equal(view.root.find('[role="alert"]'), undefined);
  assert.equal(store.selectedPlanId, null);
});
