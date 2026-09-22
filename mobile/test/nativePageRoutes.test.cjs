const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');

function navigatorHarness(hasNativeTabBar, status = 'signedIn') {
  const screens = {};
  const apiFetch = async () => { throw new Error('Navigation registration must not fetch'); };
  const api = 'https://api.example.test';
  const accessToken = `e30.${Buffer.from(JSON.stringify({ user_id: 42 })).toString('base64url')}.signature`;
  function ReadingSettingsProviderBoundary({ children }) { return children; }
  const native = {
    View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity',
    ActivityIndicator: 'ActivityIndicator',
    StyleSheet: { create: value => value, hairlineWidth: 1 },
  };
  function load(relative, dependencies) {
    const filename = path.resolve(__dirname, '..', relative);
    const instance = new Module(filename, module);
    instance.paths = Module._nodeModulePaths(path.dirname(filename));
    const base = instance.require.bind(instance);
    instance.require = name => {
      if (name === 'react' || name === 'react/jsx-runtime') return base(name);
      if (name === 'react-native') return native;
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error(`Unexpected import: ${name}`);
    };
    instance._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
      },
    }).outputText, filename);
    return instance.exports;
  }
  // Load real producer exports; their feature behavior is covered by producer tests.
  for (const name of ['Together', 'Profile']) {
    const filename = path.resolve(__dirname, '..', 'screens', `${name}Screen.tsx`);
    const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
    const dependencies = {};
    for (const statement of source.statements) {
      if (ts.isImportDeclaration(statement)) dependencies[statement.moduleSpecifier.text] = {};
    }
    dependencies['../components/ui/tokens'] = { spacing: { lg: 20, md: 12 } };
    screens[name] = load(`screens/${name}Screen.tsx`, dependencies).default;
    assert.equal(typeof screens[name], 'function', `${name} must export a real screen`);
  }
  for (const name of ['Home', 'Bible', 'Schedule', 'WebView', 'WebViewTab', 'Login']) {
    screens[name] = function ScreenBoundary() {};
  }
  const dependencies = {
    '@expo/vector-icons/Ionicons': 'Icon',
    '@react-navigation/native': { NavigationContainer: 'NavigationContainer' },
    '@react-navigation/bottom-tabs': {
      createBottomTabNavigator: () => ({ Navigator: 'TabNavigator', Screen: 'TabScreen' }),
    },
    '@react-navigation/native-stack': {
      createNativeStackNavigator: () => ({ Navigator: 'StackNavigator', Screen: 'StackScreen' }),
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 24 }) },
    './navigationRef': { navigationRef: {} },
    '../auth/AuthSession': { useAuth: () => ({ status, accessToken, apiFetch }) },
    './AppStackContext': { useAppStack: () => ({ stack: { api } }) },
    '../components/bible/ReadingSettingsProvider': { ReadingSettingsProvider: ReadingSettingsProviderBoundary },
    '../api/moreData': {},
    './NativeTabBar': { hasNativeTabBar, NativeTabBar: 'NativeTabBar' },
  };
  for (const [name, screen] of Object.entries(screens)) {
    dependencies[`../screens/${name}Screen`] = screen;
  }
  const Root = load('navigation/RootNavigator.tsx', dependencies).default;
  const root = Root();
  if (status === 'loading') return { root };
  assert.equal(root.type, ReadingSettingsProviderBoundary);
  assert.deepEqual(root.props.session, status === 'signedOut'
    ? { key: `guest:${api}`, apiFetch: null }
    : { key: `account:${api}:42`, apiFetch });
  const navigation = React.Children.toArray(root.type(root.props))
    .find(node => node.type === 'NavigationContainer');
  assert.ok(navigation, 'Provider must wrap the actual navigation tree');
  const stack = React.Children.toArray(navigation.props.children.props.children);
  const tabs = stack.find(node => node.props.name === 'Main').props.component();
  return { tabs, stack, screens };
}

for (const hasNativeTabBar of [true, false]) {
  test(`registers five native major screens with native bar available=${hasNativeTabBar}`, () => {
    const { tabs, screens } = navigatorHarness(hasNativeTabBar);
    const routes = React.Children.toArray(tabs.props.children);
    assert.deepEqual(routes.map(route => route.props.name), ['Home', 'Bible', 'Schedule', 'Together', 'Profile']);
    for (const route of routes) assert.equal(route.props.component, screens[route.props.name]);
  });
}

test('keeps Liquid Glass selection and the five-button Android fallback', () => {
  const native = navigatorHarness(true).tabs.props.tabBar({});
  assert.equal(native.type, 'NativeTabBar');
  const { tabs } = navigatorHarness(false);
  const state = { index: 0, routes: ['Home', 'Bible', 'Schedule', 'Together', 'Profile'].map(name => ({ name, key: name })) };
  const calls = [];
  const navigation = { emit: () => ({ defaultPrevented: false }), navigate: name => calls.push(name) };
  const fallback = tabs.props.tabBar({ state, navigation });
  const buttons = React.Children.toArray(fallback.type(fallback.props).props.children);
  assert.equal(buttons.length, 5);
  buttons[3].props.onPress();
  buttons[4].props.onPress();
  assert.deepEqual(calls, ['Together', 'Profile']);
});

test('preserves signed-out main tabs, auxiliary stack and auth loading gate', () => {
  const { stack, screens } = navigatorHarness(false, 'signedOut');
  assert.deepEqual(stack.map(node => node.props.name), ['Main', 'WebView', 'Login']);
  assert.equal(stack[1].props.component, screens.WebView);
  assert.equal(stack[2].props.component, screens.Login);
  assert.equal(stack[2].props.options.presentation, 'fullScreenModal');
  const { root } = navigatorHarness(false, 'loading');
  assert.equal(root.props.children.type, 'ActivityIndicator');
});
