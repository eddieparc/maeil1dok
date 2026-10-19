const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');

const token = (id, revision = 1) => `e30.${Buffer.from(JSON.stringify({ user_id: id, exp: revision })).toString('base64url')}.signature`;
const ok = json => ({ ok: true, status: 200, json: async () => json });
const settingsResponse = settings => ok({ success: true, data: { settings } });

// Execute the real navigator, screen, provider, sync and sheet. Only native host
// components/navigation and external I/O are replaced. Hook slots are per instance.
function mount({ status = 'signedIn', id = 42, stored = null, server = {}, failPatch = false, tongdok = false, content, contentType = 'html', scheme = 'light' } = {}) {
  const instances = new Map(), cache = new Map(), listeners = new Set(), calls = [], writes = [], reads = [];
  let active, cursor, dirty = false, disposed = false, tree = [], effects = [];
  const auth = { status, accessToken: token(id), apiFetch };
  const stack = { api: 'https://api.example.test', web: 'https://example.test' };
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((v, i) => v !== b[i]);
  const schedule = () => {
    if (!dirty && !disposed) { dirty = true; queueMicrotask(render); }
  };
  const hooks = {
    ...React,
    createContext(value) {
      const context = { current: value };
      context.Provider = { context };
      return context;
    },
    useContext: context => context.current,
    useState(initial) {
      const slots = active, i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => {
        const next = typeof value === 'function' ? value(slots[i]) : value;
        if (!Object.is(next, slots[i])) { slots[i] = next; schedule(); }
      }];
    },
    useRef(initial) { const i = cursor++; return active[i] ??= { current: initial }; },
    useMemo(fn, deps) {
      const i = cursor++;
      if (changed(active[i]?.deps, deps)) active[i] = { deps, value: fn() };
      return active[i].value;
    },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const slots = active, i = cursor++;
      if (changed(slots[i]?.deps, deps)) effects.push(() => {
        slots[i]?.cleanup?.();
        slots[i] = { deps, cleanup: fn() };
      });
    },
    useLayoutEffect(fn, deps) { hooks.useEffect(fn, deps); },
    useSyncExternalStore(subscribe, snapshot) {
      hooks.useEffect(() => subscribe(schedule), [subscribe]);
      return snapshot();
    },
  };
  async function apiFetch(url, init) {
    calls.push({ url, init });
    if (url.endsWith('/reading-settings/')) return settingsResponse(server);
    if (url.endsWith('/reading-settings/update/')) {
      if (failPatch) return { ok: false, status: 503 };
      return ok({ success: true });
    }
    if (url.includes('/bible-cache/versions')) return ok([]);
    if (url.includes('/bible-cache/')) return ok({ data: {
      content: content ?? '<div id="tdBible1"><span class="number">1</span>First verse<span class="number">2</span>Second verse</div>',
      content_type: contentType,
    } });
    if (url.includes('/reading/update/')) return ok({
      success: true, plan_id: 4, schedule_ids: [101], is_completed: true,
    });
    if (url.includes('/detail/')) return ok({
      ...(tongdok ? {
        book: 'gen', chapter: 1, plan_id: 4, plan_name: 'Plan 4', plan_date: '2026-09-22',
        plan_detail: [{ schedule_id: 101, book: 'gen', start_chapter: 1, end_chapter: 1,
          date: '2026-09-22', is_complete: false }],
      } : {}),
      fallback_audio_links: [
      { book: 'gen', chapter: 1, url: 'https://www.youtube.com/watch?v=abcdefghijk' },
    ] });
    return ok({ success: true, position: null, read_chapters: [] });
  }
  const native = Object.fromEntries(['ActivityIndicator', 'FlatList', 'Modal', 'Pressable', 'ScrollView',
    'Text', 'TouchableOpacity', 'View', 'Switch'].map(name => [name, name]));
  native.StyleSheet = { create: x => x, hairlineWidth: 1 };
  native.useColorScheme = () => scheme;
  const navigator = {
    Navigator: ({ children }) => children,
    Screen: ({ name, component }) => ['Main', 'Bible'].includes(name) ? React.createElement(component) : null,
  };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const m = new Module(filename, module);
    m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename));
    m.require = name => {
      if (name === 'react') return hooks;
      if (name === 'react-native') return native;
      if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ bottom: 0 }) };
      if (name === '@react-navigation/native') return {
        NavigationContainer: ({ children }) => children,
        useRoute: () => ({ params: { url: `/bible?book=gen&chapter=1${tongdok ? '&tongdok=true&plan=4' : ''}` } }),
      };
      if (name === '@react-navigation/bottom-tabs') return { createBottomTabNavigator: () => navigator };
      if (name === '@react-navigation/native-stack') return { createNativeStackNavigator: () => navigator };
      if (name === '@react-native-async-storage/async-storage') return {
        getItem: async key => { reads.push(key); return key === 'readingSettings' ? stored : null; },
        setItem: async (key, value) => { writes.push({ key, value }); },
      };
      if (name.includes('AuthSession')) return { useAuth: () => auth };
      if (name.includes('AppStackContext')) return { useAppStack: () => ({ stack }) };
      if (name.includes('navigationRef')) return { navigationRef: { isReady: () => true, navigate() {} } };
      if (name.includes('NativeTabBar')) return { useNativeTabBarInset: () => 0 };
      if (name === '@expo/vector-icons/Ionicons') return { __esModule: true, default: 'Icon' };
      if (name.includes('/screens/') && !name.endsWith('/BibleScreen')) return { __esModule: true, default: () => null };
      if (/Reader(Tabs|AudioPlayer|TongdokControls|TongdokSchedule)$/.test(name))
        return { __esModule: true, default: name.split('/').at(-1) };
      if (name.startsWith('.')) {
        const p = path.resolve(path.dirname(filename), name);
        return load([p + '.ts', p + '.tsx'].find(fs.existsSync));
      }
      return require(name);
    };
    m._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, filename);
    cache.set(filename, m.exports); return m.exports;
  }
  const Root = load(path.resolve(__dirname, '../navigation/RootNavigator.tsx')).default;
  const provider = load(path.resolve(__dirname, '../components/bible/ReadingSettingsProvider.tsx'));
  let settingsValue;
  function visit(el, key = 'root') {
    if (Array.isArray(el)) return el.flatMap((child, i) => visit(child, `${key}.${i}`));
    if (!React.isValidElement(el)) return [];
    if (el.type?.context) {
      const context = el.type.context, before = context.current;
      context.current = el.props.value;
      settingsValue = provider.useReadingSettings();
      const children = visit(el.props.children, `${key}.provider`);
      context.current = before;
      return children;
    }
    if (typeof el.type === 'function') {
      const instance = `${key}:${el.type.name}:${el.key ?? ''}`;
      active = instances.get(instance) ?? [];
      instances.set(instance, active); cursor = 0;
      const result = el.type(el.props);
      return [{ ...el, component: true }, ...visit(result, `${instance}.result`)];
    }
    if (el.props.visible === false) return [];
    return [el, ...React.Children.toArray(el.props.children).flatMap((child, i) => visit(child, `${key}.${i}`))];
  }
  function render() {
    if (disposed) return;
    dirty = false;
    tree = visit(React.createElement(Root));
    effects.splice(0).forEach(fn => fn());
    listeners.forEach(fn => fn());
  }
  render();
  return {
    calls, writes, reads, auth, stack,
    get value() { return settingsValue; },
    nodes: () => tree,
    get: id => tree.find(n => n.props.testID === id),
    sheet: () => tree.find(n => n.type?.name === 'ReadingSettingsSheet'),
    rerender: render,
    allowPatch() { failPatch = false; },
    scheme(value) { scheme = value; render(); },
    wait(predicate) {
      if (!dirty && predicate()) return Promise.resolve();
      return new Promise(resolve => {
        const check = () => { if (!dirty && predicate()) { listeners.delete(check); resolve(); } };
        listeners.add(check);
      });
    },
    dispose() { disposed = true; instances.forEach(slots => slots.forEach(slot => slot?.cleanup?.())); },
  };
}

test('actual navigator hydrates reader and sheet through the provider', { timeout: 3000 }, async t => {
  const h = mount({ server: { font_size: 23, font_family: 'pretendard', audio_playback_rate: 1.5 } });
  t.after(h.dispose);
  assert.ok(h.nodes().some(n => n.type?.name === 'ReadingSettingsProvider'), 'Provider must participate in the rendered navigator');
  await h.wait(() => h.sheet()?.props.settings.fontSize === 23);
  const verse = h.nodes().find(n => n.type === 'Text' && React.Children.toArray(n.props.children).includes('First verse'));
  assert.equal(verse.props.style.at(-1).fontSize, 23);
  assert.equal(verse.props.style.at(-1).fontFamily, 'Pretendard-Medium');
  assert.equal(h.reads.includes('readingSettings'), false);
});

test('sheet edits PATCH dirty fields only and retry failed sync without local writes', { timeout: 3000 }, async t => {
  const h = mount({ server: { font_size: 23, audio_playback_rate: 1.5 }, failPatch: true });
  t.after(h.dispose);
  await h.wait(() => h.sheet()?.props.settings.fontSize === 23);
  await h.sheet().props.onChange('fontSize', 22);
  await h.wait(() => h.value?.syncError);
  assert.deepEqual(JSON.parse(h.calls.find(c => c.init?.method === 'PATCH').init.body), { font_size: 22 });
  h.nodes().find(n => n.props.accessibilityLabel === '더보기').props.onPress();
  await h.wait(() => h.nodes().some(n => n.props.accessibilityLabel === '읽기 설정'));
  h.nodes().find(n => n.props.accessibilityLabel === '읽기 설정').props.onPress();
  await h.wait(() => h.get('reading-settings-retry'));
  h.allowPatch();
  await h.get('reading-settings-retry').props.onPress();
  await h.wait(() => !h.value.syncError);
  await h.value.update('theme', 'dark');
  assert.deepEqual(JSON.parse(h.calls.filter(c => c.init?.method === 'PATCH').at(-1).init.body), { theme: 'dark' });
  assert.equal(h.value.settings.fontSize, 22);
  assert.equal(h.value.settings.audioPlaybackRate, 1.5);
  assert.equal(h.writes.some(w => w.key === 'readingSettings'), false);
});

test('guest settings have one local owner and no server settings traffic', { timeout: 3000 }, async t => {
  const h = mount({ status: 'signedOut', stored: JSON.stringify({ fontSize: 21 }) });
  t.after(h.dispose);
  await h.wait(() => h.sheet()?.props.settings.fontSize === 21);
  await h.sheet().props.onChange('fontSize', 22);
  await h.wait(() => h.writes.some(w => w.key === 'readingSettings'));
  assert.equal(h.reads.filter(k => k === 'readingSettings').length, 1);
  assert.equal(h.writes.filter(w => w.key === 'readingSettings').length, 1);
  assert.equal(h.calls.some(c => c.url.includes('reading-settings')), false);
});

test('token rotation preserves settings session while account and stack changes reload it', { timeout: 3000 }, async t => {
  const h = mount({ server: { font_size: 23 } });
  t.after(h.dispose);
  await h.wait(() => h.value?.settings.fontSize === 23);
  const loads = () => h.calls.filter(c => c.url.endsWith('/reading-settings/')).length;
  const before = loads();
  h.auth.accessToken = token(42, 2); h.rerender();
  assert.equal(loads(), before);
  h.auth.accessToken = token(43); h.rerender();
  assert.equal(loads(), before + 1);
  h.stack.api = 'https://api-beta.example.test'; h.rerender();
  assert.equal(loads(), before + 2);
  h.auth.status = 'signedOut'; h.rerender();
  await h.wait(() => h.reads.includes('readingSettings'));
  assert.equal(h.value.settings.fontSize, 16);
});

test('rendered sheet controls update body typography and numbers and supported switches are actionable', { timeout: 3000 }, async t => {
  const h = mount({ server: { font_family: 'system', font_size: 20, font_weight: 'bold', line_height: 2, text_align: 'justify' } });
  t.after(h.dispose);
  await h.wait(() => h.value?.settings.fontSize === 20);
  h.nodes().find(n => n.props.accessibilityLabel === '더보기').props.onPress();
  await h.wait(() => h.nodes().some(n => n.props.accessibilityLabel === '읽기 설정'));
  h.nodes().find(n => n.props.accessibilityLabel === '읽기 설정').props.onPress();
  await h.wait(() => h.nodes().some(n => n.props.accessibilityLabel === '글자 크기 키우기'));
  h.nodes().find(n => n.props.accessibilityLabel === '글자 크기 키우기').props.onPress();
  await h.wait(() => h.value.settings.fontSize === 21);
  const verse = h.nodes().find(n => n.type === 'Text' && React.Children.toArray(n.props.children).includes('First verse'));
  for (const [key, value] of Object.entries({
    fontFamily: undefined, fontWeight: 600, fontSize: 21, lineHeight: 42, textAlign: 'justify',
  })) assert.equal(verse.props.style.at(-1)[key], value, key);
  const switches = h.nodes().filter(n => n.type === 'Switch');
  for (const label of ['절 붙임 (통독 모드)', '시편 머리말 (새한글)', '교차 참조 (새한글)', '각주 (새한글)']) {
    const control = switches.find(n => n.props.accessibilityLabel === label);
    assert.notEqual(control.props.disabled, true, label);
    assert.equal(typeof control.props.onValueChange, 'function', label);
  }
  switches.find(n => n.props.accessibilityLabel === '절 번호 표시').props.onValueChange(false);
  await h.wait(() => h.value.settings.showVerseNumbers === false);
  const changed = h.nodes().find(n => n.type === 'Text' && React.Children.toArray(n.props.children).includes('First verse'));
  assert.deepEqual(React.Children.toArray(changed.props.children), ['First verse']);
});

const textOf = el => {
  if (typeof el === 'string' || typeof el === 'number') return String(el);
  if (Array.isArray(el)) return el.map(textOf).join('');
  return React.isValidElement(el) ? textOf(el.props.children) : '';
};
const bodyText = h => textOf(h.get('reader-body'));
const kntSettingsFixture = JSON.stringify({ found: true, content:
  '<p class="s">Section</p><p class="d">Superscription<span class="f"><span class="fr">1:1</span><span class="ft">Description footnote</span></span></p>'
  + '<p class="r">(Luke 3:23)</p><p class="p"><span class="v">1</span>First verse'
  + '<span class="f"><span class="fr">1:1</span><span class="ft">Verse footnote</span></span>'
  + '<span class="v">2</span>Second verse</p>' });

for (const [setting, hidden, retained] of [
  ['showDescription', 'Superscription', '(Luke 3:23)'],
  ['showCrossRef', '(Luke 3:23)', 'Superscription'],
]) {
  test(`actual reader independently applies ${setting}`, { timeout: 3000 }, async t => {
    const h = mount({ content: kntSettingsFixture, contentType: 'json' }); t.after(h.dispose);
    await h.wait(() => h.nodes().some(n => n.type === 'Text' && textOf(n).includes('First verse')));
    assert.ok(bodyText(h).includes(hidden));
    await h.value.update(setting, false);
    await h.wait(() => h.value.settings[setting] === false);
    assert.ok(!bodyText(h).includes(hidden));
    assert.ok(bodyText(h).includes(retained));
    assert.ok(bodyText(h).includes('Section'));
    await h.value.update(setting, true);
    await h.wait(() => h.value.settings[setting]);
    assert.ok(bodyText(h).includes(hidden));
  });
}

test('actual reader shows footnote text without losing verse or description text', { timeout: 3000 }, async t => {
  const h = mount({ content: kntSettingsFixture, contentType: 'json' }); t.after(h.dispose);
  await h.wait(() => h.nodes().some(n => n.type === 'Text' && textOf(n).includes('First verse')));
  assert.ok(!bodyText(h).includes('Verse footnote'));
  await h.value.update('showFootnotes', true);
  await h.wait(() => h.value.settings.showFootnotes);
  for (const text of ['Verse footnote', 'Description footnote', 'First verse', 'Superscription'])
    assert.ok(bodyText(h).includes(text), text);
  await h.value.update('showFootnotes', false);
  await h.wait(() => !h.value.settings.showFootnotes);
  assert.ok(!bodyText(h).includes('Verse footnote'));
});

test('verse joining uses one native Text flow and separates section headings', { timeout: 3000 }, async t => {
  const h = mount({ content: kntSettingsFixture, contentType: 'json' }); t.after(h.dispose);
  await h.wait(() => h.nodes().some(n => n.type === 'Text' && textOf(n).includes('First verse')));
  await h.value.update('verseJoining', true);
  await h.wait(() => h.value.settings.verseJoining);
  const paragraphs = h.nodes().filter(n => n.props.testID === 'reader-verse-paragraph');
  assert.equal(paragraphs.length, 1);
  assert.match(textOf(paragraphs[0]), /First verse.*Second verse/);
  assert.ok(!textOf(paragraphs[0]).includes('Section'));
  await h.value.update('verseJoining', false);
  await h.wait(() => !h.value.settings.verseJoining);
  assert.equal(h.nodes().filter(n => n.props.testID === 'reader-verse-paragraph').length, 2);
});

test('name/place styling follows source spans only and toggles off', { timeout: 3000 }, async t => {
  const h = mount({ content: '<div id="tdBible1"><span class="number">1</span>Unmarked Adam <font class="name">Adam</font> in <font class="area">Eden</font></div>' });
  t.after(h.dispose);
  await h.wait(() => h.nodes().some(n => n.type === 'Text' && textOf(n).includes('Unmarked Adam')));
  const marks = () => h.nodes().filter(n => ['reader-name', 'reader-place'].includes(n.props.testID));
  assert.deepEqual(marks().map(textOf), ['Adam', 'Eden']);
  assert.equal(marks()[0].props.style.textDecorationLine, 'underline');
  await h.value.update('highlightNames', false);
  await h.wait(() => !h.value.settings.highlightNames);
  assert.equal(marks()[0].props.style, undefined);
  assert.match(bodyText(h), /Unmarked Adam/);
});

test('body theme changes foreground/background and system appearance without resetting typography', { timeout: 3000 }, async t => {
  const h = mount({ server: { font_size: 23, audio_playback_rate: 1.5 } }); t.after(h.dispose);
  await h.wait(() => h.value?.settings.fontSize === 23);
  await h.value.update('theme', 'dark');
  await h.wait(() => h.value.settings.theme === 'dark');
  assert.equal(h.get('reader-body').props.style.backgroundColor, '#1a1a1a');
  assert.equal(h.nodes().find(n => n.props.testID === 'reader-verse-paragraph').props.style.at(-1).color, '#e5e5e5');
  await h.value.update('theme', 'system');
  await h.wait(() => h.value.settings.theme === 'system');
  assert.equal(h.get('reader-body').props.style.backgroundColor, '#FAF8F5');
  h.scheme('dark');
  assert.equal(h.get('reader-body').props.style.backgroundColor, '#1a1a1a');
  assert.equal(h.value.settings.fontSize, 23);
  assert.equal(h.value.settings.audioPlaybackRate, 1.5);
});

for (const enabled of [true, false]) {
  test(`rendered auto-complete switch controls actual audio-ended completion: ${enabled}`, { timeout: 3000 }, async t => {
    const h = mount({ tongdok: true, server: { tongdok_auto_complete: !enabled } });
    t.after(h.dispose);
    await h.wait(() => h.value?.settings.tongdokAutoComplete === !enabled
      && h.nodes().some(n => n.type === 'ReaderTongdokControls' && n.props.state.detail)
      && h.nodes().some(n => n.props.accessibilityLabel === '오디오'));
    h.nodes().find(n => n.props.accessibilityLabel === '오디오').props.onPress();
    await h.wait(() => h.nodes().some(n => n.type === 'ReaderAudioPlayer'));
    const player = h.nodes().find(n => n.type === 'ReaderAudioPlayer');
    h.nodes().find(n => n.props.accessibilityLabel === '더보기').props.onPress();
    await h.wait(() => h.nodes().some(n => n.props.accessibilityLabel === '읽기 설정'));
    h.nodes().find(n => n.props.accessibilityLabel === '읽기 설정').props.onPress();
    await h.wait(() => h.nodes().some(n => n.type === 'Switch'));
    const control = h.nodes().find(n => n.type === 'Switch'
      && n.props.accessibilityLabel === '통독모드 자동 완료');
    assert.notEqual(control.props.disabled, true);
    await control.props.onValueChange(enabled);
    await h.wait(() => h.value.settings.tongdokAutoComplete === enabled);
    assert.deepEqual(JSON.parse(h.calls.filter(c => c.init?.method === 'PATCH').at(-1).init.body),
      { tongdok_auto_complete: enabled });
    await player.props.onEnded({ contextKey: player.props.contextKey,
      link: player.props.audioLink, generation: 1 });
    const completions = h.calls.filter(c => c.url.includes('/reading/update/'));
    assert.equal(completions.length, enabled ? 1 : 0);
    if (enabled) assert.deepEqual(JSON.parse(completions[0].init.body),
      { plan_id: 4, schedule_ids: [101], action: 'complete' });
  });
}

test('audio rate callback shares the provider rather than a second settings writer', { timeout: 3000 }, async t => {
  const h = mount({ server: { audio_playback_rate: 1.5 } });
  t.after(h.dispose);
  await h.wait(() => h.value?.settings.audioPlaybackRate === 1.5
    && h.nodes().some(n => n.props.accessibilityLabel === '오디오'));
  h.nodes().find(n => n.props.accessibilityLabel === '오디오').props.onPress();
  await h.wait(() => h.nodes().some(n => n.type === 'ReaderAudioPlayer'));
  const player = h.nodes().find(n => n.type === 'ReaderAudioPlayer');
  assert.equal(player.props.initialRate, 1.5);
  await player.props.onRateChange(0.75);
  assert.deepEqual(JSON.parse(h.calls.filter(c => c.init?.method === 'PATCH').at(-1).init.body), { audio_playback_rate: 0.75 });
  assert.equal(h.writes.some(w => w.key === 'readingSettings'), false);
});

test('malformed signed-in identity cannot fall back to guest storage or save to the prior account', { timeout: 3000 }, async t => {
  const h = mount({ server: { font_size: 23 } });
  t.after(h.dispose);
  await h.wait(() => h.value?.settings.fontSize === 23);
  h.auth.accessToken = 'invalid'; h.rerender();
  await h.value.update('fontSize', 22);
  assert.equal(h.calls.some(c => c.init?.method === 'PATCH'), false);
  assert.equal(h.reads.includes('readingSettings'), false);
  assert.equal(h.value.settings.fontSize, 16);
  assert.ok(h.nodes().some(n => n.props.accessibilityRole === 'alert'));
});
