const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  if (!fs.existsSync(filename)) return {};
  const instance = new Module(filename, module);
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const base = instance.require.bind(instance);
  instance.require = name => name.startsWith('.')
    ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), `${name}.ts`)))
    : base(name);
  instance._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return instance.exports;
}
const api = load('api/profileData.ts');
const profile = {
  id: 19, user: { id: 7, username: 'reader', nickname: '독자', profile_image: null },
  bio: '', total_completed_days: 37, current_streak: 3, longest_streak: 12,
  joined_date: '2026-01-01T00:00:00Z', is_public: true,
  followers_count: 2, following_count: 4, is_following: false, is_mutual_follow: false,
};
const row = {
  date: '2026-09-21', is_completed: true, book: '창세기', chapters: '1-2장',
  start_chapter: 1, end_chapter: 2, plan_id: 3, plan_name: '일독',
  color: '#123456', schedule_id: 11, schedule_text: '창세기 1-2장',
};
const response = (json, status = 200) => ({ ok: status < 400, status, json: async () => json, text: async () => '' });
const envelope = data => ({ success: true, message: '', data });

test('own profile resolves raw auth user then nested profile without fabricated metrics', async () => {
  const calls = [];
  const result = await api.loadOwnProfile(async p => {
    calls.push(p);
    return response(p.endsWith('/user/') ? { id: 7, username: 'reader' } : envelope({ profile }));
  });
  assert.deepEqual(calls, ['/api/v1/auth/user/', '/api/v1/auth/profile/7/']);
  assert.deepEqual(result, profile);
  assert.equal('hasena_count' in result, false);
});
test('HTTP errors and semantic failures reject rather than become empty data', async () => {
  for (const res of [response({ error: 'down' }, 500), response({ success: false }), response(envelope({ calendar: null, plans: [] }))]) {
    await assert.rejects(() => api.loadCalendar(async () => res, 7, '2026-09'));
  }
});
test('calendar parses all rows and plans from the real envelope and exact month query', async () => {
  let requested;
  const input = { calendar: [row, { ...row, schedule_id: 12, is_completed: false }], plans: [{ id: 3, name: '일독', color: '#123456' }] };
  assert.deepEqual(await api.loadCalendar(async p => { requested = p; return response(envelope(input)); }, 7, '2026-09'), input);
  assert.equal(requested, '/api/v1/auth/profile/7/calendar/?year=2026&month=9');
});
test('month grid treats partial completion as missed, no schedule as empty, and crosses years', () => {
  const cells = api.calendarCells('2026-09', [row, { ...row, schedule_id: 12, is_completed: false }], '2026-09-22');
  assert.equal(cells.length, 42);
  assert.equal(cells.find(c => c.date === '2026-09-21').state, 'missed');
  assert.equal(cells.find(c => c.date === '2026-09-20').state, 'empty');
  assert.equal(cells.find(c => c.date === '2026-09-22').state, 'today');
  assert.equal(api.shiftMonth('2026-01', -1), '2025-12');
});
test('groups use top-level groups and visibility uses acknowledged boolean', async () => {
  const group = { id: 5, name: '함께', description: '', plans: [{ id: 3, name: '일독' }], is_public: true, member_count: 2, max_members: 10, my_role: '관리자', show_in_profile: false };
  assert.deepEqual(await api.loadGroups(async p => {
    assert.equal(p, '/api/v1/todos/groups/?only_mine=true');
    return response({ success: true, groups: [group], total: 1 });
  }), [group]);
  await assert.rejects(() => api.updateGroupVisibility(async () => response({ success: true }), 5, true));
});
test('profile update sends only editable fields and validates returned owner', async () => {
  let request;
  const updated = { ...profile, bio: '소개', is_public: false };
  assert.deepEqual(await api.saveProfile(async (p, init) => {
    request = { p, init }; return response(envelope({ profile: updated }));
  }, 7, { bio: '소개', is_public: false }), updated);
  assert.equal(request.p, '/api/v1/auth/profile/');
  assert.equal(request.init.method, 'PUT');
  assert.deepEqual(JSON.parse(request.init.body), { bio: '소개', is_public: false });
  await assert.rejects(() => api.saveProfile(async () => response(envelope({ profile: { ...updated, user: { ...profile.user, id: 8 } } })), 7, { bio: '', is_public: true }));
});
test('achievement parser preserves locked/unlocked nullable ids and dates', async () => {
  const achievement = { id: null, achievement_type: 'streak_7', title: '7일', description: '연속', icon: 'flame', order: 1, unlocked: false, unlockedAt: null, milestone_value: 7 };
  assert.deepEqual(await api.loadAchievements(async () => response(envelope({ achievements: [achievement] })), 7), [achievement]);
});
test('reading navigation preserves schedule identity and uses native Bible route data', () => {
  const url = new URL(api.readingUrl(row), 'https://beta.maeil1dok.app');
  assert.equal(url.pathname, '/bible');
  assert.equal(url.searchParams.get('book'), 'gen');
  assert.equal(url.searchParams.get('chapter'), '1');
  assert.equal(url.searchParams.get('plan'), '3');
  assert.equal(url.searchParams.get('schedule'), '11');
});
test('unfollow uses DELETE with the user id in the path, not the follow POST shape', async () => {
  let call;
  await api.togglePersonFollow(async (path, init) => {
    call = { path, init }; return response({ success: true });
  }, 8, true);
  assert.equal(call.path, '/api/v1/auth/unfollow/8/');
  assert.equal(call.init.method, 'DELETE');
  assert.equal(call.init.body, undefined);
});
test('missing profile metric is rejected rather than silently replaced by zero', async () => {
  const malformed = { ...profile };
  delete malformed.current_streak;
  await assert.rejects(() => api.loadOwnProfile(async p => response(
    p.endsWith('/user/') ? { id: 7 } : envelope({ profile: malformed }),
  )));
});
test('profile route parsing distinguishes own default, target and invalid target', () => {
  for (const url of [undefined, '/profile', '/profile/', 'https://beta.maeil1dok.app/profile?tab=groups']) {
    assert.equal(api.profileTargetId(url), null);
  }
  for (const url of ['/profile/8', '/profile/8/', 'https://beta.maeil1dok.app/profile/8?tab=groups']) {
    assert.equal(api.profileTargetId(url), 8);
  }
  for (const url of ['/profile/nope', '/profile/0', '/profile/-1', '/profile/1.5', '/profile/9007199254740993', '/profile/8/edit']) {
    assert.equal(Number.isNaN(api.profileTargetId(url)), true);
  }
});
test('requested B rejects an A response and invalid targets make no profile request', async () => {
  await assert.rejects(() => api.loadProfile(async () => response(envelope({ profile })), 8));
  let calls = 0;
  await assert.rejects(() => api.loadProfile(async () => { calls++; return response(envelope({ profile })); }, NaN));
  assert.equal(calls, 0);
});
test('public groups use the requested user endpoint and preserve viewer membership metadata', async () => {
  const group = { id: 5, name: '함께', description: '', plans: [], is_public: true,
    member_count: 2, max_members: 10, my_role: null, show_in_profile: false };
  const result = await api.loadGroups(async p => {
    assert.equal(p, '/api/v1/todos/users/8/groups/');
    return response({ success: true, groups: [group] });
  }, 8);
  assert.deepEqual(result, [group]);
});
