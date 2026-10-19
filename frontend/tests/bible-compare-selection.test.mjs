import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { build } from 'esbuild';
import { compileScript, parse } from '@vue/compiler-sfc';
import { baseParse } from '@vue/compiler-dom';
import * as Vue from 'vue';
import * as Icons from '@lucide/vue';

// Real Reader -> Compare -> merged Viewer -> selection/actions. Only unrelated
// chrome, sanitation and browser DOM/clipboard boundaries are supplied here.
const root = fileURLToPath(new URL('../', import.meta.url));
const runtime = { Vue, Icons };
runtime.Empty = Vue.defineComponent({ setup: () => () => null });
runtime.Slots = Vue.defineComponent({ inheritAttrs: false, setup: (_, { slots }) => () => Object.values(slots).flatMap(slot => slot()) });
runtime.Controls = Vue.defineComponent({
  props: ['state'],
  setup(props, { emit }) { runtime.controls = { props, emit }; return () => null; },
});
runtime.settings = { effectiveTheme: 'light', settings: {
  fontFamily: 'test', fontWeight: 'normal', fontSize: 16, lineHeight: 1.8, textAlign: 'left',
} };
globalThis.__compareSelection = runtime;
const result = await build({
  stdin: { contents: "export { default } from '~/components/bible/BibleReaderView.vue';", resolveDir: root },
  bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
  plugins: [{ name: 'compare-selection-runtime', setup(builder) {
    builder.onResolve({ filter: /^(vue|@lucide\/vue)$/ }, ({ path }) => ({ path, namespace: 'runtime' }));
    builder.onLoad({ filter: /.*/, namespace: 'runtime' }, ({ path }) => {
      const name = path === 'vue' ? 'Vue' : 'Icons';
      return { contents: Object.keys(runtime[name]).filter(key => key !== 'default' && /^[\w$]+$/.test(key))
        .map(key => `export const ${key} = globalThis.__compareSelection.${key === 'Transition' ? 'Slots' : `${name}.${key}`};`).join('\n') };
    });
    builder.onResolve({ filter: /^~\/(stores\/readingSettings|composables\/useSanitize|composables\/useBibleData)$/ }, ({ path }) => ({ path, namespace: 'service' }));
    builder.onLoad({ filter: /.*/, namespace: 'service' }, ({ path }) => ({ contents: path.includes('readingSettings')
      ? 'export const useReadingSettingsStore = () => globalThis.__compareSelection.settings; export const FONT_FAMILIES = { test: { css: "serif" } }; export const FONT_WEIGHTS = { normal: 400 };'
      : path.includes('useSanitize') ? 'export const useSanitize = () => ({ sanitize: html => html });'
        : 'export const VISIBLE_VERSION_NAMES = { GAE: "Primary", KNT: "Secondary" };' }));
    builder.onResolve({ filter: /^~\/components\/.*\.vue$/ }, ({ path }) => {
      if (/\/(BibleReaderView|BibleViewer|BibleCompareViewer)\.vue$/.test(path)) return;
      return { path, namespace: 'boundary' };
    });
    builder.onLoad({ filter: /.*/, namespace: 'boundary' }, ({ path }) => ({ contents:
      `export default globalThis.__compareSelection.${path.includes('SelectionFloatingControls') ? 'Controls' : path.includes('FloatingBottomBar') ? 'Slots' : 'Empty'};` }));
    builder.onResolve({ filter: /^~\// }, ({ path }) => ({ path: `${root}/app/${path.slice(2)}${path.endsWith('.vue') ? '' : '.ts'}` }));
    builder.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
      const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path });
      assert.deepEqual(errors, []);
      return { contents: compileScript(descriptor, { id: path, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } }).content,
        loader: 'ts', resolveDir: fileURLToPath(new URL('.', `file://${path}`)) };
    });
  } }],
});
const Reader = (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)).default;
const all = (node, predicate) => [...(predicate(node) ? [node] : []), ...node.children.flatMap(child => all(child, predicate))];
const matches = (node, selector) => selector.split('.').filter(Boolean).every(name => String(node.props.class ?? '').split(/\s+/).includes(name));
const node = (type, text = '') => Vue.markRaw({
  type, text, props: {}, children: [], parent: null, listeners: new Map(), scrollTop: 0, scrollHeight: 1200, clientHeight: 400,
  get nodeType() { return this.type === '#text' ? 3 : 1; },
  get textContent() { return this.type === '#comment' ? '' : this.text + this.children.map(child => child.textContent).join(''); },
  get parentElement() { return this.parent; },
  get classList() { return {
    add: (...names) => { this.props.class = [...new Set([...String(this.props.class ?? '').split(/\s+/), ...names])].join(' '); },
    remove: (...names) => { this.props.class = String(this.props.class ?? '').split(/\s+/).filter(name => !names.includes(name)).join(' '); },
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
  querySelector: () => node('teleport-target'),
  createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
  setText: (target, text) => { target.text = text; }, setElementText: (target, text) => { target.text = text; target.children = []; },
  parentNode: target => target.parent, nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] ?? null,
  patchProp(target, key, _previous, value) { target.props[key] = value; if (key === 'innerHTML') target.children = htmlNodes(value, target); },
  insert(target, parent, anchor = null) {
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1);
    target.parent = parent; const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, target);
  },
  remove(target) { target.parent.children.splice(target.parent.children.indexOf(target), 1); target.parent = null; },
});
const verses = prefix => [1, 2, 3].map(n => `<div class="verse"><span class="verse-number">${n}</span><span class="verse-text">${prefix}_${n}</span>${n === 3 ? `<span class="verse-text">${prefix}_continued</span>` : ''}</div>`).join('');
function setup(t, { ordinary = false, hidden = null } = {}) {
  const listeners = new Map(), events = [], writes = [], pending = new Map();
  const add = (name, fn) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); };
  globalThis.document = { addEventListener: add, removeEventListener: (name, fn) => listeners.get(name)?.delete(fn) };
  runtime.selection = { isCollapsed: true, removeAllRanges() { this.isCollapsed = true; } };
  globalThis.window = { getSelection: () => runtime.selection, addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => writes.push(text) } } });
  const record = kind => payload => { events.push([kind, payload]); pending.get(kind)?.(payload); };
  const props = Vue.reactive({
    content: verses('PRIMARY'), secondaryContent: verses('SECONDARY'), compareEnabled: !ordinary,
    currentBookName: 'Test Book', currentChapter: 7, currentVersionName: 'Primary',
    secondaryVersionName: 'Secondary', primaryVersionCode: 'GAE', secondaryVersionCode: 'KNT',
    chapterSuffix: '장', isLoading: false, hasPrevChapter: true, hasNextChapter: true,
    isTongdokMode: false, isCurrentChapterRead: false, bookProgress: { read: 0, total: 50, percentage: 0 },
    isAuthenticated: true, isBookmarked: false, noteCount: 0,
    onCopy: record('copy'), onShare: record('share'), onHighlightSave: record('save'), onHighlight: record('highlight'),
  });
  const host = node('root');
  const app = renderer.createApp({ render: () => Vue.h(Reader, props) });
  app.component('ClientOnly', runtime.Slots); app.mount(host); t.after(() => app.unmount());
  const body = host.querySelector('.bible-content');
  // Hidden cells stay queryable, as CSS display:none does in the browser.
  if (hidden) for (const cell of body.querySelectorAll(`.pair-${hidden}`)) cell.props.style = 'display: none';
  const paneVerses = pane => body.querySelectorAll('.verse').filter(el => ordinary || el.closest(`.pair-${pane}`));
  return { host, props, body, events, writes, paneVerses,
    state: () => runtime.controls.props.state,
    async tap(pane, number) { body.props.onClick({ target: paneVerses(pane)[number - 1].querySelector('.verse-text'), stopPropagation() {} }); await Vue.nextTick(); },
    async action(name, value) { runtime.controls.emit(name, value); await Vue.nextTick(); },
    async copy(format) {
      const copied = new Promise(resolve => pending.set('copy', resolve));
      runtime.controls.emit('copy-format', format);
      await copied; await Vue.nextTick();
    },
    async drag(pane, start, end) {
      const ordered = body.querySelectorAll('.verse'), chosen = paneVerses(pane);
      const first = ordered.indexOf(chosen[start - 1]), last = ordered.indexOf(chosen[end - 1]);
      const range = { commonAncestorContainer: body, startContainer: chosen[start - 1].querySelector('.verse-text'),
        intersectsNode: el => ordered.indexOf(el) >= Math.min(first, last) && ordered.indexOf(el) <= Math.max(first, last) };
      runtime.selection = { isCollapsed: false, anchorNode: chosen[start - 1].querySelector('.verse-text').children[0],
        toString: () => 'partial browser selection', getRangeAt: () => range, removeAllRanges() { this.isCollapsed = true; } };
      for (const fn of listeners.get('mouseup')) fn();
      await Vue.nextTick();
    },
  };
}
const expected = (pane, end = 1, ordinary = false) => {
  const prefix = pane.toUpperCase();
  const selected = Array.from({ length: end }, (_, i) => ({ number: i + 1, text: `${prefix}_${i + 1}${i === 2 ? ` ${prefix}_continued` : ''}` }));
  return { book: 'Test Book', chapter: 7, version: pane === 'primary' ? 'Primary' : 'Secondary',
    ...(ordinary ? {} : { pane }), start: 1, end, text: selected.map(v => v.text).join(' '), verses: selected };
};

for (const pane of ['primary', 'secondary']) {
  const opposite = pane === 'primary' ? 'secondary' : 'primary';
  test(`${pane} selection contains only that pane despite duplicate verse numbers`, async t => {
    const view = setup(t); await view.tap(pane, 1);
    assert.deepEqual(view.state().selection, expected(pane));
    assert.equal(view.paneVerses(opposite).filter(el => matches(el, '.selected-verse')).length, 0);
  });
  test(`${pane} multi-verse copy excludes the hidden opposite pane and retains continuation text`, { timeout: 3000 }, async t => {
    const view = setup(t, { hidden: opposite }); await view.tap(pane, 1); await view.tap(pane, 3);
    assert.equal(view.body.querySelectorAll('.verse').length, 6);
    assert.equal(view.paneVerses(opposite)[0].closest(`.pair-${opposite}`).props.style, 'display: none');
    await view.action('copy'); await view.copy('includeLocationRange');
    assert.deepEqual(view.writes, [`[Test Book7:1-3]\n${expected(pane, 3).verses.map(v => `${v.number} ${v.text}`).join('\n')}`]);
  });
  test(`${pane} highlight-save carries only the chosen text and version`, async t => {
    const view = setup(t); await view.tap(pane, 1); await view.action('highlight-color', '#FFE28A');
    assert.deepEqual(view.events.find(([kind]) => kind === 'save')[1], { ...expected(pane), color: '#FFE28A' });
  });
  test(`${pane} share carries only the chosen text, version and range`, async t => {
    const view = setup(t); await view.tap(pane, 1); await view.tap(pane, 3); await view.action('share');
    assert.deepEqual(view.events.find(([kind]) => kind === 'share')[1], { ...expected(pane, 3), startVerse: 1, endVerse: 3 });
  });
  test(`${pane} drag filters interleaved opposite cells before selection and copy`, { timeout: 3000 }, async t => {
    const view = setup(t, { hidden: opposite }); await view.drag(pane, 3, 1);
    assert.deepEqual(view.state().selection, expected(pane, 3));
    await view.action('copy'); await view.copy('excludeLocationRange');
    assert.deepEqual(view.writes, [expected(pane, 3).verses.map(v => `${v.number} ${v.text}`).join('\n')]);
  });
}

test('clicking the same verse number in the other pane starts a new selection', async t => {
  const view = setup(t); await view.tap('primary', 1); await view.tap('secondary', 1);
  assert.deepEqual(view.state().selection, expected('secondary'));
  await view.tap('secondary', 1);
  assert.equal(view.state().visible, false);
});
test('clicking a different verse in the other pane does not extend the first pane range', async t => {
  const view = setup(t); await view.tap('primary', 1); await view.tap('secondary', 3);
  const selected = view.state().selection;
  assert.equal(selected.version, 'Secondary');
  assert.deepEqual(selected.verses, [{ number: 3, text: 'SECONDARY_3 SECONDARY_continued' }]);
});
test('mobile pane switch discards the now hidden selection before another action', async t => {
  const view = setup(t); await view.tap('primary', 1);
  view.host.querySelector('.pane-switch').props.onClick(); await Vue.nextTick();
  assert.equal(view.state().visible, false);
  await view.action('share');
  assert.deepEqual(view.events, []);
  await view.tap('secondary', 1);
  assert.deepEqual(view.state().selection, expected('secondary'));
});
test('changing secondary version metadata discards an old selection even with identical text', async t => {
  const view = setup(t); await view.tap('secondary', 1);
  view.props.secondaryVersionName = 'Other'; await Vue.nextTick();
  await view.action('share'); assert.deepEqual(view.events, []);
});
test('ordinary reading preserves selection, copy, share and highlight contracts', { timeout: 3000 }, async t => {
  const view = setup(t, { ordinary: true }); await view.tap('primary', 1);
  assert.deepEqual(view.state().selection, expected('primary', 1, true));
  await view.action('copy'); await view.copy('textOnly');
  assert.deepEqual(view.writes, ['PRIMARY_1']);
  await view.tap('primary', 1); await view.action('highlight-color', '#FFE28A');
  assert.deepEqual(view.events.find(([kind]) => kind === 'save')[1], { ...expected('primary', 1, true), color: '#FFE28A' });
  await view.drag('primary', 1, 3); await view.action('share');
  assert.deepEqual(view.events.find(([kind]) => kind === 'share')[1], { ...expected('primary', 3, true), startVerse: 1, endVerse: 3 });
});
