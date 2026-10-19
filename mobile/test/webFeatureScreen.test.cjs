const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const vm = require('node:vm');

function mount(t, { prepare, apply } = {}) {
  const slots = [], effects = [], listeners = new Set(), cache = new Map();
  const scripts = [], actions = [], alerts = [];
  let cursor, dirty = false, disposed = false, tree, prevent, onRemove;
  const stack = { web: 'https://example.test', api: 'https://api.example.test' };
  const preferences = {
    sessionKey: 'account:https://api.example.test:7',
    settings: {}, prepareWebFeature: prepare ?? (async () => true),
    applyWebSettings: apply ?? (async () => true),
  };
  const controller = {
    webViewRef: { current: { injectJavaScript: script => scripts.push(script) } },
    setWebViewMounted() {}, queuePendingUrl() {}, navigateToPendingUrl() {},
    handleMessage() {}, bundleIdentity: {}, webViewKey: 1,
  };
  const schedule = () => {
    if (!dirty && !disposed) { dirty = true; queueMicrotask(render); }
  };
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((v, i) => v !== b[i]);
  const hooks = {
    ...React,
    useContext: () => controller,
    useId: () => 'entry-1',
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], next => {
        const value = typeof next === 'function' ? next(slots[i]) : next;
        if (!Object.is(slots[i], value)) { slots[i] = value; schedule(); }
      }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(fn, deps) {
      const i = cursor++;
      if (changed(slots[i]?.deps, deps)) effects.push(() => {
        slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
      });
    },
  };
  const navigation = {
    isReady: () => true, canGoBack: () => true,
    goBack() {
      const action = { type: 'GO_BACK' };
      if (prevent) onRemove({ data: { action } }); else actions.push(action);
    },
    dispatch: action => actions.push(action),
  };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const m = new Module(filename, module);
    m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename));
    m.require = name => {
      if (name === 'react') return hooks;
      if (name === 'react-native') return {
        ...Object.fromEntries(['View', 'Text', 'ActivityIndicator', 'StatusBar', 'TouchableOpacity'].map(x => [x, x])),
        Platform: { OS: 'ios' }, StyleSheet: { create: x => x, hairlineWidth: 1 },
        Alert: { alert: (...args) => alerts.push(args) },
      };
      if (name === 'react-native-webview') return { WebView: 'WebView' };
      if (name === 'react-native-safe-area-context') return {
        SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
      };
      if (name === '@react-navigation/native') return {
        useRoute: () => ({ params: {} }),
        usePreventRemove(flag, callback) { prevent = flag; onRemove = callback; },
      };
      if (name.endsWith('AppStackContext')) return { useAppStack: () => ({ stack }) };
      if (name.endsWith('ReadingSettingsProvider')) return { useReadingSettings: () => preferences };
      if (name.endsWith('navigationRef')) return { navigationRef: navigation };
      if (name.endsWith('NativeButton')) return { NativeButton: 'NativeButton' };
      if (name.endsWith('/tokens')) return { spacing: {}, useNativeColors: () => ({}) };
      if (name.endsWith('clientObservationHeaders')) return { buildNativeClientObservationHeaders: () => ({}) };
      if (name.endsWith('nativePush')) return {
        isPushBridgeOrigin: (url, origin) => { try { return new URL(url).origin === new URL(origin).origin; } catch { return false; } },
      };
      if (name.endsWith('nativeWebFeatureBridge')) {
        return load(path.resolve(path.dirname(filename), name + '.ts'));
      }
      if (name === 'expo-constants') return { __esModule: true, default: {} };
      if (name.startsWith('.') || name.startsWith('expo-') || name.startsWith('@react-native')) return {};
      return require(name);
    };
    m._compile('const __DEV__ = false;\n' + ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, filename);
    cache.set(filename, m.exports);
    return m.exports;
  }
  const Screen = load(path.resolve(__dirname, '../screens/WebViewScreen.tsx')).default;
  const nodes = el => React.isValidElement(el)
    ? [el, ...React.Children.toArray(el.props.children).flatMap(nodes)] : [];
  function render() {
    if (disposed) return;
    dirty = false; cursor = 0; tree = nodes(Screen());
    effects.splice(0).forEach(fn => fn());
    listeners.forEach(fn => fn());
  }
  render();
  t.after(() => { disposed = true; slots.forEach(slot => slot?.cleanup?.()); });
  return {
    scripts, actions, alerts, preferences, render,
    web: () => tree.find(node => node.type === 'WebView'),
    back: () => tree.find(node => node.type === 'NativeButton').props.onPress(),
    wait(predicate) {
      if (!dirty && predicate()) return Promise.resolve();
      return new Promise(resolve => {
        const check = () => { if (!dirty && predicate()) { listeners.delete(check); resolve(); } };
        listeners.add(check);
      });
    },
    context() {
      const window = { location: { origin: stack.web } };
      vm.runInNewContext(this.web().props.injectedJavaScriptBeforeContentLoaded, { window });
      return window.__maeilNativeFeatureContext;
    },
    requestId() {
      let id;
      vm.runInNewContext(scripts.at(-1), { window: { __maeilPrepareNativeReturn: value => { id = value; } } });
      return id;
    },
    reply(message, url = stack.web + '/bible') {
      this.web().props.onMessage({ nativeEvent: { url, data: JSON.stringify(message) } });
    },
  };
}

test('web content waits for native settings preparation and retains an available return', { timeout: 2500 }, async t => {
  let prepared;
  const h = mount(t, { prepare: () => new Promise(resolve => { prepared = resolve; }) });
  assert.equal(h.web(), undefined);
  prepared(true);
  await h.wait(() => h.web());
  assert.equal(h.context().userId, '7');
  h.back();
  assert.equal(h.actions.length, 0);
  assert.ok(h.requestId());
});

test('native return requires matching origin, scope, owner and settings persistence', { timeout: 2500 }, async t => {
  let finish;
  const applied = [];
  const h = mount(t, { apply: (key, settings) => {
    applied.push({ key, settings });
    return new Promise(resolve => { finish = resolve; });
  } });
  await h.wait(() => h.web());
  h.back();
  const reply = {
    type: 'native-feature:return', scope: h.context().scope,
    requestId: h.requestId(), ok: true, userId: '7', settings: { fontSize: 23 },
  };
  h.reply(reply, 'https://foreign.example/bible');
  h.reply({ ...reply, scope: 'old-entry' });
  assert.equal(applied.length, 0);
  h.reply(reply);
  assert.deepEqual(applied, [{ key: h.preferences.sessionKey, settings: { fontSize: 23 } }]);
  assert.equal(h.actions.length, 0);
  finish(true);
  await h.wait(() => h.actions.length === 1);
});

test('failed web save offers retry without silently discarding preferences', { timeout: 2500 }, async t => {
  const h = mount(t);
  await h.wait(() => h.web());
  h.back();
  h.reply({
    type: 'native-feature:return', scope: h.context().scope,
    requestId: h.requestId(), ok: false,
  });
  assert.equal(h.actions.length, 0);
  assert.equal(h.alerts.length, 1);
  h.alerts[0][2][1].onPress();
  assert.equal(h.scripts.length, 2);
});

test('an editor decision pauses the machine deadline and cancellation leaves the web screen open', { timeout: 2500 }, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = mount(t);
  await h.wait(() => h.web());
  h.back();
  const request = { scope: h.context().scope, requestId: h.requestId() };
  h.reply({ type: 'native-feature:confirming', ...request });
  t.mock.timers.tick(30000);
  assert.equal(h.alerts.length, 0);
  assert.equal(h.actions.length, 0);
  h.reply({ type: 'native-feature:cancelled', ...request });
  await h.wait(() => h.web());
  h.back();
  assert.equal(h.scripts.length, 2);
  h.reply({ type: 'native-feature:return', scope: h.context().scope,
    requestId: h.requestId(), ok: true, userId: '7', settings: {} });
  await h.wait(() => h.actions.length === 1);
});

test('confirmed editor return resumes the deadline while the web save is pending', { timeout: 2500 }, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = mount(t);
  await h.wait(() => h.web());
  h.back();
  let decide, save, enteredSave, ready;
  const decision = new Promise(resolve => { decide = resolve; });
  const saving = new Promise(resolve => { save = resolve; });
  const saveStarted = new Promise(resolve => { enteredSave = resolve; });
  const auth = {
    isAuthenticated: { value: true }, user: { value: { id: 7 } },
    isInitialized: { value: true }, isLoading: { value: false },
    isSessionUnknown: { value: false }, initialize: async () => {},
  };
  const store = {
    settings: {}, initialize: async () => {},
    flushPending: () => { enteredSave(); return saving; },
  };
  const webWindow = {
    __maeilNativeFeatureContext: h.context(),
    __maeilConfirmNativeReturn: () => decision,
    ReactNativeWebView: { postMessage: data => h.reply(JSON.parse(data)) },
  };
  const plugin = { exports: {} };
  const source = fs.readFileSync(path.resolve(__dirname, '../../frontend/app/plugins/native-feature.client.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', 'defineNuxtPlugin', 'onNuxtReady', 'window', compiled)(
    name => {
      if (name.endsWith('useAuthService')) return { useAuthService: () => auth };
      if (name.endsWith('readingSettings')) return { useReadingSettingsStore: () => store };
      throw new Error(`Unexpected plugin dependency: ${name}`);
    },
    plugin, plugin.exports, value => value, callback => { ready = callback; }, webWindow,
  );
  plugin.exports.default.setup({ runWithContext: action => action(), vueApp: { onUnmount() {} } });
  await ready();
  const returning = webWindow.__maeilPrepareNativeReturn(h.requestId());
  t.mock.timers.tick(30000);
  assert.equal(h.alerts.length, 0);
  decide(true);
  await saveStarted;
  t.mock.timers.tick(15000);
  assert.equal(h.alerts.length, 1);
  assert.equal(h.actions.length, 0);
  save(true);
  await returning;
  assert.equal(h.actions.length, 0, 'late save acknowledgement cannot exit after recovery');
  h.alerts[0][2][2].onPress();
  assert.equal(h.actions.length, 1);
});

test('account change invalidates a pending return acknowledgement', { timeout: 2500 }, async t => {
  let finish;
  const h = mount(t, { apply: () => new Promise(resolve => { finish = resolve; }) });
  await h.wait(() => h.web());
  h.back();
  h.reply({
    type: 'native-feature:return', scope: h.context().scope,
    requestId: h.requestId(), ok: true, userId: '7', settings: {},
  });
  h.preferences.sessionKey = 'account:https://api.example.test:8';
  h.render();
  finish(true);
  await h.wait(() => h.web());
  assert.equal(h.actions.length, 0);
  assert.equal(h.context().userId, '8');
});

test('a page without a return acknowledgement has a bounded recovery and explicit unsaved exit', { timeout: 2500 }, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const h = mount(t);
  await h.wait(() => h.web());
  h.back();
  t.mock.timers.tick(15000);
  assert.equal(h.alerts.length, 1);
  assert.equal(h.actions.length, 0);
  h.alerts[0][2][2].onPress();
  assert.equal(h.actions.length, 1);
});
