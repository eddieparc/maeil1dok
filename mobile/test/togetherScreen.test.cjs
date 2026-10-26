const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const native = {
  View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', Image: 'Image', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (styles) => styles }, useColorScheme: () => 'light',
};
function load(relative, overrides = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = instance.require.bind(instance);
  instance.require = (name) => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name === 'react-native') return native;
    if (name.endsWith('ReadingSettingsProvider')) return { useOptionalReadingSettings: () => null };
    if (name === '@expo/vector-icons/Feather') return { default: 'Icon' };
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
    if (!name.startsWith('.')) return original(name);
    const base = path.resolve(path.dirname(filename), name);
    const file = [`${base}.ts`, `${base}.tsx`].find(fs.existsSync);
    return load(path.relative(path.resolve(__dirname, '..'), file), overrides);
  };
  instance._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    fileName: filename,
  }).outputText, filename);
  return instance.exports;
}
const { TogetherModel } = load('components/together/TogetherModel.ts');
const group = (id, extra = {}) => ({
  id, name: `그룹 ${id}`, description: '', creator: { id: 2, nickname: '리더', profile_image: null },
  plans: [], is_public: true, max_members: 10, member_count: 1, is_full: false,
  is_member: false, my_role: null, show_in_profile: true,
  created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z', ...extra,
});
const response = (json, status = 200) => ({ ok: status < 400, status, json: async () => json });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const query = (search = '') => ({ search, filter: 'all' });
const members = { success: true, members: [], meta: { has_more: false, offset: 0, limit: 100, total_members: 0, returned_members: 0 } };

function nextState(model, predicate, t) {
  return new Promise((resolve) => {
    const unsubscribe = model.subscribe(() => {
      if (predicate(model.state)) { unsubscribe(); resolve(model.state); }
    });
    t.after(unsubscribe);
  });
}

test('search debounces for 300ms and retains cards until the latest result arrives', { timeout: 5000 }, async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = deferred();
  const calls = [];
  const model = new TogetherModel(async (url) => {
    calls.push(url);
    return calls.length === 1 ? response({ success: true, groups: [group(7)] }) : pending.promise;
  }, true);
  t.after(() => model.dispose());
  await model.loadList(query());
  model.changeQuery(query('a'));
  t.mock.timers.tick(200);
  model.changeQuery(query('ab'));
  t.mock.timers.tick(299);
  assert.equal(calls.length, 1);
  assert.equal(model.state.listStatus, 'ready');
  const ready = nextState(model, (state) => state.listStatus === 'ready', t);
  t.mock.timers.tick(1);
  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[1], 'https://example.test').searchParams.get('search'), 'ab');
  assert.equal(model.state.listStatus, 'loading');
  const { GroupList } = load('components/together/GroupList.tsx');
  let opened;
  const rendered = nodes(React.createElement(GroupList, {
    state: model.state, query: query('ab'), signedIn: true, onQuery() {}, onCreate() {}, onRetry() {}, onLogin() {},
    onOpen: (id) => { opened = id; },
  }));
  rendered.filter((node) => node.type === 'Pressable').at(-1).props.onPress();
  assert.equal(opened, 7, 'existing card stays usable during the replacement request');
  assert.equal(rendered.filter((node) => node.props.accessibilityElementsHidden).length, 0);
  pending.resolve(response({ success: true, groups: [group(8)] }));
  await ready;
  assert.deepEqual(model.state.groups.map((entry) => entry.id), [8]);
});

test('typing invalidates an in-flight response before the debounce expires', { timeout: 5000 }, async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const old = deferred();
  const model = new TogetherModel(async (url) => url.includes('old') ? old.promise : response({ success: true, groups: [group(8)] }), true);
  t.after(() => model.dispose());
  await model.loadList(query());
  const job = model.loadList(query('old'));
  model.changeQuery(query('new'));
  old.resolve(response({ success: true, groups: [group(7)] }));
  await job;
  assert.deepEqual(model.state.groups.map((entry) => entry.id), [8]);
  const ready = nextState(model, (state) => state.listStatus === 'ready', t);
  t.mock.timers.tick(300);
  await ready;
  assert.deepEqual(model.state.groups.map((entry) => entry.id), [8]);
});

test('filter change cancels pending search and immediately uses the latest input', { timeout: 5000 }, async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const calls = [];
  const model = new TogetherModel(async (url) => { calls.push(url); return response({ success: true, groups: [] }); }, true);
  t.after(() => model.dispose());
  await model.loadList(query());
  model.changeQuery(query('faith'));
  const ready = nextState(model, (state) => state.listStatus === 'ready', t);
  model.changeQuery({ search: 'faith', filter: 'public' });
  assert.equal(calls.length, 2);
  await ready;
  t.mock.timers.tick(300);
  assert.equal(calls.length, 2);
  const url = new URL(calls[1], 'https://example.test');
  assert.equal(url.searchParams.get('only_public'), 'true');
  assert.equal(url.searchParams.get('search'), 'faith');
});

test('disposing a query scope cancels its debounced request', { timeout: 5000 }, async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0;
  const model = new TogetherModel(async () => { calls++; return response({ success: true, groups: [] }); }, true);
  await model.loadList(query());
  model.changeQuery(query('next'));
  model.dispose();
  t.mock.timers.tick(300);
  assert.equal(calls, 1);
});

test('list creation action and authenticated empty state both dispatch creation', async () => {
  const { GroupList } = load('components/together/GroupList.tsx');
  const model = new TogetherModel(async () => response({ success: true, groups: [] }), true);
  await model.loadList(query());
  let creates = 0;
  const render = (signedIn, search = '') => nodes(React.createElement(GroupList, {
    state: model.state, query: query(search), signedIn, onQuery() {}, onOpen() {}, onRetry() {}, onLogin() {},
    onCreate: () => { creates++; },
  })).filter((node) => node.type === 'Pressable');
  const signedIn = render(true);
  signedIn.find((node) => node.props.accessibilityLabel === '그룹 생성').props.onPress();
  signedIn.at(-1).props.onPress();
  assert.equal(creates, 2);
  assert.equal(render(false).length, 4, 'guest empty state has no authenticated-only first-create CTA');
  assert.equal(render(true, 'none').length, 4, 'search empty state has no first-create CTA');
});

test('detail failure exposes retry and list return while loading stays busy', () => {
  const { GroupDetailError, GroupDetailLoading } = load('components/together/GroupDetailState.tsx');
  let retries = 0;
  let returns = 0;
  const rendered = nodes(React.createElement(GroupDetailError, {
    message: 'fixture-error', onRetry: () => { retries++; }, onBack: () => { returns++; },
  }));
  const buttons = rendered.filter((node) => node.type === 'Pressable');
  buttons[0].props.onPress();
  buttons[1].props.onPress();
  assert.deepEqual([retries, returns], [1, 1]);
  assert.equal(rendered.filter((node) => node.props.accessibilityRole === 'alert').length, 1);
  const pending = nodes(React.createElement(GroupDetailLoading));
  assert.equal(pending.filter((node) => node.props.accessibilityState?.busy).length, 1);
  assert.equal(pending.filter((node) => node.type === 'Pressable').length, 0);
});

test('pending list is loading rather than an empty result', async () => {
  const pending = deferred();
  const model = new TogetherModel(() => pending.promise, true);
  const job = model.loadList(query());
  assert.equal(model.state.listStatus, 'loading');
  pending.resolve(response({ success: true, groups: [] }));
  await job;
  assert.equal(model.state.listStatus, 'ready');
  assert.deepEqual(model.state.groups, []);
});
test('late search cannot overwrite the latest filter result', async () => {
  const old = deferred();
  const model = new TogetherModel((url) => url.includes('old') ? old.promise : Promise.resolve(response({ success: true, groups: [group(8)] })), true);
  const job = model.loadList(query('old'));
  await model.loadList(query('new'));
  old.resolve(response({ success: true, groups: [group(7)] }));
  await job;
  assert.deepEqual(model.state.groups.map((g) => g.id), [8]);
});
test('failed list can retry without a fake empty success', async () => {
  let failed = true;
  const model = new TogetherModel(async () => response(failed ? { success: false, error: 'offline' } : { success: true, groups: [group(7)] }), true);
  await model.loadList(query());
  assert.equal(model.state.listStatus, 'error');
  failed = false;
  await model.loadList(query());
  assert.equal(model.state.listStatus, 'ready');
  assert.equal(model.state.groups[0].id, 7);
});
test('guest mine has a login state and sends no request', async () => {
  let calls = 0;
  const model = new TogetherModel(async () => { calls++; return response({ success: true, groups: [] }); }, false);
  await model.loadList({ search: '', filter: 'mine' });
  assert.equal(model.state.listStatus, 'guest');
  assert.equal(calls, 0);
});
test('late detail never replaces the newly opened group', async () => {
  const pending = deferred();
  const model = new TogetherModel(async (url) => {
    if (url.endsWith('/members/')) return response(members);
    if (url.endsWith('/7/')) return pending.promise;
    return response({ success: true, group: group(8) });
  }, true);
  const old = model.openGroup(7);
  await model.openGroup(8);
  pending.resolve(response({ success: true, group: group(7) }));
  await old;
  assert.equal(model.state.detail.id, 8);
});
test('join is single-flight and reloads server membership without inventing counts', async () => {
  const pending = deferred();
  let writes = 0;
  let joined = false;
  const model = new TogetherModel(async (url, init) => {
    if (init?.method === 'POST') { writes++; await pending.promise; joined = true; return response({ success: true, message: '가입' }); }
    if (url.endsWith('/members/')) return response(members);
    return response({ success: true, group: group(7, { is_member: joined, member_count: joined ? 4 : 1 }) });
  }, true);
  await model.openGroup(7);
  const first = model.join();
  const second = model.join();
  assert.equal(model.state.joining, true);
  pending.resolve();
  await Promise.all([first, second]);
  assert.equal(writes, 1);
  assert.equal(model.state.detail.is_member, true);
  assert.equal(model.state.detail.member_count, 4);
});
test('rejected join leaves membership unchanged and exposes an error', async () => {
  const model = new TogetherModel(async (url, init) => {
    if (init?.method === 'POST') return response({ success: false, error: '가입 거절' });
    return response(url.endsWith('/members/') ? members : { success: true, group: group(7) });
  }, true);
  await model.openGroup(7);
  await model.join();
  assert.equal(model.state.detail.is_member, false);
  assert.ok(model.state.actionError);
});
test('guest, full group, and existing member never submit join', async () => {
  for (const [signedIn, extra] of [[false, {}], [true, { is_full: true }], [true, { is_member: true }]]) {
    let writes = 0;
    const model = new TogetherModel(async (url, init) => {
      if (init?.method === 'POST') writes++;
      return response(url.endsWith('/members/') ? members : { success: true, group: group(7, extra) });
    }, signedIn);
    await model.openGroup(7);
    await model.join();
    assert.equal(writes, 0);
  }
});
test('disposed session ignores a late list response', async () => {
  const pending = deferred();
  const model = new TogetherModel(() => pending.promise, true);
  const job = model.loadList(query());
  model.dispose();
  pending.resolve(response({ success: true, groups: [group(7)] }));
  await job;
  assert.deepEqual(model.state.groups, []);
});

test('leaving a detail discards an in-flight join acknowledgement', async () => {
  const pending = deferred();
  const model = new TogetherModel(async (url, init) => init?.method === 'POST'
    ? pending.promise : response({ success: true, group: group(url.endsWith('/8/') ? 8 : 7) }), true);
  await model.openGroup(7);
  const join = model.join();
  await model.openGroup(8);
  pending.resolve(response({ success: true, message: '가입' }));
  await join;
  assert.equal(model.state.detail.id, 8);
  assert.equal(model.state.detail.is_member, false);
  assert.equal(model.state.joining, false);
});
test('native list buttons, search input, and card dispatch real feature callbacks', async () => {
  const { GroupList } = load('components/together/GroupList.tsx');
  const model = new TogetherModel(async () => response({ success: true, groups: [group(7)] }), true);
  await model.loadList(query());
  let selected;
  let opened;
  const tree = nodes(React.createElement(GroupList, {
    state: model.state, query: query(), signedIn: true, onQuery: (value) => { selected = value; },
    onOpen: (id) => { opened = id; }, onRetry() {}, onLogin() {}, onCreate() {},
  }));
  tree.find((node) => node.type === 'TextInput').props.onChangeText('new');
  assert.deepEqual(selected, { search: 'new', filter: 'all' });
  const buttons = tree.filter((node) => node.type === 'Pressable');
  assert.equal(buttons.find((node) => node.props.accessibilityLabel === '전체').props.accessibilityState.selected, true);
  buttons.find((node) => node.props.accessibilityLabel === '공개').props.onPress();
  assert.deepEqual(selected, { search: '', filter: 'public' });
  buttons.at(-1).props.onPress();
  assert.equal(opened, 7);
  assert.equal(tree.some((node) => node.type === 'WebView'), false);
});
test('native list distinguishes loading, error retry, guest login, and empty states', () => {
  const { GroupList } = load('components/together/GroupList.tsx');
  const model = new TogetherModel(async () => response({ success: true, groups: [] }), false);
  let retries = 0;
  let logins = 0;
  const render = (listStatus) => nodes(React.createElement(GroupList, {
    state: { ...model.state, listStatus, listError: 'fixture-error' }, query: query(), signedIn: false,
    onQuery() {}, onOpen() {}, onCreate() {}, onRetry: () => { retries++; }, onLogin: () => { logins++; },
  }));
  assert.equal(render('loading').filter((node) => node.props.accessibilityState?.busy).length, 1);
  assert.equal(render('loading').filter((node) => node.props.accessibilityElementsHidden).length, 4);
  const errors = render('error');
  assert.equal(errors.filter((node) => node.props.accessibilityRole === 'alert').length, 1);
  errors.filter((node) => node.type === 'Pressable').at(-1).props.onPress();
  assert.equal(retries, 1);
  render('guest').filter((node) => node.type === 'Pressable').at(-1).props.onPress();
  assert.equal(logins, 1);
  assert.equal(render('ready').filter((node) => node.type === 'Pressable').length, 4);
});
test('native join CTA routes guest to login, member to unavailable chat, and blocks full or pending joins', () => {
  const { GroupJoinAction } = load('components/together/GroupJoinAction.tsx');
  let joins = 0;
  let logins = 0;
  let alerts = 0;
  native.Alert = { alert: () => { alerts++; } };
  const button = (extra = {}) => nodes(React.createElement(GroupJoinAction, {
    group: group(7), signedIn: true, joining: false,
    onJoin: () => { joins++; }, onLogin: () => { logins++; }, ...extra,
  })).find((node) => node.type === 'Pressable');
  button({ signedIn: false }).props.onPress();
  assert.equal(logins, 1);
  assert.equal(joins, 0);
  button().props.onPress();
  assert.equal(joins, 1);
  for (const extra of [{ joining: true }, { group: group(7, { is_full: true }) }]) {
    assert.equal(button(extra).props.disabled, true);
    assert.equal(button(extra).props.onPress, undefined);
  }
  button({ group: group(7, { is_member: true }) }).props.onPress();
  assert.equal(alerts, 1);
  assert.equal(joins, 1);
});
function nodes(element) {
  if (!React.isValidElement(element)) return [];
  if (typeof element.type === 'function') return nodes(element.type(element.props));
  return [element, ...React.Children.toArray(element.props.children).flatMap(nodes)];
}

test('create validates beta limits, retains draft on failure, and is single flight until acknowledgement', async () => {
  const pending = deferred();
  const calls = [];
  const model = new TogetherModel(async (url, init) => {
    calls.push([url, init]);
    if (url.endsWith('/plans/')) return response({ success: true, plans: [{ id: 3, name: '일독' }] });
    if (init?.method === 'POST') return pending.promise;
    return response({ success: true, groups: [] });
  }, true);
  await model.openCreate();
  assert.deepEqual(model.state.draft, { name: '', description: '', plan_ids: [], max_members: '20', is_public: true });
  for (const invalid of [
    { name: '', plan_ids: [3], max_members: '20' },
    { name: 'a'.repeat(101), plan_ids: [3], max_members: '20' },
    { name: '그룹', plan_ids: [], max_members: '20' },
    { name: '그룹', plan_ids: [3], max_members: '1' },
    { name: '그룹', plan_ids: [3], max_members: '101' },
    { name: '그룹', plan_ids: [3], max_members: '2.5' },
  ]) {
    model.editDraft(invalid);
    await model.create();
    assert.ok(model.state.createError);
  }
  model.editDraft({ name: '그룹', plan_ids: [3], max_members: '2', description: 'a'.repeat(501) });
  await model.create();
  assert.equal(calls.filter(([, init]) => init?.method === 'POST').length, 0);
  model.editDraft({ description: '' });
  const first = model.create();
  await model.create();
  assert.equal(calls.filter(([, init]) => init?.method === 'POST').length, 1);
  assert.equal(model.state.selectedId, null);
  pending.resolve(response({ success: false, error: '거절' }));
  await first;
  assert.equal(model.state.createOpen, true);
  assert.equal(model.state.draft.name, '그룹');
  assert.ok(model.state.createError);
});

test('successful creation opens acknowledged group and refreshes list only afterwards', async () => {
  const pending = deferred();
  let reads = 0;
  const model = new TogetherModel(async (url, init) => {
    if (url.endsWith('/plans/')) return response({ success: true, plans: [{ id: 3, name: '일독' }] });
    if (init?.method === 'POST') return pending.promise;
    reads++;
    return response({ success: true, groups: [group(9, { is_member: true })] });
  }, true);
  await model.loadList(query());
  await model.openCreate();
  model.editDraft({ name: '그룹', plan_ids: [3] });
  const job = model.create();
  assert.equal(reads, 1);
  pending.resolve(response({ success: true, group: group(9, { is_member: true, my_role: '관리자' }) }));
  await job;
  assert.equal(reads, 2);
  assert.equal(model.state.detail.id, 9);
  assert.equal(model.state.createOpen, false);
});

test('leave cancel sends nothing; failure preserves membership; retry acknowledges before refresh', async () => {
  let pending = deferred();
  let writes = 0;
  let reads = 0;
  const model = new TogetherModel(async (url, init) => {
    if (init?.method === 'POST') { writes++; return pending.promise; }
    reads++;
    return response(url.includes('?') ? { success: true, groups: [] } : { success: true, group: group(7, { is_member: true, my_role: '멤버' }) });
  }, true);
  await model.loadList(query());
  await model.openGroup(7);
  model.requestLeave();
  model.cancelLeave();
  await model.leave();
  assert.equal(writes, 0);
  model.requestLeave();
  const failure = model.leave();
  await model.leave();
  assert.equal(writes, 1);
  assert.equal(reads, 2);
  pending.resolve(response({ success: false, error: '거절' }));
  await failure;
  assert.equal(model.state.detail.is_member, true);
  assert.ok(model.state.actionError);
  pending = deferred();
  const retry = model.leave();
  pending.resolve(response({ success: true }));
  await retry;
  assert.equal(model.state.selectedId, null);
  assert.equal(reads, 3);
});

test('guest, nonmember, and admin cannot leave or open unauthorized create', async () => {
  for (const [signedIn, extra] of [[false, { is_member: true }], [true, {}], [true, { is_member: true, my_role: '관리자' }]]) {
    let writes = 0;
    const model = new TogetherModel(async (url, init) => {
      if (init?.method === 'POST') writes++;
      return response({ success: true, group: group(7, extra) });
    }, signedIn);
    await model.openGroup(7);
    model.requestLeave();
    await model.leave();
    assert.equal(writes, 0);
    assert.equal(model.state.leaveConfirm, false);
    if (!signedIn) { await model.openCreate(); assert.equal(model.state.createOpen, false); }
  }
});

test('native lifecycle form dispatches edits and confirmation cancel without a request', async () => {
  native.Modal = 'Modal';
  native.ScrollView = 'ScrollView';
  native.KeyboardAvoidingView = 'KeyboardAvoidingView';
  native.Platform = { OS: 'ios' };
  const { GroupLifecycle } = load('components/together/GroupLifecycle.tsx');
  let writes = 0;
  const model = new TogetherModel(async (url, init) => {
    if (init?.method === 'POST') writes++;
    return response(url.endsWith('/plans/') ? { success: true, plans: [{ id: 3, name: '일독' }] }
      : { success: true, group: group(7, { is_member: true, my_role: '멤버' }) });
  }, true);
  await model.openCreate();
  const render = () => nodes(React.createElement(GroupLifecycle, { model, state: model.state }));
  const inputs = render().filter((node) => node.type === 'TextInput');
  assert.equal(inputs[0].props.maxLength, 100);
  assert.equal(inputs[1].props.maxLength, 500);
  inputs[0].props.onChangeText('새 그룹');
  inputs[2].props.onChangeText('30');
  render().find((node) => node.props.accessibilityLabel === '일독' && node.type === 'Pressable').props.onPress();
  assert.deepEqual(model.state.draft.plan_ids, [3]);
  assert.equal(model.state.draft.max_members, '30');
  model.closeCreate();
  await model.openGroup(7);
  model.requestLeave();
  const buttons = render().filter((node) => node.type === 'Pressable');
  buttons.find((node) => node.props.accessibilityLabel === '취소').props.onPress();
  assert.equal(model.state.leaveConfirm, false);
  assert.equal(writes, 0);
  assert.equal(render().some((node) => node.type === 'WebView'), false);
});

test('plans retry and create retry preserve draft and consume acknowledged server group', async () => {
  let plansFail = true;
  let createFail = true;
  let writes = 0;
  const model = new TogetherModel(async (url, init) => {
    if (url.endsWith('/plans/')) return response(plansFail ? { success: false } : { success: true, plans: [{ id: 3, name: '일독' }, { id: 4, name: '신약' }] });
    if (init?.method === 'POST') {
      writes++;
      assert.deepEqual(JSON.parse(init.body), { name: '그룹', description: '', plan_ids: [3, 4], max_members: 100, is_public: false });
      return response(createFail ? { success: false } : { success: true, group: group(9, { is_member: true, my_role: '관리자' }) });
    }
  }, true);
  await model.openCreate();
  assert.equal(model.state.plansStatus, 'error');
  plansFail = false;
  await model.loadCreationPlans();
  model.editDraft({ name: '그룹', plan_ids: [3, 4], max_members: '100', is_public: false });
  await model.create();
  assert.equal(model.state.createOpen, true);
  createFail = false;
  await model.create();
  assert.equal(writes, 2);
  assert.equal(model.state.detail.id, 9);
});

test('changing group invalidates a pending creation acknowledgement', async () => {
  const pending = deferred();
  const model = new TogetherModel(async (url, init) => {
    if (url.endsWith('/plans/')) return response({ success: true, plans: [{ id: 3, name: '일독' }] });
    if (init?.method === 'POST') return pending.promise;
    return response({ success: true, group: group(8) });
  }, true);
  await model.openCreate();
  model.editDraft({ name: '그룹', plan_ids: [3] });
  const job = model.create();
  await model.openGroup(8);
  pending.resolve(response({ success: true, group: group(9) }));
  await job;
  assert.equal(model.state.detail.id, 8);
  assert.equal(model.state.createOpen, false);
});

test('changing group or disposing session discards late leave acknowledgement', async () => {
  for (const dispose of [false, true]) {
    const pending = deferred();
    let reads = 0;
    const model = new TogetherModel(async (url, init) => {
      if (init?.method === 'POST') return pending.promise;
      reads++;
      return response({ success: true, group: group(url.endsWith('/8/') ? 8 : 7, { is_member: true, my_role: '멤버' }) });
    }, true);
    await model.openGroup(7);
    model.requestLeave();
    const job = model.leave();
    if (dispose) model.dispose();
    else await model.openGroup(8);
    pending.resolve(response({ success: true }));
    await job;
    assert.equal(model.state.selectedId, dispose ? 7 : 8);
    assert.equal(reads, dispose ? 1 : 2);
  }
});

test('actual native board button opens current group in current WebView stack and preserves local tab', async () => {
  const navigations = [];
  let ready = true;
  let stack = { web: 'https://beta.maeil1dok.app' };
  const model = new TogetherModel(async url => response({ success: true, group: group(url.endsWith('/23/') ? 23 : 17, { is_member: true }) }), true);
  await model.openGroup(17);
  // Native rendering is a host boundary; execute the shipped screen, detail,
  // button and their handlers. Effects are excluded, not navigation handlers.
  let values = [], cursor = 0;
  const hooks = {
    ...React,
    useMemo: fn => fn(), useCallback: fn => fn, useEffect() {},
    useRef: () => ({ current: null }),
    useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    useState: initial => {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
      return [values[index], value => { values[index] = value; }];
    },
  };
  const overrides = {
    react: hooks,
    '@react-navigation/native': { useFocusEffect() {} },
    '../auth/AuthSession': { useAuth: () => ({ apiFetch: async () => response({}), status: 'signedIn', accessToken: 'owner' }) },
    '../navigation/AppStackContext': { useAppStack: () => ({ stack }) },
    '../navigation/NativeTabBar': { useNativeTabBarInset: () => 84 },
    '../navigation/navigationRef': { navigationRef: { isReady: () => ready, navigate: (...args) => navigations.push(args) } },
    '../components/together/TogetherModel': { TogetherModel: class { constructor() { return model; } } },
  };
  const Screen = load('screens/TogetherScreen.tsx', overrides).default;
  const render = () => { cursor = 0; return nodes(React.createElement(Screen, { route: {} })); };
  const button = (tree, label) => tree.find(node => node.type === 'Pressable' && node.props.accessibilityLabel === label);
  button(render(), '일정').props.onPress();
  assert.equal(button(render(), '일정').props.accessibilityState.selected, true);
  button(render(), '게시판').props.onPress();
  assert.deepEqual(navigations, [['WebView', { url: 'https://beta.maeil1dok.app/groups/17?tab=board' }]]);
  assert.equal(button(render(), '일정').props.accessibilityState.selected, true);
  assert.equal(model.state.selectedId, 17);

  stack = { web: 'https://maeil1dok.app' };
  await model.openGroup(23);
  button(render(), '게시판').props.onPress();
  assert.deepEqual(navigations.at(-1), ['WebView', { url: 'https://maeil1dok.app/groups/23?tab=board' }]);
  ready = false;
  button(render(), '게시판').props.onPress();
  assert.equal(navigations.length, 2);
  assert.equal(render().some(node => node.type === 'WebView'), false);
});
