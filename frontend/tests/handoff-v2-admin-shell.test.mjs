import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { build } from 'esbuild';
import { compileScript, compileStyle, parse } from '@vue/compiler-sfc';

const require = createRequire(import.meta.url);
const Vue = require('vue');
const { createRouter, createMemoryHistory, RouterLink } = require('vue-router');
const { renderToString } = require('@vue/server-renderer');
const appDir = fileURLToPath(new URL('../app/', import.meta.url));
const shellPath = resolve(appDir, 'components/admin/AdminConsoleLayout.vue');

// Only Nuxt runtime globals and HTTP are supplied by the harness. The shell,
// auth service, auth refresh policy, Vue scheduler, router and UI atoms are real.
async function loadRuntime({ server = false } = {}) {
  const result = await build({
    stdin: { contents: `export { default as Shell } from './components/admin/AdminConsoleLayout.vue'; export { useAuthService } from './composables/useAuthService';`, resolveDir: appDir, loader: 'ts' },
    bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
    define: { 'import.meta.client': String(!server), 'import.meta.server': String(server) },
    external: ['vue', 'vue-router', '@lucide/vue', '#components', '#imports', 'nuxt/app', '~/stores/*'],
    plugins: [{ name: 'admin-shell-sfc', setup(builder) {
      builder.onResolve({ filter: /^~\// }, ({ path }) => path.startsWith('~/stores/')
        ? { path, external: true }
        : { path: resolve(appDir, path.slice(2) + (path.endsWith('.vue') ? '' : '.ts')) });
      builder.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
        const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path });
        assert.deepEqual(errors, []);
        return { contents: compileScript(descriptor, { id: path, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } }).content, loader: 'ts', resolveDir: dirname(path) };
      });
    } }],
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(name => {
    if (name === '#components') return { NuxtLink: RouterLink };
    if (name === '#imports' || name === 'nuxt/app') return { useState: globalThis.useState, useRuntimeConfig: globalThis.useRuntimeConfig };
    return require(name);
  }, module, module.exports);
  return module.exports;
}

class Element {
  constructor(tag, text = '') { this.tag = tag; this.text = text; this.props = {}; this.children = []; this.parent = null; this.observers = new Set(); }
  get textContent() { return this.text + this.children.map(node => node.textContent).join(''); }
  all(predicate) { return this.children.flatMap(node => [...(predicate(node) ? [node] : []), ...node.all(predicate)]); }
  find(predicate) { return this.all(predicate)[0]; }
}
const detach = node => { if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1); node.parent = null; };
const renderer = Vue.createRenderer({
  createElement: tag => new Element(tag), createText: text => new Element('#text', text), createComment: () => new Element('#comment'),
  setText(node, text) { node.text = text; }, setElementText(node, text) { node.text = text; node.children = []; },
  patchProp(node, key, old, value) { node.props[key] = value; for (const observe of node.observers) observe(key, old, value); },
  insert(node, parent, anchor = null) { detach(node); parent.children.splice(anchor ? parent.children.indexOf(anchor) : parent.children.length, 0, node); node.parent = parent; },
  remove: detach, parentNode: node => node.parent, nextSibling: node => node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null,
  setScopeId() {}, insertStaticContent() { throw new Error('Static HTML must be compiled into VNodes for the test renderer'); },
});
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
const staff = { id: 17, username: 'admin-fixture', nickname: 'VerifiedOperator', email: 'operator@example.test', is_staff: true };
const member = { ...staff, id: 18, nickname: 'MemberFixture', is_staff: false };
const options = { timeout: 5000 };

async function environment(t, { cached, server = false } = {}) {
  const states = new Map(), storage = new Map(), requests = [], responseQueue = [], timers = new Set();
  if (cached) storage.set('auth', JSON.stringify({ user: cached }));
  const runtimeConfig = () => ({ public: { apiBase: 'https://api.example.test' } });
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    const request = { path: new URL(url).pathname, method: init.method, credentials: init.credentials };
    requests.push(request);
    const next = responseQueue.shift();
    assert.ok(next, `Unexpected HTTP request: ${request.method} ${request.path}`);
    assert.equal(request.path, next.path);
    const outcome = await next.result.promise;
    if (outcome instanceof Error) throw outcome;
    return new Response(JSON.stringify(outcome.body), { status: outcome.status, headers: { 'Content-Type': 'application/json' } });
  });
  // Auth's periodic refresh is unrelated to this behavior. Record ownership and
  // cleanup instead of letting a real interval keep the test process alive.
  t.mock.method(globalThis, 'setInterval', fn => { timers.add(fn); return fn; });
  t.mock.method(globalThis, 'clearInterval', fn => timers.delete(fn));
  const globals = {
    useState(key, init) { if (!states.has(key)) states.set(key, Vue.ref(init())); return states.get(key); },
    useRuntimeConfig: runtimeConfig,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    window: { addEventListener() {} },
    document: { cookie: '', hidden: false, addEventListener() {} },
  };
  for (const [key, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]);
  }
  const runtime = await loadRuntime({ server });
  const auth = runtime.useAuthService();
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] });
  await router.push('/admin/members?q=reader#row-17');
  await router.isReady();
  const props = Vue.reactive({ title: 'Fixture console' });
  const calls = { default: 0, title: 0, actions: 0 }, setups = { default: 0, title: 0, actions: 0 }, unmounts = { default: 0, title: 0, actions: 0 };
  const slotRequests = [];
  function slot(name) {
    const Probe = { setup() {
      setups[name]++;
      // A data-owning child starts its staff request at setup, not just mount.
      slotRequests.push({ name, userId: auth.user.value?.id, initialized: auth.isInitialized.value, authenticated: auth.isAuthenticated.value, staff: auth.isStaff.value });
      Vue.onUnmounted(() => unmounts[name]++);
      return () => Vue.h('span', { 'data-probe': name }, `fixture-${name}`);
    } };
    return () => { calls[name]++; return Vue.h(Probe); };
  }
  const Consumer = { setup() {
    const slots = { default: slot('default'), title: slot('title'), actions: slot('actions') };
    return () => Vue.h(runtime.Shell, props, slots);
  } };
  const root = new Element('root');
  let app;
  function mount() {
    app = renderer.createApp(Consumer); app.use(router); app.mount(root);
    t.after(() => app.unmount());
  }
  function queue(path, body, status = 200) {
    const result = deferred(); responseQueue.push({ path, result });
    if (body !== undefined) result.resolve({ body, status });
    return { respond: (body, status = 200) => result.resolve({ body, status }), offline: () => result.resolve(new TypeError('fixture offline')) };
  }
  const state = () => root.find(node => node.props['data-admin-state'])?.props['data-admin-state'];
  const emptySlots = () => { assert.deepEqual(calls, { default: 0, title: 0, actions: 0 }); assert.deepEqual(slotRequests, []); };
  async function initialize(response, body, status = 200) {
    const done = auth.initialize();
    response.respond(body, status);
    await done; await Vue.nextTick();
  }
  return { ...runtime, auth, router, props, root, Consumer, mount, queue, requests, storage, timers, calls, setups, unmounts, slotRequests, state, emptySlots, initialize };
}

const userPath = '/api/v1/auth/user/';
const refreshPath = '/api/v1/auth/token/refresh/';
const logoutPath = '/api/v1/auth/logout/';
const stateSettled = (auth, expected) => new Promise(resolve => {
  const stop = Vue.watch(auth.authState, value => { if (value === expected) { stop(); resolve(); } }, { flush: 'post' });
});

test('cached staff never evaluates any slot until real auth initialization confirms staff', options, async t => {
  const view = await environment(t, { cached: staff });
  const response = view.queue(userPath); view.mount();
  assert.equal(view.state(), 'loading'); assert.equal(view.auth.user.value.is_staff, true);
  view.emptySlots();
  assert.equal(view.root.find(node => node.props.href === '/profile/17'), undefined);
  await view.initialize(response, staff);
  assert.equal(view.state(), 'staff');
  assert.deepEqual(view.setups, { default: 1, title: 1, actions: 1 });
  assert.ok(view.slotRequests.every(request => request.initialized && request.authenticated && request.staff && request.userId === 17));
  assert.deepEqual(view.requests.map(request => request.path), [userPath]);
  assert.ok(view.requests.every(request => request.credentials === 'include'));
});

test('authenticated identity obtained before initialization still cannot mount any slot', options, async t => {
  const view = await environment(t);
  const user = view.queue(userPath);
  const fetched = view.auth.fetchUser(); user.respond(staff); await fetched;
  assert.equal(view.auth.isAuthenticated.value, true); assert.equal(view.auth.isInitialized.value, false);
  const initialization = view.queue(userPath); view.mount(); view.emptySlots();
  assert.equal(view.state(), 'loading');
  await view.initialize(initialization, staff);
  assert.equal(view.state(), 'staff'); assert.deepEqual(view.setups, { default: 1, title: 1, actions: 1 });
});

test('guest sees preserved-return login; no consumer slot is called or mounted', options, async t => {
  const view = await environment(t);
  const response = view.queue(userPath); view.mount(); view.emptySlots();
  await view.initialize(response, {}, 401);
  assert.equal(view.state(), 'guest'); view.emptySlots();
  const login = view.root.find(node => typeof node.props.href === 'string' && node.props.href.startsWith('/login?'));
  assert.ok(login);
  assert.equal(new URL(login.props.href, 'https://site.example.test').searchParams.get('redirect'), '/admin/members?q=reader#row-17');
  const navigation = new Promise(resolve => { const remove = view.router.afterEach(to => { if (to.path === '/login') { remove(); resolve(to); } }); });
  const event = { button: 0, preventDefault() {}, currentTarget: { getAttribute() { return null; } } };
  login.props.onClickCapture(event);
  for (const listener of [login.props.onClick].flat()) await listener(event);
  assert.equal((await navigation).query.redirect, '/admin/members?q=reader#row-17');
});

test('verified nonstaff overrides cached staff and cannot mount staff children', options, async t => {
  const view = await environment(t, { cached: staff });
  const response = view.queue(userPath); view.mount();
  await view.initialize(response, member);
  assert.equal(view.state(), 'denied'); view.emptySlots();
  assert.ok(view.root.find(node => node.props.role === 'alert'));
  assert.equal(view.root.find(node => node.tag === 'nav'), undefined);
  assert.equal(view.root.find(node => node.props.href?.startsWith('/login')), undefined);
});

test('missing staff flag is denied, not inferred from username or a cached administrator', options, async t => {
  const view = await environment(t, { cached: staff });
  const response = view.queue(userPath); view.mount();
  const { is_staff, ...withoutRole } = staff;
  await view.initialize(response, withoutRole);
  assert.equal(view.state(), 'denied'); view.emptySlots();
});

test('offline cached staff retains session but gates slots; retry is serialized and server-confirmed', options, async t => {
  const view = await environment(t, { cached: staff });
  const initial = view.queue(userPath), refresh = view.queue(refreshPath);
  view.mount(); const done = view.auth.initialize(); initial.offline(); refresh.offline();
  await done; await Vue.nextTick();
  assert.equal(view.state(), 'offline'); view.emptySlots();
  assert.deepEqual(JSON.parse(view.storage.get('auth')).user, staff);
  assert.equal(view.requests.some(request => request.path === logoutPath), false);
  const retry = view.root.find(node => node.props['data-admin-retry'] !== undefined);
  assert.ok(retry); assert.equal(view.root.find(node => node.props.href?.startsWith('/login')), undefined);
  const response = view.queue(userPath);
  const settled = stateSettled(view.auth, 'authenticated');
  retry.props.onClick({}); retry.props.onClick({}); await Vue.nextTick();
  assert.equal(retry.props.disabled, true); assert.equal(retry.props['aria-busy'], true);
  assert.equal(view.requests.filter(request => request.path === userPath).length, 2); view.emptySlots();
  response.respond(staff); await settled; await Vue.nextTick();
  assert.equal(view.state(), 'staff'); assert.deepEqual(view.setups, { default: 1, title: 1, actions: 1 });
});

test('a failed retry stays offline; a subsequent real rejection becomes guest without staff mounting', options, async t => {
  const view = await environment(t, { cached: staff });
  const initial = view.queue(userPath), refresh = view.queue(refreshPath);
  view.mount(); const done = view.auth.initialize(); initial.offline(); refresh.offline(); await done; await Vue.nextTick();
  const retryUser = view.queue(userPath), retryRefresh = view.queue(refreshPath);
  const retry = view.root.find(node => node.props['data-admin-retry'] !== undefined);
  // Subscribe to the exact DOM prop transition before triggering the request;
  // the enclosing node:test timeout bounds the wait without polling or sleeps.
  const retried = new Promise(resolve => {
    const observe = (key, old, value) => {
      if (key === 'disabled' && old === true && value === false) { retry.observers.delete(observe); resolve(); }
    };
    retry.observers.add(observe);
  });
  retry.props.onClick({}); await Vue.nextTick();
  retryUser.offline(); retryRefresh.offline(); await retried; await Vue.nextTick();
  assert.equal(view.state(), 'offline'); view.emptySlots();
  const rejectedUser = view.queue(userPath), rejectedRefresh = view.queue(refreshPath), logout = view.queue(logoutPath);
  const rejected = stateSettled(view.auth, 'unauthenticated');
  retry.props.onClick({}); rejectedUser.respond({}, 401); rejectedRefresh.respond({}, 401); logout.respond({});
  await rejected; await Vue.nextTick();
  assert.equal(view.state(), 'guest'); view.emptySlots();
});

test('real auth revalidation revokes mounted staff slots immediately on a nonstaff response', options, async t => {
  const view = await environment(t);
  const response = view.queue(userPath); view.mount(); await view.initialize(response, staff);
  const revoke = view.queue(userPath); const done = view.auth.revalidate(); revoke.respond(member); await done; await Vue.nextTick();
  assert.equal(view.state(), 'denied');
  assert.deepEqual(view.unmounts, { default: 1, title: 1, actions: 1 });
  assert.equal(view.root.all(node => node.props['data-probe']).length, 0);
});

test('logout unmounts all three staff slots through the real service', options, async t => {
  const view = await environment(t);
  const response = view.queue(userPath); view.mount(); await view.initialize(response, staff);
  const logout = view.queue(logoutPath); const done = view.auth.logout(); logout.respond({}); await done; await Vue.nextTick();
  assert.equal(view.state(), 'guest'); assert.equal(view.root.all(node => node.props['data-probe']).length, 0);
  assert.deepEqual(view.unmounts, { default: 1, title: 1, actions: 1 }); assert.equal(view.timers.size, 0);
});

test('navigation derives one active item from route, supports explicit activePath, and shows real profile', options, async t => {
  const view = await environment(t);
  const response = view.queue(userPath); view.mount(); await view.initialize(response, staff);
  const nav = () => view.root.find(node => node.tag === 'nav');
  const active = () => nav().all(node => node.props['aria-current'] === 'page').map(node => node.props.href);
  assert.deepEqual(nav().all(node => node.tag === 'a').map(node => node.props.href), ['/admin/members', '/admin/plans', '/admin/plans#schedules', '/admin/hasena', '/admin/video/intro']);
  assert.deepEqual(active(), ['/admin/members']);
  await view.router.push('/admin/plans#schedules'); await Vue.nextTick(); assert.deepEqual(active(), ['/admin/plans#schedules']);
  await view.router.push('/admin/plans?filter=active'); await Vue.nextTick(); assert.deepEqual(active(), ['/admin/plans']);
  await view.router.push('/admin/video/intro/4'); await Vue.nextTick(); assert.deepEqual(active(), ['/admin/video/intro']);
  view.props.activePath = '/admin/hasena'; await Vue.nextTick(); assert.deepEqual(active(), ['/admin/hasena']);
  const profile = view.root.find(node => node.props.href === '/profile/17');
  assert.ok(profile.textContent.includes(staff.nickname)); assert.ok(profile.textContent.includes(staff.email));
  const logo = view.root.find(node => node.tag === 'img' && node.props.src === '/images/logo-transparent.png');
  assert.ok(logo); assert.ok(logo.props.alt);
  assert.ok(view.root.find(node => node.tag === 'main' && node.props.id && Number(node.props.tabindex) === -1));
});

test('server rendering leaves all consumer slots uncalled and never sends auth HTTP', options, async t => {
  const view = await environment(t, { cached: staff, server: true });
  const app = Vue.createSSRApp(view.Consumer); app.use(view.router);
  const html = await renderToString(app);
  assert.match(html, /data-admin-state="loading"/);
  view.emptySlots(); assert.deepEqual(view.requests, []);
});

test('shell styles compile with scoped theme selectors and canonical layout/hit/motion tokens', async () => {
  const { descriptor, errors } = parse(await readFile(shellPath, 'utf8'), { filename: shellPath }); assert.deepEqual(errors, []);
  for (const style of descriptor.styles) {
    const compiled = compileStyle({ source: style.content, filename: shellPath, id: 'data-v-admin-shell', scoped: style.scoped });
    assert.deepEqual(compiled.errors, []);
    assert.doesNotMatch(compiled.code, /(?:^|})\s*\[data-theme=["']dark["']\]\s*\{/);
    assert.match(compiled.code, /var\(--sidebar-width\)/);
    assert.match(compiled.code, /var\(--hit-min\)/);
    assert.match(compiled.code, /min-width:\s*1024px/);
    assert.match(compiled.code, /prefers-reduced-motion:\s*reduce/);
  }
});
