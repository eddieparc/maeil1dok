const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');

const profile = id => ({
  id, user: { id, username: `user${id}`, nickname: `reader${id}`, profile_image: null },
  bio: '', total_completed_days: 1, current_streak: 1, longest_streak: 1,
  joined_date: '2026-01-01', is_public: true, followers_count: 0, following_count: 0,
  is_following: false, is_mutual_follow: false,
});
const response = body => ({ ok: true, status: 200, json: async () => body });
const wrapped = data => response({ success: true, data });
function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

// Execute the actual screen with a deterministic hook boundary. This verifies
// route/controller/navigation wiring, not React or a native renderer's lifecycle.
function screenHarness(status = 'signedIn', api) {
  const calls = [], navigations = [];
  const auth = { status, accessToken: status === 'signedIn' ? 'token-A' : null,
    apiFetch: async (p, init) => {
      calls.push(p);
      if (api) return api(p, init);
      if (p.endsWith('/user/')) return response({ id: 7 });
      if (p.includes('/calendar/')) return wrapped({ calendar: [], plans: [] });
      const id = Number(p.split('/').at(-2));
      return wrapped({ profile: profile(id) });
    } };
  const stack = { api: 'https://api.example.test', web: 'https://beta.example.test' };
  let cursor = 0, effectCursor = 0, store, getSnapshot;
  const memos = [], effects = [], queued = [];
  const same = (a, b) => a && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const hooks = {
    ...React,
    useMemo(factory, deps) {
      const i = cursor++;
      if (!memos[i] || !same(memos[i].deps, deps)) memos[i] = { deps, value: factory() };
      return memos[i].value;
    },
    useEffect(effect, deps) {
      const i = effectCursor++;
      if (!effects[i] || !same(effects[i].deps, deps)) {
        queued.push(() => {
          effects[i]?.cleanup?.();
          effects[i] = { deps, cleanup: effect() };
        });
      }
    },
    useSyncExternalStore(subscribe, snapshot) {
      store = subscribe;
      getSnapshot = snapshot;
      return snapshot();
    },
  };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const instance = new Module(filename, module);
    instance.paths = Module._nodeModulePaths(path.dirname(filename));
    const base = instance.require.bind(instance);
    instance.require = name => {
      if (name === 'react') return hooks;
      if (name === 'react-native') return {
        View: 'View', Text: 'Text', Share: { share: async () => {} }, StyleSheet: { create: v => v },
      };
      if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
      if (name.endsWith('/AuthSession')) return { useAuth: () => auth };
      if (name.endsWith('/AppStackContext')) return { useAppStack: () => ({ stack }) };
      if (name.endsWith('/NativeTabBar')) return { useNativeTabBarInset: () => 0 };
      if (name.endsWith('/navigationRef')) return { navigationRef: {
        isReady: () => true, navigate: (...args) => navigations.push(args),
      } };
      if (name.endsWith('/ProfileView')) return { ProfileView: 'ProfileView' };
      if (name.endsWith('/tokens')) return { spacing: {}, typography: {}, useNativeColors: () => ({}) };
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(filename), name);
        const file = [`${target}.ts`, `${target}.tsx`].find(fs.existsSync);
        if (file) return load(file);
      }
      return base(name);
    };
    instance._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, filename);
    cache.set(filename, instance.exports);
    return instance.exports;
  }
  const Screen = load(path.resolve(__dirname, '../screens/ProfileScreen.tsx')).default;
  return {
    auth, stack, calls, navigations,
    render(url) {
      cursor = 0;
      effectCursor = 0;
      const tree = Screen({ route: { params: url === undefined ? undefined : { url } } });
      return React.Children.toArray(tree.props.children).find(child => child.type === 'ProfileView').props;
    },
    commit() { queued.splice(0).forEach(effect => effect()); },
    until(predicate) {
      if (predicate(getSnapshot())) return Promise.resolve();
      return new Promise(resolve => {
        const unsubscribe = store(() => {
          if (predicate(getSnapshot())) { unsubscribe(); resolve(); }
        });
      });
    },
    snapshot: () => getSnapshot(),
    dispose() { effects.forEach(effect => effect?.cleanup?.()); },
  };
}

test('actual screen consumes relative/absolute B URL and routes people/groups to native tabs', { timeout: 2000 }, async () => {
  const h = screenHarness();
  try {
    h.render('https://beta.example.test/profile/8?from=people');
    const ready = h.until(s => s.kind === 'ready' && s.calendar.kind === 'ready');
    h.commit();
    await ready;
    const view = h.render('/profile/8');
    assert.equal(view.state.profile.user.id, 8);
    assert.equal(view.state.isOwnProfile, false);
    view.onProfile(9);
    view.onGroups('/groups/5');
    view.onGroups('/groups');
    assert.deepEqual(h.navigations, [
      ['Main', { screen: 'Profile', params: { url: 'https://beta.example.test/profile/9' } }],
      ['Main', { screen: 'Together', params: { url: 'https://beta.example.test/groups/5' } }],
      ['Main', { screen: 'Together', params: { url: 'https://beta.example.test/groups' } }],
    ]);
    assert.equal(h.calls.includes('/api/v1/auth/profile/7/'), false);
  } finally { h.dispose(); }
});

test('actual screen guest target works; no target requires login; own target can edit', { timeout: 2000 }, async () => {
  for (const [status, url, kind, own] of [
    ['signedOut', '/profile/8', 'ready', false],
    ['signedOut', undefined, 'guest', false],
    ['signedIn', undefined, 'ready', true],
    ['signedIn', '/profile/7', 'ready', true],
  ]) {
    const h = screenHarness(status);
    try {
      h.render(url);
      const ready = h.until(s => s.kind === kind && (kind !== 'ready' || s.calendar.kind === 'ready'));
      h.commit();
      await ready;
      const { state, controller } = h.render(url);
      assert.equal(state.kind, kind);
      if (kind === 'ready') {
        assert.equal(state.isOwnProfile, own);
        controller.openEdit();
        assert.equal(h.snapshot().editor !== null, own);
      }
      if (status === 'signedOut') assert.equal(h.calls.includes('/api/v1/auth/user/'), false);
    } finally { h.dispose(); }
  }
});

test('target, token and API stack changes synchronously replace the screen snapshot', { timeout: 2000 }, async () => {
  const old = deferred(), requested = deferred();
  const h = screenHarness('signedIn', async p => {
    if (p.endsWith('/user/')) return response({ id: 7 });
    if (p.endsWith('/profile/8/')) { requested.resolve(); return old.promise; }
    if (p.includes('/calendar/')) return wrapped({ calendar: [], plans: [] });
    return wrapped({ profile: profile(9) });
  });
  try {
    h.render('/profile/8');
    h.commit();
    await requested.promise;
    assert.equal(h.render('/profile/9').state.kind, 'loading');
    const ready = h.until(s => s.kind === 'ready' && s.calendar.kind === 'ready');
    h.commit();
    await ready;
    old.resolve(wrapped({ profile: profile(8) }));
    assert.equal(h.render('/profile/9').state.profile.user.id, 9);
    h.auth.accessToken = 'token-C';
    assert.equal(h.render('/profile/9').state.kind, 'loading');
    h.commit();
    await h.until(s => s.kind === 'ready' && s.calendar.kind === 'ready');
    h.stack.api = 'https://other-api.example.test';
    assert.equal(h.render('/profile/9').state.kind, 'loading');
    h.commit();
    await h.until(s => s.kind === 'ready' && s.calendar.kind === 'ready');
  } finally { h.dispose(); }
});
