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
const appDir = fileURLToPath(new URL('../app/', import.meta.url));
const cache = new Map();
const events = new EventEmitter();
const signal = () => queueMicrotask(() => events.emit('render'));
let env;
const layout = Vue.defineComponent({ setup: (_, { slots }) => () => Vue.h('main', slots.default?.()) });
async function load(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const mocks = {
    '~/components/common/PageLayout.vue': 'module.exports = globalThis.__noticeInstall.layout',
    // Overlay ownership is covered by the shared primitive suite, not these page tests.
    '~/composables/useFocusTrap': 'exports.useFocusTrap = () => ({ isTopmost: require("vue").ref(true), zIndex: require("vue").ref(100) })',
    '~/composables/useScrollLock': 'exports.useScrollLock = () => {}',
    '#imports': 'exports.useHead = value => globalThis.__noticeInstall.head = value',
    '#components': 'exports.NuxtLink = require("vue-router").RouterLink',
  };
  const result = await build({
    entryPoints: [resolve(appDir, relative)], bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
    external: ['vue', 'vue-router', '@lucide/vue'],
    plugins: [{ name: 'notice-install-runtime', setup(b) {
      b.onResolve({ filter: /^(~\/|#)/ }, ({ path }) => mocks[path] ? { path, namespace: 'mock' } : { path: resolve(appDir, path.slice(2) + (/\.(vue|ts)$/.test(path) ? '' : '.ts')) });
      b.onLoad({ filter: /.*/, namespace: 'mock' }, ({ path }) => ({ contents: mocks[path], loader: 'js' }));
      b.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
        const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path });
        assert.deepEqual(errors, []);
        return { contents: compileScript(descriptor, { id: path, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } }).content, loader: 'ts', resolveDir: dirname(path) };
      });
    } }],
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(name => name === 'vue' ? { ...Vue, Transition: Vue.BaseTransition } : require(name), module, module.exports);
  cache.set(relative, module.exports.default);
  return module.exports.default;
}
class Node {
  constructor(tag, text = '') { Vue.markRaw(this); this.tag = tag; this.text = text; this.props = {}; this.children = []; this.parent = null; this.style = {}; }
  get textContent() { return this.text + this.children.map(n => n.textContent).join(''); }
  get parentElement() { return this.parent; }
  all(predicate) { return this.children.flatMap(n => [...(predicate(n) ? [n] : []), ...n.all(predicate)]); }
  querySelectorAll(selector) { return this.all(n => selector === '[role="tab"]' && n.props.role === 'tab'); }
  focus() { env.focused = this; }
}
const renderer = Vue.createRenderer({
  createElement: tag => new Node(tag), createText: text => new Node('#text', text), createComment: () => new Node('#comment'),
  setText(n, text) { n.text = text; signal(); }, setElementText(n, text) { n.text = text; n.children = []; signal(); },
  patchProp(n, key, _old, value) { n.props[key] = value; signal(); },
  insert(n, p, anchor) { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); p.children.splice(anchor ? p.children.indexOf(anchor) : p.children.length, 0, n); n.parent = p; signal(); },
  remove(n) { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; signal(); },
  parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
  querySelector: () => env.body, setScopeId() {}, insertStaticContent() { throw new Error('Unexpected static content'); },
});
function rendered(predicate, action) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Expected rendered state was not reached')); }, 2000);
    const cleanup = () => { clearTimeout(timeout); events.off('render', check); };
    const check = () => { if (predicate()) { cleanup(); resolve(); } };
    events.on('render', check);
    Promise.resolve().then(action).then(check, error => { cleanup(); reject(error); });
  });
}
class BrowserTarget extends EventTarget {
  listeners = new Map();
  addEventListener(type, listener, options) { super.addEventListener(type, listener, options); const set = this.listeners.get(type) ?? new Set(); set.add(listener); this.listeners.set(type, set); }
  removeEventListener(type, listener, options) { super.removeEventListener(type, listener, options); this.listeners.get(type)?.delete(listener); }
  count(type) { return this.listeners.get(type)?.size ?? 0; }
}
const originals = new Map(['window', 'document', 'navigator', '__noticeInstall'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
async function mount(path = '/install', { userAgent = 'Android Chrome', standalone = false, iosStandalone = false, maxTouchPoints = 0 } = {}) {
  env = { layout, body: new Node('body'), window: new BrowserTarget(), media: new BrowserTarget() };
  env.media.matches = standalone;
  env.window.matchMedia = query => { assert.equal(query, '(display-mode: standalone)'); return env.media; };
  globalThis.__noticeInstall = env;
  globalThis.window = env.window;
  globalThis.document = Object.assign(new BrowserTarget(), { body: env.body });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent, standalone: iosStandalone, maxTouchPoints } });
  const guide = await load('components/PWAInstallGuide.vue');
  const routes = [
    { path: '/install', component: await load('pages/install.vue') },
    { path: '/notice', component: await load('pages/notice/index.vue') },
    { path: '/notice/plan-update', component: await load('pages/notice/plan-update.vue') },
    { path: '/plans', component: layout },
  ];
  env.router = Router.createRouter({ history: Router.createMemoryHistory(), routes });
  await env.router.push(path);
  env.app = renderer.createApp(Router.RouterView);
  env.app.use(env.router); env.app.component('NuxtLink', Router.RouterLink); env.app.component('PWAInstallGuide', guide);
  env.app.component('NuxtImg', Vue.defineComponent({ setup: (_, { attrs }) => () => Vue.h('img', attrs) }));
  env.root = new Node('root'); env.app.mount(env.root); await Vue.nextTick();
  env.all = predicate => [...env.root.all(predicate), ...env.body.all(predicate)];
  env.find = id => env.all(n => n.props['data-testid'] === id)[0];
  env.id = id => env.all(n => n.props.id === id)[0];
  env.state = () => env.find('install-guide')?.props['data-install-state'];
  return env;
}
afterEach(() => { env?.app?.unmount(); events.removeAllListeners(); for (const [key, value] of originals) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]; } });
async function click(node) {
  assert.ok(node, 'activation target exists');
  const event = { button: 0, stopped: false, preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() { this.stopped = true; } };
  for (const handler of [node.props.onClickCapture, node.props.onClick].flat()) if (handler && !event.stopped) await handler(event);
  await Vue.nextTick();
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function installEvent({ prompt = async () => {}, choice = Promise.resolve({ outcome: 'dismissed' }) } = {}) {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.calls = 0; event.prompt = () => { event.calls++; return prompt(); }; event.userChoice = choice;
  return event;
}
async function offer(view, event = installEvent()) { view.window.dispatchEvent(event); await Vue.nextTick(); return event; }

// Assertions concern state/ARIA, links, and event contracts, never shipped prose.
test('notice accordion starts with only the first expanded and toggles independently', async () => {
  const view = await mount('/notice');
  const toggles = () => view.all(n => n.tag === 'button' && n.props['aria-controls']?.startsWith('notice-panel-'));
  assert.deepEqual(toggles().map(n => n.props['aria-expanded']), [true, false, false]);
  for (const toggle of toggles()) assert.ok(view.id(toggle.props['aria-controls']));
  await click(toggles()[1]);
  assert.deepEqual(toggles().map(n => n.props['aria-expanded']), [true, true, false]);
  await click(toggles()[0]);
  assert.deepEqual(toggles().map(n => n.props['aria-expanded']), [false, true, false]);
  assert.equal(view.id('notice-panel-plan-update').props.hidden, true);
});

test('notice links navigate through real router and detail retains three feature cards', async () => {
  const view = await mount('/notice');
  const link = href => view.all(n => n.tag === 'a' && n.props.href === href)[0];
  await rendered(() => view.router.currentRoute.value.path === '/notice/plan-update' && !!view.find('notice-features'), () => click(link('/notice/plan-update')));
  assert.equal(view.find('notice-features').all(n => n.props['data-feature'] !== undefined).length, 3);
  assert.equal(view.all(n => n.tag === 'time')[0].props.datetime, '2025-03-01');
  await rendered(() => view.router.currentRoute.value.path === '/plans', () => click(link('/plans')));
  await view.router.push('/notice'); await Vue.nextTick();
  await click(view.id('notice-toggle-install'));
  await rendered(() => !!view.find('install-guide'), () => click(link('/install')));
  assert.equal(view.router.currentRoute.value.path, '/install');
  assert.equal(view.head.link[0].href, 'https://maeil1dok.app/install');
});

for (const [userAgent, maxTouchPoints, expected] of [['iPhone Safari', 0, 'ios'], ['Macintosh Safari', 5, 'ios'], ['Android Chrome', 0, 'android']]) {
  test(`platform detection, three steps and keyboard tabs: ${userAgent}`, async () => {
    const view = await mount('/install', { userAgent, maxTouchPoints });
    assert.equal(view.id(`install-tab-${expected}`).props['aria-selected'], true);
    assert.equal(view.all(n => n.props['data-install-step'] !== undefined).length, 3);
    const tab = view.id(`install-tab-${expected}`);
    assert.equal(view.id(tab.props['aria-controls']).props['aria-labelledby'], tab.props.id);
    const other = expected === 'ios' ? 'android' : 'ios';
    tab.props.onKeydown({ key: 'ArrowRight', currentTarget: tab, preventDefault() {} }); await Vue.nextTick();
    assert.equal(view.id(`install-tab-${other}`).props['aria-selected'], true);
    assert.equal(view.focused, view.id(`install-tab-${other}`));
    assert.equal(view.find('install-prompt'), undefined);
  });
}

test('Android alone is not eligibility; browser event enables prompt only on Android', async () => {
  const view = await mount();
  assert.equal(view.state(), 'unavailable'); assert.equal(view.find('install-prompt'), undefined);
  const event = await offer(view);
  assert.equal(event.defaultPrevented, true); assert.ok(view.find('install-prompt')); assert.equal(event.calls, 0);
  await click(view.id('install-tab-ios')); assert.equal(view.find('install-prompt'), undefined);
  await click(view.id('install-tab-android')); assert.ok(view.find('install-prompt'));
});

test('single-use prompt is consumed before await, dismissal requires a fresh event', async () => {
  const view = await mount(); const choice = deferred(); const opened = deferred();
  const event = await offer(view, installEvent({ prompt: () => opened.promise, choice: choice.promise }));
  const button = view.find('install-prompt'); let pending;
  await rendered(() => view.state() === 'prompting', () => { pending = click(button); });
  await click(button); assert.equal(event.calls, 1); assert.equal(view.find('install-prompt')?.props.disabled, true);
  opened.resolve();
  await rendered(() => view.state() === 'dismissed', () => choice.resolve({ outcome: 'dismissed' })); await pending;
  assert.equal(view.find('install-prompt'), undefined); assert.equal(view.find('install-already'), undefined);
  await offer(view); assert.ok(view.find('install-prompt'));
});

test('accepted choice is not installed; only appinstalled confirms and discards eligibility', async () => {
  const view = await mount();
  const event = await offer(view, installEvent({ choice: Promise.resolve({ outcome: 'accepted' }) }));
  await click(view.find('install-prompt'));
  assert.equal(event.calls, 1); assert.equal(view.state(), 'accepted'); assert.equal(view.find('install-already'), undefined);
  view.window.dispatchEvent(new Event('appinstalled')); await Vue.nextTick();
  assert.equal(view.state(), 'installed'); assert.ok(view.find('install-already'));
  assert.equal(view.all(n => n.props.role === 'tab').length, 0);
  const late = await offer(view); assert.equal(late.defaultPrevented, false); assert.equal(view.find('install-prompt'), undefined);
});

for (const options of [{ standalone: true }, { iosStandalone: true }]) {
  test(`standalone replaces instructions without a prompt: ${JSON.stringify(options)}`, async () => {
    const view = await mount('/install', options);
    assert.equal(view.state(), 'installed'); assert.ok(view.find('install-already'));
    assert.equal(view.all(n => n.props['data-install-step'] !== undefined).length, 0);
    assert.equal(view.find('install-prompt'), undefined);
  });
}

test('display-mode changes invalidate pending choice and all event listeners are removed on navigation', async () => {
  const view = await mount(); const choice = deferred();
  await offer(view, installEvent({ choice: choice.promise })); let pending;
  await rendered(() => view.state() === 'prompting', () => { pending = click(view.find('install-prompt')); });
  view.media.matches = true; view.media.dispatchEvent(new Event('change')); await Vue.nextTick();
  assert.equal(view.state(), 'installed');
  choice.resolve({ outcome: 'dismissed' }); await pending; assert.equal(view.state(), 'installed');
  assert.equal(view.window.count('beforeinstallprompt'), 1);
  await view.router.push('/notice'); await Vue.nextTick();
  assert.equal(view.window.count('beforeinstallprompt'), 0); assert.equal(view.window.count('appinstalled'), 0); assert.equal(view.media.count('change'), 0);
});

for (const boundary of ['prompt', 'userChoice']) {
  test(`${boundary} rejection reports error without success or reusable event`, async () => {
    const view = await mount(); const choice = deferred();
    const event = await offer(view, installEvent(boundary === 'prompt' ? { prompt: async () => { throw new Error('not allowed'); } } : { choice: choice.promise }));
    let pending;
    await rendered(() => view.state() === (boundary === 'prompt' ? 'error' : 'prompting'), () => { pending = click(view.find('install-prompt')); });
    if (boundary === 'userChoice') await rendered(() => view.state() === 'error', () => choice.reject(new Error('choice failed')));
    await pending;
    assert.equal(event.calls, 1); assert.equal(view.find('install-status').props.role, 'alert'); assert.equal(view.find('install-already'), undefined); assert.equal(view.find('install-prompt'), undefined);
  });
}

test('choice rejection is observed even while prompt() is still pending', async () => {
  const view = await mount(); const opened = deferred(); const choice = deferred();
  // Observe the expected fixture rejection before triggering it; the component must
  // independently leave prompting, not rely on this observer to update its state.
  const rejected = assert.rejects(choice.promise, /choice failed/);
  await offer(view, installEvent({ prompt: () => opened.promise, choice: choice.promise }));
  let pending;
  await rendered(() => view.state() === 'prompting', () => { pending = click(view.find('install-prompt')); });
  try {
    await rendered(() => view.state() === 'error', () => choice.reject(new Error('choice failed')));
    assert.equal(view.find('install-status').props.role, 'alert');
  } finally { opened.resolve(); await rejected; await pending; }
});

test('navigation during a pending choice cannot mutate a fresh install page', async () => {
  const view = await mount(); const choice = deferred();
  await offer(view, installEvent({ choice: choice.promise })); let pending;
  await rendered(() => view.state() === 'prompting', () => { pending = click(view.find('install-prompt')); });
  await view.router.push('/notice'); await Vue.nextTick();
  await view.router.push('/install'); await Vue.nextTick();
  assert.equal(view.state(), 'unavailable');
  choice.resolve({ outcome: 'accepted' }); await pending;
  assert.equal(view.state(), 'unavailable'); assert.equal(view.window.count('beforeinstallprompt'), 1);
});

test('install page renders on the server without browser globals or eligibility', async () => {
  env = { layout }; globalThis.__noticeInstall = env;
  delete globalThis.window; delete globalThis.document; delete globalThis.navigator;
  const { renderToString } = require('@vue/server-renderer');
  const app = Vue.createSSRApp(await load('pages/install.vue'));
  app.component('NuxtImg', Vue.defineComponent({ setup: (_, { attrs }) => () => Vue.h('img', attrs) }));
  const html = await renderToString(app);
  assert.match(html, /data-install-state="unavailable"/);
  assert.doesNotMatch(html, /data-testid="install-prompt"/);
});

test('screenshot buttons retain every platform asset and enlarge with bounded zoom', async () => {
  const view = await mount();
  for (const [platform, prefix] of [['ios', 'iOS'], ['android', 'Android']]) {
    await click(view.id(`install-tab-${platform}`));
    assert.deepEqual(view.all(n => n.tag === 'img').map(n => n.props.src), [1, 2, 3, 4].map(n => `/${prefix}${n}.png`));
  }
  await click(view.find('install-image-1'));
  assert.equal(view.find('install-image-full').props.src, '/Android1.png');
  for (let i = 0; i < 6; i++) await click(view.find('install-zoom-in'));
  assert.equal(view.find('install-zoom-in').props.disabled, true);
  for (let i = 0; i < 6; i++) await click(view.find('install-zoom-out'));
  assert.equal(view.find('install-zoom-out').props.disabled, true);
  const viewport = view.find('install-image-viewport');
  const touch = touches => ({ touches, preventDefault() {} });
  viewport.props.onTouchstart(touch([{ clientX: 0, clientY: 0 }]));
  viewport.props.onTouchmove(touch([{ clientX: 500, clientY: 500 }])); await Vue.nextTick();
  assert.equal(view.find('install-image-full').props.style.transform, 'translate(0px, 0px) scale(0.5)');
  await click(view.find('install-zoom-in')); await click(view.find('install-zoom-in'));
  viewport.props.onTouchstart(touch([{ clientX: 0, clientY: 0 }]));
  viewport.props.onTouchmove(touch([{ clientX: 500, clientY: -500 }])); await Vue.nextTick();
  assert.equal(view.find('install-image-full').props.style.transform, 'translate(75px, -75px) scale(1.5)');
  // Close via the shipped sheet control and reopen another asset: zoom/pan reset.
  const dialog = view.all(n => n.props.role === 'dialog')[0];
  await click(dialog.all(n => n.tag === 'button' && String(n.props.class).includes('bottom-sheet__close'))[0]);
  assert.equal(view.find('install-image-full'), undefined);
  await click(view.find('install-image-2'));
  assert.equal(view.find('install-image-full').props.style.transform, 'translate(0px, 0px) scale(1)');
  assert.equal(view.find('install-image-full').props.src, '/Android2.png');
});
