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
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = instance.require.bind(instance);
  instance.require = (name) => {
    if (name === 'react-native') return native;
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
    if (!name.startsWith('.')) return original(name);
    const base = path.resolve(path.dirname(filename), name);
    const file = [`${base}.ts`, `${base}.tsx`].find(fs.existsSync);
    return load(path.relative(path.resolve(__dirname, '..'), file));
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
    state: model.state, query: query(), onQuery: (value) => { selected = value; },
    onOpen: (id) => { opened = id; }, onRetry() {}, onLogin() {},
  }));
  tree.find((node) => node.type === 'TextInput').props.onChangeText('new');
  assert.deepEqual(selected, { search: 'new', filter: 'all' });
  const buttons = tree.filter((node) => node.type === 'Pressable');
  assert.equal(buttons[0].props.accessibilityState.selected, true);
  buttons[1].props.onPress();
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
    state: { ...model.state, listStatus, listError: 'fixture-error' }, query: query(),
    onQuery() {}, onOpen() {}, onRetry: () => { retries++; }, onLogin: () => { logins++; },
  }));
  assert.equal(render('loading').filter((node) => node.type === 'ActivityIndicator').length, 1);
  const errors = render('error');
  assert.equal(errors.filter((node) => node.props.accessibilityRole === 'alert').length, 1);
  errors.filter((node) => node.type === 'Pressable').at(-1).props.onPress();
  assert.equal(retries, 1);
  render('guest').filter((node) => node.type === 'Pressable').at(-1).props.onPress();
  assert.equal(logins, 1);
  assert.equal(render('ready').filter((node) => node.type === 'Pressable').length, 3);
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
