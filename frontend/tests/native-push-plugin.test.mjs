import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import * as Vue from 'vue';

const require = createRequire(import.meta.url);
const app = new URL('../app/', import.meta.url).pathname;

test('authenticated shell startup binds a granted installation without requesting permission', { timeout: 5000 }, async t => {
  const messages = [];
  const requests = [];
  const window = new EventTarget();
  window.isReactNativeWebView = true;
  window.ReactNativeWebView = {
    postMessage(raw) {
      const message = JSON.parse(raw);
      messages.push(message);
      if (message.type !== 'push:status') return;
      window.dispatchEvent(new CustomEvent('nativePushState', { detail: {
        requestId: message.requestId, permission: 'granted',
        token: 'ExpoPushToken[plugin-fixture]', platform: 'ios',
        installationId: '4a27689b-0b9c-4c4e-b849-9bad38ca2dd9',
      } }));
    },
  };
  let signal;
  const registered = new Promise(resolve => { signal = resolve; });
  const auth = { user: Vue.ref({ id: 42 }), isAuthenticated: Vue.ref(true) };
  const cleanup = [];
  t.after(() => cleanup.forEach(action => action()));
  for (const [key, value] of Object.entries({
    window, document: { addEventListener() {} },
    defineNuxtPlugin: value => value,
    __pushAuth: auth,
    __pushApi: { async POST(path, payload) {
      requests.push({ path, payload });
      if (path.endsWith('/status/')) return { success: true, registered: false, enabled: false };
      signal();
      return { success: true, enabled: true };
    } },
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
    t.after(() => previous
      ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]);
  }
  const result = await build({
    entryPoints: [resolve(app, 'plugins/native-app.client.ts')],
    bundle: true, write: false, format: 'cjs', platform: 'node',
    external: ['vue'],
    plugins: [{ name: 'nuxt-boundaries', setup(builder) {
      builder.onResolve({ filter: /^~\/composables\/(useApi|useAuthService)$/ }, ({ path }) => ({ path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
        contents: path.endsWith('useApi')
          ? 'export const useApi = () => globalThis.__pushApi;'
          : 'export const useAuthService = () => globalThis.__pushAuth;',
      }));
      builder.onResolve({ filter: /^~\// }, ({ path }) => ({ path: resolve(app, `${path.slice(2)}.ts`) }));
    } }],
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);

  module.exports.default.setup({
    runWithContext: action => action(),
    vueApp: { onUnmount: action => cleanup.push(action) },
  });
  assert.ok(messages.some(message => message.type === 'push:status'));
  await registered;

  assert.deepEqual(requests.map(request => request.path), [
    '/api/v1/todos/notifications/push/native/status/',
    '/api/v1/todos/notifications/push/native/',
  ]);
  assert.equal(messages.some(message => message.type === 'push:enable'), false);
  assert.equal(requests[1].payload.platform, 'ios');
});
