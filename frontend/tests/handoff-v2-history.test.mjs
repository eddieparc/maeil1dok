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
let api, routes, errors, auth;
async function load(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const result = await build({
    entryPoints: [resolve(appDir, relative)], bundle: true, write: false,
    platform: 'node', format: 'cjs', logLevel: 'silent',
    external: ['vue', 'vue-router', '@lucide/vue', '#components'],
    plugins: [{ name: 'history-runtime', setup(build) {
      build.onResolve({ filter: /^~\// }, ({ path }) => {
        if (['~/composables/useApi', '~/composables/useErrorHandler', '~/composables/useAuthService'].includes(path)) return { path, external: true };
        return { path: resolve(appDir, path.slice(2) + (path.endsWith('.vue') ? '' : '.ts')) };
      });
      build.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
        const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path });
        assert.deepEqual(errors, []);
        return { contents: compileScript(descriptor, { id: path, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } }).content, loader: 'ts', resolveDir: dirname(path) };
      });
    } }],
  });
  const module = { exports: {} };
  const localRequire = name => {
    if (name === '~/composables/useApi') return { useApi: () => api };
    if (name === '~/composables/useAuthService') return { useAuthService: () => auth };
    if (name === '~/composables/useErrorHandler') return { useErrorHandler: () => ({ handleSilentError: error => errors.push(error) }) };
    if (name === '#components') return { NuxtLink: { props: ['to'], setup: (props, { slots }) => () => Vue.h('a', { href: props.to }, slots.default?.()) } };
    if (name === 'vue-router') return { useRouter: () => ({ push: path => routes.push(path), back() {} }) };
    return require(name);
  };
  new Function('require', 'module', 'exports', 'definePageMeta', result.outputFiles[0].text)(localRequire, module, module.exports, () => {});
  cache.set(relative, module.exports.default);
  return module.exports.default;
}

// Real Vue setup, templates, shared segments, data and calendar; only transport,
// router and a non-browser host are substituted. No layout/pixel claim is made.
const observers = new Set();
function changed() { for (const observe of observers) queueMicrotask(observe); }
class Element {
  constructor(tag, text = '') { this.tag = tag; this.text = text; this.props = {}; this.children = []; this.parentNode = null; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  matches(selector) {
    if (selector.startsWith('.')) return (this.props.class ?? '').split(' ').includes(selector.slice(1));
    const attr = selector.match(/^\[([^=]+)="([^"]+)"\]$/);
    if (attr) return String(this.props[attr[1]]) === attr[2];
    return this.tag === selector;
  }
  all(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.all(selector)]); }
  find(selector) { return this.all(selector)[0]; }
}
function remove(node) { if (node.parentNode) node.parentNode.children.splice(node.parentNode.children.indexOf(node), 1); node.parentNode = null; changed(); }
const renderer = Vue.createRenderer({
  createElement: tag => new Element(tag), createText: text => new Element('#text', text), createComment: () => new Element('#comment'),
  setText(node, text) { node.text = text; changed(); },
  setElementText(node, text) { node.children = []; node.text = text; changed(); },
  patchProp(node, key, _old, value) { node.props[key] = value; changed(); },
  insert(node, parent, anchor = null) { remove(node); parent.children.splice(anchor ? parent.children.indexOf(anchor) : parent.children.length, 0, node); node.parentNode = parent; changed(); },
  remove, parentNode: node => node.parentNode,
  nextSibling: node => node.parentNode?.children[node.parentNode.children.indexOf(node) + 1] ?? null,
  setScopeId() {}, insertStaticContent() { throw new Error('Unexpected static HTML'); },
});
const apps = [];
async function mount(relative, props = {}) {
  const component = await load(relative);
  const calendar = await load('components/bible/ReadingCalendar.vue');
  const root = new Element('root');
  const state = Vue.reactive(props);
  const app = renderer.createApp({ setup: () => () => Vue.h(component, state) });
  app.component('ReadingCalendar', calendar);
  for (const name of ['BookIcon', 'StarIcon', 'CheckIcon']) app.component(name, { render: () => Vue.h('svg') });
  app.mount(root); apps.push(app);
  return { root, state };
}
function signal(predicate) {
  // Subscribe before resolving transport. Renderer mutations are the exact view
  // state signal; the test timeout bounds failures without sleeps or polling.
  return new Promise(resolve => {
    const observe = () => { if (predicate()) { observers.delete(observe); resolve(); } };
    observers.add(observe); observe();
  });
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const statsPath = '/api/v1/todos/bible/personal-records/stats/';
const datesPath = '/api/v1/todos/bible/personal-records/dates/';
const stats = { total_chapters_read: 72, books_read: 3, books_completed: 2, current_streak: 9, books_progress: { gen: { read: 50, total: 50 }, exo: { read: 1, total: 40 }, jhn: { read: 21, total: 21 } } };
async function page(t) {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 0, 15, 12).getTime() });
  const requests = [], pending = { [statsPath]: deferred(), [datesPath]: deferred() };
  routes = []; errors = [];
  auth = { authState: Vue.ref('authenticated'), user: Vue.ref({ id: 7 }), initialize: async () => {} };
  api = { GET(path, options) { requests.push([path, options]); return pending[path].promise; } };
  const view = await mount('pages/bible/history.vue');
  return { ...view, requests, pending, async settle(statsData = { success: true, stats }, datesData = { success: true, dates: ['2026-01-01', '2026-01-15'] }) {
    const rendered = signal(() => !view.root.find('[role="status"]') && !!view.root.find('.history-content'));
    pending[statsPath].resolve({ data: statsData }); pending[datesPath].resolve({ data: datesData });
    await rendered; await Vue.nextTick();
  } };
}
async function click(node) { assert.ok(node, 'control exists'); assert.ok(!node.props.disabled, 'control enabled'); node.props.onClick(); await Vue.nextTick(); }
afterEach(() => { for (const app of apps.splice(0)) app.unmount(); observers.clear(); });

for (const [year, month, count] of [[2026, 0, 31], [2024, 1, 29], [2025, 1, 28], [2026, 2, 31], [2026, 3, 30]]) {
  test(`calendar navigates real month boundaries ${year}-${month + 1}`, { timeout: 5000 }, async t => {
    t.mock.timers.enable({ apis: ['Date'], now: new Date(year, month, count, 12).getTime() });
    const { root } = await mount('components/bible/ReadingCalendar.vue', { readingDates: [] });
    assert.equal(root.all('.nav-btn')[1].props.disabled, true);
    assert.equal(root.all('.calendar-day').filter(node => !node.matches('.other-month')).length, count);
    await click(root.all('.nav-btn')[0]);
    const previous = new Date(year, month - 1, 1);
    assert.ok(root.find(`[data-date="${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}-01"]`));
    assert.equal(root.all('.nav-btn')[1].props.disabled, false);
    await click(root.all('.nav-btn')[1]);
    assert.equal(root.all('.nav-btn')[1].props.disabled, true);
    // Even direct handler activation cannot advance past the current month.
    root.all('.nav-btn')[1].props.onClick(); await Vue.nextTick();
    assert.equal(root.all('.calendar-day').filter(node => !node.matches('.other-month')).length, count);
  });
}

test('calendar maps response dates, overlapping today/read, unread and future without UTC drift', { timeout: 5000 }, async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 0, 15, 0, 30).getTime() });
  const { root, state } = await mount('components/bible/ReadingCalendar.vue', { readingDates: ['2026-01-01', '2026-01-15', '2026-01-16'] });
  assert.ok(root.find('[data-date="2026-01-01"]').matches('.has-reading'));
  assert.ok(root.find('[data-date="2026-01-02"]').matches('.unread'));
  const today = root.find('[data-date="2026-01-15"]');
  assert.equal(today.props['aria-current'], 'date');
  assert.ok(today.matches('.today') && today.matches('.has-reading'));
  const future = root.find('[data-date="2026-01-16"]');
  assert.ok(future.matches('.future')); assert.equal(future.matches('.has-reading'), false);
  state.readingDates = []; await Vue.nextTick();
  assert.equal(today.matches('.has-reading'), false); assert.ok(today.matches('.today'));
  assert.equal(root.all('.legend-item').length, 3);
});

test('actual facade responses map to summaries, progress, checks, filters and book navigation', { timeout: 5000 }, async t => {
  const view = await page(t);
  assert.ok(view.root.find('[role="status"]'));
  assert.equal(view.root.find('.summary-cards'), undefined);
  await view.settle();
  assert.deepEqual(view.requests, [[statsPath, undefined], [datesPath, undefined]]);
  const values = view.root.all('.card-value').map(node => node.textContent.match(/\d+/g).map(Number));
  assert.deepEqual(values, [[72, 1189], [9], [2, 66]]);
  assert.equal(view.root.all('.book-card').length, 66);
  const gen = view.root.find('[data-book="gen"]');
  assert.equal(gen.tag, 'button'); assert.ok(gen.matches('.completed')); assert.ok(gen.find('.completion-check'));
  assert.equal(gen.find('progress').props.value, 50); assert.equal(gen.find('progress').props.max, 50);
  assert.equal(view.root.find('[data-book="exo"]').find('progress').props.value, 1);
  assert.equal(view.root.find('[data-book="lev"]').find('progress').props.value, 0);
  await click(view.root.all('[role="tab"]')[1]);
  assert.equal(view.root.all('.book-card').length, 39); assert.equal(view.root.find('[data-book="jhn"]'), undefined);
  await click(view.root.all('[role="tab"]')[2]);
  assert.equal(view.root.all('.book-card').length, 27); assert.equal(view.root.all('.completion-check').length, 1);
  await click(view.root.find('[data-book="jhn"]'));
  assert.deepEqual(routes, ['/bible?book=jhn&chapter=1']);
  assert.ok(view.root.find('[data-date="2026-01-01"]').matches('.has-reading'));
});

test('stats failure never fabricates zero statistics and dates remain usable; retry restores stats', { timeout: 5000 }, async t => {
  const view = await page(t);
  await view.settle({ success: false });
  assert.ok(view.root.find('[role="alert"]'));
  assert.equal(view.root.find('.summary-cards'), undefined); assert.equal(view.root.find('.books-grid'), undefined);
  assert.ok(view.root.find('[data-date="2026-01-01"]').matches('.has-reading'));
  assert.equal(errors.length, 1);
  const pending = deferred(); api.GET = path => { assert.equal(path, statsPath); return pending.promise; };
  const restored = signal(() => !!view.root.find('.summary-cards'));
  await click(view.root.find('[data-retry="stats"]'));
  pending.resolve({ data: { success: true, stats } }); await restored;
  assert.equal(view.root.find('[role="alert"]'), undefined);
});

test('date transport failure does not paint unread dates or hide successful stats', { timeout: 5000 }, async t => {
  const view = await page(t);
  const rendered = signal(() => !view.root.find('[role="status"]') && !!view.root.find('.history-content'));
  view.pending[statsPath].resolve({ data: { success: true, stats } });
  view.pending[datesPath].reject(new Error('dates offline'));
  await rendered;
  assert.ok(view.root.find('[role="alert"]')); assert.ok(view.root.find('.summary-cards'));
  assert.equal(view.root.find('.reading-calendar'), undefined); assert.equal(errors.length, 1);
  const pending = deferred(); api.GET = path => { assert.equal(path, datesPath); return pending.promise; };
  const restored = signal(() => !!view.root.find('.reading-calendar'));
  await click(view.root.find('[data-retry="dates"]'));
  assert.ok(view.root.find('.summary-cards'));
  pending.resolve({ data: { success: true, dates: ['2026-01-14'] } }); await restored;
  assert.equal(view.root.find('[role="alert"]'), undefined);
  assert.ok(view.root.find('[data-date="2026-01-14"]').matches('.has-reading'));
});

test('successful empty history is a real zero state, not an error', { timeout: 5000 }, async t => {
  const view = await page(t);
  await view.settle({ success: true, stats: { total_chapters_read: 0, books_read: 0, books_completed: 0, current_streak: 0, books_progress: {} } }, { success: true, dates: [] });
  assert.equal(view.root.find('[role="alert"]'), undefined);
  assert.equal(view.root.all('.book-card').length, 66);
  assert.equal(view.root.all('.completed').length, 0);
  assert.equal(view.root.all('.has-reading').length, 0);
  assert.ok(view.root.all('.unread').length > 0);
});
