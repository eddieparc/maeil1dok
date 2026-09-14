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
const options = { timeout: 8000 };
const listPath = '/api/v1/todos/hasena/summaries/';
const detailPath = '/api/v1/todos/hasena/summary/';
const regenPath = `${listPath}regenerate/`;
const userPath = '/api/v1/auth/user/';
const staff = { id: 17, username: 'fixture-staff', is_staff: true };
const row = (id = 1, extra = {}) => ({ id, video_id: `video-${id}`, video_date: '2026-09-07', title: `Title ${id}`, summary_preview: `Preview ${id}...`, is_edited: false, status: extra.is_edited ? 'reviewed' : 'review_needed', has_summary: true, error_code: null, error_message: null, model_used: 'fixture-model', updated_at: '2026-09-07T00:00:00Z', ...extra });
const page = (summaries = [row()], total = summaries.length, number = 1) => ({ success: true, summaries, total, page: number, page_size: 20 });
const detail = (id = 1, extra = {}) => ({ success: true, video_id: `video-${id}`, title: `Title ${id}`, summary: `Full summary ${id} - never a truncated preview`, model: 'fixture-model', is_edited: false, video_date: '2026-09-07', persisted: true, cacheable: true, status: 'review_needed', has_summary: true, error_code: null, error_message: null, ...extra });
const regenerated = (extra = {}) => detail(1, { created: false, ...extra });
const generationFailure = (extra = {}) => ({ success: false, video_id: 'video-1', error: 'fixture transcript unavailable', error_code: 'transcript_unavailable', persisted: false, cacheable: false, failure_persisted: true, status: 'failed', ...extra });
const failedRow = (id = 1, extra = {}) => row(id, { status: 'failed', error_code: 'transcript_unavailable', error_message: 'fixture transcript unavailable', ...extra });
const failureOnly = (id = 1, extra = {}) => failedRow(id, { id: null, has_summary: false, is_edited: null, title: '', video_date: null, model_used: null, summary_preview: null, ...extra });
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

async function bundle(mountedTasks) {
  const result = await build({
    stdin: { contents: `export { default as Page } from './pages/admin/hasena/index.vue'; export { useAuthService } from './composables/useAuthService'; export { useModalState } from './composables/useModalState';`, resolveDir: appDir, loader: 'ts' },
    bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
    define: { 'import.meta.client': 'true', 'import.meta.server': 'false' },
    external: ['vue', 'vue-router', '@lucide/vue', '#components', '#app', '#imports', 'nuxt/app', '~/stores/*'],
    plugins: [{ name: 'hasena-sfc', setup(builder) {
      builder.onResolve({ filter: /^~\// }, ({ path }) => path.startsWith('~/stores/') ? { path, external: true } : { path: resolve(appDir, path.slice(2) + (path.endsWith('.vue') ? '' : '.ts')) });
      builder.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
        const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path }); assert.deepEqual(errors, []);
        return { contents: compileScript(descriptor, { id: path, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } }).content, loader: 'ts', resolveDir: dirname(path) };
      });
    } }],
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(name => {
    if (name === 'vue') return { ...Vue, onMounted(hook, target) {
      return Vue.onMounted((...args) => { const task = hook(...args); mountedTasks.push(task); return task; }, target);
    } };
    if (name === '#components') return { NuxtLink: RouterLink };
    if (['#app', '#imports', 'nuxt/app'].includes(name)) return { useState: globalThis.useState, useRuntimeConfig: globalThis.useRuntimeConfig };
    return require(name);
  }, module, module.exports);
  return module.exports;
}

async function environment(t) {
  const states = new Map(), queue = [], requests = [], observers = new Set();
  const notify = () => { for (const fn of observers) fn(); };
  class Element {
    constructor(tag, text = '') { this.tag = tag; this.tagName = tag.toUpperCase(); this.text = text; this.props = {}; this.children = []; this.parent = null; this.listeners = {}; this.value = ''; }
    get textContent() { return this.text + this.children.map(n => n.textContent).join(''); }
    all(fn) { return this.children.flatMap(n => [...(fn(n) ? [n] : []), ...n.all(fn)]); }
    find(fn) { return this.all(fn)[0]; }
    addEventListener(event, fn) { this.listeners[event] = fn; }
    removeEventListener(event) { delete this.listeners[event]; }
  }
  const detach = node => { if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1); node.parent = null; notify(); };
  const renderer = Vue.createRenderer({
    createElement: tag => new Element(tag), createText: text => new Element('#text', text), createComment: () => new Element('#comment'),
    setText(node, text) { node.text = text; notify(); }, setElementText(node, text) { node.text = text; node.children = []; notify(); },
    patchProp(node, key, old, value) { node.props[key] = value; if (key === 'value') node.value = value; notify(); },
    insert(node, parent, anchor = null) { detach(node); parent.children.splice(anchor ? parent.children.indexOf(anchor) : parent.children.length, 0, node); node.parent = parent; notify(); },
    remove: detach, parentNode: node => node.parent, nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null,
    setScopeId() {}, insertStaticContent() { throw new Error('Unexpected static HTML'); },
  });
  const storage = new Map();
  const globals = {
    useState(key, init) { if (!states.has(key)) states.set(key, Vue.ref(init())); return states.get(key); },
    useRuntimeConfig: () => ({ public: { apiBase: 'https://api.example.test', csrfCookieName: 'csrftoken' } }),
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    window: { addEventListener() {} }, document: { cookie: 'csrftoken=fixture-csrf', hidden: false, addEventListener() {} },
  };
  for (const [key, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]);
  }
  t.mock.method(globalThis, 'setInterval', fn => fn); t.mock.method(globalThis, 'clearInterval', () => {});
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    const parsed = new URL(url), request = { path: parsed.pathname, query: Object.fromEntries(parsed.searchParams), method: init.method || 'GET', init };
    requests.push(request); const next = queue.shift(); assert.ok(next, `Unexpected HTTP: ${request.method} ${request.path}`); assert.equal(request.path, next.path); assert.equal(request.method, next.method);
    next.started.resolve(request);
    const outcome = await next.result.promise;
    if (outcome instanceof Error) throw outcome;
    return new Response(JSON.stringify(outcome.body), { status: outcome.status, headers: { 'Content-Type': 'application/json' } });
  });
  const mountedTasks = [];
  const runtime = await bundle(mountedTasks), auth = runtime.useAuthService(), modal = runtime.useModalState();
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] }); await router.push('/admin/hasena');
  const root = new Element('root');
  // The real global modal state mounts the actual editor content. DOM focus/scroll
  // infrastructure is covered by its own suite; no API or component method is mocked.
  const Host = { setup: () => () => Vue.h('section', { 'data-test-modal-host': '' }, modal.stack.value.map(m => Vue.h(m.component, { ...m.options.props, key: m.id }))) };
  const app = renderer.createApp({ setup: () => () => Vue.h('div', [Vue.h(runtime.Page), Vue.h(Host)]) }); app.use(router);
  t.after(() => { app.unmount(); modal.closeAll(); });
  function enqueue(path, body, method = 'GET', status = 200) {
    const result = deferred(), started = deferred(); queue.push({ path, method, result, started });
    if (body !== undefined) result.resolve({ body, status });
    return { started: started.promise, respond: (body, status = 200) => result.resolve({ body, status }), reject: () => result.resolve(new TypeError('fixture offline')) };
  }
  const find = (attr, value) => root.find(n => n.props[attr] !== undefined && (value === undefined || n.props[attr] === value));
  function signal(predicate) {
    if (predicate()) return Promise.resolve();
    return new Promise(resolve => { const fn = () => { if (predicate()) { observers.delete(fn); resolve(); } }; observers.add(fn); });
  }
  async function change(action, predicate) { const done = signal(predicate); action(); await done; await Vue.nextTick(); }
  const click = node => { assert.ok(node, 'target must exist'); for (const fn of [node.props.onClick].flat()) fn({}); };
  async function start(body = page()) {
    const user = enqueue(userPath); const list = enqueue(listPath); app.mount(root);
    const initialized = auth.initialize(); user.respond(staff); await initialized;
    await list.started; await change(() => list.respond(body), () => find('data-hasena-state')?.props['data-hasena-state'] === 'ready');
  }
  async function edit(id = 1, body = detail(id)) {
    const response = enqueue(detailPath);
    click(find('data-hasena-edit', `video-${id}`)); await response.started;
    if (body !== undefined) await change(() => response.respond(body), () => find('data-editor-state')?.props['data-editor-state'] === 'ready');
    return response;
  }
  function input(attr, value) { const node = find(attr); assert.ok(node); node.value = value; node.listeners.input({ target: node }); }
  return { root, app, auth, modal, mountedTasks, requests, enqueue, find, signal, change, click, start, edit, input };
}

test('Hasena page gates real summary HTTP behind initialized authoritative staff', options, async t => {
  const v = await environment(t); const user = v.enqueue(userPath); v.app.mount(v.root);
  assert.deepEqual(v.requests.map(r => r.path), [userPath]); assert.equal(v.find('data-hasena-state'), undefined);
  const initialized = v.auth.initialize(); user.respond({ ...staff, is_staff: false }); await initialized; await Vue.nextTick();
  assert.equal(v.find('data-admin-state').props['data-admin-state'], 'denied'); assert.equal(v.requests.length, 1);
});

test('real list total, supported filters, paged append dedup and failed-page retry', options, async t => {
  const v = await environment(t); await v.start(page([row()], 41));
  assert.equal(v.find('data-hasena-total').textContent, '41');
  assert.deepEqual(v.requests[1].query, { status: 'all', page: '1', page_size: '20' });
  const tabs = v.root.all(n => n.props.role === 'tab'); assert.equal(tabs.length, 3); assert.ok(tabs.every(tab => !tab.props.disabled));
  const next = v.enqueue(listPath); v.click(v.find('data-hasena-more')); v.click(v.find('data-hasena-more')); await next.started;
  assert.equal(v.requests.length, 3); assert.equal(v.requests.at(-1).query.page, '2');
  await v.change(() => next.respond({ success: false }, 503), () => Boolean(v.find('data-hasena-list-error')));
  assert.equal(v.root.all(n => n.props['data-hasena-row']).length, 1);
  const retry = v.enqueue(listPath); v.click(v.find('data-hasena-more')); await retry.started; assert.equal(v.requests.at(-1).query.page, '2');
  await v.change(() => retry.respond(page([row(), row(2)], 41, 2)), () => Boolean(v.find('data-hasena-row', 'video-2')));
  assert.equal(v.root.all(n => n.props['data-hasena-row']).length, 2);
});

test('edit waits for full detail and saves exact title/body through real PUT, then reloads persisted review status', options, async t => {
  const v = await environment(t); await v.start();
  const get = v.enqueue(detailPath); v.click(v.find('data-hasena-edit', 'video-1')); await get.started; await Vue.nextTick();
  assert.equal(v.find('data-editor-save').props.disabled, true);
  assert.deepEqual(v.requests.at(-1).query, { video_id: 'video-1' });
  await v.change(() => get.respond(detail()), () => v.find('data-editor-state')?.props['data-editor-state'] === 'ready');
  assert.equal(v.find('data-editor-summary').value, detail().summary);
  v.input('data-editor-title', 'Changed title'); v.input('data-editor-summary', 'Changed full summary'); await Vue.nextTick();
  const save = v.enqueue(`${listPath}video-1/`, undefined, 'PUT'), reload = v.enqueue(listPath);
  v.click(v.find('data-editor-save')); v.click(v.find('data-editor-save')); await save.started;
  assert.equal(v.requests.filter(r => r.method === 'PUT').length, 1);
  assert.deepEqual(JSON.parse(v.requests.at(-1).init.body), { title: 'Changed title', summary: 'Changed full summary' });
  assert.equal(v.requests.at(-1).init.headers['X-CSRFToken'], 'fixture-csrf'); assert.equal(v.requests.at(-1).init.credentials, 'include');
  save.respond({ success: true, video_id: 'video-1', title: 'Changed title', summary: 'Changed full summary', is_edited: true, status: 'reviewed' }); await reload.started;
  await v.change(() => reload.respond(page([row(1, { title: 'Changed title', is_edited: true })])), () => v.find('data-hasena-status')?.props['data-hasena-status'] === 'reviewed');
  assert.equal(v.modal.stack.value.length, 0);
});

test('detail failure never enables a preview save; retry reads authoritative body', options, async t => {
  const v = await environment(t); await v.start(); const response = v.enqueue(detailPath); v.click(v.find('data-hasena-edit', 'video-1')); await response.started;
  await v.change(() => response.respond({ error: 'fixture detail unavailable' }, 404), () => Boolean(v.find('data-editor-error')));
  assert.equal(v.find('data-editor-save').props.disabled, true); assert.equal(v.find('data-editor-summary'), undefined);
  const retry = v.enqueue(detailPath); v.click(v.find('data-editor-retry')); await retry.started;
  await v.change(() => retry.respond(detail()), () => v.find('data-editor-state')?.props['data-editor-state'] === 'ready');
  assert.equal(v.find('data-editor-summary').value, detail().summary);
});

test('save error preserves draft and empty title; retry really clears the title and saves review', options, async t => {
  const v = await environment(t); await v.start(); await v.edit();
  v.input('data-editor-title', ''); v.input('data-editor-summary', 'My draft'); await Vue.nextTick();
  assert.equal(v.find('data-editor-save').props.disabled, false);
  const save = v.enqueue(`${listPath}video-1/`, undefined, 'PUT'); v.click(v.find('data-editor-save')); await save.started;
  await v.change(() => save.respond({ error: 'fixture permission denied' }, 403), () => Boolean(v.find('data-editor-error')));
  assert.equal(v.find('data-editor-summary').value, 'My draft'); assert.equal(v.find('data-editor-title').value, ''); assert.equal(v.modal.stack.value.length, 1);
  const retry = v.enqueue(`${listPath}video-1/`, undefined, 'PUT'), reload = v.enqueue(listPath);
  v.click(v.find('data-editor-save')); await retry.started;
  assert.deepEqual(JSON.parse(v.requests.at(-1).init.body), { title: '', summary: 'My draft' });
  retry.respond({ success: true, video_id: 'video-1', title: '', summary: 'My draft', is_edited: true, status: 'reviewed' }); await reload.started;
  await v.change(() => reload.respond(page([row(1, { title: '', summary_preview: 'My draft', is_edited: true })])), () => v.find('data-hasena-status')?.props['data-hasena-status'] === 'reviewed');
  assert.equal(v.find('data-hasena-row', 'video-1').find(n => n.tag === 'h2').textContent, 'video-1');
});

test('closed detail response cannot overwrite a newly opened editor', options, async t => {
  const v = await environment(t); await v.start(page([row(), row(2)]));
  const first = v.enqueue(detailPath); v.click(v.find('data-hasena-edit', 'video-1')); await first.started;
  const oldLoad = v.mountedTasks.at(-1);
  await v.change(() => v.modal.cancel(), () => !v.find('data-editor-state')); await Vue.nextTick();
  await v.edit(2); first.respond(detail(1));
  await oldLoad; await Vue.nextTick(); assert.equal(v.find('data-editor-summary').value, detail(2).summary);
});

test('regeneration is one real POST with transient pending, preserves failure and retries to server result', options, async t => {
  const v = await environment(t); await v.start(page([row(1, { is_edited: true })]));
  const failed = v.enqueue(regenPath, undefined, 'POST'); v.click(v.find('data-hasena-regenerate', 'video-1')); v.click(v.find('data-hasena-regenerate', 'video-1')); await failed.started; await Vue.nextTick();
  assert.equal(v.find('data-hasena-operation').props['data-hasena-operation'], 'pending'); assert.equal(v.requests.filter(r => r.method === 'POST').length, 1);
  assert.deepEqual(JSON.parse(v.requests.at(-1).init.body), { video_id: 'video-1' });
  await v.change(() => failed.respond({ error: 'fixture no transcript' }, 400), () => Boolean(v.find('data-hasena-operation-error')));
  assert.equal(v.find('data-hasena-edited').props['data-hasena-edited'], true);
  const retry = v.enqueue(regenPath, undefined, 'POST'), reload = v.enqueue(listPath);
  v.click(v.find('data-hasena-regenerate', 'video-1')); await retry.started;
  retry.respond(regenerated({ summary: 'Generated result', model: 'fixture-model-2' })); await reload.started;
  await v.change(() => reload.respond(page([row(1, { summary_preview: 'Generated result' })])), () => v.find('data-hasena-edited')?.props['data-hasena-edited'] === false);
  assert.equal(v.find('data-hasena-operation-error'), undefined);
});

test('auth role revocation closes shared editor and late detail cannot trigger a write or reload', options, async t => {
  const v = await environment(t); await v.start(); const detailResponse = v.enqueue(detailPath); v.click(v.find('data-hasena-edit', 'video-1')); await detailResponse.started;
  const oldLoad = v.mountedTasks.at(-1);
  const revoke = v.enqueue(userPath); const done = v.auth.revalidate(); revoke.respond({ ...staff, is_staff: false }); await done; await Vue.nextTick();
  assert.equal(v.modal.stack.value.length, 0); assert.equal(v.find('data-hasena-state'), undefined);
  detailResponse.respond(detail()); await oldLoad; await Vue.nextTick(); assert.equal(v.requests.filter(r => r.method !== 'GET').length, 0);
});

test('initial false-success response is an error rather than an invented empty list; retry can show real empty', options, async t => {
  const v = await environment(t); const user = v.enqueue(userPath), list = v.enqueue(listPath); v.app.mount(v.root);
  const done = v.auth.initialize(); user.respond(staff); await done; await list.started;
  await v.change(() => list.respond({ success: false }), () => Boolean(v.find('data-hasena-list-error')));
  assert.equal(v.find('data-hasena-total'), undefined);
  const retry = v.enqueue(listPath); v.click(v.find('data-hasena-retry')); await retry.started;
  await v.change(() => retry.respond(page([])), () => Boolean(v.find('data-hasena-empty')));
  assert.equal(v.find('data-hasena-total').textContent, '0');
});

test('a failed post-mutation refresh retries page one instead of appending stale pagination', options, async t => {
  const v = await environment(t); await v.start(page([row()], 41));
  const regen = v.enqueue(regenPath, undefined, 'POST'), reload = v.enqueue(listPath);
  v.click(v.find('data-hasena-regenerate', 'video-1')); await regen.started;
  regen.respond(regenerated({ summary: 'Actual new body', model: 'fixture-new' })); await reload.started;
  await v.change(() => reload.respond({ error: 'fixture list unavailable' }, 503), () => Boolean(v.find('data-hasena-list-error')));
  assert.ok(v.find('data-hasena-retry'), 'refresh failure must offer page-one retry even if more old pages exist');
  const retry = v.enqueue(listPath); v.click(v.find('data-hasena-retry')); await retry.started;
  assert.equal(v.requests.at(-1).query.page, '1');
  await v.change(() => retry.respond(page([row(1, { summary_preview: 'Actual new body' })], 41)), () => v.find('data-hasena-row', 'video-1')?.textContent.includes('Actual new body'));
  assert.equal(v.requests.filter(r => r.method === 'POST').length, 1);
});

test('editor cannot be dismissed through shared overlay or close controls during an in-flight save', options, async t => {
  const v = await environment(t); await v.start(); await v.edit();
  const save = v.enqueue(`${listPath}video-1/`, undefined, 'PUT'); v.click(v.find('data-editor-save')); await save.started; await Vue.nextTick();
  const instance = v.modal.stack.value[0];
  assert.equal(instance.options.closeOnOverlay, false);
  assert.equal(instance.options.closeOnEsc, false);
  assert.equal(instance.options.showCloseButton, false);
  assert.equal(v.find('data-editor-cancel').props.disabled, true);
  assert.equal(v.find('data-editor-close').props.disabled, true);
  await v.change(() => save.respond({ error: 'fixture rejected' }, 403), () => Boolean(v.find('data-editor-error')));
  assert.equal(v.find('data-editor-cancel').props.disabled, false);
  assert.equal(instance.options.closeOnEsc, true, 'shared focus trap must resume owning Escape after save failure');
  assert.equal(instance.options.closeOnOverlay, true);
});

test('an ambiguous regeneration transport failure can be reconciled by read without a second AI request', options, async t => {
  const v = await environment(t); await v.start(page([row(1, { is_edited: true })]));
  const regen = v.enqueue(regenPath, undefined, 'POST'); v.click(v.find('data-hasena-regenerate', 'video-1')); await regen.started;
  await v.change(() => regen.reject(), () => Boolean(v.find('data-hasena-operation-error')));
  assert.ok(v.find('data-hasena-refresh'), 'transport failure must offer a read-only reconciliation');
  const reload = v.enqueue(listPath); v.click(v.find('data-hasena-refresh')); await reload.started;
  await v.change(() => reload.respond(page([row()])), () => v.find('data-hasena-edited')?.props['data-hasena-edited'] === false);
  assert.equal(v.requests.filter(r => r.method === 'POST').length, 1);
  assert.equal(v.find('data-hasena-operation-error'), undefined);
});

test('filter changes reset rows, totals and cursor; server-filtered pages and failed-filter retries stay scoped', options, async t => {
  const v = await environment(t); await v.start(page([row(1, { is_edited: true })], 85));
  const tabs = () => v.root.all(n => n.props.role === 'tab');
  const review = v.enqueue(listPath); v.click(tabs()[1]); await review.started; await Vue.nextTick();
  assert.deepEqual(v.requests.at(-1).query, { status: 'review_needed', page: '1', page_size: '20' });
  assert.equal(v.find('data-hasena-total'), undefined); assert.equal(v.find('data-hasena-row'), undefined);
  assert.ok(tabs().every(tab => tab.props.disabled));
  v.click(tabs()[2]); assert.equal(v.requests.length, 3);
  await v.change(() => review.respond(page([row(2)], 21)), () => Boolean(v.find('data-hasena-row', 'video-2')));
  assert.equal(v.find('data-hasena-total').textContent, '21');
  const panel = v.root.find(n => n.props.role === 'tabpanel');
  assert.equal(panel.props['aria-labelledby'], tabs()[1].props.id); assert.equal(tabs()[1].props['aria-controls'], panel.props.id);
  const next = v.enqueue(listPath); v.click(v.find('data-hasena-more')); await next.started;
  assert.deepEqual(v.requests.at(-1).query, { status: 'review_needed', page: '2', page_size: '20' });
  await v.change(() => next.respond(page([row(3)], 21, 2)), () => Boolean(v.find('data-hasena-row', 'video-3')));
  assert.equal(v.find('data-hasena-more'), undefined);
  const failed = v.enqueue(listPath); v.click(tabs()[2]); await failed.started;
  assert.deepEqual(v.requests.at(-1).query, { status: 'failed', page: '1', page_size: '20' });
  await v.change(() => failed.respond({ error: 'fixture failed filter offline' }, 503), () => Boolean(v.find('data-hasena-list-error')));
  assert.equal(v.find('data-hasena-total'), undefined); assert.equal(v.find('data-hasena-row'), undefined);
  const retry = v.enqueue(listPath); v.click(v.find('data-hasena-retry')); await retry.started;
  assert.deepEqual(v.requests.at(-1).query, { status: 'failed', page: '1', page_size: '20' });
  await v.change(() => retry.respond(page([failedRow(4)], 1)), () => Boolean(v.find('data-hasena-row', 'video-4')));
  assert.equal(v.find('data-hasena-total').textContent, '1'); assert.equal(tabs()[2].props['aria-selected'], true);
});

test('failure-only rows retain separate video identities, safe errors and unknown metadata without enabling editing', options, async t => {
  const v = await environment(t); await v.start(page([failureOnly(), failureOnly(2), failedRow(3, { is_edited: true })]));
  assert.equal(v.root.all(n => n.props['data-hasena-row']).length, 3);
  for (const id of [1, 2]) {
    const item = v.find('data-hasena-row', `video-${id}`);
    assert.equal(item.find(n => n.tag === 'h2').textContent, `video-${id}`);
    assert.equal(item.find(n => n.props['data-hasena-status']).props['data-hasena-status'], 'failed');
    assert.equal(item.find(n => n.props['data-hasena-failure']).textContent, failureOnly(id).error_message);
    assert.equal(item.find(n => n.props['data-hasena-video-date']), undefined);
    assert.equal(item.find(n => n.props['data-hasena-preview']), undefined);
    assert.equal(item.find(n => n.props['data-hasena-model']), undefined);
    assert.equal(v.find('data-hasena-edit', `video-${id}`).props.disabled, true);
    assert.equal(v.find('data-hasena-regenerate', `video-${id}`).props.disabled, false);
    v.click(v.find('data-hasena-edit', `video-${id}`));
  }
  assert.equal(v.requests.length, 2); assert.equal(v.modal.stack.value.length, 0);
  const previous = v.find('data-hasena-row', 'video-3');
  assert.equal(previous.find(n => n.props['data-hasena-status']).props['data-hasena-status'], 'failed');
  assert.equal(previous.find(n => n.props['data-hasena-preview'] !== undefined).textContent, row(3).summary_preview);
  assert.equal(v.find('data-hasena-edit', 'video-3').props.disabled, false);
});

test('persisted regeneration failure reloads server state while retaining the last valid summary for review', options, async t => {
  const v = await environment(t); await v.start(page([row(1, { is_edited: true })]));
  const regen = v.enqueue(regenPath, undefined, 'POST'), failedList = v.enqueue(listPath);
  v.click(v.find('data-hasena-regenerate', 'video-1')); await regen.started;
  regen.respond(generationFailure(), 400); await failedList.started;
  await v.change(() => failedList.respond(page([failedRow(1, { is_edited: true })])), () => v.find('data-hasena-status')?.props['data-hasena-status'] === 'failed');
  assert.equal(v.find('data-hasena-preview').textContent, row().summary_preview);
  assert.equal(v.find('data-hasena-failure').textContent, failedRow().error_message);
  await v.edit(1, detail(1, { status: 'failed', is_edited: true, error_code: 'transcript_unavailable', error_message: failedRow().error_message }));
  assert.equal(v.find('data-editor-summary').value, detail().summary);
  const save = v.enqueue(`${listPath}video-1/`, undefined, 'PUT'), reload = v.enqueue(listPath);
  v.click(v.find('data-editor-save')); await save.started;
  save.respond({ success: true, video_id: 'video-1', title: 'Title 1', summary: detail().summary, is_edited: true, status: 'reviewed' }); await reload.started;
  await v.change(() => reload.respond(page([row(1, { is_edited: true })])), () => v.find('data-hasena-status')?.props['data-hasena-status'] === 'reviewed');
  assert.equal(v.find('data-hasena-failure'), undefined); assert.equal(v.requests.filter(r => r.method === 'POST').length, 1);
});

test('failure-only retry and saved review leave their server-filtered lists and become visible in the correct filter', options, async t => {
  const v = await environment(t); await v.start(page([failureOnly()]));
  const tabs = () => v.root.all(n => n.props.role === 'tab');
  const failed = v.enqueue(listPath); v.click(tabs()[2]); await failed.started;
  await v.change(() => failed.respond(page([failureOnly()])), () => Boolean(v.find('data-hasena-row')));
  const regen = v.enqueue(regenPath, undefined, 'POST'), reload = v.enqueue(listPath);
  v.click(v.find('data-hasena-regenerate', 'video-1')); await regen.started; await Vue.nextTick();
  assert.ok(tabs().every(tab => tab.props.disabled));
  regen.respond(regenerated({ title: '', video_date: null, created: true })); await reload.started;
  assert.deepEqual(v.requests.at(-1).query, { status: 'failed', page: '1', page_size: '20' });
  await v.change(() => reload.respond(page([])), () => Boolean(v.find('data-hasena-empty')));
  assert.equal(v.find('data-hasena-row'), undefined); assert.equal(v.find('data-hasena-total').textContent, '0');
  const review = v.enqueue(listPath); v.click(tabs()[1]); await review.started;
  await v.change(() => review.respond(page([row(1, { title: '', video_date: null })])), () => Boolean(v.find('data-hasena-row')));
  assert.equal(v.find('data-hasena-status').props['data-hasena-status'], 'review_needed');
  await v.edit(1, detail(1, { title: '', video_date: null }));
  assert.ok(tabs().every(tab => tab.props.disabled));
  const save = v.enqueue(`${listPath}video-1/`, undefined, 'PUT'), reviewedList = v.enqueue(listPath);
  v.click(v.find('data-editor-save')); await save.started;
  save.respond({ success: true, video_id: 'video-1', title: '', summary: detail().summary, is_edited: true, status: 'reviewed' }); await reviewedList.started;
  assert.deepEqual(v.requests.at(-1).query, { status: 'review_needed', page: '1', page_size: '20' });
  await v.change(() => reviewedList.respond(page([])), () => Boolean(v.find('data-hasena-empty')));
  const all = v.enqueue(listPath); v.click(tabs()[0]); await all.started;
  await v.change(() => all.respond(page([row(1, { title: '', video_date: null, is_edited: true })])), () => Boolean(v.find('data-hasena-row')));
  assert.equal(v.find('data-hasena-status').props['data-hasena-status'], 'reviewed');
  assert.equal(v.requests.filter(r => r.method === 'POST').length, 1);
});

test('unpersisted generation failure never invents a failed row; reconciliation is a read-only action', options, async t => {
  const v = await environment(t); await v.start();
  const regen = v.enqueue(regenPath, undefined, 'POST'); v.click(v.find('data-hasena-regenerate', 'video-1')); await regen.started;
  const failure = generationFailure({ failure_persisted: false }); delete failure.status;
  await v.change(() => regen.respond(failure, 400), () => Boolean(v.find('data-hasena-operation-error')));
  assert.equal(v.find('data-hasena-status').props['data-hasena-status'], 'review_needed');
  assert.equal(v.find('data-hasena-failure'), undefined); assert.equal(v.requests.length, 3);
  const reload = v.enqueue(listPath); v.click(v.find('data-hasena-refresh')); await reload.started;
  await v.change(() => reload.respond(page([row()])), () => !v.find('data-hasena-operation-error'));
  assert.equal(v.requests.filter(r => r.method === 'POST').length, 1);
});

test('owned SFC styles compile', async () => {
  for (const filename of ['components/admin/HasenaSummariesContent.vue', 'components/admin/HasenaSummaryEditor.vue', 'pages/admin/hasena/index.vue']) {
    const path = resolve(appDir, filename), source = await readFile(path, 'utf8'), { descriptor } = parse(source);
    for (const style of descriptor.styles) assert.deepEqual(compileStyle({ source: style.content, filename: path, id: 'hasena', scoped: true }).errors, []);
  }
});
