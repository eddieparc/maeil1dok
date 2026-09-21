import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import * as Vue from 'vue';

const require = createRequire(import.meta.url);

async function authRuntime() {
  const result = await build({
    entryPoints: [new URL('../app/composables/useAuthService.ts', import.meta.url).pathname],
    bundle: true, platform: 'node', format: 'cjs', write: false,
    external: ['vue', '~/stores/navigation'],
    plugins: [{
      name: 'navigation-boundary',
      setup(builder) {
        builder.onResolve({ filter: /^~\/stores\// }, ({ path }) => ({ path, external: true }));
      },
    }],
    define: { 'import.meta.client': 'true', 'import.meta.server': 'false' },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(
    name => name === '~/stores/navigation'
      ? { useNavigationStore: () => ({ clear() {} }) } : require(name),
    module, module.exports,
  );
  return module.exports.useAuthService;
}

for (const managed of [false, true]) {
test(`native logout preserves installation identity with managed=${managed}`, async t => {
  const storage = new Map();
  const states = new Map([
    ['auth:user', Vue.ref({ id: 42, username: 'reader', nickname: 'reader' })],
    ['auth:state', Vue.ref('authenticated')],
  ]);
  const calls = [];
  const window = new EventTarget();
  window.isReactNativeWebView = true;
  window.nativePushManaged = managed;
  const messages = [];
  window.ReactNativeWebView = {
    postMessage(raw) {
      const request = JSON.parse(raw);
      messages.push(request);
      window.dispatchEvent(new CustomEvent('nativePushState', { detail: {
        requestId: request.requestId, permission: 'granted',
        token: 'ExpoPushToken[logout-fixture]', platform: 'ios',
        installationId: '4a27689b-0b9c-4c4e-b849-9bad38ca2dd9',
        managed,
        subscribed: false,
        ...(request.type === 'push:status' ? { error: 'token-service-offline' } : {}),
      } }));
    },
  };
  for (const [key, value] of Object.entries({
    window,
    document: { cookie: '' },
    useState(key, init) {
      if (!states.has(key)) states.set(key, Vue.ref(init()));
      return states.get(key);
    },
    useRuntimeConfig: () => ({ public: { apiBase: 'https://api.example.test' } }),
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
  })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
    t.after(() => previous
      ? Object.defineProperty(globalThis, key, previous) : delete globalThis[key]);
  }
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({
      path: new URL(url).pathname,
      body: options.body ? JSON.parse(options.body) : null,
      userId: states.get('auth:user').value?.id,
      authenticated: states.get('auth:state').value === 'authenticated',
    });
    return Response.json({ success: true });
  });
  const useAuthService = await authRuntime();
  const auth = useAuthService();

  await auth.logout();

  assert.deepEqual(calls, [{
    path: '/api/v1/auth/logout/',
    body: { installation_id: '4a27689b-0b9c-4c4e-b849-9bad38ca2dd9' },
    userId: 42,
    authenticated: false,
  }]);
  assert.equal(auth.user.value, null);
  assert.equal(messages[0].type, managed ? 'push:logout' : 'push:disable');
});
}
