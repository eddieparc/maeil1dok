const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');

for (const [platform, bottom] of [['ios', 34], ['android', 24]]) {
  test(`renders the same in-flow native strip on ${platform}`, () => {
    const filename = path.resolve(__dirname, '../navigation/NativeTabBar.tsx');
    const instance = new Module(filename, module);
    instance.paths = Module._nodeModulePaths(path.dirname(filename));
    const base = instance.require.bind(instance);
    instance.require = name => {
      if (name === 'react/jsx-runtime') return base(name);
      if (name === './NativeSidebar') return { NativeSidebar: 'NativeSidebar' };
      if (name === 'react-native') return {
        Platform: { OS: platform }, View: 'View', Text: 'Text', Pressable: 'Pressable',
        useWindowDimensions: () => ({ width: 390 }),
        StyleSheet: { create: value => value },
      };
      if (name === 'react-native-svg') return {
        __esModule: true, default: 'Svg', Circle: 'Circle', Path: 'Path', Rect: 'Rect',
      };
      if (name === 'react-native-safe-area-context') return {
        SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom }),
      };
      if (name === '../components/ui/tokens') return {
        useNativeColors: () => ({ surface: '#fff', border: '#eee', accent: '#111', textMuted: '#999' }),
      };
      throw new Error(`Unexpected platform dependency: ${name}`);
    };
    instance._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, filename);
    const bar = instance.exports.NativeTabBar({
      state: { index: 0, routes: [{ name: 'Home', key: 'home' }] },
      navigation: {},
    });
    const strip = bar.type(bar.props);
    assert.equal(strip.type, 'SafeAreaView');
    assert.deepEqual(strip.props.edges, ['bottom']);
    assert.equal(strip.props.children.type, 'View');
    assert.equal(strip.props.children.props.style[1].height, 60 + bottom);
    assert.equal(instance.exports.useNativeTabBarInset(), 0);
  });
}
