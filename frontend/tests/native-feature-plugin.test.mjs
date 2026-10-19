import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { ref } from 'vue';
import { runtime, setup } from './helpers/reading-settings-harness.mjs';

const require = createRequire(import.meta.url);
const compiled = await build({
  entryPoints: [new URL('../app/plugins/native-feature.client.ts', import.meta.url).pathname],
  bundle: true, write: false, format: 'cjs', platform: 'node',
  plugins: [{ name: 'native-feature-boundaries', setup(b) {
    b.onResolve({ filter: /^~\// }, ({ path }) => ({ path, namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
      contents: path.includes('useAuthService')
        ? 'export const useAuthService = () => globalThis.__readingRecovery.auth;'
        : 'export const useReadingSettingsStore = () => globalThis.__featureStore;',
    }));
  } }],
});

async function mount(t, userId = '7') {
  const h = setup(t);
  Object.assign(runtime.auth, {
    isInitialized: ref(true), isLoading: ref(false), isSessionUnknown: ref(false),
    initialize: async () => {},
  });
  const store = h.fresh();
  const messages = [];
  window.__maeilNativeFeatureContext = { scope: 'fixture-entry', userId };
  window.ReactNativeWebView = { postMessage: raw => messages.push(JSON.parse(raw)) };
  let ready;
  const cleanups = [];
  for (const [key, value] of Object.entries({
    defineNuxtPlugin: value => value,
    onNuxtReady: callback => { ready = callback; },
    __featureStore: store,
  })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    t.after(() => old ? Object.defineProperty(globalThis, key, old) : delete globalThis[key]);
  }
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputFiles[0].text)(
    require, loaded, loaded.exports,
  );
  loaded.exports.default.setup({
    runWithContext: action => action(),
    vueApp: { onUnmount: action => cleanups.push(action) },
  });
  await ready();
  return { ...h, store, messages, unmount: () => cleanups.forEach(action => action()) };
}

test('actual web return handler flushes settings before acknowledging the native owner', async t => {
  const h = await mount(t);
  h.store.updateSetting('fontSize', 24);
  await window.__maeilPrepareNativeReturn('close-1');
  assert.equal(h.server.font_size, 24);
  assert.deepEqual(h.messages.map(message => message.type), [
    'native-feature:ready', 'native-feature:return',
  ]);
  assert.equal(h.messages[1].ok, true);
  assert.equal(h.messages[1].userId, '7');
  assert.equal(h.messages[1].settings.fontSize, 24);
  assert.equal(h.messages[1].requestId, 'close-1');
});

test('failed persistence cannot acknowledge a successful native return', async t => {
  const h = await mount(t);
  runtime.api.PATCH = async () => { throw new Error('offline fixture'); };
  h.store.updateSetting('fontSize', 23);
  await window.__maeilPrepareNativeReturn('close-2');
  assert.equal(h.messages.at(-1).ok, false);
  assert.equal(h.store.settings.fontSize, 23);
});

test('native return waits for the editor decision and cancellation keeps the document open', async t => {
  const h = await mount(t);
  let decide;
  window.__maeilConfirmNativeReturn = () => new Promise(resolve => { decide = resolve; });
  const closing = window.__maeilPrepareNativeReturn('draft-close');
  assert.equal(h.messages.at(-1).type, 'native-feature:confirming');
  decide(false);
  await closing;
  assert.equal(h.messages.at(-1).type, 'native-feature:cancelled');
  assert.equal(h.messages.some(message => message.ok === true), false);
  window.__maeilConfirmNativeReturn = async () => true;
  await window.__maeilPrepareNativeReturn('discard-close');
  assert.equal(h.messages.at(-1).ok, true);
});

test('unknown auth and a changed owner cannot expose a settings snapshot', async t => {
  const h = await mount(t);
  runtime.auth.isSessionUnknown.value = true;
  await window.__maeilPrepareNativeReturn('unknown');
  assert.equal(h.messages.at(-1).ok, false);
  runtime.auth.isSessionUnknown.value = false;
  runtime.auth.user.value = { id: 8 };
  await window.__maeilPrepareNativeReturn('other-owner');
  assert.equal(h.messages.at(-1).ok, false);
  assert.equal('settings' in h.messages.at(-1), false);
});

test('a document torn down during a write cannot send a stale acknowledgement', async t => {
  const h = await mount(t);
  let acknowledge;
  const write = new Promise(resolve => { acknowledge = resolve; });
  runtime.api.PATCH = async () => { await write; return { success: true }; };
  h.store.updateSetting('fontSize', 22);
  const closing = window.__maeilPrepareNativeReturn('old-document');
  h.unmount();
  acknowledge();
  await closing;
  assert.equal(h.messages.length, 1);
  assert.equal(window.__maeilPrepareNativeReturn, undefined);
});
