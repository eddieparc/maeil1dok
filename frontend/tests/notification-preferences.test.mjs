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

// Same in-memory renderer approach as handoff-v2-primitives.test.mjs: real Vue
// reactivity and event handlers run, only Nuxt routing/stores/composables are
// substituted at the module boundary.
const STUB_MODULES = new Map([
  ['stores/notifications', 'export const useNotificationsStore = () => globalThis.__npStore;'],
  ['composables/useAuthService', 'export const useAuthService = () => globalThis.__npAuth;'],
  ['composables/useToast', 'export const useToast = () => globalThis.__npToast;'],
  ['components/common/PageLayout.vue', `import { h } from 'vue';
    export default (props, { slots }) => h('main', [h('h1', props.title), slots.default?.()]);`],
  ['components/ErrorState.vue', `import { h } from 'vue';
    export default (props, { emit }) => h('section', { 'data-testid': 'error-state' }, props.message);`],
  ['components/common/EmptyState.vue', `import { h } from 'vue';
    export default (props, { slots }) => h('section', { 'data-testid': 'empty-state' }, [h('p', props.text), slots.action?.()]);`],
  ['components/notifications/DevicePushSetting.vue', `import { h } from 'vue';
    export default () => h('div', { 'data-testid': 'device-push-setting' });`],
  ['components/ui/skeleton/SkeletonList.vue', `import { h } from 'vue';
    export default () => h('div', { 'data-testid': 'skeleton-list' });`],
]);

async function load(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const result = await build({
    entryPoints: [resolve(appDir, relative)], bundle: true, write: false,
    platform: 'node', format: 'cjs', logLevel: 'silent',
    external: ['vue', '@lucide/vue', '#components'],
    define: { 'import.meta.client': 'true', 'import.meta.server': 'false' },
    plugins: [{ name: 'notification-preferences-stubs', setup(build) {
      build.onResolve({ filter: /^~\// }, ({ path }) => {
        const rel = path.slice(2);
        if (STUB_MODULES.has(rel)) return { path: rel, namespace: 'np-stub' };
        return { path: resolve(appDir, rel + (rel.endsWith('.vue') ? '' : '.ts')) };
      });
      build.onLoad({ filter: /.*/, namespace: 'np-stub' }, ({ path }) => ({
        contents: STUB_MODULES.get(path), loader: 'js',
      }));
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
    if (name === 'vue') return Vue;
    if (name === '#components') return { NuxtLink: Vue.defineComponent({
      props: ['to'], setup: (props, { slots }) => () => Vue.h('a', { href: props.to }, slots.default?.()),
    }) };
    return require(name);
  };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(localRequire, module, module.exports);
  cache.set(relative, module.exports);
  return module.exports;
}

class Element {
  constructor(tag) {
    Vue.markRaw(this);
    this.tag = tag;
    this.props = {};
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.text = '';
    this.value = undefined;
    this.listeners = new Map();
  }
  get parentElement() { return this.parentNode; }
  get isConnected() { return this === document.body || !!this.parentNode?.isConnected; }
  getRootNode() { return document; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join(''); }
  appendChild(child) { insert(child, this); }
  removeChild(child) { remove(child); }
  setAttribute(key, value) { this.props[key] = value; }
  getAttribute(key) { return this.props[key] ?? null; }
  hasAttribute(key) { return this.props[key] !== undefined && this.props[key] !== false; }
  removeAttribute(key) { delete this.props[key]; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  addEventListener(type, fn) {
    const entries = this.listeners.get(type) ?? [];
    entries.push(fn);
    this.listeners.set(type, entries);
  }
  removeEventListener(type, fn) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(entry => entry !== fn));
  }
  focus() {
    if (!this.isConnected || this.props.disabled) return;
    document.activeElement = this;
  }
  matches(selector) {
    const attr = selector.match(/^([a-zA-Z-]+)?\[([\w-]+)(?:="([^"]*)")?\]$/);
    if (attr) {
      const [, tag, name, value] = attr;
      if (tag && this.tag !== tag) return false;
      if (value === undefined) return this.hasAttribute(name);
      return this.props[name] === value;
    }
    if (selector.startsWith('.')) return (this.props.class ?? '').split(' ').includes(selector.slice(1));
    return this.tag === selector;
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [
      ...(selector.split(',').some(part => child.matches(part.trim())) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
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
const originalGlobals = new Map(['document', 'window', 'HTMLElement', 'Document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
class Document {}
function installHost() {
  globalThis.Document = Document;
  globalThis.document = Object.assign(Object.create(Document.prototype), {
    body: new Element('body'), activeElement: null,
    createElement: tag => new Element(tag),
    addEventListener() {}, removeEventListener() {},
    querySelector: selector => document.body.querySelector(selector),
  });
  globalThis.window = { innerWidth: 390, scrollX: 0, scrollY: 0, scrollTo() {} };
  globalThis.HTMLElement = Element;
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
  app.component('NuxtLink', Vue.defineComponent({
    props: ['to'], setup: (props, { slots }) => () => Vue.h('a', { href: props.to }, slots.default?.()),
  }));
  app.mount(root);
  mounted.push(app);
  await Vue.nextTick();
  return { root, state, app, async update(props) { Object.assign(state, props); await Vue.nextTick(); } };
}
afterEach(async () => {
  for (const app of mounted.splice(0).reverse()) app.unmount();
  await Vue.nextTick();
  document.body.children = [];
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
  for (const fn of [...(node.listeners.get(name.toLowerCase()) ?? [])]) {
    if (!event.stopped) fn(event);
  }
  return event;
}
function typeValue(node, value) {
  node.value = value;
  fire(node, 'Input', { target: node });
}
function byTestId(root, testId) {
  return root.querySelector(`[data-testid="${testId}"]`);
}
function switchControl(root, testId) {
  const host = byTestId(root, testId);
  assert.ok(host, `expected data-testid="${testId}" to exist`);
  return host.props.role === 'switch' ? host : host.querySelector('[role="switch"]');
}
function clickSwitch(root, testId) {
  const control = switchControl(root, testId);
  assert.ok(control, `expected a switch inside data-testid="${testId}"`);
  fire(control, 'Click');
}

const SETTINGS_PAGE = 'pages/notifications/settings.vue';

function baseSettings(overrides = {}) {
  return {
    notifications_enabled: true,
    reading_reminders_enabled: true,
    hasena_reminders_enabled: true,
    friend_activity_enabled: true,
    reading_reminder_time: '20:00',
    hasena_reminder_time: '07:00',
    timezone: 'Asia/Seoul',
    streak_reminders_enabled: true,
    streak_reminder_time: '22:00',
    reminder_weekdays: [0, 1, 2, 3, 4, 5, 6],
    quiet_hours_enabled: true,
    quiet_hours_start: '23:00',
    quiet_hours_end: '07:00',
    paused_until: null,
    daily_push_limit: 3,
    ...overrides,
  };
}

function useFixtures(settings, storeOverrides = {}) {
  globalThis.useHead = () => {};
  globalThis.__npAuth = { isAuthenticated: { value: true }, user: { value: { id: 1 } } };
  globalThis.__npToast = { success: () => {}, error: () => {} };
  globalThis.__npStore = Vue.reactive({
    settings,
    isLoading: false,
    isSaving: false,
    hasLoadedSettings: true,
    error: null,
    devicePush: { supported: false, permission: 'unsupported', subscribed: false, isSyncing: false, error: null },
    fetchSettings: async () => {},
    syncDevicePushState: async () => {},
    updateSettings: async () => ({ success: true }),
    ...storeOverrides,
  });
  return globalThis.__npStore;
}

async function mountSettingsPage(settings, storeOverrides = {}) {
  const store = useFixtures(settings, storeOverrides);
  const view = await mount(SETTINGS_PAGE);
  return { ...view, store };
}

test('settings page renders scenario controls for streak, weekdays, timezone, quiet hours, pause, and daily limit', async () => {
  const { root } = await mountSettingsPage(baseSettings());
  for (const testId of [
    'streak-reminders-enabled', 'streak-reminder-time',
    'reminder-weekdays', 'notification-timezone',
    'quiet-hours-enabled', 'quiet-hours-start', 'quiet-hours-end',
    'pause-mode', 'daily-push-limit',
  ]) {
    assert.ok(byTestId(root, testId), `expected data-testid="${testId}"`);
  }
  assert.equal(byTestId(root, 'streak-reminder-time').value, '22:00');
  assert.equal(byTestId(root, 'notification-timezone').value, 'Asia/Seoul');
  assert.equal(byTestId(root, 'quiet-hours-start').value, '23:00');
  assert.equal(byTestId(root, 'quiet-hours-end').value, '07:00');
  assert.equal(byTestId(root, 'daily-push-limit').value, 3);
  const weekdayButtons = byTestId(root, 'reminder-weekdays').querySelectorAll('button');
  assert.equal(weekdayButtons.length, 7, 'one toggle per weekday Monday..Sunday');
  assert.ok(weekdayButtons.every(button => button.props['aria-pressed'] === true));
});

test('master switch disables subordinate controls without erasing draft values', async () => {
  const { root } = await mountSettingsPage(baseSettings());
  clickSwitch(root, 'notifications-enabled');
  await Vue.nextTick();
  for (const testId of [
    'streak-reminder-time', 'notification-timezone',
    'quiet-hours-start', 'quiet-hours-end', 'daily-push-limit',
  ]) {
    assert.equal(byTestId(root, testId).props.disabled, true, `${testId} must be disabled while master is off`);
  }
  assert.equal(switchControl(root, 'streak-reminders-enabled').props.disabled, true);
  assert.equal(switchControl(root, 'quiet-hours-enabled').props.disabled, true);
  assert.ok(byTestId(root, 'reminder-weekdays').querySelectorAll('button').every(b => b.props.disabled === true));
  assert.ok(byTestId(root, 'pause-mode').querySelectorAll('button').every(b => b.props.disabled === true));
  // Values stay intact behind the disabled controls.
  assert.equal(byTestId(root, 'streak-reminder-time').value, '22:00');
  assert.equal(byTestId(root, 'notification-timezone').value, 'Asia/Seoul');
  assert.equal(byTestId(root, 'daily-push-limit').value, 3);
});

test('weekday chips toggle individual days and allow an empty selection', async () => {
  const settings = baseSettings();
  const { root } = await mountSettingsPage(settings);
  const group = byTestId(root, 'reminder-weekdays');
  const chips = () => group.querySelectorAll('button');
  fire(chips()[0], 'Click'); // Monday off
  await Vue.nextTick();
  assert.equal(chips()[0].props['aria-pressed'], false);
  assert.equal(chips()[1].props['aria-pressed'], true);
  for (const chip of chips()) {
    if (chip.props['aria-pressed'] === true) fire(chip, 'Click');
  }
  await Vue.nextTick();
  assert.ok(chips().every(chip => chip.props['aria-pressed'] === false), 'empty weekday selection is allowed');
});

test('quiet hours expose start/end and explain the night reminder override', async () => {
  const { root } = await mountSettingsPage(baseSettings({ quiet_hours_start: '23:00:00' }));
  assert.ok(byTestId(root, 'quiet-hours-note'), 'quiet hours must explain that it also covers the streak reminder');
  assert.equal(byTestId(root, 'quiet-hours-same-time'), null, 'no warning while start and end differ');
  typeValue(byTestId(root, 'quiet-hours-end'), '23:00');
  await Vue.nextTick();
  assert.ok(byTestId(root, 'quiet-hours-same-time'), 'identical start/end must surface a warning');
});

test('pause choices write a nullable ISO paused_until', async () => {
  const settings = baseSettings({ paused_until: '2026-10-01T00:00:00.000Z' });
  const calls = [];
  const { root } = await mountSettingsPage(settings, {
    updateSettings: async payload => { calls.push(payload); return { success: true }; },
  });
  const submit = async () => {
    fire(root.querySelector('form'), 'Submit');
    await Vue.nextTick();
    await Promise.resolve();
  };
  const tabs = byTestId(root, 'pause-mode').querySelectorAll('[role="tab"]');
  assert.equal(tabs.length, 4, 'resume, tomorrow, one week, and a custom date choice');
  const custom = tabs.find(tab => tab.props['aria-selected'] === true);
  assert.ok(custom, 'an existing paused_until selects the custom choice');
  assert.ok(byTestId(root, 'pause-custom-time'), 'custom choice reveals a datetime input');

  fire(tabs[0], 'Click'); // resume
  await Vue.nextTick();
  await submit();
  assert.equal(calls.at(-1).paused_until, null, 'resume clears paused_until');

  fire(tabs[1], 'Click'); // tomorrow
  await Vue.nextTick();
  await submit();
  const tomorrow = Date.parse(calls.at(-1).paused_until);
  assert.ok(Number.isFinite(tomorrow), 'tomorrow writes an ISO datetime');
  assert.ok(tomorrow > Date.now() && tomorrow <= Date.now() + 25 * 60 * 60 * 1000);

  fire(tabs[2], 'Click'); // one week
  await Vue.nextTick();
  await submit();
  const week = Date.parse(calls.at(-1).paused_until);
  assert.ok(week > Date.now() + 6 * 24 * 60 * 60 * 1000 && week <= Date.now() + 8 * 24 * 60 * 60 * 1000);
});

test('daily push limit clamps to the 1..10 contract', async () => {
  const settings = baseSettings();
  const calls = [];
  const { root } = await mountSettingsPage(settings, {
    updateSettings: async payload => { calls.push(payload); return { success: true }; },
  });
  const input = byTestId(root, 'daily-push-limit');
  assert.equal(Number(input.props.min), 1);
  assert.equal(Number(input.props.max), 10);
  typeValue(input, '99');
  await Vue.nextTick();
  assert.equal(input.value, 10, 'values above 10 clamp to 10');
  typeValue(input, '0');
  await Vue.nextTick();
  assert.equal(input.value, 1, 'values below 1 clamp to 1');
  fire(root.querySelector('form'), 'Submit');
  await Vue.nextTick();
  await Promise.resolve();
  assert.equal(calls.at(-1).daily_push_limit, 1);
});

test('saving sends the draft and keeps the draft intact when the save fails', async () => {
  const settings = baseSettings();
  const calls = [];
  const { root } = await mountSettingsPage(settings, {
    updateSettings: async payload => { calls.push(payload); return { success: false, error: 'server rejected' }; },
  });
  typeValue(byTestId(root, 'notification-timezone'), 'America/New_York');
  await Vue.nextTick();
  fire(root.querySelector('form'), 'Submit');
  await Vue.nextTick();
  await Promise.resolve();
  assert.equal(calls.length, 1, 'submit must call updateSettings once');
  assert.equal(calls[0].timezone, 'America/New_York');
  assert.equal(calls[0].daily_push_limit, 3);
  // Failed save must not revert the draft the user sees.
  assert.equal(byTestId(root, 'notification-timezone').value, 'America/New_York');
});

test('weekday edits never mutate the persisted store array before save', async () => {
  const persisted = baseSettings({ reminder_weekdays: [1, 3] });
  const { root } = await mountSettingsPage(persisted);
  const chips = byTestId(root, 'reminder-weekdays').querySelectorAll('button');
  assert.equal(chips[0].props['aria-pressed'], false);
  assert.equal(chips[1].props['aria-pressed'], true);
  fire(chips[0], 'Click');
  await Vue.nextTick();
  assert.deepEqual(persisted.reminder_weekdays, [1, 3], 'store settings stay untouched until save');
  assert.equal(chips[0].props['aria-pressed'], true, 'draft reflects the toggle');
});

test('reopening the page restores persisted server settings', async () => {
  const persisted = baseSettings({
    streak_reminders_enabled: false,
    streak_reminder_time: '21:30',
    reminder_weekdays: [5, 6],
    quiet_hours_enabled: false,
    quiet_hours_start: '22:30',
    quiet_hours_end: '06:30',
    paused_until: '2026-09-25T15:00:00.000Z',
    daily_push_limit: 7,
    timezone: 'Europe/London',
  });
  const { root } = await mountSettingsPage(persisted);
  assert.equal(switchControl(root, 'streak-reminders-enabled').props['aria-checked'], false);
  assert.equal(byTestId(root, 'streak-reminder-time').value, '21:30');
  const chips = byTestId(root, 'reminder-weekdays').querySelectorAll('button');
  assert.deepEqual(chips.map(chip => chip.props['aria-pressed']), [false, false, false, false, false, true, true]);
  assert.equal(switchControl(root, 'quiet-hours-enabled').props['aria-checked'], false);
  assert.equal(byTestId(root, 'quiet-hours-start').value, '22:30');
  assert.equal(byTestId(root, 'quiet-hours-end').value, '06:30');
  assert.equal(byTestId(root, 'daily-push-limit').value, 7);
  assert.equal(byTestId(root, 'notification-timezone').value, 'Europe/London');
  const selected = byTestId(root, 'pause-mode').querySelectorAll('[role="tab"]').find(tab => tab.props['aria-selected'] === true);
  assert.ok(selected, 'persisted paused_until selects the custom pause choice');
});
