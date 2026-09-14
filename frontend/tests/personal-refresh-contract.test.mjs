import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { build } from 'esbuild';
import { compileScript, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import * as Pinia from 'pinia';
import { rawHexes, styleOf } from './helpers/design-contract.mjs';

// PR4 개인 — 알림/설정/읽기설정/내 기록 디자인 계약 (핸드오프 README "10~14").
const notifications = await readFile(new URL('../app/pages/notifications/index.vue', import.meta.url), 'utf8');
const settings = await readFile(new URL('../app/pages/account/settings.vue', import.meta.url), 'utf8');
const readingSettings = await readFile(new URL('../app/pages/bible/settings.vue', import.meta.url), 'utf8');
const records = await Promise.all([
  ['notes', '../app/pages/bible/notes/index.vue'],
  ['highlights', '../app/pages/bible/highlights/index.vue'],
  ['bookmarks', '../app/pages/bible/bookmarks.vue'],
].map(async ([name, path]) => [name, await readFile(new URL(path, import.meta.url), 'utf8')]));

test('알림은 날짜 그룹과 미읽음 도트를 그린다', () => {
  assert.match(notifications, /오늘|어제/, '날짜 그룹 라벨');
  assert.match(styleOf(notifications), /(unread|미읽음|is-unread)[^{]*\{[\s\S]*?(background|color):\s*var\(--color-accent/, '미읽음 accent');
  assert.match(notifications, /모두 읽음/, '모두 읽음 액션');
});

test('설정은 알림 스위치와 테마 세그먼트를 통합한다', () => {
  assert.match(settings, /SegmentedControl/, '테마 세그먼트');
  for (const label of ['라이트', '다크', '시스템']) {
    assert.match(settings, new RegExp(label), `테마 ${label}`);
  }
  assert.match(settings, /오늘 본문 알림|하세나하시조 알림|친구 활동/, '알림 설정 통합');
  assert.match(styleOf(settings), /switch[^{]*\{[\s\S]*?width:\s*40px/, 'Switch 40x24');
});

test('읽기 설정은 바텀시트로 열린다', { timeout: 5000 }, async t => {
  // Compile the actual route, shared sheet and store. Only the platform shell,
  // Nuxt services and HTTP boundary are supplied; this does not prove native CSS.
  const root = new URL('../', import.meta.url).pathname;
  const runtime = { Vue, Pinia };
  const globals = {
    __personalReadingSettings: runtime,
    definePageMeta: () => {},
    useRouter: () => runtime.router,
    window: { history: { state: {} }, matchMedia: () => ({ matches: false, addEventListener() {} }) },
    document: { cookie: '', documentElement: { setAttribute() {} }, querySelector: () => null },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  };
  const originals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  let app;
  t.after(() => {
    app?.unmount();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const preferences = { fontFamily: 'noto-serif', fontSize: 19, lineHeight: 1.8, theme: 'dark' };
  const storage = new Map([['readingSettings', JSON.stringify(preferences)]]);
  const requests = [];
  const navigation = [];
  runtime.router = { back: () => navigation.push('back'), replace: path => navigation.push(path) };
  runtime.auth = { isAuthenticated: Vue.ref(true) };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, method: options.method ?? 'GET', payload: options.body ? JSON.parse(options.body) : undefined });
    return Response.json({ success: true, data: { settings: { font_family: 'noto-serif', font_size: 19, line_height: 1.8, theme: 'dark' } } });
  });
  const services = {
    '#app': 'export const useRuntimeConfig = () => ({ public: { apiBase: "https://settings.test" } });',
    '#components': 'export const NuxtLink = () => null;',
    '~/composables/useAuthService': 'export const useAuthService = () => globalThis.__personalReadingSettings.auth;',
    '~/composables/useModal': 'export const useModal = () => ({ confirm: async () => false });',
    '~/composables/useToast': 'export const useToast = () => ({ success() {}, error() {} });',
    '~/composables/useErrorHandler': 'export const useErrorHandler = () => ({ handleApiError: error => { throw error; } });',
  };
  const compiled = await build({
    stdin: { contents: `export { default as Route } from '~/pages/bible/settings.vue';
      export { default as Sheet } from '~/components/ReadingSettingsSheet.vue';
      export { useReadingSettingsStore } from '~/stores/readingSettings';`, resolveDir: root },
    bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent',
    plugins: [{ name: 'personal-reading-settings-runtime', setup(builder) {
      builder.onResolve({ filter: /^(vue|pinia)$/ }, ({ path }) => ({ path, namespace: 'runtime' }));
      builder.onLoad({ filter: /.*/, namespace: 'runtime' }, ({ path }) => {
        const name = path === 'vue' ? 'Vue' : 'Pinia';
        return { contents: Object.keys(runtime[name]).filter(key => key !== 'default' && /^[\w$]+$/.test(key))
          .map(key => `export const ${key} = globalThis.__personalReadingSettings.${name}.${key};`).join('\n') };
      });
      builder.onResolve({ filter: /^(~\/|#app$|#components$)/ }, ({ path }) => services[path]
        ? { path, namespace: 'service' }
        : { path: `${root}app/${path.slice(2)}${path.endsWith('.vue') ? '' : '.ts'}` });
      builder.onLoad({ filter: /.*/, namespace: 'service' }, ({ path }) => ({ contents: services[path] }));
      builder.onLoad({ filter: /\.vue$/ }, async ({ path }) => {
        if (path.endsWith('/BottomSheet.vue')) return { contents: `import { h } from 'vue'; export default {
          props: ['modelValue'], emits: ['update:modelValue'], setup(props, { slots, emit }) {
            return () => props.modelValue ? h('section', { role: 'dialog' }, [slots['header-extra']?.(), slots.default?.(),
              h('button', { 'data-testid': 'platform-dismiss', onClick: () => emit('update:modelValue', false) })]) : null;
          }
        };` };
        if (path.endsWith('/Toast.vue')) return { contents: 'export default () => null;' };
        const { descriptor, errors } = parse(await readFile(path, 'utf8'), { filename: path });
        assert.deepEqual(errors, []);
        return { contents: compileScript(descriptor, { id: path, inlineTemplate: true, templateOptions: { compilerOptions: { hoistStatic: false } } }).content,
          loader: 'ts', resolveDir: new URL('.', `file://${path}`).pathname };
      });
    } }],
  });
  const { Route, Sheet, useReadingSettingsStore } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
  const node = type => Vue.markRaw({ type, props: {}, children: [], parent: null });
  const renderer = Vue.createRenderer({
    createElement: node, createText: () => node('#text'), createComment: () => node('#comment'),
    setText() {}, setElementText: target => { target.children = []; },
    parentNode: target => target.parent, nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] ?? null,
    patchProp: (target, key, _previous, value) => { target.props[key] = value; },
    insert(target, parent, anchor = null) {
      if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1);
      target.parent = parent;
      const index = anchor ? parent.children.indexOf(anchor) : -1;
      parent.children.splice(index < 0 ? parent.children.length : index, 0, target);
    },
    remove(target) { target.parent.children.splice(target.parent.children.indexOf(target), 1); target.parent = null; },
  });
  const find = (target, predicate) => [...(predicate(target) ? [target] : []), ...target.children.flatMap(child => find(child, predicate))];
  const click = target => { assert.ok(target); for (const handler of [target.props.onClick].flat()) handler?.(); };
  const pinia = Pinia.createPinia();
  const store = useReadingSettingsStore(pinia);
  const actionSignal = action => new Promise((resolve, reject) => {
    const off = store.$onAction(({ name, after, onError }) => { if (name !== action) return; off(); after(resolve); onError(reject); });
  });
  const ready = actionSignal('initialize');
  const mountRoute = () => {
    const host = node('root');
    app = renderer.createApp({ render: () => Vue.h(Route) });
    app.use(pinia); app.component('NuxtLink', () => null); app.mount(host);
    return host;
  };
  const host = mountRoute(); await ready; await Vue.nextTick();
  const sheet = () => app._instance.subTree.component.subTree;
  assert.equal(sheet().type, Sheet, 'the route mounts the actual shared component');
  assert.equal(sheet().component.props.modelValue, true);
  assert.equal(find(host, node => node.props.role === 'dialog').length, 1);
  for (const [key, value] of Object.entries(preferences)) assert.equal(store.settings[key], value);
  const fonts = find(host, node => String(node.props.class ?? '').split(/\s+/).includes('font-button'));
  assert.equal(fonts.length, 3);
  assert.ok(fonts.every(node => node.props['aria-pressed'] === false), 'legacy Noto does not silently select a visible font');
  t.mock.timers.tick(1000);
  assert.deepEqual(requests.map(request => request.method), ['GET'], 'opening performs no persistence request');
  find(host, node => node.props.id === 'reading-font-size')[0].props.onInput({ target: { value: '20' } });
  assert.equal(store.settings.fontSize, 20); assert.equal(store.settings.fontFamily, 'noto-serif');
  const synced = actionSignal('syncToServer'); t.mock.timers.tick(400); await synced;
  const patch = requests.find(request => request.method === 'PATCH');
  assert.ok(patch); assert.equal(patch.payload.font_family, 'noto-serif');
  assert.equal(patch.payload.font_size, 20); assert.equal(patch.payload.line_height, 1.8); assert.equal(patch.payload.theme, 'dark');
  click(find(host, node => String(node.props.class ?? '').split(/\s+/).includes('done-btn'))[0]); await Vue.nextTick();
  assert.equal(sheet().component.props.modelValue, false); assert.equal(find(host, node => node.props.role === 'dialog').length, 0);
  assert.deepEqual(navigation, ['/bible']);
  app.unmount(); app = null;
  window.history.state.back = '/hasena';
  const reopened = mountRoute(); await Vue.nextTick();
  assert.equal(sheet().component.props.modelValue, true);
  assert.equal(store.settings.fontFamily, 'noto-serif');
  click(find(reopened, node => node.props['data-testid'] === 'platform-dismiss')[0]); await Vue.nextTick();
  assert.equal(sheet().component.props.modelValue, false); assert.equal(find(reopened, node => node.props.role === 'dialog').length, 0);
  assert.deepEqual(navigation, ['/bible', 'back']);
  t.mock.timers.tick(400); assert.equal(requests.filter(request => request.method === 'PATCH').length, 1);
});

test('내 기록 3화면은 동일한 3분할 세그먼트를 공유한다', () => {
  for (const [name, source] of records) {
    assert.match(source, /SegmentedControl/, `${name} 세그먼트`);
    for (const label of ['묵상노트', '하이라이트', '북마크']) {
      assert.match(source, new RegExp(label), `${name} 세그먼트 라벨 ${label}`);
    }
  }
});

test('하이라이트 화면은 4색 스와치 토큰을 쓴다', () => {
  const highlights = records.find(([n]) => n === 'highlights')[1];
  for (const token of ['yellow', 'green', 'blue', 'pink']) {
    assert.match(highlights, new RegExp(`--color-highlight-${token}`), `스와치 ${token}`);
  }
});

test('개인 화면에 원시 hex 가 없다', () => {
  for (const [name, source] of [['notifications', notifications], ['settings', settings], ['bible/settings', readingSettings], ...records]) {
    assert.deepEqual(rawHexes(source), [], `${name} 원시 hex`);
  }
});
