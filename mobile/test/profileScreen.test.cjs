const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const cache = new Map();
const native = {
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator', Image: 'Image', TextInput: 'TextInput',
  Switch: 'Switch', Modal: 'Modal', RefreshControl: 'RefreshControl',
  KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'ios' },
  StyleSheet: { create: x => x, absoluteFillObject: {} }, useColorScheme: () => 'light',
};
function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  if (!fs.existsSync(filename)) return {};
  if (cache.has(filename)) return cache.get(filename);
  const instance = new Module(filename, module);
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const base = instance.require.bind(instance);
  instance.require = name => {
    if (name === 'react-native') return native;
    if (name === '@expo/vector-icons/Ionicons') return { __esModule: true, default: 'Icon' };
    if (name === 'react-native-svg') return { __esModule: true, default: 'Svg', Circle: 'Circle' };
    if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }) };
    if (name.startsWith('.')) {
      const target = path.resolve(path.dirname(filename), name);
      const file = [`${target}.ts`, `${target}.tsx`].find(fs.existsSync);
      return file ? load(path.relative(path.resolve(__dirname, '..'), file)) : {};
    }
    return base(name);
  };
  instance._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  cache.set(filename, instance.exports);
  return instance.exports;
}
const { createProfileController } = load('components/profile/profileController.ts');
const { ProfileView } = load('components/profile/ProfileView.tsx');
const profile = { id: 1, user: { id: 7, username: 'reader', nickname: '독자', profile_image: null }, bio: '', total_completed_days: 37, current_streak: 3, longest_streak: 12, joined_date: '2026-01-01T00:00:00Z', is_public: true, followers_count: 2, following_count: 4, is_following: false, is_mutual_follow: false };
const ok = json => ({ ok: true, status: 200, json: async () => json, text: async () => '' });
const wrapped = data => ok({ success: true, data });
function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}
function fetcher(p) {
  if (p.endsWith('/user/')) return Promise.resolve(ok({ id: 7, username: 'reader' }));
  if (p.includes('/calendar/')) return Promise.resolve(wrapped({ calendar: [], plans: [] }));
  return Promise.resolve(wrapped({ profile }));
}
function controller(apiFetch = fetcher, status = 'signedIn') {
  assert.equal(typeof createProfileController, 'function', 'native profile state controller must exist');
  return createProfileController({ apiFetch, status, month: '2026-09' });
}
function nodes(el) {
  if (!React.isValidElement(el)) return [];
  const resolved = typeof el.type === 'function' ? el.type(el.props) : el;
  if (!resolved) return [];
  return [resolved, ...React.Children.toArray(resolved.props.children).flatMap(nodes)];
}
test('guest performs zero requests and renders login instead of fabricated profile', async () => {
  let calls = 0;
  const c = controller(async () => { calls++; throw Error('unexpected'); }, 'signedOut');
  await c.start();
  const tree = nodes(ProfileView({ state: c.getSnapshot(), controller: c, onLogin() {}, onRead() {}, bottomInset: 97 }));
  assert.equal(calls, 0);
  assert.equal(c.getSnapshot().kind, 'guest');
  assert.ok(tree.some(n => n.props.testID === 'profile-login'));
});
test('guest can switch beta mode from the profile tab before signing in', async () => {
  const c = controller(async () => { throw Error('unexpected'); }, 'signedOut');
  await c.start();
  const changes = [];
  const tree = nodes(ProfileView({ state: c.getSnapshot(), controller: c, onLogin() {}, onRead() {}, bottomInset: 97,
    betaMode: false, onBetaModeChange: enabled => changes.push(enabled) }));
  const toggle = tree.find(n => n.props.testID === 'profile-beta-mode');
  assert.ok(toggle, 'guest profile exposes the beta switch');
  assert.equal(toggle.props.value, false);
  toggle.props.onValueChange(true);
  assert.deepEqual(changes, [true]);
});
test('signed-in A opening B loads B and cannot edit A through B', async () => {
  const calls = [];
  const b = { ...profile, user: { ...profile.user, id: 8, nickname: 'B' } };
  const c = createProfileController({ status: 'signedIn', month: '2026-09', targetId: 8,
    apiFetch: async p => {
      calls.push(p);
      return p === '/api/v1/auth/profile/8/' ? wrapped({ profile: b }) : fetcher(p);
    } });
  await c.start();
  assert.equal(c.getSnapshot().profile.user.id, 8);
  assert.equal(c.getSnapshot().isOwnProfile, false);
  c.openEdit();
  await c.save();
  assert.equal(c.getSnapshot().editor, null);
  assert.ok(calls.includes('/api/v1/auth/profile/8/calendar/?year=2026&month=9'));
  assert.equal(calls.includes('/api/v1/auth/profile/7/'), false);
});
test('guest opens public B without requesting an authenticated user', async () => {
  const calls = [];
  const c = createProfileController({ status: 'signedOut', month: '2026-09', targetId: 8,
    apiFetch: async p => {
      calls.push(p);
      if (p === '/api/v1/auth/profile/8/') return wrapped({ profile: { ...profile, user: { ...profile.user, id: 8 } } });
      if (p.includes('/calendar/')) return wrapped({ calendar: [], plans: [] });
      throw Error(`unexpected ${p}`);
    } });
  await c.start();
  assert.equal(c.getSnapshot().kind, 'ready');
  assert.equal(c.getSnapshot().profile.user.id, 8);
  assert.equal(c.getSnapshot().isOwnProfile, false);
  assert.equal(calls.includes('/api/v1/auth/user/'), false);
});
test('profile access denials preserve their category instead of falling back to A', async () => {
  for (const [status, kind] of [[401, 'unauthorized'], [403, 'forbidden'], [404, 'unavailable'], [500, 'error']]) {
    const c = createProfileController({ status: 'signedIn', month: '2026-09', targetId: 8,
      apiFetch: async p => p.endsWith('/user/') ? ok({ id: 7 }) : { ...ok({}), ok: false, status } });
    await c.start();
    assert.equal(c.getSnapshot().kind, kind);
    assert.equal(c.getSnapshot().profile, undefined);
  }
});
test('native API expired authentication remains unauthorized, not a generic load error', async () => {
  const { createApiFetch } = load('api/nativeApi.ts');
  const apiFetch = createApiFetch({ baseUrl: 'https://example.test', getAccessToken: () => 'expired',
    fetchImpl: async () => ({ ...ok({}), ok: false, status: 401 }), refresh: async () => null });
  const c = createProfileController({ apiFetch, status: 'signedIn', targetId: 8, month: '2026-09' });
  await c.start();
  assert.equal(c.getSnapshot().kind, 'unauthorized');
});
test('target groups and follow refresh stay on B; other-profile visibility writes are gated', async () => {
  const calls = [];
  const b = { ...profile, user: { ...profile.user, id: 8 } };
  const c = createProfileController({ status: 'signedIn', month: '2026-09', targetId: 8,
    apiFetch: async (p, init) => {
      calls.push({ p, method: init?.method });
      if (p.endsWith('/user/')) return ok({ id: 7 });
      if (p.includes('/groups/')) return ok({ success: true, groups: [] });
      if (p.includes('/followers/')) return wrapped({ followers: [{ ...profile.user, id: 9, is_following: false, total_completed_days: 2 }] });
      if (init?.method === 'POST') return ok({ success: true });
      if (p.includes('/calendar/')) return wrapped({ calendar: [], plans: [] });
      return wrapped({ profile: p.endsWith('/profile/8/') ? b : profile });
    } });
  await c.start();
  await c.selectTab('groups');
  assert.ok(calls.some(call => call.p === '/api/v1/todos/users/8/groups/'));
  await c.visibility(5);
  await c.people('followers');
  await c.follow(9);
  assert.equal(c.getSnapshot().profile.user.id, 8);
  assert.equal(calls.some(call => call.p === '/api/v1/auth/profile/7/'), false);
  assert.equal(calls.some(call => call.method === 'PATCH'), false);
});
test('guest public profile uses native API without bearer and has no edit/follow/visibility actions', async () => {
  const { createApiFetch } = load('api/nativeApi.ts');
  const calls = [];
  const group = { id: 5, name: '함께', description: '', plans: [], is_public: true,
    member_count: 2, max_members: 10, my_role: null, show_in_profile: false };
  const apiFetch = createApiFetch({ baseUrl: 'https://example.test', getAccessToken: () => null,
    refresh: async () => { throw Error('public endpoints must not refresh'); },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      assert.equal(init.headers.Authorization, undefined);
      if (url.includes('/calendar/')) return wrapped({ calendar: [], plans: [] });
      if (url.includes('/followers/')) return wrapped({ followers: [{ ...profile.user, id: 9, is_following: false, total_completed_days: 1 }] });
      if (url.includes('/groups/')) return ok({ success: true, groups: [group] });
      return wrapped({ profile: { ...profile, user: { ...profile.user, id: 8 } } });
    } });
  const c = createProfileController({ apiFetch, status: 'signedOut', targetId: 8, month: '2026-09' });
  await c.start();
  await c.selectTab('groups');
  await c.people('followers');
  c.openEdit();
  await c.save();
  await c.visibility(5);
  await c.follow(9);
  const tree = nodes(ProfileView({ state: c.getSnapshot(), controller: c, onLogin() {}, onRead() {},
    onProfile() {}, onGroups() {}, bottomInset: 0 }));
  assert.equal(c.getSnapshot().editor, null);
  assert.equal(calls.some(call => call.init.method && call.init.method !== 'GET'), false);
  assert.equal(tree.some(n => n.props.testID === 'profile-edit'), false);
  assert.ok(tree.some(n => n.props.testID === 'profile-group-open-5'));
  assert.equal(tree.some(n => ['팔로우', '언팔로우', '프로필에 표시', '프로필에서 숨기기'].includes(n.props.accessibilityLabel)), false);
});
test('people rows close the sheet and open their profile; group cards and empty state navigate', async () => {
  const group = { id: 5, name: '함께', description: '', plans: [], is_public: true, member_count: 2, max_members: 10, my_role: '관리자', show_in_profile: true };
  let groups = [group, { ...group, id: 6, show_in_profile: false }];
  const c = controller(p => {
    if (p.includes('/followers/')) return Promise.resolve(wrapped({ followers: [{ ...profile.user, id: 8, is_following: false, total_completed_days: 2 }] }));
    if (p.includes('/groups/')) return Promise.resolve(ok({ success: true, groups }));
    return fetcher(p);
  });
  await c.start();
  let personId, groupUrl;
  const render = () => nodes(ProfileView({ state: c.getSnapshot(), controller: c, onLogin() {}, onRead() {},
    onProfile: id => { personId = id; }, onGroups: url => { groupUrl = url; }, bottomInset: 0 }));
  await c.people('followers');
  render().find(n => n.props.testID === 'profile-person-8').props.onPress();
  assert.equal(personId, 8);
  assert.equal(c.getSnapshot().people, null);
  await c.selectTab('groups');
  render().find(n => n.props.testID === 'profile-group-open-5').props.onPress();
  assert.equal(groupUrl, '/groups/5');
  c.hiddenGroups();
  render().find(n => n.props.testID === 'profile-group-open-6').props.onPress();
  assert.equal(groupUrl, '/groups/6');
  groups = [];
  await c.selectTab('groups', true);
  nodes(render().find(n => n.props.testID === 'profile-groups-browse')).find(n => n.type === 'Pressable').props.onPress();
  assert.equal(groupUrl, '/groups');
});
test('disposed B response cannot update replacement target C', { timeout: 2000 }, async () => {
  const pending = deferred();
  const requested = deferred();
  const b = createProfileController({ status: 'signedOut', month: '2026-09', targetId: 8,
    apiFetch: p => { requested.resolve(); return pending.promise; } });
  const task = b.start();
  await requested.promise;
  b.dispose();
  const c = createProfileController({ status: 'signedOut', month: '2026-09', targetId: 9,
    apiFetch: async p => p.includes('/calendar/') ? wrapped({ calendar: [], plans: [] })
      : wrapped({ profile: { ...profile, user: { ...profile.user, id: 9 } } }) });
  await c.start();
  pending.resolve(wrapped({ profile: { ...profile, user: { ...profile.user, id: 8 } } }));
  await task;
  assert.equal(b.getSnapshot().kind, 'loading');
  assert.equal(c.getSnapshot().profile.user.id, 9);
});
test('signed-in failure remains retryable error, not guest; retry reaches own data', async () => {
  let failing = true;
  const c = controller(p => failing ? Promise.resolve({ ...ok({}), ok: false, status: 500 }) : fetcher(p));
  await c.start();
  assert.equal(c.getSnapshot().kind, 'error');
  failing = false;
  await c.start();
  assert.equal(c.getSnapshot().kind, 'ready');
  assert.equal(c.getSnapshot().profile.user.id, 7);
});
test('disposed account request cannot publish old account data', async () => {
  const pending = deferred();
  const requested = deferred();
  const c = controller(p => {
    if (p.endsWith('/profile/7/')) { requested.resolve(); return pending.promise; }
    return fetcher(p);
  });
  const task = c.start();
  await requested.promise;
  c.dispose();
  pending.resolve(wrapped({ profile }));
  await task;
  assert.equal(c.getSnapshot().kind, 'loading');
});
test('late previous month response never replaces selected month', async () => {
  const late = deferred();
  const c = controller(p => p.includes('month=8') ? late.promise : fetcher(p));
  await c.start();
  const previous = c.changeMonth(-1);
  await c.changeMonth(-1);
  late.resolve(wrapped({ calendar: [{ date: '2026-08-01', is_completed: true, book: '창세기', chapters: '1', start_chapter: 1, end_chapter: 1, plan_id: 1, plan_name: 'A', color: '#111111', schedule_id: 1, schedule_text: 'A' }], plans: [] }));
  await previous;
  assert.equal(c.getSnapshot().month, '2026-07');
  assert.deepEqual(c.getSnapshot().calendar.data.calendar, []);
});
test('failed save keeps draft open and double press sends one PUT', async () => {
  const pending = deferred();
  let writes = 0;
  const c = controller((p, init) => {
    if (init?.method === 'PUT') { writes++; return pending.promise; }
    return fetcher(p);
  });
  await c.start();
  c.openEdit();
  c.edit({ bio: '보존할 소개', is_public: false });
  const first = c.save();
  await c.save();
  pending.resolve(ok({ success: false, error: 'save failed' }));
  await first;
  assert.equal(writes, 1);
  assert.equal(c.getSnapshot().editor.bio, '보존할 소개');
  assert.equal(c.getSnapshot().editor.saving, false);
  assert.ok(c.getSnapshot().editor.error);
  assert.equal(c.getSnapshot().profile.bio, '');
});
test('native ready view exposes tab actions and floating inset without a WebView', async () => {
  const c = controller();
  await c.start();
  const tree = nodes(ProfileView({ state: c.getSnapshot(), controller: c, onLogin() {}, onRead() {}, bottomInset: 97 }));
  assert.equal(tree.some(n => n.type === 'WebView'), false);
  assert.equal(tree.filter(n => n.props.accessibilityRole === 'tab').length, 3);
  const scroll = tree.find(n => n.props.testID === 'profile-scroll');
  assert.ok(scroll.props.contentContainerStyle.paddingBottom >= 97);
  tree.find(n => n.props.testID === 'profile-edit').props.onPress();
  assert.equal(c.getSnapshot().editor.is_public, true);
});
test('native editor input and switch reach PUT, then successful response closes the sheet', async () => {
  let written;
  const c = controller((p, init) => {
    if (init?.method === 'PUT') {
      written = JSON.parse(init.body);
      return Promise.resolve(wrapped({ profile: { ...profile, ...written } }));
    }
    return fetcher(p);
  });
  await c.start();
  c.openEdit();
  const render = () => nodes(ProfileView({ state: c.getSnapshot(), controller: c, onLogin() {}, onRead() {}, bottomInset: 0 }));
  render().find(n => n.props.testID === 'profile-bio').props.onChangeText('새 소개');
  render().find(n => n.type === 'Switch').props.onValueChange(false);
  await c.save();
  assert.deepEqual(written, { bio: '새 소개', is_public: false });
  assert.equal(c.getSnapshot().profile.bio, '새 소개');
  assert.equal(c.getSnapshot().editor, null);
});
test('group visibility failure leaves visible group intact, successful retry uses server ack', async () => {
  let fail = true;
  const group = { id: 5, name: '함께', description: '', plans: [], is_public: true, member_count: 2, max_members: 10, my_role: '관리자', show_in_profile: true };
  const c = controller((p, init) => {
    if (init?.method === 'PATCH') return Promise.resolve(ok(fail ? { success: false } : { success: true, show_in_profile: false }));
    if (p.includes('/groups/')) return Promise.resolve(ok({ success: true, groups: [group] }));
    return fetcher(p);
  });
  await c.start();
  await c.selectTab('groups');
  await c.visibility(5);
  assert.equal(c.getSnapshot().groups.data[0].show_in_profile, true);
  assert.ok(c.getSnapshot().actionError);
  fail = false;
  await c.visibility(5);
  assert.equal(c.getSnapshot().groups.data[0].show_in_profile, false);
});
test('achievement errors do not become empty success and retry actually reloads', async () => {
  let fail = true;
  const c = controller(p => p.includes('/achievements/')
    ? Promise.resolve(ok(fail ? { success: false } : { success: true, data: { achievements: [] } }))
    : fetcher(p));
  await c.start();
  await c.selectTab('achievements');
  assert.equal(c.getSnapshot().achievements.kind, 'error');
  fail = false;
  await c.selectTab('achievements', true);
  assert.deepEqual(c.getSnapshot().achievements, { kind: 'ready', data: [] });
});
test('disposed save cannot publish or dismiss the replacement account editor', async () => {
  const pending = deferred();
  const a = controller((p, init) => init?.method === 'PUT' ? pending.promise : fetcher(p));
  await a.start();
  a.openEdit();
  const saving = a.save();
  let notifications = 0;
  a.subscribe(() => notifications++);
  a.dispose();
  const b = controller();
  await b.start();
  b.openEdit();
  b.edit({ bio: 'B draft', is_public: false });
  pending.resolve(wrapped({ profile: { ...profile, bio: 'old A response' } }));
  await saving;
  assert.equal(notifications, 0);
  assert.equal(b.getSnapshot().editor.bio, 'B draft');
});
test('current month cannot move into future and duplicate tab press loads once', async () => {
  let calls = 0;
  const pending = deferred();
  const c = controller(p => {
    if (p.includes('/achievements/')) { calls++; return pending.promise; }
    return fetcher(p);
  });
  await c.start();
  await c.changeMonth(1);
  assert.equal(c.getSnapshot().month, '2026-09');
  const first = c.selectTab('achievements');
  await c.selectTab('achievements');
  pending.resolve(wrapped({ achievements: [] }));
  await first;
  assert.equal(calls, 1);
});
test('native calendar day opens both schedules and reading action retains selected row identity', async () => {
  const row = { date: '2026-09-21', is_completed: true, book: '창세기', chapters: '1-2장', start_chapter: 1, end_chapter: 2, plan_id: 3, plan_name: '일독', color: '#123456', schedule_id: 11, schedule_text: '창세기 1-2장' };
  const c = controller(p => p.includes('/calendar/') ? Promise.resolve(wrapped({
    calendar: [row, { ...row, schedule_id: 12, start_chapter: 3, end_chapter: 4, is_completed: false }], plans: [],
  })) : fetcher(p));
  await c.start();
  let opened;
  const render = () => nodes(ProfileView({ state: c.getSnapshot(), controller: c, onLogin() {}, onRead: url => { opened = url; }, bottomInset: 0 }));
  render().find(n => n.props.testID === 'profile-day-2026-09-21').props.onPress();
  const sheet = render().find(n => n.type === 'Modal');
  const readButtons = nodes(sheet).filter(n => n.type === 'Pressable' && n.props.accessibilityLabel === '본문 읽기');
  assert.equal(readButtons.length, 2);
  readButtons[1].props.onPress();
  assert.equal(new URL(opened, 'https://example.test').searchParams.get('schedule'), '12');
  assert.equal(new URL(opened, 'https://example.test').searchParams.get('chapter'), '3');
  assert.equal(c.getSnapshot().selectedDate, null);
});
