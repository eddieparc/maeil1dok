const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');

function navigatorHarness(hasNativeTabBar, status = 'signedIn', width = 390) {
  const screens = {};
  const rootNavigations = [];
  const apiFetch = async () => { throw new Error('Navigation registration must not fetch'); };
  const api = 'https://api.example.test';
  const accessToken = `e30.${Buffer.from(JSON.stringify({ user_id: 42 })).toString('base64url')}.signature`;
  function ReadingSettingsProviderBoundary({ children }) { return children; }
  const native = {
    View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity',
    ActivityIndicator: 'ActivityIndicator',
    useWindowDimensions: () => ({ width }),
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
    './navigationRef': { navigationRef: { isReady: () => true, navigate: (...args) => rootNavigations.push(args) } },
    '../auth/AuthSession': { useAuth: () => ({ status, accessToken, apiFetch }) },
    './AppStackContext': { useAppStack: () => ({ stack: { api } }) },
    '../components/bible/ReadingSettingsProvider': { ReadingSettingsProvider: ReadingSettingsProviderBoundary },
    '../components/ui/tokens': {
      useNativeTheme: () => 'light',
      useNativeColors: () => ({ background: '#FAF8F5' }),
    },
    '../api/moreData': {},
    './NativeTabBar': { hasNativeTabBar, NativeTabBar: 'NativeTabBar' },
  };
  for (const [name, screen] of Object.entries(screens)) {
    dependencies[`../screens/${name}Screen`] = screen;
  }
  const Root = load('navigation/NativeRootNavigator.tsx', dependencies).default;
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
  return { tabs, stack, screens, rootNavigations };
}

for (const hasNativeTabBar of [true, false]) {
  test(`registers five native major screens with native bar available=${hasNativeTabBar}`, () => {
    const { tabs, screens } = navigatorHarness(hasNativeTabBar);
    const routes = React.Children.toArray(tabs.props.children);
    assert.deepEqual(routes.map(route => route.props.name), ['Home', 'Bible', 'Schedule', 'Together', 'Profile']);
    for (const route of routes) assert.equal(route.props.component, screens[route.props.name]);
  });
}

test('uses the shared native strip regardless of the previous iOS module availability', () => {
  const state = { index: 0, routes: ['Home', 'Bible', 'Schedule', 'Together', 'Profile'].map(name => ({ name, key: name })) };
  const navigation = {};
  for (const available of [true, false]) {
    const bar = navigatorHarness(available).tabs.props.tabBar({ state, navigation });
    assert.equal(bar.type, 'NativeTabBar');
    assert.equal(bar.props.state, state);
    assert.equal(bar.props.navigation, navigation);
  }
});

for (const [width, position] of [[1023, 'bottom'], [1024, 'left']]) {
  test(`keeps the five native screens in one navigator with ${position} navigation at ${width}`, () => {
    const { tabs, screens } = navigatorHarness(false, 'signedIn', width);
    assert.equal(tabs.type, 'TabNavigator');
    assert.equal(tabs.props.screenOptions.tabBarPosition, position);
    const routes = React.Children.toArray(tabs.props.children);
    assert.deepEqual(routes.map(route => route.props.name), ['Home', 'Bible', 'Schedule', 'Together', 'Profile']);
    for (const route of routes) assert.equal(route.props.component, screens[route.props.name]);
  });
}

test('preserves signed-out main tabs, auxiliary stack and auth loading gate', () => {
  const { stack, screens } = navigatorHarness(false, 'signedOut');
  assert.deepEqual(stack.map(node => node.props.name), ['Main', 'WebView', 'Login']);
  assert.equal(stack[1].props.component, screens.WebView);
  assert.equal(stack[2].props.component, screens.Login);
  assert.equal(stack[2].props.options.presentation, 'fullScreenModal');
  const { root } = navigatorHarness(false, 'loading');
  assert.equal(root.props.children.type, 'ActivityIndicator');
});

for (const width of [1023, 1024]) {
test(`guest profile opens login without switching the current page at ${width}`, () => {
  const h = navigatorHarness(false, 'signedOut', width);
  const profile = React.Children.toArray(h.tabs.props.children).find(node => node.props.name === 'Profile');
  let prevented = 0;
  profile.props.listeners.tabPress({ preventDefault: () => prevented++ });
  assert.equal(prevented, 1);
  assert.deepEqual(h.rootNavigations, [['Login']]);
});

test(`schedule opens the reader sheet only while a chapter is active at ${width}`, () => {
  const h = navigatorHarness(false, 'signedIn', width);
  const schedule = React.Children.toArray(h.tabs.props.children).find(node => node.props.name === 'Schedule');
  for (const [name, readerActive, expected] of [['Home', false, false], ['Bible', false, false], ['Bible', true, true]]) {
    const calls = [];
    let prevented = 0;
    const navigation = {
      getState: () => ({ index: 0, routes: [{ name, params: { url: '/bible?book=jhn&chapter=3', readerActive } }] }),
      navigate: (...args) => calls.push(args),
    };
    schedule.props.listeners({ navigation }).tabPress({ preventDefault: () => prevented++ });
    assert.equal(prevented, expected ? 1 : 0);
    assert.deepEqual(calls, expected ? [['Bible', {
      url: '/bible?book=jhn&chapter=3', readerActive: true, openSchedule: true,
    }]] : []);
  }
});
}
