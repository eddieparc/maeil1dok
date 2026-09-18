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
const cache = new Map();
let ancestorScrollCalls = 0;

// Compile the shipped setup and template together. Only Nuxt's routing boundary
// and CSS transition hooks are substituted; Vue reactivity and overlay hooks run.
async function load(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const result = await build({
    entryPoints: [resolve(appDir, relative)], bundle: true, write: false,
    platform: 'node', format: 'cjs', logLevel: 'silent',
    external: ['vue', '@lucide/vue', '#components'],
    define: { 'import.meta.client': 'true', 'import.meta.server': 'false' },
    plugins: [{ name: 'runtime-sfc', setup(build) {
      build.onResolve({ filter: /^~\// }, ({ path }) => ({ path: resolve(appDir, path.slice(2) + (path.endsWith('.vue') ? '' : '.ts')) }));
      build.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
        const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path });
        assert.deepEqual(errors, []);
        const script = compileScript(descriptor, { id: path, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } });
        return { contents: script.content, loader: 'ts', resolveDir: dirname(path) };
      });
    } }],
  });
  const module = { exports: {} };
  const localRequire = name => {
    if (name === 'vue') return { ...Vue, Transition: Vue.BaseTransition };
    if (name === '#components') return { NuxtLink: Vue.defineComponent({
      props: ['to'], setup: (props, { slots }) => () => Vue.h('a', { href: props.to }, slots.default?.()),
    }) };
    return require(name);
  };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(localRequire, module, module.exports);
  cache.set(relative, module.exports);
  return module.exports;
}

// A small in-memory renderer exercises actual component event handlers, attrs,
// slots and lifecycle without a browser or any dependency installation. It does
// not measure layout, CSS, native navigation or visual accessibility.
class Element {
  constructor(tag) { Vue.markRaw(this); this.tag = tag; this.props = {}; this.children = []; this.parentNode = null; this.style = { overflow: '', paddingRight: '' }; this.text = ''; this.scrollTop = 0; this.clientHeight = 210; this.clientTop = 2; }
  get parentElement() { return this.parentNode; }
  get offsetParent() { return this.parentNode; }
  get offsetWidth() { return 0; }
  get isConnected() { return this === document.body || !!this.parentNode?.isConnected; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  appendChild(child) { insert(child, this); }
  removeChild(child) { remove(child); }
  setAttribute(key, value) { this.props[key] = value; }
  getAttribute(key) { return this.props[key] ?? null; }
  hasAttribute(key) { return this.props[key] !== undefined && this.props[key] !== false; }
  removeAttribute(key) { delete this.props[key]; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  focus(options) {
    this.focusOptions = options;
    if (!this.isConnected || this.props.disabled) return;
    for (let ancestor = this; ancestor; ancestor = ancestor.parentNode) {
      if (ancestor.props.inert === true || ancestor.props.inert === '') return;
    }
    document.activeElement = this;
    document.dispatch('focusin', { target: this });
  }
  blur() { document.activeElement = null; }
  scrollIntoView() { ancestorScrollCalls++; document.body.scrollTop = 999; }
  getBoundingClientRect() {
    if (this.props['data-chapter'] || this.props['data-id']) {
      const isChapter = this.props['data-chapter'] !== undefined;
      const container = document.body.querySelector(isChapter ? '.chapters-section' : '.books-section');
      const index = isChapter ? Number(this.props['data-chapter']) - 1 : container.querySelectorAll('.book-item').indexOf(this);
      return { top: 100 + container.clientTop + index * 42 - container.scrollTop, height: 42 };
    }
    return { top: 100, height: this.clientHeight };
  }
  setPointerCapture(id) { this.pointerCapture = id; }
  matches(selector) {
    const attr = selector.match(/^\[([^=]+)="([^"]+)"\]$/);
    if (attr) return String(this.props[attr[1]]) === attr[2];
    if (selector === '[role="tab"]') return this.props.role === 'tab';
    if (selector.startsWith('.')) return (this.props.class ?? '').split(' ').includes(selector.slice(1));
    if (selector === 'input:not([disabled])') return this.tag === 'input' && !this.props.disabled;
    if (selector === 'button:not([disabled])') return this.tag === 'button' && !this.props.disabled;
    if (selector === 'a[href]') return this.tag === 'a' && !!this.props.href;
    if (selector === '[tabindex]:not([tabindex="-1"])') return this.props.tabindex !== undefined && Number(this.props.tabindex) !== -1;
    return this.tag === selector;
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [ ...(selector.split(',').some(part => child.matches(part.trim())) ? [child] : []), ...child.querySelectorAll(selector) ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}
function remove(node) {
  if (node.parentNode) node.parentNode.children.splice(node.parentNode.children.indexOf(node), 1);
  node.parentNode = null;
}
function insert(node, parent, anchor = null) {
  remove(node);
  parent.children.splice(anchor ? parent.children.indexOf(anchor) : parent.children.length, 0, node);
  node.parentNode = parent;
}
const listeners = new Map();
const originalGlobals = new Map(['document', 'window', 'HTMLElement', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
function installHost() {
  globalThis.document = {
    body: new Element('body'), activeElement: null,
    createElement: tag => new Element(tag),
    addEventListener(type, fn, options) {
      const capture = options === true || options?.capture === true;
      const entries = listeners.get(type) ?? [];
      if (!entries.some(entry => entry.fn === fn && entry.capture === capture)) entries.push({ fn, capture });
      listeners.set(type, entries);
    },
    removeEventListener(type, fn, options) {
      const capture = options === true || options?.capture === true;
      listeners.set(type, (listeners.get(type) ?? []).filter(entry => entry.fn !== fn || entry.capture !== capture));
    },
    dispatch(type, values = {}) {
      const event = { type, target: document.activeElement, defaultPrevented: false, stopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopImmediatePropagation() { this.stopped = true; }, ...values };
      // A real capture-phase owner must be able to block every bubble listener.
      for (const capture of [true, false]) {
        for (const entry of [...(listeners.get(type) ?? [])].filter(entry => entry.capture === capture)) {
          entry.fn(event);
          if (event.stopped) return event;
        }
      }
      return event;
    },
    querySelector: selector => document.body.querySelector(selector),
  };
  globalThis.window = { innerWidth: 390, scrollX: 0, scrollY: 0, scrollTo() {} };
  globalThis.HTMLElement = Element;
  globalThis.requestAnimationFrame = callback => { queueMicrotask(() => callback(0)); return 1; };
  globalThis.cancelAnimationFrame = () => {};
  globalThis.getComputedStyle = node => node.style;
}
const renderer = Vue.createRenderer({
  createElement: tag => new Element(tag),
  createText: text => Object.assign(new Element('#text'), { text }),
  createComment: () => new Element('#comment'),
  setText: (node, text) => { node.text = text; },
  setElementText: (node, text) => { node.children = []; node.text = text; },
  patchProp: (node, key, _old, value) => { node.props[key] = value; },
  insert, remove, parentNode: node => node.parentNode,
  nextSibling: node => node.parentNode?.children[node.parentNode.children.indexOf(node) + 1] ?? null,
  querySelector: selector => selector === 'body' ? document.body : document.querySelector(selector),
  setScopeId() {}, insertStaticContent() { throw new Error('Unexpected static HTML'); },
});
const mounted = [];
async function mount(relative, props = {}, slots = {}) {
  if (!globalThis.document) installHost();
  const component = (await load(relative)).default;
  const state = Vue.reactive({ ...props });
  const root = new Element('root');
  document.body.appendChild(root);
  const app = renderer.createApp({ setup: () => () => Vue.h(component, state, slots) });
  // Legacy boundary is rendered only for baseline RED. Shared BottomSheet is real.
  app.component('UiModalBaseModal', { props: ['modelValue'], setup: (props, { slots }) => () => props.modelValue ? Vue.h('section', slots.default?.()) : null });
  app.mount(root);
  mounted.push(app);
  await Vue.nextTick();
  return { root, state, app, async update(props) { Object.assign(state, props); await Vue.nextTick(); } };
}
afterEach(async () => {
  for (const app of mounted.splice(0).reverse()) app.unmount();
  await Vue.nextTick();
  listeners.clear();
  ancestorScrollCalls = 0;
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
});
function fire(node, name, values = {}) {
  const event = { target: node, currentTarget: node, defaultPrevented: false, stopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopImmediatePropagation() { this.stopped = true; }, ...values };
  const invoke = handler => { for (const fn of [handler].flat()) if (fn && !event.stopped) fn(event); };
  invoke(node.props[`on${name}Capture`]);
  if (!event.stopped) invoke(node.props[`on${name}`]);
  return event;
}

// Real selector, parser/data and BottomSheet; only host geometry and CSS
// transitions are synthetic. These tests do not claim native layout proof.
async function selector(props = {}) {
  const events = [];
  const view = await mount('components/bible/BookSelector.vue', {
    modelValue: false, currentBook: 'jhn', currentChapter: 3, currentVersion: 'GAE', ...props,
    onSelect: (...args) => events.push(['select', ...args]),
    onVersionSelect: version => events.push(['version-select', version]),
    onCompareToggle: () => events.push(['compare-toggle']),
    'onUpdate:modelValue': value => { events.push(['update:modelValue', value]); view.state.modelValue = value; },
  });
  document.body.scrollTop = 17;
  await view.update({ modelValue: true });
  return { ...view, events, find: selector => document.body.querySelector(selector), all: selector => document.body.querySelectorAll(selector) };
}
async function act(node, name, values = {}) {
  assert.ok(node, `event target for ${name} exists`);
  fire(node, name, values);
  await Vue.nextTick();
}
const input = (view, value) => act(view.find('input'), 'Input', { target: { value } });
const enter = view => act(view.find('input'), 'Keydown', { key: 'Enter' });

test('shared sheet dialog closes through controlled event', { timeout: 5000 }, async () => {
  const view = await selector();
  assert.ok(view.find('.bottom-sheet'));
  assert.equal(view.find('.bottom-sheet').props.role, 'dialog');
  await act(view.find('.bottom-sheet__close'), 'Click');
  assert.deepEqual(view.events, [['update:modelValue', false]]);
  assert.equal(view.find('.bottom-sheet'), null);
});

test('opening and reopening centers only owned book/chapter scrollers', { timeout: 5000 }, async () => {
  const view = await selector();
  assert.equal(ancestorScrollCalls, 0);
  assert.equal(document.body.scrollTop, 17);
  assert.equal(view.find('.books-section').scrollTop, 42 * 42 + 21 - 105);
  assert.equal(view.find('.chapters-section').scrollTop, 0);
  await view.update({ modelValue: false });
  await view.update({ currentBook: 'psa', currentChapter: 119, modelValue: true });
  assert.equal(view.find('.chapters-section').scrollTop, 118 * 42 + 21 - 105);
  assert.equal(view.find('.books-section').scrollTop, 18 * 42 + 21 - 105);
  assert.equal(document.body.scrollTop, 17);
});

test('initially open mount centers after sheet refs exist', { timeout: 5000 }, async () => {
  const view = await selector({ modelValue: true, currentBook: 'psa', currentChapter: 119 });
  assert.equal(view.find('.chapters-section').scrollTop, 118 * 42 + 21 - 105);
  assert.equal(ancestorScrollCalls, 0);
});

test('read chapters are optional, reactive and book-scoped, not ordinal inferred', { timeout: 5000 }, async () => {
  const view = await selector();
  assert.equal(view.all('.read').length, 0);
  await view.update({ readChapters: { jhn: [1, 3], gen: [2] } });
  assert.deepEqual(view.all('.read').map(node => node.props['data-chapter']), [1, 3]);
  assert.ok(view.find('[data-chapter="3"]').matches('.active'));
  assert.equal(view.find('[data-chapter="2"]').matches('.read'), false);
  await act(view.find('[data-id="gen"]'), 'Click');
  assert.deepEqual(view.all('.read').map(node => node.props['data-chapter']), [2]);
  assert.equal(view.all('.chapter-item').length, 50);
  assert.equal(view.all('.active').filter(node => node.matches('.chapter-item')).length, 0);
});

test('search centers rendered results without timers or ancestor scrolling', { timeout: 5000 }, async () => {
  const view = await selector();
  await input(view, '시편 119편 105절');
  assert.ok(view.find('[data-chapter="119"]').matches('.searched'));
  assert.equal(view.find('.chapters-section').scrollTop, 118 * 42 + 21 - 105);
  assert.equal(ancestorScrollCalls, 0);
  await act(view.find('[data-id="gen"]'), 'Click');
  assert.equal(view.all('.searched').length, 0);
  assert.deepEqual(view.find('input').focusOptions, { preventScroll: true });
  assert.equal(document.body.scrollTop, 17);
});

test('switching books clears a same-number searched chapter state', { timeout: 5000 }, async () => {
  const view = await selector();
  await input(view, '요3:16');
  await act(view.find('[data-id="gen"]'), 'Click');
  assert.equal(view.find('[data-chapter="3"]').matches('.searched'), false);
});

test('numeric focus does not scroll an ancestor', { timeout: 5000 }, async () => {
  const view = await selector();
  await act(view.find('[data-id="gen"]'), 'Click');
  assert.deepEqual(view.find('input').focusOptions, { preventScroll: true });
  await input(view, '2'); await enter(view);
  assert.deepEqual(view.find('input').focusOptions, { preventScroll: true });
});

test('version chips preserve supported codes and emit without closing', { timeout: 5000 }, async () => {
  const view = await selector();
  assert.equal(view.all('.version-chip').filter(chip => !chip.matches('.compare-toggle')).length, 8);
  assert.equal(view.all('.compare-toggle').length, 1);
  await act(view.all('.version-chip')[1], 'Click');
  assert.deepEqual(view.events, [['version-select', 'KNT']]);
  assert.equal(view.state.modelValue, true);
  await view.update({ currentVersion: 'KNT' });
  assert.ok(view.all('.version-chip')[1].matches('.active'));
  await act(view.find('.compare-toggle'), 'Click');
  assert.deepEqual(view.events, [['version-select', 'KNT'], ['compare-toggle']]);
  assert.equal(view.state.modelValue, true);
});

for (const [query, expected, action] of [
  ['창3', ['gen', 3, undefined], 'click'],
  ['창3', ['gen', 3, undefined], 'enter'],
  ['창1:3', ['gen', 1, 3], 'click'],
  ['ㅊㅅㄱ 1 3', ['gen', 1, 3], 'enter'],
  ['시편 119편 105절', ['psa', 119, 105], 'enter'],
]) {
  test(`real parser payload for ${query} via ${action}`, { timeout: 5000 }, async () => {
    const view = await selector(); await input(view, query);
    if (action === 'click') await act(view.find('.search-result-button'), 'Click'); else await enter(view);
    assert.deepEqual(view.events, [['select', ...expected], ['update:modelValue', false]]);
    assert.equal(view.state.modelValue, false);
    assert.equal(view.find('.bottom-sheet'), null);
  });
}

test('prefix candidates and mobile numeric submit preserve staged navigation', { timeout: 5000 }, async () => {
  const view = await selector(); await input(view, '요한');
  assert.equal(view.all('.search-result-item').length, 5);
  await act(view.all('.search-result-item')[1], 'Click');
  assert.ok(view.find('[data-id="1jn"]').matches('.active'));
  await act(view.find('.search-result-button'), 'Click');
  assert.equal(view.find('input').props.inputmode, 'numeric');
  await input(view, '2'); await act(view.find('.search-submit-button'), 'Click');
  assert.deepEqual(view.events, []);
  await act(view.find('.search-submit-button'), 'Click');
  assert.deepEqual(view.events, [['select', '1jn', 2, undefined], ['update:modelValue', false]]);
});

test('book selection retains staged verse entry and chapter list keeps two-argument payload', { timeout: 5000 }, async () => {
  const view = await selector();
  await act(view.find('[data-id="jhn"]'), 'Click');
  await input(view, '3'); await enter(view);
  assert.deepEqual(view.events, []);
  await input(view, '16'); await enter(view);
  assert.deepEqual(view.events, [['select', 'jhn', 3, 16], ['update:modelValue', false]]);
  await view.update({ modelValue: true });
  await act(view.find('[data-id="psa"]'), 'Click');
  assert.equal(view.all('.chapter-item').length, 150);
  // Chapter suffix is rendered location data, not UI-prose pinning.
  assert.equal(view.find('[data-chapter="119"]').textContent, '119편');
  await act(view.find('[data-chapter="119"]'), 'Click');
  assert.deepEqual(view.events.slice(-2), [['select', 'psa', 119], ['update:modelValue', false]]);
});


test('search controls and selected locations expose accessible machine states', { timeout: 5000 }, async () => {
  const view = await selector();
  assert.ok(view.find('input').props['aria-label']);
  assert.equal(view.all('.version-chip')[0].props['aria-pressed'], true);
  assert.equal(view.find('[data-id="jhn"]').props['aria-pressed'], true);
  assert.equal(view.find('[data-chapter="3"]').props['aria-current'], 'location');
  await input(view, '요한');
  assert.ok(view.find('.search-clear-button').props['aria-label']);
  assert.equal(view.all('.search-result-item')[0].props['aria-pressed'], true);
});
