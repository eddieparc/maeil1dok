const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { instantiateClosure } = require('./helpers/appClosureHarness.cjs');

function compile(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  return {
    filename,
    output: ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
      },
    }).outputText,
  };
}

function load(relative, dependencies) {
  const { filename, output } = compile(relative);
  const instance = new Module(filename, module);
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const base = instance.require.bind(instance);
  instance.require = name => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    if (name === 'react' || name === 'react/jsx-runtime') return base(name);
    throw new Error(`Unexpected import: ${name}`);
  };
  instance._compile(`const __DEV__ = false;\n${output}`, filename);
  return instance.exports;
}

function shellMode(env) {
  const context = { exports: {}, process: { env } };
  vm.runInNewContext(compile('navigation/appShell.ts').output, context);
  return context.exports;
}

function rootHarness(env = {}) {
  function NativeRoot() {}
  function Standalone() {}
  function Login() {}
  const onReady = () => {};
  const Root = load('navigation/RootNavigator.tsx', {
    '@react-navigation/native': { NavigationContainer: 'NavigationContainer' },
    '@react-navigation/native-stack': {
      createNativeStackNavigator: () => ({ Navigator: 'StackNavigator', Screen: 'StackScreen' }),
    },
    './appShell': shellMode(env),
    './navigationRef': { navigationRef: {} },
    './NativeRootNavigator': NativeRoot,
    '../screens/StandaloneWebViewScreen': Standalone,
    '../screens/LoginScreen': Login,
  }).default;
  return { tree: Root({ onReady }), NativeRoot, Standalone, Login, onReady };
}

for (const env of [{}, { EXPO_PUBLIC_NATIVE_UI: 'false' }]) {
  test(`opens the full web shell without native navigation when native UI=${env.EXPO_PUBLIC_NATIVE_UI}`, () => {
    // Given: the release has no native opt-in.
    const { tree, Standalone, Login, onReady } = rootHarness(env);
    assert.equal(tree.type, 'NavigationContainer');
    // When: the root navigation tree is constructed.
    const stack = tree.props.children;
    const screens = React.Children.toArray(stack.props.children);
    // Then: web owns navigation and login returns to the same stack.
    assert.equal(tree.props.onReady, onReady);
    assert.equal(stack.props.initialRouteName, 'WebView');
    assert.deepEqual(screens.map(screen => screen.props.name), ['WebView', 'Login']);
    assert.equal(screens[0].props.component, Standalone);
    assert.equal(screens[1].props.component, Login);
    assert.equal(screens[1].props.options.presentation, 'fullScreenModal');
  });
}

test('retains the native navigator for explicitly opted-in local testing', () => {
  // Given: the native-parity test build opts in.
  const { tree, NativeRoot, onReady } = rootHarness({ EXPO_PUBLIC_NATIVE_UI: 'true' });
  // When/Then: the existing native navigator receives readiness unchanged.
  assert.equal(tree.type, NativeRoot);
  assert.equal(tree.props.onReady, onReady);
});

for (const nativeUI of [false, true]) {
  test(`login without a back stack returns to the correct shell when native UI=${nativeUI}`, () => {
    // Given: login was opened without a previous route.
    const resets = [];
    const dismiss = instantiateClosure('dismissLogin', {
      NATIVE_UI_ENABLED: nativeUI,
      tokenStore: {},
      navigation: { canGoBack: () => false },
      navigationRef: {
        isReady: () => true,
        reset: state => resets.push(state),
      },
    });
    // When: login completes.
    dismiss();
    // Then: the selected shell remains the root instead of entering the other UI.
    assert.deepEqual(resets, [{
      index: 0, routes: [{ name: nativeUI ? 'Main' : 'WebView' }],
    }]);
  });
}

test('the production profile explicitly prevents remote native opt-in', () => {
  // Given/When: resolve the actual machine-consumed release setting.
  const profiles = JSON.parse(fs.readFileSync(path.join(__dirname, '../eas.json'), 'utf8'));
  const mode = shellMode(profiles.build.production.env);
  // Then: a production build selects web rendering.
  assert.equal(mode.NATIVE_UI_ENABLED, false);
  assert.equal(profiles.build.production.env.EXPO_PUBLIC_NATIVE_UI, 'false');
});

function standaloneHarness({ url, isError = false } = {}) {
  const effects = [];
  const calls = [];
  const controller = {
    webViewKey: 1, webViewRef: { current: null }, isError,
    bundleIdentity: { channel: 'production', isEmbeddedLaunch: true },
  };
  for (const name of [
    'setWebViewMounted', 'queuePendingUrl', 'navigateToPendingUrl', 'handleLoad',
    'handleLoadEnd', 'consumePendingScript', 'handleError', 'handleHttpError',
    'handleRetry', 'handleNavigationStateChange', 'handleShouldStartLoadWithRequest', 'handleMessage',
  ]) controller[name] = value => { calls.push([name, value]); };
  const Screen = load('screens/StandaloneWebViewScreen.tsx', {
    react: {
      ...React, useEffect: effect => effects.push(effect), useRef: value => ({ current: value }),
    },
    'react-native': {
      ActivityIndicator: 'Spinner', Platform: { OS: 'ios' }, StatusBar: 'StatusBar',
      StyleSheet: {
        create: value => value,
        absoluteFillObject: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
      },
      Text: 'Text', View: 'View',
    },
    '@react-navigation/native': { useRoute: () => ({ params: { url } }) },
    'react-native-safe-area-context': {
      SafeAreaView: 'SafeAreaView',
      useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
    },
    'react-native-webview': { WebView: 'WebView' },
    '../navigation/AppStackContext': { useAppStack: () => ({ stack: { web: 'https://maeil1dok.app' } }) },
    '../components/ui/NativeButton': { NativeButton: 'NativeButton' },
    '../components/ui/tokens': {
      spacing: { lg: 20, md: 12 },
      useNativeColors: () => ({ background: '#FAF8F5', text: '#1F1A17', accent: '#2A1111' }),
    },
    './WebViewScreen': { useWebViewController: () => controller },
  }).default;
  const tree = Screen();
  const cleanups = effects.map(effect => effect());
  const children = React.Children.toArray(tree.props.children);
  return { tree, content: children[1], children, calls, cleanups };
}

test('renders one unwrapped live web page without a native feature preparation gate', () => {
  // Given/When: mount the standalone shell without a native reading-settings owner.
  const { children, content, calls } = standaloneHarness();
  // Then: no native return header or second navigation surface is inserted.
  assert.deepEqual(children.map(child => child.type), ['StatusBar', 'WebView']);
  assert.deepEqual(content.props.source, { uri: 'https://maeil1dok.app' });
  assert.equal(content.props.sharedCookiesEnabled, true);
  assert.deepEqual(calls, [['setWebViewMounted', true]]);
});

test('queues a cold deep link and flushes it through the existing controller', () => {
  // Given: a reader destination arrives before the embedded page finishes loading.
  const url = 'https://maeil1dok.app/bible?book=jhn&chapter=3';
  const { calls, cleanups } = standaloneHarness({ url });
  // When/Then: mount marks the actual view and preserves the entire destination.
  assert.deepEqual(calls, [
    ['setWebViewMounted', true], ['queuePendingUrl', url], ['navigateToPendingUrl', undefined],
  ]);
  cleanups[0]();
  assert.deepEqual(calls.at(-1), ['setWebViewMounted', false]);
});

test('preserves load completion and native message dispatch for authentication and push', () => {
  // Given: the shared controller owns native bridge behavior.
  const { content, calls } = standaloneHarness();
  const event = { nativeEvent: { url: 'https://maeil1dok.app/', data: '{"type":"requestPushToken"}' } };
  // When: the embedded document finishes loading and sends a native request.
  content.props.onLoadEnd(event);
  content.props.onMessage(event);
  // Then: the existing handlers receive both events in their required order.
  assert.deepEqual(calls.slice(1), [
    ['handleLoadEnd', event], ['consumePendingScript', undefined], ['handleMessage', event],
  ]);
});

test('keeps loading feedback over the web viewport instead of resizing it', () => {
  // Given: the embedded document is still loading.
  const { content } = standaloneHarness();
  // When: the WebView requests its loading surface.
  const loading = content.props.renderLoading();
  const style = Object.assign({}, ...loading.props.style);
  // Then: loading does not become another flex row beside the live web page.
  assert.equal(style.position, 'absolute');
  for (const edge of ['top', 'left', 'right', 'bottom']) assert.equal(style[edge], 0);
});

test('retries a failed web load without presenting native return controls', () => {
  // Given: the embedded page could not load.
  const { content, calls } = standaloneHarness({ isError: true });
  assert.deepEqual(calls, [['setWebViewMounted', false]]);
  const retry = React.Children.toArray(content.props.children).find(child => child.type === 'NativeButton');
  // When: the user selects retry.
  retry.props.onPress();
  // Then: the same controller reloads the web page.
  assert.deepEqual(calls.at(-1), ['handleRetry', undefined]);
});
