import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { build } from 'esbuild';
import { compileScript, parse } from '@vue/compiler-sfc';

const require = createRequire(import.meta.url);
const Vue = require('vue');
const { createRouter, createMemoryHistory, RouterLink } = require('vue-router');
const { createPinia } = require('pinia');
const appDir = fileURLToPath(new URL('../app/', import.meta.url));
let active;
// Real board/page/composable, typed HTTP facade, modal state, form directives,
// AppButton/ListCard/FilterChip run. Only HTTP/auth and unrelated shell/calendar
// hosts are boundaries; no browser/layout claim.
const bundle = await build({
  stdin: { contents: `export { default as Board } from './components/groups/GroupBoard.vue'; export { default as Page } from './pages/groups/[id].vue';`, resolveDir: appDir, loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
  external: ['vue', 'vue-router', 'pinia', '@lucide/vue', '#components', '#app'],
  define: { 'import.meta.server': 'false', 'import.meta.client': 'true' },
  plugins: [{ name: 'group-board-runtime', setup(builder) {
    builder.onResolve({ filter: /^~\/composables\/useApi$/ }, () => ({ path: 'observed-api', namespace: 'observed-api' }));
    builder.onLoad({ filter: /.*/, namespace: 'observed-api' }, () => ({
      contents: `import { useApi as actual } from ${JSON.stringify(resolve(appDir, 'composables/useApi.ts'))};
        export function useApi() {
          const api = actual();
          return { ...api, GET(...args) {
            const result = api.GET(...args);
            globalThis.__boardApiJobs.push(result);
            return result;
          } };
        }`, loader: 'ts', resolveDir: appDir,
    }));
    builder.onResolve({ filter: /(?:useAuthService|useFocusTrap|useScrollLock)$/ }, ({ path }) => ({ path, external: true }));
    builder.onResolve({ filter: /(?:PageLayout|GroupPlanCalendar|BottomSheet)\.vue$/ }, ({ path }) => ({ path, namespace: 'host' }));
    builder.onLoad({ filter: /.*/, namespace: 'host' }, ({ path }) => ({ contents: `import { defineComponent, h } from 'vue'; export default defineComponent({ props: ['modelValue'], setup: (props, { slots }) => () => ${path.endsWith('BottomSheet.vue') ? 'null' : "h('div', {}, slots.default?.())"} });`, loader: 'ts' }));
    builder.onResolve({ filter: /^~\// }, ({ path }) => ({ path: resolve(appDir, path.slice(2) + (path.endsWith('.vue') ? '' : '.ts')) }));
    builder.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
      const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path });
      assert.deepEqual(errors, []);
      return { contents: compileScript(descriptor, { id: path, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } }).content, loader: 'ts', resolveDir: dirname(path) };
    });
  } }],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(name => {
  if (name === '#app') return { useRuntimeConfig: () => active.config };
  if (name === '#components') return { NuxtLink: RouterLink };
  if (name.endsWith('/useAuthService')) return { useAuthService: () => active.auth };
  if (name.endsWith('/useFocusTrap')) return { useFocusTrap: () => ({ isTopmost: Vue.ref(true), zIndex: Vue.ref(100) }) };
  if (name.endsWith('/useScrollLock')) return { useScrollLock() {} };
  return require(name);
}, module, module.exports);
const { Board, Page } = module.exports;
const observers = new Set();
function changed() { for (const observer of [...observers]) queueMicrotask(observer); }
class Element {
  constructor(tag, text = '') { Vue.markRaw(this); this.tag = tag; this.text = text; this.props = {}; this.children = []; this.parentNode = null; this.style = {}; this.listeners = new Map(); this.value = ''; }
  get tagName() { return this.tag.toUpperCase(); }
  get type() { return this.props.type; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  all(predicate) { return this.children.flatMap(child => [...(predicate(child) ? [child] : []), ...child.all(predicate)]); }
  addEventListener(name, listener) { this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]); }
  removeEventListener(name, listener) { this.listeners.set(name, (this.listeners.get(name) ?? []).filter(fn => fn !== listener)); }
  dispatchEvent(event) { for (const fn of this.listeners.get(event.type) ?? []) fn({ target: this, ...event }); }
}
function detach(node) { if (node.parentNode) node.parentNode.children.splice(node.parentNode.children.indexOf(node), 1); node.parentNode = null; }
const renderer = Vue.createRenderer({
  createElement: tag => new Element(tag), createText: text => new Element('#text', text), createComment: () => new Element('#comment'),
  setText(node, text) { node.text = text; changed(); }, setElementText(node, text) { node.text = text; node.children = []; changed(); },
  patchProp(node, key, old, value) { node.props[key] = value; if (key === 'value') node.value = value; changed(); },
  insert(node, parent, anchor = null) { detach(node); parent.children.splice(anchor ? parent.children.indexOf(anchor) : parent.children.length, 0, node); node.parentNode = parent; changed(); },
  remove(node) { detach(node); changed(); }, parentNode: node => node.parentNode,
  nextSibling: node => node.parentNode?.children[node.parentNode.children.indexOf(node) + 1] ?? null,
  setScopeId() {}, insertStaticContent() { throw new Error('Unexpected static HTML'); },
});
async function observe(predicate, action = () => {}) {
  const signal = AbortSignal.timeout(2500);
  await new Promise((resolve, reject) => {
    const clean = () => { observers.delete(check); signal.removeEventListener('abort', abort); };
    const check = () => { if (predicate()) { clean(); resolve(); } };
    const abort = () => { clean(); reject(new Error(`Expected board state was not observed: ${predicate}`)); };
    observers.add(check); signal.addEventListener('abort', abort, { once: true });
    action(); check();
  });
  await Vue.nextTick();
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { resolve, reject, promise }; };
const base = '/api/v1/todos/groups/7/posts/';
const fixture = (id = 1, extra = {}) => ({
  id, group_id: 7, title: `post-${id}`, content: `body-${id}`, author: { id: 90, nickname: 'author' },
  created_at: '2026-10-19T12:00:00', updated_at: '2026-10-19T12:00:00', can_edit: true, can_delete: true, ...extra,
});
const failure = status => new Response(JSON.stringify({ success: false, error: 'denied', errors: { title: ['server-validation'] } }), { status });
const options = { timeout: 8000 };
async function setup(t, opts = {}) {
  const root = new Element('root'), calls = [], states = new Map(), jobs = [];
  let app;
  t.after(() => { app?.unmount(); observers.clear(); });
  const auth = {
    user: Vue.ref({ id: 90 }), isAuthenticated: Vue.ref(opts.guest !== true),
    isInitialized: Vue.ref(!opts.pendingAuth), isLoading: Vue.ref(!!opts.pendingAuth), isSessionUnknown: Vue.ref(!!opts.offline),
    initialize: opts.initialize ?? (async () => {}),
    revalidate: async () => { auth.isSessionUnknown.value = false; },
    refreshToken: async () => ({ ok: false, reason: 'unreachable' }), logout() {},
  };
  const rows = new Map((opts.rows ?? [fixture()]).map(post => [post.id, post]));
  const handlers = { ...opts.handlers };
  const storage = new Map();
  let id = 100;
  active = { auth, config: { public: { apiBase: 'https://api.test', csrfCookieName: 'csrftoken' } } };
  for (const [key, value] of Object.entries({
    document: { cookie: 'csrftoken=test-csrf', getElementById: () => null }, window: {},
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    __boardApiJobs: jobs,
    useState: (key, init) => { if (!states.has(key)) states.set(key, Vue.ref(init())); return states.get(key); },
    navigateTo: url => router.push(url),
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    t.after(() => original ? Object.defineProperty(globalThis, key, original) : delete globalThis[key]);
  }
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const url = new URL(input), method = init.method ?? 'GET';
    const call = { path: url.pathname, query: Object.fromEntries(url.searchParams), method, body: init.body ? JSON.parse(init.body) : null, headers: init.headers, credentials: init.credentials };
    calls.push(call); changed();
    const handler = handlers[`${method} ${url.pathname}`];
    let result;
    if (handler) result = await handler(call);
    else if (/\/groups\/\d+\/$/.test(url.pathname)) {
      result = { success: true, group: { id: Number(url.pathname.split('/').at(-2)), name: 'group', description: '', creator: { id: 90, nickname: 'owner' }, plans: [], is_member: opts.member !== false, member_count: 1, max_members: 20, is_public: true } };
    } else if (url.pathname.endsWith('/members/')) result = { success: true, members: [] };
    else if (url.pathname === base && method === 'GET') {
      const page = Number(url.searchParams.get('page'));
      assert.equal(url.searchParams.get('page_size'), '20');
      assert.ok(Number.isInteger(page) && page >= 1);
      const items = [...rows.values()];
      result = { success: true, count: items.length, next: items.length > page * 20 ? `${base}?page=${page + 1}` : null, previous: page > 1 ? `${base}?page=${page - 1}` : null, posts: items.slice((page - 1) * 20, page * 20) };
    } else if (url.pathname === base && method === 'POST') {
      const post = fixture(++id, call.body); rows.set(post.id, post); result = { success: true, post };
    } else if (url.pathname.startsWith(base)) {
      const postId = Number(url.pathname.slice(base.length).split('/')[0]);
      const post = rows.get(postId);
      assert.ok(post, `Unexpected post ${postId}`);
      if (method === 'PATCH') Object.assign(post, call.body, { updated_at: '2026-10-19T13:00:00' });
      if (method === 'DELETE') rows.delete(postId);
      result = { success: true, post };
    } else throw new Error(`Unexpected request ${method} ${url.pathname}`);
    return result instanceof Response ? result : new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  });
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/groups/:id', component: { render: () => null } },
    { path: '/:pathMatch(.*)*', component: { render: () => null } },
  ] });
  await router.push(opts.url ?? '/groups/7?tab=board'); await router.isReady();
  const props = Vue.reactive({ groupId: 7, member: opts.member ?? true });
  app = renderer.createApp({ setup: () => () => Vue.h(opts.page ? Page : Board, opts.page ? {} : props) });
  app.use(router); app.use(createPinia());
  app.component('NuxtImg', { setup: (_, { attrs }) => () => Vue.h('img', attrs) });
  const find = (key, value) => root.all(node => value === undefined ? node.props[key] !== undefined : String(node.props[key]) === String(value))[0];
  const action = name => find('data-action', `board-${name}`);
  const view = { root, calls, jobs, states, rows, handlers, auth, props, router, app, find, action, mount: () => app.mount(root) };
  return view;
}
async function mounted(t, opts) {
  const view = await setup(t, opts);
  await observe(() => !!view.action('create') && !view.find('data-board-loading'), view.mount);
  return view;
}
function activate(node) {
  assert.ok(node, 'Rendered control exists');
  assert.equal(!!node.props.disabled, false, 'Rendered control enabled');
  const event = { preventDefault() {}, stopImmediatePropagation() {}, stopPropagation() {} };
  node.props.onClickCapture?.(event);
  return node.props.onClick?.(event);
}
async function click(node) { activate(node); await Vue.nextTick(); }
async function input(view, name, value) {
  const node = view.find('name', name); assert.ok(node);
  node.value = value; node.dispatchEvent({ type: 'input' }); await Vue.nextTick();
}
function submit(view) { return view.action('form').props.onSubmit({ preventDefault() {} }); }
async function open(view, id = 1) {
  await observe(() => !!view.find('data-board-post', id), () => activate(view.find('data-post-id', id)));
}
async function editor(view, create = true) {
  await click(view.action(create ? 'create' : 'edit'));
  assert.ok(view.action('form'));
}
async function tab(view, name) {
  const changedRoute = new Promise(resolve => {
    const stop = view.router.afterEach(to => {
      if (to.query.tab === name) { stop(); resolve(); }
    });
  });
  await click(view.find('id', `group-tab-${name}`));
  await changedRoute;
  await Vue.nextTick();
}
function confirm(view, accepted) {
  const stack = view.states.get('modal-stack');
  assert.equal(stack.value.length, 1);
  assert.equal(stack.value[0].options.props.confirmVariant, 'danger');
  stack.value[0].resolve(accepted); stack.value = [];
}

test('native return protects a dirty board draft and removes the guard on unmount', options, async t => {
  const view = await mounted(t);
  assert.equal(await window.__maeilConfirmNativeReturn(), true);
  await editor(view);
  await input(view, 'title', 'unsaved fixture');
  let closing;
  await observe(() => view.states.get('modal-stack')?.value.length === 1, () => {
    closing = window.__maeilConfirmNativeReturn();
  });
  confirm(view, false);
  assert.equal(await closing, false);
  assert.equal(view.find('name', 'title').value, 'unsaved fixture');
  await observe(() => view.states.get('modal-stack')?.value.length === 1, () => {
    closing = window.__maeilConfirmNativeReturn();
  });
  confirm(view, true);
  assert.equal(await closing, true);
  view.app.unmount();
  assert.equal(window.__maeilConfirmNativeReturn, undefined);
});

test('list uses real facade, fixed bounded pages and no disabled-page requests', options, async t => {
  const view = await mounted(t, { rows: Array.from({ length: 21 }, (_, i) => fixture(i + 1)) });
  assert.equal(view.root.all(n => n.props['data-post-id'] !== undefined).length, 20);
  assert.equal(view.action('previous').props.disabled, true);
  // Even a direct stale event cannot bypass pagination guards.
  view.action('previous').props.onClick({}); await Vue.nextTick();
  assert.equal(view.calls.length, 1);
  await observe(() => !!view.find('data-post-id', 21), () => activate(view.action('next')));
  assert.deepEqual(view.calls.at(-1).query, { page: '2', page_size: '20' });
  assert.equal(view.action('next').props.disabled, true);
  await observe(() => !!view.find('data-post-id', 1), () => activate(view.action('previous')));
  assert.equal(view.calls.at(-1).query.page, '1');
  assert.ok(view.calls.every(call => call.credentials === 'include'));
});
test('pending and empty are distinct and empty list can enter create', options, async t => {
  const pending = deferred();
  const view = await setup(t, { handlers: { [`GET ${base}`]: () => pending.promise } });
  await observe(() => !!view.find('data-board-loading'), view.mount);
  assert.equal(view.find('data-board-empty'), undefined);
  await observe(() => !!view.find('data-board-empty'), () => pending.resolve({ success: true, count: 0, next: null, previous: null, posts: [] }));
  await editor(view);
});
test('mounted create validates fields, trims payload and reads acknowledged post', options, async t => {
  const view = await mounted(t); await editor(view);
  await submit(view); await Vue.nextTick();
  assert.equal(view.find('name', 'title').props['aria-invalid'], true);
  assert.equal(view.find('name', 'content').props['aria-invalid'], true);
  await input(view, 'title', 'x'.repeat(201)); await input(view, 'content', 'x'.repeat(10001));
  await submit(view); await Vue.nextTick();
  assert.equal(view.calls.filter(c => c.method === 'POST').length, 0);
  await input(view, 'title', ' new title '); await input(view, 'content', ' new body ');
  await observe(() => !!view.find('data-board-post', 101), () => submit(view));
  const call = view.calls.find(c => c.method === 'POST');
  assert.deepEqual(call.body, { title: 'new title', content: 'new body' });
  assert.equal(call.headers['X-CSRFToken'], 'test-csrf');
  assert.ok(view.rows.has(101));
  await observe(() => !!view.find('data-post-id', 101), () => activate(view.action('list')));
  await open(view, 101);
  assert.equal(view.calls.at(-1).path, `${base}101/`);
});
test('detail renders markup literally and author edit PATCH uses selected id', options, async t => {
  const content = '<img src=x onerror=alert(1)>\nplain text';
  const view = await mounted(t, { rows: [fixture(1, { content })] });
  await open(view);
  assert.equal(view.find('data-post-content').textContent, content);
  assert.equal(view.root.all(n => n.tag === 'img').length, 0);
  assert.equal(view.root.all(n => n.props.innerHTML !== undefined).length, 0);
  await editor(view, false);
  assert.equal(view.find('name', 'content').value, content);
  await input(view, 'title', 'changed'); await input(view, 'content', 'changed body');
  await observe(() => !!view.find('data-board-post', 1), () => submit(view));
  assert.equal(view.rows.get(1).title, 'changed');
  assert.deepEqual(view.calls.find(c => c.method === 'PATCH').body, { title: 'changed', content: 'changed body' });
  assert.equal(view.calls.find(c => c.method === 'PATCH').path, `${base}1/`);
});
test('delete cancellation sends nothing and confirmation deletes then reloads valid list', options, async t => {
  const view = await mounted(t); await open(view);
  const deleteButton = view.action('delete');
  await click(deleteButton);
  deleteButton.props.onClick({});
  assert.equal(view.states.get('modal-stack').value.length, 1);
  assert.equal(view.calls.some(c => c.method === 'DELETE'), false);
  await observe(() => !view.action('delete').props.disabled, () => confirm(view, false));
  assert.ok(view.find('data-board-post', 1));
  await click(view.action('delete'));
  await observe(() => !!view.find('data-board-empty'), () => confirm(view, true));
  assert.equal(view.calls.filter(c => c.method === 'DELETE').length, 1);
  assert.equal(view.calls.find(c => c.method === 'DELETE').path, `${base}1/`);
  assert.equal(view.rows.size, 0);
  assert.equal(view.calls.at(-1).query.page, '1');
});
test('server capabilities hide edit for admin, keep admin delete, and hide both for reader', options, async t => {
  const view = await mounted(t, { rows: [fixture(1, { can_edit: false, can_delete: true }), fixture(2, { can_edit: false, can_delete: false })] });
  await open(view); assert.equal(view.action('edit'), undefined); assert.ok(view.action('delete'));
  await observe(() => !!view.find('data-post-id', 2), () => activate(view.action('list')));
  await open(view, 2); assert.equal(view.action('edit'), undefined); assert.equal(view.action('delete'), undefined);
});
for (const [state, opts] of [['login', { guest: true }], ['denied', { member: false }], ['offline', { offline: true }]]) {
  test(`${state} state makes no member requests`, options, async t => {
    const view = await setup(t, opts); await observe(() => !!view.find('data-board-access', state), view.mount);
    assert.equal(view.calls.length, 0); assert.equal(view.action('create'), undefined);
    if (state === 'login') {
      const href = view.action('login').props.href;
      assert.equal(new URL(href, 'https://example.test').searchParams.get('redirect'), '/groups/7?tab=board');
    }
  });
}
for (const status of [401, 403, 404, 500]) {
  test(`list HTTP ${status} has explicit failure and a recovery path`, options, async t => {
    const view = await setup(t, { handlers: { [`GET ${base}`]: () => failure(status) } });
    await observe(() => !!view.find('data-board-failure'), view.mount);
    assert.equal(view.find('data-board-failure').props['data-board-failure'], status === 401 ? 'login' : status === 403 ? 'denied' : status === 404 ? 'missing' : 'error');
    assert.equal(view.find('data-board-empty'), undefined);
    assert.equal(view.action('create'), undefined);
    if (status === 401) assert.ok(view.action('login'));
    else {
      delete view.handlers[`GET ${base}`];
      await observe(() => !!view.find('data-post-id', 1), () => activate(view.action('retry')));
    }
  });
}
test('detail missing state returns to list rather than exposing cached content', options, async t => {
  const view = await mounted(t, { handlers: { [`GET ${base}1/`]: () => failure(404) } });
  await observe(() => !!view.find('data-board-failure', 'missing'), () => activate(view.find('data-post-id', 1)));
  assert.equal(view.find('data-board-post'), undefined);
  await observe(() => !!view.find('data-post-id', 1), () => activate(view.action('list')));
});
for (const method of ['POST', 'PATCH']) test(`${method} failed save retains draft, maps server validation, blocks duplicates and retries`, options, async t => {
  const pending = deferred();
  const path = method === 'POST' ? base : `${base}1/`;
  const view = await mounted(t, { handlers: { [`${method} ${path}`]: () => pending.promise } });
  if (method === 'PATCH') await open(view);
  await editor(view, method === 'POST');
  await input(view, 'title', 'retained'); await input(view, 'content', 'retained body');
  const job = submit(view); await submit(view);
  assert.equal(view.calls.filter(c => c.method === method).length, 1);
  assert.equal(view.action('cancel').props.disabled, true);
  await observe(() => !!view.find('data-board-failure'), () => pending.resolve(failure(400)));
  await job;
  assert.equal(view.find('name', 'title').value, 'retained');
  assert.equal(view.find('name', 'content').value, 'retained body');
  assert.equal(view.find('name', 'title').props['aria-invalid'], true);
  delete view.handlers[`${method} ${path}`];
  await observe(() => !!view.find('data-board-post'), () => submit(view));
  assert.equal(view.calls.filter(c => c.method === method).length, 2);
});
test('server denied edit remains authoritative and never reports saved post', options, async t => {
  const view = await mounted(t, { handlers: { [`PATCH ${base}1/`]: () => failure(403) } });
  await open(view); await editor(view, false); await input(view, 'title', 'denied edit');
  await observe(() => !!view.find('data-board-failure', 'denied'), () => submit(view));
  assert.equal(view.find('data-board-post'), undefined);
  assert.equal(view.find('name', 'title').value, 'denied edit');
  assert.equal(view.rows.get(1).title, 'post-1');
});
test('delete failure preserves existing post and permits explicit retry', options, async t => {
  const view = await mounted(t, { handlers: { [`DELETE ${base}1/`]: () => failure(500) } });
  await open(view); await click(view.action('delete'));
  await observe(() => !!view.find('data-board-failure', 'error'), () => confirm(view, true));
  assert.ok(view.find('data-board-post', 1)); assert.ok(view.rows.has(1));
  delete view.handlers[`DELETE ${base}1/`];
  await click(view.action('delete'));
  await observe(() => !!view.find('data-board-empty'), () => confirm(view, true));
});
test('pending initialization does not become guest or issue requests early', options, async t => {
  const init = deferred();
  const view = await setup(t, { pendingAuth: true, initialize: () => init.promise });
  await observe(() => !!view.find('data-board-access', 'loading'), view.mount);
  assert.equal(view.calls.length, 0); assert.equal(view.action('login'), undefined);
  await observe(() => !!view.find('data-post-id', 1), () => {
    view.auth.isLoading.value = false; view.auth.isInitialized.value = true; init.resolve();
  });
  assert.equal(view.calls.length, 1);
});
test('offline session revalidation resumes member list without a login redirect', options, async t => {
  const view = await setup(t, { offline: true });
  await observe(() => !!view.action('auth-retry'), view.mount);
  await observe(() => !!view.find('data-post-id', 1), () => activate(view.action('auth-retry')));
  assert.equal(view.action('login'), undefined);
});
test('out of range page has first-page recovery and never follows server URLs', options, async t => {
  const view = await mounted(t, { rows: Array.from({ length: 21 }, (_, i) => fixture(i + 1)) });
  view.handlers[`GET ${base}`] = call => call.query.page === '2' ? failure(404)
    : { success: true, count: 1, next: null, previous: null, posts: [fixture(1)] };
  await observe(() => !!view.action('first'), () => activate(view.action('next')));
  assert.equal(view.find('data-board-empty'), undefined);
  await observe(() => !!view.find('data-post-id', 1), () => activate(view.action('first')));
  assert.equal(view.calls.at(-1).query.page, '1');
});
test('logout clears private detail and old read cannot restore it', options, async t => {
  const old = deferred();
  const view = await mounted(t, { handlers: { [`GET ${base}1/`]: () => old.promise } });
  await click(view.find('data-post-id', 1));
  const oldRead = view.jobs.at(-1);
  await observe(() => !!view.action('login'), () => { view.auth.isAuthenticated.value = false; });
  old.resolve({ success: true, post: fixture(1, { content: 'PRIVATE_OLD_CONTENT' }) });
  await oldRead; await Vue.nextTick();
  assert.equal(view.find('data-board-post'), undefined);
  assert.equal(view.root.textContent.includes('PRIVATE_OLD_CONTENT'), false);
});
test('old account list reply cannot repopulate a new owner board', options, async t => {
  const old = deferred();
  const view = await setup(t, { handlers: { [`GET ${base}`]: () => old.promise } });
  await observe(() => view.calls.length === 1, view.mount);
  const oldRead = view.jobs[0];
  view.handlers[`GET ${base}`] = () => ({ success: true, count: 1, next: null, previous: null, posts: [fixture(9)] });
  await observe(() => !!view.find('data-post-id', 9), () => { view.auth.user.value = { id: 91 }; });
  old.resolve({ success: true, count: 1, next: null, previous: null, posts: [fixture(1)] });
  await oldRead; await Vue.nextTick();
  assert.equal(view.find('data-post-id', 1), undefined);
});
test('old group detail response cannot replace the new group list', options, async t => {
  const old = deferred();
  const view = await mounted(t, { handlers: {
    [`GET ${base}1/`]: () => old.promise,
    'GET /api/v1/todos/groups/8/posts/': () => ({ success: true, count: 1, next: null, previous: null, posts: [fixture(8, { group_id: 8 })] }),
  } });
  await click(view.find('data-post-id', 1));
  const oldRead = view.jobs.at(-1);
  await observe(() => !!view.find('data-post-id', 8), () => { view.props.groupId = 8; });
  old.resolve({ success: true, post: fixture(1) }); await oldRead; await Vue.nextTick();
  assert.equal(view.find('data-board-post'), undefined);
  assert.ok(view.find('data-post-id', 8));
});
test('account change clears editor and ignores old save acknowledgement', options, async t => {
  const pending = deferred();
  const view = await mounted(t, { handlers: { [`POST ${base}`]: () => pending.promise } });
  await editor(view); await input(view, 'title', 'private draft'); await input(view, 'content', 'private body');
  const job = submit(view);
  await observe(() => !!view.find('data-post-id', 1), () => { view.auth.user.value = { id: 91 }; });
  pending.resolve({ success: true, post: fixture(101) }); await job; await Vue.nextTick();
  assert.equal(view.action('form'), undefined); assert.equal(view.find('data-board-post'), undefined);
  assert.equal(view.root.textContent.includes('private draft'), false);
});
test('owner change during delete confirmation prevents any delete request', options, async t => {
  const view = await mounted(t); await open(view); await click(view.action('delete'));
  await observe(() => !!view.find('data-post-id', 1), () => { view.auth.user.value = { id: 91 }; });
  confirm(view, true); await Vue.nextTick();
  assert.equal(view.calls.some(c => c.method === 'DELETE'), false);
});
test('actual group page consumes board query and preserves draft across member/calendar tabs', options, async t => {
  const view = await mounted(t, { page: true });
  assert.equal(view.find('id', 'group-tab-board').props['aria-selected'], true);
  await editor(view); await input(view, 'title', 'tab draft');
  await tab(view, 'info');
  await tab(view, 'calendar');
  await tab(view, 'board');
  assert.equal(view.find('name', 'title').value, 'tab draft');
});
test('private group page denial still offers login with the exact board destination', options, async t => {
  const view = await setup(t, { page: true, guest: true, handlers: { 'GET /api/v1/todos/groups/7/': () => failure(401) } });
  await observe(() => !!view.action('login'), view.mount);
  assert.equal(new URL(view.action('login').props.href, 'https://web.test').searchParams.get('redirect'), '/groups/7?tab=board');
  assert.equal(view.calls.some(c => c.path === base), false);
});
test('invalid group route never requests NaN or mounts a board', options, async t => {
  const view = await setup(t, { page: true, url: '/groups/invalid?tab=board' });
  await observe(() => view.root.all(n => n.props.role === 'alert').length > 0, view.mount);
  assert.equal(view.calls.length, 0);
  assert.equal(view.find('data-board-view'), undefined);
});
test('leaving the group route never starts a request for a removed route parameter', options, async t => {
  const view = await mounted(t, { page: true });
  const before = view.calls.length;
  await view.router.push('/groups');
  await Vue.nextTick();
  assert.equal(view.calls.length, before);
  assert.equal(view.find('data-board-view'), undefined);
});
test('group page ignores delayed old group metadata after route change', options, async t => {
  const old = deferred();
  const view = await setup(t, { page: true, handlers: {
    'GET /api/v1/todos/groups/7/': () => old.promise,
    'GET /api/v1/todos/groups/8/posts/': () => ({ success: true, count: 0, next: null, previous: null, posts: [] }),
  } });
  await observe(() => view.calls.length > 0, view.mount);
  const oldRead = view.jobs[0];
  await observe(() => !!view.find('data-board-empty'), () => { void view.router.push('/groups/8?tab=board'); });
  old.resolve({ success: true, group: { id: 7, name: 'OLD_GROUP_SENTINEL', plans: [], is_member: true } });
  await oldRead; await Vue.nextTick();
  assert.equal(view.root.textContent.includes('OLD_GROUP_SENTINEL'), false);
  assert.equal(view.calls.some(c => c.path === base), false);
});
