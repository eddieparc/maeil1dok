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
let transport, auth, modal, routes, notices, errors, component;
async function loadPage() {
  if (component) return component;
  const result = await build({
    entryPoints: [resolve(appDir, 'pages/plans/index.vue')], bundle: true, write: false,
    platform: 'node', format: 'cjs', logLevel: 'silent',
    external: ['vue', 'vue-router', '@lucide/vue', '#components'],
    plugins: [{ name: 'plans-runtime', setup(builder) {
      builder.onResolve({ filter: /^~\// }, ({ path }) => {
        if (['~/composables/useApi', '~/composables/useAuthService', '~/composables/useToast', '~/composables/useErrorHandler', '~/composables/useModal', '~/components/common/PageLayout.vue', '~/components/Toast.vue'].includes(path)) return { path, external: true };
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
  const localRequire = name => {
    if (name === '~/composables/useApi') return { useApi: () => transport };
    if (name === '~/composables/useAuthService') return { useAuthService: () => auth };
    if (name === '~/composables/useToast') return { useToast: () => ({ success: text => notices.push(text), error: text => errors.push(text) }) };
    if (name === '~/composables/useErrorHandler') return { useErrorHandler: () => ({ handleApiError: error => errors.push(error) }) };
    if (name === '~/composables/useModal') return { useModal: () => modal };
    if (name === '~/components/common/PageLayout.vue') return { setup: (_, { slots }) => () => Vue.h('main', slots.default?.()) };
    if (name === '~/components/Toast.vue') return { render: () => Vue.h('aside') };
    if (name === '#components') return { NuxtLink: { props: ['to'], setup: (props, { slots }) => () => Vue.h('a', { href: props.to }, slots.default?.()) } };
    if (name === 'vue-router') return { useRouter: () => ({ push: path => routes.push(path), back() {} }) };
    return require(name);
  };
  new Function('require', 'module', 'exports', 'useHead', result.outputFiles[0].text)(localRequire, module, module.exports, () => {});
  component = module.exports.default;
  return component;
}

// Real Vue template, AppButton, skeleton atoms and usePlanApi; substitute only
// auth/HTTP/router/modal boundaries and the surrounding app shell. This host
// checks rendered behavior, not browser layout or shared-modal focus behavior.
const observers = new Set();
const changed = () => { for (const observe of observers) queueMicrotask(observe); };
class Element {
  constructor(tag, text = '') { this.tag = tag; this.text = text; this.props = {}; this.children = []; this.parentNode = null; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  matches(selector) {
    if (selector.startsWith('.')) return (this.props.class ?? '').split(' ').includes(selector.slice(1));
    const attr = selector.match(/^\[([^=]+)="([^"]+)"\]$/);
    return attr ? String(this.props[attr[1]]) === attr[2] : this.tag === selector;
  }
  all(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.all(selector)]); }
  find(selector) { return this.all(selector)[0]; }
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
function signal(predicate) {
  return new Promise(resolve => {
    const observe = () => { if (predicate()) { observers.delete(observe); resolve(); } };
    observers.add(observe); observe();
  });
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const apps = [];
const userPath = '/api/v1/todos/plans/user/';
const summaryPath = id => `/api/v1/todos/plan/${id}/summary/`;
const sub = { id: 81, plan_id: 7, plan_name: 'Owned alpha', start_date: '2026-01-01', is_active: true, is_default: false };
const hidden = { ...sub, id: 82, plan_id: 8, plan_name: 'Hidden beta', is_active: false };
const defaultSub = { ...sub, id: 83, plan_id: 9, plan_name: 'Default gamma', is_default: true };
const available = { id: 10, name: 'Available delta', description: 'Fixture description', is_default: false, subscriber_count: 24 };
const progress = { completed_days: 2, total_days: 3, percent: 66.67 };
async function page({ state = 'authenticated', initialize, data = { subscriptions: [sub, hidden, defaultSub], available_plans: [available] }, responses = {} } = {}) {
  const requests = [], confirmations = [];
  const authState = Vue.ref(state), user = Vue.ref(state === 'unauthenticated' ? null : { id: 1 });
  auth = {
    authState, user, isAuthenticated: Vue.computed(() => authState.value === 'authenticated'),
    isLoading: Vue.computed(() => authState.value === 'loading'), isSessionUnknown: Vue.computed(() => authState.value === 'unknown-offline'),
    initialize: initialize ?? (async () => {}), revalidate: async () => { authState.value = 'authenticated'; return true; },
  };
  routes = []; notices = []; errors = [];
  modal = { isOpen: Vue.ref(false), confirm: options => { confirmations.push(options); return Promise.resolve(false); } };
  const handlers = { [userPath]: () => ({ data }), ...Object.fromEntries([81, 82, 83].map(id => [summaryPath(id), () => ({ data: progress })])), ...responses };
  function request(method, path, body) {
    requests.push({ method, path, body }); changed();
    const handler = handlers[`${method} ${path}`] ?? handlers[path];
    assert.ok(handler, `unexpected ${method} ${path}`);
    return Promise.resolve().then(() => handler(body));
  }
  transport = { GET: (path, options) => request('GET', path, options), POST: (path, body) => request('POST', path, body), DELETE: path => request('DELETE', path), path: (path, params) => path.replace('{id}', params.id) };
  const root = new Element('root'); const app = renderer.createApp(await loadPage());
  app.mount(root); apps.push(app);
  return { root, requests, handlers, confirmations, authState, user, app, async ready() { await signal(() => !!root.find('.content-section')); await Vue.nextTick(); } };
}
function card(view, id = 81) { return view.root.find(`[data-subscription="${id}"]`); }
function action(node, name) { return node.find(`[data-action="${name}"]`); }
async function click(node, force = false) {
  assert.ok(node, 'control exists'); if (!force) assert.ok(!node.props.disabled, 'control enabled');
  const event = { target: node, currentTarget: node, preventDefault() {}, stopImmediatePropagation() {} };
  node.props.onClick(event); await Vue.nextTick();
}
afterEach(() => { for (const app of apps.splice(0)) app.unmount(); observers.clear(); });

const options = { timeout: 3000 };
test('owned summaries use subscription IDs and server counts/percent, hidden/default actions and plan-ID navigation', options, async () => {
  const view = await page(); await view.ready();
  assert.deepEqual(view.requests.map(({ method, path }) => [method, path]), [['GET', userPath], ...[81, 82, 83].map(id => ['GET', summaryPath(id)])]);
  await signal(() => view.root.all('[role="progressbar"]').length === 2);
  assert.equal(card(view).find('[role="progressbar"]').props['aria-valuenow'], 66.67);
  assert.equal(card(view).find('progress').props.value, 66.67);
  assert.deepEqual(card(view).find('.completion-count').textContent.match(/\d+/g).map(Number), [2, 3]);
  assert.ok(card(view, 82).matches('.hidden-plan')); assert.ok(card(view, 82).find('.hidden-badge'));
  assert.equal(card(view, 82).find('[role="progressbar"]'), undefined);
  assert.equal(action(card(view, 82), 'schedule'), undefined); assert.ok(action(card(view, 82), 'delete'));
  assert.equal(action(card(view), 'delete'), undefined); assert.equal(action(card(view, 83), 'toggle'), undefined);
  assert.equal(action(card(view, 83), 'delete'), undefined);
  await click(action(card(view), 'schedule'));
  assert.deepEqual(routes, [{ path: '/plan', query: { plan: '7' } }]);
});

test('per-summary pending/error has no fabricated zero and retry is isolated and deduplicated', options, async () => {
  const pending = deferred(); const view = await page({ responses: { [summaryPath(81)]: () => pending.promise } }); await view.ready();
  assert.ok(card(view).find('.summary-loading')); assert.equal(card(view).find('progress'), undefined);
  const failed = signal(() => !!card(view).find('.summary-error')); pending.reject(new Error('offline')); await failed;
  assert.equal(card(view).find('[role="progressbar"]'), undefined); assert.equal(card(view).find('.completion-count'), undefined);
  assert.ok(card(view, 83).find('[role="progressbar"]')); assert.equal(errors.length, 1);
  const retry = deferred(); view.handlers[summaryPath(81)] = () => retry.promise;
  const restored = signal(() => !!card(view).find('[role="progressbar"]'));
  const retryButton = action(card(view), 'retry-summary'); await click(retryButton); await click(retryButton, true);
  retry.resolve({ data: { completed_days: 0, total_days: 0, percent: 0 } }); await restored;
  assert.equal(card(view).find('[role="progressbar"]').props['aria-valuenow'], 0);
  assert.equal(view.requests.filter(r => r.path === summaryPath(81)).length, 2);
});

test('failed toggle keeps data; successful toggle is serialized through refresh and moves visible controls', options, async () => {
  const view = await page(); await view.ready(); const path = '/api/v1/todos/plan/81/toggle-active/';
  const failure = deferred(); view.handlers[`POST ${path}`] = () => failure.promise;
  const button = action(card(view), 'toggle'); await click(button); await click(button, true);
  assert.equal(view.requests.filter(r => r.method === 'POST').length, 1); assert.equal(button.props.disabled, true);
  const recovered = signal(() => !button.props.disabled); failure.reject(new Error('write failed')); await recovered;
  assert.ok(action(card(view), 'schedule')); assert.equal(notices.length, 0); assert.equal(errors.length, 1);
  const refresh = deferred(); view.handlers[`POST ${path}`] = () => ({ data: {} }); view.handlers[userPath] = () => refresh.promise;
  const requested = signal(() => view.requests.filter(r => r.path === userPath).length === 2); await click(button); await requested;
  assert.ok(card(view)); assert.equal(button.props.disabled, true); await click(button, true);
  const moved = signal(() => !!action(card(view), 'delete'));
  refresh.resolve({ data: { subscriptions: [{ ...sub, is_active: false }], available_plans: [available] } }); await moved;
  assert.equal(view.requests.filter(r => r.method === 'POST').length, 2); assert.equal(action(card(view), 'schedule'), undefined);
});

test('danger confirmation is single-flight, cancel does not delete, failure preserves card, success refreshes sections', options, async () => {
  const view = await page(); await view.ready(); const confirmation = deferred();
  modal.confirm = options => { view.confirmations.push(options); return confirmation.promise; };
  const button = action(card(view, 82), 'delete'); await click(button); await click(button, true);
  assert.equal(view.confirmations.length, 1); assert.equal(view.confirmations[0].confirmVariant, 'danger'); assert.equal(view.confirmations[0].icon, 'warning');
  const cancelled = signal(() => !button.props.disabled); confirmation.resolve(false); await cancelled;
  assert.equal(view.requests.filter(r => r.method === 'DELETE').length, 0); assert.ok(card(view, 82));
  modal.confirm = async () => true; const failure = deferred(); view.handlers['DELETE /api/v1/todos/plan/82/'] = () => failure.promise;
  const request = signal(() => view.requests.some(r => r.method === 'DELETE')); await click(button); await request;
  const retained = signal(() => !button.props.disabled); failure.reject(new Error('delete failed')); await retained;
  assert.ok(card(view, 82)); assert.equal(notices.length, 0);
  view.handlers['DELETE /api/v1/todos/plan/82/'] = () => ({ data: undefined });
  view.handlers[userPath] = () => ({ data: { subscriptions: [sub, defaultSub], available_plans: [{ ...available, id: 8 }] } });
  const deleted = signal(() => !card(view, 82)); await click(button); await deleted;
  assert.equal(view.root.all('[data-section="subscriptions"]')[0].all('.plan-card').length, 2);
  assert.ok(view.root.find('[data-plan="8"]')); assert.equal(notices.length, 1);
});

test('subscribe posts plan ID once, failed writes preserve availability, success uses server subscription ID', options, async () => {
  const view = await page(); await view.ready(); const path = '/api/v1/todos/plan/'; const failure = deferred();
  view.handlers[`POST ${path}`] = () => failure.promise;
  const button = action(view.root.find('[data-plan="10"]'), 'subscribe'); await click(button); await click(button, true);
  assert.deepEqual(view.requests.filter(r => r.method === 'POST'), [{ method: 'POST', path, body: { plan: 10 } }]);
  const retained = signal(() => !button.props.disabled); failure.reject(new Error('subscribe failed')); await retained;
  assert.ok(view.root.find('[data-plan="10"]')); assert.equal(notices.length, 0);
  view.handlers[`POST ${path}`] = () => ({ data: {} });
  view.handlers[userPath] = () => ({ data: { subscriptions: [{ ...sub, id: 99, plan_id: 10, plan_name: available.name }], available_plans: [] } });
  view.handlers[summaryPath(99)] = () => ({ data: progress });
  const moved = signal(() => !!card(view, 99) && !view.root.find('[data-plan="10"]'));
  await click(button); await moved; await signal(() => !!card(view, 99).find('[role="progressbar"]'));
  assert.ok(view.root.find('[data-empty="available"]')); assert.equal(notices.length, 1);
});

test('successful write with failed reconciliation retains cards and blocks further writes until retry succeeds', options, async () => {
  const view = await page(); await view.ready();
  view.handlers['POST /api/v1/todos/plan/81/toggle-active/'] = () => ({ data: {} });
  view.handlers[userPath] = () => { throw new Error('refresh unavailable'); };
  const failed = signal(() => !!view.root.find('[data-state="plans-error"]'));
  await click(action(card(view), 'toggle')); await failed;
  assert.ok(card(view)); assert.equal(action(card(view), 'toggle').props.disabled, true);
  view.handlers[userPath] = () => ({ data: { subscriptions: [{ ...sub, is_active: false }], available_plans: [] } });
  const restored = signal(() => !!action(card(view), 'delete') && !action(card(view), 'delete').props.disabled);
  await click(action(view.root, 'retry-plans')); await restored;
  assert.equal(view.root.find('[data-state="plans-error"]'), undefined);
});

test('initial loading, successful empty, initial read failure and retry are distinct', options, async () => {
  const pending = deferred(); const view = await page({ responses: { [userPath]: () => pending.promise } });
  await signal(() => view.requests.length === 1); assert.ok(view.root.find('[data-state="loading"]'));
  assert.equal(view.root.find('[data-empty="subscriptions"]'), undefined);
  const failed = signal(() => !!view.root.find('[data-state="plans-error"]')); pending.reject(new Error('unavailable')); await failed;
  assert.equal(view.root.find('[data-state="loading"]'), undefined); assert.equal(view.root.find('[data-empty="subscriptions"]'), undefined);
  view.handlers[userPath] = () => ({ data: { subscriptions: [], available_plans: [] } });
  const empty = signal(() => !!view.root.find('[data-empty="subscriptions"]')); await click(action(view.root, 'retry-plans')); await empty;
  assert.ok(view.root.find('[data-empty="available"]')); assert.equal(view.requests.length, 2);
});

test('auth initialization shows skeleton without private reads; confirmed guest gets login link', options, async () => {
  const initialization = deferred(); const view = await page({ state: 'loading', initialize: () => initialization.promise });
  assert.ok(view.root.find('[data-state="loading"]')); assert.equal(view.requests.length, 0);
  const guest = signal(() => !!view.root.find('[data-state="guest"]'));
  view.authState.value = 'unauthenticated'; initialization.resolve(); await guest;
  assert.equal(action(view.root, 'login').props.href, '/login'); assert.equal(view.requests.length, 0);
});

test('unknown session is not guest and revalidation loads owned plans', options, async () => {
  const view = await page({ state: 'unknown-offline' }); await signal(() => !!view.root.find('[data-state="session-unknown"]'));
  assert.equal(view.root.find('[data-state="guest"]'), undefined); assert.equal(view.requests.length, 0);
  await click(action(view.root, 'retry-auth')); await view.ready(); assert.ok(card(view));
});

test('account change drops stale list responses and fetches new owner without overlapping facade reads', options, async () => {
  const pending = deferred(); const view = await page({ responses: { [userPath]: () => pending.promise } });
  await signal(() => view.requests.length === 1); view.user.value = { id: 2 }; await Vue.nextTick();
  view.handlers[userPath] = () => ({ data: { subscriptions: [], available_plans: [] } });
  const empty = signal(() => !!view.root.find('[data-empty="subscriptions"]'));
  pending.resolve({ data: { subscriptions: [sub], available_plans: [] } }); await empty;
  assert.equal(card(view), undefined); assert.equal(view.requests.length, 2);
});

test('restoring a hidden subscription re-enables its schedule and removes delete without changing IDs', options, async () => {
  const view = await page(); await view.ready();
  view.handlers['POST /api/v1/todos/plan/82/toggle-active/'] = () => ({ data: {} });
  view.handlers[userPath] = () => ({ data: { subscriptions: [{ ...hidden, is_active: true }], available_plans: [] } });
  const restored = signal(() => !!action(card(view, 82), 'schedule') && !action(card(view, 82), 'schedule').props.disabled);
  await click(action(card(view, 82), 'toggle')); await restored;
  assert.equal(card(view, 82).matches('.hidden-plan'), false); assert.equal(action(card(view, 82), 'delete'), undefined);
  await click(action(card(view, 82), 'schedule')); assert.deepEqual(routes, [{ path: '/plan', query: { plan: '8' } }]);
});

test('session recovery with failed list read does not leave obsolete summary requests spinning forever', options, async () => {
  const pending = deferred(); const view = await page({ responses: { [summaryPath(81)]: () => pending.promise } }); await view.ready();
  const unknown = signal(() => !!view.root.find('[data-state="session-unknown"]')); view.authState.value = 'unknown-offline'; await unknown;
  view.handlers[userPath] = () => { throw new Error('list offline'); };
  const failed = signal(() => !!view.root.find('[data-state="plans-error"]')); await click(action(view.root, 'retry-auth')); await failed;
  assert.ok(card(view)); assert.ok(card(view).find('.summary-error')); assert.equal(card(view).find('.summary-loading'), undefined);
  pending.resolve({ data: progress }); await pending.promise; await Vue.nextTick();
  assert.equal(card(view).find('[role="progressbar"]'), undefined);
});

test('logout invalidates outstanding summary and pending delete confirmation before any write', options, async () => {
  const summary = deferred(); const view = await page({ responses: { [summaryPath(81)]: () => summary.promise } }); await view.ready();
  const confirmation = deferred(); modal.confirm = () => confirmation.promise; await click(action(card(view, 82), 'delete'));
  const guest = signal(() => !!view.root.find('[data-state="guest"]')); view.authState.value = 'unauthenticated'; view.user.value = null; await guest;
  // Resolve the subscribed confirmation and HTTP request, then await Vue's
  // render scheduler; the terminal guest state must survive stale results.
  confirmation.resolve(true); summary.resolve({ data: progress }); await confirmation.promise; await summary.promise; await Vue.nextTick();
  assert.equal(view.requests.filter(r => r.method === 'DELETE').length, 0); assert.equal(card(view), undefined);
});
