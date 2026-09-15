import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { compileScript, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import * as Pinia from 'pinia';
import * as Icons from '@lucide/vue';

// Production SFCs, Pinia store and useApi; only HTTP, Nuxt and platform surfaces supplied.
const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = { Vue, Pinia, Icons };
globalThis.__settingsV2 = runtime;
globalThis.definePageMeta = () => {};
if (!globalThis.navigator) Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'node-test' } });
globalThis.useRouter = () => runtime.router;
globalThis.useRoute = () => ({ query: {} });
globalThis.navigateTo = path => runtime.navigation.push(path);
const sharedPath = `${root}app/components/ReadingSettingsSheet.vue`;
let hasShared = true;
try { await access(sharedPath); } catch { hasShared = false; }
const sharedEntry = hasShared ? sharedPath : `${root}app/pages/bible/settings.vue`;
const exportsFor = name => Object.keys(runtime[name]).filter(key => key !== 'default' && /^[\w$]+$/.test(key))
  .map(key => `export const ${key} = globalThis.__settingsV2.${name}.${key};`).join('\n');
const services = {
  'vue-router': 'export const useRouter = () => globalThis.__settingsV2.router;',
  'nuxt/app': 'export const useRuntimeConfig = () => ({ public: {} });',
  '#imports': 'export const useHead = () => {};',
  '~/composables/useNavigation': 'export const useNavigation = () => ({ goBack() {} });',
  '~/composables/useSanitize': 'export const useSanitize = () => ({ sanitize: value => value });',
  '~/stores/hasena': 'export const useHasenaStore = () => ({ isLoading: false, isCompleted: false, stats: {}, setCompletionStatus() {}, fetchStats: async () => {} });',
  '~/stores/notifications': 'export const useNotificationsStore = () => ({ settings: null, fetchSettings: async () => {} });',
  '~/stores/profile': 'export const useProfileStore = () => ({ currentProfile: null });',
  '#components': "export const NuxtLink = { props: ['to'], setup: (props, { slots }) => () => globalThis.__settingsV2.Vue.h('a', { href: props.to, onClick: () => globalThis.__settingsV2.router.push(props.to) }, slots.default?.()) };",
  '#app': 'export const useRuntimeConfig = () => ({ public: { apiBase: "https://settings.test" } });',
  '~/composables/useAuthService': 'export const useAuthService = () => globalThis.__settingsV2.auth;',
  '~/composables/useModal': 'export const useModal = () => globalThis.__settingsV2.modal;',
  '~/composables/useToast': 'export const useToast = () => globalThis.__settingsV2.toast;',
  '~/composables/useErrorHandler': 'export const useErrorHandler = () => ({ handleApiError: globalThis.__settingsV2.error });',
};
const result = await build({
  stdin: { contents: `export { default as Shared } from '${sharedEntry}';
    export { default as Legacy } from '~/components/ReadingSettingsModal.vue';
    export { default as Hasena } from '~/pages/hasena.vue';
    export { default as Account } from '~/pages/account/settings.vue';
    export { default as Route } from '~/pages/bible/settings.vue';
    export * from '~/stores/readingSettings';`, resolveDir: root },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  plugins: [{ name: 'settings-runtime', setup(builder) {
    builder.onResolve({ filter: /^(vue|pinia|@lucide\/vue)$/ }, ({ path }) => ({ path, namespace: 'runtime' }));
    builder.onLoad({ filter: /.*/, namespace: 'runtime' }, ({ path }) => ({ contents: exportsFor({ vue: 'Vue', pinia: 'Pinia', '@lucide/vue': 'Icons' }[path]) }));
    builder.onResolve({ filter: /^#shared\// }, ({ path }) => ({ path: `${root}shared/${path.slice(8)}.ts` }));
    builder.onResolve({ filter: /^(~\/|#app$|#components$|#imports$|nuxt\/app$|vue-router$)/ }, ({ path }) => services[path]
      ? { path, namespace: 'service' }
      : { path: `${root}app/${path.slice(2)}${/\.(vue|js|ts)$/.test(path) ? '' : existsSync(`${root}app/${path.slice(2)}.ts`) ? '.ts' : '.js'}` });
    builder.onLoad({ filter: /.*/, namespace: 'service' }, ({ path }) => ({ contents: services[path] }));
    builder.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
      if (path.endsWith('/BottomSheet.vue')) return { contents: `import { h } from 'vue'; export default {
        name: 'BottomSheet', props: ['modelValue', 'title'], emits: ['update:modelValue'],
        setup(props, { slots, emit }) { return () => props.modelValue ? h('section', { role: 'dialog' }, [
          slots['header-extra']?.(), slots.default?.(), slots.footer?.(),
          h('button', { 'data-testid': 'platform-dismiss', onClick: () => emit('update:modelValue', false) })]) : null; }
      };` };
      if (path.endsWith('/PageLayout.vue')) return { contents: `import { h } from 'vue'; export default { setup(_, { slots }) { return () => h('main', [slots['header-action']?.(), slots.default?.()]); } };` };
      if (/\/(HasenaCalendarModal|ProfileEditModal|SkeletonHasenaCard|SkeletonList)\.vue$/.test(path)) return { contents: 'export default () => null;' };
      if (path.endsWith('/Toast.vue')) return { contents: 'export default () => null;' };
      const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path });
      assert.deepEqual(errors, []);
      return { contents: compileScript(descriptor, { id: path, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } }).content,
        loader: 'ts', resolveDir: fileURLToPath(new URL('.', `file://${path}`)) };
    });
  } }],
});
const { Shared, Legacy, Route, Hasena, Account, useReadingSettingsStore } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const node = (type, text = '') => Vue.markRaw({ type, text, props: {}, children: [], parent: null });
const notifyRender = () => { for (const listener of runtime.renderListeners ?? []) listener(); };
const renderer = Vue.createRenderer({
  createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
  setText: (target, text) => { target.text = text; }, setElementText: (target, text) => { target.text = text; target.children = []; },
  parentNode: target => target.parent, nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] ?? null,
  patchProp: (target, key, _previous, value) => { target.props[key] = value; Vue.queuePostFlushCb(notifyRender); },
  insert(target, parent, anchor = null) {
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1);
    target.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, target); Vue.queuePostFlushCb(notifyRender);
  },
  remove(target) { target.parent.children.splice(target.parent.children.indexOf(target), 1); target.parent = null; },
});
const findAll = (target, predicate) => [...(predicate(target) ? [target] : []), ...target.children.flatMap(child => findAll(child, predicate))];
const byId = (host, id) => findAll(host, node => node.props.id === id || node.props['data-testid'] === id)[0];
const byClass = (host, name) => findAll(host, node => String(node.props.class ?? '').split(/\s+/).includes(name));
const click = target => { assert.ok(target, 'enabled action exists'); assert.ok(!target.props.disabled); for (const handler of [target.props.onClick].flat()) handler?.({ stopPropagation() {}, preventDefault() {} }); };
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function actionSignal(store, action) {
  const signal = deferred();
  const off = store.$onAction(({ name, after, onError }) => { if (name !== action) return; off(); after(signal.resolve); onError(signal.reject); });
  return signal.promise;
}
const saved = { theme: 'dark', fontFamily: 'noto-serif', fontSize: 23, fontWeight: 'bold', lineHeight: 2.4,
  textAlign: 'justify', verseJoining: true, showVerseNumbers: false, tongdokAutoComplete: true,
  showDescription: false, showCrossRef: false, highlightNames: false, showFootnotes: true };
const server = { theme: 'dark', font_family: 'noto-serif', font_size: 23, font_weight: 'bold', line_height: 2.4,
  text_align: 'justify', verse_joining: true, show_verse_numbers: false, tongdok_auto_complete: true,
  show_description: false, show_cross_ref: false, highlight_names: false, show_footnotes: true };
function setup(t, { authenticated = true, stored = saved } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  runtime.auth = { user: Vue.ref({ id: 7 }), isStaff: Vue.ref(false), isAuthenticated: Vue.ref(authenticated), initialize: async () => {} };
  runtime.router = { push: path => runtime.navigation.push(path), back: () => runtime.navigation.push('back'), replace: path => runtime.navigation.push(path) };
  runtime.apps = []; runtime.renderListeners = new Set(); runtime.navigation = []; runtime.calls = []; runtime.writes = []; runtime.errors = [];
  runtime.modal = { confirm: async () => true }; runtime.error = error => runtime.errors.push(error);
  runtime.toast = { success() {}, info() {}, error: runtime.error };
  const storage = new Map(stored ? [['readingSettings', JSON.stringify(stored)]] : []);
  t.mock.method(console, 'warn', (...args) => runtime.errors.push(args));
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    runtime.calls.push({ url, method: options.method ?? 'GET', payload: options.body ? JSON.parse(options.body) : undefined });
    if (runtime.respond) return runtime.respond(url, options);
    if (url.includes('/hasena/day/')) return Response.json({ success: true, entry: { verses: [], video_id: '' } });
    if (url.includes('/linked-accounts/')) return Response.json({ linked_accounts: [] });
    return Response.json({ success: true, data: { settings: server } });
  });
  runtime.respond = null;
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value); runtime.writes.push([key, JSON.parse(value)]); }, removeItem: key => storage.delete(key) };
  globalThis.window = { YT: {}, addEventListener() {}, removeEventListener() {}, history: { state: {} }, matchMedia: () => ({ matches: false, addEventListener() {} }) };
  globalThis.document = { cookie: '', documentElement: { setAttribute() {} }, querySelector: () => null };
  const pinia = Pinia.createPinia(); Pinia.setActivePinia(pinia);
  const store = useReadingSettingsStore();
  t.after(() => { for (const app of runtime.apps.reverse()) app.unmount(); delete globalThis.window; delete globalThis.document; delete globalThis.localStorage; pinia._s.clear(); });
  return { store, pinia, storage };
}
async function mount(t, Component, pinia, props = {}) {
  const state = Vue.reactive(props); const host = node('root');
  const app = renderer.createApp({ render: () => Vue.h(Component, state) });
  app.use(pinia);
  app.component('NuxtLink', { props: ['to'], setup: (props, { slots }) => () => Vue.h('a', { href: props.to, onClick: () => runtime.router.push(props.to) }, slots.default?.()) });
  app.component('UiModalBaseModal', { props: ['modelValue'], setup: (props, { slots }) => () => props.modelValue ? Vue.h('section', [slots.default?.(), slots.footer?.()]) : null });
  runtime.apps.push(app); app.mount(host); await Vue.nextTick();
  return { host, state, app };
}
const patches = () => runtime.calls.filter(call => call.method === 'PATCH');

test('settings initialize/open/close never writes defaults or PATCHes; saved legacy values remain intact', { timeout: 3000 }, async t => {
  const { store, pinia } = setup(t, { authenticated: false });
  await store.initialize();
  const view = await mount(t, Shared, pinia, { modelValue: true, 'onUpdate:modelValue': value => { view.state.modelValue = value; } });
  assert.deepEqual({ ...store.settings }, saved);
  assert.equal(runtime.writes.length, 0, 'initialization must not write saved preferences back on mount');
  click(byId(view.host, 'platform-dismiss'));
  await Vue.nextTick(); t.mock.timers.tick(1000);
  assert.equal(view.state.modelValue, false);
  assert.equal(runtime.writes.length, 0);
  assert.equal(patches().length, 0);
});

test('changes update the actual store immediately and persist exactly once 400ms after the final input', { timeout: 3000 }, async t => {
  const { store, pinia } = setup(t); await store.initialize();
  const view = await mount(t, Shared, pinia, { modelValue: true });
  byId(view.host, 'reading-font-size').props.onInput({ target: { value: '18' } });
  assert.equal(store.settings.fontSize, 18);
  t.mock.timers.tick(250);
  byId(view.host, 'reading-line-height').props.onInput({ target: { value: '1.9' } });
  assert.equal(store.settings.lineHeight, 1.9);
  t.mock.timers.tick(399); assert.equal(patches().length, 0);
  const synced = actionSignal(store, 'syncToServer'); t.mock.timers.tick(1);
  assert.equal(patches().length, 1, 'PATCH starts at 400ms, not 500ms'); await synced;
  assert.deepEqual(patches()[0].payload, { ...server, font_size: 18, line_height: 1.9 });
  assert.equal(patches()[0].url, 'https://settings.test/api/v1/auth/reading-settings/update/');
});

test('font choices and range boundaries use actual enums without migrating saved preferences', { timeout: 3000 }, async t => {
  const { store, pinia } = setup(t); await store.initialize();
  const view = await mount(t, Shared, pinia, { modelValue: true });
  assert.equal(store.settings.fontFamily, 'noto-serif'); assert.equal(store.settings.lineHeight, 2.4);
  const size = byId(view.host, 'reading-font-size'); const height = byId(view.host, 'reading-line-height');
  assert.deepEqual([size.props.min, size.props.max, size.props.step], ['14', '24', '1']);
  assert.deepEqual([height.props.min, height.props.max, height.props.step], ['1.4', '2.2', '0.1']);
  const fonts = byClass(view.host, 'font-button'); assert.equal(fonts.length, 3);
  for (const [i, value] of ['pretendard', 'kopub-batang', 'ridi-batang'].entries()) {
    click(fonts[i]); assert.equal(store.settings.fontFamily, value);
  }
  click(findAll(byClass(view.host, 'name-toggle')[0], node => node.props.role === 'switch')[0]);
  assert.equal(store.settings.highlightNames, true);
  const synced = actionSignal(store, 'syncToServer'); t.mock.timers.tick(400);
  assert.equal(patches().length, 1); await synced;
  assert.deepEqual(patches()[0].payload, { ...server, font_family: 'ridi-batang', highlight_names: true });
});

test('late server loading preserves edited fields and never PATCHes defaults over loaded fields', { timeout: 3000 }, async t => {
  const { store } = setup(t, { stored: null }); const response = deferred();
  runtime.respond = (_url, options) => (options.method ?? 'GET') === 'GET' ? response.promise : Response.json({ success: true });
  const initialized = store.initialize(); store.updateSetting('fontSize', 19);
  t.mock.timers.tick(400); assert.equal(patches().length, 0);
  response.resolve(Response.json({ success: true, data: { settings: server } })); await initialized;
  assert.equal(store.settings.fontSize, 19, 'late GET must not erase the user input');
  assert.equal(store.settings.fontFamily, 'noto-serif');
  const synced = actionSignal(store, 'syncToServer'); t.mock.timers.tick(400);
  assert.equal(patches().length, 1); await synced;
  assert.deepEqual(patches()[0].payload, { ...server, font_size: 19 });
});

test('failed persistence retains local preferences, exposes failure and permits an explicit retry', { timeout: 3000 }, async t => {
  const { store, pinia, storage } = setup(t); await store.initialize();
  const view = await mount(t, Shared, pinia, { modelValue: true });
  const previousSync = store.lastSyncedAt;
  runtime.respond = () => Response.json({ error: 'offline' }, { status: 503 });
  store.updateSetting('fontSize', 20);
  await store.syncToServer(); await Vue.nextTick();
  assert.equal(patches().length, 1);
  assert.equal(store.settings.fontSize, 20); assert.equal(JSON.parse(storage.get('readingSettings')).fontSize, 20);
  assert.equal(store.isSyncing, false); assert.equal(store.lastSyncedAt, previousSync);
  assert.ok(store.syncError); assert.equal(findAll(view.host, node => node.props.role === 'alert').length, 1);
  assert.ok(runtime.errors.length, 'failure is not swallowed');
  runtime.respond = () => Response.json({ success: true });
  const retried = actionSignal(store, 'syncToServer'); click(byId(view.host, 'reading-settings-retry')); await retried;
  assert.equal(store.syncError, null); assert.equal(patches().length, 2);
});

test('separate Pinia instances cannot cancel each other\'s debounce', { timeout: 3000 }, async t => {
  const { store } = setup(t); await store.initialize();
  const other = useReadingSettingsStore(Pinia.createPinia()); await other.initialize();
  store.updateSetting('fontSize', 18); other.updateSetting('fontSize', 22);
  const first = actionSignal(store, 'syncToServer'); const second = actionSignal(other, 'syncToServer');
  t.mock.timers.tick(500); assert.equal(patches().length, 2); await Promise.all([first, second]);
  assert.deepEqual(patches().map(call => call.payload.font_size), [18, 22]);
});

test('legacy modal delegates to the shared sheet and keeps isOpen/currentVersion/close', { timeout: 3000 }, async t => {
  const { store, pinia } = setup(t); await store.initialize(); let closed = 0;
  const view = await mount(t, Legacy, pinia, { isOpen: true, currentVersion: 'KNT', onClose: () => { closed++; } });
  assert.equal(view.app._instance.subTree.component.subTree.type, Shared);
  byId(view.host, 'reading-font-size').props.onInput({ target: { value: '21' } });
  assert.equal(store.settings.fontSize, 21);
  for (const key of ['showDescription', 'showCrossRef', 'showFootnotes', 'showVerseNumbers', 'verseJoining', 'tongdokAutoComplete']) {
    // Given the real keyed preference component, not its former inline label id.
    const pending = [view.app._instance.subTree];
    let control;
    while (pending.length) {
      const vnode = pending.pop();
      if (vnode.key === key && vnode.component) {
        control = findAll(vnode.component.subTree.el, node => node.props.role === 'switch')[0];
        break;
      }
      if (vnode.component) pending.push(vnode.component.subTree);
      if (Array.isArray(vnode.children)) pending.push(...vnode.children.filter(Vue.isVNode));
    }
    const previous = store.settings[key];
    // When the actual native switch is activated.
    click(control);
    // Then the corresponding saved preference changes immediately.
    assert.equal(store.settings[key], !previous, `${key} remains controllable`);
  }
  click(byClass(view.host, 'done-btn')[0]); assert.equal(closed, 1);
  assert.equal(patches().length, 0, 'done does not bypass the pending debounce');
});

for (const back of [null, '/hasena']) test(`legacy settings route returns via ${back ? 'history' : 'bible fallback'} through the same sheet`, { timeout: 3000 }, async t => {
  const { store, pinia } = setup(t); await store.initialize(); window.history.state.back = back;
  const view = await mount(t, Route, pinia);
  assert.equal(view.app._instance.subTree.component.subTree.type, Shared);
  click(byClass(view.host, 'done-btn')[0]); await Vue.nextTick();
  assert.deepEqual(runtime.navigation, [back ? 'back' : '/bible']); assert.equal(patches().length, 0);
});

 test('existing saved fields win over leftover legacy migration keys', { timeout: 3000 }, async t => {
  const { store, storage } = setup(t, { authenticated: false });
  storage.set('bibleFontSize', '14'); storage.set('bibleViewOptions', JSON.stringify({ highlightNames: true }));
  await store.initialize(); assert.deepEqual({ ...store.settings }, saved);
});

for (const [name, Component] of [['Hasena', Hasena], ['account', Account]]) test(`${name} settings entry opens and closes the shared sheet without leaving the page`, { timeout: 3000 }, async t => {
  const { store, pinia } = setup(t); await store.initialize();
  const ready = deferred(); let view;
  const entry = () => name === 'Hasena' ? byClass(view.host, 'settings-btn')[0]
    : byClass(byClass(view.host, 'display-group')[0], 'row-action')[0];
  const listener = () => { if (view && entry()) { runtime.renderListeners.delete(listener); ready.resolve(); } };
  runtime.renderListeners.add(listener);
  view = await mount(t, Component, pinia);
  listener(); await ready.promise;
  click(entry()); await Vue.nextTick();
  assert.deepEqual(runtime.navigation, [], 'settings must not route away');
  const size = byId(view.host, 'reading-font-size'); assert.ok(size, 'shared controls are mounted');
  size.props.onInput({ target: { value: '17' } }); assert.equal(store.settings.fontSize, 17);
  click(byClass(view.host, 'done-btn')[0]); await Vue.nextTick();
  assert.equal(byId(view.host, 'reading-font-size'), undefined); assert.deepEqual(runtime.navigation, []);
});

test('record links from the legacy route navigate once without competing with history return', { timeout: 3000 }, async t => {
  const { store, pinia } = setup(t); await store.initialize(); window.history.state.back = '/hasena';
  const view = await mount(t, Route, pinia);
  click(findAll(view.host, node => node.props.href === '/bible/bookmarks')[0]);
  assert.deepEqual(runtime.navigation, ['/bible/bookmarks']);
});
