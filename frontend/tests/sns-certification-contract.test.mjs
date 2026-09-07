import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { test as nodeTest } from 'node:test';
import { parse, compileScript } from '@vue/compiler-sfc';
import { renderToString } from '@vue/server-renderer';
import ts from 'typescript';
import * as Vue from 'vue';

const test = (name, run) => nodeTest(name, { timeout: 3000 }, run);
const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '../app');
const passthrough = Vue.defineComponent({ inheritAttrs: false, setup: (_, { slots }) => () => slots.default?.() });
function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    if (overrides[file]) return overrides[file];
    file = file.startsWith('~/') ? resolve(root, file.slice(2)) : file;
    if (!/\.(vue|ts)$/.test(file)) file += '.ts';
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    let source = readFileSync(file, 'utf8');
    if (file.endsWith('.vue')) {
      const { descriptor } = parse(source, { filename: file });
      source = compileScript(descriptor, { id: file, inlineTemplate: true, fs: { fileExists: existsSync, readFile: path => readFileSync(path, 'utf8') } }).content;
    }
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const localRequire = name => name === 'vue' ? { ...Vue, Transition: passthrough }
      : name.startsWith('~/') || name.startsWith('.') ? load(name.startsWith('~/') ? name : resolve(dirname(file), name)) : require(name);
    new Function('require', 'module', 'exports', js)(localRequire, module, module.exports);
    return module.exports;
  }
  return load;
}
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function channel() {
  const values = [], waiters = [];
  return {
    publish(value) { const waiter = waiters.shift(); if (waiter) waiter.resolve(value); else values.push(value); },
    next() { if (values.length) return Promise.resolve(values.shift()); const waiter = deferred(); waiters.push(waiter); return waiter.promise; },
  };
}
function platform() {
  const listeners = new Set();
  const notify = n => { for (const listener of [...listeners]) listener(n); };
  const descendants = n => n.children.flatMap(c => [c, ...descendants(c)]);
  const node = (tag, text = '') => Vue.markRaw({ tag, text, children: [], props: {}, parent: null, clientWidth: 342,
    querySelector(selector) { return descendants(this).find(n => n.tag === selector) ?? null; },
    querySelectorAll(selector) { return descendants(this).filter(n => selector === '[data-share-slide]' ? n.props['data-share-slide'] !== undefined : n.tag === selector); },
    scrollTo() {},
  });
  function remove(n) { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; }
  const body = node('body'), container = node('root');
  body.children.push(container); container.parent = body;
  const renderer = Vue.createRenderer({
    createElement: node, createText: text => node('#text', text), createComment: text => node('#comment', text),
    setText: (n, text) => { n.text = text; notify(n); }, setElementText: (n, text) => { n.text = text; n.children = []; notify(n); },
    insert(n, parent, anchor) { remove(n); const index = parent.children.indexOf(anchor); parent.children.splice(index < 0 ? parent.children.length : index, 0, n); n.parent = parent; notify(n); },
    remove, parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1],
    querySelector: selector => selector === 'body' ? body : null,
    patchProp: (n, key, old, value) => { n.props[key] = value; notify(n); },
  });
  return {
    renderer, container,
    all: () => descendants(body),
    find: id => descendants(body).find(n => n.props['data-testid'] === id),
    byClass: name => descendants(body).find(n => String(n.props.class).split(' ').includes(name)),
    // Subscribe before triggering the exact Vue renderer state change. No polling.
    changed(predicate) { const signal = deferred(); const listener = n => { if (predicate(n)) { listeners.delete(listener); signal.resolve(n); } }; listeners.add(listener); return signal.promise; },
  };
}
const certification = {
  success: true,
  user: { id: 2, nickname: '실제 사용자' },
  plan: { id: 7, name: '1년 1독' },
  period: { startDate: '2026-01-01', endDate: '2026-12-31' },
  progress: { totalSchedules: 30, completedSchedules: 18, completionRate: 60, currentStreak: 4, totalCompletedDays: 18, latestCompletedAt: '2026-08-26T00:00:00+09:00', status: 'in_progress' },
  card: { title: '오늘 통독 완료', subtitle: '오늘도 말씀을 읽었습니다', readingRange: '사무엘상 25장', dateLabel: '2026-08-26', footer: '매일 말씀을 읽는 작은 습관' },
};
const assets = { logo: 'data:image/png;base64,AA==', fontCss: '' };
function prepared(id) {
  // Native rasterization is outside this Node platform. No PNG-byte claim.
  const bytes = `prepared transport fixture ${id}`;
  return { file: new File([bytes], 'maeil1dok-tongdok-certification.png', { type: 'image/png' }), dataUrl: `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`, width: 720, height: 1280 };
}
function fixture(t, { adapter = true, open = true } = {}) {
  const host = platform(), jobs = channel(), requests = [], shared = [], downloaded = [], copied = [], navigation = [], results = [];
  for (const [name, value] of Object.entries({
    window: { location: { origin: 'https://maeil1dok.app' } },
    document: { body: { append() {} }, createElement(tag) { assert.equal(tag, 'a', 'the transport must not generate artwork'); return { click() {}, remove() {} }; } },
    navigator: { canShare: () => true, share: data => { shared.push(data); return Promise.resolve(); }, clipboard: { writeText: async value => { copied.push(value); } } },
  })) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => original ? Object.defineProperty(globalThis, name, original) : delete globalThis[name]);
  }
  t.mock.method(URL, 'createObjectURL', blob => { downloaded.push(blob); return 'blob:prepared-certification'; });
  t.mock.method(URL, 'revokeObjectURL', () => {});
  const api = loader()('~/composables/bible/bibleShare');
  const load = loader({
    '~/composables/useApi': { useApi: () => ({ GET: (path, options) => { const request = deferred(); requests.push({ ...request, path, options }); return request.promise; } }) },
    '~/composables/useFocusTrap': { useFocusTrap: () => ({ isTopmost: Vue.ref(true), zIndex: Vue.ref(200) }) },
    '~/composables/useScrollLock': { useScrollLock: () => {} },
    '~/composables/bible/bibleShare': { ...api, loadBibleShareAssets: async () => assets, prepareBibleShareImage: svg => {
      const job = { ...deferred(), svg }; jobs.publish(job); return job.promise;
    } },
  });
  // Adapter, ShareSheet, BottomSheet, all card SFCs and transport are REAL. Only
  // native platform/layout/focus and the image-preparation boundary are supplied.
  const component = load(adapter ? '~/components/bible/TongdokCertificationModal.vue' : '~/components/bible/share/ShareSheet.vue').default;
  const props = Vue.reactive(adapter ? { modelValue: open, planId: 7, scheduleId: 13 } : {
    modelValue: open, mode: 'complete', metadata: { readingRange: certification.card.readingRange, planName: certification.plan.name }, verses: [], shareUrl: 'https://maeil1dok.app/bible/history?plan_id=7&schedule_id=13',
  });
  const app = host.renderer.createApp({ render: () => Vue.h(component, {
    ...props, 'onUpdate:modelValue': value => { props.modelValue = value; }, onClose: () => navigation.push('/plan'), onResult: value => results.push(value),
  }) });
  app.mount(host.container); t.after(() => app.unmount());
  const enable = async (job, image) => {
    const enabled = host.changed(n => n.props['data-testid'] === 'share-send' && n.props.disabled === false);
    job.resolve(image); await enabled; await Vue.nextTick();
  };
  return { host, jobs, requests, shared, downloaded, copied, navigation, results, props, api, enable };
}

test('certification card renders its real metadata with an accessible summary', async () => {
  const card = loader()('~/components/bible/TongdokCertificationCard.vue').default;
  const html = await renderToString(Vue.createSSRApp({ render: () => Vue.h(card, { certification }) }));
  const summary = html.match(/<article[^>]*aria-label="([^"]+)"/)?.[1];
  assert.ok(summary?.includes(certification.card.readingRange));
  assert.ok(summary.includes(`${certification.progress.completedSchedules}/${certification.progress.totalSchedules}`));
  assert.ok(html.includes(certification.card.dateLabel));
  assert.ok(html.includes(certification.plan.name));
  assert.match(html, /viewBox="0 0 320 400"/);
  assert.match(html, /data-progress="true"/);
});

test('certification modal opens as a separate completion surface with required actions', async t => {
  const f = fixture(t);
  const starting = f.jobs.next();
  f.requests[0].resolve({ data: certification });
  const job = await starting;
  const dialog = f.host.all().find(n => n.props.role === 'dialog');
  assert.equal(dialog.props['aria-modal'], true);
  assert.ok(f.host.all().find(n => n.tag === 'h2' && n.props.id === dialog.props['aria-labelledby']));
  assert.equal(job.svg.props.viewBox, '0 0 360 640');
  const image = prepared('completion'); await f.enable(job, image);
  assert.equal(f.host.find('share-send').props.disabled, false);
  assert.equal(f.host.find('share-save').props.disabled, false);
  assert.ok(f.host.byClass('share-copy'));
  const sharing = f.host.find('share-send').props.onClick();
  assert.equal(f.shared[0].files[0], image.file, 'adapter must preserve prepared image behavior');
  await sharing; await Vue.nextTick();
  assert.match(f.shared[0].url, /plan_id=7/);
  assert.match(f.shared[0].url, /schedule_id=13/);
  await f.host.find('share-save').props.onClick(); await Vue.nextTick();
  assert.equal(f.downloaded[0], image.file);
  await f.host.byClass('share-copy').props.onClick();
  assert.equal(f.copied[0], f.shared[0].url);
});

test('completion success opens certification modal before plan navigation', async t => {
  const f = fixture(t, { open: false });
  await Vue.nextTick();
  assert.equal(f.host.all().filter(n => n.props.role === 'dialog').length, 0);
  // Controlled root contract: completion opens; only close routes to the plan.
  f.props.modelValue = true; await Vue.nextTick();
  const starting = f.jobs.next(); f.requests[0].resolve({ data: certification });
  const job = await starting; await f.enable(job, prepared('completed'));
  assert.equal(f.host.all().filter(n => n.props.role === 'dialog').length, 1);
  assert.deepEqual(f.navigation, []);
  await f.host.find('share-send').props.onClick(); await Vue.nextTick();
  assert.deepEqual(f.navigation, []);
  f.host.byClass('bottom-sheet__close').props.onClick(); await Vue.nextTick();
  assert.deepEqual(f.navigation, ['/plan']);
  assert.equal(f.props.modelValue, false);
});

test('certification image actions stay disabled until data and the selected image are ready', async t => {
  const f = fixture(t); await Vue.nextTick();
  for (const id of ['share-send', 'share-save']) {
    assert.equal(f.host.find(id).props.disabled, true);
    await f.host.find(id).props.onClick();
  }
  assert.equal(f.shared.length + f.downloaded.length, 0);
  const starting = f.jobs.next(); f.requests[0].resolve({ data: certification });
  const job = await starting;
  assert.equal(f.host.find('share-send').props.disabled, true, 'API readiness alone is not image readiness');
  const failure = new Error('native image preparation failed');
  const failed = f.host.changed(n => n.props.role === 'status' && n.text === failure.message);
  job.reject(failure); await failed; await Vue.nextTick();
  assert.equal(f.host.find('share-send').props.disabled, true);
  assert.equal(f.shared.length + f.downloaded.length, 0);
  const restarting = f.jobs.next(); f.host.byClass('share-retry').props.onClick();
  await f.enable(await restarting, prepared('retry'));
  assert.equal(f.host.find('share-send').props.disabled, false);
  assert.equal(f.host.find('share-save').props.disabled, false);
});

test('existing verse selection share behavior remains isolated', async t => {
  const f = fixture(t, { adapter: false });
  await f.enable(await f.jobs.next(), prepared('old completion'));
  const verse = { id: 'JHN-3-16', reference: '요한복음 3:16', text: '하나님이 세상을 이처럼 사랑하사' };
  const url = f.api.buildBibleShareUrl('https://maeil1dok.app', { book: 'JHN', chapter: 3, version: 'GAE' }, { start: 16, end: 16 });
  const starting = f.jobs.next();
  f.props.mode = 'verse'; f.props.metadata = {}; f.props.verses = [verse]; f.props.shareUrl = url;
  const job = await starting;
  const image = prepared('selected verse'); await f.enable(job, image);
  assert.equal(f.host.all().filter(n => n.props['data-share-slide'] !== undefined).length, 1);
  await f.host.find('share-send').props.onClick();
  assert.equal(f.shared[0].files[0], image.file);
  assert.equal(f.shared[0].title, verse.reference);
  assert.equal(f.shared[0].text, verse.text);
  assert.equal(f.shared[0].url, url);
  assert.doesNotMatch(f.shared[0].url, /certification=|plan_id=|schedule_id=/);
  assert.deepEqual(f.results, [{ action: 'share', result: 'shared' }]);
  assert.equal(f.copied.length, 0);
});
