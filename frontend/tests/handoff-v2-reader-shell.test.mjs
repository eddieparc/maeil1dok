import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { build } from 'esbuild';
import { compileScript, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import * as Router from 'vue-router';
import * as Icons from '@lucide/vue';

// Owned SFC scripts/templates + real RouterLink. Viewer is an event/expose
// boundary, SDK is manually signalled. No CSS/native/YouTube proof is claimed.
const runtime = { Vue, Router, Icons, user: Vue.ref(null), viewers: [], navigations: [],
  readingSettings: { settings: { audioPlaybackRate: 1 }, updateSetting(k, v) { this.settings[k] = v; } } };
runtime.Transition = Vue.defineComponent({ props: ['name'], setup: (_, { slots }) => () => slots.default?.() });
runtime.Compare = Vue.defineComponent({ setup: (_, { slots }) => () => slots.primary?.() });
runtime.Selection = Vue.defineComponent({ props: ['state'], emits: ['highlight-color'], setup: (_, { emit }) => { runtime.selection = { emit }; return () => null; } });
runtime.Viewer = Vue.defineComponent({
  name: 'BibleViewer', props: ['content', 'book', 'chapter', 'version', 'isLoading', 'initialScrollPosition', 'highlights'],
  emits: ['scroll', 'scroll-pixels', 'swipe-left', 'swipe-right', 'selection-menu-change', 'share', 'highlight', 'highlight-save', 'copy-error'],
  setup(props, { emit, expose, slots }) {
    const calls = [];
    expose(Object.fromEntries(['restoreScrollPosition', 'scrollToVerse', 'focusVerseRange', 'handleHighlightOrRemove', 'handleHighlightColor', 'handleCopy', 'handleShare', 'clearAllSelections', 'handleClickCopy', 'clearClickSelection']
      .map(name => [name, (...args) => calls.push([name, ...args])])));
    runtime.viewers.push({ emit, props, calls });
    return () => Vue.h('main', { class: 'bible-viewer' }, slots.bottom?.());
  },
});
globalThis.__readerShellTest = runtime;
globalThis.useRoute = Router.useRoute;
globalThis.navigateTo = path => runtime.navigations.push(path);
const root = fileURLToPath(new URL('../', import.meta.url));
const exportsFor = (name, values) => Object.keys(values).filter(key => key !== 'default' && /^[\w$]+$/.test(key))
  .map(key => `export const ${key} = globalThis.__readerShellTest.${key === 'Transition' && name === 'Vue' ? 'Transition' : `${name}.${key}`};`).join('\n');
async function loadComponent(path) {
  const result = await build({
    stdin: { contents: `export { default } from '${path}';`, resolveDir: root },
    bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    plugins: [{ name: 'reader-shell-runtime', setup(builder) {
      builder.onResolve({ filter: /^(vue|vue-router|@lucide\/vue)$/ }, ({ path }) => ({ path, namespace: 'runtime' }));
      builder.onLoad({ filter: /.*/, namespace: 'runtime' }, ({ path }) => ({ contents: path === 'vue' ? exportsFor('Vue', Vue) : path === 'vue-router' ? exportsFor('Router', Router) : exportsFor('Icons', Icons) }));
      builder.onResolve({ filter: /^~\/components\/bible\/(BibleViewer|BibleCompareViewer|SelectionFloatingControls).vue$/ }, ({ path }) => ({ path, namespace: 'boundary' }));
      builder.onLoad({ filter: /.*/, namespace: 'boundary' }, ({ path }) => ({ contents: `export default globalThis.__readerShellTest.${path.includes('BibleCompareViewer') ? 'Compare' : path.includes('BibleViewer') ? 'Viewer' : 'Selection'};` }));
      builder.onResolve({ filter: /^~\/(composables\/useAuthService|stores\/(notifications|readingSettings))$/ }, ({ path }) => ({ path, namespace: 'service' }));
      builder.onLoad({ filter: /.*/, namespace: 'service' }, ({ path }) => ({ contents: path.includes('useAuthService')
        ? 'export const useAuthService = () => ({ user: globalThis.__readerShellTest.user });'
        : path.includes('readingSettings')
          ? 'export const useReadingSettingsStore = () => globalThis.__readerShellTest.readingSettings;'
          : 'export const useNotificationsStore = () => ({ unreadCount: 0 });' }));
      builder.onResolve({ filter: /^~\// }, ({ path }) => ({ path: `${root}/app/${path.slice(2)}${path.endsWith('.vue') ? '' : '.ts'}`, namespace: path.endsWith('.vue') ? 'sfc' : 'file' }));
      builder.onLoad({ filter: /\.vue$/, namespace: 'sfc' }, async ({ path }) => {
        const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path }); assert.deepEqual(errors, []);
        return { contents: compileScript(descriptor, { id: path, inlineTemplate: true }).content, loader: 'ts', resolveDir: root };
      });
    } }],
  });
  return (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`)).default;
}
const [Reader, Player, Tools] = await Promise.all(['BibleReaderView', 'TongdokAudioPlayer', 'BibleToolPopover'].map(name => loadComponent(`~/components/bible/${name}.vue`)));

class HostElement {
  constructor(type, text = '') { Object.assign(this, { type, text, props: {}, children: [], parent: null, contentWindow: type === 'iframe' ? {} : undefined }); }
  contains(target) { return target === this || this.children.some(child => child.contains(target)); }
  getBoundingClientRect() { return { left: 10, width: 200 }; }
  getAttribute(key) { return this.props[key] ?? null; }
}
globalThis.HTMLElement = HostElement;
const node = (type, text) => new HostElement(type, text);
const renderer = Vue.createRenderer({
  createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
  setText: (target, text) => { target.text = text; }, setElementText: (target, text) => { target.text = text; target.children = []; },
  parentNode: target => target.parent, nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] ?? null,
  patchProp: (target, key, _old, value) => { target.props[key] = value; },
  insert(target, parent, anchor = null) {
    if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1);
    target.parent = parent; const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, target);
  },
  remove(target) { target.parent.children.splice(target.parent.children.indexOf(target), 1); target.parent = null; },
});
const all = (target, predicate) => [...(predicate(target) ? [target] : []), ...target.children.flatMap(child => all(child, predicate))];
const byClass = (target, name) => all(target, child => String(child.props.class ?? '').split(/\s+/).includes(name));
const byTestId = (target, id) => all(target, child => child.props['data-testid'] === id)[0];
const text = target => target.text + target.children.filter(child => child.type !== '#comment').map(text).join('');
const tabs = host => byClass(host, 'bottom-nav')[0];
const click = (target, extra = {}) => {
  assert.ok(target, 'click target exists');
  const event = { button: 0, currentTarget: target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...extra };
  for (const fn of [target.props.onClick].flat()) fn?.(event);
  return event;
};
function environment({ delayedApi = false } = {}) {
  const listeners = new Map(); const documentListeners = new Map(); const instances = []; const timers = new Map();
  const add = (map, name, fn) => { if (!map.has(name)) map.set(name, new Set()); map.get(name).add(fn); };
  const remove = (map, name, fn) => map.get(name)?.delete(fn);
  let created; let timerId = 0;
  class SDKPlayer {
    constructor(iframe, options) { Object.assign(this, { iframe, events: options.events, commands: [], state: 2 }); instances.push(this); created?.(this); created = undefined; }
    playVideo() { this.commands.push(['play']); this.state = 1; }
    pauseVideo() { this.commands.push(['pause']); this.state = 2; }
    seekTo(...args) { this.commands.push(['seek', ...args]); }
    setPlaybackRate(rate) { this.commands.push(['rate', rate]); }
    getCurrentTime() { return 30; }
    getDuration() { return 120; }
    getPlayerState() { return this.state; }
    destroy() { this.commands.push(['destroy']); this.destroyed = true; }
  }
  const sdk = { Player: SDKPlayer };
  globalThis.window = { location: { origin: 'https://reader.test' }, YT: delayedApi ? undefined : sdk,
    addEventListener: (name, fn) => add(listeners, name, fn), removeEventListener: (name, fn) => remove(listeners, name, fn),
    setInterval: fn => { timers.set(++timerId, fn); return timerId; }, clearInterval: id => timers.delete(id) };
  globalThis.document = { addEventListener: (name, fn) => add(documentListeners, name, fn), removeEventListener: (name, fn) => remove(documentListeners, name, fn),
    querySelector: () => null, createElement: type => node(type), head: { appendChild() {} } };
  return { instances, timers, listeners, nextPlayer: () => new Promise(resolve => { created = resolve; }),
    apiReady: () => { window.YT = sdk; window.onYouTubeIframeAPIReady?.(); },
    message: event => { for (const listener of listeners.get('message') ?? []) listener(event); },
    documentEvent: (name, event) => { for (const listener of documentListeners.get(name) ?? []) listener(event); } };
}
const defaults = { content: '', isLoading: false, currentBookName: '창세기', currentChapter: 50, currentVersionName: '개역개정', chapterSuffix: '장',
  hasPrevChapter: true, hasNextChapter: true, isTongdokMode: false, isCurrentChapterRead: false,
  bookProgress: { read: 7, total: 50, percentage: 14 }, isAuthenticated: true, isBookmarked: false, noteCount: 2 };
async function mount(component, initialProps = {}, env = environment()) {
  runtime.navigations.length = 0; runtime.viewers.length = 0;
  const router = Router.createRouter({ history: Router.createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] });
  await router.push('/bible'); await router.isReady();
  const props = Vue.reactive(initialProps); const host = node('root'); const reference = Vue.ref();
  const app = renderer.createApp({ render: () => Vue.h(component, { ...props, ref: reference }) });
  app.use(router); app.component('NuxtLink', Router.RouterLink);
  app.component('ClientOnly', Vue.defineComponent({ setup: (_, { slots }) => () => slots.default?.() }));
  app.mount(host); await Vue.nextTick();
  return { host, props, router, env, reference, viewer: runtime.viewers.at(-1), close: () => app.unmount() };
}

test('H02 header retains cross-book/body/exposed events', async t => {
  const events = []; const view = await mount(Reader, { ...defaults, onPrevChapter: () => events.push('prev'), onNextChapter: () => events.push('next'), onOpenBookSelector: () => events.push('book'), onMarkAsRead: () => events.push('read') }); t.after(view.close);
  const header = byClass(view.host, 'bible-header')[0];
  const controls = byClass(view.host, 'reader-controls-row')[0];
  const previous = all(controls, n => n.props['aria-label'] === '이전 장')[0]; const next = all(controls, n => n.props['aria-label'] === '다음 장')[0];
  assert.ok(previous && next, 'bottom controls contain previous and next chapter controls');
  assert.equal(all(header, n => n.props['aria-label'] === '이전 장' || n.props['aria-label'] === '다음 장').length, 0, 'header no longer carries chapter nav buttons');
  click(previous); click(byClass(header, 'book-selector-trigger')[0]); click(next);
  view.viewer.emit('swipe-left'); view.viewer.emit('swipe-right'); click(byClass(view.host, 'flat-action-btn').find(n => String(n.props.class).includes('complete')));
  assert.deepEqual(events, ['prev', 'book', 'next', 'next', 'prev', 'read']); assert.equal(byClass(header, 'bookmark-toggle-button').length, 0);
  view.reference.value.focusVerseRange(3, 5, 'term'); assert.deepEqual(view.viewer.calls.at(-1), ['focusVerseRange', 3, 5, 'term']);
  view.props.hasNextChapter = false; await Vue.nextTick(); assert.equal(next.props.disabled, true); view.viewer.emit('swipe-left'); assert.equal(events.length, 6);
  assert.equal(byClass(view.host, 'progress-info-inline').length, 1);
  view.props.isTongdokMode = true; await Vue.nextTick(); assert.equal(byClass(view.host, 'progress-info-inline').length, 0); assert.equal(byClass(view.host, 'flat-action-btn').length, 2);
});

test('header conditions, bookmark-in-tools, settings and guide integrator events', async t => {
  const events = []; const view = await mount(Reader, { ...defaults, onBookmarkToggle: () => events.push('bookmark'), onOpenSettings: () => events.push('settings'), onGuideClick: url => events.push(url) }); t.after(view.close);
  const header = byClass(view.host, 'bible-header')[0];
  assert.equal(all(header, n => n.type === 'a' && n.props.href === '/bible/search').length, 1); assert.equal(byClass(header, 'tongdok-mode-btn').length, 1);
  click(byClass(header, 'tool-trigger-button')[0]); await Vue.nextTick();
  const bookmark = byTestId(header, 'reader-bookmark-toggle'); assert.ok(bookmark, 'bookmark available inside tools');
  click(bookmark); await Vue.nextTick(); assert.deepEqual(events, ['bookmark']);
  click(byClass(header, 'tool-trigger-button')[0]); await Vue.nextTick(); click(byTestId(header, 'reader-settings')); await Vue.nextTick();
  assert.deepEqual(events, ['bookmark', 'settings']); assert.deepEqual(runtime.navigations, []);
  view.props.isAuthenticated = false; await Vue.nextTick(); assert.equal(byClass(header, 'tongdok-mode-btn').length, 0);
  Object.assign(view.props, { isTongdokMode: true, tongdokGuideLink: 'https://guide.test', tongdokAudioLink: 'https://audio.test', isTongdokAudioPlayerOpen: true }); await Vue.nextTick();
  click(byTestId(header, 'reader-guide')); assert.equal(events.at(-1), 'https://guide.test'); assert.equal(byTestId(header, 'reader-audio').props['aria-pressed'], true);
  view.props.isTongdokMode = false; await Vue.nextTick(); assert.equal(byTestId(header, 'reader-guide'), undefined);
});

test('header shows date + schedule summary and current chapter, counting remaining chapters', async t => {
  const schedule = [
    { book: 'jdg', bookKor: '사사기', startChapter: 7, endChapter: 8 },
    { book: 'rut', bookKor: '룻기', startChapter: 1, endChapter: 2 },
    { book: 'psa', bookKor: '시편', startChapter: 1, endChapter: 1 },
  ];
  const view = await mount(Reader, { ...defaults, isTongdokMode: true, tongdokScheduleDate: '2026-09-18', tongdokSchedule: schedule,
    currentBookName: '사사기', currentChapter: 7 }); t.after(view.close);
  const header = byClass(view.host, 'bible-header')[0];
  const context = byClass(header, 'header-context').map(text);
  assert.equal(context[0], '9/18(금) · 사사기 7-8장 외 3장', 'first line is date plus first-book range and remaining chapter count');
  assert.equal(context[1], '9/18(금) · 삿 7-8장 외 3장', 'short variant keeps the summary with abbreviated book');
  const range = byClass(header, 'header-range').map(text);
  assert.deepEqual(range, ['사사기 7장'], 'second line is the full current book and chapter only');
  assert.ok(!text(header).includes('지금'), 'no current-position marker remains');

  view.props.tongdokSchedule = [{ book: 'jdg', bookKor: '사사기', startChapter: 7, endChapter: 8 }]; await Vue.nextTick();
  assert.equal(text(byClass(header, 'header-context')[0]), '9/18(금) · 사사기 7-8장', 'single-book schedule drops the remainder suffix');

  view.props.tongdokSchedule = [
    { book: 'jdg', bookKor: '사사기', startChapter: 7, endChapter: 8 },
    { book: 'jdg', bookKor: '사사기', startChapter: 9, endChapter: 10 },
  ]; await Vue.nextTick();
  assert.equal(text(byClass(header, 'header-context')[0]), '9/18(금) · 사사기 7-10장', 'same-book rows merge into the first-book range');

  // 현재 책이 시편이어도 첫 책 단위는 사사기의 '장'을 따른다.
  Object.assign(view.props, { currentBookName: '시편', currentChapter: 1, chapterSuffix: '편',
    tongdokSchedule: [
      { book: 'jdg', bookKor: '사사기', startChapter: 7, endChapter: 8 },
      { book: 'psa', bookKor: '시편', startChapter: 1, endChapter: 2 },
    ] }); await Vue.nextTick();
  assert.equal(text(byClass(header, 'header-context')[0]), '9/18(금) · 사사기 7-8장 외 2장', 'first-book unit and remainder stay 장');
  assert.equal(text(byClass(header, 'header-range')[0]), '시편 1편', 'second line keeps the current book unit');

  // 첫 책이 시편이면 범위 단위는 '편'이고 외 N장은 그대로 '장'이다.
  Object.assign(view.props, { currentBookName: '사사기', currentChapter: 7, chapterSuffix: '장',
    tongdokSchedule: [
      { book: 'psa', bookKor: '시편', startChapter: 1, endChapter: 2 },
      { book: 'jdg', bookKor: '사사기', startChapter: 7, endChapter: 8 },
    ] }); await Vue.nextTick();
  assert.equal(text(byClass(header, 'header-context')[0]), '9/18(금) · 시편 1-2편 외 2장');

  view.props.isTongdokMode = false; await Vue.nextTick();
  assert.equal(text(byClass(header, 'header-context')[0]), '개역개정', 'non-tongdok header keeps the version context');
  assert.equal(text(byClass(header, 'header-range')[0]), '사사기 7장');
});

test('shell bridges direct palette save, version and copy errors without rebuilding selection', async t => {
  const saved = []; const errors = [];
  const view = await mount(Reader, { ...defaults, onHighlightSave: payload => saved.push(payload), onCopyError: error => errors.push(error) }); t.after(view.close);
  assert.equal(view.viewer.props.version, defaults.currentVersionName);
  runtime.selection.emit('highlight-color', '#BBDDFB');
  assert.deepEqual(view.viewer.calls.at(-1), ['handleHighlightColor', '#BBDDFB']);
  const payload = { book: defaults.currentBookName, chapter: 50, version: defaults.currentVersionName, start: 3, end: 3, text: 'verse', verses: [{ number: 3, text: 'verse' }], color: '#BBDDFB', highlightId: 5 };
  view.viewer.emit('highlight-save', payload); assert.equal(saved[0], payload);
  const error = new Error('clipboard denied'); view.viewer.emit('copy-error', error); assert.equal(errors[0], error);
});

test('tools publishes open state and closes on outside click and Escape', async t => {
  const changes = []; const view = await mount(Tools, { noteCount: 1, onOpenChange: open => changes.push(open) }); t.after(view.close);
  click(byClass(view.host, 'tool-trigger-button')[0]); await Vue.nextTick(); assert.deepEqual(changes, [true]);
  view.env.documentEvent('keydown', { key: 'Escape' }); await Vue.nextTick(); assert.deepEqual(changes, [true, false]);
  click(byClass(view.host, 'tool-trigger-button')[0]); await Vue.nextTick(); view.env.documentEvent('click', { target: node('outside') }); await Vue.nextTick(); assert.deepEqual(changes, [true, false, true, false]);
});

test('one shared five-tab stack has no chapter row; plan interception is tongdok-only', { timeout: 3000 }, async t => {
  let plans = 0; const view = await mount(Reader, { ...defaults, isTongdokMode: true, onReadingPlanClick: () => plans++ }); t.after(view.close);
  assert.equal(byClass(view.host, 'bottom-nav-container').length, 1); assert.equal(byClass(view.host, 'sidebar-nav').length, 1);
  assert.equal(byClass(view.host, 'reader-controls-row').length, 1, 'merged reader controls row');
  assert.deepEqual(all(tabs(view.host), n => n.type === 'a').map(n => n.props.href), ['/', '/bible', '/plan', '/groups', '/login']);
  const plan = all(tabs(view.host), n => n.props.href === '/plan')[0]; assert.equal(click(plan).defaultPrevented, true); assert.equal(plans, 1); assert.equal(view.router.currentRoute.value.path, '/bible');
  view.props.isTongdokMode = false; await Vue.nextTick();
  const navigated = new Promise(resolve => { const off = view.router.afterEach(to => { off(); resolve(to.path); }); }); click(plan); assert.equal(await navigated, '/plan'); assert.equal(plans, 1);
});

test('pixel scroll hides tabs after 60px; up and overlays show while controls remain', async t => {
  const ratios = []; const view = await mount(Reader, { ...defaults, isTongdokMode: true, tongdokProgress: { current: 2, total: 3, done: 1, completed: [false, false, true] }, tongdokAudioLink: 'https://audio.test', isTongdokAudioPlayerOpen: true, onScroll: value => ratios.push(value) }); t.after(view.close);
  const hidden = () => byClass(view.host, 'bottom-nav-tabs')[0].props.inert;
  const progress = byClass(view.host, 'reader-controls-progress')[0]; const audio = byClass(view.host, 'tongdok-audio-player')[0];
  view.viewer.emit('scroll', 0.9); await Vue.nextTick(); assert.deepEqual(ratios, [0.9]); assert.equal(hidden(), false);
  for (const value of [25, 59]) { view.viewer.emit('scroll-pixels', value); await Vue.nextTick(); assert.equal(hidden(), false); }
  view.viewer.emit('scroll-pixels', 60); await Vue.nextTick(); assert.equal(hidden(), true, 'actual 60px reading scroll hides tabs');
  assert.equal(byClass(view.host, 'reader-controls-progress')[0], progress); assert.equal(byClass(view.host, 'tongdok-audio-player')[0], audio); assert.equal(all(tabs(view.host), n => n.type === 'a' && n.props.tabindex === -1).length, 5);
  view.viewer.emit('scroll-pixels', 59); await Vue.nextTick(); assert.equal(hidden(), false);
  view.viewer.emit('scroll-pixels', 119); await Vue.nextTick(); assert.equal(hidden(), true);
  view.props.overlayOpen = true; await Vue.nextTick(); assert.equal(hidden(), false);
  view.viewer.emit('scroll-pixels', 300); await Vue.nextTick(); assert.equal(hidden(), false);
  view.props.overlayOpen = false; await Vue.nextTick(); view.viewer.emit('scroll-pixels', 359); await Vue.nextTick(); assert.equal(hidden(), false);
  view.viewer.emit('scroll-pixels', 360); await Vue.nextTick(); assert.equal(hidden(), true);
  click(byClass(view.host, 'tool-trigger-button')[0]); await Vue.nextTick(); assert.equal(hidden(), false);
  view.viewer.emit('scroll-pixels', 500); await Vue.nextTick(); assert.equal(hidden(), false);
  view.props.currentChapter = 1; await Vue.nextTick(); assert.equal(hidden(), false);
});

test('progress renders actual noncontiguous completion flags/count, not earlier ordinals', async t => {
  const view = await mount(Reader, { ...defaults, isTongdokMode: true, tongdokProgress: { current: 2, total: 3, done: 1, completed: [false, false, true] } }); t.after(view.close);
  assert.equal(text(byClass(view.host, 'progress-text-indicator')[0]).trim(), '1/3');
  assert.deepEqual(byClass(view.host, 'progress-segment').map(n => String(n.props.class).includes('filled')), [false, false, true]);
  assert.deepEqual(byClass(view.host, 'progress-segment').map(n => String(n.props.class).includes('current')), [false, true, false]);
  view.props.tongdokProgress = { current: 2, total: 3, done: 3, completed: [true, true, true] }; await Vue.nextTick(); assert.equal(byClass(view.host, 'tongdok-complete-status')[0].props['aria-pressed'], true);
  view.props.tongdokProgress = { current: 3, total: 3 }; await Vue.nextTick(); assert.equal(byClass(view.host, 'progress-segment').filter(n => String(n.props.class).includes('filled')).length, 0);
});

test('audio binds ended source and rejects stale/disposed SDK and foreign-frame messages', { timeout: 3000 }, async t => {
  const env = environment(); const ended = []; const created = env.nextPlayer();
  const view = await mount(Player, { audioLink: 'https://youtu.be/chapter', audioContextKey: 'plan1:schedule1:gen:1', isOpen: true, onEnded: source => ended.push(source) }, env); t.after(view.close);
  const first = await created; first.events.onReady(); env.message({ origin: 'https://www.youtube.com', source: {}, data: { event: 'onStateChange', info: 0 } }); assert.equal(ended.length, 0, 'another iframe cannot complete this audio');
  const nextCreated = env.nextPlayer(); view.props.audioContextKey = 'plan2:schedule2:gen:1'; await Vue.nextTick(); const second = await nextCreated; assert.equal(first.destroyed, true);
  first.events.onReady(); first.events.onStateChange({ data: 0 }); assert.equal(ended.length, 0);
  second.events.onReady(); second.events.onStateChange({ data: 0 }); assert.deepEqual(ended, [{ audioLink: 'https://youtu.be/chapter', audioContextKey: 'plan2:schedule2:gen:1' }]);
  env.message({ origin: 'https://www.youtube.com', source: second.iframe.contentWindow, data: JSON.stringify({ event: 'onStateChange', info: 0 }) }); assert.equal(ended.length, 1);
  view.close(); first.events.onStateChange({ data: 0 }); second.events.onReady(); second.events.onStateChange({ data: 0 }); assert.equal(env.timers.size, 0); assert.equal(ended.length, 1);
});

test('current iframe message carries source, while unended disposed callbacks remain inert', { timeout: 3000 }, async t => {
  const env = environment(); const ended = []; const created = env.nextPlayer();
  const view = await mount(Player, { audioLink: 'https://youtu.be/message', audioContextKey: 'a', isOpen: true, onEnded: source => ended.push(source) }, env); t.after(view.close);
  const first = await created;
  env.message({ origin: 'https://other.test', source: first.iframe.contentWindow, data: { event: 'onStateChange', info: 0 } }); assert.deepEqual(ended, []);
  env.message({ origin: 'https://www.youtube.com', source: first.iframe.contentWindow, data: JSON.stringify({ event: 'onStateChange', info: 0 }) });
  assert.deepEqual(ended, [{ audioLink: 'https://youtu.be/message', audioContextKey: 'a' }]);
  const replacement = env.nextPlayer(); view.props.audioLink = 'https://youtu.be/not-ended'; await Vue.nextTick(); const second = await replacement;
  view.close(); second.events.onReady(); second.events.onStateChange({ data: 0 });
  assert.equal(ended.length, 1); assert.equal(env.timers.size, 0); assert.equal(env.listeners.get('message').size, 0);
});

test('pending SDK initialization cannot recreate closed or superseded audio', { timeout: 3000 }, async t => {
  const env = environment({ delayedApi: true }); const view = await mount(Player, { audioLink: 'https://youtu.be/first', audioContextKey: 'a', isOpen: true }, env); t.after(view.close);
  view.props.audioContextKey = 'b'; await Vue.nextTick(); const ready = env.nextPlayer(); env.apiReady(); const active = await ready; await Vue.nextTick();
  assert.equal(env.instances.length, 1, 'only latest pending binding creates a player');
  view.props.isOpen = false; await Vue.nextTick(); active.events.onReady(); active.events.onStateChange({ data: 1 }); assert.equal(env.timers.size, 0); assert.equal(active.destroyed, true);
});

test('shell remounts identical audio for new plan/schedule and forwards its bound source', { timeout: 3000 }, async t => {
  const env = environment(); const ended = []; const created = env.nextPlayer();
  const view = await mount(Reader, { ...defaults, tongdokAudioLink: 'https://youtu.be/same', isTongdokAudioPlayerOpen: true, audioContextKey: 'plan1:1:gen:1', onAudioEnded: source => ended.push(source) }, env); t.after(view.close);
  const first = await created; const replacement = env.nextPlayer(); view.props.audioContextKey = 'plan2:7:gen:1'; await Vue.nextTick(); const second = await replacement;
  first.events.onStateChange({ data: 0 }); assert.deepEqual(ended, []); second.events.onStateChange({ data: 0 }); assert.deepEqual(ended, [{ audioLink: 'https://youtu.be/same', audioContextKey: 'plan2:7:gen:1' }]);
});

test('player surface drives pause/play, seek, five rates, close and external fallback', { timeout: 3000 }, async t => {
  const env = environment(); const created = env.nextPlayer(); const opened = []; const overlays = [];
  const view = await mount(Player, { audioLink: 'https://youtu.be/controls', audioContextKey: 'controls', isOpen: true, 'onUpdate:is-open': value => opened.push(value), onOverlayOpenChange: value => overlays.push(value) }, env); t.after(view.close);
  const sdk = await created; sdk.events.onReady(); await Vue.nextTick(); click(byClass(view.host, 'player-control')[0]); click(byClass(view.host, 'player-control')[0]); click(byClass(view.host, 'youtube-progress-track')[0], { clientX: 110 });
  assert.ok(sdk.commands.some(c => c[0] === 'play')); assert.ok(sdk.commands.some(c => c[0] === 'pause')); assert.ok(sdk.commands.some(c => c[0] === 'seek' && c[1] === 60 && c[2] === true));
  for (const [index, rate] of [0.75, 1, 1.25, 1.5, 1.75, 2].entries()) {
    click(byClass(view.host, 'player-speed-trigger')[0]); await Vue.nextTick(); const options = all(view.host, n => n.props.role === 'menuitemradio'); assert.equal(options.length, 6); click(options[index]); await Vue.nextTick(); assert.deepEqual(sdk.commands.at(-1), ['rate', rate]);
  }
  assert.deepEqual(overlays, [true, false, true, false, true, false, true, false, true, false, true, false]);
  click(byClass(view.host, 'player-close')[0]); assert.deepEqual(opened, [false]); assert.equal(sdk.destroyed, true);
  const external = []; Object.assign(view.props, { audioLink: 'https://audio.test/file.mp3', onOpenExternal: url => external.push(url) }); await Vue.nextTick(); click(byClass(view.host, 'player-text-action')[0]); assert.deepEqual(external, ['https://audio.test/file.mp3']);
});
