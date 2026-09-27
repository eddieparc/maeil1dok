const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const ok = json => ({ ok: true, status: 200, json: async () => json });
const rows = [
  { schedule_id: '101', book: 'gen', start_chapter: 1, end_chapter: 2, date: '2026-09-22', is_complete: false },
  { schedule_id: '102', book: 'exo', start_chapter: 3, end_chapter: 4, date: '2026-09-22', is_complete: false },
];
const token = (id, nonce = 1) => `header.${Buffer.from(JSON.stringify({ user_id: id, nonce })).toString('base64url')}.signature`;
function mount({ url, storage = Promise.resolve(null), update = null, detail = null, subscriptions = null, status = 'signedIn', autoComplete = false, schedules = [], nextPosition = { status: 'all_completed' } } = {}) {
  const slots = [], effects = [], listeners = new Set(), cache = new Map(), calls = [], scrolls = [];
  let cursor = 0, dirty = false, disposed = false, tree, readingContext;
  const route = { params: { url } };
  let accessToken = token(1), api = 'https://api.example.test';
  const changed = (a, b) => !a || !b || a.length !== b.length || a.some((x, i) => x !== b[i]);
  const hooks = { ...React,
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
    useCallback(fn, deps) { return hooks.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const i = cursor++;
      if (changed(slots[i]?.deps, deps)) effects.push(() => {
        slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
      });
    },
  };
  const apiFetch = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('reading/update')) return update ? update(url, init) : ok({
      success: true, plan_id: 4, schedule_ids: [101, 102], is_completed: JSON.parse(init.body).action === 'complete',
    });
    if (url.includes('/detail/')) {
      const q = new URL(url, 'https://example.test').searchParams;
      if (detail) return detail(q, accessToken);
      return ok({ book: q.get('book'), chapter: q.get('chapter'), plan_id: q.get('plan_id'),
        plan_name: `Plan ${q.get('plan_id')}`, plan_date: '2026-09-22', plan_detail: rows, fallback_audio_links: [] });
    }
    if (url.includes('/bible-cache/versions')) return ok([]);
    if (url.includes('/bible-cache/')) return ok({ data: { content: '<div id="tdBible1"><span><span class="number">1&nbsp;</span>본문</span><br /></div>', content_type: 'html' } });
    if (url.includes('/next-position/')) return ok(nextPosition);
    if (url.includes('/schedules/month/')) return ok(schedules);
    if (url.endsWith('/plan/')) return subscriptions ? subscriptions(accessToken)
      : ok([{ id: 1, plan_id: 3, plan_name: 'Default 3', is_active: true, is_default: true }]);
    if (url.includes('/schedules/today')) return ok({ success: true, schedules: [] });
    return ok({ success: true, position: null, read_chapters: [] });
  };
  const native = Object.fromEntries(['ActivityIndicator', 'FlatList', 'Modal', 'Pressable', 'ScrollView',
    'Text', 'TouchableOpacity', 'View'].map(n => [n, n]));
  native.StyleSheet = { create: x => x };
  const external = [];
  native.Linking = { openURL: async url => { external.push(url); } };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const m = new Module(filename, module);
    m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename));
    m.require = name => {
      if (name === 'react') return hooks;
      if (name === 'react-native') return native;
      if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
      if (name === '@react-navigation/native') return { useRoute: () => route };
      if (name === '@react-native-async-storage/async-storage') return { getItem: key => key === 'bibleReaderTabs' ? storage : Promise.resolve(null), setItem: async () => {} };
      if (name.includes('AuthSession')) return { useAuth: () => ({ status, accessToken, apiFetch }) };
      if (name.includes('AppStackContext')) return { useAppStack: () => ({ stack: { api, web: 'https://beta.example.test' } }) };
      if (name.includes('navigationRef')) return { navigationRef: { isReady: () => true, navigate() {} } };
      if (name.includes('NativeTabBar')) return { useNativeTabBarInset: () => 0 };
      if (name === '@expo/vector-icons/Ionicons') return { __esModule: true, default: 'Icon' };
      if (name.includes('ReadingSettingsProvider')) return { useReadingSettings: () => ({
        settings: { ...load(path.resolve(__dirname, '../api/readingSettings.ts')).DEFAULT_READING_SETTINGS,
          tongdokAutoComplete: autoComplete },
        update() {}, syncError: null, retry() {},
      }) };
      if (name.includes('/components/') && !name.includes('ReaderTongdok'))
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
  const Screen = load(path.resolve(__dirname, '../screens/BibleScreen.tsx')).default;
  function nodes(el) {
    if (!React.isValidElement(el)) return [];
    if (el.type?.name === 'ReaderTongdokControls') readingContext = el.props.state;
    const result = typeof el.type === 'function' ? el.type(el.props) : el;
    if (!result || result.props.visible === false) return [];
    if (result.type === 'ScrollView' && result.props.ref)
      result.props.ref.current = { scrollTo: value => scrolls.push(value) };
    return [result, ...React.Children.toArray(result.props.children).flatMap(nodes)];
  }
  function render() {
    if (disposed) return;
    dirty = false; cursor = 0; tree = nodes(Screen());
    effects.splice(0).forEach(fn => fn());
    listeners.forEach(fn => fn());
  }
  render();
  return {
    calls, scrolls, external,
    get: id => tree.find(n => n.props.testID === id),
    nodes: () => tree,
    context: () => readingContext,
    route(url) { route.params = { url }; render(); },
    account(id, nonce = 1) { accessToken = token(id, nonce); render(); },
    api(value) { api = value; render(); },
    autoComplete(value) { autoComplete = value; render(); },
    wait(predicate) {
      if (!dirty && predicate()) return Promise.resolve();
      return new Promise(resolve => {
        const check = () => { if (!dirty && predicate()) { listeners.delete(check); resolve(); } };
        listeners.add(check);
      });
    },
    dispose() { disposed = true; slots.forEach(s => s?.cleanup?.()); },
  };
}
const route = '/bible?book=gen&chapter=1&version=KNT&plan=4&schedule=101&date=2026-09-22&tongdok=true';
const audioDetail = q => ok({ book: q.get('book'), chapter: q.get('chapter'), plan_id: q.get('plan_id'),
  plan_name: 'Plan 4', plan_date: '2026-09-22', plan_detail: rows,
  audio_link: 'https://youtu.be/abcdefghijk' });
const audioWrites = h => h.calls.filter(c => c.url.includes('/reading/update/')).map(c => JSON.parse(c.init.body));
async function openAudio(h) {
  await h.wait(() => h.nodes().some(n => n.props.accessibilityLabel === '오디오') && !h.context().loading);
  h.nodes().find(n => n.props.accessibilityLabel === '오디오').props.onPress();
  await h.wait(() => h.nodes().some(n => n.type === 'ReaderAudioPlayer'));
  const props = h.nodes().find(n => n.type === 'ReaderAudioPlayer').props;
  assert.equal(typeof props.contextKey, 'string');
  assert.equal(typeof props.onEnded, 'function');
  return props;
}
const ended = (player, generation = 1) => player.onEnded({
  link: player.audioLink, contextKey: player.contextKey, generation,
});

test('screen audio completes only an entirely heard row, never the partial day', { timeout: 2500 }, async t => {
  const pending = deferred();
  const h = mount({ url: route, autoComplete: true, detail: audioDetail, update: () => pending.promise });
  t.after(h.dispose);
  await ended(await openAudio(h));
  assert.deepEqual(audioWrites(h), []);
  h.nodes().find(n => n.props.accessibilityLabel === '다음 장').props.onPress();
  await h.wait(() => h.context().location.chapter === 2 && !h.context().loading);
  const player = await openAudio(h);
  const writing = ended(player, 2);
  await ended(player, 2);
  assert.deepEqual(audioWrites(h), [{ plan_id: 4, schedule_ids: [101], action: 'complete' }]);
  assert.equal(h.context().detail.rows[0].complete, false);
  pending.resolve(ok({ success: true, plan_id: 4, schedule_ids: ['101'], is_completed: true }));
  await writing;
  await h.wait(() => h.context().detail.rows[0].complete);
  assert.equal(h.context().detail.rows[1].complete, false);
  assert.equal(h.get('reader-tongdok-complete').props.accessibilityState.checked, false);
  assert.equal(h.get('reader-tongdok-completed'), undefined);
  await ended(player, 3);
  assert.equal(audioWrites(h).length, 1);
});

for (const change of ['account', 'api', 'plan', 'chapter', 'close', 'reopen'])
  test(`screen rejects stale audio callback after ${change}`, { timeout: 2500 }, async t => {
    const h = mount({ url: route, autoComplete: true, detail: audioDetail }); t.after(h.dispose);
    const player = await openAudio(h);
    if (change === 'account') h.account(2);
    if (change === 'api') h.api('https://new-api.example.test');
    if (change === 'plan') h.route(route.replace('plan=4', 'plan=5'));
    if (change === 'chapter') h.nodes().find(n => n.props.accessibilityLabel === '다음 장').props.onPress();
    if (change === 'close' || change === 'reopen') {
      player.onClose();
      await h.wait(() => !h.nodes().some(n => n.type === 'ReaderAudioPlayer'));
      if (change === 'reopen') {
        const fresh = await openAudio(h);
        assert.notEqual(fresh.contextKey, player.contextKey);
      }
    }
    await ended(player);
    assert.deepEqual(audioWrites(h), []);
    // A stale chapter-one mark must not help chapter two finish row 101.
    if (change !== 'chapter') h.nodes().find(n => n.props.accessibilityLabel === '다음 장').props.onPress();
    await h.wait(() => h.context().location.chapter === 2 && !h.context().loading);
    await ended(await openAudio(h), 2);
    assert.deepEqual(audioWrites(h), []);
  });

for (const mode of ['disabled', 'disabled-after-open', 'guest'])
  test(`screen audio records no completion evidence when ${mode}`, { timeout: 2500 }, async t => {
    const h = mount({ url: route, autoComplete: mode !== 'disabled', status: mode === 'guest' ? 'guest' : 'signedIn',
      detail: audioDetail }); t.after(h.dispose);
    const player = await openAudio(h);
    if (mode === 'disabled-after-open') h.autoComplete(false);
    await ended(player);
    h.autoComplete(true);
    h.nodes().find(n => n.props.accessibilityLabel === '다음 장').props.onPress();
    await h.wait(() => h.context().location.chapter === 2 && !h.context().loading);
    await ended(await openAudio(h), 2);
    assert.deepEqual(audioWrites(h), []);
  });

test('screen opens the current external audio URL without a reader WebView', { timeout: 2500 }, async t => {
  const link = 'https://media.example.test/chapter.mp3';
  const h = mount({ url: route, detail: async q => ok({ ...(await audioDetail(q).json()), audio_link: link }) });
  t.after(h.dispose);
  const player = await openAudio(h);
  assert.equal(typeof player.onOpenExternal, 'function');
  await player.onOpenExternal(link);
  assert.deepEqual(h.external, [link]);
  assert.deepEqual(audioWrites(h), []);
});

for (const failure of ['http', 'ack'])
  test(`screen retries only heard row after audio ${failure} failure`, { timeout: 2500 }, async t => {
    let attempts = 0;
    const h = mount({ url: route, autoComplete: true, detail: audioDetail, update: async () => {
      if (++attempts === 1) return failure === 'http' ? { ok: false, status: 503 }
        : ok({ success: true, plan_id: 4, schedule_ids: [101, 102], is_completed: true });
      return ok({ success: true, plan_id: 4, schedule_ids: [101], is_completed: true });
    } }); t.after(h.dispose);
    await ended(await openAudio(h));
    h.nodes().find(n => n.props.accessibilityLabel === '다음 장').props.onPress();
    await h.wait(() => h.context().location.chapter === 2 && !h.context().loading);
    const player = await openAudio(h);
    await ended(player, 2);
    await h.wait(() => h.get('reader-tongdok-retry'));
    assert.equal(h.context().detail.rows[0].complete, false);
    await ended(player, 2);
    assert.equal(attempts, 1, 'duplicate ended is not a retry');
    await h.get('reader-tongdok-retry').props.onPress();
    await h.wait(() => h.context().detail.rows[0].complete);
    assert.deepEqual(audioWrites(h), Array(2).fill({ plan_id: 4, schedule_ids: [101], action: 'complete' }));
    assert.equal(h.context().detail.rows[1].complete, false);
  });

test('screen fences pending audio ack on signedIn account switch', { timeout: 2500 }, async t => {
  const pending = deferred();
  const h = mount({ url: route, autoComplete: true, detail: audioDetail, update: () => pending.promise });
  t.after(h.dispose);
  await ended(await openAudio(h));
  h.nodes().find(n => n.props.accessibilityLabel === '다음 장').props.onPress();
  await h.wait(() => h.context().location.chapter === 2 && !h.context().loading);
  const writing = ended(await openAudio(h), 2);
  assert.equal(audioWrites(h).length, 1);
  h.account(2);
  await h.wait(() => h.context().detail && !h.context().loading && !h.context().busy);
  pending.resolve(ok({ success: true, plan_id: 4, schedule_ids: [101], is_completed: true }));
  await writing;
  assert.equal(h.context().detail.rows.some(row => row.complete), false);
  assert.equal(h.get('reader-tongdok-completed'), undefined);
});

test('screen token rotation retains audio identity and chapter evidence', { timeout: 2500 }, async t => {
  const h = mount({ url: route, autoComplete: true, detail: audioDetail, update: async () =>
    ok({ success: true, plan_id: 4, schedule_ids: [101], is_completed: true }) });
  t.after(h.dispose);
  const player = await openAudio(h);
  h.account(1, 22);
  assert.equal(h.nodes().find(n => n.type === 'ReaderAudioPlayer').props.contextKey, player.contextKey);
  await ended(player);
  h.nodes().find(n => n.props.accessibilityLabel === '다음 장').props.onPress();
  await h.wait(() => h.context().location.chapter === 2 && !h.context().loading);
  await ended(await openAudio(h), 2);
  assert.deepEqual(audioWrites(h), [{ plan_id: 4, schedule_ids: [101], action: 'complete' }]);
});

test('screen ignores wrong link/context/player generation and disposed callbacks', { timeout: 2500 }, async t => {
  const h = mount({ url: route, autoComplete: true, detail: audioDetail }); t.after(h.dispose);
  const player = await openAudio(h);
  for (const mismatch of [{ link: 'other' }, { contextKey: 'other' }, { generation: 0 }]) {
    await player.onEnded({ link: player.audioLink, contextKey: player.contextKey, generation: 1, ...mismatch });
  }
  h.nodes().find(n => n.props.accessibilityLabel === '다음 장').props.onPress();
  await h.wait(() => h.context().location.chapter === 2 && !h.context().loading);
  const current = await openAudio(h);
  await ended(current, 2);
  assert.deepEqual(audioWrites(h), []);
  h.dispose();
  await ended(player);
  assert.deepEqual(audioWrites(h), []);
});
test('signedIn account switch fences pending completion while token rotation preserves it', { timeout: 2500 }, async t => {
  const pending = deferred();
  const h = mount({ url: route, update: () => pending.promise }); t.after(h.dispose);
  await h.wait(() => h.get('reader-tongdok-complete')?.props.disabled === false);
  const writing = h.get('reader-tongdok-complete').props.onPress();
  h.account(1, 2);
  assert.equal(h.get('reader-tongdok-complete').props.disabled, true);
  const before = h.calls.filter(c => c.url.includes('/detail/')).length;
  h.account(2);
  assert.ok(h.calls.filter(c => c.url.includes('/detail/')).length > before, 'B must obtain its own proof');
  await h.wait(() => h.get('reader-tongdok-complete')?.props.disabled === false);
  pending.resolve(ok({ success: true, plan_id: 4, schedule_ids: [101, 102], is_completed: true }));
  await writing;
  assert.equal(h.get('reader-tongdok-complete').props.accessibilityState.checked, false);
  assert.equal(h.get('reader-tongdok-completed'), undefined);
});

test('same account token rotation keeps an acknowledged completion and does not refetch', { timeout: 2500 }, async t => {
  const h = mount({ url: route }); t.after(h.dispose);
  await h.wait(() => h.get('reader-tongdok-complete')?.props.disabled === false);
  h.get('reader-tongdok-complete').props.onPress();
  await h.wait(() => h.get('reader-tongdok-completed'));
  const before = h.calls.length;
  h.account(1, 99);
  assert.ok(h.get('reader-tongdok-completed'));
  assert.equal(h.calls.length, before);
});

test('account B ignores account A detail that finishes after its own proof', { timeout: 2500 }, async t => {
  const pending = deferred(); let retrying = false;
  const h = mount({ url: route, detail: async (q, access) => {
    if (!q.get('plan_id')) return ok({});
    const id = JSON.parse(Buffer.from(access.split('.')[1], 'base64url')).user_id;
    if (id === 1) return retrying ? pending.promise : { ok: false, status: 503 };
    return ok({ book: 'gen', chapter: 1, plan_id: 4, plan_date: '2026-09-22', plan_detail: rows });
  } }); t.after(h.dispose);
  await h.wait(() => h.get('reader-tongdok-retry'));
  retrying = true;
  const loading = h.get('reader-tongdok-retry').props.onPress();
  h.account(2);
  await h.wait(() => h.get('reader-tongdok-complete')?.props.disabled === false);
  pending.resolve(ok({ book: 'gen', chapter: 1, plan_id: 4, plan_date: '2026-09-22',
    plan_detail: rows.map(row => ({ ...row, is_complete: true })) }));
  await loading;
  assert.equal(h.get('reader-tongdok-complete').props.accessibilityState.checked, false);
  assert.equal(h.context().detail.rows.some(row => row.complete), false);
});

test('API origin switch discards account proof even when apiFetch reference is stable', { timeout: 2500 }, async t => {
  const h = mount({ url: route }); t.after(h.dispose);
  await h.wait(() => h.get('reader-tongdok-complete')?.props.disabled === false);
  const before = h.calls.filter(c => c.url.includes('/detail/')).length;
  h.api('https://other-api.example.test');
  assert.ok(h.calls.filter(c => c.url.includes('/detail/')).length > before);
});

test('account switch refetches its default plan instead of inheriting the old account default', { timeout: 2500 }, async t => {
  const h = mount({ url: '/bible?book=gen&chapter=1&tongdok=true',
    subscriptions: async access => {
      const id = JSON.parse(Buffer.from(access.split('.')[1], 'base64url')).user_id;
      return ok([{ id, plan_id: id === 1 ? 3 : 5, plan_name: 'Default', is_active: true, is_default: true }]);
    },
  }); t.after(h.dispose);
  await h.wait(() => h.get('reader-tongdok-complete')?.props.disabled === false);
  const before = h.calls.length;
  h.account(2);
  await h.wait(() => h.get('reader-tongdok-complete')?.props.disabled === false);
  assert.equal(h.context().context.planId, 5);
  assert.equal(h.calls.slice(before).some(c => c.url.includes('/detail/') && c.url.includes('plan_id=3')), false);
});

for (const navigation of ['chapter', 'tab']) test(`${navigation} move adopts server-proven next date and posts its daily IDs`, { timeout: 2500 }, async t => {
  const newRows = [
    { ...rows[0], schedule_id: '201', start_chapter: 2, end_chapter: 3, date: '2026-09-23' },
    { ...rows[1], schedule_id: '202', date: '2026-09-23' },
  ];
  const writes = [];
  const h = mount({ url: route, storage: Promise.resolve(JSON.stringify({
    activeTabId: 'a', barVisible: true, tabs: [
      { id: 'a', label: '창1', snapshot: { book: 'gen', chapter: 1, version: 'KNT', scrollPosition: 0 } },
      { id: 'b', label: '창2', snapshot: { book: 'gen', chapter: 2, version: 'KNT', scrollPosition: .25 } },
    ],
  })), detail: async q => ok({ book: q.get('book'), chapter: q.get('chapter'), plan_id: 4,
    plan_name: 'Plan 4', plan_date: q.get('chapter') === '1' ? '2026-09-22' : '2026-09-23',
    plan_detail: q.get('chapter') === '1' ? rows : newRows }),
  update: async (_, init) => {
    const body = JSON.parse(init.body); writes.push(body);
    return ok({ success: true, plan_id: 4, schedule_ids: body.schedule_ids, is_completed: true });
  } }); t.after(h.dispose);
  await h.wait(() => h.get('reader-tongdok-complete')?.props.disabled === false
    && h.nodes().some(n => n.type === 'ReaderTabs'));
  if (navigation === 'tab') h.nodes().find(n => n.type === 'ReaderTabs').props.onSelect('b');
  else h.nodes().find(n => n.props.accessibilityLabel === '다음 장').props.onPress();
  await h.wait(() => h.context()?.location.chapter === 2 && !h.context().loading);
  assert.equal(h.get('reader-tongdok-complete').props.disabled, false, 'new day must be writable after verified detail');
  assert.equal(h.context().context.date, '2026-09-23');
  assert.equal(h.context().context.scheduleId, 201);
  h.get('reader-tongdok-complete').props.onPress();
  assert.deepEqual(writes[0], { plan_id: 4, schedule_ids: [201, 202], action: 'complete' });
});

test('explicit entry rejects a server date mismatch instead of adopting it', { timeout: 2500 }, async t => {
  const h = mount({ url: route, detail: async q => ok({
    book: q.get('book'), chapter: q.get('chapter'), plan_id: 4, plan_date: '2026-09-23',
    plan_detail: rows.map(r => ({ ...r, date: '2026-09-23' })),
  }) }); t.after(h.dispose);
  await h.wait(() => h.calls.some(c => c.url.includes('/schedules/today')));
  assert.equal(h.get('reader-tongdok-complete').props.disabled, true);
  h.get('reader-tongdok-complete').props.onPress();
  assert.equal(h.calls.some(c => c.url.includes('/reading/update/')), false);
});
test('BibleScreen consumes plan 4 and version, preserving them over delayed tab hydration/default 3', { timeout: 2500 }, async t => {
  const storage = deferred(); const h = mount({ url: route, storage: storage.promise }); t.after(h.dispose);
  await h.wait(() => h.calls.some(c => c.url.includes('/schedules/today')));
  assert.ok(h.get('reader-tongdok-context'), 'native tongdok context must be rendered');
  const before = h.calls.length;
  storage.resolve(JSON.stringify({ barVisible: true, activeTabId: 'a', tabs: [
    { id: 'a', label: '요한복음', snapshot: { book: 'jhn', chapter: 3, version: 'GAE', scrollPosition: .6 } },
  ] }));
  await h.wait(() => h.nodes().some(n => n.type === 'ReaderTabs'));
  assert.ok(h.calls.some(c => c.url.includes('/bible-cache/KNT/gen/1/')));
  assert.equal(h.calls.slice(before).some(c => c.url.includes('/bible-cache/GAE/jhn/3/')), false);
  assert.equal(h.calls.filter(c => c.url.includes('/detail/')).some(c => c.url.includes('plan_id=3')), false);
});
test('actual native checkbox sends all rows and renders checked only after ack; cancel clears', { timeout: 2500 }, async t => {
  const pending = deferred(); let once = true;
  const h = mount({ url: route, update: async (url, init) => {
    if (once) { once = false; return pending.promise; }
    return ok({ success: true, plan_id: 4, schedule_ids: [101, 102], is_completed: false });
  } }); t.after(h.dispose);
  await h.wait(() => h.calls.some(c => c.url.includes('/schedules/today')));
  assert.ok(h.get('reader-tongdok-complete'), 'completion checkbox must be native');
  await h.wait(() => h.get('reader-tongdok-complete')?.props.disabled === false);
  h.get('reader-tongdok-complete').props.onPress();
  assert.deepEqual(JSON.parse(h.calls.find(c => c.url.includes('/reading/update/')).init.body).schedule_ids, [101, 102]);
  assert.equal(h.get('reader-tongdok-complete').props.accessibilityState.checked, false);
  const checked = h.wait(() => h.get('reader-tongdok-complete')?.props.accessibilityState.checked);
  pending.resolve(ok({ success: true, plan_id: 4, schedule_ids: [101, 102], is_completed: true })); await checked;
  h.get('reader-tongdok-complete').props.onPress();
  await h.wait(() => h.get('reader-tongdok-complete')?.props.accessibilityState.checked === false);
});

test('native route change fences a pending completion response', { timeout: 2500 }, async t => {
  const pending = deferred();
  const h = mount({ url: route, update: () => pending.promise }); t.after(h.dispose);
  await h.wait(() => h.get('reader-tongdok-complete')?.props.disabled === false);
  h.get('reader-tongdok-complete').props.onPress();
  h.route('/bible?book=gen&chapter=2&plan=3&tongdok=true');
  await h.wait(() => h.calls.some(c => c.url.includes('chapter=2&plan_id=3')));
  pending.resolve(ok({ success: true, plan_id: 4, schedule_ids: [101, 102], is_completed: true }));
  await pending.promise;
  assert.equal(h.get('reader-tongdok-complete').props.accessibilityState.checked, false);
  assert.equal(h.get('reader-tongdok-completed'), undefined);
});

test('same passage route re-entry with another schedule reloads its proof', { timeout: 2500 }, async t => {
  const h = mount({ url: route }); t.after(h.dispose);
  await h.wait(() => h.get('reader-tongdok-complete')?.props.disabled === false);
  const before = h.calls.filter(c => c.url.includes('/detail/')).length;
  h.route(route.replace('schedule=101', 'schedule=102'));
  // Direct event flush, not a time-based wait: route effects run synchronously in the harness.
  assert.ok(h.calls.filter(c => c.url.includes('/detail/')).length > before);
});

test('native schedule overlay selects a row without a Bible WebView', { timeout: 2500 }, async t => {
  const h = mount({ url: route, schedules: [
    { id: 202, plan: 4, date: '2026-09-24', book: '요한복음', start_chapter: 3, end_chapter: 4 },
  ] }); t.after(h.dispose);
  await h.wait(() => h.get('reader-tongdok-complete')?.props.disabled === false);
  h.get('reader-tongdok-schedule').props.onPress();
  await h.wait(() => h.get('reader-tongdok-row-202'));
  h.get('reader-tongdok-row-202').props.onPress();
  await h.wait(() => h.calls.some(c => c.url.includes('/bible-cache/KNT/jhn/3/')));
  assert.ok(h.calls.some(c => c.url.includes('book=jhn&chapter=3&plan_id=4')));
  assert.equal(h.get('reader-tongdok-row-202'), undefined);
});

test('next unread button uses server-selected month and exact schedule', { timeout: 2500 }, async t => {
  const h = mount({ url: route, nextPosition: { status: 'next_incomplete', month: 11, schedule_id: 202 },
    schedules: [{ id: 202, plan: 4, date: '2026-11-14', book: '요한복음', start_chapter: 3, end_chapter: 4 }] });
  t.after(h.dispose);
  await h.wait(() => h.get('reader-tongdok-complete')?.props.disabled === false);
  h.get('reader-tongdok-next').props.onPress();
  await h.wait(() => h.calls.some(c => c.url.includes('/bible-cache/KNT/jhn/3/')));
  assert.ok(h.calls.some(c => c.url.includes('/schedules/month/?plan_id=4&month=11')));
});

test('guest completion renders login action and never writes', { timeout: 2500 }, async t => {
  const h = mount({ url: route, status: 'guest' }); t.after(h.dispose);
  await h.wait(() => h.get('reader-tongdok-complete')?.props.disabled === false);
  h.get('reader-tongdok-complete').props.onPress();
  await h.wait(() => h.get('reader-tongdok-retry'));
  assert.equal(h.calls.some(c => c.url.includes('/reading/update/')), false);
});

test('tab passage restoration keeps global plan and uses whole-chapter scroll extent', { timeout: 2500 }, async t => {
  const h = mount({ url: route, storage: Promise.resolve(JSON.stringify({
    activeTabId: 'a', barVisible: true, tabs: [
      { id: 'a', label: '창1', snapshot: { book: 'gen', chapter: 1, version: 'KNT', scrollPosition: .6 } },
      { id: 'b', label: '창2', snapshot: { book: 'gen', chapter: 2, version: 'GAE', scrollPosition: .25 } },
    ],
  })) }); t.after(h.dispose);
  await h.wait(() => h.nodes().some(n => n.type === 'ReaderTabs') && h.get('reader-tongdok-complete')?.props.disabled === false);
  h.nodes().find(n => n.type === 'ReaderTabs').props.onSelect('b');
  await h.wait(() => h.calls.some(c => c.url.includes('/bible-cache/GAE/gen/2/'))
    && h.nodes().some(n => n.props.onContentSizeChange) && h.get('reader-tongdok-complete')?.props.disabled === false);
  const content = h.nodes().find(n => n.props.onContentSizeChange);
  content.props.onLayout({ nativeEvent: { layout: { height: 600 } } });
  content.props.onContentSizeChange(390, 4600);
  assert.deepEqual(h.scrolls.at(-1), { y: 1000, animated: false });
  assert.equal(h.calls.filter(c => c.url.includes('/detail/')).some(c => c.url.includes('plan_id=3')), false);
  assert.ok(h.calls.some(c => c.url.includes('book=gen&chapter=2&plan_id=4')));
});
