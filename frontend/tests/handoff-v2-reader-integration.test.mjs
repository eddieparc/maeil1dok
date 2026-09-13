import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { build } from 'esbuild';
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import * as Router from 'vue-router';
import * as Icons from '@lucide/vue';

// Real page setup/template, router, shell, mode, position, highlight and personal
// services. DOM selection/export and transport are producer-owned boundaries.
const root = fileURLToPath(new URL('../', import.meta.url));
const r = { Vue, Router, Icons, jobs: [], mounts: [], boundaries: {} };
globalThis.__readerIntegration = r;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const bridgeVue = { ...Vue,
  onMounted: callback => Vue.onMounted(() => { const job = callback(); if (job?.then) r.mounts.push(job); }),
  watch: (source, callback, options) => Vue.watch(source, (...args) => { const job = callback(...args); if (job?.then) r.jobs.push(job); }, options),
  Transition: Vue.defineComponent({ props: ['name'], setup: (_, { slots }) => () => slots.default?.() }),
};
r.Vue = bridgeVue;
const boundary = name => Vue.defineComponent({ name, inheritAttrs: false,
  setup(_, { attrs, emit, expose, slots }) {
    const calls = [];
    expose(Object.fromEntries(['clearSelection', 'clearAllSelections', 'scrollToTop', 'restoreScrollPosition', 'scrollToVerse', 'focusVerseRange', 'handleHighlightColor'].map(method => [method, (...args) => {
      calls.push([method, ...args]); if (method.startsWith('clear')) r.selectionClears.push(JSON.parse(JSON.stringify(r.shareSnapshot?.() ?? null)));
    }])));
    r.boundaries[name] = { attrs, emit, calls };
    return () => Vue.h('boundary', { 'data-boundary': name }, slots.bottom?.());
  },
});
const boundaryNames = ['BibleViewer', 'SelectionFloatingControls', 'BibleHome', 'BibleTOC', 'BookSelector', 'VersionSelector', 'TongdokCompleteModal', 'TongdokAlreadyCompleteModal', 'TongdokNextScheduleModal', 'TongdokCertificationModal', 'NoteQuickModal', 'HighlightModal', 'ReadingSettingsModal', 'ReadingSettingsSheet', 'PlanSelectorModal', 'BibleScheduleContent', 'BaseModal', 'ShareSheet', 'ReaderGuideSheet', 'ReaderPlanSheet', 'Toast'];
for (const name of boundaryNames) r[name] = boundary(name);
const serviceModules = {
  useAuthService: 'export const useAuthService = () => globalThis.__readerIntegration.auth;',
  useAuthGuard: `export const useAuthGuard = () => ({
    requireAuth: () => globalThis.__readerIntegration.auth.isAuthenticated.value,
    requireAuthWithPrompt: (...args) => globalThis.__readerIntegration.requireAuthWithPrompt(...args),
  });`,
  useApi: 'export const useApi = () => globalThis.__readerIntegration.api;',
  useToast: 'export const useToast = () => globalThis.__readerIntegration.toast;',
  useNavigation: 'export const useNavigation = () => ({ goBack: () => globalThis.__readerIntegration.router.back() });',
  useErrorHandler: 'export const useErrorHandler = () => globalThis.__readerIntegration.errors;',
  useNote: 'export const useNote = () => globalThis.__readerIntegration.notes;',
  useBookmark: 'export const useBookmark = () => globalThis.__readerIntegration.bookmarks;',
  useBibleContent: `export const useBibleContent = () => {
    if (globalThis.__readerIntegration.enforceNuxtContext && !globalThis.__readerIntegration.inNuxtContext && !globalThis.__readerIntegration.Vue.getCurrentInstance()) throw new Error('Nuxt instance unavailable in useRuntimeConfig');
    const content = globalThis.__readerIntegration.Vue.ref(''); const isLoading = globalThis.__readerIntegration.Vue.ref(false);
    return { content, isLoading, loadContent: async (...args) => { isLoading.value = true; content.value = await globalThis.__readerIntegration.content(...args); isLoading.value = false; } };
  };`,
  readingSettings: 'export const useReadingSettingsStore = () => globalThis.__readerIntegration.settings;',
  selectedPlan: 'export const useSelectedPlanStore = () => globalThis.__readerIntegration.selectedPlan;',
  subscription: 'export const useSubscriptionStore = () => globalThis.__readerIntegration.subscriptions;',
  notifications: 'export const useNotificationsStore = () => ({ unreadCount: 0 });',
};
let importSequence = 0;
async function compilePage() {
  const result = await build({ stdin: { contents: "export {default} from '~/pages/bible/index.vue';", resolveDir: root }, bundle: true, format: 'esm', platform: 'node', write: false, logLevel: 'silent',
    plugins: [{ name: 'reader-integration', setup(b) {
      b.onResolve({ filter: /^#components$/ }, () => ({ path: '#components', namespace: 'nuxt' }));
      b.onLoad({ filter: /.*/, namespace: 'nuxt' }, () => ({ contents: 'export const NuxtLink = globalThis.__readerIntegration.Router.RouterLink;' }));
      b.onResolve({ filter: /^(vue|vue-router|@lucide\/vue)$/ }, ({ path }) => ({ path, namespace: 'runtime' }));
      b.onLoad({ filter: /.*/, namespace: 'runtime' }, ({ path }) => {
        const name = path === 'vue' ? 'Vue' : path === 'vue-router' ? 'Router' : 'Icons';
        return { contents: Object.keys(r[name]).filter(k => k !== 'default' && /^[\w$]+$/.test(k)).map(k => `export const ${k} = globalThis.__readerIntegration.${name}.${k};`).join('\n') };
      });
      b.onResolve({ filter: /.*/ }, ({ path }) => {
        const name = path.split('/').at(-1).replace(/\.ts$/, '');
        if (serviceModules[name]) return { path: name, namespace: 'service' };
        if (path.endsWith('.vue') && boundaryNames.includes(name.replace('.vue', ''))) return { path: name.replace('.vue', ''), namespace: 'boundary' };
      });
      b.onLoad({ filter: /.*/, namespace: 'service' }, ({ path }) => ({ contents: serviceModules[path] }));
      b.onLoad({ filter: /.*/, namespace: 'boundary' }, ({ path }) => ({ contents: `export default globalThis.__readerIntegration.${path};` }));
      b.onResolve({ filter: /^~\// }, ({ path }) => ({ path: `${root}/app/${path.slice(2)}${path.endsWith('.vue') ? '' : '.ts'}`, namespace: path.endsWith('.vue') ? 'sfc' : 'file' }));
      b.onLoad({ filter: /\.vue$/, namespace: 'sfc' }, async ({ path }) => {
        const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path }); assert.deepEqual(errors, []);
        if (!path.endsWith('/pages/bible/index.vue')) return { contents: compileScript(descriptor, { id: path, inlineTemplate: true }).content, loader: 'ts', resolveDir: root };
        const script = compileScript(descriptor, { id: path });
        const template = compileTemplate({ id: path, filename: path, source: descriptor.template.content, compilerOptions: { bindingMetadata: script.bindings } }); assert.deepEqual(template.errors, []);
        return { contents: `${script.content.replace('export default', 'const Page =')}\n${template.code}\nPage.render = render; const setup = Page.setup; Page.setup = (props, context) => { const state = setup(props, context); globalThis.__readerIntegration.state = state; return state; }; export default Page;`, loader: 'ts', resolveDir: root };
      });
    } }],
  });
  return (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}#${++importSequence}`)).default;
}
class Element {
  constructor(type, text = '') { Object.assign(this, { type, text, props: {}, children: [], parent: null }); }
  contains(target) { return this === target || this.children.some(child => child.contains(target)); }
  getAttribute(key) { return this.props[key]; }
}
const node = (type, text) => new Element(type, text);
const renderer = Vue.createRenderer({
  createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
  setText: (el, text) => { el.text = text; }, setElementText: (el, text) => { el.text = text; el.children = []; },
  parentNode: el => el.parent, nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1] ?? null,
  patchProp: (el, key, _, value) => { el.props[key] = value; },
  insert(el, parent, anchor) { if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1); el.parent = parent; const i = parent.children.indexOf(anchor); parent.children.splice(i < 0 ? parent.children.length : i, 0, el); },
  remove(el) { el.parent.children.splice(el.parent.children.indexOf(el), 1); el.parent = null; },
});
const all = (el, predicate) => [...(predicate(el) ? [el] : []), ...el.children.flatMap(child => all(child, predicate))];
const byClass = (el, name) => all(el, n => String(n.props.class ?? '').split(/\s+/).includes(name));
const click = el => { assert.ok(el); el.props.onClick({ button: 0, preventDefault() {}, stopPropagation() {} }); };
async function settled() { await Vue.nextTick(); await Promise.all(r.jobs.splice(0)); await Vue.nextTick(); }
const emit = async (name, event, ...args) => { r.boundaries[name].emit(event, ...args); await settled(); };
const signal = (source, predicate = Boolean) => new Promise(resolve => {
  const stop = Vue.watch(source, value => { if (predicate(value)) { stop(); resolve(value); } }, { flush: 'sync' });
});

async function mount(url = '/bible', options = {}) {
  r.jobs = []; r.mounts = []; r.boundaries = {}; r.selectionClears = []; r.shareSnapshot = undefined;
  r.enforceNuxtContext = options.enforceNuxtContext; r.inNuxtContext = false;
  globalThis.useNuxtApp = () => ({ runWithContext(callback) { r.inNuxtContext = true; try { const result = callback(); return options.promiseContext ? Promise.resolve(result) : result; } finally { r.inNuxtContext = false; } } });
  const values = new Map(Object.entries(options.storage ?? {}));
  globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  globalThis.window = { location: { origin: 'https://reader.test' }, history: { length: 2 }, innerHeight: 800, scrollY: 0, scrollTo() {}, addEventListener() {}, removeEventListener() {}, open: url => r.external.push(url) };
  globalThis.document = { documentElement: { scrollHeight: 800 }, addEventListener() {}, removeEventListener() {}, querySelector: () => null };
  globalThis.HTMLElement = Element;
  // A deterministic formatted-content DOM boundary, not native HTML parsing proof.
  globalThis.DOMParser = class { parseFromString(html) { return { querySelectorAll: () => [...html.matchAll(/data-fixture-verse="(\d+)"[^>]*>([^<]*)</g)].map(([, number, text]) => ({ querySelector: () => ({ textContent: number }), querySelectorAll: () => [{ textContent: text }] })) }; } };
  globalThis.definePageMeta = () => {}; globalThis.useHead = () => {}; globalThis.useRoute = Router.useRoute;
  const nuxtStates = new Map(); globalThis.useState = (key, initial) => { if (!nuxtStates.has(key)) nuxtStates.set(key, Vue.ref(initial())); return nuxtStates.get(key); };
  r.requests = []; r.writes = []; r.messages = []; r.external = []; r.contentCalls = [];
  const authenticated = options.authenticated ?? true;
  r.auth = { isAuthenticated: Vue.ref(authenticated), isInitialized: Vue.ref(true), isLoading: Vue.ref(false), user: Vue.ref(authenticated ? { id: 2, nickname: 'reader' } : null), initialize: options.initialize ?? (async () => {}) };
  r.authPrompts = [];
  r.requireAuthWithPrompt = async (message) => {
    if (r.auth.isAuthenticated.value) return true;
    r.authPrompts.push(message);
    return false;
  };
  r.settings = Vue.reactive({ settings: { tongdokAutoComplete: false, fontFamily: 'noto-serif', fontSize: 19, lineHeight: 1.8 }, updateSetting(k, v) { this.settings[k] = v; } });
  r.selectedPlan = Vue.reactive({ effectivePlanId: options.planId ?? null, selectedPlanId: options.planId ?? null, setSelectedPlanId(id) { this.effectivePlanId = id; this.selectedPlanId = id; } });
  r.subscriptions = Vue.reactive({ activeSubscriptions: [{ plan_id: 7, plan_name: 'actual plan', is_default: true }], fetchSubscriptions: async () => {} });
  r.toast = Object.fromEntries(['success', 'error', 'info'].map(kind => [kind, message => r.messages.push({ kind, message })]));
  r.errors = { handleApiError: (error, context) => r.messages.push({ kind: 'error', error, context }), handleUserActionError: (error, context, fallback) => fallback?.() };
  globalThis.useErrorHandler = () => r.errors;
  r.notes = { currentChapterNotes: Vue.ref([]), showNoteModal: Vue.ref(false), fetchChapterNotes: async () => {}, saveQuickNote: async () => true, getChapterNoteCount: () => 0 };
  r.bookmarks = { loadBookmarks: async () => {}, isChapterBookmarked: () => false, toggleChapterBookmark: async () => ({ success: true, added: true }) };
  r.rows = options.rows ?? [{ book: 'gen', start_chapter: 49, end_chapter: 50, is_complete: false, schedule_id: 1, date: '2026-09-06' }];
  r.highlights = options.highlights ?? [];
  r.content = options.content ?? (async (book, chapter, version) => { r.contentCalls.push([book, chapter, version]); return `<div class="verse" data-fixture-verse="3">${book} ${chapter} actual verse</div>`; });
  r.api = {
    path: (path, params) => path.replace('{id}', params.id),
    GET: async (path, args = {}) => {
      r.requests.push([path, args.params]);
      if (options.GET) { const response = await options.GET(path, args); if (response !== undefined) return response; }
      const p = args.params ?? {};
      if (path.endsWith('/detail/')) return { data: { plan_id: p.plan_id, plan_name: 'actual plan', book: p.book, chapter: p.chapter, plan_date: '2026-09-06', plan_detail: p.plan_id ? structuredClone(r.rows) : [], audio_link: 'https://audio.test/chapter', guide_link: 'https://guide.test' } };
      if (path.endsWith('/reading-position/')) return { data: { success: false } };
      if (path.endsWith('/by-book/')) return { data: { success: true, read_chapters: [49] } };
      if (path.endsWith('/by-chapter/')) return { data: { highlights: r.highlights.filter(h => h.book === p.book && h.chapter === p.chapter) } };
      if (path.endsWith('/highlights/')) return { data: { results: r.highlights } };
      if (path.endsWith('/next-position/')) return { data: { status: 'next_incomplete', month: 9, schedule_id: 3 } };
      if (path.endsWith('/schedules/month/')) return { data: [{ id: 3, book: '출애굽기', start_chapter: 3, end_chapter: 5, date: '2026-09-07' }] };
      if (path.endsWith('/certification/progress/')) return { data: { success: true, user: { nickname: 'actual nickname' }, plan: { id: 7, name: 'actual plan' }, card: { dateLabel: '2026-09-06', readingRange: 'actual range' }, progress: { status: 'completed', currentStreak: 8, totalSchedules: 12, completedSchedules: 4, completionRate: 33 } } };
      throw new Error(`Unexpected GET ${path}`);
    },
    POST: async (path, data) => { r.writes.push([path, data]); if (options.POST) { const response = await options.POST(path, data); if (response !== undefined) return response; } return path.endsWith('/reading/update/') ? { success: true, plan_id: data.plan_id, schedule_ids: data.schedule_ids, is_completed: true } : { id: 22, ...data }; },
    PATCH: async (path, data) => { r.writes.push([path, data]); return { ...r.highlights.find(h => path.includes(`/${h.id}/`)), ...data }; },
    DELETE: async (path) => { r.writes.push([path]); },
  };
  const Page = await compilePage();
  const router = Router.createRouter({ history: Router.createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] });
  r.router = router; await router.push(url); await router.isReady();
  const host = node('root'); const app = renderer.createApp({ render: () => Vue.h(Page) }); app.use(router); app.component('NuxtLink', Router.RouterLink); app.component('ClientOnly', { setup: (_, { slots }) => () => slots.default?.() });
  app.mount(host);
  return { host, router, values, state: r.state, ready: async () => { await Promise.all(r.mounts); await settled(); }, close: () => app.unmount(), route: async url => { await router.push(url); await settled(); } };
}

test('bare URL is a hub without overwriting position; continue, URL updates, back and reload keep explicit reader intent', { timeout: 10000 }, async t => {
  const saved = JSON.stringify({ book: 'exo', chapter: 3, version: 'KNT', scroll_position: .42 });
  const view = await mount('/bible', { storage: { lastReadingPosition: saved, tongdokModeState: JSON.stringify({ enabled: true, planId: 7, scheduleId: 1 }) } }); t.after(view.close); await view.ready();
  assert.equal(view.state.viewMode.value, 'home'); assert.equal(r.contentCalls.length, 0);
  assert.equal(byClass(view.host, 'bottom-nav-container').length, 1, 'hub retains the shared five-tab navigation');
  await view.state.saveCurrentReadingPosition(true); assert.equal(view.values.get('lastReadingPosition'), saved);
  const resumed = signal(view.state.hasReaderScrollPosition);
  await emit('BibleHome', 'continue-reading'); await resumed; await settled();
  assert.equal(view.state.viewMode.value, 'reader'); assert.equal(view.router.currentRoute.value.query.book, 'exo'); assert.equal(view.state.scrollPosition.value, .42);
  await view.state.handleBookSelect('gen', 50); await settled(); assert.equal(view.router.currentRoute.value.query.chapter, '50');
  await view.state.handleVersionSelect('WOORI'); await settled(); assert.equal(view.router.currentRoute.value.query.version, 'WOORI');
  await view.route('/bible'); assert.equal(view.state.viewMode.value, 'home');
  const navigated = new Promise(resolve => { const off = view.router.afterEach(() => { off(); resolve(); }); }); view.router.back(); await navigated; await settled();
  assert.equal(view.state.viewMode.value, 'reader'); assert.equal(view.state.currentVersion.value, 'WOORI');
});

test('explicit plan-only query updates reload context without erasing intent; plain chapters retain audio and auth readiness', { timeout: 10000 }, async t => {
  const authReady = deferred(); const view = await mount('/bible?book=gen&chapter=49', { initialize: () => authReady.promise }); t.after(view.close);
  assert.equal(view.state.viewMode.value, 'reader', 'explicit intent renders reader before mount requests settle');
  assert.equal(r.requests.some(([p]) => p.includes('highlights')), false);
  authReady.resolve(); await view.ready();
  assert.equal(view.state.tongdokAudioLink.value, 'https://audio.test/chapter'); assert.ok(r.requests.some(([p, q]) => p.endsWith('/detail/') && q.plan_id === undefined));
  await view.route('/bible?plan=7&schedule=1&tongdok=true&book=gen&chapter=49&date=2026-09-06');
  assert.equal(view.state.isTongdokMode.value, true); assert.equal(view.router.currentRoute.value.query.plan, '7');
  await view.route('/bible?plan=9&schedule=1'); assert.equal(view.state.tongdokPlanId.value, 9); assert.ok(r.requests.some(([p, q]) => p.endsWith('/detail/') && q.plan_id === 9));
});

test('hub TOC opens the shared selector without entering or fetching the reader', { timeout: 10000 }, async t => {
  const view = await mount('/bible'); t.after(view.close); await view.ready();
  await emit('BibleHome', 'show-toc'); await settled();
  assert.equal(view.state.viewMode.value, 'home');
  assert.equal(view.state.showBookSelector.value, true);
  assert.equal(r.boundaries.BookSelector.attrs.modelValue, true);
  assert.equal(r.contentCalls.length, 0);
  const entered = signal(view.state.viewMode, mode => mode === 'reader');
  await emit('BookSelector', 'select', 'exo', 4); await entered; await settled();
  assert.equal(view.state.viewMode.value, 'reader');
  assert.equal(view.router.currentRoute.value.query.book, 'exo');
  assert.equal(view.router.currentRoute.value.query.chapter, '4');
});

test('choosing a version from the hub selector does not navigate before chapter selection', { timeout: 10000 }, async t => {
  const view = await mount('/bible'); t.after(view.close); await view.ready();
  await view.state.handleVersionSelect('KNT'); await settled();
  assert.equal(view.state.viewMode.value, 'home');
  assert.equal(view.state.currentVersion.value, 'KNT');
  assert.equal(view.router.currentRoute.value.fullPath, '/bible');
  assert.equal(r.contentCalls.length, 0);
});

test('real shell consumes 60 pixel scroll; all controlled sheets and modal host suspend hiding and clear selection after share snapshot', { timeout: 10000 }, async t => {
  const view = await mount('/bible?book=gen&chapter=49'); t.after(view.close); await view.ready();
  const hidden = () => byClass(view.host, 'bottom-nav-tabs')[0].props.inert;
  await emit('BibleViewer', 'scroll', .6); assert.equal(hidden(), false);
  await emit('BibleViewer', 'scroll-pixels', 60); assert.equal(hidden(), true);
  for (const key of ['showBookSelector', 'showVersionSelector', 'showSettingsModal', 'showNoteModal', 'showHighlightModal', 'showScheduleModal', 'showFullScheduleModal', 'showTongdokPlanModal', 'showGuideSheet']) {
    assert.ok(view.state[key], key); view.state[key].value = true; await settled(); assert.equal(hidden(), false, key); assert.ok(r.selectionClears.length); view.state[key].value = false; await settled();
  }
  r.shareSnapshot = () => view.state.shareVerses?.value;
  await emit('BibleViewer', 'share', { book: '창세기', chapter: 49, version: '개역개정', start: 3, end: 3, startVerse: 3, endVerse: 3, text: 'selected actual text', verses: [{ number: 3, text: 'selected actual text' }] });
  assert.equal(r.boundaries.ShareSheet.attrs.mode, 'verse'); assert.equal(r.boundaries.ShareSheet.attrs.verses[0].text, 'selected actual text'); assert.equal(r.selectionClears.at(-1)[0].text, 'selected actual text');
  assert.match(r.boundaries.ShareSheet.attrs['share-url'], /verse=3/); assert.equal(hidden(), false);
  assert.ok(r.boundaries.ReadingSettingsSheet); assert.equal(r.boundaries.ReadingSettingsSheet.attrs['current-version'], 'GAE');
  const close = view.state.modal.open({ render: () => null }); await settled(); assert.equal(view.state.overlayOpen.value, true); await view.state.modal.close(); await close;
});

test('guest ordinary completion and highlight use the prompt gate without writing or leaving the reader', { timeout: 10000 }, async t => {
  const view = await mount('/bible?book=gen&chapter=49', { authenticated: false }); t.after(view.close); await view.ready();
  const routeBefore = view.router.currentRoute.value.fullPath;
  await view.state.handleMarkAsRead();
  await view.state.handleDirectHighlightSave({ book: '창세기', chapter: 49, version: '개역개정', start: 3, end: 3, text: 'actual', color: '#FFE28A' });
  assert.equal(r.authPrompts.length, 2);
  assert.deepEqual(r.writes, []);
  assert.equal(view.router.currentRoute.value.fullPath, routeBefore);
  assert.equal(view.state.showHighlightModal.value, false);
});

test('guest tongdok completion uses the prompt gate before any completion write', { timeout: 10000 }, async t => {
  const view = await mount('/bible?book=gen&chapter=49&plan=7&schedule=1&tongdok=true&date=2026-09-06', { authenticated: false, planId: 7 }); t.after(view.close); await view.ready();
  const routeBefore = view.router.currentRoute.value.fullPath;
  await view.state.handleTongdokComplete();
  assert.equal(r.authPrompts.length, 1);
  assert.equal(r.writes.some(([path]) => path.endsWith('/reading/update/')), false);
  assert.equal(view.router.currentRoute.value.fullPath, routeBefore);
  assert.equal(view.state.modal.stack.value.length, 0);
});

test('direct palette persists snapshot bounds and preserves memo; stale selection is rejected and clipboard errors are surfaced', { timeout: 10000 }, async t => {
  const view = await mount('/bible?book=gen&chapter=49', { highlights: [{ id: 5, book: 'gen', chapter: 49, start_verse: 3, end_verse: 3, color: '#custom', memo: 'keep' }] }); t.after(view.close); await view.ready();
  const snapshot = { book: '창세기', chapter: 49, version: '개역개정', start: 3, end: 3, text: 'actual', verses: [{ number: 3, text: 'actual' }], color: '#BBDDFB' };
  await emit('BibleViewer', 'highlight-save', { ...snapshot, highlightId: 5 });
  assert.deepEqual(r.writes.at(-1), ['/api/v1/todos/bible/highlights/5/', { color: '#BBDDFB' }]); assert.equal(view.state.showHighlightModal.value, false);
  assert.deepEqual(view.state.visibleChapterHighlights.value.find(h => h.id === 5), { id: 5, book: 'gen', chapter: 49, start_verse: 3, end_verse: 3, color: '#BBDDFB', memo: 'keep' });
  await emit('BibleViewer', 'highlight-save', { ...snapshot, start: 4, end: 5 });
  assert.deepEqual(r.writes.at(-1)[1], { book: 'gen', chapter: 49, start_verse: 4, end_verse: 5, color: '#BBDDFB' });
  const count = r.writes.length; await emit('BibleViewer', 'highlight-save', { ...snapshot, chapter: 48 }); assert.equal(r.writes.length, count);
  await emit('BibleViewer', 'copy-error', new Error('clipboard denied')); assert.equal(r.messages.at(-1).kind, 'error');
});

test('explicit completion uses acknowledged schedule, filtered text/real metadata, and next-position policy', { timeout: 10000 }, async t => {
  const view = await mount('/bible?book=gen&chapter=49&plan=7&schedule=1&tongdok=true&date=2026-09-06', { planId: 7, highlights: [
    { id: 5, book: 'gen', chapter: 49, start_verse: 3, end_verse: 3, color: '#custom' },
    { id: 6, book: 'exo', chapter: 3, start_verse: 3, end_verse: 3, color: '#custom' },
  ] }); t.after(view.close); await view.ready();
  assert.equal(view.state.tongdokProgress.value.done, 0);
  const progressed = signal(() => view.state.tongdokProgress.value.done, done => done === 1);
  click(byClass(view.host, 'tongdok-complete-status')[0]); await progressed; await settled();
  assert.deepEqual(view.state.tongdokProgress.value.completed, [true, false]);
  assert.equal(r.writes.filter(([path]) => path.endsWith('/reading/update/')).length, 0);
  await view.state.handleBookSelect('gen', 50); await settled();
  assert.equal(view.state.tongdokProgress.value.done, 1);
  const opened = signal(view.state.modal.stack, stack => stack.length > 0);
  click(byClass(view.host, 'tongdok-complete-status')[0]); await opened; await settled();
  const writes = r.writes.filter(([p]) => p.endsWith('/reading/update/')); assert.deepEqual(writes.map(([, d]) => d.schedule_ids), [[1]]);
  assert.equal(view.state.isTongdokMode.value, true); assert.equal(view.state.tongdokProgress.value.done, 2);
  const completion = view.state.modal.stack.value.at(-1); assert.ok(completion); assert.equal(completion.options.props.highlights.length, 1); assert.equal(completion.options.props.highlights[0].text, 'gen 49 actual verse');
  assert.equal(completion.options.props.streak, 8); assert.match(completion.options.props.nextScheduleLabel, /3.*5/);
  await completion.options.props.onShareHighlight(5); await settled(); assert.equal(r.boundaries.ShareSheet.attrs.mode, 'verse'); assert.equal(r.boundaries.ShareSheet.attrs.verses[0].id, '5');
  assert.deepEqual(r.boundaries.ShareSheet.attrs.metadata.progress, { completed: 4, total: 12, percent: 33 });
  await completion.options.props.onNext(); await settled(); assert.equal(view.state.currentBook.value, 'exo'); assert.equal(view.state.currentChapter.value, 3); assert.equal(view.state.tongdokScheduleId.value, 3); assert.equal(view.router.currentRoute.value.query.schedule, '3');
});

test('loading and navigating chapters never mark them completed', { timeout: 10000 }, async t => {
  const view = await mount('/bible?book=gen&chapter=49&plan=7&schedule=1&tongdok=true&date=2026-09-06');
  t.after(view.close); await view.ready();
  assert.equal(view.state.tongdokProgress.value.done, 0);
  await view.state.handleBookSelect('gen', 50); await settled();
  assert.equal(view.state.tongdokProgress.value.done, 0);
  assert.deepEqual(view.state.tongdokProgress.value.completed, [false, false]);
  assert.equal(r.writes.filter(([path]) => path.endsWith('/reading/update/')).length, 0);
});

test('promise-returning Nuxt context loads reader and completion verse text', { timeout: 10000 }, async t => {
  const view = await mount('/bible?book=gen&chapter=49&plan=7&schedule=1&tongdok=true&date=2026-09-06', {
    promiseContext: true, enforceNuxtContext: true,
    rows: [{ book: 'gen', start_chapter: 49, end_chapter: 49, is_complete: false, schedule_id: 1, date: '2026-09-06' }],
    highlights: [{ id: 5, book: 'gen', chapter: 49, start_verse: 3, end_verse: 3, color: '#FFE28A' }],
  });
  t.after(view.close); await view.ready();
  assert.match(view.state.bibleContent.value, /gen 49 actual verse/);
  const opened = signal(view.state.modal.stack, stack => stack.length > 0);
  click(byClass(view.host, 'tongdok-complete-status')[0]); await opened; await settled();
  assert.equal(view.state.modal.stack.value.at(-1).options.props.highlights[0].text, 'gen 49 actual verse');
});

test('next at the final scheduled chapter navigates across the book boundary without completing', { timeout: 10000 }, async t => {
  const view = await mount('/bible?book=gen&chapter=50&plan=7&schedule=1&tongdok=true&date=2026-09-06');
  t.after(view.close); await view.ready();
  await view.state.goToNextChapter(); await settled();
  assert.equal(view.state.currentBook.value, 'exo');
  assert.equal(view.state.currentChapter.value, 1);
  assert.equal(view.router.currentRoute.value.query.chapter, '1');
  assert.equal(r.writes.filter(([path]) => path.endsWith('/reading/update/')).length, 0);
  assert.equal(view.state.modal.stack.value.length, 0);
});

test('completion includes an eligible highlight beyond the first account-wide page', { timeout: 10000 }, async t => {
  const unrelated = Array.from({ length: 50 }, (_, index) => ({ id: index + 1, book: 'exo', chapter: 3, start_verse: 3, end_verse: 3, color: '#FFE28A' }));
  const eligible = { id: 70, book: 'gen', chapter: 49, start_verse: 3, end_verse: 3, color: '#BBDDFB' };
  const view = await mount('/bible?book=gen&chapter=49&plan=7&schedule=1&tongdok=true&date=2026-09-06', {
    rows: [{ book: 'gen', start_chapter: 49, end_chapter: 49, is_complete: false, schedule_id: 1, date: '2026-09-06' }],
    highlights: [...unrelated, eligible],
    GET: async path => path.endsWith('/highlights/') ? { data: { count: 51, next: '/api/v1/todos/bible/highlights/?page=2', previous: null, results: unrelated } } : undefined,
  });
  t.after(view.close); await view.ready();
  await view.state.handleTongdokComplete(); await settled();
  assert.deepEqual(view.state.modal.stack.value.at(-1).options.props.highlights.map(h => h.id), [70]);
});

test('audio carries complete source identity, plain ended never persists, and stale ended cannot affect next context', { timeout: 10000 }, async t => {
  const view = await mount('/bible?book=gen&chapter=49'); t.after(view.close); await view.ready();
  await view.state.handleTongdokAudioEnded({ audioLink: view.state.tongdokAudioLink.value, audioContextKey: view.state.audioContextKey?.value }); assert.equal(r.writes.filter(([p]) => p.endsWith('/reading/update/')).length, 0); assert.equal(r.messages.at(-1)?.kind, 'info');
  await view.route('/bible?book=gen&chapter=49&plan=7&schedule=1&tongdok=true&date=2026-09-06');
  const source = { audioLink: view.state.tongdokAudioLink.value, audioContextKey: view.state.audioContextKey.value };
  await view.route('/bible?book=gen&chapter=49&plan=9&schedule=2&tongdok=true&date=2026-09-06');
  await view.state.handleTongdokAudioEnded(source); assert.equal(r.writes.filter(([p]) => p.endsWith('/reading/update/')).length, 0);
});

test('reload restores matching inner-reader scroll; cross-book navigation never writes old scroll into the new chapter', { timeout: 10000 }, async t => {
  const view = await mount('/bible?book=gen&chapter=50&version=GAE', { storage: { lastReadingPosition: JSON.stringify({ book: 'gen', chapter: 50, version: 'GAE', scroll_position: .42 }) } }); t.after(view.close); await view.ready();
  assert.equal(view.state.scrollPosition.value, .42);
  await view.state.goToNextChapter(); await settled();
  assert.equal(view.state.currentBook.value, 'exo'); assert.equal(view.state.currentChapter.value, 1);
  assert.equal(r.writes.some(([p, data]) => p.endsWith('/reading-position/') && data.book === 'exo' && data.scroll_position === .42), false);
});

test('superseded content cannot paint a newer route, even while earlier auth/content loading is pending', { timeout: 10000 }, async t => {
  const firstStarted = deferred(); const firstReady = deferred();
  const view = await mount('/bible?book=gen&chapter=49', { content: async (book, chapter) => {
    if (chapter === 49) { firstStarted.resolve(); return firstReady.promise; } return `${book}:${chapter}`;
  } }); t.after(view.close); await firstStarted.promise;
  await view.route('/bible?book=exo&chapter=1'); assert.equal(view.state.bibleContent.value, 'exo:1');
  firstReady.resolve('old chapter'); await view.ready(); assert.equal(view.state.bibleContent.value, 'exo:1');
});

test('in-flight audio completion acknowledgement is ignored after plan/schedule changes at the same chapter', { timeout: 10000 }, async t => {
  const started = deferred(); const acknowledged = deferred();
  const view = await mount('/bible?book=gen&chapter=49&plan=7&schedule=1&tongdok=true&date=2026-09-06', {
    rows: [{ book: 'gen', start_chapter: 49, end_chapter: 49, is_complete: false, schedule_id: 1, date: '2026-09-06' }],
    POST: async (path, data) => { if (path.endsWith('/reading/update/')) { started.resolve(data); return acknowledged.promise; } },
  }); t.after(view.close); await view.ready();
  const completion = view.state.handleTongdokAudioEnded({ audioLink: view.state.tongdokAudioLink.value, audioContextKey: view.state.audioContextKey.value });
  const data = await started.promise;
  await view.route('/bible?book=gen&chapter=49&plan=9&schedule=2&tongdok=true&date=2026-09-06');
  acknowledged.resolve({ success: true, plan_id: data.plan_id, schedule_ids: data.schedule_ids, is_completed: true }); await completion;
  assert.equal(view.state.modal.stack.value.length, 0); assert.equal(view.state.tongdokPlanId.value, 9); assert.equal(view.state.showShareSheet.value, false);
  assert.equal(r.requests.some(([p]) => p.endsWith('/certification/progress/')), false);
});

test('completed modal survives unavailable certification metadata without inventing streak/progress or unrelated highlights', { timeout: 10000 }, async t => {
  const view = await mount('/bible?book=gen&chapter=49&plan=7&schedule=1&tongdok=true&date=2026-09-06', {
    rows: [{ book: 'gen', start_chapter: 49, end_chapter: 49, is_complete: true, schedule_id: 1, date: '2026-09-06' }],
    GET: async path => { if (path.endsWith('/certification/progress/')) throw new Error('metadata unavailable'); },
  }); t.after(view.close); await view.ready();
  await view.state.handleTongdokComplete();
  const completion = view.state.modal.stack.value.at(-1); assert.ok(completion);
  assert.equal(completion.options.props.streak, undefined); assert.deepEqual(completion.options.props.highlights, []);
  await completion.options.props.onShare(); await settled();
  assert.equal(r.boundaries.ShareSheet.attrs.metadata.streak, undefined); assert.equal(r.boundaries.ShareSheet.attrs.metadata.progress, undefined); assert.equal(r.messages.some(message => message.kind === 'error'), true);
});

test('date-group completion shares the actual newly acknowledged schedule rather than the initially selected completed row', { timeout: 10000 }, async t => {
  const rows = [
    { book: 'gen', start_chapter: 49, end_chapter: 50, is_complete: true, schedule_id: 1, date: '2026-09-06' },
    { book: 'exo', start_chapter: 1, end_chapter: 1, is_complete: false, schedule_id: 2, date: '2026-09-06' },
  ];
  const view = await mount('/bible?book=exo&chapter=1&plan=7&schedule=1&tongdok=true&date=2026-09-06', { rows }); t.after(view.close); await view.ready();
  await view.state.handleTongdokComplete();
  assert.deepEqual(r.writes.filter(([p]) => p.endsWith('/reading/update/')).map(([, data]) => data.schedule_ids), [[2]]);
  assert.equal(r.requests.find(([p]) => p.endsWith('/certification/progress/'))[1].schedule_id, 2);
});

test('late content loader creation retains Nuxt runtime-config context after navigation and completion awaits', { timeout: 10000 }, async t => {
  const view = await mount('/bible?book=gen&chapter=49', { enforceNuxtContext: true }); t.after(view.close); await view.ready();
  await view.state.handleBookSelect('exo', 1); assert.equal(view.state.currentBook.value, 'exo');
  assert.match(view.state.bibleContent.value, /exo 1/);
});

test('malformed next-position month cannot issue an invented monthly schedule request', { timeout: 10000 }, async t => {
  const view = await mount('/bible?book=gen&chapter=49&plan=7&schedule=1&tongdok=true', {
    GET: async path => path.endsWith('/next-position/') ? { data: { status: 'next_incomplete', schedule_id: 3 } } : undefined,
  }); t.after(view.close); await view.ready();
  await view.state.openPlanSheet();
  assert.equal(r.requests.some(([path]) => path.endsWith('/schedules/month/')), false);
});

test('plain reader compact plan uses real next-position rows and starts their exact context; guide callback uses native navigation', { timeout: 10000 }, async t => {
  const view = await mount('/bible?book=gen&chapter=49', { planId: 7 }); t.after(view.close); await view.ready();
  await view.state.openPlanSheet(); await settled();
  const rows = r.boundaries.ReaderPlanSheet.attrs.rows;
  assert.deepEqual(rows.map(row => [row.scheduleId, row.book, row.chapter, row.status]), [[3, 'exo', 3, 'upcoming'], [3, 'exo', 4, 'upcoming'], [3, 'exo', 5, 'upcoming']]);
  await view.state.handlePlanChapterSelect({ scheduleId: 3, book: 'exo', chapter: 4 }); await settled();
  assert.equal(view.state.currentChapter.value, 4); assert.equal(view.state.tongdokScheduleId.value, 3); assert.equal(view.state.tongdokPlanId.value, 7);
  const nativeMessages = []; window.__nativeBridge = { isNativeApp: () => true, sendToNative: payload => nativeMessages.push(payload) };
  await emit('ReaderGuideSheet', 'open-guide', 'https://guide.test'); assert.deepEqual(nativeMessages, [{ type: 'navigate', url: 'https://guide.test' }]);
});

test('a selection from a superseded version cannot open a card using the new version URL', { timeout: 10000 }, async t => {
  const view = await mount('/bible?book=gen&chapter=49'); t.after(view.close); await view.ready();
  await view.state.handleVersionSelect('WOORI'); await settled();
  await emit('BibleViewer', 'share', { book: '창세기', chapter: 49, version: '개역개정', startVerse: 3, endVerse: 3, text: 'old version' });
  assert.equal(view.state.showShareSheet.value, false);
});
