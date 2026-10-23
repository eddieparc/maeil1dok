const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const ts = require('typescript');

const response = (status, body = {}) => ({
  ok: status >= 200 && status < 300, status,
  json: async () => body, text: async () => JSON.stringify(body),
});
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

// Execute the real provider, API retry and token storage. Only native I/O,
// push delivery and the React host dispatcher are replaced.
function mount(fetchImpl, initialTokens) {
  const slots = [], cache = new Map(), listeners = new Set(), storage = new Map(), calls = [];
  let index = 0, queued = false, disposed = false, effects = [], value;
  const previousFetch = global.fetch;
  global.fetch = async (url, init) => {
    calls.push({ url, init });
    return fetchImpl(url, init);
  };
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((v, i) => !Object.is(v, b[i]));
  const schedule = () => {
    if (!queued && !disposed) {
      queued = true;
      queueMicrotask(render);
    }
  };
  const hooks = {
    ...React,
    useState(initial) {
      const i = index++;
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, next => {
        const result = typeof next === 'function' ? next(slots[i].value) : next;
        if (!Object.is(result, slots[i].value)) { slots[i].value = result; schedule(); }
      }];
    },
    useRef(initial) { return hooks.useMemo(() => ({ current: initial }), []); },
    useMemo(fn, deps) {
      const i = index++;
      if (changed(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() };
      return slots[i].value;
    },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const i = index++, old = slots[i];
      if (changed(old?.deps, deps)) {
        slots[i] = { deps, cleanup: old?.cleanup };
        effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
  };
  const stack = {
    stack: { api: 'https://api.test', web: 'https://web.test' }, betaMode: false,
    registerTransition: () => () => {},
  };
  const cookies = {
    get: async () => ({}), clearByName: async () => true, set: async () => true,
    setFromResponse: async () => true, flush: async () => true,
  };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const m = new Module(filename, module);
    m.filename = filename;
    m.paths = Module._nodeModulePaths(path.dirname(filename));
    m.require = name => {
      if (name === 'react') return hooks;
      if (name === 'react-native') return { Platform: { OS: 'ios' } };
      if (name === 'expo-secure-store') return {
        getItemAsync: async key => storage.get(key) ?? null,
        setItemAsync: async (key, next) => { storage.set(key, next); },
        deleteItemAsync: async key => { storage.delete(key); },
      };
      if (name === 'expo-constants') return { __esModule: true, default: { expoConfig: { version: '1.3.0' } } };
      if (name === '@react-native-cookies/cookies') return { __esModule: true, default: cookies };
      if (name.endsWith('/AppStackContext')) return { useAppStack: () => stack };
      if (name.endsWith('/nativePush')) return {
        getPushInstallationId: async () => 'installation', readNativePushState: async () => ({}),
      };
      if (name.endsWith('/nativePushLifecycle')) return {
        createNativePushRuntime: () => ({
          sync: async () => {}, suspend: async () => {}, resume: async () => {},
        }),
      };
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(filename), name);
        return load([`${target}.ts`, `${target}.tsx`].find(fs.existsSync));
      }
      return require(name);
    };
    m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, filename);
    cache.set(filename, m.exports);
    return m.exports;
  }
  const tokens = load(path.resolve(__dirname, '../api/authTokens.ts'));
  if (initialTokens) {
    storage.set(tokens.ACCESS_TOKEN_KEY, initialTokens.access);
    storage.set(tokens.REFRESH_TOKEN_KEY, initialTokens.refresh);
  }
  const Provider = load(path.resolve(__dirname, '../auth/AuthSession.tsx')).AuthSessionProvider;
  function render() {
    if (disposed) return;
    index = 0; queued = false;
    value = Provider({ children: null }).props.value;
    effects.splice(0).forEach(effect => effect());
    listeners.forEach(listener => listener());
  }
  render();
  return {
    calls,
    restoreSession: load(path.resolve(__dirname, '../sessionRestore.ts')).runStoredSessionRestore,
    get value() { return value; },
    stored: () => ({
      access: storage.get(tokens.ACCESS_TOKEN_KEY) ?? null,
      refresh: storage.get(tokens.REFRESH_TOKEN_KEY) ?? null,
    }),
    deleteRefresh: () => storage.delete(tokens.REFRESH_TOKEN_KEY),
    wait(predicate) {
      if (!queued && predicate()) return Promise.resolve();
      return new Promise(resolve => {
        const check = () => { if (!queued && predicate()) { listeners.delete(check); resolve(); } };
        listeners.add(check);
      });
    },
    dispose() {
      disposed = true;
      slots.forEach(slot => slot?.cleanup?.());
      global.fetch = previousFetch;
    },
  };
}

async function signIn(h) {
  await h.wait(() => h.value.status === 'signedOut');
  await h.value.signInWithTokens('A0', 'R0');
  await h.wait(() => h.value.status === 'signedIn');
}

test('parallel native 401 responses redeem a rotating refresh token only once', { timeout: 3000 }, async t => {
  const sent = deferred(), release = deferred(), validAccess = new Set();
  let activeRefresh = 'R0', rotations = 0;
  const h = mount(async (url, init) => {
    if (url.endsWith('/auth/refresh/')) {
      const refresh = JSON.parse(init.body).refresh;
      if (refresh !== activeRefresh) return response(401);
      rotations++;
      const pair = { access: `A${rotations}`, refresh: `R${rotations}` };
      activeRefresh = pair.refresh;
      validAccess.add(pair.access);
      sent.resolve();
      await release.promise;
      return response(200, pair);
    }
    return response(validAccess.has(init.headers.Authorization?.replace('Bearer ', '')) ? 200 : 401);
  });
  t.after(h.dispose);
  await signIn(h);
  const requests = [h.value.apiFetch('/first/'), h.value.apiFetch('/second/')];
  await sent.promise;
  release.resolve();
  const results = await Promise.allSettled(requests);
  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'fulfilled']);
  assert.equal(h.calls.filter(call => call.url.endsWith('/auth/refresh/')).length, 1);
  assert.equal(rotations, 1);
  assert.deepEqual(h.stored(), { access: 'A1', refresh: 'R1' });
});

test('definitively rejected native refresh ends the session and clears both tokens', { timeout: 3000 }, async t => {
  const h = mount(async () => response(401));
  t.after(h.dispose);
  await signIn(h);
  await assert.rejects(h.value.apiFetch('/private/'), { name: 'AuthExpiredError' });
  assert.equal(h.value.status, 'signedOut');
  assert.equal(h.value.accessToken, null);
  assert.deepEqual(h.stored(), { access: null, refresh: null });
});

test('missing native refresh cannot leave a signed-in shell retrying forever', { timeout: 3000 }, async t => {
  const h = mount(async () => response(401));
  t.after(h.dispose);
  await signIn(h);
  h.deleteRefresh();
  await assert.rejects(h.value.apiFetch('/private/'), { name: 'AuthExpiredError' });
  assert.equal(h.value.status, 'signedOut');
  assert.deepEqual(h.stored(), { access: null, refresh: null });
  assert.equal(h.calls.some(call => call.url.endsWith('/auth/refresh/')), false);
});

for (const failure of ['server', 'network']) {
  test(`${failure} refresh failure preserves the current native credentials`, { timeout: 3000 }, async t => {
    const h = mount(async url => {
      if (!url.endsWith('/auth/refresh/')) return response(401);
      if (failure === 'network') throw new Error('offline');
      return response(503);
    });
    t.after(h.dispose);
    await signIn(h);
    await assert.rejects(h.value.apiFetch('/private/'), { name: 'AuthExpiredError' });
    assert.equal(h.value.status, 'signedIn');
    assert.deepEqual(h.stored(), { access: 'A0', refresh: 'R0' });
  });
}

for (const status of [200, 401]) {
  test(`late ${status} refresh cannot overwrite or clear a newer sign-in`, { timeout: 3000 }, async t => {
    const sent = deferred(), result = deferred();
    const h = mount(async url => {
      if (!url.endsWith('/auth/refresh/')) return response(401);
      sent.resolve();
      return result.promise;
    });
    t.after(h.dispose);
    await signIn(h);
    const pending = h.value.apiFetch('/old-owner/').catch(error => error);
    await sent.promise;
    await h.value.signInWithTokens('Anew', 'Rnew');
    result.resolve(response(status, { access: 'Aold-rotated', refresh: 'Rold-rotated' }));
    await pending;
    assert.equal(h.value.status, 'signedIn');
    assert.equal(h.value.accessToken, 'Anew');
    assert.deepEqual(h.stored(), { access: 'Anew', refresh: 'Rnew' });
  });
}

test('bootstrap server failure preserves stored credentials for later recovery', { timeout: 3000 }, async t => {
  const h = mount(async () => response(503), { access: 'A0', refresh: 'R0' });
  t.after(h.dispose);
  await h.wait(() => h.value.status !== 'loading');
  assert.equal(h.value.status, 'signedOut');
  assert.deepEqual(h.stored(), { access: 'A0', refresh: 'R0' });
});

test('native API and WebView restore share the same rotating session owner', { timeout: 3000 }, async t => {
  const sent = deferred(), release = deferred();
  let rotations = 0, bridges = 0, navigations = 0;
  const h = mount(async (url, init) => {
    if (url.endsWith('/auth/refresh/')) {
      rotations++;
      if (rotations > 1 || JSON.parse(init.body).refresh !== 'R0') return response(401);
      sent.resolve();
      await release.promise;
      return response(200, { access: 'A1', refresh: 'R1' });
    }
    return response(init.headers.Authorization === 'Bearer A1' ? 200 : 401);
  });
  t.after(h.dispose);
  await signIn(h);
  const request = h.value.apiFetch('/private/');
  await sent.promise;
  const restore = h.restoreSession({
    refreshSession: h.value.refreshTokens,
    initiateSessionBridge: async (access, refresh) => {
      await h.value.signInWithTokens(access, refresh);
      bridges++;
      return true;
    },
    navigateToPendingUrl: () => { navigations++; },
    abandonRestore: () => false,
    reportError: error => { throw error; },
    isRestoreCurrent: () => true,
  });
  release.resolve();
  const [apiResult, restored] = await Promise.all([request, restore]);
  assert.equal(apiResult.status, 200);
  assert.equal(restored, true);
  assert.equal(rotations, 1);
  assert.equal(bridges, 1);
  assert.equal(navigations, 1);
  assert.deepEqual(h.stored(), { access: 'A1', refresh: 'R1' });
});

test('a late old-owner response cannot retry using a newer sign-in', { timeout: 3000 }, async t => {
  const sent = deferred(), release = deferred();
  const h = mount(async () => { sent.resolve(); return release.promise; });
  t.after(h.dispose);
  await signIn(h);
  const request = h.value.apiFetch('/private/').catch(error => error);
  await sent.promise;
  await h.value.signInWithTokens('Anew', 'Rnew');
  release.resolve(response(401));
  assert.equal((await request).name, 'AuthExpiredError');
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.stored(), { access: 'Anew', refresh: 'Rnew' });
});

test('a late logout response cannot clear a newer sign-in', { timeout: 3000 }, async t => {
  const sent = deferred(), release = deferred();
  const h = mount(async url => {
    if (url.endsWith('/auth/logout/')) { sent.resolve(); return release.promise; }
    return response(200);
  });
  t.after(h.dispose);
  await signIn(h);
  const logout = h.value.signOut();
  await sent.promise;
  await h.value.signInWithTokens('Anew', 'Rnew');
  release.resolve(response(200));
  await logout;
  assert.equal(h.value.status, 'signedIn');
  assert.equal(h.value.accessToken, 'Anew');
  assert.deepEqual(h.stored(), { access: 'Anew', refresh: 'Rnew' });
});
