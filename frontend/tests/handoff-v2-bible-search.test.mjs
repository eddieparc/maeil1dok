import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { compileScript, compileStyle, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import * as Icons from '@lucide/vue';

// Execute the actual SFC, useApi facade, Bible data, snippet and route helpers.
// Only Nuxt/platform boundaries (HTTP, storage, layout) are supplied here.
const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = { Vue, Icons };
globalThis.__bibleSearchTest = runtime;
const exportsFor = name => Object.keys(runtime[name]).filter(key => key !== 'default' && /^[\w$]+$/.test(key))
  .map(key => `export const ${key} = globalThis.__bibleSearchTest.${name}.${key};`).join('\n');
const compiled = await build({
  stdin: { contents: 'export { default } from "./app/pages/bible/search.vue"; export { useBibleData, VISIBLE_VERSION_NAMES } from "./app/composables/useBibleData";', resolveDir: root },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  plugins: [{ name: 'search-runtime', setup(builder) {
    builder.onResolve({ filter: /^(vue|@lucide\/vue)$/ }, ({ path }) => ({ path, namespace: 'runtime' }));
    builder.onLoad({ filter: /.*/, namespace: 'runtime' }, ({ path }) => ({ contents: exportsFor(path === 'vue' ? 'Vue' : 'Icons') }));
    builder.onResolve({ filter: /^(#app|~\/composables\/useAuthService)$/ }, ({ path }) => ({ path, namespace: 'boundary' }));
    builder.onLoad({ filter: /.*/, namespace: 'boundary' }, ({ path }) => ({ contents: path === '#app'
      ? 'export const useRuntimeConfig = () => ({ public: { apiBase: "https://search.test" } });'
      : 'export const useAuthService = () => ({ isAuthenticated: { value: false }, isInitialized: { value: true }, isLoading: { value: false } });' }));
    builder.onResolve({ filter: /^~\// }, ({ path }) => ({ path: `${root}app/${path.slice(2)}${/\.(vue|css|ts)$/.test(path) ? '' : '.ts'}` }));
    builder.onLoad({ filter: /\.css$/ }, () => ({ contents: '', loader: 'js' }));
    builder.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
      if (path.endsWith('/BibleSubpageLayout.vue')) return { contents: 'import { h } from "vue"; export default { setup(_, {slots}) { return () => h("main", slots.default?.()); } };' };
      if (path.endsWith('/SkeletonList.vue')) return { contents: 'import { h } from "vue"; export default () => h("div", { "data-skeleton": true });' };
      const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path });
      assert.deepEqual(errors, []);
      return { contents: compileScript(descriptor, { id: 'search-test', inlineTemplate: true,
        templateOptions: { compilerOptions: { hoistStatic: false } } }).content, loader: 'ts', resolveDir: root };
    });
  } }],
});
const { default: SearchPage, useBibleData, VISIBLE_VERSION_NAMES } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);

test('compiled dark highlight selector targets only search marks; colors and hit areas use design tokens', async () => {
  const filename = `${root}app/pages/bible/search.vue`;
  const { descriptor } = parse(await readFile(filename, 'utf8'), { filename });
  const css = compileStyle({ filename, source: descriptor.styles[0].content, id: 'data-v-search-test', scoped: true });
  assert.deepEqual(css.errors, []);
  const darkRules = [];
  css.rawResult.root.walkRules(rule => { if (rule.selector.includes('data-theme')) darkRules.push(rule); });
  assert.equal(darkRules.length, 1);
  assert.ok(darkRules[0].selector.endsWith('.search-hit'), 'dark override must not collapse to the document theme root');
  css.rawResult.root.walkDecls(decl => {
    if (['color', 'background', 'border-color'].includes(decl.prop)) assert.ok(decl.value === 'transparent' || decl.value.startsWith('var(--color-'), decl.toString());
  });
  const buttons = css.rawResult.root.nodes.find(rule => rule.selector?.startsWith('.icon-button'));
  assert.deepEqual(buttons.nodes.filter(decl => ['width', 'height'].includes(decl.prop)).map(decl => decl.value), ['var(--hit-min)', 'var(--hit-min)']);
  const valueFor = (selector, property) => css.rawResult.root.nodes
    .find(rule => rule.selector === `${selector}[data-v-search-test]`).nodes
    .find(decl => decl.prop === property).value;
  assert.equal(valueFor('.search-panel', 'padding'), '6px var(--screen-gutter) 12px');
  assert.equal(valueFor('.version-select', 'border-radius'), '14px');
  const trigger = css.rawResult.root.nodes.find(rule => rule.selector?.includes('.version-trigger[') && rule.nodes.some(decl => decl.prop === 'min-height'));
  assert.equal(trigger.nodes.find(decl => decl.prop === 'min-height').value, 'var(--hit-min)');
  assert.equal(trigger.nodes.find(decl => decl.prop === 'border-radius').value, 'inherit');
  assert.equal(valueFor('.version-option', 'min-height'), 'var(--hit-min)');
  assert.equal(valueFor('.version-listbox', 'overflow-y'), 'auto');
  assert.equal(valueFor('.result-group', 'border-radius'), '16px');
  assert.equal(valueFor('.result-group-header', 'min-height'), '50px');
});
function node(type, text = '') {
  return Vue.markRaw({ type, text, props: {}, children: [], parent: null, value: '', listeners: {},
    get options() { return this.children.filter(child => child.type === 'option'); },
    getRootNode() { return {}; },
    contains(target) { return target === this || this.children.some(child => child.contains(target)); },
    querySelectorAll(selector) { assert.equal(selector, '[role="option"]'); return all(this, child => child.props.role === 'option'); },
    focus() {
      const previous = runtime.focused; runtime.focused = this;
      if (previous && previous !== this) dispatch(previous, 'Focusout', { relatedTarget: this });
      if (previous !== this) this.props.onFocus?.({ target: this });
    },
    addEventListener(event, listener) { (this.listeners[event] ??= []).push(listener); },
  });
}
const renderer = Vue.createRenderer({
  createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
  setText: (target, text) => { target.text = text; }, setElementText: (target, text) => { target.text = text; target.children = []; },
  parentNode: target => target.parent, nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] ?? null,
  patchProp(target, key, _old, value) { target.props[key] = value; if (key === 'value') target.value = value; },
  insert(target, parent, anchor = null) {
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1);
    target.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, target);
  },
  remove(target) { target.parent.children.splice(target.parent.children.indexOf(target), 1); target.parent = null; },
});
const all = (host, predicate) => [...(predicate(host) ? [host] : []), ...host.children.flatMap(child => all(child, predicate))];
const byClass = (host, name) => all(host, node => String(node.props.class ?? '').split(/\s+/).includes(name));
const text = host => host.type === '#comment' ? '' : host.text + host.children.map(text).join('');
const click = target => { assert.ok(target, 'action exists'); assert.ok(!target.props.disabled, 'action enabled'); return target.props.onClick({ preventDefault() {}, stopPropagation() {} }); };
function dispatch(target, name, values = {}) {
  const event = { target, defaultPrevented: false, cancelBubble: false,
    preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.cancelBubble = true; }, ...values };
  let pending;
  for (let current = target; current; current = current.parent) {
    const result = current.props[`on${name}`]?.(event);
    if (result !== undefined) pending = result;
    if (event.cancelBubble) break;
  }
  if (!event.cancelBubble) for (const listener of runtime.windowListeners.get(name.toLowerCase()) ?? []) listener(event);
  return { event, pending };
}
const keydown = (target, key) => {
  const { event, pending } = dispatch(target, 'Keydown', { key });
  if (!event.defaultPrevented && target.type === 'button' && ['Enter', ' '].includes(key)) return click(target);
  return pending;
};
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const row = (book = 'gen', snippet = '빛이 있으라', version = 'GAE') => ({ version, book, chapter: 1, verse: 3, snippet, updated_at: '2026-09-07T00:00:00Z' });
const response = (results = []) => Response.json({ success: true, query: '', count: results.length, results });
async function mount(t, { stored, storageError = false } = {}) {
  const calls = [], storage = new Map(stored === undefined ? [] : [['bible_recent_searches', stored]]);
  runtime.focused = null;
  globalThis.Document = class {}; globalThis.ShadowRoot = class {};
  runtime.windowListeners = new Map();
  globalThis.window = {
    addEventListener(name, listener) { const listeners = runtime.windowListeners.get(name) ?? new Set(); listeners.add(listener); runtime.windowListeners.set(name, listeners); },
    removeEventListener(name, listener) { runtime.windowListeners.get(name)?.delete(listener); },
  };
  globalThis.localStorage = {
    getItem: key => { if (storageError) throw new Error('storage denied'); return storage.get(key) ?? null; },
    setItem: (key, value) => { if (storageError) throw new Error('storage denied'); storage.set(key, value); },
    removeItem: key => { if (storageError) throw new Error('storage denied'); storage.delete(key); },
  };
  const server = { respond: () => response() };
  t.mock.method(globalThis, 'fetch', (url, options) => { calls.push({ url: new URL(url), options }); return Promise.resolve(server.respond()); });
  const host = node('root'); const app = renderer.createApp(SearchPage);
  let unmounted = false;
  const unmount = () => { if (!unmounted) { app.unmount(); unmounted = true; } };
  app.component('NuxtLink', { props: ['to'], setup: (props, { slots }) => () => Vue.h('a', { to: props.to }, slots.default?.()) });
  app.mount(host); await Vue.nextTick();
  t.after(() => { unmount(); for (const key of ['window', 'localStorage', 'Document', 'ShadowRoot']) delete globalThis[key]; });
  const input = () => all(host, n => n.type === 'input')[0];
  const type = async value => { const el = input(); el.value = value; el.listeners.input.forEach(listener => listener({ target: el })); await Vue.nextTick(); };
  const search = () => click(byClass(host, 'search-button')[0]);
  const trigger = () => all(host, n => n.props['aria-haspopup'] === 'listbox')[0];
  const options = () => all(host, n => n.props.role === 'option');
  const openVersions = async () => { await click(trigger()); await Vue.nextTick(); };
  const chooseVersion = value => click(options().find(option => option.value === value));
  const changeVersion = async value => {
    await openVersions(); await chooseVersion(value); await Vue.nextTick();
  };
  return { host, unmount, input, type, search, trigger, options, openVersions, chooseVersion, changeVersion, calls, storage, server };
}

test('version popover exposes exactly the existing options and current selection, with real trigger/listbox relations', { timeout: 3000 }, async t => {
  const view = await mount(t);
  assert.equal(all(view.host, n => n.type === 'select').length, 0);
  assert.equal(view.trigger().type, 'button');
  assert.equal(view.trigger().props['aria-expanded'], false);
  assert.ok(view.trigger().props['aria-label']);
  assert.equal(view.options().length, 0);
  await view.openVersions();
  const list = all(view.host, n => n.props.role === 'listbox')[0];
  assert.equal(view.trigger().props['aria-controls'], list.props.id);
  assert.ok(list.props['aria-label'] || list.props['aria-labelledby']);
  assert.equal(view.trigger().props['aria-expanded'], true);
  // 검색 선택지는 서비스가 제공하는 역본(VISIBLE_VERSION_NAMES)만 노출한다.
  const names = VISIBLE_VERSION_NAMES;
  assert.deepEqual(view.options().map(option => option.value), ['', ...Object.keys(names)]);
  assert.deepEqual(view.options().slice(1).map(text), Object.values(names)); // shipped data equality
  assert.deepEqual(view.options().filter(option => option.props['aria-selected']).map(option => option.value), ['GAE']);
  assert.equal(runtime.focused, view.options().find(option => option.value === 'GAE'));
  await click(view.trigger()); await Vue.nextTick();
  assert.equal(view.options().length, 0);
  assert.equal(runtime.focused, view.trigger());
  assert.equal(view.calls.length, 0);
});

test('keyboard navigation is bounded, does not select until Enter, and Escape restores trigger focus', { timeout: 3000 }, async t => {
  const view = await mount(t);
  view.trigger().focus();
  await keydown(view.trigger(), 'ArrowDown'); await Vue.nextTick();
  const options = view.options();
  assert.equal(runtime.focused.value, 'GAE');
  await keydown(runtime.focused, 'ArrowDown'); await Vue.nextTick();
  assert.equal(runtime.focused.value, 'KNT');
  assert.equal(options.find(option => option.value === 'GAE').props['aria-selected'], true);
  assert.equal(view.calls.length, 0);
  await keydown(runtime.focused, 'Home'); await Vue.nextTick();
  assert.equal(runtime.focused, options[0]);
  await keydown(runtime.focused, 'ArrowUp'); await Vue.nextTick();
  assert.equal(runtime.focused, options[0]);
  await keydown(runtime.focused, 'End'); await Vue.nextTick();
  assert.equal(runtime.focused, options.at(-1));
  await keydown(runtime.focused, 'ArrowDown'); await Vue.nextTick();
  assert.equal(runtime.focused, options.at(-1));
  await keydown(runtime.focused, 'ArrowUp'); await Vue.nextTick();
  assert.equal(runtime.focused, options.at(-2));
  await keydown(runtime.focused, 'Escape'); await Vue.nextTick();
  assert.equal(view.options().length, 0);
  assert.equal(runtime.focused, view.trigger());
  await keydown(view.trigger(), 'Enter'); await Vue.nextTick();
  assert.equal(runtime.focused.value, 'GAE');
  await keydown(runtime.focused, 'ArrowDown'); await Vue.nextTick();
  await keydown(runtime.focused, 'Enter'); await Vue.nextTick();
  assert.equal(view.options().length, 0);
  assert.equal(runtime.focused, view.trigger());
  assert.equal(text(view.trigger()), useBibleData().versionNames.KNT);
  await keydown(view.trigger(), 'ArrowUp'); await Vue.nextTick();
  assert.equal(runtime.focused.value, 'KNT');
  await keydown(runtime.focused, 'Escape'); await Vue.nextTick();
  await keydown(view.trigger(), 'Home'); await Vue.nextTick();
  assert.equal(runtime.focused, view.options()[0]);
  await keydown(runtime.focused, 'Escape'); await Vue.nextTick();
  await keydown(view.trigger(), 'End'); await Vue.nextTick();
  assert.equal(runtime.focused, view.options().at(-1));
  await keydown(runtime.focused, 'Escape'); await Vue.nextTick();
  await keydown(view.trigger(), ' '); await Vue.nextTick();
  const selectedByFocus = view.options().find(option => option.value === 'GAE');
  selectedByFocus.focus(); await Vue.nextTick();
  assert.equal(selectedByFocus.props.tabindex, 0);
  await keydown(runtime.focused, ' '); await Vue.nextTick();
  assert.equal(text(view.trigger()), useBibleData().versionNames.GAE);
  assert.equal(view.options().length, 0);
  assert.equal(runtime.focused, view.trigger());
  assert.equal(view.calls.length, 0);
});

test('outside pointer dismisses with focus return; focus leaving permits Tab without a trap; listeners are removed', { timeout: 3000 }, async t => {
  const view = await mount(t);
  await view.openVersions();
  dispatch(view.options()[0], 'Pointerdown'); await Vue.nextTick();
  assert.ok(view.options().length, 'inside pointer does not dismiss');
  dispatch(view.input(), 'Pointerdown'); await Vue.nextTick();
  assert.equal(view.options().length, 0);
  assert.equal(runtime.focused, view.trigger());
  // Native pointer default focus must remain free to reach the clicked field.
  view.input().focus();
  assert.equal(runtime.focused, view.input());
  await view.openVersions();
  const { event } = dispatch(runtime.focused, 'Keydown', { key: 'Tab' });
  assert.equal(event.defaultPrevented, false);
  view.input().focus(); await Vue.nextTick();
  assert.equal(view.options().length, 0);
  assert.equal(runtime.focused, view.input());
  assert.equal(view.calls.length, 0);
  view.unmount();
  assert.equal([...runtime.windowListeners.values()].reduce((sum, listeners) => sum + listeners.size, 0), 0);
});

test('popover selection submits exactly once, reselection does not submit, and all-version recent replay restores selection', { timeout: 3000 }, async t => {
  const view = await mount(t);
  await view.type('빛'); await view.search(); await Vue.nextTick();
  await view.openVersions();
  await keydown(runtime.focused, 'ArrowDown'); await Vue.nextTick();
  assert.equal(view.calls.length, 1);
  await keydown(runtime.focused, 'Enter'); await Vue.nextTick();
  assert.equal(view.calls.length, 2);
  assert.equal(view.calls.at(-1).url.searchParams.get('version'), 'KNT');
  await view.changeVersion('KNT');
  assert.equal(view.calls.length, 2);
  await view.changeVersion('');
  assert.equal(view.calls.length, 3);
  assert.equal(view.calls.at(-1).url.searchParams.has('version'), false);
  assert.deepEqual(JSON.parse(view.storage.get('bible_recent_searches'))[0], { query: '빛', version: '' });
  await click(byClass(view.host, 'clear-search')[0]); await Vue.nextTick();
  await view.changeVersion('GAE');
  await click(byClass(view.host, 'recent-search')[0]); await Vue.nextTick();
  assert.equal(view.calls.length, 4);
  assert.equal(view.calls.at(-1).url.searchParams.has('version'), false);
  await view.openVersions();
  assert.equal(runtime.focused.value, '');
  assert.deepEqual(view.options().filter(option => option.props['aria-selected']).map(option => option.value), ['']);
});

test('one-character Enter uses real facade; empty input is rejected without HTTP or history', { timeout: 3000 }, async t => {
  const view = await mount(t);
  await view.type('   '); await view.search(); await Vue.nextTick();
  assert.equal(view.calls.length, 0); assert.equal(view.storage.size, 0);
  assert.ok(byClass(view.host, 'error-message').length);
  await view.type(' 빛 ');
  view.server.respond = () => response([row()]);
  await view.input().props.onKeydown({ key: 'Enter', preventDefault() {} }); await Vue.nextTick();
  assert.equal(view.calls.length, 1);
  assert.equal(view.calls[0].url.pathname, '/api/v1/bible-cache/search/');
  assert.equal(view.calls[0].url.searchParams.get('q'), '빛');
  assert.equal(view.calls[0].url.searchParams.get('version'), 'GAE');
  assert.equal(view.calls[0].options.credentials, 'include');
  assert.equal(byClass(view.host, 'result-card').length, 1);
});

test('recommended searches submit their values; history is versioned, unique MRU capped at five and can be cleared', { timeout: 3000 }, async t => {
  const view = await mount(t);
  const chips = byClass(view.host, 'recommended-term');
  assert.equal(chips.length, 5);
  const values = chips.map(text);
  assert.deepEqual(values, ['사랑', '믿음', '평안', '빛', '소망']); // machine-consumed query values
  await click(chips[0]); await Vue.nextTick();
  assert.equal(view.calls[0].url.searchParams.get('q'), values[0]);
  for (const query of ['믿음', '평안', '빛', '소망', '은혜', '빛']) { await view.type(query); await view.search(); await Vue.nextTick(); }
  assert.deepEqual(JSON.parse(view.storage.get('bible_recent_searches')), ['빛', '은혜', '소망', '평안', '믿음'].map(query => ({ query, version: 'GAE' })));
  await view.changeVersion('KNT');
  assert.deepEqual(JSON.parse(view.storage.get('bible_recent_searches'))[0], { query: '빛', version: 'KNT' });
  await click(byClass(view.host, 'clear-search')[0]); await Vue.nextTick();
  assert.equal(view.input().value, ''); assert.equal(runtime.focused, view.input());
  const recent = byClass(view.host, 'recent-search');
  assert.equal(recent.length, 5);
  await click(recent[1]); await Vue.nextTick();
  assert.equal(view.calls.at(-1).url.searchParams.get('version'), 'GAE');
  await click(byClass(view.host, 'clear-search')[0]); await Vue.nextTick();
  await click(byClass(view.host, 'clear-recent')[0]); await Vue.nextTick();
  assert.equal(view.storage.has('bible_recent_searches'), false);
  assert.equal(byClass(view.host, 'recent-search').length, 0);
});

test('restored history validates external storage and restores the selected version when replayed', { timeout: 3000 }, async t => {
  const stored = JSON.stringify([null, { query: '', version: 'GAE' }, { query: 'no', version: 'bogus' },
    { query: ' 사랑 ', version: 'KNT' }, { query: '사랑', version: 'KNT' }, { query: '빛', version: '' }]);
  const view = await mount(t, { stored });
  const recent = byClass(view.host, 'recent-search');
  assert.equal(recent.length, 2);
  await click(recent[0]); await Vue.nextTick();
  assert.equal(view.calls.at(-1).url.searchParams.get('q'), '사랑');
  assert.equal(view.calls.at(-1).url.searchParams.get('version'), 'KNT');
  assert.equal(view.calls.length, 1);
  assert.equal(text(view.trigger()), useBibleData().versionNames.KNT);
  await view.openVersions();
  assert.equal(runtime.focused.value, 'KNT');
  assert.equal(runtime.focused.props['aria-selected'], true);
});

test('results group by real books, expand only the first, sanitize marks and keep links tied to the submitted query', { timeout: 3000 }, async t => {
  const view = await mount(t);
  view.server.respond = () => response([row('gen', '빛&nbsp; 직접입력 [출처] <img onerror="x"> 빛'), row('jhn', '빛 사랑'), { ...row(), verse: 4 }]);
  await view.type('빛'); await view.search(); await Vue.nextTick();
  const headers = byClass(view.host, 'result-group-header');
  assert.deepEqual(headers.map(n => n.props['aria-expanded']), [true, false]);
  assert.deepEqual(byClass(view.host, 'result-group-count').map(n => Number.parseInt(text(n))), [2, 1]);
  assert.equal(byClass(view.host, 'result-card').length, 2);
  const marks = all(view.host, n => n.props.innerHTML).map(n => n.props.innerHTML);
  assert.match(marks[0], /<mark class="search-hit">빛<\/mark>/);
  assert.match(marks[0], /&lt;img/); assert.doesNotMatch(marks[0], /직접입력|\[출처\]|<img/);
  await view.type('사랑');
  assert.equal(all(view.host, n => n.props.innerHTML)[0].props.innerHTML, marks[0]);
  assert.deepEqual(byClass(view.host, 'result-card')[0].props.to, { path: '/bible', query: { book: 'gen', chapter: '1', version: 'GAE', verse: '3', search: '빛' } });
  await click(headers[1]); await Vue.nextTick();
  assert.equal(byClass(view.host, 'result-card').length, 3);
});

test('version changes re-search only after submission; empty-result action removes the API filter exactly once', { timeout: 3000 }, async t => {
  const view = await mount(t);
  await view.changeVersion('KNT'); assert.equal(view.calls.length, 0);
  await view.type('찾기'); await view.search(); await Vue.nextTick();
  await view.changeVersion('GAE');
  assert.equal(view.calls.length, 2); assert.equal(view.calls.at(-1).url.searchParams.get('version'), 'GAE');
  await click(byClass(view.host, 'search-all-versions')[0]); await Vue.nextTick();
  assert.equal(view.calls.length, 3); assert.equal(view.calls.at(-1).url.searchParams.has('version'), false);
  assert.equal(view.calls.at(-1).url.searchParams.get('q'), '찾기');
  assert.equal(byClass(view.host, 'search-all-versions').length, 0);
});

test('overlapping requests cannot overwrite newer results, errors, or loading state', { timeout: 3000 }, async t => {
  const view = await mount(t); const first = deferred(), second = deferred();
  view.server.respond = () => first.promise;
  await view.type('사랑'); const oldSearch = view.search(); await Vue.nextTick();
  view.server.respond = () => second.promise;
  await view.openVersions(); const newSearch = view.chooseVersion('KNT'); await Vue.nextTick();
  assert.equal(view.calls.length, 2);
  assert.equal(view.options().length, 0);
  assert.equal(runtime.focused, view.trigger(), 'focus returns without waiting for the new HTTP response');
  first.reject(new Error('old request failed')); await oldSearch; await Vue.nextTick();
  assert.ok(all(view.host, n => n.props['data-skeleton']).length, 'new request remains loading');
  assert.equal(byClass(view.host, 'error-message').length, 0);
  second.resolve(response([row('jhn', '사랑', 'KNT')])); await newSearch;
  assert.equal(byClass(view.host, 'result-card')[0].props.to.query.version, 'KNT');
  const third = deferred(), fourth = deferred();
  view.server.respond = () => third.promise; await view.openVersions(); const stale = view.chooseVersion('GAE'); await Vue.nextTick();
  view.server.respond = () => fourth.promise; await view.openVersions(); const latest = view.chooseVersion('KNT'); await Vue.nextTick();
  fourth.resolve(response([row('jhn', '사랑', 'KNT')])); await latest;
  third.resolve(response([row()])); await stale;
  assert.equal(byClass(view.host, 'result-card')[0].props.to.query.book, 'jhn');
});

test('clear during a request invalidates it and restores the start state without late results', { timeout: 3000 }, async t => {
  const view = await mount(t); const pending = deferred(); view.server.respond = () => pending.promise;
  await view.type('사랑'); const request = view.search(); await Vue.nextTick();
  await click(byClass(view.host, 'clear-search')[0]); await Vue.nextTick();
  assert.equal(view.input().value, ''); assert.equal(byClass(view.host, 'recommended-term').length, 5);
  pending.resolve(response([row()])); await request; await Vue.nextTick();
  assert.equal(byClass(view.host, 'result-card').length, 0);
  assert.equal(byClass(view.host, 'recommended-term').length, 5);
});

for (const options of [{ stored: '{invalid' }, { storageError: true }]) {
  test(`unavailable or malformed history is reported without blocking search: ${JSON.stringify(options)}`, { timeout: 3000 }, async t => {
    const view = await mount(t, options);
    assert.ok(byClass(view.host, 'storage-message').length);
    await view.type('빛'); await view.search(); await Vue.nextTick();
    assert.equal(view.calls.length, 1);
  });
}

test('API failure remains an error rather than an empty-result success and retry can recover', { timeout: 3000 }, async t => {
  const view = await mount(t); view.server.respond = () => Response.json({ error: 'offline' }, { status: 503 });
  await view.type('사랑'); await view.search(); await Vue.nextTick();
  assert.equal(byClass(view.host, 'error-message').length, 1);
  assert.equal(byClass(view.host, 'search-all-versions').length, 0);
  view.server.respond = () => response([row()]); await view.search(); await Vue.nextTick();
  assert.equal(byClass(view.host, 'error-message').length, 0); assert.equal(byClass(view.host, 'result-card').length, 1);
});
