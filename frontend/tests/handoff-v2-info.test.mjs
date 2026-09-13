import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import { afterEach, test } from 'node:test';
import { build } from 'esbuild';
import { compileScript, parse } from '@vue/compiler-sfc';

const require = createRequire(import.meta.url);
const Vue = require('vue');
const Router = require('vue-router');
const appDir = process.env.INFO_TEST_APP_DIR ?? fileURLToPath(new URL('../app/', import.meta.url));
const cache = new Map();
const events = new EventEmitter();
let env;
const signal = () => queueMicrotask(() => events.emit('render'));
const layout = Vue.defineComponent({ setup: (_, { slots }) => () => Vue.h('div', { class: 'page-layout' }, slots.default?.()) });
async function load(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const mocks = {
    '~/components/common/PageLayout.vue': 'module.exports = globalThis.__infoEnv.layout',
    '#imports': 'exports.useHead = () => {}',
    '#app': 'exports.useRuntimeConfig = () => globalThis.__infoEnv.config',
    '~/composables/useAuthService': 'exports.useAuthService = () => globalThis.__infoEnv.auth',
    '#components': 'exports.NuxtLink = require("vue-router").RouterLink',
  };
  const result = await build({
    entryPoints: [resolve(appDir, relative)], bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
    external: ['vue', 'vue-router', '@lucide/vue'],
    plugins: [{ name: 'info-runtime', setup(b) {
      b.onResolve({ filter: /^(~\/|#)/ }, ({ path }) => mocks[path] ? { path, namespace: 'mock' } : { path: resolve(appDir, path.slice(2) + (/\.(vue|ts|json)$/.test(path) ? '' : '.ts')) });
      b.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: mocks[path], loader: 'js' }));
      b.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
        const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path });
        assert.deepEqual(errors, []);
        return { contents: compileScript(descriptor, { id: path, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } }).content, loader: 'ts', resolveDir: dirname(path) };
      });
    } }],
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);
  cache.set(relative, module.exports.default);
  return module.exports.default;
}
class Node {
  constructor(tag, text = '') { Vue.markRaw(this); this.tag = tag; this.text = text; this.props = {}; this.children = []; this.parent = null; this.scrollTop = 0; this.clientTop = 0; }
  get id() { return this.props.id; }
  get textContent() { return this.text + (this.props.innerHTML ?? '') + this.children.map(n => n.textContent).join(''); }
  get markup() { return this.tag.startsWith('#') ? this.text : `<${this.tag}>${this.text}${this.props.innerHTML ?? ''}${this.children.map(n => n.markup).join('')}</${this.tag}>`; }
  all(predicate) { return this.children.flatMap(n => [...(predicate(n) ? [n] : []), ...n.all(predicate)]); }
  querySelectorAll(selector) { assert.equal(selector, '[id]'); return this.all(n => !!n.id); }
  getBoundingClientRect() {
    if (this.props['data-testid'] === 'info-scroll') return { top: 120 };
    const owner = env.find('info-scroll');
    return { top: 120 + this.clientTop + Number(this.id?.split('-').at(-1) ?? 0) * 100 - (owner?.scrollTop ?? 0) };
  }
  focus(options) { env.focus = { node: this, options }; }
}
const renderer = Vue.createRenderer({
  createElement: tag => new Node(tag), createText: text => new Node('#text', text), createComment: () => new Node('#comment'),
  setText(n, text) { n.text = text; signal(); }, setElementText(n, text) { n.text = text; n.children = []; signal(); },
  patchProp(n, key, _old, value) { n.props[key] = value; signal(); },
  insert(n, p, anchor) { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); p.children.splice(anchor ? p.children.indexOf(anchor) : p.children.length, 0, n); n.parent = p; signal(); },
  remove(n) { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; signal(); },
  parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
  setScopeId() {}, insertStaticContent() { throw new Error('Unexpected static content'); },
});
// Signals subscribe before actions. The timeout is only a failure bound, never a delay.
function rendered(predicate, action = () => {}) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Expected information-page render was not reached')); }, 2000);
    const cleanup = () => { clearTimeout(timeout); events.off('render', check); };
    const check = () => { if (predicate()) { cleanup(); resolve(); } };
    events.on('render', check);
    Promise.resolve().then(action).then(Vue.nextTick).then(check, error => { cleanup(); reject(error); });
  });
}
const receipt = { receipt_id: '10ec28ec-a128-4444-9876-2bbc8a2b4a6a', status: 'received' };
const jsonResponse = (body = receipt, status = 201, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const deferred = () => Promise.withResolvers();
const originals = new Map(['window', 'fetch', 'document', 'localStorage', '__infoEnv'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
async function mount(path = '/company', authenticated = true) {
  env = { layout, handoffs: [], requests: [], focus: null, response: () => jsonResponse(), refreshes: 0, logouts: 0,
    config: { public: { apiBase: 'https://support-api.invalid', csrfCookieName: 'beta_csrftoken' } },
    auth: { isAuthenticated: Vue.ref(authenticated), refreshToken: async () => { env.refreshes++; return { ok: false, reason: 'unavailable' }; }, logout: () => { env.logouts++; } },
  };
  globalThis.__infoEnv = env;
  globalThis.window = { location: { assign: url => { env.handoffs.push(url); if (env.handoffError) throw env.handoffError; } }, scrollTo: () => assert.fail('Must not scroll the window') };
  globalThis.document = { cookie: 'csrftoken=primary-token; beta_csrftoken=beta-token' };
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  // Only the transport boundary is replaced: the real generated facade, CSRF and retry code run.
  globalThis.fetch = (...args) => { env.requests.push(args); return env.response(...args); };
  const routes = await Promise.all(['company', 'terms', 'privacy', 'support'].map(async page => ({ path: `/${page}`, component: await load(`pages/${page}.vue`) })));
  env.router = Router.createRouter({ history: Router.createMemoryHistory(), routes });
  await env.router.push(path);
  const app = renderer.createApp(Router.RouterView);
  app.use(env.router); app.component('NuxtLink', Router.RouterLink);
  env.app = app; env.root = new Node('root');
  env.find = id => env.root.all(n => n.props['data-testid'] === id)[0];
  app.mount(env.root);
  await Vue.nextTick();
  return env;
}
afterEach(() => { env?.app?.unmount(); events.removeAllListeners(); for (const [key, value] of originals) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]; } });
async function click(node) {
  assert.ok(node, 'click target exists');
  const event = { button: 0, stopped: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, stopImmediatePropagation() { this.stopped = true; } };
  for (const handler of [node.props.onClickCapture, node.props.onClick].flat()) if (handler && !event.stopped) await handler(event);
  await Vue.nextTick();
}
async function input(node, value) { assert.ok(node, 'input exists'); node.props.onInput({ target: { value } }); await Vue.nextTick(); }
async function submit(view) { const form = view.find('inquiry-form'); assert.ok(form, 'inquiry form exists'); await form.props.onSubmit({ preventDefault() {} }); await Vue.nextTick(); }
const normalize = html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

for (const page of ['company', 'terms', 'privacy', 'support']) {
  test(`direct /${page} selects exactly its route link and exposes all four canonical routes`, async () => {
    const view = await mount(`/${page}`);
    const nav = view.find('info-tabs'); assert.ok(nav, 'shared information tabs exist');
    const links = nav.all(n => n.tag === 'a');
    assert.deepEqual(links.map(n => n.props.href), ['/company', '/terms', '/privacy', '/support']);
    assert.deepEqual(links.filter(n => n.props['aria-current'] === 'page').map(n => n.props.href), [`/${page}`]);
    assert.ok(view.find('info-scroll'));
  });
}

test('tab navigation, browser history and query changes remain synchronized', async () => {
  const view = await mount('/company');
  await rendered(() => view.router.currentRoute.value.path === '/support' && !!view.find('inquiry-form'), () => click(view.find('info-tab-support')));
  await view.router.push('/privacy?from=signup'); await Vue.nextTick();
  assert.equal(view.find('info-tab-privacy').props['aria-current'], 'page');
  await rendered(() => view.router.currentRoute.value.path === '/support' && !!view.find('inquiry-form'), () => new Promise(resolve => { const off = view.router.afterEach(() => { off(); resolve(); }); view.router.back(); }));
  assert.equal(view.find('info-tab-support').props['aria-current'], 'page');
});

for (const page of ['terms', 'privacy']) {
  test(`${page} ships every existing legal paragraph and exposes a target for every TOC link`, async () => {
    const view = await mount(`/${page}`);
    const fixture = await readFile(new URL(`./fixtures/info/${page}.html`, import.meta.url), 'utf8');
    const copy = view.find('legal-copy') ?? view.root.all(n => n.props.class === 'legal-content')[0];
    assert.ok(copy, 'legal copy renders');
    assert.equal(normalize(copy.markup), normalize(fixture));
    const toc = view.find('legal-toc'); assert.ok(toc, 'table of contents exists');
    const links = toc.all(n => n.tag === 'a'); assert.equal(links.length, 11);
    assert.equal(new Set(links.map(n => n.props.href)).size, 11);
    for (const link of links) assert.ok(view.root.all(n => n.id === link.props.href.slice(1))[0], `target for ${link.props.href}`);
  });

  test(`${page} anchors scroll and focus only the owned container, including repeat clicks and deep links`, async () => {
    const view = await mount(`/${page}?from=signup#${page}-3`);
    const scroll = view.find('info-scroll'); assert.ok(scroll, 'owned scroll region exists');
    await Vue.nextTick();
    assert.equal(scroll.scrollTop, 300);
    assert.equal(view.focus.node.id, `${page}-3`);
    assert.deepEqual(view.focus.options, { preventScroll: true });
    const link = view.find('legal-toc').all(n => n.props.href === `#${page}-7`)[0];
    await click(link); await Vue.nextTick();
    assert.equal(scroll.scrollTop, 700);
    assert.equal(view.router.currentRoute.value.hash, `#${page}-3`, 'TOC scroll does not invoke Nuxt window/hash navigation');
    assert.equal(view.router.currentRoute.value.query.from, 'signup');
    scroll.scrollTop = 50;
    await click(link);
    assert.equal(scroll.scrollTop, 700);
    await view.router.push(`/${page}#missing`); await Vue.nextTick();
    assert.equal(scroll.scrollTop, 700);
    await view.router.push(`/${page}`); await Vue.nextTick();
    assert.equal(scroll.scrollTop, 0);
  });
}

test('FAQ has four accessible toggles, first initially open, independent expansion and collapse', async () => {
  const view = await mount('/support');
  const buttons = view.root.all(n => n.tag === 'button' && n.props['aria-expanded'] !== undefined);
  assert.equal(buttons.length, 4);
  assert.deepEqual(buttons.map(n => n.props['aria-expanded']), [true, false, false, false]);
  await click(buttons[1]);
  assert.equal(buttons[0].props['aria-expanded'], true);
  assert.equal(buttons[1].props['aria-expanded'], true);
  assert.ok(view.root.all(n => n.id === buttons[1].props['aria-controls'])[0]);
  await click(buttons[0]);
  assert.equal(buttons[0].props['aria-expanded'], false);
});

test('invalid and whitespace-only inquiries never POST; optional email is validated', async () => {
  const view = await mount('/support');
  assert.equal(view.find('inquiry-submit')?.props.disabled, true, 'empty message disables composition');
  await submit(view);
  assert.equal(view.find('inquiry-message').props['aria-invalid'], true);
  await input(view.find('inquiry-message'), '   \n '); await submit(view);
  assert.deepEqual(view.handoffs, []);
  await input(view.find('inquiry-message'), 'Readable issue');
  await input(view.find('inquiry-email'), 'broken@');
  await submit(view);
  assert.equal(view.find('inquiry-email').props['aria-invalid'], true);
  assert.equal(view.find('inquiry-submit').props.disabled, true);
  await input(view.find('inquiry-email'), '');
  assert.equal(view.find('inquiry-submit').props.disabled, false);
  await input(view.find('inquiry-message'), 'x'.repeat(2001)); await submit(view);
  assert.equal(view.find('inquiry-submit').props.disabled, true);
  assert.deepEqual(view.handoffs, []);
  assert.deepEqual(view.requests, []);
});

test('real facade posts bounded fields with cookie CSRF and only a receipt clears the draft', async () => {
  const view = await mount('/support');
  const gate = deferred(); view.response = () => gate.promise;
  const message = '  문의 & details?\ncc=other@example.test # <tag>  ';
  await input(view.find('inquiry-message'), message);
  await input(view.find('inquiry-email'), ' reader@example.test ');
  await click(view.find('inquiry-kind-feature'));
  let flight;
  await rendered(() => view.find('inquiry-submit').props['aria-busy'] === true, () => { flight = submit(view); });
  assert.equal(view.requests.length, 1);
  const [url, options] = view.requests[0];
  assert.equal(url, 'https://support-api.invalid/api/v1/support/inquiries/');
  assert.equal(options.method, 'POST');
  assert.equal(options.credentials, 'include');
  assert.equal(options.headers['X-CSRFToken'], 'beta-token');
  assert.equal(options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(options.body), { kind: 'feature', message: message.trim(), email: 'reader@example.test' });
  assert.equal(view.find('inquiry-message').props.value, message);
  assert.equal(view.find('inquiry-message').props.disabled, true);
  assert.equal(view.find('inquiry-email').props.disabled, true);
  assert.equal(view.find('inquiry-kind-other').props.disabled, true);
  assert.equal(view.find('inquiry-pending')?.props.role, 'status');
  assert.equal(view.find('inquiry-receipt'), undefined);
  await submit(view); await click(view.find('inquiry-kind-other'));
  assert.equal(view.requests.length, 1, 'double-submit cannot create another request');
  await rendered(() => !!view.find('inquiry-receipt'), () => gate.resolve(jsonResponse()));
  await flight;
  assert.equal(view.find('inquiry-receipt').props.role, 'status');
  assert.equal(view.find('inquiry-receipt-id').textContent, receipt.receipt_id);
  assert.equal(view.find('inquiry-receipt').props['data-status'], receipt.status);
  assert.equal(view.find('inquiry-message').props.value, '');
  assert.equal(view.find('inquiry-email').props.value, '');
  assert.equal(view.find('inquiry-message').props['aria-invalid'], false);
  assert.equal(view.find('inquiry-submit').props.disabled, true);
  assert.equal(view.find('inquiry-pending'), undefined);
  assert.deepEqual(view.handoffs, []);
  await input(view.find('inquiry-message'), 'New draft');
  assert.equal(view.find('inquiry-receipt'), undefined);
});

test('anonymous support reaches the real public facade without caller identity or inferred email', async () => {
  const view = await mount('/support', false);
  await input(view.find('inquiry-message'), 'Anonymous issue'); await submit(view);
  assert.equal(view.requests.length, 1, 'shared facade must allow public support POST');
  assert.deepEqual(JSON.parse(view.requests[0][1].body), { kind: 'bug', message: 'Anonymous issue' });
  assert.equal(view.find('inquiry-receipt-id')?.textContent, receipt.receipt_id);
  assert.equal(view.refreshes, 0);
});

test('all generated inquiry kinds POST independently; optional email is omitted and trimmed message limit is accepted', async () => {
  const view = await mount('/support');
  for (const kind of ['bug', 'feature', 'account', 'other']) {
    await input(view.find('inquiry-message'), `  ${'x'.repeat(2000)}  `);
    await input(view.find('inquiry-email'), '  ');
    await click(view.find(`inquiry-kind-${kind}`)); await submit(view);
    assert.equal(view.requests.length, ['bug', 'feature', 'account', 'other'].indexOf(kind) + 1);
    assert.deepEqual(JSON.parse(view.requests.at(-1)[1].body), { kind, message: 'x'.repeat(2000) });
  }
});

for (const [status, reason, body] of [
  [400, 'validation', { kind: ['invalid_kind'], message: ['message_rejected'], email: ['email_rejected'] }],
  [401, 'auth', { detail: 'csrf_rejected' }],
  [403, 'auth', { detail: 'forbidden' }],
  [429, 'rate-limit', { detail: 'throttled' }],
  [503, 'unavailable', { detail: 'storage_failed' }],
]) {
  test(`${status} response never acknowledges, preserves draft, and permits explicit retry`, async () => {
    const view = await mount('/support');
    view.response = () => jsonResponse(body, status);
    await input(view.find('inquiry-message'), 'Keep this draft');
    await input(view.find('inquiry-email'), 'reply@example.test');
    await submit(view);
    assert.equal(view.find('inquiry-error')?.props.role, 'alert');
    assert.equal(view.find('inquiry-error')?.props['data-reason'], reason);
    assert.equal(view.find('inquiry-receipt'), undefined);
    assert.equal(view.find('inquiry-message').props.value, 'Keep this draft');
    assert.equal(view.find('inquiry-email').props.value, 'reply@example.test');
    assert.equal(view.requests.length, 1);
    assert.equal(view.logouts, 0);
    if (status === 400) {
      for (const field of ['kind', 'message', 'email']) {
        const error = view.root.all(n => n.id === `inquiry-${field}-error`)[0];
        assert.ok(error.textContent.includes(body[field][0]));
      }
      assert.equal(view.find('inquiry-message').props['aria-invalid'], true);
      assert.equal(view.find('inquiry-email').props['aria-invalid'], true);
    }
    assert.equal(view.find('support-email').props.href, 'mailto:support@maeil1dok.app');
    view.response = () => jsonResponse();
    await submit(view);
    assert.equal(view.requests.length, 2);
    assert.ok(view.find('inquiry-receipt'));
    assert.equal(view.find('inquiry-error'), undefined);
  });
}

test('401 recovery remains inside the facade and retries with rotated CSRF only after rejection', async () => {
  const view = await mount('/support');
  view.response = () => view.requests.length === 1 ? jsonResponse({ detail: 'expired' }, 401) : jsonResponse();
  view.auth.refreshToken = async () => { view.refreshes++; localStorage.setItem('csrfToken:beta_csrftoken', 'rotated-token'); return { ok: true }; };
  await input(view.find('inquiry-message'), 'Member issue'); await submit(view);
  assert.equal(view.refreshes, 1); assert.equal(view.requests.length, 2);
  assert.equal(view.requests[1][1].headers['X-CSRFToken'], 'rotated-token');
  assert.equal(view.requests[1][1].credentials, 'include');
  assert.ok(view.find('inquiry-receipt'));
});

for (const [name, response] of [
  ['network loss', () => Promise.reject(new TypeError('transport lost'))],
  ['invalid JSON', () => new Response('{', { status: 201 })],
  ['empty acknowledgement', () => new Response(null, { status: 204 })],
  ['missing receipt', () => jsonResponse({ status: 'received' })],
  ['wrong status', () => jsonResponse({ ...receipt, status: 'sent' })],
  ['invalid receipt id', () => jsonResponse({ ...receipt, receipt_id: '' })],
]) {
  test(`${name} is unknown, never a receipt and never automatically retried`, async () => {
    const view = await mount('/support'); view.response = response;
    await input(view.find('inquiry-message'), 'Unconfirmed draft'); await submit(view);
    assert.equal(view.find('inquiry-error')?.props['data-reason'], 'unknown');
    assert.equal(view.find('inquiry-receipt'), undefined);
    assert.equal(view.find('inquiry-message').props.value, 'Unconfirmed draft');
    assert.equal(view.requests.length, 1); assert.equal(view.refreshes, 0);
    assert.equal(view.find('inquiry-submit').props.disabled, false);
  });
}

test('late receipt cannot erase a changed draft, and remount cannot inherit an abandoned request', async () => {
  const view = await mount('/support');
  const gate = deferred(); view.response = () => gate.promise;
  await input(view.find('inquiry-message'), 'Original draft');
  let flight;
  await rendered(() => !!view.find('inquiry-pending'), () => { flight = submit(view); });
  // Simulate a programmatic edit despite disabled native controls.
  await input(view.find('inquiry-message'), 'Newer draft');
  await rendered(() => !view.find('inquiry-pending'), () => gate.resolve(jsonResponse())); await flight;
  assert.equal(view.find('inquiry-message').props.value, 'Newer draft');
  assert.equal(view.find('inquiry-receipt'), undefined);
  const abandoned = deferred(); view.response = () => abandoned.promise;
  await rendered(() => !!view.find('inquiry-pending'), () => { flight = submit(view); });
  await view.router.push('/company'); await Vue.nextTick();
  await view.router.push('/support'); await Vue.nextTick();
  await input(view.find('inquiry-message'), 'Remounted draft');
  abandoned.resolve(jsonResponse()); await flight;
  assert.equal(view.find('inquiry-message').props.value, 'Remounted draft');
  assert.equal(view.find('inquiry-receipt'), undefined);
  assert.equal(view.requests.length, 2);
});

test('company uses existing business/contact identifiers and explicitly unavailable statistics', async () => {
  const view = await mount('/company');
  assert.equal(view.find('company-email')?.props.href, 'mailto:support@maeil1dok.app');
  assert.equal(view.find('company-verification')?.props.href, 'https://www.ftc.go.kr/bizCommPop.do?wrkr_no=6132462749');
  assert.equal(view.find('company-service-start')?.props['data-available'], false);
  assert.equal(view.find('company-readers')?.props['data-available'], false);
});
