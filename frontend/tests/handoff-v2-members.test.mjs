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
const { renderToString } = require('@vue/server-renderer');
const appDir = fileURLToPath(new URL('../app/', import.meta.url));
let component;
async function loadPage() {
  if (component) return component;
  const built = await build({ entryPoints: [resolve(appDir, 'pages/admin/members.vue')], bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
    define: { 'import.meta.server': 'false', 'import.meta.client': 'true' },
    external: ['vue', 'vue-router', '@lucide/vue', '#components', '#app', '#imports'],
    plugins: [{ name: 'members-runtime', setup(builder) {
      builder.onResolve({ filter: /^~\// }, ({ path }) => {
        if (['~/composables/useAuthService', '~/composables/useToast', '~/composables/useFocusTrap', '~/composables/useScrollLock'].includes(path)) return { path, external: true };
        return { path: resolve(appDir, path.slice(2) + (path.endsWith('.vue') ? '' : '.ts')) };
      });
      builder.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
        const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path }); assert.deepEqual(errors, []);
        return { contents: compileScript(descriptor, { id: path, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } }).content, loader: 'ts', resolveDir: dirname(path) };
      });
    } }],
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'definePageMeta', 'useHead', built.outputFiles[0].text)(name => {
    if (name === 'vue') return { ...Vue, Transition: { props: ['name', 'appear'], setup: (_, { slots }) => () => slots.default?.() } };
    if (name === '#components') return { NuxtLink: RouterLink };
    if (name === '#app' || name === '#imports') return { useRuntimeConfig: () => globalThis.useRuntimeConfig(), useState: (...args) => globalThis.useState(...args) };
    if (name === '~/composables/useAuthService') return { useAuthService: () => current.auth };
    if (name === '~/composables/useToast') return { useToast: () => ({ success: value => current.notices.push(['success', value]), error: value => current.notices.push(['error', value]) }) };
    if (name === '~/composables/useFocusTrap') return { useFocusTrap: () => ({ isTopmost: Vue.ref(true), zIndex: Vue.ref(100) }) };
    if (name === '~/composables/useScrollLock') return { useScrollLock() {} };
    return require(name);
  }, module, module.exports, () => {}, () => {});
  component = module.exports.default; return component;
}
let current;
const observers = new Set();
const changed = () => { for (const observer of observers) queueMicrotask(observer); };
class Element {
  constructor(tag, text = '') { this.tag = tag; this.text = text; this.props = {}; this.children = []; this.parentNode = null; this.listeners = new Map(); this.value = ''; }
  addEventListener(name, listener) { this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]); }
  removeEventListener(name, listener) { this.listeners.set(name, (this.listeners.get(name) ?? []).filter(value => value !== listener)); }
  dispatchEvent(event) { for (const listener of this.listeners.get(event.type) ?? []) listener({ target: this, ...event }); }
  get tagName() { return this.tag.toUpperCase(); }
  get type() { return this.props.type; }
  get textContent() { return this.text + this.children.map(node => node.textContent).join(''); }
  all(predicate) { return this.children.flatMap(node => [...(predicate(node) ? [node] : []), ...node.all(predicate)]); }
  find(predicate) { return this.all(predicate)[0]; }
}
function detach(node) { if (node.parentNode) node.parentNode.children.splice(node.parentNode.children.indexOf(node), 1); node.parentNode = null; }
const renderer = Vue.createRenderer({
  createElement: tag => new Element(tag), createText: text => new Element('#text', text), createComment: () => new Element('#comment'),
  setText(node, text) { node.text = text; changed(); }, setElementText(node, text) { node.text = text; node.children = []; changed(); },
  patchProp(node, key, old, value) { node.props[key] = value; changed(); },
  insert(node, parent, anchor = null) { detach(node); parent.children.splice(anchor ? parent.children.indexOf(anchor) : parent.children.length, 0, node); node.parentNode = parent; changed(); },
  remove(node) { detach(node); changed(); }, parentNode: node => node.parentNode, nextSibling: node => node.parentNode?.children[node.parentNode.children.indexOf(node) + 1] ?? null,
  setScopeId() {}, querySelector: () => current.body, insertStaticContent() { throw new Error('Unexpected static HTML'); },
});
function signal(predicate) { return new Promise(resolve => { const observe = () => { if (predicate()) { observers.delete(observe); resolve(); } }; observers.add(observe); observe(); }); }
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; }
const by = (key, value) => node => String(node.props[key]) === String(value);
const action = (view, name) => view.root.find(by('data-action', name)) ?? view.body.find(by('data-action', name));
async function click(node, force = false) { assert.ok(node, 'control exists'); if (!force) assert.ok(!node.props.disabled, 'control enabled'); for (const fn of [node.props.onClick].flat()) if (fn) fn({ preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {} }); await Vue.nextTick(); }
const base = '/api/v1/admin/members/';
const row = (id = 7) => ({ id, nickname: `Fixture-${id}`, email: `member${id}@example.test`, email_verified: false, is_staff: false, is_active: true, status: 'active', providers: ['google', 'kakao'], joined_at: '2026-01-01T01:00:00Z', last_active_at: null, plan: { id: 31, name: 'Fixture plan', percent: 25, completed_days: 1, total_days: 4 }, current_streak: 3 });
const member = id => ({ ...row(id), total_completed_days: 17, longest_streak: 6, is_public: false, has_password: false, token_version: 2, scheduled_deletion_at: null, is_dormant: false, dormancy_cleared_at: null,
  social_accounts: [{ provider: 'google', provider_id: 'fixture-google-id', created_at: '2026-01-01T01:00:00Z' }, { provider: 'kakao', provider_id: 'fixture-kakao-id', created_at: '2026-01-02T01:00:00Z' }],
  subscriptions: [{ id: 91, plan_id: 31, name: 'Subscribed plan', percent: 40, completed_days: 2, total_days: 5, is_default: true, is_active: false, is_hidden: true }],
  reading_settings: { theme: 'dark', font_family: 'ridi-batang', font_size: 19, font_weight: 'medium', line_height: 1.8, text_align: 'left', verse_joining: false, show_verse_numbers: true, show_description: true, show_cross_ref: false, highlight_names: true, show_footnotes: false, tongdok_auto_complete: true },
  notification_settings: { notifications_enabled: true, reading_reminders_enabled: true, hasena_reminders_enabled: false, friend_activity_enabled: false, weekly_summary_enabled: true, service_notice_enabled: false, reading_reminder_time: '08:30:00', hasena_reminder_time: '09:00:00', timezone: 'Asia/Seoul' },
});
const stats = { total: 51, weekly_active: 18, unverified: 9, scheduled_deletion: 2, new_this_week: 4, deltas: { total: null, weekly_active: null, unverified: null, scheduled_deletion: null }, deltas_unavailable_reason: 'historical_snapshots_unavailable' };
const options = { timeout: 8000 };
async function page(t, { state = 'staff', server = false, handlers = {} } = {}) {
  const states = new Map(), root = new Element('root'), body = new Element('body'), requests = [], notices = [], downloads = [];
  const authState = Vue.ref(state), user = Vue.ref({ id: 900, nickname: 'Operator', is_staff: true });
  const auth = { user, isInitialized: Vue.computed(() => authState.value !== 'loading'), isLoading: Vue.computed(() => authState.value === 'loading'), isSessionUnknown: Vue.computed(() => authState.value === 'offline'), isAuthenticated: Vue.computed(() => ['staff', 'denied'].includes(authState.value)), isStaff: Vue.computed(() => authState.value === 'staff'), initialize: async () => {}, revalidate: async () => { authState.value = 'denied'; }, refreshToken: async () => ({ ok: false, reason: 'rejected' }), logout: () => { authState.value = 'guest'; } };
  const members = new Map([7, 8].map(id => [id, member(id)]));
  current = { root, body, requests, auth, authState, notices, downloads, members };
  const storage = new Map();
  const globals = { localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }, useRuntimeConfig: () => ({ public: { apiBase: 'https://api.example.test', csrfCookieName: 'beta_csrftoken' } }), useState: (key, init) => { if (!states.has(key)) states.set(key, Vue.ref(init())); return states.get(key); }, document: { cookie: 'beta_csrftoken=fixture-csrf', body: { appendChild() {} }, createElement: () => { const link = { click: () => downloads.push(link), remove() {} }; return link; } }, window: {} };
  for (const [key, value] of Object.entries(globals)) { const previous = Object.getOwnPropertyDescriptor(globalThis, key); Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]); }
  const defaults = {
    [`GET ${base}`]: url => ({ count: 51, next: Number(url.searchParams.get('page')) === 2 ? null : 2, previous: Number(url.searchParams.get('page')) === 2 ? 1 : null, results: (Number(url.searchParams.get('page')) === 2 ? [8] : [7, 8]).map(id => Object.fromEntries(Object.keys(row(id)).map(key => [key, members.get(id)[key]]))) }),
    [`GET ${base}stats/`]: () => stats,
    ...Object.fromEntries([7, 8].map(id => [`GET ${base}${id}/`, () => structuredClone(members.get(id))])),
    ...Object.fromEntries([7, 8].map(id => [`GET ${base}${id}/activity/`, url => ({ count: 51, next: url.searchParams.get('page') === '2' ? null : 2, previous: url.searchParams.get('page') === '2' ? 1 : null, results: [{ at: '2026-09-01T01:00:00Z', kind: 'note', source_id: url.searchParams.get('page') === '2' ? 100 : 101, text: 'Stored metadata only' }] })])),
  };
  const routes = { ...defaults, ...handlers };
  t.mock.method(globalThis, 'fetch', async (input, init) => { const url = new URL(input), method = init.method ?? 'GET', request = { url, method, body: init.body ? JSON.parse(init.body) : null, credentials: init.credentials, headers: init.headers }; requests.push(request); changed(); const handler = routes[`${method} ${url.pathname}`]; assert.ok(handler, `Unexpected ${method} ${url.pathname}`); const result = await handler(url, request.body, request); if (result instanceof Response) return result; return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } }); });
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] }); await router.push('/admin/members'); await router.isReady();
  const Page = await loadPage(); const app = server ? Vue.createSSRApp(Page) : renderer.createApp(Page); app.use(router);
  const view = { ...current, routes, states, app, router, async ready() { await signal(() => !!action(view, 'open-7')); await Vue.nextTick(); }, async open(id = 7) { const done = signal(() => !!view.body.find(by('data-member-detail', id))); await click(action(view, `open-${id}`)); await done; await Vue.nextTick(); } };
  if (server) view.html = await renderToString(app); else { app.mount(root); t.after(() => { app.unmount(); observers.clear(); }); }
  view.state = app._instance?.refs.consoleRef?.state;
  return view;
}
function settled(view) { return new Promise(resolve => { const stop = Vue.watch(() => view.state.busy, value => { if (!value) { stop(); resolve(); } }, { flush: 'sync' }); }); }
async function confirm(view, accepted) { const stack = view.states.get('modal-stack'); assert.equal(stack.value.length, 1); assert.equal(stack.value[0].options.props.confirmVariant, 'danger'); stack.value[0].resolve(accepted); stack.value = []; await Vue.nextTick(); }
async function input(node, value) { node.value = value; node.dispatchEvent({ type: 'input' }); await Vue.nextTick(); }
async function refreshList(view, trigger) { const before = view.requests.filter(r => r.url.pathname === base).length; const done = signal(() => view.requests.filter(r => r.url.pathname === base).length > before && !view.state.listLoading); await trigger(); await done; await Vue.nextTick(); }

test('member route mounts the actual typed-facade list and stats', options, async t => {
  const view = await page(t); await view.ready(); assert.deepEqual(view.requests.map(r => r.url.pathname).sort(), [base, `${base}stats/`].sort());
  assert.equal(view.root.all(by('data-stat-delta', 'unavailable')).length, 4);
  assert.ok(view.requests.every(r => r.credentials === 'include'));
});

for (const state of ['loading', 'guest', 'denied', 'offline']) test(`${state} authority never mounts member API consumers`, options, async t => {
  const view = await page(t, { state }); await Vue.nextTick();
  assert.equal(view.requests.length, 0); assert.equal(action(view, 'export'), undefined); assert.equal(action(view, 'open-7'), undefined);
  assert.equal(view.root.find(by('data-admin-state', state))?.props['data-admin-state'], state);
});
test('SSR renders auth boundary and no staff HTTP or dialog', options, async t => {
  const view = await page(t, { state: 'loading', server: true }); assert.equal(view.requests.length, 0); assert.match(view.html, /data-admin-state="loading"/); assert.doesNotMatch(view.html, /data-member-row|role="dialog"/);
});
test('real search input, all five filters, three sorts and page 50 preserve query and clear selection', options, async t => {
  const view = await page(t); await view.ready();
  await click(action(view, 'select-page')); assert.deepEqual([...view.state.selected], [7, 8]);
  await input(action(view, 'search-input'), ' #7 ');
  await refreshList(view, async () => { const form = view.root.find(n => n.tag === 'form'); form.props.onSubmit({ preventDefault() {} }); });
  assert.equal(view.requests.at(-1).url.searchParams.get('q'), '#7'); assert.deepEqual([...view.state.selected], []);
  for (const value of ['unverified', 'staff', 'dormant', 'deletion', 'all']) { await refreshList(view, () => click(action(view, `filter-${value}`))); assert.equal(view.requests.at(-1).url.searchParams.get('filter'), value); assert.equal(view.requests.at(-1).url.searchParams.get('q'), '#7'); }
  for (const value of ['joined', 'streak', 'recent']) { await refreshList(view, () => click(action(view, `sort-${value}`))); assert.equal(view.requests.at(-1).url.searchParams.get('sort'), value); }
  await click(action(view, 'select-7')); await refreshList(view, () => click(action(view, 'next-page')));
  assert.equal(view.requests.at(-1).url.searchParams.get('page'), '2'); assert.deepEqual([...view.state.selected], []); assert.match(view.root.textContent, /51–51/);
  await click(action(view, 'select-page')); assert.deepEqual([...view.state.selected], [8]);
  await refreshList(view, () => click(action(view, 'previous-page'))); assert.equal(view.requests.at(-1).url.searchParams.get('page'), '1');
});
test('overview uses server profile providers progress and settings without private payload rendering', options, async t => {
  const view = await page(t); await view.ready(); const data = view.members.get(7); data.note_body = 'PRIVATE_NOTE_SENTINEL'; data.social_accounts[0].access_token = 'PRIVATE_TOKEN_SENTINEL';
  await view.open(); assert.equal(view.body.find(n => n.props['data-token-version'] !== undefined).textContent, 'v2');
  assert.ok(view.body.textContent.includes('fixture-google-id')); assert.equal(view.body.find(by('data-subscription', 91)).find(n => n.tag === 'progress').props.value, 40);
  await click(action(view, 'tab-settings')); assert.ok(view.body.textContent.includes('ridi-batang')); assert.ok(view.body.textContent.includes('08:30:00'));
  const panel = view.body.find(by('role', 'tabpanel')); assert.equal(panel.all(n => ['input', 'textarea', 'select', 'button'].includes(n.tag)).length, 0);
  assert.doesNotMatch(view.body.textContent, /PRIVATE_NOTE_SENTINEL|PRIVATE_TOKEN_SENTINEL/); assert.equal(view.requests.some(r => ['PATCH', 'PUT'].includes(r.method)), false);
});
test('activity appends actual pages, serializes duplicate loads and recovers failed next page', options, async t => {
  const view = await page(t); await view.ready(); await view.open(); const first = signal(() => !!view.body.find(by('data-activity', 'note-101'))); await click(action(view, 'tab-activity')); await first;
  const pending = deferred(); let calls = 0; view.routes[`GET ${base}7/activity/`] = () => { calls++; return pending.promise; };
  const more = action(view, 'more-activity'); await click(more); await click(more, true); assert.equal(calls, 1);
  const failed = signal(() => !!action(view, 'retry-activity')); pending.resolve(new Response('{}', { status: 500 })); await failed;
  assert.ok(view.body.find(by('data-activity', 'note-101')));
  view.routes[`GET ${base}7/activity/`] = url => { assert.equal(url.searchParams.get('page'), '2'); return { count: 2, next: null, previous: 1, results: [{ at: '2026-08-01T01:00:00Z', kind: 'signup', source_id: 7, text: 'Retained signup' }] }; };
  const restored = signal(() => !!view.body.find(by('data-activity', 'signup-7'))); await click(action(view, 'retry-activity')); await restored;
  assert.ok(view.body.find(by('data-activity', 'note-101'))); assert.equal(action(view, 'more-activity'), undefined);
});
const actionCases = [
  ['verify_email', m => {}, m => { m.email_verified = true; }],
  ['unverify_email', m => { m.email_verified = true; }, m => { m.email_verified = false; m.token_version++; }],
  ['resend_verification', m => {}, m => {}], ['send_password_reset', m => { m.email_verified = true; }, m => {}],
  ['revoke_sessions', m => {}, m => { m.token_version++; }],
  ['grant_staff', m => {}, m => { m.is_staff = true; m.token_version++; }], ['revoke_staff', m => { m.is_staff = true; }, m => { m.is_staff = false; m.token_version++; }],
  ['set_dormant', m => {}, m => { m.is_dormant = true; m.status = 'dormant'; }], ['clear_dormant', m => { m.is_dormant = true; m.status = 'dormant'; }, m => { m.is_dormant = false; m.status = 'active'; }],
  ['deactivate', m => {}, m => { m.is_active = false; m.status = 'inactive'; m.token_version++; }],
  ['activate', m => { m.is_active = false; m.status = 'inactive'; }, m => { m.is_active = true; m.status = 'active'; m.token_version++; }],
  ['schedule_deletion', m => {}, m => { m.scheduled_deletion_at = '2026-09-21T01:00:00Z'; m.is_active = false; m.status = 'deletion'; m.token_version++; }],
  ['cancel_deletion', m => { m.scheduled_deletion_at = '2026-09-21T01:00:00Z'; m.is_active = false; m.status = 'deletion'; }, m => { m.scheduled_deletion_at = null; m.is_active = true; m.status = 'active'; m.token_version++; }],
  ['unlink_social', m => {}, m => { m.social_accounts = m.social_accounts.filter(p => p.provider !== 'google'); m.token_version++; }],
];
for (const [name, prepare, apply] of actionCases) test(`${name}: actual component POST, no optimistic state, duplicate guard and authoritative reload`, options, async t => {
  const view = await page(t); await view.ready(); const stored = view.members.get(7); prepare(stored); await view.open();
  if (name !== 'unlink_social') await click(action(view, 'tab-actions'));
  const before = structuredClone(stored), pending = deferred(), received = deferred();
  view.routes[`POST ${base}7/actions/`] = async (url, body, request) => { received.resolve(request); await pending.promise; apply(stored); return { id: 7, success: true, error: null, token_version: stored.token_version }; };
  const done = settled(view), button = action(view, name === 'unlink_social' ? 'unlink-google' : name);
  await click(button); await click(button, true);
  if (['deactivate', 'activate', 'schedule_deletion', 'cancel_deletion'].includes(name)) { assert.equal(view.requests.some(r => r.method === 'POST'), false); await confirm(view, true); }
  const request = await received.promise;
  assert.deepEqual(request.body, name === 'unlink_social' ? { action: name, provider: 'google' } : { action: name });
  assert.equal(request.headers['X-CSRFToken'], 'fixture-csrf'); assert.equal(request.credentials, 'include');
  assert.equal(view.state.detail.token_version, before.token_version); assert.equal(view.state.detail.email_verified, before.email_verified); assert.equal(view.state.detail.status, before.status);
  pending.resolve(); await done; await Vue.nextTick();
  assert.deepEqual(JSON.parse(JSON.stringify(view.state.detail)), stored); assert.equal(view.requests.filter(r => r.method === 'POST').length, 1);
  assert.equal(view.requests.filter(r => r.url.pathname === `${base}7/`).length, 2); assert.equal(view.requests.filter(r => r.url.pathname === base).length, 2); assert.equal(view.requests.filter(r => r.url.pathname === `${base}stats/`).length, 2);
  assert.equal(view.notices.at(-1)[0], 'success');
});
test('danger cancel and stale confirmation never send mutation to a switched member', options, async t => {
  const view = await page(t); await view.ready(); await view.open(); await click(action(view, 'tab-actions'));
  let done = settled(view); await click(action(view, 'deactivate')); await confirm(view, false); await done; assert.equal(view.requests.some(r => r.method === 'POST'), false);
  done = settled(view); await click(action(view, 'schedule_deletion')); await view.state.openMember(8); await confirm(view, true); await done;
  assert.equal(view.state.detail.id, 8); assert.equal(view.requests.some(r => r.method === 'POST'), false);
});
test('server last-login rejection, mail failure and social-only rejection remain recoverable without local mutation', options, async t => {
  const view = await page(t); await view.ready(); await view.open();
  for (const [name, code] of [['unlink-google', 'last_login_method'], ['resend_verification', 'mail_delivery_failed'], ['send_password_reset', 'social_only_unverified']]) {
    await click(action(view, name === 'unlink-google' ? 'tab-overview' : 'tab-actions'));
    view.routes[`POST ${base}7/actions/`] = () => new Response(JSON.stringify({ id: 7, success: false, error: code, token_version: 2 }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const count = view.requests.filter(r => r.method === 'POST').length;
    const done = settled(view); await click(action(view, name)); await done; await Vue.nextTick();
    assert.equal(view.requests.filter(r => r.method === 'POST').length, count + 1);
    assert.equal(view.requests.filter(r => r.method === 'POST').at(-1).body.action, name === 'unlink-google' ? 'unlink_social' : name);
    assert.equal(view.notices.at(-1)[0], 'error'); assert.ok(view.body.find(n => n.props['data-action-error'] !== undefined)); assert.equal(view.state.detail.token_version, 2); assert.equal(view.state.detail.social_accounts.length, 2); assert.equal(action(view, name).props.disabled, false);
  }
});
for (const name of ['resend_verification', 'revoke_sessions', 'deactivate']) test(`bulk ${name} uses selected page IDs, danger confirmation and partial-result recovery`, options, async t => {
  const view = await page(t); await view.ready(); await click(action(view, 'select-page'));
  const mailOutbox = [];
  view.routes[`POST ${base}bulk/`] = (url, body) => {
    assert.deepEqual(body, { ids: [7, 8], action: name });
    if (name === 'resend_verification') mailOutbox.push(7);
    else view.members.get(7).token_version++;
    if (name === 'deactivate') { view.members.get(7).is_active = false; view.members.get(7).status = 'inactive'; }
    return { results: [{ id: 7, success: true, error: null, token_version: view.members.get(7).token_version }, { id: 8, success: false, error: 'member_not_found', token_version: null }] };
  };
  const done = settled(view), button = action(view, `bulk-${name}`); await click(button); await click(button, true); if (name === 'deactivate') { assert.equal(view.requests.some(r => r.method === 'POST'), false); await confirm(view, true); } await done; await Vue.nextTick();
  assert.deepEqual([...view.state.selected], [8]); assert.equal(view.root.find(by('data-bulk-result', 7)).props['data-success'], true); assert.equal(view.root.find(by('data-bulk-result', 8)).props['data-success'], false); assert.equal(view.requests.filter(r => r.method === 'POST').length, 1);
  assert.equal(view.state.list.results.find(row => row.id === 7).status, name === 'deactivate' ? 'inactive' : 'active');
  assert.equal(view.members.get(7).token_version, name === 'resend_verification' ? 2 : 3);
  assert.equal(view.members.get(8).token_version, 2); assert.deepEqual(mailOutbox, name === 'resend_verification' ? [7] : []);
});
test('old list and detail responses cannot overwrite a newer query or member', options, async t => {
  const view = await page(t); await view.ready(); const oldList = deferred();
  view.routes[`GET ${base}`] = url => url.searchParams.get('filter') === 'staff' ? oldList.promise : { count: 1, next: null, previous: null, results: [row(8)] };
  const first = view.state.search({ filter: 'staff' }); const second = view.state.search({ filter: 'deletion' }); await second; oldList.resolve({ count: 1, next: null, previous: null, results: [row(7)] }); await first;
  assert.deepEqual(view.state.list.results.map(r => r.id), [8]);
  const oldDetail = deferred(); view.routes[`GET ${base}7/`] = () => oldDetail.promise;
  const opening = view.state.openMember(7); await view.state.openMember(8); oldDetail.resolve(member(7)); await opening; assert.equal(view.state.detail.id, 8);
});
test('list and stats failures expose independent retries without fake zeros', options, async t => {
  const view = await page(t, { handlers: { [`GET ${base}`]: () => new Response('{}', { status: 500 }), [`GET ${base}stats/`]: () => new Response('{}', { status: 500 }) } });
  await signal(() => !!action(view, 'retry-list') && !!action(view, 'retry-stats')); assert.equal(view.root.all(n => n.props['data-stat'] !== undefined).length, 0);
  view.routes[`GET ${base}`] = () => ({ count: 0, next: null, previous: null, results: [] }); view.routes[`GET ${base}stats/`] = () => stats;
  await Promise.all([view.state.loadList(), view.state.loadStats()]); await Vue.nextTick(); assert.equal(view.state.list.count, 0); assert.equal(view.state.stats.total, 51); assert.equal(action(view, 'retry-list'), undefined);
});
test('403 revalidates authority and unmounts detail and list with no further staff calls', options, async t => {
  const view = await page(t); await view.ready(); await view.open(); await click(action(view, 'tab-actions'));
  view.routes[`POST ${base}7/actions/`] = () => new Response('{}', { status: 403 }); const done = settled(view); await click(action(view, 'revoke_sessions')); await done; await Vue.nextTick();
  assert.equal(view.authState.value, 'denied'); assert.equal(view.body.find(by('role', 'dialog')), undefined); assert.equal(action(view, 'export'), undefined); assert.equal(view.requests.filter(r => r.url.pathname === base).length, 1);
});
test('default masked CSV and explicit unmasked CSV use generated route with query not current page and download actual body', options, async t => {
  const view = await page(t); await view.ready(); const blobs = [], revoked = [];
  t.mock.method(URL, 'createObjectURL', blob => { blobs.push(blob); return `blob:fixture-${blobs.length}`; }); t.mock.method(URL, 'revokeObjectURL', url => revoked.push(url));
  view.routes[`GET ${base}export.csv`] = () => new Response('\uFEFFid,nickname\r\n7,masked-fixture\r\n', { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
  await view.state.search({ q: '#7', filter: 'staff', sort: 'streak', page: 2 });
  const finished = () => new Promise(resolve => { const stop = Vue.watch(() => view.state.exporting, value => { if (!value) { stop(); resolve(); } }, { flush: 'sync' }); });
  let done = finished(); const exportButton = action(view, 'export'); await click(exportButton); await click(exportButton, true); await done;
  assert.equal(view.downloads.length, 1); assert.equal(view.downloads[0].download, 'members-masked.csv'); assert.equal(await blobs[0].text(), 'id,nickname\r\n7,masked-fixture\r\n');
  assert.deepEqual([...new Uint8Array(await blobs[0].arrayBuffer()).slice(0, 3)], [239, 187, 191]);
  const request = view.requests.at(-1); assert.deepEqual(Object.fromEntries(request.url.searchParams), { q: '#7', filter: 'staff', sort: 'streak', masked: 'true' });
  const checkbox = action(view, 'csv-mask'); checkbox.checked = false; checkbox.dispatchEvent({ type: 'change' }); await Vue.nextTick();
  done = finished(); await click(action(view, 'export')); await done; assert.equal(view.requests.at(-1).url.searchParams.get('masked'), 'false'); assert.equal(view.downloads[1].download, 'members.csv'); assert.equal(revoked.length, 2);
});
test('member SFC styles compile with scoped responsive shared drawer geometry', options, async () => {
  for (const relative of ['pages/admin/members.vue', 'components/admin/member-console.vue', 'components/admin/member-drawer.vue']) {
    const filename = resolve(appDir, relative), { descriptor } = parse(await readFile(filename, 'utf8'), { filename });
    for (const style of descriptor.styles) { const result = compileStyle({ source: style.content, filename, id: 'member-scope', scoped: style.scoped }); assert.deepEqual(result.errors, []); }
  }
});

test('authority loss cancels the member-owned danger confirmation without leaving a global dialog', options, async t => {
  const view = await page(t); await view.ready(); await view.open(); await click(action(view, 'tab-actions'));
  const done = settled(view); await click(action(view, 'deactivate')); assert.equal(view.states.get('modal-stack').value.length, 1);
  view.authState.value = 'denied'; await Vue.nextTick();
  assert.equal(view.states.get('modal-stack').value.length, 0); await done;
  assert.equal(view.requests.some(r => r.method === 'POST'), false);
});
test('late unsuccessful action does not attach its error to a different member drawer', options, async t => {
  const view = await page(t); await view.ready(); await view.open(); const pending = deferred();
  view.routes[`POST ${base}7/actions/`] = () => pending.promise;
  const done = settled(view); await click(action(view, 'unlink-google')); await view.state.openMember(8);
  pending.resolve({ id: 7, success: false, error: 'last_login_method', token_version: 2 }); await done; await Vue.nextTick();
  assert.equal(view.state.detail.id, 8); assert.equal(view.state.actionError, ''); assert.equal(view.notices.at(-1)[0], 'error');
});

test('50-row server page selection is unique and never includes the following page', options, async t => {
  const rows = Array.from({ length: 50 }, (_, index) => row(index + 7));
  const view = await page(t, { handlers: { [`GET ${base}`]: () => ({ count: 51, next: 2, previous: null, results: rows }) } }); await view.ready();
  await click(action(view, 'select-page')); assert.deepEqual([...view.state.selected], rows.map(row => row.id)); assert.equal(new Set(view.state.selected).size, 50);
  await click(action(view, 'select-7')); assert.equal(action(view, 'select-page').props['aria-checked'], 'mixed');
  await click(action(view, 'select-page')); assert.equal(view.state.selected.length, 50);
  view.routes[`POST ${base}bulk/`] = (url, body) => { assert.equal(body.ids.length, 50); assert.equal(body.ids.includes(57), false); return { results: body.ids.map(id => ({ id, success: true, error: null, token_version: 3 })) }; };
  const done = settled(view); await click(action(view, 'bulk-revoke_sessions')); await done; assert.equal(view.state.selected.length, 0); assert.equal(view.state.bulkResults.length, 50);
});
test('full 50-entry activity page appends the following page without replacing earlier records', options, async t => {
  const firstPage = Array.from({ length: 50 }, (_, index) => ({ at: '2026-09-01T01:00:00Z', kind: 'reading', source_id: 100 - index, text: `Stored reading #${100 - index}` }));
  const view = await page(t, { handlers: { [`GET ${base}7/activity/`]: url => ({ count: 51, next: url.searchParams.get('page') === '2' ? null : 2, previous: url.searchParams.get('page') === '2' ? 1 : null, results: url.searchParams.get('page') === '2' ? [{ ...firstPage[0], source_id: 50 }] : firstPage }) } }); await view.ready(); await view.open();
  let loaded = signal(() => view.state.activity?.results.length === 50); await click(action(view, 'tab-activity')); await loaded;
  loaded = signal(() => view.state.activity?.results.length === 51); await click(action(view, 'more-activity')); await loaded;
  assert.equal(view.body.all(n => n.props['data-activity'] !== undefined).length, 51); assert.equal(new Set(view.state.activity.results.map(row => row.source_id)).size, 51);
});
test('detail 404 recovery and unknown mutation outcome require a fresh detail before another write', options, async t => {
  const view = await page(t); await view.ready(); view.routes[`GET ${base}7/`] = () => new Response('{}', { status: 404 });
  let loaded = signal(() => !!action(view, 'retry-detail')); await click(action(view, 'open-7')); await loaded; assert.equal(view.state.detail, null);
  view.routes[`GET ${base}7/`] = () => structuredClone(view.members.get(7)); loaded = signal(() => !!view.body.find(by('data-member-detail', 7))); await click(action(view, 'retry-detail')); await loaded;
  await click(action(view, 'tab-actions')); const fresh = deferred(), received = deferred();
  view.routes[`POST ${base}7/actions/`] = () => { view.members.get(7).token_version++; throw new TypeError('fixture connection lost after commit'); };
  view.routes[`GET ${base}7/`] = () => { received.resolve(); return fresh.promise; };
  const done = settled(view), button = action(view, 'revoke_sessions'); await click(button); await received.promise;
  assert.equal(view.state.detail, null); assert.equal(view.state.busy, true); await click(button, true); assert.equal(view.requests.filter(r => r.method === 'POST').length, 1);
  fresh.resolve(structuredClone(view.members.get(7))); await done; await Vue.nextTick(); assert.equal(view.state.detail.token_version, 3); assert.ok(view.state.actionError); assert.equal(action(view, 'revoke_sessions').props.disabled, false);
});
test('closed or replaced member ignores late activity and detached consumers cannot make staff requests', options, async t => {
  const view = await page(t); await view.ready(); await view.open(); const pending = deferred(); view.routes[`GET ${base}7/activity/`] = () => pending.promise;
  const loaded = view.state.loadActivity(); await view.state.openMember(8); pending.resolve({ count: 1, next: null, previous: null, results: [{ at: '2026-09-01T01:00:00Z', kind: 'note', source_id: 99, text: 'Other member activity' }] }); await loaded;
  assert.equal(view.state.activity, null); assert.equal(view.state.detail.id, 8);
  view.state.closeMember(); assert.equal(view.state.detail, null); await Vue.nextTick(); assert.equal(view.body.find(by('role', 'dialog')), undefined);
  view.authState.value = 'guest'; await Vue.nextTick(); const count = view.requests.length;
  await Promise.all([view.state.loadList(), view.state.loadStats(), view.state.loadDetail(), view.state.loadActivity(), view.state.exportCsv()]); assert.equal(view.requests.length, count);
});
test('CSV error leaves export enabled for recovery and no download is fabricated', options, async t => {
  const view = await page(t); await view.ready(); view.routes[`GET ${base}export.csv`] = () => new Response('{}', { status: 500 });
  await view.state.exportCsv(); await Vue.nextTick(); assert.equal(view.downloads.length, 0); assert.equal(view.notices.at(-1)[0], 'error'); assert.equal(view.state.exporting, false); assert.equal(action(view, 'export').props.disabled, false);
});
