const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');

const mobile = path.resolve(__dirname, '..');

function load(relativePath, mocks = {}) {
  const filename = path.join(mobile, relativePath);
  const m = new Module(filename, module);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  m.require = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (/\.(otf|ttf)$/.test(name)) return path.resolve(path.dirname(filename), name);
    return Module.prototype.require.call(m, name);
  };
  m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  }).outputText, filename);
  return m.exports;
}

const settings = load('api/readingSettings.ts');

// Only the native host and unrelated shell boundaries are replaced. The actual
// AppContent effect must invoke Font.loadAsync with the real bundled requires.
async function registeredFonts() {
  const effects = [];
  let registered;
  const loaded = new Promise(resolve => { registered = resolve; });
  const App = load('App.tsx', {
    react: {
      ...React,
      useEffect: fn => effects.push(fn),
      useRef: current => ({ current }),
      useState: initial => [initial, () => {}],
    },
    'react-native': {
      StyleSheet: { create: x => x },
      View: 'View', ActivityIndicator: 'ActivityIndicator', StatusBar: 'StatusBar',
    },
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView' },
    'expo-linking': {},
    'expo-notifications': { setNotificationHandler() {} },
    'expo-constants': { expoConfig: {} },
    'expo-splash-screen': { preventAutoHideAsync() {}, hideAsync() {} },
    'expo-font': { loadAsync: fonts => { registered(fonts); return Promise.resolve(); } },
    'expo-updates': {},
    '@sentry/react-native': { wrap: component => component },
    './sentryTelemetry': { initMobileTelemetry() {} },
    './bundleIdentity': { resolveBundleIdentity: () => ({}), formatBundleIdentityLine: () => 'font registration test' },
    './deepLink': {},
    './navigation/routeMap': {},
    './navigation/appShell': {},
    './navigation/navigationRef': {},
    './navigation/AppStackContext': {
      AppStackProvider: 'AppStackProvider',
      useAppStack: () => ({ ready: false, stack: { web: 'https://example.test' } }),
    },
    './screens/WebViewScreen': {},
    './auth/AuthSession': {},
    './navigation/RootNavigator': {},
    './nativePush': {},
    './components/ui/tokens': { colors: { light: { background: '#fff', accent: '#000' } } },
  }).default;
  const content = App().props.children.props.children;
  content.type();
  effects.forEach(effect => effect());
  return loaded;
}

// Read SFNT metadata directly; no optional font parser or native font loader is
// needed in CI. This proves identity/weight, not rasterization or runtime load.
function fontMetadata(bytes) {
  const tables = new Map();
  for (let i = 0; i < bytes.readUInt16BE(4); i++) {
    const start = 12 + i * 16;
    tables.set(bytes.toString('ascii', start, start + 4), bytes.readUInt32BE(start + 8));
  }
  const nameOffset = tables.get('name');
  const stringOffset = nameOffset + bytes.readUInt16BE(nameOffset + 4);
  const names = new Map();
  for (let i = 0; i < bytes.readUInt16BE(nameOffset + 2); i++) {
    const start = nameOffset + 6 + i * 12;
    if (bytes.readUInt16BE(start) !== 3 || bytes.readUInt16BE(start + 4) !== 0x409) continue;
    const length = bytes.readUInt16BE(start + 8);
    const offset = stringOffset + bytes.readUInt16BE(start + 10);
    names.set(bytes.readUInt16BE(start + 6),
      Buffer.from(bytes.subarray(offset, offset + length)).swap16().toString('utf16le'));
  }
  return {
    postscriptName: names.get(6),
    weight: bytes.readUInt16BE(tables.get('OS/2') + 4),
    variable: tables.has('fvar'),
  };
}

const originals = [
  ['KoPubBatang-Light', 'ttf', 300, '4b48b18e81ecc50b54a5d34e625ac21a5a9b6b043e3f6bab6cd87279a645587b'],
  ['KoPubBatang-Regular', 'ttf', 400, 'e7e51c6d8d1131d8dab207ad8da64be861070700b20b19fcb4cd13556d0cc27c'],
  ['KoPubBatang-Bold', 'ttf', 700, 'e21f1202062cf8a76173cce5aba07a88b79ac21b78aa885dc5c9e28dc1b672ac'],
  ['RIDIBatang', 'otf', 400, 'f13a49c0815d254ac15e392953a0b056613dec08ceb378e54eeed14c4fda9a54'],
  ['NotoSerifKR-Regular', 'otf', 400, '5ea012e15cb7eacc1f680aee1703f3b164791b1443ea3e52b65080cca5d179cf'],
  ['NotoSerifKR-Medium', 'otf', 500, '4635a54699624f9235ff4511e932dd8229edce678bdb00d43f46b4668b151062'],
  ['NotoSerifKR-SemiBold', 'otf', 600, 'a63051d299d7219132a98ff3c2b76a62022344e50e9f3b50fdb9b0ee4560f583'],
  ['NotoSerifKR-Bold', 'ttf', 700, '9a6dbb18ee4c88b8f1df0bf892baca9af901ef5a3c82de210f2413cc4fed08f9'],
  ['Pretendard-Regular', 'otf', 400, '3ffbacde6ab8411f1d2db54bb9b1f0b3ee2a738932033722cf0388c06aed1c93'],
  ['Pretendard-Medium', 'otf', 500, 'd39e50e4bb52b4993b6a4eeb821a171254745bd824446af01e1f616b89fface0'],
  ['Pretendard-SemiBold', 'otf', 600, 'c89bc43027dc7cde5726e96223376f8eec09302b2fc1f8147fd5b57cfc376118'],
  ['Pretendard-Bold', 'otf', 700, '2e91915fab54df71cc9598ebf608b2bdb54c6fe3c066ac61dff0bc44fca71cc7'],
  ['NotoSansKR-Regular', 'ttf', 400, '4609a7b62a6da24cae3a8b73ecde7003581b8f60662d60cc8f55a3793de07763'],
  ['NotoSansKR-Medium', 'ttf', 500, '4546aaa0be877f52e67a6f8b14e708a654d34f6ff921d7a469ec7ed8d3bf7080'],
  ['NotoSansKR-SemiBold', 'ttf', 600, 'ce82b8c9368de1a2c82c1fc78822e0277268ff95859b4e26e9996c598bc9745a'],
];

test('app startup registers each original face or documented static instance', { timeout: 3000 }, async t => {
  const fonts = await registeredFonts();
  assert.deepEqual(Object.keys(fonts).sort(), originals.map(([name]) => name).sort());
  for (const [name, extension, weight, sha256] of originals) {
    await t.test(name, () => {
      const bytes = fs.readFileSync(fonts[name]);
      assert.equal(fonts[name], path.join(mobile, 'assets/fonts', `${name}.${extension}`));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256);
      assert.deepEqual(fontMetadata(bytes), { postscriptName: name, weight, variable: false });
    });
  }
});

test('every persisted font and weight reaches a registered face in the real reader', { timeout: 3000 }, async () => {
  const fonts = await registeredFonts();
  const ReaderBody = load('components/bible/ReaderBody.tsx', {
    'react-native': { Text: 'Text', View: 'View', useColorScheme: () => 'light',
      Platform: { OS: 'ios' },
      useWindowDimensions: () => ({ width: 440, height: 956 }) },
    '../../api/readingSettings': settings,
    '../ui/tokens': {
      useNativeColors: () => ({ background: '#FAF8F5', text: '#1F1A17', textSecondary: '#6B625B', accent: '#2A1111' }),
      useNativeTheme: () => 'light',
    },
  }).default;
  for (const family of settings.NATIVE_FONT_ORDER) {
    for (const weight of ['normal', 'medium', 'bold']) {
      const model = settings.parseReadingSettings({ font_family: family, font_weight: weight });
      const tree = ReaderBody({ blocks: [{ type: 'verse', num: 1, text: '태초에 하나님이' }], settings: model });
      const nodes = element => Array.isArray(element) ? element.flatMap(nodes) : React.isValidElement(element)
        ? [element, ...nodes(element.props.children)] : [];
      const paragraph = nodes(tree).find(node => node.props.testID === 'reader-verse-paragraph');
      const style = Object.assign({}, ...paragraph.props.style.flat(Infinity));
      if (family === 'system') {
        assert.equal(style.fontFamily, undefined);
        assert.equal(style.fontWeight, settings.FONT_WEIGHTS[weight]);
      } else {
        assert.ok(Object.hasOwn(fonts, style.fontFamily), `${family}/${weight} must not fall back to platform sans`);
        assert.equal(style.fontWeight, undefined, 'select the actual face, not synthetic native weight');
      }
    }
  }
});

test('retained Noto Sans variable source matches the pinned original', () => {
  const bytes = fs.readFileSync(path.join(mobile, 'assets/fonts/NotoSansKR-Variable.ttf'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),
    '194018e6b2b293a7964f037b25c0249ce1418bc9ab3c971060a03aa57861e252');
  assert.equal(fontMetadata(bytes).variable, true);
});
