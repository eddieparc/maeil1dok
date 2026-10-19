import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { compileScript, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import * as Router from 'vue-router';
import * as Icons from '@lucide/vue';

// Real page, note CRUD/API facade, modal state and memory router. Only HTTP,
// authentication, Nuxt useState and the native rendering surface are supplied.
const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = { Vue, Router, Icons, revision: Vue.ref(0) };
globalThis.__noteDetail = runtime;
globalThis.definePageMeta = () => {};
globalThis.useState = (key, init) => runtime.states.get(key) ?? (runtime.states.set(key, Vue.ref(init())), runtime.states.get(key));
const exportsFor = name => Object.keys(runtime[name]).filter(key => key !== 'default' && /^[\w$]+$/.test(key))
  .map(key => `export const ${key} = globalThis.__noteDetail.${name}.${key};`).join('\n');
const services = {
  '#app': 'export const useRuntimeConfig = () => ({ public: { apiBase: "https://notes.test" } });',
  '#components': "export const NuxtLink = globalThis.__noteDetail.Router.RouterLink;",
  '~/composables/useAuthService': 'export const useAuthService = () => globalThis.__noteDetail.auth;',
  '~/composables/useErrorHandler': 'export const useErrorHandler = () => ({ handleApiError: error => globalThis.__noteDetail.errors.push(error) });',
  '~/composables/useToast': 'export const useToast = () => ({ success: message => globalThis.__noteDetail.toasts.push(message) });',
};
const result = await build({
  stdin: { contents: `export { default as Page } from '~/pages/bible/notes/[id].vue'; export { useModalState } from '~/composables/useModalState';`, resolveDir: root },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  plugins: [{ name: 'note-detail-runtime', setup(builder) {
    builder.onResolve({ filter: /^(vue|vue-router|@lucide\/vue)$/ }, ({ path }) => ({ path, namespace: 'runtime' }));
    builder.onLoad({ filter: /.*/, namespace: 'runtime' }, ({ path }) => ({ contents: exportsFor({ vue: 'Vue', 'vue-router': 'Router', '@lucide/vue': 'Icons' }[path]) }));
    builder.onResolve({ filter: /^(~\/|#app$|#components$)/ }, ({ path }) => services[path] ? { path, namespace: 'service' }
      : { path: `${root}app/${path.slice(2)}${/\.(vue|ts|js)$/.test(path) ? '' : existsSync(`${root}app/${path.slice(2)}.ts`) ? '.ts' : '.js'}` });
    builder.onLoad({ filter: /.*/, namespace: 'service' }, ({ path }) => ({ contents: services[path] }));
    builder.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
      // Modal presentation and legacy Toast belong to the shared host, not this page.
      if (path.endsWith('/Toast.vue') || path.includes('/ui/modal/')) return { contents: 'export default () => null;' };
      const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path });
      assert.deepEqual(errors, []);
      return { contents: compileScript(descriptor, { id: path, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } }).content,
        loader: 'ts', resolveDir: fileURLToPath(new URL('.', `file://${path}`)) };
    });
  } }],
});
const { Page, useModalState } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const notify = () => { runtime.revision.value++; };
const changed = () => Vue.queuePostFlushCb(notify);
const node = (type, text = '') => Vue.markRaw({ type, tagName: type.toUpperCase(), text, props: {}, children: [], parent: null,
  getRootNode: () => globalThis.document, addEventListener() {}, removeEventListener() {}, setAttribute(key, value) { this.props[key] = value; }, removeAttribute(key) { delete this.props[key]; } });
const renderer = Vue.createRenderer({
  createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
  setText: (n, text) => { n.text = text; changed(); }, setElementText: (n, text) => { n.text = text; n.children = []; changed(); },
  parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
  patchProp: (n, key, _old, value) => { n.props[key] = value; if (key === 'value') n.value = value; changed(); },
  insert(n, parent, anchor = null) { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = parent; const at = anchor ? parent.children.indexOf(anchor) : -1; parent.children.splice(at < 0 ? parent.children.length : at, 0, n); changed(); },
  remove(n) { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; changed(); },
});
const all = (host, predicate) => [...(predicate(host) ? [host] : []), ...host.children.flatMap(child => all(child, predicate))];
const cls = (host, name) => all(host, n => String(n.props.class ?? '').split(/\s+/).includes(name))[0];
const state = host => cls(host, 'save-status')?.props['data-state'];
const click = n => { assert.ok(n, 'action exists'); assert.ok(!n.props.disabled, 'action enabled'); const event = { button: 0, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {} }; for (const handler of [n.props.onClick].flat()) handler?.(event); };
const edit = async (host, content) => { cls(host, 'content-editor').props['onUpdate:modelValue'](content); await Vue.nextTick(); };
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
// Subscribe before triggering: Vue render notifications, never sleeps or polling.
function rendered(predicate) {
  if (predicate()) return Promise.resolve();
  return new Promise(resolve => { const off = Vue.watch(runtime.revision, () => { if (predicate()) { off(); resolve(); } }, { flush: 'post' }); });
}
function modalOpened(modal) {
  if (modal.stack.value.length) return Promise.resolve();
  return new Promise(resolve => { const off = Vue.watch(modal.stack, value => { if (value.length) { off(); resolve(); } }); });
}
const fixture = { id: 7, book: 'gen', book_name: '창세기', chapter: 1, start_verse: 2, end_verse: 4, content: '처음 기록', is_private: true, created_at: '2026-09-05T13:12:00Z', updated_at: '2026-09-05T13:12:00Z' };
async function setup(t, { response, id = '7' } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  runtime.states = new Map(); runtime.calls = []; runtime.errors = []; runtime.toasts = [];
  runtime.auth = { isInitialized: Vue.ref(true), isLoading: Vue.ref(false), isAuthenticated: Vue.ref(true), initialize: async () => {} };
  const listeners = new Map();
  globalThis.window = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: (name, fn) => { if (listeners.get(name) === fn) listeners.delete(name); }, history: { state: {} } };
  globalThis.Document = class Document {};
  globalThis.document = Object.assign(new Document(), { cookie: '', activeElement: null });
  globalThis.localStorage = { getItem: () => null };
  t.mock.method(console, 'error', (...args) => runtime.errors.push(args));
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const request = { url, method: options.method ?? 'GET', body: options.body ? JSON.parse(options.body) : undefined };
    runtime.calls.push(request);
    if (response) return response(request);
    return Response.json({ ...fixture, ...request.body });
  });
  const router = Router.createRouter({ history: Router.createMemoryHistory(), routes: [
    { path: '/bible/notes/:id', component: Page }, { path: '/bible/notes', component: { render: () => Vue.h('div') } },
    { path: '/bible', component: { render: () => Vue.h('div') } }, { path: '/profile', component: { render: () => Vue.h('div') } },
  ] });
  await router.push('/bible/notes'); await router.push(`/bible/notes/${id}`);
  const host = node('root'); const app = renderer.createApp({ render: () => Vue.h(Router.RouterView) });
  app.use(router); app.component('NuxtLink', Router.RouterLink);
  for (const name of ['ChevronLeftIcon', 'ChevronRightIcon', 'TrashIcon', 'BookIcon']) app.component(name, { render: () => null });
  const modal = useModalState();
  t.after(() => { app.unmount(); modal.closeAll(); delete globalThis.window; delete globalThis.document; delete globalThis.Document; delete globalThis.localStorage; });
  app.mount(host);
  return { host, router, modal, app, listeners, loaded: () => rendered(() => !!cls(host, 'content-editor')) };
}
const patches = () => runtime.calls.filter(call => call.method === 'PATCH');
const options = { timeout: 3000 };

test('saved/dirty/saving stay visible; a concurrent edit remains dirty and is subsequently autosaved', options, async t => {
  const first = deferred(); let count = 0;
  const view = await setup(t, { response: request => request.method === 'PATCH' && ++count === 1 ? first.promise : Response.json({ ...fixture, ...request.body }) });
  await view.loaded(); assert.equal(state(view.host), 'saved');
  await edit(view.host, '첫 수정'); assert.equal(state(view.host), 'dirty');
  click(cls(view.host, 'save-btn')); await Vue.nextTick();
  assert.equal(state(view.host), 'saving'); assert.ok(cls(view.host, 'content-editor'));
  await edit(view.host, '저장 중 두 번째 수정');
  const dirty = rendered(() => state(view.host) === 'dirty'); first.resolve(Response.json({ ...fixture, content: '첫 수정' })); await dirty;
  assert.equal(cls(view.host, 'content-editor').value, '저장 중 두 번째 수정');
  const saved = rendered(() => state(view.host) === 'saved'); t.mock.timers.tick(3000); await saved;
  assert.deepEqual(patches().map(call => call.body.content), ['첫 수정', '저장 중 두 번째 수정']);
  assert.equal(runtime.toasts.length, 2);
});

test('privacy uses the existing PATCH contract and explicit save cancels the pending debounce', options, async t => {
  const view = await setup(t); await view.loaded();
  assert.equal(state(view.host), 'saved');
  const toggle = all(view.host, n => n.type === 'input' && n.props.type === 'checkbox')[0];
  assert.equal(toggle.props.role, 'switch');
  assert.equal(toggle.props['aria-checked'], true);
  toggle.props['onUpdate:modelValue'](false); await Vue.nextTick();
  assert.equal(toggle.props['aria-checked'], false);
  const saved = rendered(() => state(view.host) === 'saved'); click(cls(view.host, 'save-btn')); await saved;
  t.mock.timers.tick(3000);
  assert.deepEqual(patches().map(call => [call.url, call.body]), [['https://notes.test/api/v1/todos/bible/notes/7/', { content: fixture.content, is_private: false }]]);
});

test('failed save retains draft, exposes error and can be retried without automatic retry loops', options, async t => {
  let fail = true;
  const view = await setup(t, { response: request => request.method === 'PATCH' && fail ? Response.json({ detail: 'offline' }, { status: 500 }) : Response.json({ ...fixture, ...request.body }) });
  await view.loaded(); assert.equal(state(view.host), 'saved'); await edit(view.host, '보존할 내용');
  const failed = rendered(() => !!all(view.host, n => n.props.role === 'alert').length); click(cls(view.host, 'save-btn')); await failed;
  assert.equal(state(view.host), 'error'); assert.equal(cls(view.host, 'content-editor').value, '보존할 내용');
  t.mock.timers.tick(9000); assert.equal(patches().length, 1);
  fail = false; const saved = rendered(() => state(view.host) === 'saved'); click(cls(view.host, 'save-btn')); await saved;
  assert.equal(patches().length, 2);
});

test('real route exits are cancellable, suspend autosave during confirmation, and discard clears pending work', options, async t => {
  const view = await setup(t); await view.loaded(); await edit(view.host, '미저장');
  assert.ok(view.router.currentRoute.value.matched[0].leaveGuards.size > 0, 'page installs real route-leave guard');
  const opened = modalOpened(view.modal); const navigation = view.router.push('/profile'); await opened;
  t.mock.timers.tick(3000); assert.equal(patches().length, 0);
  await view.modal.close(undefined, false); assert.ok(Router.isNavigationFailure(await navigation));
  assert.equal(view.router.currentRoute.value.path, '/bible/notes/7');
  const reopened = modalOpened(view.modal); const leave = view.router.push('/profile'); await reopened;
  await view.modal.close(undefined, true); await leave; await Vue.nextTick();
  t.mock.timers.tick(9000); assert.equal(patches().length, 0); assert.equal(view.router.currentRoute.value.path, '/profile');
});

test('reference is a keyboard-operable link with verse range and uses the same dirty guard', options, async t => {
  const view = await setup(t); await view.loaded();
  const reference = cls(view.host, 'note-location'); assert.equal(reference.type, 'a');
  assert.equal(reference.props.href, '/bible?book=gen&chapter=1&verse=2-4');
  await edit(view.host, '미저장'); const opened = modalOpened(view.modal); click(reference); await opened;
  const navigated = new Promise(resolve => { const off = view.router.afterEach((to, _from, failure) => { if (!failure && to.path === '/bible') { off(); resolve(); } }); });
  await view.modal.close(undefined, true); await navigated;
  assert.deepEqual(view.router.currentRoute.value.query, { book: 'gen', chapter: '1', verse: '2-4' });
});

test('failed delete stays in editor; successful confirmed delete bypasses the dirty guard once', options, async t => {
  let fail = true;
  const view = await setup(t, { response: request => request.method === 'DELETE' ? fail ? Response.json({ detail: 'offline' }, { status: 500 }) : new Response(null, { status: 204 }) : Response.json(fixture) });
  await view.loaded(); assert.equal(state(view.host), 'saved'); await edit(view.host, '미저장');
  click(cls(view.host, 'danger')); await Vue.nextTick(); assert.equal(view.modal.stack.value[0].options.props.confirmVariant, 'danger');
  const failed = rendered(() => !!all(view.host, n => n.props.role === 'alert').length); await view.modal.close(undefined, true); await failed;
  assert.equal(view.router.currentRoute.value.path, '/bible/notes/7'); assert.ok(cls(view.host, 'content-editor'));
  fail = false; click(cls(view.host, 'danger'));
  const navigated = new Promise(resolve => { const off = view.router.afterEach(to => { if (to.path === '/bible/notes') { off(); resolve(); } }); });
  await view.modal.close(undefined, true); await navigated;
  assert.equal(view.modal.stack.value.length, 0); t.mock.timers.tick(9000); assert.equal(patches().length, 0);
});

test('initial loading never flashes missing; unresolved GET has retry and a recovered note', options, async t => {
  const get = deferred(); let fail = true;
  const view = await setup(t, { response: () => fail ? get.promise : Response.json(fixture) });
  assert.ok(all(view.host, n => n.props['aria-busy'] === true).length);
  assert.equal(cls(view.host, 'empty-state'), undefined);
  const settled = rendered(() => !!cls(view.host, 'retry-btn')); get.resolve(Response.json({ detail: 'missing' }, { status: 404 })); await settled;
  assert.ok(cls(view.host, 'empty-state')); fail = false;
  const loaded = view.loaded(); click(cls(view.host, 'retry-btn')); await loaded;
  assert.equal(state(view.host), 'saved');
});

test('same-component route changes guard old drafts and fetch the new id after acceptance', options, async t => {
  const view = await setup(t, { response: request => Response.json({ ...fixture, id: Number(request.url.split('/').at(-2)), content: request.url }) });
  await view.loaded(); await edit(view.host, '미저장');
  assert.ok(view.router.currentRoute.value.matched[0].updateGuards.size > 0, 'page installs real route-update guard');
  const opened = modalOpened(view.modal); const navigation = view.router.push('/bible/notes/8'); await opened;
  const loaded = rendered(() => cls(view.host, 'content-editor')?.value?.includes('/8/')); await view.modal.close(undefined, true); await navigation; await loaded;
  assert.equal(state(view.host), 'saved'); assert.equal(runtime.calls.filter(call => call.method === 'GET').length, 2);
});

test('native unload only warns for pending work; unmount clears autosave and listener', options, async t => {
  const view = await setup(t); await view.loaded();
  assert.ok(view.listeners.has('beforeunload'));
  let prevented = 0; const event = { preventDefault: () => prevented++, returnValue: undefined };
  view.listeners.get('beforeunload')(event); assert.equal(prevented, 0);
  await edit(view.host, '미저장'); view.listeners.get('beforeunload')(event); assert.equal(prevented, 1);
  view.app.unmount(); t.mock.timers.tick(9000); assert.equal(patches().length, 0); assert.equal(view.listeners.has('beforeunload'), false);
});

test('saving blocks navigation and duplicate saves until the exact request settles', options, async t => {
  const patch = deferred();
  const view = await setup(t, { response: request => request.method === 'PATCH' ? patch.promise : Response.json(fixture) });
  await view.loaded(); assert.equal(state(view.host), 'saved'); await edit(view.host, '저장'); click(cls(view.host, 'save-btn')); await Vue.nextTick();
  assert.ok(Router.isNavigationFailure(await view.router.push('/profile'))); assert.equal(view.modal.stack.value.length, 0);
  assert.equal(cls(view.host, 'save-btn').props.disabled, true);
  const saved = rendered(() => state(view.host) === 'saved'); patch.resolve(Response.json({ ...fixture, content: '저장' })); await saved;
  assert.equal(patches().length, 1);
});

test('header back is handled once by the real memory-history exit guard', options, async t => {
  const view = await setup(t); await view.loaded(); await edit(view.host, '미저장');
  const opened = modalOpened(view.modal); click(cls(view.host, 'bible-back-btn')); await opened;
  assert.equal(view.modal.stack.value.length, 1);
  const navigated = new Promise(resolve => { const off = view.router.afterEach((to, _from, failure) => { if (!failure && to.path === '/bible/notes') { off(); resolve(); } }); });
  await view.modal.close(undefined, true); await navigated;
  assert.equal(view.modal.stack.value.length, 0); t.mock.timers.tick(9000); assert.equal(patches().length, 0);
});

test('canceling deletion preserves the draft and restores the existing 3000ms autosave', options, async t => {
  const view = await setup(t); await view.loaded(); await edit(view.host, '보존');
  click(cls(view.host, 'danger')); await Vue.nextTick();
  t.mock.timers.tick(3000); assert.equal(patches().length, 0);
  await view.modal.close(undefined, false); await Vue.nextTick();
  assert.equal(runtime.calls.filter(call => call.method === 'DELETE').length, 0);
  t.mock.timers.tick(2999); assert.equal(patches().length, 0);
  const saved = rendered(() => state(view.host) === 'saved'); t.mock.timers.tick(1); await saved;
  assert.equal(patches()[0].body.content, '보존');
});

test('invalid route ids never request an accidentally truncated note id', options, async t => {
  const view = await setup(t, { id: '7not-a-note' });
  await rendered(() => !!cls(view.host, 'empty-state'));
  assert.equal(runtime.calls.length, 0); assert.ok(cls(view.host, 'retry-btn'));
});
