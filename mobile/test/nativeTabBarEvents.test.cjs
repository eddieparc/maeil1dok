const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

function mount(preventDefault = false) {
  const filename = path.resolve(__dirname, '../navigation/NativeTabBar.tsx');
  const instance = new Module(filename, module);
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const base = instance.require.bind(instance);
  instance.require = name => {
    if (name === 'react/jsx-runtime') return base(name);
    if (name === 'react-native') return {
      Platform: { OS: 'ios' },
      StyleSheet: { create: value => value },
      useWindowDimensions: () => ({ width: 390 }),
    };
    if (name === 'expo-modules-core') return {
      requireNativeViewManager: () => function NativeViewBoundary() {},
    };
    if (name === 'react-native-safe-area-context') return {
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
  const emitted = [], navigated = [];
  const tree = instance.exports.NativeTabBar({
    state: {
      index: 1,
      routes: [
        { name: 'Home', key: 'home-route' },
        { name: 'Bible', key: 'bible-route' },
        { name: 'Schedule', key: 'schedule-route' },
      ],
    },
    navigation: {
      emit: event => { emitted.push(event); return { defaultPrevented: preventDefault }; },
      navigate: name => navigated.push(name),
    },
  });
  return {
    emitted, navigated,
    press: index => tree.props.onTabSelect({ nativeEvent: { index } }),
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

for (const index of [-1, 3]) {
  test(`ignores the out-of-range native tab index ${index}`, () => {
    const bar = mount();
    bar.press(index);
    assert.deepEqual(bar.emitted, []);
    assert.deepEqual(bar.navigated, []);
  });
}
