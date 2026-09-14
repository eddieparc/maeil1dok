import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { build } from 'esbuild';
import { compileScript, compileStyle, parse } from '@vue/compiler-sfc';
const require = createRequire(import.meta.url), Vue = require('vue');
const { createRouter, createMemoryHistory, RouterLink } = require('vue-router');
const appDir = fileURLToPath(new URL('../app/', import.meta.url));
async function runtime() {
  const result = await build({ stdin: { contents: `export { default as Page } from './pages/admin/plans/index.vue'; export { default as Workspace } from './components/admin/AdminPlansWorkspace.vue'; export { default as ModalHost } from './components/ui/modal/ModalHost.vue'; export { useAuthService } from './composables/useAuthService'; export { useModal } from './composables/useModal'; export { useToast } from './composables/useToast';`, resolveDir: appDir, loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent', define: { 'import.meta.client': 'true', 'import.meta.server': 'false' }, external: ['vue', 'vue-router', '@lucide/vue', '#components', '#imports', '#app', 'nuxt/app', '~/stores/*'], plugins: [{ name: 'admin-plans', setup(b) {
    b.onResolve({ filter: /^~\// }, ({ path }) => path.startsWith('~/stores/') ? { path, external: true } : { path: resolve(appDir, path.slice(2) + (path.endsWith('.vue') ? '' : '.ts')) });
    // Observe promises from the real facade without replacing transport, guards,
    // parsing or returned values. Late-response tests await these exact promises.
    b.onLoad({ filter: /\/useApi\.ts$/ }, async ({ path }) => ({ loader: 'ts', resolveDir: dirname(path), contents: (await readFile(path, 'utf8')).replace('export const useApi =', 'const realUseApi =') + `\nexport const useApi = () => { const api = realUseApi(); return new Proxy(api, { get(target, key) { const value = target[key]; if (!['GET', 'POST', 'PUT', 'DELETE'].includes(String(key))) return value; return (...args) => { const promise = value(...args); globalThis.adminApiPromises.push({ method: key, path: args[0], promise }); return promise; }; } }); };` }));
    b.onLoad({ filter: /\.vue$/ }, async ({ path }) => { const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path }); assert.deepEqual(errors, []); return { contents: compileScript(descriptor, { id: path, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } }).content + '\nexport const __esModule = true;', loader: 'ts', resolveDir: dirname(path) }; });
  } }] });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(name => {
    // Omit CSS animation only; retain the real host, Teleport, container,
    // focus trap, modal service and caller/form lifecycle.
    if (name === 'vue') return { ...Vue, Transition: Vue.BaseTransition, TransitionGroup: { props: ['name'], setup: (_, { slots }) => () => slots.default?.() } };
    if (name === '#components') return { NuxtLink: RouterLink };
    if (['#app', '#imports', 'nuxt/app'].includes(name)) return { useState: globalThis.useState, useRuntimeConfig: globalThis.useRuntimeConfig };
    return require(name);
  }, module, module.exports); return module.exports;
}
const observers = new Set();
function changed() { for (const fn of observers) queueMicrotask(fn); }
class Element {
  constructor(tag, text = '') { Vue.markRaw(this); this.tag = tag; this.tagName = tag.toUpperCase(); this.text = text; this.props = {}; this.children = []; this.parentNode = null; this.events = {}; this.value = ''; this.style = { overflow: '', paddingRight: '' }; this.offsetWidth = 100; }
  get isConnected() { return this.tag === 'body' || Boolean(this.parentNode?.isConnected); }
  get offsetParent() { return this.parentNode; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  focus() { globalThis.document.activeElement = this; }
  querySelectorAll() { return this.all(n => !n.props.disabled && ((['button', 'input', 'textarea', 'select'].includes(n.tag)) || (n.tag === 'a' && n.props.href) || (n.props.tabindex !== undefined && String(n.props.tabindex) !== '-1') || n.props.contenteditable === 'true')); }
  appendChild(node) { remove(node); this.children.push(node); node.parentNode = this; }
  removeChild(node) { remove(node); }
  get textContent() { return this.text + this.children.map(n => n.textContent).join(''); }
  getRootNode() { return globalThis.document; }
  addEventListener(name, fn) { (this.events[name] ??= []).push(fn); }
  removeEventListener(name, fn) { this.events[name] = (this.events[name] ?? []).filter(f => f !== fn); }
  all(predicate) { return this.children.flatMap(n => [...(predicate(n) ? [n] : []), ...n.all(predicate)]); }
  find(predicate) { return this.all(predicate)[0]; }
}
function remove(n) { if (n.parentNode) n.parentNode.children.splice(n.parentNode.children.indexOf(n), 1); n.parentNode = null; changed(); }
const renderer = Vue.createRenderer({ createElement: tag => new Element(tag), createText: text => new Element('#text', text), createComment: () => new Element('#comment'), setText(n, text) { n.text = text; changed(); }, setElementText(n, text) { n.text = text; n.children = []; changed(); }, patchProp(n, key, old, value) { n.props[key] = value; if (key === 'value') n.value = value; changed(); }, insert(n, parent, anchor = null) { remove(n); parent.children.splice(anchor ? parent.children.indexOf(anchor) : parent.children.length, 0, n); n.parentNode = parent; changed(); }, remove, parentNode: n => n.parentNode, nextSibling: n => n.parentNode?.children[n.parentNode.children.indexOf(n) + 1] ?? null, querySelector: selector => { assert.equal(selector, 'body'); return globalThis.document.body; }, setScopeId() {}, insertStaticContent() { throw Error('Unexpected static HTML'); } });
function signal(predicate) { return new Promise(resolve => { const observe = () => { if (observers.has(observe) && predicate()) { observers.delete(observe); resolve(); } }; observers.add(observe); observe(); }); }
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
const plansPath = '/api/v1/todos/bible-plans/', schedulesPath = '/api/v1/todos/schedules/', userPath = '/api/v1/auth/user/';
const staff = { id: 7, username: 'operator', nickname: 'Operator', email: 'op@example.test', is_staff: true };
const plan = (id, extra = {}) => ({ id, name: `Plan${id}`, description: `Description${id}`, is_active: true, is_default: id === 1, subscriber_count: id * 7, ...extra });
const row = (id, planId, extra = {}) => ({ id, plan: planId, plan_name: `Plan${planId}`, date: '2026-09-07', book: 'Genesis', start_chapter: 1, end_chapter: 3, audio_link: '', guide_link: '', ...extra });
const opts = { timeout: 6000 };
async function environment(t, { cached = staff } = {}) {
  const states = new Map(), storage = new Map(), requests = [], queue = [], restoreGlobals = [];
  const root = new Element('body'), documentEvents = new Map();
  if (cached) storage.set('auth', JSON.stringify({ user: cached }));
  const globals = { adminApiPromises: [], useState(key, init) { if (!states.has(key)) states.set(key, Vue.ref(init())); return states.get(key); }, useRuntimeConfig: () => ({ public: { apiBase: 'https://api.example.test', csrfCookieName: 'csrftoken' } }), localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) }, window: { addEventListener() {} }, Document: class Document {}, ShadowRoot: class ShadowRoot {} };
  globals.document = Object.assign(new globals.Document(), { cookie: '', hidden: false, body: root, activeElement: null, createElement: tag => new Element(tag),
    addEventListener(name, fn) { if (!documentEvents.has(name)) documentEvents.set(name, new Set()); documentEvents.get(name).add(fn); },
    removeEventListener(name, fn) { documentEvents.get(name)?.delete(fn); },
    dispatchEvent(event) { for (const fn of documentEvents.get(event.type) ?? []) { fn(event); if (event.stopped) break; } },
  });
  for (const [key, value] of Object.entries(globals)) { const previous = Object.getOwnPropertyDescriptor(globalThis, key); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); restoreGlobals.push(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]); }
  t.mock.method(globalThis, 'setInterval', () => 1); t.mock.method(globalThis, 'clearInterval', () => {});
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    const u = new URL(url), request = { path: u.pathname, query: u.search, method: init.method || 'GET', body: init.body instanceof FormData ? init.body : init.body ? JSON.parse(init.body) : undefined, headers: init.headers, credentials: init.credentials }; requests.push(request); changed();
    const expected = queue.shift(); assert.ok(expected, `Unexpected request ${request.method} ${request.path}${request.query}`); assert.equal(request.path + request.query, expected.path); assert.equal(request.method, expected.method);
    const outcome = await expected.result.promise; if (outcome instanceof Error) throw outcome;
    return new Response(outcome.status === 204 ? null : JSON.stringify(outcome.body), { status: outcome.status, headers: { 'Content-Type': 'application/json' } });
  });
  const rt = await runtime(), auth = rt.useAuthService(), modal = rt.useModal(), toast = rt.useToast();
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] }); await router.push('/admin/plans#schedules');
  const app = renderer.createApp({ setup: () => () => Vue.h('div', [Vue.h(rt.Page), Vue.h(rt.ModalHost)]) }); app.use(router);
  t.after(() => { app.unmount(); toast.dismissAll(); observers.clear(); for (const restore of restoreGlobals) restore(); });
  function expect(path, body, { method = 'GET', status = 200 } = {}) { const result = deferred(); queue.push({ path, method, result }); if (body !== undefined) result.resolve({ body, status }); return { respond: (body, status = 200) => result.resolve({ body, status }), fail: () => result.resolve(new TypeError('offline-fixture')) }; }
  const by = (key, value) => root.find(n => String(n.props[key]) === String(value));
  async function initialize(response, identity = staff, status = 200) { const done = auth.initialize(); response.respond(identity, status); await done; await Vue.nextTick(); }
  async function ready(ps = [plan(1), plan(2)], rows = [row(11, 1), row(22, 2)]) { const user = expect(userPath); expect(plansPath + '?page=1', { count: ps.length, next: null, previous: null, results: ps }); expect(schedulesPath, rows); const done = signal(() => by('data-schedules-state', 'ready') && by('data-plans-state', ps.length ? 'ready' : 'empty')); app.mount(root); await initialize(user); await done; }
  return { ...rt, auth, modal, toast, root, app, requests, expect, by, initialize, ready, queue, apiPromises: globals.adminApiPromises };
}
async function click(el) { assert.ok(el); assert.ok(!el.props.disabled); for (const fn of [el.props.onClick].flat().filter(Boolean)) fn({ preventDefault() {}, stopImmediatePropagation() {} }); await Vue.nextTick(); }
async function input(view, name, value) { const el = view.by('name', name); assert.ok(el, name); el.value = value; for (const fn of el.events.input ?? []) fn({ target: el }); el.props.onInput?.({ target: el }); await Vue.nextTick(); }
async function submit(view) { const form = view.root.find(n => n.tag === 'form'); assert.ok(form); form.props.onSubmit({ preventDefault() {} }); await Vue.nextTick(); }

function dialog(view) { return view.by('role', 'dialog'); }
function scrim(view) { return view.root.find(n => n.props.class === 'modal-overlay'); }
function cancelButton(view) { return dialog(view)?.find(n => n.tag === 'button' && n.props.type === 'button'); }
function escape() {
  globalThis.document.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault() {}, stopImmediatePropagation() { this.stopped = true; } });
}
async function dismiss(view, method) {
  if (method === 'Escape') { escape(); await Vue.nextTick(); }
  else await click(method === 'scrim' ? scrim(view) : cancelButton(view));
}

for (const [label, key, value, field] of [
  ['new plan', 'data-action', 'new-plan', 'name'], ['edit plan', 'data-edit-plan', 1, 'name'],
  ['new schedule', 'data-action', 'new-schedule', 'book'], ['edit schedule', 'data-edit-schedule', 11, 'book'],
  ['schedule Excel', 'data-action', 'upload', 'file'],
]) {
  for (const method of ['Escape', 'scrim', 'cancel']) test(`${label}: idle ${method} dismisses through the real modal host and releases its caller`, opts, async t => {
    const view = await environment(t); await view.ready(); const before = view.requests.length;
    const opener = view.by(key, value); opener.focus(); await click(opener);
    assert.ok(dialog(view)); assert.ok(dialog(view).contains(document.activeElement));
    if (field === 'file') chooseFile(view, new File(['fixture'], 'schedules.xlsx'));
    else await input(view, field, 'unsaved-fixture');
    const closed = signal(() => !dialog(view) && !view.by(key, value).props.disabled);
    await dismiss(view, method);
    assert.equal(Boolean(dialog(view)), false, `${label} must close on idle ${method}`);
    await closed;
    assert.equal(document.activeElement, opener); assert.equal(document.body.style.overflow, '');
    assert.equal(view.requests.length, before); assert.equal(view.by('data-action-error', ''), undefined);
    await click(view.by(key, value)); assert.ok(dialog(view));
    assert.notEqual(view.by('name', field).value, 'unsaved-fixture');
  });
}

const dismissalWrites = [
  { kind: 'plan', action: 'new-plan', path: plansPath, refresh: plansPath + '?page=1', saved: plan(3), refreshed: { count: 3, next: null, results: [plan(1), plan(2), plan(3)] }, result: ['data-select-plan', 3] },
  { kind: 'schedule', action: 'new-schedule', path: schedulesPath, refresh: schedulesPath, saved: row(12, 1), refreshed: [row(11, 1), row(12, 1), row(22, 2)], result: ['data-schedule-id', 12] },
  { kind: 'upload', action: 'upload', path: schedulesPath + 'upload-excel/', refresh: schedulesPath, saved: { detail: 'uploaded-fixture', errors: ['row-warning-fixture'] }, refreshed: [row(11, 1), row(12, 1), row(22, 2)], result: ['data-schedule-id', 12] },
];
async function fillWrite(view, kind) {
  if (kind === 'plan') await input(view, 'name', 'Plan3');
  else if (kind === 'schedule') { await input(view, 'date', '2026-09-07'); await input(view, 'book', 'Genesis'); }
  else { chooseFile(view, new File(['fixture'], 'schedules.xlsx')); await Vue.nextTick(); }
}
for (const scenario of dismissalWrites) {
  test(`${scenario.kind}: Escape/scrim cannot abandon a pending write or reconciliation; successful result is retained`, opts, async t => {
    const view = await environment(t); await view.ready(); await click(view.by('data-action', scenario.action)); await fillWrite(view, scenario.kind);
    const before = view.requests.length, write = view.expect(scenario.path, undefined, { method: 'POST' }), refresh = view.expect(scenario.refresh);
    const started = signal(() => view.requests.length === before + 1);
    const form = dialog(view).find(n => n.tag === 'form');
    form.props.onSubmit({ preventDefault() {} });
    // Same dispatch turn: locking must precede Vue's next render, not race it.
    escape(); scrim(view).props.onClick(); await Vue.nextTick(); await started;
    assert.ok(dialog(view)); assert.equal(cancelButton(view).props.disabled, true);
    await dismiss(view, 'Escape'); await dismiss(view, 'scrim'); await submit(view);
    assert.ok(dialog(view)); assert.equal(view.requests.length, before + 1);
    const reconciling = signal(() => view.requests.length === before + 2);
    write.respond(scenario.saved); await reconciling;
    await dismiss(view, 'Escape'); await dismiss(view, 'scrim');
    assert.ok(dialog(view)); assert.equal(cancelButton(view).props.disabled, true);
    const closed = signal(() => !dialog(view) && view.by(...scenario.result) && !view.by('data-action', scenario.action).props.disabled);
    refresh.respond(scenario.refreshed); await closed;
    assert.ok(view.by(...scenario.result)); assert.equal(view.requests.length, before + 2);
    assert.equal(view.toast.toasts.value.length, 1);
    if (scenario.kind === 'upload') assert.ok(view.by('data-action-error', '').textContent.includes('row-warning-fixture'));
  });
  for (const method of ['Escape', 'scrim', 'cancel']) test(`${scenario.kind}: write rejection preserves input and restores ${method} dismissal`, opts, async t => {
    const view = await environment(t); await view.ready(); await click(view.by('data-action', scenario.action)); await fillWrite(view, scenario.kind);
    const write = view.expect(scenario.path, undefined, { method: 'POST' }); await submit(view);
    const failed = signal(() => view.by('data-form-error', '') && cancelButton(view)?.props.disabled === false);
    write.respond({ detail: 'write-rejected-fixture' }, 400); await failed;
    assert.ok(view.by('data-form-error', '').textContent.includes('write-rejected-fixture'));
    if (scenario.kind !== 'upload') assert.equal(view.by('name', scenario.kind === 'plan' ? 'name' : 'book').value, scenario.kind === 'plan' ? 'Plan3' : 'Genesis');
    else assert.equal(view.by('name', 'file').files[0].name, 'schedules.xlsx');
    const before = view.requests.length, closed = signal(() => !dialog(view) && !view.by('data-action', scenario.action).props.disabled);
    await dismiss(view, method); assert.equal(Boolean(dialog(view)), false); await closed;
    assert.equal(view.requests.length, before); assert.equal(view.toast.toasts.value.length, 0);
  });
}

test('actual admin plans page gates all data requests until real auth verifies staff', opts, async t => {
  const view = await environment(t); const user = view.expect(userPath); view.app.mount(view.root);
  assert.equal(view.by('data-admin-state', 'loading')?.props['data-admin-state'], 'loading');
  assert.deepEqual(view.requests.map(r => r.path), [userPath]);
  view.expect(plansPath + '?page=1', { count: 1, next: null, results: [plan(1)] }); view.expect(schedulesPath, [row(11, 1)]);
  const ready = signal(() => view.by('data-schedules-state', 'ready')); await view.initialize(user); await ready;
  assert.ok(view.by('id', 'schedules')); assert.ok(view.by('data-plan-id', 1));
  assert.ok(view.requests.every(r => r.credentials === 'include'));
});

for (const [name, identity, status] of [['guest', {}, 401], ['nonstaff', { ...staff, is_staff: false }, 200]]) {
  test(`${name} cannot mount the real plans workspace or call its API`, opts, async t => {
    const view = await environment(t, { cached: null }); const user = view.expect(userPath); view.app.mount(view.root); await view.initialize(user, identity, status);
    assert.deepEqual(view.requests.map(r => r.path), [userPath]); assert.equal(view.by('id', 'schedules'), undefined); assert.equal(view.modal.stack.value.length, 0);
  });
}
test('offline cached staff never starts plans or schedule HTTP', opts, async t => {
  const view = await environment(t); const user = view.expect(userPath), refresh = view.expect('/api/v1/auth/token/refresh/', undefined, { method: 'POST' });
  view.app.mount(view.root); const done = view.auth.initialize(); user.fail(); refresh.fail(); await done; await Vue.nextTick();
  assert.ok(view.by('data-admin-state', 'offline')); assert.equal(view.by('id', 'schedules'), undefined); assert.equal(view.requests.some(r => r.path === plansPath), false);
});
test('real collection pagination, actual counts, year-month filters, no-results and statistics', opts, async t => {
  const view = await environment(t); const user = view.expect(userPath);
  view.expect(plansPath + '?page=1', { count: 2, next: 'https://api.example.test/api/v1/todos/bible-plans/?page=2', results: [plan(1)] });
  view.expect(schedulesPath, [row(11, 1, { audio_link: 'https://audio.example.test/a' }), row(12, 1, { date: '2027-09-07', book: 'John', start_chapter: 4, end_chapter: 5, guide_link: 'https://guide.example.test/a' }), row(22, 2)]);
  view.expect(plansPath + '?page=2', { count: 2, next: null, results: [plan(2)] });
  const ready = signal(() => view.by('data-plan-id', 2)); view.app.mount(view.root); await view.initialize(user); await ready;
  assert.equal(view.by('data-select-plan', 1).props['aria-pressed'], true);
  assert.equal(view.by('data-count-plan', 1).textContent.match(/\d+/)[0], '2'); assert.equal(view.by('data-count-plan', 2).textContent.match(/\d+/)[0], '1');
  assert.ok(view.by('href', 'https://audio.example.test/a')); assert.ok(view.by('data-month', '2027-09'));
  await click(view.by('data-tab', 'statistics'));
  for (const [key, expected] of Object.entries({ schedules: 2, days: 2, books: 2, chapters: 5, audio: 1, guide: 1 })) assert.equal(view.by('data-stat', key).textContent, String(expected));
  await click(view.by('data-month', '2027-09')); assert.equal(view.by('data-stat', 'chapters').textContent, '2');
  await input(view, 'schedule-search', '  john  '); assert.equal(view.by('data-stat', 'books').textContent, '1');
  await input(view, 'schedule-search', 'absent'); assert.ok(view.by('data-schedule-empty', 'filter')); assert.equal(view.by('data-stat', 'schedules'), undefined);
  await click(view.by('data-action', 'clear-filters')); await click(view.by('data-tab', 'list')); assert.ok(view.by('data-schedule-id', 11));
  const count = view.requests.length; await click(view.by('data-select-plan', 2)); assert.ok(view.by('data-schedule-id', 22)); assert.equal(view.by('data-schedule-id', 11), undefined); assert.equal(view.requests.length, count);
});
test('default and active changes use one staff action, serialize clicks and preserve selection on reordered refresh', opts, async t => {
  const view = await environment(t); await view.ready(); await click(view.by('data-select-plan', 2));
  const write = view.expect(plansPath + '2/set_default/', undefined, { method: 'POST' });
  const refreshed = view.expect(plansPath + '?page=1'); const settled = signal(() => view.by('data-toggle-plan', 2)?.props.disabled === false && view.requests.length === 5);
  const button = view.by('data-default-plan', 2); await click(button);
  for (const fn of [button.props.onClick].flat()) fn({}); assert.equal(view.requests.filter(r => r.method === 'POST').length, 1);
  write.respond({ detail: 'done' }); refreshed.respond({ count: 2, next: null, results: [plan(2, { is_default: true }), plan(1, { is_default: false })] }); await settled;
  assert.equal(view.by('data-select-plan', 2).props['aria-pressed'], true); assert.equal(view.by('data-default-plan', 2), undefined);
  assert.equal(view.requests[3].body, undefined); assert.equal(view.requests.some(r => r.method === 'PATCH'), false);
  view.expect(plansPath + '2/toggle_active/', { detail: 'done' }, { method: 'POST' }); view.expect(plansPath + '?page=1', { count: 2, next: null, results: [plan(2, { is_default: true, is_active: false }), plan(1, { is_default: false })] });
  const active = signal(() => view.by('data-toggle-plan', 2)?.props.disabled === false && view.requests.length === 7); await click(view.by('data-toggle-plan', 2)); await active;
  assert.equal(view.by('data-select-plan', 2).props['aria-pressed'], true); assert.ok(view.by('data-schedule-id', 22));
});
test('plan create/edit validates trims payload, uses returned id and surfaces field errors without closing', opts, async t => {
  const view = await environment(t); await view.ready(); await click(view.by('data-action', 'new-plan'));
  const before = view.requests.length; await input(view, 'name', '   '); await submit(view); assert.ok(view.by('data-form-error', '')); assert.equal(view.requests.length, before);
  await input(view, 'name', ' New plan '); await input(view, 'description', ' Description ');
  view.expect(plansPath, plan(3, { name: 'New plan' }), { method: 'POST', status: 201 }); view.expect(plansPath + '?page=1', { count: 3, next: null, results: [plan(1), plan(2), plan(3, { name: 'New plan' })] });
  const closed = signal(() => view.modal.stack.value.length === 0 && view.by('data-select-plan', 3)); await submit(view); await closed;
  assert.deepEqual(view.requests[before].body, { name: 'New plan', description: 'Description' }); assert.equal(view.by('data-select-plan', 3).props['aria-pressed'], true);
  await click(view.by('data-edit-plan', 3)); assert.equal(view.by('name', 'name').value, 'New plan'); await input(view, 'name', 'Renamed');
  view.expect(plansPath + '3/', { name: ['duplicate-fixture'] }, { method: 'PUT', status: 400 }); const error = signal(() => view.by('data-form-error', '')?.textContent.includes('duplicate-fixture')); await submit(view); await error;
  assert.equal(view.by('name', 'name').value, 'Renamed'); assert.equal(view.modal.stack.value.length, 1);
  view.expect(plansPath + '3/', plan(3, { name: 'Renamed' }), { method: 'PUT' }); view.expect(plansPath + '?page=1', { count: 3, next: null, results: [plan(1), plan(2), plan(3, { name: 'Renamed' })] });
  const done = signal(() => view.modal.stack.value.length === 0 && view.by('data-edit-plan', 3)?.props.disabled === false); await submit(view); await done;
  assert.equal(view.requests.at(-2).method, 'PUT'); assert.equal(view.by('data-select-plan', 3).props['aria-pressed'], true);
});
test('schedule form validates dates, books, integer range and safe URLs; captured plan survives selection changes', opts, async t => {
  const view = await environment(t); await view.ready(); await click(view.by('data-action', 'new-schedule')); const before = view.requests.length;
  for (const values of [{ date: '2026-02-30', book: 'Genesis' }, { date: '2026-09-08', book: ' ' }, { book: 'Genesis', start_chapter: '0' }, { start_chapter: '3', end_chapter: '2' }, { start_chapter: '1.5', end_chapter: '3' }, { start_chapter: '1', audio_link: 'javascript:alert(1)' }]) {
    for (const [key, value] of Object.entries(values)) await input(view, key, value); await submit(view); assert.ok(view.by('data-form-error', '')); assert.equal(view.requests.length, before);
  }
  await input(view, 'audio_link', ' https://audio.example.test/new '); await input(view, 'guide_link', ''); await input(view, 'book', ' Genesis ');
  // Change the underlying selection as an in-flight race, not via modal overlay.
  await click(view.by('data-select-plan', 2));
  const pending = view.expect(schedulesPath, undefined, { method: 'POST' }); view.expect(schedulesPath, [row(11, 1), row(12, 1), row(22, 2)]);
  const done = signal(() => view.modal.stack.value.length === 0 && view.by('data-action', 'new-schedule')?.props.disabled === false); await submit(view); await submit(view);
  assert.equal(view.requests.filter(r => r.method === 'POST').length, 1); assert.deepEqual(view.requests.at(-1).body, { plan: 1, date: '2026-09-08', book: 'Genesis', start_chapter: 1, end_chapter: 3, audio_link: 'https://audio.example.test/new', guide_link: '' });
  pending.respond(row(12, 1), 201); await done; assert.equal(view.by('data-select-plan', 2).props['aria-pressed'], true); assert.ok(view.by('data-schedule-id', 22)); assert.equal(view.by('data-schedule-id', 12), undefined);
  await click(view.by('data-edit-schedule', 22)); assert.equal(view.by('name', 'date').value, '2026-09-07'); await input(view, 'book', 'John');
  view.expect(schedulesPath + '22/', row(22, 2, { book: 'John' }), { method: 'PUT' }); view.expect(schedulesPath, [row(11, 1), row(12, 1), row(22, 2, { book: 'John' })]);
  const edited = signal(() => view.modal.stack.value.length === 0 && view.by('data-schedule-id', 22)?.textContent.includes('John')); await submit(view); await edited; assert.equal(view.requests.at(-2).body.plan, 2);
  await click(view.by('data-action', 'new-schedule')); assert.equal(view.by('name', 'date').value, ''); assert.equal(view.by('name', 'book').value, '');
});
async function confirm(view, accepted) {
  const className = accepted ? 'confirm-btn-danger' : 'confirm-btn-cancel';
  const mounted = signal(() => view.root.find(n => n.props.class?.includes(className))); await mounted;
  await click(view.root.find(n => n.props.class?.includes(className)));
}
test('shared delete confirmation cancels without HTTP; confirmed target and 204 survive selection races', opts, async t => {
  const view = await environment(t); await view.ready(); const before = view.requests.length;
  await click(view.by('data-delete-schedule', 11)); await confirm(view, false); await Vue.nextTick(); assert.equal(view.requests.length, before);
  await click(view.by('data-delete-schedule', 11)); await click(view.by('data-select-plan', 2));
  view.expect(schedulesPath + '11/', null, { method: 'DELETE', status: 204 }); view.expect(schedulesPath, [row(22, 2)]);
  const done = signal(() => view.requests.length === before + 2 && view.by('data-delete-schedule', 22)?.props.disabled === false); await confirm(view, true); await done;
  assert.ok(view.by('data-schedule-id', 22)); assert.equal(view.by('data-select-plan', 2).props['aria-pressed'], true); await click(view.by('data-select-plan', 1)); assert.ok(view.by('data-schedule-empty', 'collection'));
});
test('action and delete HTTP failures leave real data intact and expose server errors', opts, async t => {
  const view = await environment(t); await view.ready();
  view.expect(plansPath + '2/set_default/', { detail: 'action-denied-fixture' }, { method: 'POST', status: 403 }); const action = signal(() => view.by('data-action-error', '')?.textContent.includes('action-denied-fixture')); await click(view.by('data-default-plan', 2)); await action;
  assert.ok(view.by('data-default-plan', 2)); assert.equal(view.by('data-default-plan', 1), undefined);
  await click(view.by('data-delete-schedule', 11)); view.expect(schedulesPath + '11/', { detail: 'delete-failed-fixture' }, { method: 'DELETE', status: 500 }); const deletion = signal(() => view.by('data-action-error', '')?.textContent.includes('delete-failed-fixture')); await confirm(view, true); await deletion; assert.ok(view.by('data-schedule-id', 11));
});
function chooseFile(view, file) { const el = view.by('name', 'file'); el.files = file ? [file] : []; el.props.onChange({ target: el }); }
test('Excel file validation, real multipart update/replace, row diagnostics and successful refresh', opts, async t => {
  const view = await environment(t); await view.ready(); await click(view.by('data-action', 'upload')); const before = view.requests.length;
  chooseFile(view, new File(['x'], 'bad.csv')); await Vue.nextTick(); assert.ok(view.by('data-form-error', '')); await submit(view); assert.equal(view.requests.length, before);
  chooseFile(view, new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.xlsx')); await submit(view); assert.equal(view.requests.length, before);
  chooseFile(view, new File(['fixture-excel'], 'schedules.xlsx'));
  view.expect(schedulesPath + 'upload-excel/', { detail: 'invalid-fixture', errors: ['row-3-fixture', 'row-8-fixture'] }, { method: 'POST', status: 400 }); const failed = signal(() => view.by('data-form-error', '')?.textContent.includes('row-8-fixture')); await submit(view); await failed;
  const request = view.requests.at(-1); assert.ok(request.body instanceof FormData); assert.equal(request.body.get('update_mode'), 'update'); assert.equal(request.body.get('plan_id'), '1'); assert.equal(request.body.get('file').name, 'schedules.xlsx'); assert.equal(request.headers['Content-Type'], undefined); assert.ok(view.by('data-form-error', '').textContent.includes('row-3-fixture'));
  const replace = view.root.find(n => n.tag === 'input' && n.props.value === 'replace'); replace.checked = true; for (const fn of replace.events.change) fn({ target: replace }); await Vue.nextTick();
  view.expect(schedulesPath + 'upload-excel/', { detail: 'uploaded-fixture', errors: null }, { method: 'POST' }); view.expect(schedulesPath, [row(13, 1), row(22, 2)]);
  const done = signal(() => view.modal.stack.value.length === 0 && view.by('data-schedule-id', 13)); await submit(view); await done; assert.equal(view.requests.at(-2).body.get('update_mode'), 'replace'); assert.equal(view.by('data-schedule-id', 11), undefined);
  await click(view.by('data-action', 'upload')); await submit(view); assert.ok(view.by('data-form-error', '')); assert.equal(view.requests.length, before + 3);
});
test('collection errors are not empty success or zero counts; exact retry restores rows', opts, async t => {
  const view = await environment(t); const user = view.expect(userPath); view.expect(plansPath + '?page=1', { count: 1, next: null, results: [plan(1)] }); view.expect(schedulesPath, { detail: 'schedule-load-fixture' }, { status: 500 });
  const failed = signal(() => view.by('data-schedules-state', 'error')); view.app.mount(view.root); await view.initialize(user); await failed;
  assert.equal(view.by('data-schedule-empty', 'collection'), undefined); assert.equal(/0/.test(view.by('data-count-plan', 1).textContent), false);
  view.expect(schedulesPath, [row(11, 1)]); const ready = signal(() => view.by('data-schedule-id', 11)); await click(view.by('data-action', 'retry-schedules')); await ready;
  assert.equal(view.by('data-count-plan', 1).textContent.match(/\d+/)[0], '1');
});
test('older initial schedule response cannot overwrite a mutation refresh or changed selection', opts, async t => {
  const view = await environment(t); const user = view.expect(userPath); view.expect(plansPath + '?page=1', { count: 2, next: null, results: [plan(1), plan(2)] }); const older = view.expect(schedulesPath);
  const plansReady = signal(() => view.by('data-plan-id', 2)); view.app.mount(view.root); await view.initialize(user); await plansReady;
  await click(view.by('data-action', 'new-schedule')); await input(view, 'date', '2026-09-08'); await input(view, 'book', 'John');
  view.expect(schedulesPath, row(12, 1), { method: 'POST', status: 201 }); view.expect(schedulesPath, [row(12, 1), row(22, 2)]);
  const saved = signal(() => view.modal.stack.value.length === 0 && view.by('data-schedule-id', 12)); await submit(view); await saved;
  await click(view.by('data-select-plan', 2));
  const oldRequest = view.apiPromises.find(call => call.method === 'GET' && call.path === schedulesPath).promise;
  older.respond([row(11, 1)]); await oldRequest; await Vue.nextTick();
  assert.ok(view.by('data-schedule-id', 22)); await click(view.by('data-select-plan', 1)); assert.ok(view.by('data-schedule-id', 12)); assert.equal(view.by('data-schedule-id', 11), undefined);
});
test('real role revocation closes owned forms; late mutation cannot refresh, toast or recreate staff UI', opts, async t => {
  const view = await environment(t); await view.ready(); await click(view.by('data-action', 'new-schedule')); await input(view, 'date', '2026-09-08'); await input(view, 'book', 'John');
  const pending = view.expect(schedulesPath, undefined, { method: 'POST' }); await submit(view);
  const revoke = view.expect(userPath); const done = view.auth.revalidate(); revoke.respond({ ...staff, is_staff: false }); await done; await Vue.nextTick();
  assert.ok(view.by('data-admin-state', 'denied')); assert.equal(view.modal.stack.value.length, 0); assert.equal(view.by('id', 'schedules'), undefined);
  const count = view.requests.length, mutation = view.apiPromises.find(call => call.method === 'POST' && call.path === schedulesPath).promise;
  pending.respond(row(12, 1), 201); await mutation; await Vue.nextTick(); assert.equal(view.requests.length, count); assert.equal(view.modal.stack.value.length, 0); assert.equal(view.toast.toasts.value.length, 0);
});

test('owned SFC styles compile and retain responsive tokenized control geometry', async () => {
  for (const file of ['components/admin/AdminPlansWorkspace.vue', 'components/admin/AdminPlanFormContent.vue', 'pages/admin/plans/index.vue']) {
    const { descriptor, errors } = parse(await readFile(resolve(appDir, file), 'utf8'), { filename: file }); assert.deepEqual(errors, []);
    for (const style of descriptor.styles) { const compiled = compileStyle({ source: style.content, filename: file, id: 'plans-test', scoped: style.scoped }); assert.deepEqual(compiled.errors, []); }
  }
  const source = await readFile(resolve(appDir, 'components/admin/AdminPlansWorkspace.vue'), 'utf8'); const { descriptor } = parse(source); const css = compileStyle({ source: descriptor.styles[0].content, filename: 'workspace.vue', id: 'plans-test', scoped: true }).code;
  assert.match(css, /grid-template-columns: 360px minmax\(0, 1fr\)/); assert.match(css, /max-width: 1023px/); assert.match(css, /min-height: 44px/); assert.match(css, /var\(--color-bg-card\)/); assert.match(css, /var\(--color-accent-focus-ring\)/); assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
});


test('plan collection failure retries without inventing an empty list; empty server data disables schedule writes', opts, async t => {
  const view = await environment(t); const user = view.expect(userPath); view.expect(plansPath + '?page=1', { detail: 'plans-load-fixture' }, { status: 500 }); view.expect(schedulesPath, []);
  const failed = signal(() => view.by('data-plans-state', 'error')); view.app.mount(view.root); await view.initialize(user); await failed;
  assert.equal(view.by('data-plans-state', 'empty'), undefined); assert.equal(view.by('data-action', 'new-schedule').props.disabled, true);
  view.expect(plansPath + '?page=1', { count: 0, next: null, results: [] }); const empty = signal(() => view.by('data-plans-state', 'empty')); await click(view.by('data-action', 'retry-plans')); await empty;
  assert.ok(view.by('data-schedule-empty', 'selection')); assert.equal(view.by('data-action', 'new-schedule').props.disabled, true); assert.equal(view.by('data-action', 'upload').props.disabled, true); assert.equal(view.by('data-action', 'new-plan').props.disabled, false);
});
test('schedule field errors retain input; a committed save followed by failed reload never invites duplicate resubmission', opts, async t => {
  const view = await environment(t); await view.ready(); await click(view.by('data-edit-schedule', 11)); await input(view, 'book', 'John');
  view.expect(schedulesPath + '11/', { book: ['schedule-book-fixture'] }, { method: 'PUT', status: 400 }); const rejected = signal(() => view.by('data-form-error', '')?.textContent.includes('schedule-book-fixture')); await submit(view); await rejected;
  assert.equal(view.by('name', 'book').value, 'John'); assert.equal(view.modal.stack.value.length, 1);
  view.expect(schedulesPath + '11/', row(11, 1, { book: 'John' }), { method: 'PUT' }); view.expect(schedulesPath, { detail: 'reload-failed-fixture' }, { status: 500 });
  const saved = signal(() => view.modal.stack.value.length === 0 && view.by('data-schedules-state', 'error')); await submit(view); await saved;
  assert.equal(view.by('data-schedule-id', 11), undefined); assert.equal(view.by('data-schedule-empty', 'collection'), undefined);
  view.expect(schedulesPath, [row(11, 1, { book: 'John' }), row(22, 2)]); const ready = signal(() => view.by('data-schedule-id', 11)?.textContent.includes('John')); await click(view.by('data-action', 'retry-schedules')); await ready;
  assert.equal(view.requests.filter(r => r.method === 'PUT').length, 2);
});
test('revoking staff with delete confirmation open cancels it before any destructive request', opts, async t => {
  const view = await environment(t); await view.ready(); await click(view.by('data-delete-schedule', 11));
  const mounted = signal(() => view.root.find(n => n.props.class?.includes('confirm-btn-danger'))); await mounted;
  const revoke = view.expect(userPath); const done = view.auth.revalidate(); revoke.respond({ ...staff, is_staff: false }); await done; await Vue.nextTick();
  assert.equal(view.modal.stack.value.length, 0); assert.equal(view.requests.some(r => r.method === 'DELETE'), false); assert.equal(view.by('id', 'schedules'), undefined);
});
