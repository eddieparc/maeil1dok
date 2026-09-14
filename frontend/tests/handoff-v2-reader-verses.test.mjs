import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { build } from 'esbuild';
import { compileScript, parse } from '@vue/compiler-sfc';
import { baseParse } from '@vue/compiler-dom';
import * as Vue from 'vue';
import * as Pinia from 'pinia';
import * as Icons from '@lucide/vue';

// Real compiled setup/templates, reading store, swipe and highlight service.
// A deterministic renderer supplies DOM selection/scroll; sanitizer is a recorded
// browser boundary here. Its real SSR security behavior has a separate test below.
const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = { Vue, Pinia, Icons, sanitized: [] };
globalThis.__readerVerses = runtime;
const exportsFor = name => Object.keys(runtime[name]).filter(key => key !== 'default' && /^[\w$]+$/.test(key))
  .map(key => `export const ${key} = globalThis.__readerVerses.${name}.${key};`).join('\n');
async function load(path, module = false, realSanitize = false) {
  const result = await build({
    stdin: { contents: module ? `export * from '${path}';` : `export { default } from '${path}';`, resolveDir: root },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    plugins: [{ name: 'reader-runtime', setup(builder) {
      builder.onResolve({ filter: /^(vue|pinia|@lucide\/vue)$/ }, ({ path }) => ({ path, namespace: 'runtime' }));
      builder.onLoad({ filter: /.*/, namespace: 'runtime' }, ({ path }) => ({ contents: exportsFor({ vue: 'Vue', pinia: 'Pinia', '@lucide/vue': 'Icons' }[path]) }));
      builder.onResolve({ filter: /^(~\/composables\/useApi|\.\/useApi)$/ }, () => ({ path: 'api', namespace: 'service' }));
      builder.onResolve({ filter: /^~\/composables\/useAuthService$/ }, () => ({ path: 'auth', namespace: 'service' }));
      if (!realSanitize) builder.onResolve({ filter: /^~\/composables\/useSanitize$/ }, () => ({ path: 'sanitize', namespace: 'service' }));
      builder.onLoad({ filter: /.*/, namespace: 'service' }, ({ path }) => ({ contents: {
        api: 'export const useApi = () => globalThis.__readerVerses.api;',
        auth: 'export const useAuthService = () => globalThis.__readerVerses.auth;',
        sanitize: 'export const useSanitize = () => ({ sanitize: html => { globalThis.__readerVerses.sanitized.push(html); return html; } });',
      }[path] }));
      builder.onResolve({ filter: /^~\// }, ({ path }) => ({ path: `${root}/app/${path.slice(2)}${path.endsWith('.vue') ? '' : '.ts'}` }));
      builder.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
        const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path });
        assert.deepEqual(errors, []);
        return { contents: compileScript(descriptor, { id: path, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } }).content, loader: 'ts', resolveDir: fileURLToPath(new URL('.', `file://${path}`)) };
      });
    } }],
  });
  const resultModule = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
  return module ? resultModule : resultModule.default;
}
const [Viewer, Controls, highlightModule, sanitizer] = await Promise.all([
  load('~/components/bible/BibleViewer.vue'), load('~/components/bible/SelectionFloatingControls.vue'),
  load('~/composables/useHighlight', true), load('~/composables/useSanitize', true, true),
]);
const all = (node, predicate) => [...(predicate(node) ? [node] : []), ...node.children.flatMap(child => all(child, predicate))];
const matches = (node, selector) => selector.split('.').filter(Boolean).every(name => String(node.props.class ?? '').split(/\s+/).includes(name));
const node = (type, text = '') => Vue.markRaw({ type, text, props: {}, children: [], parent: null, listeners: new Map(), scrollTop: 0, scrollHeight: 1200, clientHeight: 400,
  get textContent() { return this.type === '#comment' ? '' : this.text + this.children.map(child => child.textContent).join(''); },
  get parentElement() { return this.parent; },
  get classList() { const self = this; return {
    add(...names) { self.props.class = [...new Set([...String(self.props.class ?? '').split(/\s+/), ...names])].join(' '); },
    remove(...names) { self.props.class = String(self.props.class ?? '').split(/\s+/).filter(name => !names.includes(name)).join(' '); },
  }; },
  closest(selector) { return matches(this, selector) ? this : this.parent?.closest(selector); },
  querySelectorAll(selector) { return all(this, child => child !== this && matches(child, selector)); },
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; },
  contains(target) { return all(this, child => child === target).length > 0; },
  addEventListener(name, fn) { this.listeners.set(name, fn); },
  removeEventListener(name) { this.listeners.delete(name); },
});
function htmlNodes(html, parent) {
  const convert = ast => {
    const child = node(ast.type === 1 ? ast.tag : '#text', ast.type === 2 ? ast.content : '');
    child.parent = parent;
    if (ast.type === 1) {
      child.props = Object.fromEntries(ast.props.map(prop => [prop.name, prop.value?.content ?? '']));
      child.children = ast.children.map(item => { const nested = convert(item); nested.parent = child; return nested; });
    }
    return child;
  };
  return baseParse(html).children.map(convert);
}
const renderer = Vue.createRenderer({
  createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
  setText: (target, text) => { target.text = text; }, setElementText: (target, text) => { target.text = text; target.children = []; },
  parentNode: target => target.parent, nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] ?? null,
  patchProp(target, key, _previous, value) { target.props[key] = value; if (key === 'innerHTML') target.children = htmlNodes(value, target); },
  insert(target, parent, anchor = null) { if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1); target.parent = parent; const index = anchor ? parent.children.indexOf(anchor) : -1; parent.children.splice(index < 0 ? parent.children.length : index, 0, target); },
  remove(target) { target.parent.children.splice(target.parent.children.indexOf(target), 1); target.parent = null; },
});
const verse = (number, text) => `<div class="verse"><span class="verse-number">${number}</span><span class="verse-text">${text}</span></div>`;
const content = verse(1, 'Alpha &amp; one') + verse(2, 'Beta <span class="bible-name">name</span>') + '<div class="verse verse-group"><div class="verse-line"><span class="verse-number">3</span><span class="verse-text">Gamma</span></div><div class="verse-line continuation"><span class="verse-text">continued</span></div></div>';
const palette = ['#FFE28A', '#BFE8C4', '#BBDDFB', '#F9C6D3'];
function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; }
function environment() {
  const listeners = new Map();
  globalThis.document = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  runtime.selection = { isCollapsed: true, removeAllRanges() { this.isCollapsed = true; } };
  globalThis.window = { getSelection: () => runtime.selection };
  const storage = new Map([['highlightCustomColors', '["#123456"]']]);
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  runtime.auth = { isInitialized: Vue.ref(true), isLoading: Vue.ref(false), isAuthenticated: Vue.ref(true), initialize: async () => {} };
  runtime.writes = [];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => { runtime.writes.push(text); } } } });
  Pinia.setActivePinia(Pinia.createPinia());
  return listeners;
}
function mount(component, props) {
  const host = node('root'), reference = Vue.ref(); const reactiveProps = Vue.reactive(props);
  const app = renderer.createApp({ render: () => Vue.h(component, { ...reactiveProps, ref: reference }) });
  app.mount(host); return { host, props: reactiveProps, api: () => reference.value, close: () => app.unmount() };
}
function click(target) { assert.ok(target, 'click target exists'); return target.props.onClick?.({ target, stopPropagation() {}, preventDefault() {} }); }
function setupViewer(t, extra = {}) {
  const listeners = environment(), events = [];
  const view = mount(Viewer, { content, book: 'Test Book', chapter: 7, version: 'KNT', ...extra,
    onSelectionMenuChange: payload => events.push(['menu', payload]), onVerseSelect: payload => events.push(['selection', payload]),
    onHighlightSave: payload => events.push(['save', payload]), onHighlight: payload => events.push(['highlight', payload]),
    onHighlightDelete: payload => events.push(['delete', payload]), onShare: payload => events.push(['share', payload]), onCopy: payload => events.push(['copy', payload]),
  });
  t.after(view.close);
  const body = view.host.querySelector('.bible-content');
  const tap = n => body.props.onClick({ target: body.querySelectorAll('.verse')[n - 1], stopPropagation() {} });
  return { ...view, listeners, events, body, tap, state: () => events.filter(([kind]) => kind === 'menu').at(-1)?.[1] };
}
function drag(view, start, end) {
  const verses = view.body.querySelectorAll('.verse');
  const range = { commonAncestorContainer: view.body, intersectsNode: el => verses.slice(start - 1, end).some(verse => verse.contains(el) || el.contains(verse)),
    comparePoint: el => { const index = verses.findIndex(verse => verse.contains(el)) + 1; return index < start ? -1 : index <= end ? 0 : 1; } };
  runtime.selection = { isCollapsed: false, toString: () => 'partial selected text', getRangeAt: () => range, removeAllRanges() { this.isCollapsed = true; } };
  view.listeners.get('mouseup')();
}

test('four palette controls emit direct color data, optional deletion and existing action contracts', async t => {
  environment(); const events = [];
  const view = mount(Controls, { state: { visible: true, mode: 'action', isHighlighted: false, isSingleVerse: true, selection: { chapter: 7, start: 2, end: 2 } },
    onHighlightColor: color => events.push(['color', color]), onHighlightOrRemove: () => events.push(['delete']), onCopy: () => events.push(['copy']), onShare: () => events.push(['share']), onClose: () => events.push(['close']),
  }); t.after(view.close);
  const colors = () => all(view.host, el => el.props['data-color']);
  assert.deepEqual(colors().map(el => el.props['data-color']), palette);
  for (const button of colors()) click(button);
  assert.deepEqual(events, palette.map(color => ['color', color]));
  assert.equal(view.host.querySelectorAll('.selection-delete-button').length, 0);
  view.props.state.isHighlighted = true; await Vue.nextTick(); click(view.host.querySelector('.selection-delete-button'));
  for (const action of ['copy', 'share', 'close']) click(view.host.querySelector(`.selection-${action}-action`));
  assert.deepEqual(events.slice(4), [['delete'], ['copy'], ['share'], ['close']]);
  assert.equal(view.host.querySelector('.selection-location').textContent, '7:2');
  view.props.state.visible = false; await Vue.nextTick();
  assert.equal(all(view.host, el => el.props.role === 'toolbar').length, 0);
});

test('tap/range emits immutable complete selection before actions; grouped verse text survives', t => {
  const view = setupViewer(t); view.tap(2); view.tap(3);
  const state = view.state();
  assert.deepEqual(state.selection, { book: 'Test Book', chapter: 7, version: 'KNT', start: 2, end: 3, text: 'Beta name Gamma continued', verses: [{ number: 2, text: 'Beta name' }, { number: 3, text: 'Gamma continued' }] });
  assert.deepEqual(view.events.filter(([kind]) => kind === 'selection').at(-1)[1], state.selection);
  view.api().handleShare();
  const shared = view.events.find(([kind]) => kind === 'share')[1];
  assert.deepEqual(shared, { ...state.selection, startVerse: 2, endVerse: 3 });
  assert.equal(view.state().visible, false); assert.equal(view.body.querySelectorAll('.selected-verse').length, 0);
  assert.equal(shared.text, 'Beta name Gamma continued');
});

test('direct-save carries selection, chosen API color and existing custom highlight identity', t => {
  const view = setupViewer(t, { highlights: [{ id: 91, start_verse: 2, end_verse: 2, color: '#123456' }] });
  view.tap(2); assert.equal(view.state().isHighlighted, true);
  assert.equal(typeof view.api().handleHighlightColor, 'function');
  view.api().handleHighlightColor(palette[2]);
  const saved = view.events.find(([kind]) => kind === 'save')[1];
  assert.deepEqual(saved, { book: 'Test Book', chapter: 7, version: 'KNT', start: 2, end: 2, text: 'Beta name', verses: [{ number: 2, text: 'Beta name' }], color: palette[2], highlightId: 91 });
  assert.equal(view.events.some(([kind]) => kind === 'highlight'), false);
  view.tap(2); view.api().handleHighlightOrRemove();
  assert.deepEqual(view.events.find(([kind]) => kind === 'delete'), ['delete', 91]);
});

test('drag selects intersected verses only and copy opens the format menu then copies the chosen format', async t => {
  const view = setupViewer(t); drag(view, 2, 3);
  assert.equal(view.state().selection?.start, 2); assert.equal(view.state().selection?.end, 3);
  await view.api().handleCopy();
  // 복사 버튼은 즉시 복사하지 않고 형식 메뉴를 연다.
  assert.equal(view.state().mode, 'copy'); assert.equal(view.state().visible, true);
  assert.deepEqual(runtime.writes, []);
  await view.api().handleClickCopy('includeLocationRange');
  assert.deepEqual(runtime.writes, ['[Test Book7:2-3]\n2 Beta name\n3 Gamma continued']);
  assert.equal(view.state().visible, false);
  assert.equal(runtime.selection.isCollapsed, true);
});

test('copy snapshots selection across deferred clipboard completion and leaves newer selection intact', { timeout: 3000 }, async t => {
  const view = setupViewer(t); view.tap(1);
  const accepted = deferred(), complete = deferred();
  navigator.clipboard.writeText = text => { accepted.resolve(text); return complete.promise; };
  const copying = view.api().handleClickCopy('includeLocation');
  assert.equal(await accepted.promise, '[Test Book7:1] Alpha & one');
  view.tap(2); complete.resolve(); await copying;
  assert.equal(view.state().visible, true); assert.equal(view.state().selection.end, 2);
});

test('reselect/clear and location changes synchronously discard all selection modes', async t => {
  const view = setupViewer(t); view.tap(2); view.tap(2);
  assert.equal(view.body.querySelectorAll('.selected-verse').length, 0);
  view.tap(2); assert.equal(typeof view.api().clearSelection, 'function'); view.api().clearSelection();
  assert.equal(view.state().visible, false);
  view.tap(1); view.props.chapter = 8; await Vue.nextTick(); assert.equal(view.state().visible, false);
});

test('actual scroller emits immediate pixels while normalized persistence retains its debounce', async t => {
  const pixels = [], normalized = [];
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const view = setupViewer(t, { onScrollPixels: n => pixels.push(n), onScroll: n => normalized.push(n) });
  await Vue.nextTick();
  const scroller = view.host.querySelector('.bible-viewer'); scroller.scrollTop = 240; scroller.props.onScroll();
  assert.deepEqual(pixels, [240]); assert.deepEqual(normalized, []);
  t.mock.timers.runAll(); assert.deepEqual(normalized, [0.3]);
});

test('palette changes do not migrate old/custom API values or bypass auth readiness', { timeout: 3000 }, async () => {
  environment();
  assert.deepEqual(highlightModule.DEFAULT_HIGHLIGHT_COLORS.map(color => color.value), palette);
  const gate = deferred(), initialized = deferred(); const calls = [];
  runtime.auth.isInitialized.value = false; runtime.auth.isAuthenticated.value = false;
  runtime.auth.initialize = async () => { initialized.resolve(); await gate.promise; runtime.auth.isInitialized.value = true; runtime.auth.isAuthenticated.value = true; };
  const records = ['#FEF3C7', '#E9D5FF', '#123456'].map((color, index) => ({ id: index + 1, color, start_verse: index + 1, end_verse: index + 1 }));
  runtime.api = { GET: async (...args) => { calls.push(args); return { data: { highlights: records } }; } };
  const service = highlightModule.useHighlight(); const loading = service.fetchChapterHighlights('gen', 1);
  await initialized.promise; assert.equal(calls.length, 0); gate.resolve(); await loading;
  assert.deepEqual(service.chapterHighlights.value.map(record => record.color), records.map(record => record.color));
  assert.deepEqual(service.customColors.value, ['#123456']);
});

test('viewer still passes rendered cache-shaped HTML through sanitation; real sanitizer escapes hostile SSR markup', t => {
  runtime.sanitized = []; const view = setupViewer(t);
  assert.ok(runtime.sanitized.some(html => html.includes('verse-group')));
  assert.equal(view.body.querySelectorAll('.verse').length, 3);
  delete globalThis.window;
  assert.equal(sanitizer.useSanitize().sanitize('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  globalThis.window = { getSelection: () => runtime.selection };
});

test('changing only highlight color uses partial update and preserves its range and memo', async () => {
  environment();
  let record = { id: 2, book: 'exo', chapter: 4, start_verse: 1, end_verse: 1, color: palette[0], memo: 'Keep this note' };
  runtime.api = {
    path: (template, { id }) => template.replace('{id}', String(id)),
    GET: async () => ({ data: { highlights: [record] } }),
    PUT: async () => { throw new Error('Full replacement requires book, chapter, start_verse and end_verse'); },
    PATCH: async (path, data) => {
      assert.equal(path, '/api/v1/todos/bible/highlights/2/');
      assert.deepEqual(data, { color: palette[1] });
      record = { ...record, ...data };
      return record;
    },
  };
  const service = highlightModule.useHighlight();
  await service.fetchChapterHighlights('exo', 4);
  const updated = await service.updateHighlight(2, { color: palette[1] });
  assert.deepEqual(updated, { id: 2, book: 'exo', chapter: 4, start_verse: 1, end_verse: 1, color: palette[1], memo: 'Keep this note' });
  assert.deepEqual(service.chapterHighlights.value, [updated]);
});


test('persisted colors render on grouped/indented verses without changing the cache input', t => {
  const view = setupViewer(t, { highlights: [{ id: 7, start_verse: 3, end_verse: 3, color: '#E9D5FF' }] });
  const group = view.body.querySelector('.verse-group');
  assert.equal(group.props['data-highlight-id'], '7');
  assert.equal(group.props.style, '--highlight-bg: #E9D5FF');
  assert.equal(view.props.content, content);
});

test('failed clipboard fallback reports failure rather than emitting a false copy success', async t => {
  const errors = []; const view = setupViewer(t, { onCopyError: error => errors.push(error) });
  view.tap(1);
  navigator.clipboard.writeText = async () => { throw new Error('clipboard denied'); };
  let removed = false;
  document.createElement = () => ({ value: '', style: {}, setAttribute() {}, select() {} });
  document.body = { appendChild() {}, removeChild() { removed = true; } };
  document.execCommand = () => false;
  await view.api().handleClickCopy('includeLocation');
  assert.equal(view.events.some(([kind]) => kind === 'copy'), false);
  assert.equal(errors.length, 1); assert.equal(removed, true);
  assert.equal(view.state().visible, true);
});

test('legacy copy formats and native swipe event contracts remain callable', async t => {
  const swipes = []; const view = setupViewer(t, { onSwipeLeft: () => swipes.push('left'), onSwipeRight: () => swipes.push('right') });
  view.tap(1); await view.api().handleClickCopy('numOnly');
  assert.deepEqual(runtime.writes, ['1 Alpha & one']);
  const scroller = view.host.querySelector('.bible-viewer');
  for (const end of [-100, 100]) {
    scroller.listeners.get('touchstart')({ touches: [{ clientX: 0, clientY: 0 }] });
    scroller.listeners.get('touchmove')({ touches: [{ clientX: end, clientY: 0 }] });
    scroller.listeners.get('touchend')();
  }
  assert.deepEqual(swipes, ['left', 'right']);
});
