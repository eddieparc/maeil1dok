const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');

// Execute the actual screen and callbacks. Only hooks, navigation and native hosts
// are substituted; API promises are explicitly released, never time-polled.
function mount(apiFetch, status = 'signedIn', inset = 0, width = 440) {
  const slots = [], effects = [], jobs = [], listeners = new Set(), cache = new Map(), navigations = [];
  let cursor = 0, tree, dirty = false, disposed = false;
  const auth = { status, apiFetch };
  const themeUpdates = [];
  const readingSettings = {
    settings: { theme: 'light' },
    update: async (key, value) => {
      themeUpdates.push([key, value]);
      readingSettings.settings[key] = value;
      render();
    },
  };
  const stack = { web: 'https://beta.example.test' };
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((x, i) => x !== b[i]);
  const hooks = {
    ...React,
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => {
        slots[i] = typeof value === 'function' ? value(slots[i]) : value;
        if (!dirty && !disposed) { dirty = true; queueMicrotask(render); }
      }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useMemo(fn, deps) {
      const i = cursor++;
      if (changed(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() };
      return slots[i].value;
    },
    useCallback(fn, deps) {
      return hooks.useMemo(() => (...args) => {
        const result = fn(...args);
        if (result instanceof Promise) jobs.push(result);
        return result;
      }, deps);
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (changed(slots[i]?.deps, deps)) {
        effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
      }
    },
  };
  const native = Object.fromEntries(['Image', 'Modal', 'ScrollView', 'Text', 'TouchableOpacity',
    'View', 'Pressable', 'ActivityIndicator'].map(x => [x, x]));
  native.StyleSheet = { create: x => x };
  native.useColorScheme = () => 'light';
  native.useWindowDimensions = () => ({ width, height: 956 });
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const instance = new Module(filename, module);
    instance.filename = filename;
    instance.paths = Module._nodeModulePaths(path.dirname(filename));
    instance.require = name => {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'react-native') return native;
      if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
      if (name === '@react-navigation/native') return { useFocusEffect: fn => hooks.useEffect(fn, [fn]) };
      if (name.includes('AuthSession')) return { useAuth: () => auth };
      if (name.includes('AppStackContext')) return { useAppStack: () => ({ stack }) };
      if (name.includes('navigationRef')) return { navigationRef: { isReady: () => true, navigate: (...a) => navigations.push(a) } };
      if (name.includes('NativeTabBar')) return { useNativeTabBarInset: () => inset };
      if (name.includes('ReadingSettingsProvider')) return {
        useReadingSettings: () => readingSettings,
        useOptionalReadingSettings: () => readingSettings,
      };
      if (name === '@expo/vector-icons/Ionicons') return { __esModule: true, default: 'Icon' };
      if (name === 'react-native-svg') return { __esModule: true, default: 'Svg', Circle: 'Circle', Path: 'Path' };
      if (name.endsWith('.png')) return 1;
      if (name.startsWith('.')) {
        const base = path.resolve(path.dirname(filename), name);
        return load([base, `${base}.ts`, `${base}.tsx`].find(fs.existsSync));
      }
      return require(name);
    };
    const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    // Freeze only the module's clock, not process-wide Date or async timers.
    instance._compile(`const Date = class extends global.Date {
      constructor(...args) { super(...(args.length ? args : ['2026-09-24T12:00:00'])); }
    };\n${compiled}`, filename);
    cache.set(filename, instance.exports);
    return instance.exports;
  }
  const Screen = load(path.resolve(__dirname, '../screens/HomeScreen.tsx')).default;
  function nodes(el) {
    if (!React.isValidElement(el)) return [];
    const resolved = typeof el.type === 'function' ? el.type(el.props) : el;
    if (!resolved) return [];
    if (resolved.type === 'Modal' && !resolved.props.visible) return [resolved];
    return [resolved, ...React.Children.toArray(resolved.props.children).flatMap(nodes)];
  }
  function render() {
    if (disposed) return;
    dirty = false; cursor = 0;
    tree = nodes(Screen());
    effects.splice(0).forEach(fn => fn());
    listeners.forEach(fn => fn());
  }
  render();
  return {
    all: () => tree,
    get: id => tree.find(n => n.props.testID === id),
    navigations,
    themeUpdates,
    settle: () => Promise.all(jobs),
    wait(predicate) {
      if (predicate(tree)) return Promise.resolve();
      return new Promise(resolve => {
        const check = () => { if (predicate(tree)) { listeners.delete(check); resolve(); } };
        listeners.add(check);
      });
    },
    change(next) { Object.assign(auth, next); render(); },
    dispose() { disposed = true; slots.forEach(s => s?.cleanup?.()); },
  };
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const ok = json => ({ ok: true, status: 200, json: async () => json });
const failure = status => ({ ok: false, status, json: async () => ({ success: false }) });
const today = () => '2026-09-24';
const has = id => nodes => nodes.some(n => n.props.testID === id);
function fixtures({ subscriptions = [], calendar = [] } = {}) {
  return async p => {
    if (p === '/api/v1/auth/user/') return ok({ id: 7, nickname: '독자', email: 'r@example.test', has_usable_password_flag: true });
    if (p.includes('/plans/user/')) return ok({ subscriptions, available_plans: [{ id: 3, name: '일독', is_default: true }] });
    if (p.includes('/hasena/')) return ok({ success: true, entries: [{ date: '2000-01-01', title: '이전 영상', passage: '창세기 1장', video_id: 'video' }] });
    if (p.includes('/member-progress/')) return ok({ success: true, calendar: { [today()]: { completed_count: 2, total_members: 4 } } });
    if (p.includes('/groups/')) return ok({ success: true, groups: [{ id: 8, name: '함께', plans: [{ id: 4 }] }] });
    if (p.includes('/calendar/')) {
      const params = new URL(p, 'https://example.test').searchParams;
      return ok({ success: true, data: { calendar: calendar.filter(e =>
        Number(e.date.slice(0, 4)) === Number(params.get('year'))
          && Number(e.date.slice(5, 7)) === Number(params.get('month'))) } });
    }
    if (p.includes('/profile/')) return ok({ success: true, data: { profile: { current_streak: 3 } } });
    if (p.includes('/notifications/')) return ok({ unread_count: 0 });
    if (p.includes('/stats/progress/')) return ok({ success: true, user_progress: 20, end_date: today() });
    throw Error(`unexpected ${p}`);
  };
}

for (const blockedPath of ['/api/v1/todos/hasena/calendar/', '/api/v1/todos/groups/?only_mine=true']) {
  test(`aside cards settle independently when ${blockedPath} remains pending`, { timeout: 2000 }, async t => {
    const pending = deferred(), base = fixtures();
    const h = mount(p => p.startsWith(blockedPath) ? pending.promise : base(p), 'signedIn', 0, 1200);
    t.after(() => h.dispose());
    const blocked = blockedPath.includes('/hasena/') ? 'home-hasena-image' : 'home-group-progress';
    const ready = blocked === 'home-hasena-image' ? 'home-group-progress' : 'home-hasena-image';
    await h.wait(has(ready));
    assert.equal(h.get(blocked), undefined);
    const completed = h.wait(has(blocked));
    pending.resolve(await base(blockedPath));
    await completed;
    h.get('home-group-link').props.onPress();
    assert.deepEqual(h.navigations.at(-1), ['WebView', { url: 'https://beta.example.test/groups/8' }]);
  });
}

test('loading and HTTP error never become empty subscription; retry reaches true empty', { timeout: 2000 }, async t => {
  const pending = deferred(); let fail = true;
  const base = fixtures();
  const h = mount(p => fail ? pending.promise : base(p)); t.after(() => h.dispose());
  assert.ok(h.get('home-loading'));
  assert.equal(h.get('home-empty'), undefined);
  const errored = h.wait(has('home-error'));
  pending.resolve(failure(500)); await errored;
  assert.equal(h.get('home-empty'), undefined);
  assert.equal(h.get('home-stats').props.accessibilityValue.text, '-/7');
  fail = false;
  const ready = h.wait(has('home-empty'));
  h.get('home-retry').props.onPress(); await ready;
});

test('progress failure preserves known profile with unavailable plan statistics and retry', { timeout: 2000 }, async t => {
  const base = fixtures({ subscriptions: [{ id: 1, plan_id: 3, is_active: true }] });
  let fail = true;
  const h = mount(p => fail && p.includes('/stats/progress/') ? Promise.resolve(failure(500)) : base(p));
  t.after(() => h.dispose());
  await h.wait(has('home-error'));
  assert.equal(h.get('home-stats').props.accessibilityValue.text, '-/7');
  assert.equal(h.get('home-stat-flame-outline').props.accessibilityValue.text, '3일');
  assert.equal(h.get('home-stat-book-outline').props.accessibilityValue.text, '-일');
  assert.equal(h.all().filter(n => n.props.testID?.startsWith('home-day-')).length, 7);
  assert.equal(h.get('home-empty'), undefined);
  assert.equal(h.get('home-read-3'), undefined);
  fail = false;
  const ready = h.wait(has('home-read-3'));
  h.get('home-retry').props.onPress();
  await ready;
  assert.equal(h.get('home-error'), undefined);
  assert.equal(h.get('home-stat-book-outline').props.accessibilityValue.text, '0일');
});

test('default active plan, recent records, summaries and complete reader URL reach screen', { timeout: 2000 }, async t => {
  const date = today();
  const calendar = [1, 2, 3, 4].map(n => ({ date: n === 1 ? '2026-09-22' : n === 2 ? '2026-09-23' : date,
    book: '창세기', start_chapter: n,
    end_chapter: n, plan_id: 4, schedule_id: n + 10, is_completed: true }));
  calendar.push({ ...calendar[0], plan_id: 3, schedule_id: 99 });
  const h = mount(fixtures({ subscriptions: [
    { id: 1, plan_id: 3, is_active: true }, { id: 2, plan_id: 4, is_active: true, is_default: true },
  ], calendar }), 'signedIn', 0, 1200); t.after(() => h.dispose());
  await h.wait(has('home-read-4'));
  assert.equal(h.get('home-stats').props.accessibilityValue.text, '3/7');
  assert.deepEqual(h.all().filter(n => n.props.testID?.startsWith('home-recent-')).map(n => n.props.testID),
    ['home-recent-14', 'home-recent-13', 'home-recent-12']);
  await h.wait(has('home-group-progress'));
  assert.equal(h.get('home-group-progress').props.accessibilityValue.now, 50);
  assert.equal(h.get('home-hasena-image').props.source.uri, 'https://i.ytimg.com/vi/video/hqdefault.jpg');
  h.get('home-read-4').props.onPress();
  assert.deepEqual(Object.fromEntries(new URL(h.navigations.at(-1)[1].params.url, 'https://example.test').searchParams),
    { book: 'gen', chapter: '3', schedule: '13', plan: '4', date, tongdok: 'true' });
  h.get('home-read-3').props.onPress();
  assert.equal(h.navigations.at(-1)[1].screen, 'Schedule');
});

test('resend and subscribe failures preserve retry and synchronous double presses send once', { timeout: 2000 }, async t => {
  let pending = deferred(), writes = 0, reads = 0;
  const base = fixtures();
  const h = mount((p, init) => {
    if (init?.method === 'POST') { writes++; return pending.promise; }
    reads++; return base(p);
  }); t.after(() => h.dispose());
  await h.wait(has('home-empty'));
  for (const action of ['resend', 'subscribe']) {
    const before = reads, count = writes;
    const button = h.get(`home-${action}`);
    const first = button.props.onPress(); button.props.onPress();
    assert.equal(writes, count + 1);
    const failed = h.wait(has(`home-${action}-error`));
    pending.resolve(failure(429)); await first; await failed;
    assert.equal(reads, before);
    assert.ok(h.get('home-empty'));
    pending = deferred();
  }
  const success = h.wait(has('home-subscribe-success'));
  const before = reads;
  h.get('home-subscribe').props.onPress();
  pending.resolve(ok({ success: true })); await success;
  assert.ok(reads > before);
  pending = deferred();
  const resent = h.wait(has('home-resend-success'));
  h.get('home-resend').props.onPress();
  pending.resolve(ok({ success: true })); await resent;
});

test('old account response cannot publish after auth replacement', { timeout: 2000 }, async t => {
  const late = deferred(), base = fixtures();
  const h = mount(p => p === '/api/v1/auth/user/' ? late.promise : base(p));
  t.after(() => h.dispose());
  h.change({ status: 'signedOut' });
  h.change({ status: 'signedIn', apiFetch: base });
  await h.wait(has('home-empty'));
  late.resolve(ok({ id: 99, nickname: 'old' }));
  await h.settle();
  assert.equal(h.all().some(n => typeof n.props.children === 'string' && n.props.children.includes('old')), false);
});

test('summary failure keeps dashboard and retry recovers without reporting zero', { timeout: 2000 }, async t => {
  const base = fixtures(); let fail = true;
  const h = mount(p => fail && p.includes('/member-progress/')
    ? Promise.resolve(ok({ success: false })) : base(p), 'signedIn', 0, 1200);
  t.after(() => h.dispose());
  const retryButton = nodes => nodes.find(n => n.props.accessibilityLabel === '읽기 소식 다시 불러오기');
  await h.wait(nodes => has('home-empty')(nodes) && has('home-hasena-image')(nodes) && retryButton(nodes));
  assert.equal(h.get('home-group-progress'), undefined);
  assert.ok(h.get('home-hasena-image'));
  fail = false;
  const ready = h.wait(has('home-group-progress'));
  retryButton(h.all()).props.onPress();
  await ready;
  assert.equal(h.get('home-group-progress').props.accessibilityValue.now, 50);
});

test('native tab overlap is reserved once plus the web twelve point content gap', t => {
  for (const inset of [0, 97]) {
    const h = mount(fixtures(), 'signedOut', inset); t.after(() => h.dispose());
    const scroll = h.all().find(n => n.type === 'ScrollView');
    const style = Object.assign({}, ...[scroll.props.contentContainerStyle].flat());
    assert.equal(style.paddingBottom ?? 0, inset);
    assert.ok(h.all().some(n => n.type === 'View' && n.props.style?.height === 12));
  }
});

test('phone Home suppresses desktop news and recent records without losing shortcuts', { timeout: 2000 }, async t => {
  const calls = [], base = fixtures();
  const h = mount(p => { calls.push(p); return base(p); }); t.after(() => h.dispose());
  await h.wait(has('home-empty'));
  assert.equal(h.get('home-hasena-image'), undefined);
  assert.equal(h.get('home-group-progress'), undefined);
  assert.equal(h.all().some(n => n.props.testID?.startsWith('home-recent-')), false);
  assert.equal(calls.some(p => p.includes('/hasena/') || p.includes('/groups/')), false);
  h.get('home-shortcut-schedule').props.onPress();
  assert.deepEqual(h.navigations.at(-1), ['Main', { screen: 'Schedule' }]);
});

function descendantIds(element) {
  if (!React.isValidElement(element)) return [];
  return [
    ...(element.props.testID ? [element.props.testID] : []),
    ...React.Children.toArray(element.props.children).flatMap(descendantIds),
  ];
}

for (const width of [1023, 1024, 1032, 1600]) {
  test(`Home columns preserve the web hierarchy and geometry at ${width}px`, { timeout: 2000 }, async t => {
    // Given a completed assignment and a fixed clock, load the real Home screen.
    const wide = width >= 1024;
    const h = mount(fixtures({
      subscriptions: [{ id: 1, plan_id: 3, is_active: true }],
      calendar: [{ date: today(), book: '창세기', start_chapter: 1, end_chapter: 1,
        plan_id: 3, schedule_id: 11, is_completed: true }],
    }), 'signedIn', 0, width);
    t.after(() => h.dispose());
    // When the dashboard has received its API data.
    await h.wait(has('home-read-3'));
    // Then the main and aside are siblings; shortcuts follow the whole dashboard.
    const main = h.get('home-main'), aside = h.get('home-aside');
    assert.deepEqual(React.Children.toArray(h.get('home-dashboard').props.children)
      .map(n => n.props.testID), ['home-main', 'home-aside']);
    assert.ok(descendantIds(main).includes('home-hero'));
    assert.ok(descendantIds(main).includes('home-read-3'));
    assert.ok(descendantIds(main).includes('home-stats'));
    assert.equal(descendantIds(main).includes('home-recent'), wide);
    assert.equal(descendantIds(main).includes('home-week'), false);
    assert.ok(descendantIds(aside).includes('home-week'));
    assert.equal(React.Children.toArray(aside.props.children)
      .some(n => n.type.name === 'HomeAside'), wide);
    const scroll = h.all().find(n => n.type === 'ScrollView');
    const order = React.Children.toArray(scroll.props.children).map(n => n.props.testID);
    assert.ok(order.indexOf('home-shortcuts') > order.indexOf('home-dashboard'));
    const content = Object.assign({}, ...[scroll.props.contentContainerStyle].flat());
    assert.equal(content.paddingHorizontal, wide ? 40 : 20);
    assert.equal(content.paddingTop, wide ? 36 : 0);
    assert.equal(h.get('home-header').props.style.justifyContent, wide ? 'flex-end' : 'space-between');
    assert.equal(React.Children.toArray(h.get('home-header').props.children)
      .some(n => n.type === 'Image'), !wide);
    assert.equal(h.get('home-dashboard').props.style.flexDirection, wide ? 'row' : 'column');
    const contentWidth = Math.min(width - (wide ? 240 : 0), content.maxWidth)
      - content.paddingHorizontal * 2;
    const mainWidth = wide ? main.props.style.width : contentWidth;
    if (wide) {
      assert.equal(main.props.style.minWidth, 0);
      assert.equal(main.props.style.maxWidth, 760);
      assert.equal(aside.props.style.width, 300);
      assert.equal(aside.props.style.flexShrink, 0);
      assert.equal(mainWidth + h.get('home-dashboard').props.style.columnGap + 300, contentWidth);
      assert.equal(h.get('home-shortcuts').props.style.width, mainWidth);
    } else {
      assert.equal(aside.props.style.width, undefined);
      assert.equal(main.props.style.width, undefined);
    }
    assert.equal(h.get('home-shortcut-schedule').props.style.width * 2 + 8, mainWidth);
    const ring = h.get('home-progress-ring');
    assert.equal(ring.props.style.width, wide ? 120 : 88);
    const svg = React.Children.toArray(ring.props.children)[0];
    assert.equal(svg.props.width, wide ? 120 : 88);
    assert.equal(React.Children.toArray(svg.props.children)[0].props.strokeWidth, wide ? 10 : 8);
    const stat = h.get('home-stat-flame-outline');
    const valueRow = React.Children.toArray(stat.props.children)[1];
    assert.equal(React.Children.toArray(valueRow.props.children)[0].props.style.fontSize, wide ? 28 : 24);
  });
}

test('tablet loading and error remain in the main column beside the week', { timeout: 2000 }, async t => {
  const pending = deferred();
  const h = mount(() => pending.promise, 'signedIn', 0, 1024);
  t.after(() => h.dispose());
  assert.ok(descendantIds(h.get('home-main')).includes('home-loading'));
  assert.ok(descendantIds(h.get('home-aside')).includes('home-week'));
  const errored = h.wait(has('home-error'));
  pending.resolve(failure(500));
  await errored;
  assert.ok(descendantIds(h.get('home-main')).includes('home-error'));
  assert.ok(descendantIds(h.get('home-aside')).includes('home-week'));
});

test('guest login and nested plan management navigate independently without private requests', t => {
  const calls = [];
  const h = mount(p => { calls.push(p); throw Error('guest private request'); }, 'signedOut');
  t.after(() => h.dispose());
  h.get('home-login').props.onPress();
  assert.deepEqual(h.navigations.at(-1), ['Login']);
  h.get('home-shortcut-schedule').props.onPress();
  assert.deepEqual(h.navigations.at(-1), ['Main', { screen: 'Schedule' }]);
  h.get('home-shortcut-plans').props.onPress();
  assert.deepEqual(h.navigations.at(-1), ['WebView', { url: 'https://beta.example.test/plans' }]);
  assert.deepEqual(calls, []);
});

test('notification failure does not replace valid reading data with dashboard error', { timeout: 2000 }, async t => {
  const base = fixtures();
  const h = mount(p => p.includes('/notifications/') ? Promise.resolve(failure(500)) : base(p));
  t.after(() => h.dispose());
  await h.wait(has('home-empty'));
  assert.equal(h.get('home-error'), undefined);
  assert.equal(h.get('home-stat-flame-outline').props.accessibilityValue.text, '3일');
});

test('progress end date controls remaining days without downloading full schedules', { timeout: 2000 }, async t => {
  const calls = [], base = fixtures({ subscriptions: [{ id: 1, plan_id: 3, is_active: true }] });
  const h = mount(p => {
    calls.push(p);
    return p.includes('/stats/progress/')
      ? Promise.resolve(ok({ success: true, user_progress: 23.8, end_date: '2026-10-01' }))
      : base(p);
  }); t.after(() => h.dispose());
  await h.wait(has('home-read-3'));
  assert.equal(h.get('home-stat-book-outline').props.accessibilityValue.text, '7일');
  assert.equal(calls.some(p => p.includes('/schedules/')), false);
  h.get('home-read-3').props.onPress();
  assert.equal(h.navigations.at(-1)[1].screen, 'Schedule');
});

test('an empty plan catalog offers the schedule without creating an invalid subscription', { timeout: 2000 }, async t => {
  const base = fixtures(), writes = [];
  const h = mount((p, init) => {
    if (init?.method === 'POST') writes.push(p);
    return p.includes('/plans/user/')
      ? Promise.resolve(ok({ subscriptions: [], available_plans: [] })) : base(p);
  }); t.after(() => h.dispose());
  await h.wait(has('home-empty'));
  assert.equal(h.get('home-subscribe'), undefined);
  h.get('home-empty-schedule').props.onPress();
  assert.deepEqual(h.navigations.at(-1), ['Main', { screen: 'Schedule' }]);
  assert.deepEqual(writes, []);
});

test('guest menu opens natively and its legal action closes it before navigation', { timeout: 2000 }, async t => {
  const h = mount(fixtures(), 'signedOut'); t.after(() => h.dispose());
  const opened = h.wait(has('home-menu-/privacy'));
  h.get('home-menu-open').props.onPress(); await opened;
  const closed = h.wait(nodes => !has('home-menu-/privacy')(nodes));
  h.get('home-menu-/privacy').props.onPress(); await closed;
  assert.deepEqual(h.navigations.at(-1), ['WebView', { url: 'https://beta.example.test/privacy' }]);
});

test('guest theme control updates the shared settings in both directions', t => {
  const h = mount(fixtures(), 'signedOut'); t.after(() => h.dispose());
  h.get('home-theme-toggle').props.onPress();
  assert.deepEqual(h.themeUpdates, [['theme', 'dark']]);
  const logo = h.all().find(n => n.type === 'Image');
  assert.equal(logo.props.tintColor, '#FFFFFF');
  h.get('home-theme-toggle').props.onPress();
  assert.deepEqual(h.themeUpdates, [['theme', 'dark'], ['theme', 'light']]);
});

test('two shortcut columns fit small phones and the last guest tile does not stretch', t => {
  for (const width of [320, 375, 440]) {
    const h = mount(fixtures(), 'signedOut', 0, width); t.after(() => h.dispose());
    const tile = h.all().find(n => n.type === 'TouchableOpacity' && n.props.accessibilityLabel === '내 활동');
    assert.equal(tile.props.style.width * 2 + 8 + 40, width);
    assert.equal(tile.props.style.flexGrow, 0);
    const parent = h.all().find(n => n.type === 'View'
      && Array.isArray(n.props.style) && n.props.style.some(s => s?.flexWrap === 'wrap'));
    assert.ok(parent);
  }
});
