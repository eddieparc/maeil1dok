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

// The TSX and its callbacks execute unchanged. Only native host components,
// navigation and the hook dispatcher are replaced (no renderer is installed).
// act drains the current event-loop turn, not a timed sleep or polling loop.
function harness({ fetch, inset = 0 } = {}) {
  const slots = [];
  let index = 0, queued = false, tree, mounted = true, focused = true;
  let effects = [];
  const alerts = [], navigations = [], scrolls = [], calls = [];
  const auth = { status: 'signedIn', accessToken: 'account-a' };
  const stack = { api: 'https://api.test', web: 'https://web.test' };
  auth.apiFetch = (url, init) => {
    calls.push({ url, init });
    if (fetch) return fetch(url, init);
    if (init?.method === 'POST') return Promise.resolve(ok({ success: true }));
    if (url.endsWith('/plan/')) return Promise.resolve(ok(plans));
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
      if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
      if (name === '@react-navigation/native') return {
        useFocusEffect: fn => hooks.useEffect(() => focused ? fn() : undefined, [fn, focused]),
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
    const node = { type: el.type, props: el.props, parent, children: [] };
    if (el.type === 'ScrollView' && el.props.ref) el.props.ref.current = {
      scrollTo: options => scrolls.push(options),
    };
    node.children = React.Children.toArray(el.props.children).map(c => resolve(c, node));
    return node;
  }
  function render() {
    index = 0;
    tree = resolve(Screen());
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
  const list = () => nodes().find(n => n.type === 'ScrollView' && !n.props.horizontal);
  const cards = () => nodes().filter(n => n.props.onLayout);
  const act = async fn => {
    await fn?.();
    await new Promise(setImmediate);
  };
  render();
  return {
    act, nodes, text, button, press, list, cards, alerts, navigations, scrolls, calls, auth, stack,
    focus: value => { focused = value; render(); },
    render,
    dispose() { mounted = false; slots.forEach(s => s.cleanup?.()); },
  };
}

test.beforeEach(t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-09-22T12:00:00Z') });
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
  await h.act(() => h.press('마지막 미완료'));
  assert.equal(h.scrolls.length, 0);
  await h.act(() => august.resolve(ok([row(11, '2026-08-17')])));
  assert.equal(h.scrolls.length, 0);
  await h.act(() => h.cards()[0].props.onLayout({ nativeEvent: { layout: { y: 420 } } }));
  assert.equal(h.scrolls.length, 1);
  assert.equal(h.scrolls[0].y, 412);
  await h.act(() => h.cards()[0].props.onLayout({ nativeEvent: { layout: { y: 430 } } }));
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
  assert.equal(h.alerts.length, 1);
  const buttons = h.alerts[0][2];
  buttons.find(b => b.style === 'cancel').onPress?.();
  assert.equal(h.navigations.length, 0);
  await h.act(() => h.press('출애굽기 1–2장'));
  h.alerts[1][2].find(b => b.style !== 'cancel').onPress();
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
  await h.act(() => h.press('8월'));
  await h.act(() => h.press('오늘'));
  assert.equal(h.scrolls.length, 0);
  await h.act(() => h.cards()[0].props.onLayout({ nativeEvent: { layout: { y: 550 } } }));
  assert.equal(h.scrolls.at(-1).y, 542);
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
  assert.equal(h.scrolls.length, 0);
});

test('S2 same-month responses from a previous year cannot replace the new year', async t => {
  const oldSeptember = deferred();
  const h = harness({ fetch: url => {
    if (url.endsWith('/plan/')) return Promise.resolve(ok(plans));
    if (url.includes('next-position')) return Promise.resolve(ok({ status: 'next_incomplete', date: '2025-09-17' }));
    if (url.includes('month=9&year=2026')) return oldSeptember.promise;
    return Promise.resolve(ok(url.includes('month=9&year=2025') ? [row(20, '2025-09-17')] : []));
  } });
  t.after(h.dispose);
  await h.act();
  await h.act(() => h.press('마지막 미완료'));
  await h.act(() => oldSeptember.resolve(ok([row(11, '2026-09-17')])));
  assert.ok(h.nodes().some(n => h.text(n) === '2025년 9월'));
  assert.ok(h.nodes().some(n => h.text(n) === '9/17(수)'));
  assert.equal(h.nodes().some(n => h.text(n) === '9/17(목)'), false);
});

test('S2 new plan hides old dots and discards a prefetch JSON completion', async t => {
  const lateJson = deferred(), planB = deferred();
  const h = harness({ fetch: url => {
    if (url.endsWith('/plan/')) return Promise.resolve(ok(plans));
    if (url.includes('plan_id=4')) return planB.promise;
    if (url.includes('month=2&')) return Promise.resolve({ ok: true, json: () => lateJson.promise });
    return Promise.resolve(ok([row(11, '2026-09-17', { is_completed: true })]));
  } });
  t.after(h.dispose);
  await h.act();
  const dot = month => h.button(`${month}월`).children.some(n => n?.type === 'View');
  assert.equal(dot(1), true);
  await h.act(() => h.press('Plan A'));
  await h.act(() => h.press('Plan B'));
  assert.equal(dot(1), false);
  await h.act(() => lateJson.resolve([row(14, '2026-02-01', { is_completed: true })]));
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
      if (change === 'account') h.auth.accessToken = 'account-b';
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
  h.alerts[0][2].find(b => b.style !== 'cancel').onPress();
  assert.equal(new URL(h.navigations[0][1].params.url, 'https://test').searchParams.get('schedule'), '11');
  await h.act(() => h.press('출애굽기 1–2장'));
  await h.act(() => h.press('10월'));
  h.alerts[1][2].find(b => b.style !== 'cancel').onPress();
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
  await h.act(() => { h.auth.accessToken = 'account-b'; h.render(); });
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
  await h.act(() => { h.auth.accessToken = 'account-b'; h.render(); });
  await h.act(() => oldPlans.resolve(ok([plans[0]])));
  assert.equal(h.nodes().some(n => h.text(n) === 'Plan A'), false);
  assert.ok(h.button('Plan B'));
});
