const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');

const ok = data => ({ ok: true, status: 200, json: async () => data });
const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};
const row = (id, date, overrides = {}) => ({
  id, date, plan: 3, book: id === 12 ? 'exo' : 'gen',
  start_chapter: 1, end_chapter: 2, is_completed: false, ...overrides,
});
const plans = [
  { id: 1, plan_id: 3, plan_name: 'Plan A', is_active: true, is_default: true },
  { id: 2, plan_id: 4, plan_name: 'Plan B', is_active: true },
];
const token = id => `header.${Buffer.from(JSON.stringify({ user_id: id })).toString('base64url')}.signature`;
const palette = {
  light: { background: '#FAF8F5', surface: '#FFFFFF', surfaceMuted: '#F1EFED',
    text: '#1F1A17', textSecondary: '#6B625B', textMuted: '#9B928A', border: '#E9E4DE',
    accent: '#2A1111', accentSurface: '#F3EEEE', onAccent: '#FFFFFF', error: '#B3261E', scrim: '#00000077' },
  dark: { background: '#1a1a1a', surface: '#242424', surfaceMuted: '#2d2d2d',
    text: '#f3f4f6', textSecondary: '#d1d5db', textMuted: '#9ca3af', border: '#3d3d3d',
    accent: '#F3EEEE', accentSurface: '#3A2A2A', onAccent: '#1F1A17', error: '#F28B82', scrim: '#000000aa' },
};
const year = (months = []) => ({ success: true, monthly_progress: months });

test('embedded schedule returns selected reading and closes without changing the root tab', async t => {
  const readings = [];
  let closed = 0;
  const h = harness({ onRead: url => readings.push(url), onClose: () => closed++ });
  t.after(h.dispose);
  await h.act();
  await h.act(() => h.press('출애굽기 1–2장'));
  await h.act(() => h.get('schedule-dialog-confirm').props.onPress());
  assert.equal(new URL(readings[0], 'https://test').searchParams.get('schedule'), '12');
  await h.act(() => h.nodes().find(n => n.props.accessibilityLabel === '뒤로 가기').props.onPress());
  assert.equal(closed, 1);
  assert.deepEqual(h.navigations, []);
});

test('iOS reading selection waits for confirmation dismissal before closing its parent', async t => {
  const readings = [];
  const h = harness({ inset: 34, onRead: url => readings.push(url) });
  t.after(h.dispose);
  await h.act();
  await h.act(() => h.press('출애굽기 1–2장'));
  const modal = h.nodes().find(n => n.type === 'Modal' && n.props.onDismiss);
  await h.act(() => h.get('schedule-dialog-confirm').props.onPress());
  assert.deepEqual(readings, []);
  assert.ok(modal, 'confirmation owns a native dismissal callback');
  await h.act(() => modal.props.onDismiss());
  assert.equal(readings.length, 1);
  await h.act(() => modal.props.onDismiss());
  assert.equal(readings.length, 1);
});

for (const initialPlanId of [3, null]) {
  test(`embedded plan ${initialPlanId} takes precedence over a stale reader URL`, async t => {
    const h = harness({ url: '/bible?book=gen&chapter=1&plan=4', initialPlanId, storedPlan: '3' });
    t.after(h.dispose);
    await h.act();
    const requests = h.calls.filter(call => call.url.includes('/schedules/month/'));
    assert.ok(requests.length > 0);
    assert.equal(new URL(requests.at(-1).url, 'https://test').searchParams.get('plan_id'), '3');
    assert.equal(requests.some(call => new URL(call.url, 'https://test').searchParams.get('plan_id') === '4'), false);
  });
}

// The TSX and its callbacks execute unchanged. Only native host components,
// navigation and the hook dispatcher are replaced (no renderer is installed).
// act drains the current event-loop turn, not a timed sleep or polling loop.
function harness({ fetch, inset = 0, status = 'signedIn', storedPlan = '3', url, theme = 'light', onRead, onClose, initialPlanId } = {}) {
  const slots = [];
  let index = 0, queued = false, tree, mounted = true, focused = true;
  let effects = [];
  const alerts = [], navigations = [], scrolls = [], calls = [];
  const auth = { status, accessToken: status === 'signedIn' ? token(1) : null };
  const stack = { api: 'https://api.test', web: 'https://web.test' };
  const route = { params: { url } };
  const storage = new Map([
    ['schedule:selectedPlan:https://api.test:1', storedPlan],
    ['schedule:selectedPlan:https://api.test:2', '4'],
    ['schedule:selectedPlan:https://beta-api.test:1', '4'],
  ]);
  auth.apiFetch = (url, init) => {
    calls.push({ url, init });
    if (fetch) return fetch(url, init);
    if (init?.method === 'POST') return Promise.resolve(ok({ success: true }));
    if (url.endsWith('/plan/')) return Promise.resolve(ok(plans));
    if (url.includes('/stats/progress/')) return Promise.resolve(ok(year()));
    return Promise.resolve(ok([
      row(11, '2026-09-17'), row(12, '2026-09-17'), row(13, '2026-09-18'),
    ]));
  };
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const schedule = () => {
    if (queued || !mounted) return;
    queued = true;
    queueMicrotask(() => { queued = false; if (mounted) render(); });
  };
  const hooks = {
    ...React,
    useState(initial) {
      const i = index++;
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, value => {
        const next = typeof value === 'function' ? value(slots[i].value) : value;
        if (!Object.is(next, slots[i].value)) { slots[i].value = next; schedule(); }
      }];
    },
    useRef(initial) {
      const i = index++;
      if (!slots[i]) slots[i] = { current: initial };
      return slots[i];
    },
    useMemo(fn, deps) {
      const i = index++;
      if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: fn(), deps };
      return slots[i].value;
    },
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const i = index++;
      if (!slots[i] || !same(slots[i].deps, deps)) {
        const old = slots[i];
        slots[i] = { deps, cleanup: old?.cleanup };
        effects.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); });
      }
    },
  };
  hooks.useLayoutEffect = hooks.useEffect;
  const native = {
    ActivityIndicator: 'ActivityIndicator', Modal: 'Modal', ScrollView: 'ScrollView',
    Text: 'Text', TouchableOpacity: 'TouchableOpacity', View: 'View', Pressable: 'Pressable',
    StyleSheet: { create: v => v }, Platform: { OS: inset ? 'ios' : 'android' },
    Alert: { alert: (...args) => alerts.push(args) },
    useColorScheme: () => 'light',
  };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const instance = new Module(filename, module);
    instance.paths = Module._nodeModulePaths(path.dirname(filename));
    const base = instance.require.bind(instance);
    instance.require = name => {
      if (name === 'react') return hooks;
      if (name === 'react-native') return native;
      if (name === '@expo/vector-icons/Ionicons') return { __esModule: true, default: 'Icon' };
      if (name === 'react-native-svg') return { __esModule: true, default: 'Svg', Circle: 'Circle', Path: 'Path', Rect: 'Rect' };
      if (name === '@react-native-async-storage/async-storage') return {
        __esModule: true, default: {
          getItem: async key => storage.get(key) ?? null,
          setItem: async (key, value) => { storage.set(key, value); },
        },
      };
      if (name.endsWith('/ui/tokens')) return { colors: palette, useNativeColors: () => palette[theme] };
      if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
      if (name === '@react-navigation/native') return {
        useFocusEffect: fn => hooks.useEffect(() => focused ? fn() : undefined, [fn, focused]),
        useRoute: () => route,
      };
      if (name.endsWith('/AuthSession')) return { useAuth: () => auth };
      if (name.endsWith('/AppStackContext')) return { useAppStack: () => ({ stack }) };
      if (name.endsWith('/NativeTabBar')) return { useNativeTabBarInset: () => inset };
      if (name.endsWith('/navigationRef')) return {
        navigationRef: { isReady: () => true, navigate: (...args) => navigations.push(args) },
      };
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(filename), name);
        return load([`${target}.ts`, `${target}.tsx`].find(fs.existsSync));
      }
      return base(name);
    };
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      fileName: filename,
    }).outputText;
    instance._compile(source, filename);
    cache.set(filename, instance.exports);
    return instance.exports;
  }
  const Screen = load(path.resolve(__dirname, '../screens/ScheduleScreen.tsx')).default;
  function resolve(el, parent = null) {
    if (!React.isValidElement(el)) return el;
    if (typeof el.type === 'function') return resolve(el.type(el.props), parent);
    if (el.type === 'Modal' && el.props.visible === false) return null;
    const node = { type: el.type, props: el.props, parent, children: [] };
    if (el.type === 'ScrollView' && el.props.ref) el.props.ref.current = {
      scrollTo: options => scrolls.push(options),
    };
    node.children = React.Children.toArray(el.props.children).map(c => resolve(c, node));
    return node;
  }
  function render() {
    index = 0;
    tree = resolve(Screen({ onRead, onClose, initialPlanId }));
    const pending = effects;
    effects = [];
    pending.forEach(fn => fn());
  }
  const nodes = () => {
    const visit = node => typeof node === 'object' && node
      ? [node, ...node.children.flatMap(visit)] : [];
    return visit(tree);
  };
  const text = node => typeof node === 'string' || typeof node === 'number'
    ? String(node) : node?.children.map(text).join('') ?? '';
  const button = label => {
    let node = nodes().find(n => n.type === 'Text' && text(n) === label);
    while (node && !node.props.onPress) node = node.parent;
    assert.ok(node, `button ${label} exists`);
    return node;
  };
  const press = label => {
    const node = button(label);
    assert.equal(Boolean(node.props.disabled), false, `${label} is enabled`);
    return node.props.onPress();
  };
  const get = id => nodes().find(n => n.props.testID === id);
  const list = () => get('schedule-list');
  const cards = () => nodes().filter(n => n.props.testID?.startsWith('schedule-day-'));
  const layoutList = (height = 500) => list().props.onLayout({ nativeEvent: { layout: { height } } });
  const layoutCard = (card, y, height = 74) => card.props.onLayout({ nativeEvent: { layout: { y, height } } });
  const layoutMonthStrip = (width = 400) => nodes().find(n => n.props.horizontal)
    .props.onLayout({ nativeEvent: { layout: { width } } });
  const act = async fn => {
    await fn?.();
    await new Promise(setImmediate);
  };
  render();
  return {
    act, nodes, text, button, press, get, list, cards, layoutList, layoutCard, layoutMonthStrip,
    alerts, navigations, scrolls, calls, auth, stack, storage, route,
    setTheme: value => { theme = value; render(); },
    focus: value => { focused = value; render(); },
    render,
    dispose() { mounted = false; slots.forEach(s => s.cleanup?.()); },
  };
}

test.beforeEach(t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-22T12:00:00Z') });
});

test('month strip reveals the selected month when chip layout arrives', async t => {
  const h = harness();
  t.after(h.dispose);
  await h.act();

  h.layoutMonthStrip();
  h.button('9월').props.onLayout({ nativeEvent: { layout: { x: 600, width: 56 } } });

  assert.deepEqual(h.scrolls, [{ x: 428, animated: false }]);
});

test('month strip returns to an earlier selected month without waiting for new layout', async t => {
  const h = harness();
  t.after(h.dispose);
  await h.act();
  h.layoutMonthStrip();
  h.button('1월').props.onLayout({ nativeEvent: { layout: { x: 20, width: 56 } } });
  h.button('9월').props.onLayout({ nativeEvent: { layout: { x: 600, width: 56 } } });
  h.scrolls.length = 0;

  await h.act(() => h.press('1월'));

  assert.deepEqual(h.scrolls.filter(s => s.x !== undefined), [{ x: 0, animated: false }]);
});

test('S1 one tap crosses month and consumes pending date only after target layout', async t => {
  const august = deferred();
  const h = harness({ fetch: url => {
    if (url.endsWith('/plan/')) return Promise.resolve(ok(plans));
    if (url.includes('next-position')) return Promise.resolve(ok({ status: 'next_incomplete', date: '2026-08-17' }));
    if (url.includes('month=8&')) return august.promise;
    return Promise.resolve(ok([]));
  } });
  t.after(h.dispose);
  await h.act();
  h.layoutList();
  await h.act(() => h.press('마지막 미완료'));
  assert.equal(h.scrolls.length, 0);
  await h.act(() => august.resolve(ok([row(11, '2026-08-17')])));
  assert.equal(h.scrolls.length, 0);
  await h.act(() => h.layoutCard(h.cards()[0], 420));
  assert.equal(h.scrolls.length, 1);
  assert.equal(h.scrolls[0].y, 207);
  await h.act(() => h.layoutCard(h.cards()[0], 430));
  assert.equal(h.scrolls.length, 1);
});

test('S1 terminal next-position statuses display feedback without a date', async t => {
  let position = 'no_schedule';
  const h = harness({ fetch: url => Promise.resolve(ok(url.endsWith('/plan/') ? plans
    : url.includes('next-position') ? { status: position, message: 'Server feedback' } : [])) });
  t.after(h.dispose);
  await h.act();
  await h.act(() => h.press('마지막 미완료'));
  assert.equal(h.alerts.length, 1);
  position = 'all_completed';
  await h.act(() => h.press('마지막 미완료'));
  assert.equal(h.alerts.length, 2);
  assert.equal(h.scrolls.length, 0);
});

test('S2 a late month response cannot overwrite a newer month', async t => {
  const august = deferred();
  const h = harness({ fetch: url => {
    if (url.endsWith('/plan/')) return Promise.resolve(ok(plans));
    if (url.includes('month=8&')) return august.promise;
    return Promise.resolve(ok(url.includes('month=10&') ? [row(31, '2026-10-03')] : []));
  } });
  t.after(h.dispose);
  await h.act();
  await h.act(() => h.press('8월'));
  await h.act(() => h.press('10월'));
  await h.act(() => august.resolve(ok([row(11, '2026-08-17')])));
  assert.ok(h.nodes().some(n => h.text(n) === '10/3(토)'));
  assert.equal(h.nodes().some(n => h.text(n) === '8/17(월)'), false);
});

test('S2 focus return refreshes current month progress', async t => {
  let completed = false;
  const h = harness({ fetch: url => Promise.resolve(ok(url.endsWith('/plan/') ? plans
    : [row(11, '2026-09-17', { is_completed: completed })])) });
  t.after(h.dispose);
  await h.act();
  await h.act(() => h.focus(false));
  completed = true;
  await h.act(() => h.focus(true));
  assert.ok(h.nodes().some(n => h.text(n) === '1/1일 완료 · 100%'));
});

test('S3 second row confirms then navigates with its own native reader context', async t => {
  const h = harness();
  t.after(h.dispose);
  await h.act();
  await h.act(() => h.press('출애굽기 1–2장'));
  assert.equal(h.navigations.length, 0);
  assert.ok(h.get('schedule-dialog-confirm'));
  await h.act(() => h.get('schedule-dialog-cancel').props.onPress());
  assert.equal(h.navigations.length, 0);
  await h.act(() => h.press('출애굽기 1–2장'));
  await h.act(() => h.get('schedule-dialog-confirm').props.onPress());
  assert.equal(h.navigations[0][0], 'Main');
  assert.equal(h.navigations[0][1].screen, 'Bible');
  const params = new URL(h.navigations[0][1].params.url, 'https://test').searchParams;
  assert.deepEqual(Object.fromEntries(params), {
    book: 'exo', chapter: '1', plan: '3', schedule: '12',
    date: '2026-09-17', tongdok: 'true', from: 'plan',
  });
});

test('S4 failed bulk update rolls back and retains range for successful retry', async t => {
  const write = deferred();
  let attempt = 0;
  const h = harness({ fetch: (url, init) => {
    if (init?.method === 'POST') { attempt++; return attempt === 1 ? write.promise : Promise.resolve(ok({ success: true })); }
    return Promise.resolve(ok(url.endsWith('/plan/') ? plans
      : [row(11, '2026-09-17'), row(12, '2026-09-17'), row(13, '2026-09-18')]));
  } });
  t.after(h.dispose);
  await h.act();
  await h.act(() => h.press('일괄수정'));
  await h.act(() => h.press('9/17(목)'));
  await h.act(() => h.press('9/18(금)'));
  const submit = h.button('읽음').props.onPress;
  await h.act(() => { submit(); submit(); });
  assert.equal(attempt, 1);
  await h.act(() => write.resolve({ ok: false, status: 500 }));
  assert.ok(h.nodes().some(n => h.text(n) === '0/2일 완료 · 0%'));
  assert.equal(h.button('읽음').props.disabled, false);
  await h.act(() => h.press('읽음'));
  assert.equal(attempt, 2);
  assert.ok(h.nodes().some(n => h.text(n) === '2/2일 완료 · 100%'));
  assert.ok(h.button('일괄수정'));
});

test('S4 month change clears selected range', async t => {
  const h = harness();
  t.after(h.dispose);
  await h.act();
  await h.act(() => h.press('일괄수정'));
  await h.act(() => h.press('9/17(목)'));
  await h.act(() => h.press('9/18(금)'));
  await h.act(() => h.press('10월'));
  const bulkRead = h.nodes().find(n => n.props.onPress && h.text(n) === '읽음');
  assert.ok(!bulkRead || bulkRead.props.disabled);
});

test('S5 top action appears strictly above 300 and preserves Android padding', async t => {
  const h = harness();
  t.after(h.dispose);
  await h.act();
  const padding = Object.assign({}, ...h.list().props.contentContainerStyle);
  assert.equal(padding.paddingBottom, 0);
  assert.ok(h.list().children.some(n => n?.props?.style?.height === 40));
  assert.equal(typeof h.list().props.onScroll, 'function');
  await h.act(() => h.list().props.onScroll({ nativeEvent: { contentOffset: { y: 300 } } }));
  assert.equal(h.nodes().some(n => n.props.accessibilityLabel === '맨 위로'), false);
  await h.act(() => h.list().props.onScroll({ nativeEvent: { contentOffset: { y: 301 } } }));
  const top = h.nodes().find(n => n.props.accessibilityLabel === '맨 위로');
  assert.equal(top.props.accessibilityRole, 'button');
  await h.act(() => top.props.onPress());
  assert.equal(h.scrolls.at(-1).y, 0);
});

test('S1 today jumps back from another month after the September layout', async t => {
  const h = harness({ fetch: url => Promise.resolve(ok(url.endsWith('/plan/') ? plans
    : url.includes('month=9&') ? [row(11, '2026-09-22')] : [])) });
  t.after(h.dispose);
  await h.act();
  h.layoutList();
  await h.act(() => h.press('8월'));
  h.scrolls.length = 0;
  await h.act(() => h.press('오늘'));
  assert.equal(h.scrolls.length, 0);
  await h.act(() => h.layoutCard(h.cards()[0], 550));
  assert.equal(h.scrolls.at(-1).y, 337);
});

test('S1 manual month selection supersedes an in-flight position lookup', async t => {
  const position = deferred();
  const h = harness({ fetch: url => url.includes('next-position') ? position.promise
    : Promise.resolve(ok(url.endsWith('/plan/') ? plans : [])) });
  t.after(h.dispose);
  await h.act();
  await h.act(() => h.press('마지막 미완료'));
  await h.act(() => h.press('10월'));
  await h.act(() => position.resolve(ok({ status: 'next_incomplete', date: '2026-08-17' })));
  assert.ok(h.nodes().some(n => h.text(n) === '2026년 10월'));
  assert.deepEqual(h.scrolls, [{ y: 0, animated: false }]);
});

test('S2 same-month responses from a previous year cannot replace the new year', async t => {
  const oldSeptember = deferred();
  let refreshing = false;
  const h = harness({ fetch: url => {
    if (url.endsWith('/plan/')) return Promise.resolve(ok(plans));
    if (url.includes('next-position')) return Promise.resolve(ok({ status: 'next_incomplete', date: '2025-09-17' }));
    if (url.includes('month=9&year=2026')) return refreshing ? oldSeptember.promise : Promise.resolve(ok([]));
    return Promise.resolve(ok(url.includes('month=9&year=2025') ? [row(20, '2025-09-17')] : []));
  } });
  t.after(h.dispose);
  await h.act();
  await h.act(() => h.focus(false));
  refreshing = true;
  await h.act(() => h.focus(true));
  await h.act(() => h.press('마지막 미완료'));
  await h.act(() => oldSeptember.resolve(ok([row(11, '2026-09-17')])));
  assert.ok(h.nodes().some(n => h.text(n) === '2025년 9월'));
  assert.ok(h.nodes().some(n => h.text(n) === '9/17(수)'));
  assert.equal(h.nodes().some(n => h.text(n) === '9/17(목)'), false);
});

test('S2 new plan hides old dots and discards an annual summary JSON completion', async t => {
  const lateJson = deferred(), planB = deferred();
  const h = harness({ fetch: url => {
    if (url.endsWith('/plan/')) return Promise.resolve(ok(plans));
    if (url.includes('plan_id=4')) return planB.promise;
    if (url.includes('/stats/progress/')) return Promise.resolve({ ok: true, json: () => lateJson.promise });
    return Promise.resolve(ok([row(11, '2026-09-17', { is_completed: true })]));
  } });
  t.after(h.dispose);
  await h.act();
  const dot = month => h.button(`${month}월`).children.some(n => n?.type === 'View');
  assert.equal(dot(9), true);
  await h.act(() => h.press('Plan A'));
  await h.act(() => h.press('Plan B'));
  assert.equal(dot(9), false);
  await h.act(() => lateJson.resolve(year([{ month: 2, done: 1, total: 1 }])));
  assert.equal(dot(2), false);
  await h.act(() => planB.resolve(ok([row(41, '2026-09-19', { plan: 4 })])));
  assert.ok(h.nodes().some(n => h.text(n) === '9/19(토)'));
});

for (const change of ['account', 'stack']) {
  test(`S2 ${change} replacement discards old monthly responses`, async t => {
    const oldMonth = deferred();
    let replaced = false;
    const h = harness({ fetch: url => {
      if (url.endsWith('/plan/')) return Promise.resolve(ok(replaced ? [plans[1]] : plans));
      if (!replaced && url.includes('month=9&')) return oldMonth.promise;
      return Promise.resolve(ok(replaced ? [row(41, '2026-09-19', { plan: 4 })] : []));
    } });
    t.after(h.dispose);
    await h.act();
    await h.act(() => {
      replaced = true;
      if (change === 'account') h.auth.accessToken = token(2);
      else h.stack.api = 'https://beta-api.test';
      h.render();
    });
    await h.act(() => oldMonth.resolve(ok([row(11, '2026-09-17')])));
    assert.ok(h.nodes().some(n => h.text(n) === '9/19(토)'));
    assert.equal(h.nodes().some(n => h.text(n) === '9/17(목)'), false);
  });
}

test('S2 newer same-context focus request wins over an older response', async t => {
  const oldMonth = deferred();
  let currentReads = 0;
  const h = harness({ fetch: url => {
    if (url.endsWith('/plan/')) return Promise.resolve(ok(plans));
    if (url.includes('month=9&')) {
      currentReads++;
      return currentReads === 1 ? oldMonth.promise
        : Promise.resolve(ok([row(11, '2026-09-17', { is_completed: true })]));
    }
    return Promise.resolve(ok([]));
  } });
  t.after(h.dispose);
  await h.act();
  await h.act(() => h.focus(false));
  await h.act(() => h.focus(true));
  await h.act(() => oldMonth.resolve(ok([row(11, '2026-09-17')])));
  assert.ok(h.nodes().some(n => h.text(n) === '1/1일 완료 · 100%'));
});

test('S3 group and row checks write only their IDs and never open the reader', async t => {
  const h = harness();
  t.after(h.dispose);
  await h.act();
  const checks = () => h.nodes().filter(n => n.props.accessibilityRole === 'checkbox');
  await h.act(() => checks()[0].props.onPress());
  await h.act(() => checks()[2].props.onPress());
  assert.deepEqual(h.calls.filter(c => c.init?.method === 'POST').map(c => JSON.parse(c.init.body)), [
    { plan_id: 3, schedule_ids: [11, 12], action: 'complete' },
    { plan_id: 3, schedule_ids: [12], action: 'cancel' },
  ]);
  assert.equal(h.alerts.length, 0);
  assert.equal(h.navigations.length, 0);
});

test('S3 group date confirms first row and stale confirmation cannot navigate', async t => {
  const h = harness();
  t.after(h.dispose);
  await h.act();
  await h.act(() => h.press('9/17(목)'));
  await h.act(() => h.get('schedule-dialog-confirm').props.onPress());
  assert.equal(new URL(h.navigations[0][1].params.url, 'https://test').searchParams.get('schedule'), '11');
  await h.act(() => h.press('출애굽기 1–2장'));
  const confirm = h.get('schedule-dialog-confirm').props.onPress;
  await h.act(() => h.press('10월'));
  await h.act(confirm);
  assert.equal(h.navigations.length, 1);
});

test('S4 plan change clears range and late failed writes cannot roll back another account', async t => {
  const write = deferred();
  const h = harness({ fetch: (url, init) => init?.method === 'POST' ? write.promise
    : Promise.resolve(ok(url.endsWith('/plan/') ? plans
      : [row(11, '2026-09-17'), row(13, '2026-09-18')])) });
  t.after(h.dispose);
  await h.act();
  await h.act(() => h.press('일괄수정'));
  await h.act(() => h.press('9/17(목)'));
  await h.act(() => h.press('9/18(금)'));
  await h.act(() => h.press('Plan A'));
  await h.act(() => h.press('Plan B'));
  assert.ok(h.button('일괄수정'));
  await h.act(() => h.press('일괄수정'));
  await h.act(() => h.press('9/17(목)'));
  await h.act(() => h.press('9/18(금)'));
  await h.act(() => h.press('읽음'));
  await h.act(() => { h.auth.accessToken = token(2); h.render(); });
  await h.act(() => write.resolve({ ok: false, status: 500 }));
  assert.equal(h.alerts.length, 0);
  assert.ok(h.button('일괄수정'));
});

test('S5 iOS top action and bulk bar sit above floating tab inset', async t => {
  const h = harness({ inset: 97 });
  t.after(h.dispose);
  await h.act();
  assert.equal(Object.assign({}, ...h.list().props.contentContainerStyle).paddingBottom, 97);
  await h.act(() => h.press('일괄수정'));
  await h.act(() => h.list().props.onScroll({ nativeEvent: { contentOffset: { y: 301 } } }));
  const top = h.nodes().find(n => n.props.accessibilityLabel === '맨 위로');
  assert.ok(Object.assign({}, ...top.parent.props.style).bottom > 97);
  await h.act(() => h.list().props.onScroll({ nativeEvent: { contentOffset: { y: 300 } } }));
  assert.equal(h.nodes().some(n => n.props.accessibilityLabel === '맨 위로'), false);
});

test('S5 last card clearance includes the visible floating top action', async t => {
  const h = harness({ inset: 97 });
  t.after(h.dispose);
  await h.act();

  await h.act(() => h.list().props.onScroll({ nativeEvent: { contentOffset: { y: 301 } } }));

  const top = h.nodes().find(n => n.props.accessibilityLabel === '맨 위로');
  const topOffset = Object.assign({}, ...top.parent.props.style).bottom;
  const clearance = Object.assign({}, ...h.list().props.contentContainerStyle).paddingBottom;
  assert.ok(clearance >= topOffset + 44, 'last row must clear the floating action target');
});

test('S4 a negative server acknowledgement rolls back and preserves selection', async t => {
  const h = harness({ fetch: (url, init) => Promise.resolve(ok(
    init?.method === 'POST' ? { success: false, error: 'rejected' }
      : url.endsWith('/plan/') ? plans : [row(11, '2026-09-17'), row(13, '2026-09-18')])) });
  t.after(h.dispose);
  await h.act();
  await h.act(() => h.press('일괄수정'));
  await h.act(() => h.press('9/17(목)'));
  await h.act(() => h.press('9/18(금)'));
  await h.act(() => h.press('읽음'));
  assert.ok(h.nodes().some(n => h.text(n) === '0/2일 완료 · 0%'));
  assert.equal(h.button('읽음').props.disabled, false);
  assert.equal(h.alerts.length, 1);
});

test('S2 old account plan response cannot replace newly loaded subscriptions', async t => {
  const oldPlans = deferred();
  let planReads = 0;
  const h = harness({ fetch: url => {
    if (url.endsWith('/plan/')) {
      return ++planReads === 1 ? oldPlans.promise : Promise.resolve(ok([plans[1]]));
    }
    return Promise.resolve(ok([]));
  } });
  t.after(h.dispose);
  await h.act();
  await h.act(() => { h.auth.accessToken = token(2); h.render(); });
  await h.act(() => oldPlans.resolve(ok([plans[0]])));
  assert.equal(h.nodes().some(n => h.text(n) === 'Plan A'), false);
  assert.ok(h.button('Plan B'));
});

test('initial guest load centers today only when both row and viewport layouts exist', async t => {
  const h = harness({ status: 'signedOut', fetch: url => Promise.resolve(ok(
    url.endsWith('/plan/') ? plans : url.includes('/stats/progress/') ? year()
      : [row(1, '2026-09-22')])) });
  t.after(h.dispose);
  await h.act();

  h.layoutCard(h.cards()[0], 900);
  assert.equal(h.scrolls.length, 0);
  h.layoutList(500);

  assert.deepEqual(h.scrolls, [{ y: 687, animated: false }]);
  assert.ok(h.get('schedule-guest-notice'));
  h.layoutCard(h.cards()[0], 910);
  assert.equal(h.scrolls.length, 1);
});

test('auth initialization issues no plan request and shows no fabricated selected plan', async t => {
  const h = harness({ status: 'loading' });
  t.after(h.dispose);
  await h.act();

  assert.equal(h.calls.length, 0);
  assert.ok(h.get('schedule-loading'));
  assert.equal(h.get('schedule-guest-notice'), undefined);
  assert.equal(h.get('schedule-plan-selector').props.disabled, true);
  assert.equal(h.get('schedule-header-action').props.disabled, true);
});

test('signed-in first visit requires a plan choice and persists the chosen active plan', async t => {
  const h = harness({ storedPlan: null });
  t.after(h.dispose);
  await h.act();
  assert.ok(h.get('schedule-no-plan'));
  assert.equal(h.calls.some(c => c.url.includes('/schedules/')), false);

  await h.act(() => h.get('schedule-plan-selector').props.onPress());
  await h.act(() => h.get('schedule-plan-4').props.onPress());

  assert.equal(h.storage.get('schedule:selectedPlan:https://api.test:1'), '4');
  assert.ok(h.calls.some(c => c.url.includes('/schedules/month/?plan_id=4')));
  assert.equal(h.get('schedule-plan-4'), undefined);
});

test('explicit route plan wins over remembered selection and remains selected on focus', async t => {
  const h = harness({ url: '/plan?plan=4' });
  t.after(h.dispose);
  await h.act();
  assert.ok(h.calls.some(c => c.url.includes('/schedules/month/?plan_id=4')));
  await h.act(() => h.get('schedule-plan-selector').props.onPress());
  await h.act(() => h.get('schedule-plan-3').props.onPress());

  await h.act(() => h.focus(false));
  await h.act(() => h.focus(true));

  assert.equal(h.storage.get('schedule:selectedPlan:https://api.test:1'), '3');
  assert.ok(h.calls.filter(c => c.url.includes('/schedules/month/')).at(-1).url.includes('plan_id=3'));
});

test('guest checkbox confirms login without recording or replaying completion', async t => {
  const h = harness({ status: 'signedOut' });
  t.after(h.dispose);
  await h.act();
  await h.act(() => h.get('schedule-check-2026-09-17').props.onPress());
  assert.equal(h.navigations.length, 0);

  await h.act(() => h.get('schedule-dialog-confirm').props.onPress());

  assert.deepEqual(h.navigations, [['Login']]);
  assert.equal(h.calls.some(c => c.init?.method === 'POST'), false);
});

test('guest login confirmation is discarded when identity changes before confirmation', async t => {
  const h = harness({ status: 'signedOut' });
  t.after(h.dispose);
  await h.act();
  await h.act(() => h.get('schedule-header-action').props.onPress());
  const confirm = h.get('schedule-dialog-confirm').props.onPress;

  await h.act(() => { h.auth.status = 'signedIn'; h.auth.accessToken = token(1); h.render(); });
  await h.act(confirm);

  assert.equal(h.navigations.length, 0);
  assert.equal(h.calls.some(c => c.init?.method === 'POST'), false);
});

test('empty plan collection stays unselected and the sheet has a working management destination', async t => {
  const h = harness({ status: 'signedOut', fetch: () => Promise.resolve(ok([])) });
  t.after(h.dispose);
  await h.act();
  assert.ok(h.get('schedule-no-plan'));
  assert.equal(h.get('schedule-guest-notice'), undefined);
  assert.equal(h.calls.length, 1);
  await h.act(() => h.get('schedule-plan-selector').props.onPress());

  await h.act(() => h.press('플랜 관리'));

  assert.deepEqual(h.navigations, [['WebView', { url: 'https://web.test/plans' }]]);
});

for (const resource of ['plans', 'month']) {
  test(`${resource} failure and malformed payload stay errors until a successful retry`, async t => {
    let bad = true;
    const h = harness({ fetch: url => {
      if (url.includes('/stats/progress/')) return Promise.resolve(ok(year()));
      if (url.endsWith('/plan/')) return Promise.resolve(ok(resource === 'plans' && bad ? {} : plans));
      return Promise.resolve(bad ? { ok: false, status: 503 } : ok([]));
    } });
    t.after(h.dispose);
    await h.act();
    assert.ok(h.get('schedule-error'));
    assert.equal(h.get('schedule-empty'), undefined);
    assert.equal(h.get('schedule-no-plan'), undefined);

    bad = false;
    await h.act(() => h.press('다시 시도'));

    assert.equal(h.get('schedule-error'), undefined);
    assert.ok(h.get('schedule-empty'));
  });
}

test('expired session is not represented as an empty month or automatic write success', async t => {
  const h = harness({ fetch: url => Promise.resolve(
    url.endsWith('/plan/') ? ok(plans) : { ok: false, status: 401 }) });
  t.after(h.dispose);
  await h.act();
  assert.ok(h.get('schedule-error'));
  assert.equal(h.get('schedule-empty'), undefined);

  await h.act(() => h.press('로그인'));

  assert.deepEqual(h.navigations, [['Login']]);
});

test('annual progress uses one request and a partially completed day still counts individual rows in its dot', async t => {
  const h = harness({ fetch: url => Promise.resolve(ok(
    url.endsWith('/plan/') ? plans
      : url.includes('/stats/progress/') ? year([{ month: 9, done: 0, total: 2 }, { month: 11, done: 0, total: 1 }])
      : [row(11, '2026-09-17', { is_completed: true }), row(12, '2026-09-17')])) });
  t.after(h.dispose);
  await h.act();

  assert.equal(h.calls.filter(c => c.url.includes('/schedules/month/')).length, 1);
  assert.equal(h.calls.filter(c => c.url.includes('/stats/progress/')).length, 1);
  assert.equal(h.get('schedule-check-2026-09-17').props.accessibilityState.checked, 'mixed');
  const progress = h.nodes().find(n => n.props.accessibilityRole === 'progressbar');
  assert.deepEqual(progress.props.accessibilityValue, { min: 0, max: 1, now: 0 });
  const dot = h.get('schedule-month-9').children.find(n => n?.type === 'View');
  assert.equal(Object.assign({}, ...dot.props.style).opacity, 0.7);

  await h.act(() => h.get('schedule-next-month').props.onPress());

  assert.equal(h.get('schedule-month-11').props.accessibilityState.selected, true);
});

test('a missing annual summary does not assert that the plan has ended', async t => {
  const h = harness({ fetch: url => Promise.resolve(url.includes('/stats/progress/')
    ? { ok: false, status: 500 } : ok(url.endsWith('/plan/') ? plans : [row(11, '2026-09-17')])) });
  t.after(h.dispose);
  await h.act();

  assert.equal(h.get('schedule-next-month'), undefined);
  assert.equal(h.get('schedule-error'), undefined);
  assert.equal(h.cards().length, 1);
  assert.equal(h.get('schedule-month-11').children.some(n => n?.type === 'View'), false);
});

test('common theme changes reach rows, controls and an already-open native plan sheet', async t => {
  const h = harness();
  t.after(h.dispose);
  await h.act();
  await h.act(() => h.get('schedule-plan-selector').props.onPress());

  await h.act(() => h.setTheme('dark'));

  const card = Object.assign({}, ...h.cards()[0].props.style);
  assert.equal(card.backgroundColor, palette.dark.surface);
  const selected = Object.assign({}, ...h.get('schedule-plan-3').props.style);
  assert.equal(selected.backgroundColor, palette.dark.accentSurface);
  assert.equal(selected.borderColor, palette.dark.accent);
  assert.equal(h.get('schedule-plan-3').props.accessibilityState.checked, true);
});
