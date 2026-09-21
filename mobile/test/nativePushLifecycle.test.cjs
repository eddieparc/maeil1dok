const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadRuntime() {
  const filename = path.join(__dirname, '../nativePushLifecycle.ts');
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', compiled)(module, module.exports);
  return module.exports.createNativePushRuntime;
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

const device = {
  requestId: 'device',
  permission: 'granted',
  token: 'ExpoPushToken[fixture]',
  installationId: 'fixture-installation',
  platform: 'ios',
};
const response = value => ({ ok: true, status: 200, json: async () => value });

test('suspension drains an accepted registration before disabling transport', { timeout: 5000 }, async () => {
  const entered = deferred();
  const release = deferred();
  const calls = [];
  const runtime = loadRuntime()({
    readState: async () => device,
    apiFetch: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      if (url.endsWith('/native/')) {
        entered.resolve();
        await release.promise;
        return response({ success: true, enabled: true });
      }
      return response({ success: true, updated_count: 1 });
    },
  });
  const registration = runtime.sync();
  await entered.promise;
  const suspension = runtime.suspend();
  try {
    assert.equal(calls.length, 1);
    await assert.rejects(runtime.request('push:enable', 'late'));
  } finally {
    release.resolve();
  }
  await Promise.all([registration, suspension]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.explicit, false);
  assert.equal(calls[1].url, '/api/v1/todos/notifications/push/native/remove/');
  assert.equal(calls[1].body.opt_out, false);
});

test('suspension cancels token discovery before it can register', { timeout: 5000 }, async () => {
  const entered = deferred();
  const release = deferred();
  const calls = [];
  const runtime = loadRuntime()({
    readState: async action => {
      if (action === 'push:status') {
        entered.resolve();
        await release.promise;
      }
      return device;
    },
    apiFetch: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return response({ success: true, updated_count: 1 });
    },
  });
  const registration = runtime.sync();
  const rejected = assert.rejects(registration);
  await entered.promise;
  const suspension = runtime.suspend();
  release.resolve();
  await Promise.all([rejected, suspension]);
  assert.deepEqual(calls.map(call => call.url), ['/api/v1/todos/notifications/push/native/remove/']);
});

test('manual disable opts out while logout identity performs no API mutation', async () => {
  const calls = [];
  const runtime = loadRuntime()({
    readState: async () => device,
    apiFetch: async (url, init) => {
      calls.push(JSON.parse(init.body));
      return response({ success: true, updated_count: 1 });
    },
  });
  const identity = await runtime.request('push:identity', 'logout');
  assert.equal(identity.installationId, device.installationId);
  assert.deepEqual(calls, []);
  await runtime.request('push:disable', 'manual');
  assert.equal(calls[0].opt_out, true);
});

test('automatic registration preserves server opt-out and reports managed state', async () => {
  const calls = [];
  const runtime = loadRuntime()({
    readState: async () => device,
    apiFetch: async (url, init) => {
      calls.push(JSON.parse(init.body));
      return response({ success: true, enabled: false });
    },
  });
  const state = await runtime.sync();
  assert.equal(calls[0].explicit, false);
  assert.equal(state.managed, true);
  assert.equal(state.subscribed, false);
});

test('web logout preparation fences native writes without recording an opt-out', async () => {
  const calls = [];
  const runtime = loadRuntime()({
    readState: async () => device,
    apiFetch: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return response({ success: true, updated_count: 1 });
    },
  });
  const state = await runtime.request('push:logout', 'web-logout');
  assert.equal(state.installationId, device.installationId);
  assert.deepEqual(calls, [{
    url: '/api/v1/todos/notifications/push/native/remove/',
    body: { token: device.token, installation_id: device.installationId, opt_out: false },
  }]);
  await assert.rejects(runtime.sync());
});
