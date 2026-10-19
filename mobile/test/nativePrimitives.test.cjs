const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');

// Execute real component functions/JSX; only the unavailable native host is
// substituted. This is a render-contract test, not a native mount or focus test.
let scheme = 'light';
const insets = { top: 24, bottom: 34, left: 12, right: 20 };
const native = {
  Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView',
  Text: 'Text', View: 'View', Switch: 'Switch', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (value) => value, absoluteFillObject: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 } },
  useColorScheme: () => scheme,
  Platform: { OS: 'ios', select: (values) => values.ios ?? values.default },
};
const cache = new Map();
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  if (cache.has(filename)) return cache.get(filename);
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const originalRequire = instance.require.bind(instance);
  instance.require = (name) => {
    if (name === 'react-native') return native;
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => insets };
    if (name.startsWith('.')) {
      const resolved = path.resolve(path.dirname(filename), name);
      const file = [resolved, `${resolved}.ts`, `${resolved}.tsx`].find((candidate) => fs.existsSync(candidate));
      return load(path.relative(path.resolve(__dirname, '..'), file));
    }
    return originalRequire(name);
  };
  instance._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename);
  cache.set(filename, instance.exports);
  return instance.exports;
}
function nodes(element) {
  if (!React.isValidElement(element)) return [];
  const resolved = typeof element.type === 'function' ? element.type(element.props) : element;
  return [resolved, ...React.Children.toArray(resolved.props.children).flatMap(nodes)];
}
const style = (value) => Object.assign({}, ...[value].flat(Infinity).filter(Boolean));
const baseline = process.env.NATIVE_PRIMITIVES_BASELINE === '1';
const Sheet = baseline
  ? load('components/bible/ReadingSettingsSheet.tsx').default
  : load('components/ui/NativeSheet.tsx').NativeSheet;
function sheet(onClose = () => {}, extra = {}) {
  return Sheet({
    visible: true, title: 'Fixture', onClose,
    children: React.createElement('Switch', { onValueChange: extra.onValueChange }),
    ...(baseline ? { settings: load('api/readingSettings.ts').DEFAULT_READING_SETTINGS, onChange: () => {} } : {}),
    ...extra,
  });
}

test('visible sheet establishes a modal accessibility boundary', () => {
  // Given an open sheet, when its real render function executes, then the
  // platform receives an explicit boundary without grouping its child controls.
  const tree = nodes(sheet());
  const boundary = tree.find((node) => node.props.accessibilityViewIsModal);
  assert.ok(boundary, 'visible sheet must declare accessibilityViewIsModal');
  assert.notEqual(boundary.props.accessible, true);
  assert.equal(tree[0].type, 'Modal');
});

if (!baseline) {
  const { NativeButton } = load('components/ui/NativeButton.tsx');
  const { NativeStateView } = load('components/ui/NativeStateView.tsx');
  const { colors } = load('components/ui/tokens.ts');

  for (const action of ['scrim', 'close', 'back', 'escape']) {
    test(`sheet ${action} calls onClose exactly once`, () => {
      let count = 0;
      const tree = nodes(sheet(() => { count += 1; }));
      const modal = tree.find((node) => node.type === 'Modal');
      if (action === 'back') modal.props.onRequestClose();
      if (action === 'escape') tree.find((node) => node.props.onAccessibilityEscape).props.onAccessibilityEscape();
      if (action === 'scrim') tree.find((node) => node.props.testID === 'native-sheet-scrim').props.onPress();
      if (action === 'close') tree.find((node) => node.type === 'Pressable' && node.props.accessibilityRole === 'button').props.onPress();
      assert.equal(count, 1);
    });
  }
  test('an internal change leaves the sheet visible without a dismissing ancestor', () => {
    let closed = 0;
    let changed = false;
    const root = sheet(() => { closed += 1; }, { onValueChange: () => { changed = true; } });
    const tree = nodes(root);
    tree.find((node) => node.type === 'Switch').props.onValueChange(true);
    assert.equal(changed, true);
    assert.equal(closed, 0);
    assert.equal(root.props.visible, true);
    function inspect(element, pressAncestors = []) {
      if (!React.isValidElement(element)) return;
      if (element.type === 'Switch') assert.equal(pressAncestors.length, 0);
      React.Children.forEach(element.props.children, (child) =>
        inspect(child, element.props.onPress ? [...pressAncestors, element] : pressAncestors));
    }
    inspect(root);
  });
  test('scrim is not a separate screen-reader target', () => {
    const scrim = nodes(sheet()).find((node) => node.props.testID === 'native-sheet-scrim');
    assert.equal(scrim.props.accessible, false);
    assert.equal(scrim.props.importantForAccessibility, 'no-hide-descendants');
  });
  test('sheet protects every safe edge and scrolls footer with oversized content', () => {
    const tree = nodes(sheet(undefined, { footer: React.createElement('Footer') }));
    const frame = tree.find((node) => node.props.testID === 'native-sheet-frame');
    const padding = style(frame.props.style);
    assert.equal(padding.paddingTop, 24);
    assert.equal(padding.paddingLeft, 12);
    assert.equal(padding.paddingRight, 20);
    const scroll = tree.find((node) => node.type === 'ScrollView');
    assert.equal(style(scroll.props.contentContainerStyle).paddingBottom, 50);
    assert.ok(nodes(scroll).some((node) => node.type === 'Footer'));
    assert.equal(tree[0].props.animationType, 'none');
  });
  test('hidden sheet is absent from the element and accessibility tree', () => {
    assert.equal(sheet(undefined, { visible: false }), null);
  });
  test('sheet permits portrait and both landscape directions in the native modal', () => {
    // Given an open sheet, when rendered, then its native host is allowed to
    // follow either landscape rotation rather than Modal's portrait-only default.
    const modal = nodes(sheet()).find((node) => node.type === 'Modal');
    assert.deepEqual(modal.props.supportedOrientations, [
      'portrait', 'landscape-left', 'landscape-right',
    ]);
  });
  test('enabled button commits on press and immediately changes pressed color', () => {
    let count = 0;
    const button = NativeButton({ label: 'Fixture', onPress: () => { count += 1; } });
    assert.equal(button.props.onPressIn, undefined);
    button.props.onPress();
    assert.equal(count, 1);
    assert.notEqual(style(button.props.style({ pressed: true })).backgroundColor,
      style(button.props.style({ pressed: false })).backgroundColor);
    assert.ok(style(button.props.style({ pressed: false })).minHeight >= 48);
  });
  test('disabled selected button exposes state and no actionable callback', () => {
    let count = 0;
    const button = NativeButton({ label: 'Fixture', disabled: true, selected: true, onPress: () => { count += 1; } });
    button.props.onPress?.();
    assert.equal(count, 0);
    assert.deepEqual(button.props.accessibilityState, { disabled: true, selected: true });
  });
  test('semantic palette follows OS mode and permits an explicit app mode', () => {
    scheme = 'dark';
    try {
      const dark = NativeButton({ label: 'Fixture', onPress() {} });
      const light = NativeButton({ label: 'Fixture', onPress() {}, mode: 'light' });
      assert.equal(style(dark.props.style({ pressed: false })).backgroundColor, colors.dark.surface);
      assert.equal(style(light.props.style({ pressed: false })).backgroundColor, colors.light.surface);
      assert.equal(colors.light.text, '#1F1A17');
      assert.equal(colors.dark.text, '#f3f4f6');
      assert.deepEqual(Object.keys(colors.light), Object.keys(colors.dark));
    } finally { scheme = 'light'; }
  });
  for (const kind of ['loading', 'empty', 'error']) {
    test(`${kind} state exposes busy/error semantics and only errors offer retry`, () => {
      let retries = 0;
      const tree = nodes(NativeStateView({ kind, message: 'Fixture', onRetry: () => { retries += 1; } }));
      assert.equal(tree[0].props.accessibilityState.busy, kind === 'loading');
      assert.equal(tree.some((node) => node.type === 'ActivityIndicator'), kind === 'loading');
      const retry = tree.find((node) => node.type === 'Pressable');
      assert.equal(Boolean(retry), kind === 'error');
      retry?.props.onPress();
      assert.equal(retries, kind === 'error' ? 1 : 0);
    });
  }
}
