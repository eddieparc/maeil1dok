const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');

// Execute the actual screen and callbacks. Only hooks, navigation and native hosts
// are substituted; API promises are explicitly released, never time-polled.
function mount(apiFetch, status = 'signedIn', inset = 0) {
  const slots = [], effects = [], jobs = [], listeners = new Set(), cache = new Map(), navigations = [];
  let cursor = 0, tree, dirty = false, disposed = false;
  const auth = { status, apiFetch };
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
      if (name === '@expo/vector-icons/Ionicons') return { __esModule: true, default: 'Icon' };
      if (name === 'react-native-svg') return { __esModule: true, default: 'Svg', Circle: 'Circle' };
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
    if (p.includes('/stats/progress/')) return ok({ success: true, user_progress: 20 });
    if (p.includes('/schedules/')) return ok([{ date: today() }]);
    throw Error(`unexpected ${p}`);
  };
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
  assert.equal(h.get('home-stats'), undefined);
  fail = false;
  const ready = h.wait(has('home-empty'));
  h.get('home-retry').props.onPress(); await ready;
});

test('partial API failure is an error, not fabricated zero progress', { timeout: 2000 }, async t => {
  const base = fixtures({ subscriptions: [{ id: 1, plan_id: 3, is_active: true }] });
  const h = mount(p => p.includes('/stats/progress/') ? Promise.resolve(failure(500)) : base(p));
  t.after(() => h.dispose());
  await h.wait(has('home-error'));
  assert.equal(h.get('home-stats'), undefined);
});

test('default active plan, recent records, summaries and complete reader URL reach screen', { timeout: 2000 }, async t => {
  const date = today();
  const calendar = [1, 2, 3, 4].map(n => ({ date: n === 1 ? '2026-09-22' : n === 2 ? '2026-09-23' : date,
    book: '창세기', start_chapter: n,
    end_chapter: n, plan_id: 4, schedule_id: n + 10, is_completed: true }));
  calendar.push({ ...calendar[0], plan_id: 3, schedule_id: 99 });
  const h = mount(fixtures({ subscriptions: [
    { id: 1, plan_id: 3, is_active: true }, { id: 2, plan_id: 4, is_active: true, is_default: true },
  ], calendar })); t.after(() => h.dispose());
  await h.wait(has('home-stats'));
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
    ? Promise.resolve(ok({ success: false })) : base(p));
  t.after(() => h.dispose());
  const retryButton = nodes => nodes.find(n => n.props.accessibilityLabel === '읽기 소식 다시 불러오기');
  await h.wait(nodes => has('home-stats')(nodes) && retryButton(nodes));
  assert.equal(h.get('home-group-progress'), undefined);
  assert.ok(h.get('home-hasena-image'));
  fail = false;
  const ready = h.wait(has('home-group-progress'));
  retryButton(h.all()).props.onPress();
  await ready;
  assert.equal(h.get('home-group-progress').props.accessibilityValue.now, 50);
});

test('Android zero overlap keeps original content and spacer padding; iOS adds inset', t => {
  for (const inset of [0, 97]) {
    const h = mount(fixtures(), 'signedOut', inset); t.after(() => h.dispose());
    const scroll = h.all().find(n => n.type === 'ScrollView');
    const style = Object.assign({}, ...[scroll.props.contentContainerStyle].flat());
    assert.equal(style.paddingBottom ?? 0, inset);
    assert.ok(h.all().some(n => n.type === 'View' && n.props.style?.height === 24));
  }
});
