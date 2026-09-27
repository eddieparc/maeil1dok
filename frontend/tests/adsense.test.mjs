import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { compileScript, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';

const source = await readFile(new URL('../app/plugins/native-app.client.ts', import.meta.url), 'utf8');
const compiled = await transform(source, { loader: 'ts', format: 'cjs' });

function setupNativePlugin(native) {
  const scripts = [];
  const messages = [];
  const listeners = new Map();
  const window = {
    isReactNativeWebView: native,
    ReactNativeWebView: native ? { postMessage: message => messages.push(JSON.parse(message)) } : undefined,
    addEventListener: (name, handler) => listeners.set(name, handler),
  };
  const context = {
    exports: {},
    module: { exports: {} },
    defineNuxtPlugin: plugin => plugin,
    window,
    document: {
      querySelector: () => null,
      createElement: () => ({}),
      head: { appendChild: script => scripts.push(script) },
      addEventListener: (name, handler) => listeners.set(name, handler),
    },
  };
  vm.runInNewContext(compiled.code, context);
  context.module.exports.default.setup();
  return { scripts, messages, listeners, window };
}

test('web entry does not load ads globally before a reader slot is visible', () => {
  const { scripts } = setupNativePlugin(false);
  assert.equal(scripts.length, 0, 'AdSense must be owned by the visible reader slot, not every web page');
});

test('native entry requests authentication without loading web ads', () => {
  const { scripts, messages, window, listeners } = setupNativePlugin(true);
  assert.equal(scripts.length, 0);
  assert.deepEqual(messages, [{ type: 'auth:request' }]);
  assert.equal(window.__nativeBridge.isNativeApp(), true);
  const received = [];
  window.__nativeBridge.registerAuthCallback(value => received.push(value), () => received.push('logout'));
  const credentials = { access: 'test-access', refresh: 'test-refresh' };
  listeners.get('native:auth')({ detail: { type: 'token', data: credentials } });
  listeners.get('native:auth')({ detail: { type: 'logout' } });
  assert.deepEqual(received, [credentials, 'logout']);
});

const footerSource = await readFile(new URL('../app/components/bible/BibleFooterAd.vue', import.meta.url), 'utf8');
const { descriptor } = parse(footerSource);
const footerCode = await transform(compileScript(descriptor, { id: 'reader-ad-test', inlineTemplate: true }).content, {
  loader: 'ts', format: 'cjs', define: { 'import.meta.dev': 'false' },
});

function observerSignal() {
  let resolve;
  let reject;
  const promise = new Promise((onReady, onError) => {
    resolve = onReady;
    reject = onError;
  });
  return { promise, resolve, reject };
}

// Vue owns rendering and lifecycle. Only browser observers and Google's SDK are
// faked, so a missing v-if, wrong status, or unmount race changes the rendered tree.
async function mountFooter({ native = false, width = 320, fill = 'filled' } = {}) {
  const scripts = [];
  const intersections = [];
  const mutations = [];
  const requests = [];
  const timers = new Map();
  let observing = observerSignal();
  async function ready() {
    if (native) return Vue.nextTick();
    const deadline = setTimeout(() => observing.reject(new Error('Reader visibility observer was not registered')), 1000);
    try {
      await observing.promise;
    } finally {
      clearTimeout(deadline);
    }
  }
  function node(tag, text = '') {
    return {
      tag, text, children: [], props: {}, parent: null,
      getBoundingClientRect: () => ({ width }),
      getAttribute(name) { return this.props[name]; },
      closest: () => null,
    };
  }
  const root = node('root');
  const find = (tag, parent = root) => parent.tag === tag
    ? parent : parent.children.map(child => find(tag, child)).find(Boolean);
  const window = {
    isReactNativeWebView: native,
    adsbygoogle: {
      push() {
        const unit = find('ins');
        requests.push({ slot: unit.props['data-ad-slot'], nonPersonalized: this.requestNonPersonalizedAds });
        unit.props['data-ad-status'] = fill;
        for (const observer of mutations) if (!observer.disconnected) observer.callback();
      },
    },
  };
  const context = {
    module: { exports: {} }, exports: {}, window, console,
    require: name => { assert.equal(name, 'vue'); return Vue; },
    document: {
      createElement: () => ({}),
      head: { appendChild: script => scripts.push(script) },
    },
    setTimeout: callback => { const id = Symbol(); timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; intersections.push(this); }
      observe() { observing.resolve(); }
      disconnect() { this.disconnected = true; }
    },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; mutations.push(this); }
      observe() {}
      disconnect() { this.disconnected = true; }
    },
  };
  vm.runInNewContext(footerCode.code, context);
  const renderer = Vue.createRenderer({
    createElement: node, createText: text => node('#text', text),
    createComment: text => node('#comment', text),
    setText: (el, text) => { el.text = text; },
    setElementText: (el, text) => { el.text = text; },
    patchProp: (el, key, _old, value) => { el.props[key] = value; },
    insert(el, parent, anchor = null) {
      if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1);
      const index = anchor ? parent.children.indexOf(anchor) : parent.children.length;
      parent.children.splice(index, 0, el);
      el.parent = parent;
    },
    remove(el) {
      el.parent.children.splice(el.parent.children.indexOf(el), 1);
      el.parent = null;
    },
    parentNode: el => el.parent,
    nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1] ?? null,
    setScopeId() {},
  });
  const component = context.module.exports.default;
  renderer.render(Vue.h(component), root);
  await ready();
  return {
    scripts, requests, intersections, mutations, timers, find,
    enter: () => intersections[0].callback([{ isIntersecting: true }]),
    unmount: () => renderer.render(null, root),
    remount: async () => {
      observing = observerSignal();
      renderer.render(Vue.h(component), root);
      await ready();
    },
  };
}

test('reader slot is absent in a native WebView', async () => {
  const view = await mountFooter({ native: true });
  assert.equal(view.find('aside'), undefined);
  assert.equal(view.scripts.length, 0);
  view.unmount();
});

test('reader requests one non-personalized ad only upon intersection', async () => {
  const view = await mountFooter();
  assert.equal(view.scripts.length, 0);
  assert.ok(view.find('aside'));
  await view.intersections[0].callback([{ isIntersecting: false }]);
  assert.equal(view.scripts.length, 0);
  const loading = view.enter();
  assert.equal(view.scripts.length, 1);
  assert.equal(new URL(view.scripts[0].src).searchParams.get('client'), 'ca-pub-8742107706365412');
  view.scripts[0].onload();
  await loading;
  await view.enter();
  assert.deepEqual(view.requests, [{ slot: '1216284793', nonPersonalized: 1 }]);
  assert.equal(view.find('ins').props['data-ad-status'], 'filled');
  assert.ok(view.find('aside'), 'filled creatives stay visible');
  assert.equal(view.timers.size, 0);
  view.unmount();
});

test('blocked script collapses the slot without an ad request', async () => {
  const view = await mountFooter();
  const loading = view.enter();
  view.scripts[0].onerror();
  await loading;
  await Vue.nextTick();
  assert.equal(view.find('aside'), undefined);
  assert.equal(view.requests.length, 0);
  assert.equal(view.timers.size, 0);
  view.unmount();
});

test('unfilled result removes the label and ad space', async () => {
  const view = await mountFooter({ fill: 'unfilled' });
  const loading = view.enter();
  view.scripts[0].onload();
  await loading;
  await Vue.nextTick();
  assert.equal(view.find('aside'), undefined);
  assert.equal(view.mutations[0].disconnected, true);
  view.unmount();
});

test('leaving the reader before SDK load cannot request a detached ad', async () => {
  const view = await mountFooter();
  const loading = view.enter();
  view.unmount();
  view.scripts[0].onload();
  await loading;
  assert.equal(view.requests.length, 0);
  assert.equal(view.find('aside'), undefined);
  assert.equal(view.intersections[0].disconnected, true);
});

test('next chapter reuses the SDK instead of adding another script', async () => {
  const view = await mountFooter();
  const loading = view.enter();
  view.scripts[0].onload();
  await loading;
  view.unmount();
  await view.remount();
  await view.intersections[1].callback([{ isIntersecting: true }]);
  assert.equal(view.scripts.length, 1);
  assert.equal(view.requests.length, 2);
  view.unmount();
  assert.ok(view.mutations.every(observer => observer.disconnected));
});

test('container narrower than the supported ad width makes no request', async () => {
  const view = await mountFooter({ width: 119 });
  await view.enter();
  await Vue.nextTick();
  assert.equal(view.scripts.length, 0);
  assert.equal(view.find('aside'), undefined);
  view.unmount();
});

test('script load deadline removes empty space without fixed sleeps', async () => {
  const view = await mountFooter();
  const loading = view.enter();
  for (const callback of view.timers.values()) callback();
  await loading;
  await Vue.nextTick();
  assert.equal(view.find('aside'), undefined);
  assert.equal(view.requests.length, 0);
  assert.equal(view.timers.size, 0);
  view.unmount();
});
