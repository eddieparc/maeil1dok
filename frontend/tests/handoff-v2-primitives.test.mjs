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
        const script = compileScript(descriptor, { id: path, inlineTemplate: true });
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
  constructor(tag) { Vue.markRaw(this); this.tag = tag; this.props = {}; this.children = []; this.parentNode = null; this.style = { overflow: '', paddingRight: '' }; this.text = ''; }
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
  focus() {
    if (!this.isConnected || this.props.disabled) return;
    for (let ancestor = this; ancestor; ancestor = ancestor.parentNode) {
      if (ancestor.props.inert === true || ancestor.props.inert === '') return;
    }
    document.activeElement = this;
    document.dispatch('focusin', { target: this });
  }
  setPointerCapture(id) { this.pointerCapture = id; }
  matches(selector) {
    if (selector === '[role="tab"]') return this.props.role === 'tab';
    if (selector.startsWith('.')) return (this.props.class ?? '').split(' ').includes(selector.slice(1));
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
  app.mount(root);
  mounted.push(app);
  await Vue.nextTick();
  return { root, state, app, async update(props) { Object.assign(state, props); await Vue.nextTick(); } };
}
afterEach(async () => {
  for (const app of mounted.splice(0).reverse()) app.unmount();
  await Vue.nextTick();
  listeners.clear();
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
const ui = name => `components/ui/${name}.vue`;
const empty = 'components/common/EmptyState.vue';

test('FilterChip declares disabled state and preserves active/count/slot/click contracts', { timeout: 5000 }, async () => {
  const chip = (await load(ui('FilterChip'))).default;
  assert.ok(chip.props.disabled, 'disabled must be a declared prop, not an accidental fallthrough attr');
  let clicks = 0;
  const { root, update } = await mount(ui('FilterChip'), { label: 'fixture-label', active: true, count: 0, disabled: true, onClick: () => clicks++ });
  const button = root.querySelector('button');
  assert.equal(button.props.disabled, true);
  assert.equal(button.props['aria-pressed'], true);
  assert.ok(button.textContent.includes('0'));
  // Direct invocation also must not emit for an unavailable control.
  fire(button, 'Click');
  assert.equal(clicks, 0);
  await update({ disabled: false });
  fire(button, 'Click');
  assert.equal(clicks, 1);
  const slotted = await mount(ui('FilterChip'), { label: 'unused-label', count: 2 }, { default: () => Vue.h('strong', 'fixture-slot') });
  assert.equal(slotted.root.querySelector('strong').textContent, 'fixture-slot');
  assert.equal(slotted.root.querySelector('button').textContent, 'fixture-slot2');
});

test('segments connect panels and skip disabled options with roving keyboard focus', { timeout: 5000 }, async () => {
  const options = [
    { value: 1, label: 'one', id: 'tab-one', controls: 'panel-one' },
    { value: 2, label: 'two', disabled: true },
    { value: 3, label: 'three', id: 'tab-three', controls: 'panel-three' },
  ];
  const changes = [];
  const view = await mount(ui('SegmentedControl'), { modelValue: 1, options, 'aria-label': 'fixture-tabs', 'onUpdate:modelValue': value => { changes.push(value); view.state.modelValue = value; } });
  const tabs = view.root.querySelectorAll('[role="tab"]');
  assert.equal(view.root.querySelector('div').props.role, 'tablist');
  assert.equal(view.root.querySelector('div').props['aria-label'], 'fixture-tabs');
  assert.equal(tabs[0].props.id, options[0].id);
  assert.equal(tabs[0].props['aria-controls'], options[0].controls);
  assert.equal(tabs[1].props.disabled, true);
  assert.equal(tabs[0].props.tabindex, 0);
  for (const [index, key, expectedIndex] of [[0, 'ArrowRight', 2], [2, 'ArrowRight', 0], [0, 'ArrowLeft', 2], [2, 'Home', 0], [0, 'End', 2]]) {
    const event = fire(tabs[index], 'Keydown', { key });
    await Vue.nextTick();
    assert.equal(event.defaultPrevented, true);
    assert.equal(changes.at(-1), options[expectedIndex].value);
    assert.equal(document.activeElement, tabs[expectedIndex]);
    assert.equal(tabs[expectedIndex].props.tabindex, 0);
    assert.equal(tabs[expectedIndex].props['aria-selected'], true);
  }
  fire(tabs[1], 'Click');
  assert.equal(changes.length, 5);
  fire(tabs[0], 'Keydown', { key: 'Tab' });
  assert.equal(changes.length, 5);
  fire(tabs[0], 'Click');
  await Vue.nextTick();
  assert.equal(changes.at(-1), 1);
});

test('segments allow optional group disabled and an enabled fallback when selection is absent or disabled', { timeout: 5000 }, async () => {
  let changes = 0;
  const view = await mount(ui('SegmentedControl'), { modelValue: 'missing', options: [{ value: 'a', label: 'A', disabled: true }, { value: 'b', label: 'B' }], 'onUpdate:modelValue': () => changes++ });
  const tabs = view.root.querySelectorAll('[role="tab"]');
  assert.deepEqual(tabs.map(tab => tab.props.tabindex), [-1, 0]);
  await view.update({ modelValue: 'a' });
  assert.deepEqual(tabs.map(tab => tab.props.tabindex), [-1, 0]);
  await view.update({ disabled: true });
  assert.ok(tabs.every(tab => tab.props.disabled && tab.props.tabindex === -1));
  fire(tabs[1], 'Keydown', { key: 'Home' });
  fire(tabs[1], 'Click');
  assert.equal(changes, 0);
  await view.update({ disabled: false, options: [{ value: 'a', label: 'A', disabled: true }] });
  fire(view.root.querySelector('button'), 'Keydown', { key: 'End' });
  assert.equal(changes, 0);
  await view.update({ options: [] });
  assert.equal(view.root.querySelectorAll('button').length, 0);
});

test('StatusBadge renders the four existing STATUS_TEXT values and preserves attrs', { timeout: 5000 }, async () => {
  const { STATUS_TEXT } = await load('types/plan.ts');
  const view = await mount(ui('StatusBadge'), { status: 'completed', 'data-testid': 'fixture-badge' });
  for (const status of Object.keys(STATUS_TEXT)) {
    await view.update({ status });
    const badge = view.root.querySelector('span');
    assert.equal(badge.textContent, STATUS_TEXT[status]);
    assert.equal(badge.props['data-testid'], 'fixture-badge');
    assert.ok(badge.props.class.split(' ').includes(`status-badge--${status}`));
  }
});

test('common EmptyState maps legacy text/hint/guide/fullscreen without leaking props to the DOM', { timeout: 5000 }, async () => {
  const legacy = { text: 'fixture-title', hint: 'fixture-hint', guide: ['fixture-first', 'fixture-second'], fullscreen: true };
  const view = await mount(empty, legacy);
  assert.equal(view.root.querySelector('h3').textContent, legacy.text);
  assert.equal(view.root.querySelector('p').textContent, legacy.hint);
  assert.deepEqual(view.root.querySelectorAll('li').map(node => node.textContent), legacy.guide);
  assert.ok(view.root.querySelector('.fullscreen'));
  for (const key of Object.keys(legacy)) assert.equal(view.root.querySelector('div').props[key], undefined);
  await view.update({ fullscreen: false, guide: [] });
  assert.equal(view.root.querySelector('.fullscreen'), null);
  assert.equal(view.root.querySelector('ol'), null);
});

test('common EmptyState gives explicit modern props precedence, including empty strings', { timeout: 5000 }, async () => {
  const view = await mount(empty, { text: 'legacy-title', hint: 'legacy-hint', title: 'modern-title', description: 'modern-description' });
  assert.equal(view.root.querySelector('h3').textContent, 'modern-title');
  assert.equal(view.root.querySelector('p').textContent, 'modern-description');
  await view.update({ title: '', description: '' });
  assert.equal(view.root.querySelector('h3').textContent, '');
  assert.equal(view.root.querySelector('p'), null);
  await view.update({ title: undefined, description: undefined });
  assert.equal(view.root.querySelector('h3').textContent, 'legacy-title');
  assert.equal(view.root.querySelector('p').textContent, 'legacy-hint');
});

test('EmptyState preserves guide/action/icon slots and action emission', { timeout: 5000 }, async () => {
  let actions = 0;
  const view = await mount(empty, { actionText: 'fixture-action', guide: ['unused-guide'], onAction: () => actions++ }, {
    icon: () => Vue.h('svg', { 'data-testid': 'custom-icon' }),
    guide: () => Vue.h('aside', 'fixture-guide-slot'),
  });
  assert.ok(view.root.querySelector('aside'));
  assert.equal(view.root.querySelector('ol'), null);
  assert.equal(view.root.querySelector('svg').props['data-testid'], 'custom-icon');
  fire(view.root.querySelector('button'), 'Click');
  assert.equal(actions, 1);
  const slotted = await mount(empty, { actionText: 'unused-action' }, { action: () => Vue.h('a', { href: '/fixture' }, 'slot-action') });
  assert.equal(slotted.root.querySelector('button'), null);
  assert.equal(slotted.root.querySelector('a').props.href, '/fixture');
});

test('AppButton preserves button/link loading and disabled activation guards', { timeout: 5000 }, async () => {
  let clicks = 0;
  const view = await mount(ui('AppButton'), { loading: true, onClick: () => clicks++ }, { default: () => 'fixture-action' });
  let control = view.root.querySelector('button');
  assert.equal(control.props.disabled, true);
  assert.equal(control.props['aria-busy'], true);
  assert.equal(fire(control, 'Click').defaultPrevented, true);
  assert.equal(clicks, 0);
  await view.update({ loading: false });
  fire(control, 'Click');
  assert.equal(clicks, 1);
  await view.update({ to: '/fixture', disabled: true });
  control = view.root.querySelector('a');
  assert.equal(control.props['aria-disabled'], true);
  assert.equal(control.props.tabindex, -1);
  assert.equal(fire(control, 'Click').defaultPrevented, true);
  assert.equal(clicks, 1);
  await view.update({ disabled: false });
  assert.equal(fire(control, 'Click').defaultPrevented, false);
  assert.equal(clicks, 2);
});

test('BottomSheet retains attrs, slots, focus/scroll integration and ESC/scrim/drag dismissal', { timeout: 5000 }, async () => {
  installHost();
  const trigger = new Element('button');
  document.body.appendChild(trigger);
  trigger.focus();
  let closes = 0;
  const view = await mount(ui('BottomSheet'), { modelValue: false, title: 'fixture-title', class: 'reading-settings-sheet', 'data-testid': 'fixture-sheet', 'onUpdate:modelValue': value => { closes++; view.state.modelValue = value; } }, {
    default: () => Vue.h('button', 'content-action'),
    footer: ({ close }) => Vue.h('button', { onClick: close }, 'footer-action'),
  });
  for (const dismiss of ['Escape', 'scrim', 'drag', 'close', 'footer']) {
    await view.update({ modelValue: true });
    const sheet = document.body.querySelector('section');
    assert.equal(sheet.props.role, 'dialog');
    assert.equal(String(sheet.props['aria-modal']), 'true');
    assert.equal(sheet.props['data-testid'], 'fixture-sheet');
    assert.ok(sheet.props.class.includes('reading-settings-sheet'));
    assert.equal(sheet.props['aria-labelledby'], sheet.querySelector('h2').props.id);
    assert.equal(document.body.style.overflow, 'hidden');
    assert.ok(sheet.contains(document.activeElement), 'focus enters the sheet');
    if (dismiss === 'Escape') {
      document.dispatch('keydown', { key: 'Escape' });
    } else if (dismiss === 'scrim') {
      const overlay = document.body.querySelector('.bottom-sheet__overlay');
      fire(overlay, 'Click', { target: sheet });
      assert.equal(view.state.modelValue, true, 'content click must not dismiss');
      fire(overlay, 'Click');
    } else if (dismiss === 'drag') {
      const handle = sheet.querySelector('.bottom-sheet__handle-area');
      fire(handle, 'Pointerdown', { isPrimary: true, button: 0, pointerId: 1, clientY: 100 });
      fire(handle, 'Pointerup', { clientY: 147 });
      assert.equal(view.state.modelValue, true);
      fire(handle, 'Pointerdown', { isPrimary: true, button: 0, pointerId: 1, clientY: 100 });
      fire(handle, 'Pointerup', { clientY: 148 });
    } else if (dismiss === 'close') fire(sheet.querySelector('.bottom-sheet__close'), 'Click');
    else fire(sheet.querySelector('footer').querySelector('button'), 'Click');
    await Vue.nextTick();
    assert.equal(view.state.modelValue, false);
    assert.equal(document.body.style.overflow, '');
    assert.equal(document.activeElement, trigger);
  }
  assert.equal(closes, 5);
});


test('two real BottomSheets give only the topmost sheet Escape and retain focus/scroll ownership', { timeout: 5000 }, async () => {
  installHost();
  document.body.style.overflow = 'auto';
  document.body.style.paddingRight = '7px';
  const trigger = new Element('button');
  document.body.appendChild(trigger);
  trigger.focus();
  const closes = [];
  const lower = await mount(ui('BottomSheet'), {
    modelValue: false, title: 'lower',
    'onUpdate:modelValue': value => { closes.push('lower'); lower.state.modelValue = value; },
  }, { default: () => Vue.h('button', { class: 'nested-sheet-trigger' }, 'open-upper') });
  await lower.update({ modelValue: true });
  const lowerSheet = document.body.querySelector('section');
  const lowerButton = lowerSheet.querySelector('.nested-sheet-trigger');
  lowerButton.focus();
  assert.equal(document.activeElement, lowerButton);

  // Loading the same actual SFC twice shares its real focus/scroll modules.
  const upper = await mount(ui('BottomSheet'), {
    modelValue: false, title: 'upper',
    'onUpdate:modelValue': value => { closes.push('upper'); upper.state.modelValue = value; },
  }, { default: () => Vue.h('button', 'upper-action') });
  await upper.update({ modelValue: true });
  const upperSheet = document.body.querySelectorAll('section')[1];
  assert.ok(upperSheet.contains(document.activeElement));
  assert.equal(document.body.style.overflow, 'hidden');

  // Outside and lower-sheet focus are contained by the upper trap, not fought
  // over by two traps. Tab wraps inside the upper sheet in both directions.
  lowerButton.focus();
  assert.ok(upperSheet.contains(document.activeElement));
  trigger.focus();
  assert.ok(upperSheet.contains(document.activeElement));
  const upperButtons = upperSheet.querySelectorAll('button');
  upperButtons.at(-1).focus();
  document.dispatch('keydown', { key: 'Tab' });
  assert.equal(document.activeElement, upperButtons[0]);
  document.dispatch('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(document.activeElement, upperButtons.at(-1));

  // Subscribe before dismissal: restoration to a resumed trap is deferred to
  // Vue's next render, so await that exact focus event rather than a delay.
  const lowerFocused = new Promise(resolve => {
    const listener = event => {
      if (event.target !== lowerButton) return;
      document.removeEventListener('focusin', listener);
      resolve();
    };
    document.addEventListener('focusin', listener);
  });
  const firstEscape = document.dispatch('keydown', { key: 'Escape' });
  await Vue.nextTick();
  assert.deepEqual(closes, ['upper']);
  assert.equal(upper.state.modelValue, false);
  assert.equal(lower.state.modelValue, true);
  assert.deepEqual(document.body.querySelectorAll('section'), [lowerSheet]);
  assert.equal(document.body.style.overflow, 'hidden');
  assert.equal(document.body.style.paddingRight, '7px');
  assert.equal(firstEscape.defaultPrevented, true);
  await lowerFocused;
  assert.equal(document.activeElement, lowerButton);

  trigger.focus();
  assert.ok(lowerSheet.contains(document.activeElement), 'remaining sheet resumes focus containment');
  const triggerFocused = new Promise(resolve => {
    const listener = event => {
      if (event.target !== trigger) return;
      document.removeEventListener('focusin', listener);
      resolve();
    };
    document.addEventListener('focusin', listener);
  });
  document.dispatch('keydown', { key: 'Escape' });
  await triggerFocused;
  await Vue.nextTick();
  assert.deepEqual(closes, ['upper', 'lower']);
  assert.equal(lower.state.modelValue, false);
  assert.equal(document.body.querySelectorAll('section').length, 0);
  assert.equal(document.activeElement, trigger);
  assert.equal(document.body.style.overflow, 'auto');
  assert.equal(document.body.style.paddingRight, '7px');
  assert.equal(document.dispatch('keydown', { key: 'Tab' }).defaultPrevented, false);
  assert.equal(document.dispatch('keydown', { key: 'Escape' }).defaultPrevented, false);
});
