import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'node:test';
import { build } from 'esbuild';
import { compileScript, compileStyle, parse } from '@vue/compiler-sfc';

const require = createRequire(import.meta.url), Vue = require('vue');
const appDir = fileURLToPath(new URL('../app/', import.meta.url));
let context;
const cache = new Map();
async function component(path) {
  if (cache.has(path)) return cache.get(path);
  const result = await build({ entryPoints: [resolve(appDir, path)], bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
    external: ['vue', 'vue-router', '@lucide/vue', '#imports', '#components', 'nuxt/app'],
    plugins: [{ name: 'auth-runtime', setup(builder) {
      builder.onResolve({ filter: /^~\// }, ({ path }) => {
        if (['useApi', 'useAuthService', 'useModal', 'useNavigation'].some(name => path === `~/composables/${name}`)) return { path, external: true };
        return { path: resolve(appDir, path.slice(2) + (path.endsWith('.vue') ? '' : '.ts')) };
      });
      builder.onResolve({ filter: /^#shared\// }, ({ path }) => ({ path: resolve(appDir, '../shared', path.slice(8) + '.ts') }));
      builder.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
        const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path }); assert.deepEqual(errors, []);
        return { contents: compileScript(descriptor, { id: path, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } }).content, loader: 'ts', resolveDir: dirname(path) };
      });
    } }],
  });
  const module = { exports: {} };
  const localRequire = name => {
    if (name === '~/composables/useApi') return { useApi: () => context.api };
    if (name === '~/composables/useAuthService') return { useAuthService: () => context.auth };
    if (name === '~/composables/useModal') return { useModal: () => ({ alert: async options => context.alerts.push(options) }) };
    if (name === '~/composables/useNavigation') return { useNavigation: () => ({ consumeRedirectUrl: () => '/plan', goBack: p => context.routes.push(p), setRedirectUrl() {} }) };
    if (name === 'vue-router') return { useRoute: () => context.route, useRouter: () => ({ push: p => context.routes.push(p), back() {} }) };
    if (name === '#imports' || name === 'nuxt/app') return { useHead() {}, useRuntimeConfig: () => ({ public: {} }) };
    if (name === '#components') return { NuxtLink };
    return require(name);
  };
  new Function('require', 'module', 'exports', 'ref', 'computed', 'onMounted', 'onUnmounted', 'useRoute', 'useRouter', 'useRuntimeConfig', 'navigateTo', 'definePageMeta', result.outputFiles[0].text)(localRequire, module, module.exports, Vue.ref, Vue.computed, Vue.onMounted, Vue.onUnmounted, () => context.route, () => ({ push: p => context.routes.push(p) }), () => ({ public: {} }), p => context.routes.push(p), () => {});
  cache.set(path, module.exports.default); return module.exports.default;
}
const observers = new Set();
function changed() { for (const observe of observers) queueMicrotask(observe); }
class Element {
  constructor(tag, text = '') { this.tag = tag; this.tagName = tag.toUpperCase(); this.text = text; this.props = {}; this.children = []; this.parentNode = null; this.events = {}; this.value = ''; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  getRootNode() { return globalThis.document; }
  addEventListener(name, fn) { (this.events[name] ??= []).push(fn); }
  removeEventListener(name, fn) { this.events[name] = (this.events[name] ?? []).filter(f => f !== fn); }
  matches(selector) {
    if (selector.startsWith('.')) return (this.props.class ?? '').split(' ').includes(selector.slice(1));
    if (selector.startsWith('#')) return this.props.id === selector.slice(1);
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
const NuxtLink = { props: ['to'], setup: (props, { slots }) => () => Vue.h('a', { href: props.to }, slots.default?.()) };
function signal(predicate) { return new Promise(resolve => { const observe = () => { if (!observers.has(observe)) return; if (predicate()) { observers.delete(observe); resolve(); } }; observers.add(observe); observe(); }); }
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const apps = [];
async function page(path, { handlers = {}, query = {}, params = {}, stored = {}, native = false } = {}) {
  const requests = [], routes = [], alerts = [], users = [], tokens = [], nativeMessages = [];
  const user = Vue.ref(null);
  context = { requests, routes, alerts, users, tokens, nativeMessages, route: { query, params }, auth: { user, isAuthenticated: Vue.computed(() => !!user.value), setUser(value) { user.value = value; users.push(value); }, setTokens: (...values) => tokens.push(values), fetchUser: async () => {}, initializeAuth: async () => {}, socialLogin: (...args) => handlers.socialLogin(...args) } };
  context.api = { POST(path, body) { requests.push({ path, body }); changed(); assert.ok(handlers[path], `unexpected endpoint: ${path}`); return Promise.resolve().then(() => handlers[path](body)); } };
  globalThis.window = { location: { origin: 'https://local.test' }, __nativeBridge: { isNativeApp: () => native, sendToNative: message => nativeMessages.push(message) } };
  globalThis.Document = class Document {};
  globalThis.ShadowRoot = class ShadowRoot {};
  globalThis.document = Object.assign(new Document(), { activeElement: null });
  globalThis.sessionStorage = { getItem: key => stored[key] ?? null, removeItem: key => { delete stored[key]; }, setItem: (key, value) => { stored[key] = value; } };
  const root = new Element('root'), app = renderer.createApp(await component(path));
  app.component('NuxtLink', NuxtLink); app.component('NuxtImg', { setup: (_, { attrs }) => () => Vue.h('img', attrs) });
  app.mount(root); apps.push(app);
  const logo = root.find('img'); assert.equal(logo?.props.src, '/images/logo-transparent.png'); assert.equal(logo?.props.loading, 'eager');
  return { ...context, root, app, handlers };
}
async function input(view, id, value) {
  const el = view.root.find(id); assert.ok(el, id); el.value = value;
  for (const listener of el.events.input ?? []) listener({ target: el });
  el.props.onInput?.({ target: el }); await Vue.nextTick();
}
async function click(el) { assert.ok(el); assert.ok(!el.props.disabled); el.props.onClick?.({ preventDefault() {}, stopImmediatePropagation() {} }); await Vue.nextTick(); }
async function submit(view) { view.root.find('form').props.onSubmit({ preventDefault() {} }); await Vue.nextTick(); }
afterEach(() => { for (const app of apps.splice(0)) app.unmount(); observers.clear(); delete globalThis.window; delete globalThis.document; delete globalThis.Document; delete globalThis.ShadowRoot; delete globalThis.sessionStorage; });
const options = { timeout: 4000 };
const nicknamePath = '/api/v1/auth/check-nickname/';

test('email format never claims server availability; password rules gate signup from actual current values', options, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const view = await page('pages/register-email.vue', { handlers: { [nicknamePath]: () => ({ available: true }) } });
  await input(view, '#email', 'test@example.com'); await view.root.find('#email').props.onBlur(); await Vue.nextTick();
  assert.ok(!view.root.find('#email').matches('.input-success'));
  const checked = signal(() => view.root.find('#nickname').matches('.input-success')); await input(view, '#nickname', 'Reader'); t.mock.timers.tick(300); await checked;
  await input(view, '#password', 'Validpass9'); await input(view, '#passwordConfirm', 'Validpass9');
  const consent = view.root.find('[type="checkbox"]'); consent.checked = true; for (const fn of consent.events.change ?? []) fn({ target: consent }); await Vue.nextTick();
  assert.equal(view.root.find('[type="submit"]').props.disabled, false);
  await input(view, '#password', 'short'); await input(view, '#passwordConfirm', 'short');
  assert.equal(view.root.find('[type="submit"]').props.disabled, true);
});

for (const provider of ['kakao', 'google', 'apple']) {
  test(`${provider} nickname responses cannot validate a newer input; suggestions require a real check`, options, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const pending = [];
    const view = await page(`pages/auth/${provider}/setup.vue`, { query: { provider_id: 'provider-1', signup_token: 'signed-1', suggested_nickname: 'Reader' }, handlers: { [nicknamePath]: body => { const result = deferred(); pending.push({ ...result, body }); changed(); return result.promise; } } });
    t.mock.timers.tick(300); await signal(() => pending.length === 1);
    const next = signal(() => pending.length === 2); await input(view, '#nickname', 'Other'); t.mock.timers.tick(300); await next;
    pending[0].resolve({ available: true }); await pending[0].promise; await Vue.nextTick(); await Vue.nextTick();
    assert.equal(view.root.find('[type="submit"]').props.disabled, true);
    const settled = signal(() => !!view.root.find('[aria-invalid="true"]')); pending[1].resolve({ available: false }); await settled;
    assert.equal(view.root.find('[type="submit"]').props.disabled, true);
    assert.equal(view.root.find('#nickname').props['aria-describedby'], `${provider}-nickname-status`);
    assert.equal(view.root.find(`#${provider}-nickname-status`).props.role, 'status');
    assert.equal(view.root.all('.suggestion-chip').length, 3);
    const checking = signal(() => pending.length === 3); await click(view.root.all('.suggestion-chip')[1]); t.mock.timers.tick(300); await checking;
    assert.equal(view.root.find('[type="submit"]').props.disabled, true);
    const available = signal(() => view.root.find('[type="submit"]').props.disabled === false); pending[2].resolve({ available: true }); await available;
  });
}

test('reset network failure does not claim token expiry and blocks incomplete passwords', options, async () => {
  const check = deferred();
  const view = await page('pages/auth/reset-password.vue', { query: { token: 'reset-token' }, handlers: { '/api/v1/auth/verify-reset-token/': () => check.promise } });
  const settled = signal(() => !view.root.find('.spinner')); check.reject(new TypeError('offline')); await settled;
  assert.equal(view.root.find('[data-state="expired"]'), undefined);
  assert.ok(view.root.find('form')); assert.ok(view.root.find('[role="alert"]'));
  assert.equal(view.root.find('[type="submit"]').props.disabled, true);
});

test('verify success adopts the real response user for cookie-only sessions', options, async () => {
  const response = deferred(), user = { id: 5, nickname: 'ActualUser', email_verified: true };
  const view = await page('pages/auth/verify-email.vue', { query: { token: 'verify-token' }, handlers: { '/api/v1/auth/verify-email/': () => response.promise } });
  const settled = signal(() => !view.root.find('.spinner')); response.resolve({ success: true, user }); await settled;
  assert.deepEqual(view.users, [user]); assert.ok(view.root.find('[data-state="success"]'));
});

test('callback retry appears only after 3000ms and its timer is cleaned up', options, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = deferred();
  const view = await page('pages/auth/[provider]/callback.vue', { params: { provider: 'google' }, query: { code: 'oauth-code' }, handlers: { '/api/v1/auth/social-login/v2/': () => pending.promise } });
  assert.equal(view.root.find('.callback-retry'), undefined); t.mock.timers.tick(2999); await Vue.nextTick(); assert.equal(view.root.find('.callback-retry'), undefined);
  t.mock.timers.tick(1); await Vue.nextTick(); assert.equal(view.root.find('.callback-retry')?.props.href, '/login');
  view.app.unmount(); apps.splice(apps.indexOf(view.app), 1); t.mock.timers.tick(3000);
});

test('auth error displays code query with legacy reason fallback', options, async () => {
  const view = await page('pages/auth/error.vue', { query: { code: 'provider_denied', reason: 'invalid_code' } });
  assert.ok(view.root.find('code')); assert.ok(view.root.find('code').textContent.includes('provider_denied'));
});

test('login preserves endpoint/payload and saved redirect while exposing real server errors and codes', options, async () => {
  const response = deferred();
  const view = await page('pages/login.vue', { handlers: { '/api/v1/auth/email-login/': () => response.promise } });
  await input(view, '#email', 'person@example.com'); await input(view, '#password', 'Actualpass9');
  const requested = signal(() => view.requests.length === 1); await submit(view); await submit(view); await requested;
  assert.deepEqual(view.requests, [{ path: '/api/v1/auth/email-login/', body: { email: 'person@example.com', password: 'Actualpass9' } }]);
  const failed = signal(() => !!view.root.find('#login-error')); response.reject({ data: { error: 'LOGIN_REJECTED', error_code: 'invalid_credentials' } }); await failed;
  assert.equal(view.root.find('#login-error').textContent, 'LOGIN_REJECTED'); assert.ok(view.root.find('code').textContent.includes('invalid_credentials'));
  await input(view, '#password', 'Otherpass9'); assert.equal(view.root.find('code'), undefined);
  view.handlers['/api/v1/auth/email-login/'] = () => ({ access: 'a', refresh: 'r' });
  const done = signal(() => view.routes.length === 1); await submit(view); await done;
  assert.deepEqual(view.tokens, [['a', 'r']]); assert.deepEqual(view.routes, ['/plan']);
});

test('auth error preserves the legacy reason parameter and an observed timestamp', options, async () => {
  const view = await page('pages/auth/error.vue', { query: { reason: 'invalid_code' } });
  await Vue.nextTick(); assert.ok(view.root.find('code').textContent.includes('invalid_code'));
  assert.ok(Number.isFinite(Date.parse(view.root.find('time').props.datetime)));
});

async function validRegistration(view, t) {
  await input(view, '#email', 'person@example.com'); await view.root.find('#email').props.onBlur();
  const checked = signal(() => view.root.find('#nickname').matches('.input-success'));
  await input(view, '#nickname', 'ActualReader'); t.mock.timers.tick(300); await checked;
  await input(view, '#password', 'Actualpass9!'); await input(view, '#passwordConfirm', 'Actualpass9!');
  const checkbox = view.root.find('[type="checkbox"]'); checkbox.checked = true;
  for (const listener of checkbox.events.change) listener({ target: checkbox }); await Vue.nextTick();
}

test('registration preserves payload/session/redirect and separates signup success from mail failure with retry', options, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const registration = deferred(), mail = deferred(), user = { id: 9, nickname: 'ActualReader', email: 'person@example.com' };
  const view = await page('pages/register-email.vue', { handlers: { [nicknamePath]: () => ({ available: true }), '/api/v1/auth/email-register/': () => registration.promise, '/api/v1/auth/send-verification/': () => mail.promise } });
  await validRegistration(view, t);
  const requested = signal(() => view.requests.some(r => r.path.endsWith('/email-register/')));
  await submit(view); await submit(view); await requested;
  assert.deepEqual(view.requests.filter(r => r.path.endsWith('/email-register/')), [{ path: '/api/v1/auth/email-register/', body: { email: 'person@example.com', password: 'Actualpass9!', password_confirm: 'Actualpass9!', nickname: 'ActualReader' } }]);
  assert.equal(view.root.find('[type="submit"]').props.disabled, true);
  const mailing = signal(() => !!view.root.find('[data-state="pending"]')); registration.resolve({ access: 'access-fixture', refresh: 'refresh-fixture', user }); await mailing;
  assert.deepEqual(view.tokens, [['access-fixture', 'refresh-fixture']]); assert.deepEqual(view.users, [user]); assert.deepEqual(view.routes, []);
  const failed = signal(() => !!view.root.find('[data-state="error"]')); mail.reject({ data: { error: 'MAIL_REQUEST_FAILED' } }); await failed;
  assert.ok(view.root.find('[role="alert"]')); assert.equal(view.root.find('form'), undefined);
  view.handlers['/api/v1/auth/send-verification/'] = () => ({ success: true });
  const retried = signal(() => !!view.root.find('[data-state="requested"]')); await click(view.root.find('.signup-status').all('button')[0]); await retried;
  assert.equal(view.requests.filter(r => r.path.endsWith('/email-register/')).length, 1);
  assert.deepEqual(view.requests.filter(r => r.path.endsWith('/send-verification/')).map(r => r.body), [{ email: 'person@example.com' }, { email: 'person@example.com' }]);
  await click(view.root.find('.signup-status').all('button')[1]); assert.deepEqual(view.routes, ['/plan']);
});

test('signup email duplicate is a real server field error, not a pretend availability probe', options, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const response = deferred();
  const view = await page('pages/register-email.vue', { handlers: { [nicknamePath]: () => ({ available: true }), '/api/v1/auth/email-register/': () => response.promise } });
  await validRegistration(view, t);
  const failed = signal(() => view.root.find('#email').props['aria-invalid'] === true);
  await submit(view); response.reject({ data: { error: 'EMAIL_DUPLICATE', errors: { email: ['EMAIL_DUPLICATE'] }, error_code: 'email_taken' } }); await failed;
  assert.equal(view.root.find('#email-error').textContent, 'EMAIL_DUPLICATE'); assert.ok(view.root.find('code').textContent.includes('email_taken'));
  assert.equal(view.root.find('[type="submit"]').props.disabled, true); assert.equal(view.users.length, 0);
  assert.deepEqual(view.requests.map(r => r.path), [nicknamePath, '/api/v1/auth/email-register/']);
});

for (const provider of ['kakao', 'google', 'apple']) {
  test(`${provider} completion keeps signed payload, native bridge, redirect and guards duplicate submits`, options, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const complete = deferred(); const user = { id: 17, nickname: 'ProviderReader' };
    const view = await page(`pages/auth/${provider}/setup.vue`, { native: true, query: { provider_id: 'pid', signup_token: 'signed', suggested_nickname: 'ProviderReader', profile_image: 'https://image.test/p.png', email: 'provider@example.com' }, handlers: { [nicknamePath]: () => ({ available: true }), '/api/v1/auth/complete-social-signup/': () => complete.promise } });
    const ready = signal(() => view.root.find('[type="submit"]').props.disabled === false); t.mock.timers.tick(300); await ready;
    const requested = signal(() => view.requests.some(r => r.path.endsWith('/complete-social-signup/'))); await submit(view); await submit(view); await requested;
    const body = { signup_token: 'signed', provider, provider_id: 'pid', nickname: 'ProviderReader' };
    if (provider !== 'apple') Object.assign(body, { email: 'provider@example.com', profile_image: 'https://image.test/p.png' });
    assert.deepEqual(view.requests.filter(r => r.path.endsWith('/complete-social-signup/')), [{ path: '/api/v1/auth/complete-social-signup/', body }]);
    const settled = signal(() => view.routes.length === 1); complete.resolve({ access: 'a', refresh: 'r', user }); await settled;
    assert.deepEqual(view.routes, ['/plan']); assert.deepEqual(view.nativeMessages, [{ type: 'auth:login', data: { token: 'a', refreshToken: 'r', user } }]);
  });
}

test('absent provider nickname stays empty and unmount cancels nickname debounce', options, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const view = await page('pages/auth/apple/setup.vue', { query: { provider_id: 'pid', signup_token: 'signed' } });
  assert.equal(view.root.find('#nickname').props.value, ''); assert.equal(view.root.all('.suggestion-chip').length, 3);
  await input(view, '#nickname', 'Reader'); view.app.unmount(); apps.splice(apps.indexOf(view.app), 1);
  t.mock.timers.tick(300); assert.equal(view.requests.length, 0);
});

for (const provider of ['kakao', 'google', 'apple']) {
  test(`${provider} absent-name suggestions remain proposals until real duplicate validation settles`, options, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const duplicate = deferred(), available = deferred();
    const view = await page(`pages/auth/${provider}/setup.vue`, {
      query: { provider_id: 'pid', signup_token: 'signed' },
      handlers: { [nicknamePath]: () => duplicate.promise },
    });
    const chips = view.root.all('.suggestion-chip');
    assert.equal(chips.length, 3);
    const suggestions = chips.map(chip => chip.textContent);
    assert.equal(new Set(suggestions).size, 3);
    assert.ok(suggestions.every(value => value.length >= 2 && value.length <= 20));
    assert.equal(view.root.find('#nickname').props.value, '');
    assert.equal(view.root.find('[type="submit"]').props.disabled, true);
    assert.equal(view.requests.length, 0);
    const requested = signal(() => view.requests.length === 1);
    await click(chips[0]);
    assert.equal(view.root.find('#nickname').props.value, suggestions[0]);
    assert.equal(view.root.find('#nickname').matches('.input-success'), false);
    assert.equal(view.root.find('[type="submit"]').props.disabled, true);
    t.mock.timers.tick(300); await requested;
    assert.deepEqual(view.requests, [{ path: nicknamePath, body: { nickname: suggestions[0] } }]);
    assert.equal(view.root.find('[type="submit"]').props.disabled, true);
    const rejected = signal(() => view.root.find('#nickname').props['aria-invalid'] === true);
    duplicate.resolve({ available: false }); await rejected;
    assert.equal(view.root.find('[type="submit"]').props.disabled, true);
    assert.equal(view.root.find('#nickname').matches('.input-success'), false);
    view.handlers[nicknamePath] = () => available.promise;
    const requestedAgain = signal(() => view.requests.length === 2);
    await click(chips[1]); t.mock.timers.tick(300); await requestedAgain;
    assert.equal(view.root.find('[type="submit"]').props.disabled, true);
    const accepted = signal(() => view.root.find('[type="submit"]').props.disabled === false);
    available.resolve({ available: true }); await accepted;
    assert.deepEqual(view.requests[1], { path: nicknamePath, body: { nickname: suggestions[1] } });
    assert.equal(view.users.length, 0); assert.deepEqual(view.routes, []);
  });
}

test('reset has real checking/input/success states, three strength segments and cookie-only response contract', options, async () => {
  const preflight = deferred(), confirm = deferred(), user = { id: 20, nickname: 'ResetReader' };
  const view = await page('pages/auth/reset-password.vue', { query: { token: 'reset-fixture' }, handlers: { '/api/v1/auth/verify-reset-token/': () => preflight.promise, '/api/v1/auth/reset-password/': () => confirm.promise } });
  assert.ok(view.root.find('[data-state="checking"]'));
  const form = signal(() => !!view.root.find('form')); preflight.resolve({ valid: true }); await form;
  for (const [value, strength] of [['short', 1], ['Actualpass9', 2], ['Actualpass999!', 3]]) {
    await input(view, '#password', value); assert.equal(view.root.find('[role="meter"]').props['aria-valuenow'], strength); assert.equal(view.root.all('.strength-segment').length, 3);
  }
  await input(view, '#confirmPassword', 'Actualpass999!'); assert.equal(view.root.find('#confirmPassword').props['aria-invalid'], false);
  await input(view, '#password', 'Otherpass999!'); assert.equal(view.root.find('#confirmPassword').props['aria-invalid'], true);
  await input(view, '#password', 'Actualpass999!');
  const requested = signal(() => view.requests.some(r => r.path.endsWith('/reset-password/'))); await submit(view); await submit(view); await requested;
  assert.deepEqual(view.requests, [{ path: '/api/v1/auth/verify-reset-token/', body: { token: 'reset-fixture' } }, { path: '/api/v1/auth/reset-password/', body: { token: 'reset-fixture', new_password: 'Actualpass999!' } }]);
  const done = signal(() => !!view.root.find('[data-state="success"]')); confirm.resolve({ success: true, user }); await done;
  assert.deepEqual(view.users, [user]); assert.deepEqual(view.tokens, []); assert.equal(view.root.find('[href="/login"]').props.href, '/login');
});

test('reset confirm server rejection is visible without misclassifying password validation as expiry', options, async () => {
  const confirm = deferred();
  const view = await page('pages/auth/reset-password.vue', { query: { token: 'reset-fixture' }, handlers: { '/api/v1/auth/verify-reset-token/': () => ({ valid: true }), '/api/v1/auth/reset-password/': () => confirm.promise } });
  await signal(() => !!view.root.find('form')); await input(view, '#password', 'Actualpass9'); await input(view, '#confirmPassword', 'Actualpass9');
  const failed = signal(() => !!view.root.find('[role="alert"]')); await submit(view); confirm.reject({ data: { new_password: ['PASSWORD_REJECTED'] } }); await failed;
  assert.equal(view.root.find('[role="alert"]').textContent, 'PASSWORD_REJECTED'); assert.ok(view.root.find('form'));
  view.handlers['/api/v1/auth/reset-password/'] = () => Promise.reject({ data: { error: '링크가 만료되었습니다. 새로운 재설정 링크를 요청해주세요.' } });
  const expired = signal(() => !!view.root.find('[data-state="expired"]')); await submit(view); await expired;
  assert.equal(view.root.find('form'), undefined); assert.ok(view.root.find('[href="/auth/forgot-password"]'));
});

test('verify missing/failed token supports truthful public resend and authenticated resend contracts', options, async () => {
  const first = deferred();
  const view = await page('pages/auth/verify-email.vue', { handlers: { '/api/v1/auth/send-verification/': () => first.promise, '/api/v1/auth/resend-verification/': () => ({ success: true }) } });
  assert.ok(view.root.find('[data-state="error"]')); assert.equal(view.requests.length, 0);
  assert.equal(view.root.find('[type="submit"]').props.disabled, true); await input(view, '#email', 'person@example.com');
  const requested = signal(() => view.requests.length === 1); await submit(view); await submit(view); await requested;
  assert.deepEqual(view.requests, [{ path: '/api/v1/auth/send-verification/', body: { email: 'person@example.com' } }]);
  const done = signal(() => view.root.find('[type="submit"]').props.disabled === false); first.resolve({ success: true }); await done;
  assert.ok(view.root.find('[role="status"]')); assert.ok(view.root.find('[href="/support"]'));
  view.auth.setUser({ id: 1, nickname: 'SignedIn', email: 'person@example.com' }); await Vue.nextTick();
  assert.equal(view.root.find('#email'), undefined);
  const resent = signal(() => view.requests.length === 2); await submit(view); await resent;
  assert.deepEqual(view.requests[1], { path: '/api/v1/auth/resend-verification/', body: undefined });
});

test('forgot request and resend count advance only for accepted server responses; requests are serialized', options, async () => {
  const request = deferred(), resend = deferred();
  const view = await page('pages/auth/forgot-password.vue', { handlers: { '/api/v1/auth/request-password-reset/': () => request.promise } });
  assert.equal(view.root.find('[type="submit"]').props.disabled, true); await input(view, '#email', 'person@example.com');
  const requested = signal(() => view.requests.length === 1); await submit(view); await submit(view); await requested;
  const accepted = signal(() => !!view.root.find('[data-state="requested"]')); request.resolve({ success: true }); await accepted;
  assert.equal(view.root.find('[data-resend-count="1"]'), undefined);
  view.handlers['/api/v1/auth/request-password-reset/'] = () => resend.promise;
  const failed = signal(() => !!view.root.find('[role="alert"]')); await click(view.root.find('button')); resend.reject({ data: { error_code: 'throttled', error: 'THROTTLED' } }); await failed;
  assert.equal(view.root.find('[data-resend-count="1"]'), undefined); assert.ok(view.root.find('code').textContent.includes('throttled'));
  await signal(() => !view.root.find('button').props.disabled);
  view.handlers['/api/v1/auth/request-password-reset/'] = () => ({ success: true });
  const resent = signal(() => !!view.root.find('[data-resend-count="1"]')); await click(view.root.find('button')); await resent;
  assert.deepEqual(view.requests.map(r => r.body), Array(3).fill({ email: 'person@example.com' }));
});

test('callback cleanup cancels the unfired retry timer on early unmount', options, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); const clear = t.mock.method(globalThis, 'clearTimeout');
  const pending = deferred();
  const view = await page('pages/auth/[provider]/callback.vue', { params: { provider: 'google' }, query: { code: 'oauth-code' }, handlers: { '/api/v1/auth/social-login/v2/': () => pending.promise } });
  assert.equal(clear.mock.calls.length, 0); view.app.unmount(); apps.splice(apps.indexOf(view.app), 1);
  assert.equal(clear.mock.calls.length, 1); t.mock.timers.tick(3000); assert.equal(view.root.find('.callback-retry'), undefined);
});

for (const path of ['pages/login.vue', 'pages/register-email.vue', 'pages/auth/error.vue', 'pages/auth/forgot-password.vue', 'pages/auth/reset-password.vue', 'pages/auth/verify-email.vue', 'pages/auth/[provider]/callback.vue', 'pages/auth/apple/setup.vue', 'pages/auth/google/setup.vue', 'pages/auth/kakao/setup.vue', 'components/auth/AuthShell.vue', 'components/auth/AuthSocialSignupForm.vue', 'components/auth/AuthPasswordStrength.vue']) {
  test(`${path} compiles styles without leaking dark selectors onto the document root`, async () => {
    const filename = resolve(appDir, path), { descriptor } = parse(await readFile(filename, 'utf8'), { filename });
    for (const style of descriptor.styles) {
      const result = compileStyle({ source: style.content, filename, id: 'data-v-auth-qa', scoped: style.scoped }); assert.deepEqual(result.errors, []);
      assert.doesNotMatch(result.code, /(?:^|})\s*\[data-theme=["']dark["']\]\s*\{/);
    }
  });
}
