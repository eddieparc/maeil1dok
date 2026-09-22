const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

test('Together consumes a new same-URL intent but preserves internal state on tab return', async () => {
  const slots = [];
  let cursor = 0;
  let pending = [];
  let model;
  let back;
  let focused = true;
  let focusCallback;
  let focusCleanup;
  let detailReads = 0;
  const jobs = [];
  const memo = (factory, deps) => {
    const index = cursor++;
    const previous = slots[index];
    if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
      slots[index] = { deps, value: factory() };
    }
    return slots[index].value;
  };
  const hooks = {
    useMemo: memo,
    useCallback: (fn, deps) => memo(() => fn, deps),
    useState: (initial) => memo(() => [initial, () => {}], []),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    useEffect(fn, deps) {
      memo(() => { pending.push(fn); }, deps);
    },
  };
  const auth = { status: 'signedIn', accessToken: 'fixture', apiFetch: async (url) => {
    const id = Number(url.split('/').filter(Boolean).at(-1));
    if (Number.isFinite(id)) detailReads++;
    return { ok: true, status: 200, json: async () => Number.isFinite(id)
      ? { success: true, group: { id, name: 'Group', description: '', creator: { id: 1, nickname: 'Owner', profile_image: null },
        plans: [], is_public: true, max_members: 20, member_count: 1, is_full: false,
        is_member: false, my_role: null, show_in_profile: true, created_at: '', updated_at: '' } }
      : { success: true, groups: [] } };
  } };
  function load(filename) {
    const instance = new Module(filename, module);
    instance.filename = filename;
    instance.paths = Module._nodeModulePaths(path.dirname(filename));
    instance.require = (name) => {
      if (name === 'react') return hooks;
      if (name === 'react-native') return { View: 'View', Text: 'Text', ScrollView: 'ScrollView',
        StyleSheet: { create: (s) => s }, BackHandler: { addEventListener: (_event, fn) => {
          back = fn; return { remove() { back = undefined; } };
        } } };
      if (name === '@react-navigation/native') return { useFocusEffect(fn) {
        if (fn !== focusCallback) {
          focusCleanup?.(); focusCallback = fn;
          focusCleanup = focused ? fn() : undefined;
        }
      } };
      if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0 }) };
      if (name.endsWith('/AuthSession')) return { useAuth: () => auth };
      if (name.endsWith('/navigationRef')) return { navigationRef: {} };
      if (name.endsWith('/NativeTabBar')) return { useNativeTabBarInset: () => 0 };
      if (name.endsWith('/tokens')) return { typography: {}, useNativeColors: () => ({}) };
      if (name.includes('/ui/') || name.includes('/Group')) return {};
      if (!name.startsWith('.')) return require(name);
      const base = path.resolve(path.dirname(filename), name);
      const exports = load([`${base}.ts`, `${base}.tsx`].find(fs.existsSync));
      if (name.endsWith('/TogetherModel')) {
        const ActualModel = exports.TogetherModel;
        return { TogetherModel: class extends ActualModel {
          constructor(...args) { super(...args); model = this; }
          openGroup(id) { const job = super.openGroup(id); jobs.push(job); return job; }
        } };
      }
      return exports;
    };
    instance._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
      fileName: filename,
    }).outputText, filename);
    return instance.exports;
  }
  const Screen = load(path.resolve(__dirname, '../screens/TogetherScreen.tsx')).default;
  const render = (params) => {
    cursor = 0;
    Screen({ route: { params } });
    const effects = pending; pending = [];
    effects.forEach((fn) => fn());
  };
  const settle = async () => { await Promise.all(jobs.splice(0)); };
  const first = { url: 'https://beta.example.test/groups/5' };
  render(first); await settle(); render(first);
  assert.equal(model.state.selectedId, 5);
  assert.equal(detailReads, 1);
  assert.equal(back(), true);
  render(first);
  assert.equal(model.state.selectedId, null);
  const repeated = { url: first.url };
  render(repeated); await settle(); render(repeated);
  assert.equal(model.state.selectedId, 5, 'new params with identical URL must reopen group');
  assert.equal(detailReads, 2);
  await model.openGroup(8); await settle(); render(repeated);
  focused = false; focusCleanup?.(); focusCleanup = undefined;
  focused = true; focusCleanup = focusCallback();
  render(repeated);
  assert.equal(model.state.selectedId, 8, 'ordinary tab return preserves locally selected group');
  assert.equal(detailReads, 3, 'renders and focus return must not refetch');
  const list = { url: '/groups' };
  render(list); render(list);
  assert.equal(model.state.selectedId, null);
  assert.equal(detailReads, 3);
  focusCleanup?.();
  model.dispose();
});
