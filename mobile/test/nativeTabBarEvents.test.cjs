const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');

function mount(preventDefault = false, readerActive = true, width = 390, theme = 'light') {
  const webNavigated = [];
  function load(file) {
  const filename = path.resolve(__dirname, '../navigation', file);
  const instance = new Module(filename, module);
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const base = instance.require.bind(instance);
  instance.require = name => {
    if (name === 'react/jsx-runtime') return base(name);
    if (name === 'react') return { useCallback: fn => fn, useState: initial => [initial, () => {}] };
    if (name === './NativeSidebar') return load('NativeSidebar.tsx');
    if (name === '@react-navigation/native') return { useFocusEffect: () => {} };
    if (name === '../auth/AuthSession') return { useAuth: () => ({ status: 'signedOut' }) };
    if (name === '../api/moreData' || name === '../api/homeData') return {};
    if (name === './AppStackContext') return { useAppStack: () => ({ stack: { web: 'https://beta.example.test' } }) };
    if (name === './navigationRef') return {
      navigationRef: { isReady: () => true, navigate: (...args) => webNavigated.push(args) },
    };
    if (name === '../assets/logo.png') return 'logo';
    if (name === 'react-native') return {
      Pressable: 'Pressable', Text: 'Text', View: 'View', Image: 'Image', ScrollView: 'ScrollView',
      useWindowDimensions: () => ({ width }),
      StyleSheet: { create: value => value },
    };
    if (name === 'react-native-svg') return {
      __esModule: true, default: 'Svg', Circle: 'Circle', Path: 'Path', Rect: 'Rect',
    };
    if (name === '../components/ui/tokens') return { useNativeTheme: () => theme, useNativeColors: () => ({
      surface: '#fff', border: '#eee', accent: '#2A1111', textMuted: '#9B928A',
      onAccent: '#FFFFFF', textSecondary: '#6B625B', text: '#1F1A17',
    }) };
    if (name === 'react-native-safe-area-context') return {
      SafeAreaView: 'SafeAreaView',
      useSafeAreaInsets: () => ({ bottom: 34 }),
    };
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
  const emitted = [], navigated = [];
  const tree = load('NativeTabBar.tsx').NativeTabBar({
    state: {
      index: 1,
      routes: [
        { name: 'Home', key: 'home-route' },
        { name: 'Bible', key: 'bible-route', params: { readerActive } },
        { name: 'Schedule', key: 'schedule-route' },
        { name: 'Together', key: 'together-route' },
        { name: 'Profile', key: 'profile-route' },
      ],
    },
    navigation: {
      emit: event => { emitted.push(event); return { defaultPrevented: preventDefault }; },
      navigate: name => navigated.push(name),
    },
  });
  const strip = tree.type(tree.props);
  function descendants(node) {
    if (!React.isValidElement(node)) return [];
    return [node, ...React.Children.toArray(node.props.children).flatMap(descendants)];
  }
  const nodes = descendants(strip);
  const buttons = nodes.filter(node => node.props.accessibilityRole === 'tab');
  return {
    emitted, navigated, webNavigated, strip, buttons, nodes,
    press: index => buttons[index] ? buttons[index].props.onPress() : tree.props.onTabSelect(index),
  };
}

test('emits tabPress once without navigating when the active tab is pressed', () => {
  const bar = mount();
  bar.press(1);
  assert.deepEqual(bar.emitted, [
    { type: 'tabPress', target: 'bible-route', canPreventDefault: true },
  ]);
  assert.deepEqual(bar.navigated, []);
});

test('emits tabPress and navigates once when an inactive tab is pressed', () => {
  const bar = mount();
  bar.press(2);
  assert.deepEqual(bar.emitted, [
    { type: 'tabPress', target: 'schedule-route', canPreventDefault: true },
  ]);
  assert.deepEqual(bar.navigated, ['Schedule']);
});

test('does not navigate when the inactive tabPress is prevented', () => {
  const bar = mount(true);
  bar.press(2);
  assert.equal(bar.emitted.length, 1);
  assert.deepEqual(bar.navigated, []);
});

for (const index of [-1, 5]) {
  test(`ignores the out-of-range native tab index ${index}`, () => {
    const bar = mount();
    bar.press(index);
    assert.deepEqual(bar.emitted, []);
    assert.deepEqual(bar.navigated, []);
  });
}

test('renders five accessible tabs with selected color and real inactive press callbacks', () => {
  const bar = mount();
  assert.equal(bar.buttons.length, 5);
  for (const [index, button] of bar.buttons.entries()) {
    assert.equal(button.props.accessibilityRole, 'tab');
    assert.equal(button.props.accessibilityState.selected, index === 1);
    const [icon, label] = React.Children.toArray(button.props.children);
    assert.equal(icon.props.stroke, index === 1 ? '#2A1111' : '#9B928A');
    assert.equal(icon.props.strokeWidth, index === 1 ? 2.2 : 2);
    assert.equal(label.props.style[1].color, icon.props.stroke);
  }
  bar.buttons[3].props.onPress();
  bar.buttons[4].props.onPress();
  assert.deepEqual(bar.navigated, ['Together', 'Profile']);
  assert.equal(bar.strip.props.children.props.style[1].height, 56 + 34);
});

test('Bible landing retains the standard bar while a reader uses its compact height', () => {
  assert.equal(mount(false, false).strip.props.children.props.style[1].height, 60 + 34);
  assert.equal(mount(false, true).strip.props.children.props.style[1].height, 56 + 34);
});

test('replaces the bottom strip with a 240px sidebar exactly at width 1024', () => {
  const narrow = mount(false, true, 1023);
  const wide = mount(false, true, 1024);
  assert.deepEqual(narrow.strip.props.edges, ['bottom']);
  assert.equal(narrow.nodes.some(node => node.props.testID === 'native-sidebar'), false);
  assert.equal(wide.strip.props.testID, 'native-sidebar');
  assert.equal(wide.strip.props.style[0].width, 240);
  assert.deepEqual(wide.strip.props.edges, ['top', 'bottom', 'left']);
  assert.equal(wide.buttons.length, 5);
  assert.equal(wide.nodes.filter(node => node.type === 'SafeAreaView').length, 1);
});

for (const [index, prevented, expected] of [[1, false, []], [2, false, ['Schedule']], [2, true, []], [4, true, []]]) {
  test(`sidebar tab ${index} preserves selection and prevention=${prevented}`, () => {
    const bar = mount(prevented, true, 1024);
    bar.press(index);
    assert.deepEqual(bar.emitted, [{
      type: 'tabPress', target: ['home-route', 'bible-route', 'schedule-route', 'together-route', 'profile-route'][index],
      canPreventDefault: true,
    }]);
    assert.deepEqual(bar.navigated, expected);
    assert.equal(bar.buttons[index].props.accessibilityState.selected, index === 1);
  });
}

test('sidebar selected and inactive rows match web semantic colors and geometry', () => {
  const bar = mount(false, true, 1024);
  for (const [index, button] of bar.buttons.slice(0, 4).entries()) {
    const style = button.props.style({ pressed: false });
    const icon = React.Children.toArray(button.props.children)[0];
    assert.equal(style[0].minHeight, 44);
    assert.equal(style[0].gap, 12);
    assert.equal(style[0].paddingHorizontal, 16);
    assert.equal(style[1].backgroundColor, index === 1 ? '#2A1111' : 'transparent');
    assert.equal(icon.props.stroke, index === 1 ? '#FFFFFF' : '#6B625B');
  }
});

test('sidebar secondary links use the registered web stack without changing the primary tab', () => {
  const bar = mount(false, true, 1024);
  for (const name of ['Hasena', 'Intro', 'Notifications']) {
    bar.nodes.find(node => node.props.testID === `sidebar-${name}`).props.onPress();
  }
  assert.deepEqual(bar.webNavigated, ['/hasena', '/intro', '/notifications']
    .map(path => ['WebView', { url: `https://beta.example.test${path}` }]));
  assert.deepEqual(bar.emitted, []);
  assert.deepEqual(bar.navigated, []);
});

test('sidebar brand returns through the same cancellable Home tab event', () => {
  const bar = mount(true, true, 1024);
  bar.nodes.find(node => node.props.accessibilityLabel === '매일일독 홈').props.onPress();
  assert.deepEqual(bar.emitted, [{ type: 'tabPress', target: 'home-route', canPreventDefault: true }]);
  assert.deepEqual(bar.navigated, []);
});

test('sidebar uses the reference logo size and white tint only in dark mode', () => {
  for (const theme of ['light', 'dark']) {
    const bar = mount(false, true, 1024, theme);
    const logo = bar.nodes.find(node => node.type === 'Image' && node.props.source === 'logo');
    assert.equal(logo.props.style[0].height, 22);
    assert.equal(logo.props.style[1]?.tintColor, theme === 'dark' ? '#FFFFFF' : undefined);
  }
});
