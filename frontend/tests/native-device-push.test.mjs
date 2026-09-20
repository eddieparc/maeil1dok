import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';
import { build } from 'esbuild';

const originalWindow = globalThis.window;
const output = await build({
  stdin: {
    contents: "export * from './app/utils/devicePushRuntime'; export { syncNativePushRegistration } from './app/utils/nativePushRuntime';",
    resolveDir: new URL('../', import.meta.url).pathname,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  plugins: [{
    name: 'authenticated-api',
    setup(builder) {
      builder.onResolve({ filter: /^~\/composables\/useApi$/ }, () => ({
        path: 'api', namespace: 'fixture',
      }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
        contents: 'export const useApi = () => globalThis.__nativePushApi;',
      }));
    },
  }],
});
const runtime = await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);

afterEach(() => {
  globalThis.window = originalWindow;
  delete globalThis.__nativePushApi;
});

function shell({ permission = 'granted', token = 'ExpoPushToken[qa-device]' } = {}) {
  const messages = [];
  const target = new EventTarget();
  target.isReactNativeWebView = true;
  target.ReactNativeWebView = {
    postMessage(raw) {
      const message = JSON.parse(raw);
      messages.push(message);
      target.dispatchEvent(new CustomEvent('nativePushState', { detail: {
        requestId: message.requestId,
        permission,
        token,
        platform: 'ios',
        installationId: '4a27689b-0b9c-4c4e-b849-9bad38ca2dd9',
      } }));
    },
  };
  globalThis.window = target;
  return messages;
}

test('native device status uses the shell without browser PushManager or a permission prompt', async () => {
  const messages = shell();
  const requests = [];
  globalThis.__nativePushApi = {
    async POST(path, payload) {
      requests.push({ path, payload });
      return { success: true, registered: true, enabled: false };
    },
  };

  assert.equal(runtime.isDevicePushSupported(), true);
  assert.deepEqual(await runtime.readBrowserPushState(), {
    supported: true, permission: 'granted', subscribed: false,
  });
  assert.equal(messages[0].type, 'push:status');
  assert.equal(requests[0].path, '/api/v1/todos/notifications/push/native/status/');
});

test('enabling registers the native token with the authenticated API', async () => {
  const messages = shell();
  const requests = [];
  globalThis.__nativePushApi = {
    async POST(path, payload) {
      requests.push({ path, payload });
      return { success: true, enabled: true };
    },
  };

  await runtime.subscribeCurrentDevice();

  assert.equal(messages[0].type, 'push:enable');
  assert.deepEqual(requests, [{
    path: '/api/v1/todos/notifications/push/native/',
    payload: {
      token: 'ExpoPushToken[qa-device]',
      platform: 'ios',
      installation_id: '4a27689b-0b9c-4c4e-b849-9bad38ca2dd9',
    },
  }]);
});

test('denied permission never sends a token to the server', async () => {
  shell({ permission: 'denied', token: null });
  let calls = 0;
  globalThis.__nativePushApi = { async POST() { calls++; } };

  await assert.rejects(runtime.subscribeCurrentDevice());

  assert.equal(calls, 0);
});

test('disabling unregisters the current installation without web push APIs', async () => {
  const messages = shell();
  const requests = [];
  globalThis.__nativePushApi = {
    async DELETE(path, payload) {
      requests.push({ method: 'DELETE', path, payload });
      return { success: true, updated_count: 1 };
    },
    async POST(path, payload) {
      requests.push({ method: 'POST', path, payload });
      return { success: true, updated_count: 1 };
    },
  };

  await runtime.unsubscribeCurrentDevice();

  assert.equal(messages[0].type, 'push:disable');
  assert.deepEqual(requests, [{
    method: 'POST',
    path: '/api/v1/todos/notifications/push/native/remove/',
    payload: {
      token: 'ExpoPushToken[qa-device]',
      installation_id: '4a27689b-0b9c-4c4e-b849-9bad38ca2dd9',
    },
  }]);
});

test('background token sync preserves explicit opt-out', async () => {
  const messages = shell();
  const paths = [];
  globalThis.__nativePushApi = {
    async POST(path) {
      paths.push(path);
      return { success: true, registered: true, enabled: false };
    },
  };

  await runtime.syncNativePushRegistration(() => true);

  assert.deepEqual(paths, ['/api/v1/todos/notifications/push/native/status/']);
  assert.equal(messages[0].type, 'push:status');
});

test('permission revoked in OS settings removes the cached device registration', async () => {
  shell({ permission: 'denied' });
  const paths = [];
  globalThis.__nativePushApi = {
    async POST(path) {
      paths.push(path);
      return { success: true, updated_count: 1 };
    },
  };

  await runtime.syncNativePushRegistration(() => true);

  assert.deepEqual(paths, ['/api/v1/todos/notifications/push/native/remove/']);
});

test('a changed user during registration status prevents binding the old request', async () => {
  shell();
  let current = true;
  const paths = [];
  globalThis.__nativePushApi = {
    async POST(path) {
      paths.push(path);
      current = false;
      return { success: true, registered: false, enabled: false };
    },
  };

  await runtime.syncNativePushRegistration(() => current);

  assert.deepEqual(paths, ['/api/v1/todos/notifications/push/native/status/']);
});
