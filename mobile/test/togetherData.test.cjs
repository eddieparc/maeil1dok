const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(relative) {
  const filename = path.resolve(__dirname, '..', relative);
  const instance = new Module(filename, module);
  instance.filename = filename;
  instance.paths = Module._nodeModulePaths(path.dirname(filename));
  const original = instance.require.bind(instance);
  instance.require = (name) => name.startsWith('.')
    ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), `${name}.ts`)))
    : original(name);
  instance._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText, filename);
  return instance.exports;
}
const data = load('api/togetherData.ts');
const group = {
  id: 7, name: '함께 읽기', description: '매일 성경', creator: { id: 2, nickname: '리더', profile_image: null },
  plans: [{ id: 3, name: '일년일독', description: null, is_active: true, is_default: false }],
  is_public: true, max_members: 20, member_count: 3, is_full: false,
  is_member: false, my_role: null, show_in_profile: true,
  created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
};
const response = (json, status = 200) => ({
  ok: status >= 200 && status < 300, status, json: async () => json, text: async () => JSON.stringify(json),
});

test('creation transports beta JSON fields and parses acknowledgement; leave requires success', async () => {
  const payload = { name: '새 그룹', description: '', plan_ids: [3, 4], max_members: 20, is_public: false };
  const calls = [];
  const api = async (url, init) => { calls.push([url, init]); return response({ success: true, group }); };
  assert.equal((await data.createGroup(api, payload)).id, 7);
  assert.equal(calls[0][0], '/api/v1/todos/groups/create/');
  assert.equal(calls[0][1].headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(calls[0][1].body), payload);
  await data.leaveGroup(api, 7);
  assert.deepEqual(calls[1], ['/api/v1/todos/groups/7/leave/', { method: 'POST' }]);
  await assert.rejects(() => data.leaveGroup(async () => response({ success: false }), 7));
  await assert.rejects(() => data.createGroup(async () => response({ success: true }), payload));
});

test('creation plans use beta success envelope', async () => {
  const plans = await data.fetchCreationPlans(async (url) => {
    assert.equal(url, '/api/v1/todos/plans/');
    return response({ success: true, plans: [{ id: 3, name: '일독', description: null }] });
  });
  assert.equal(plans[0].id, 3);
  await assert.rejects(() => data.fetchCreationPlans(async () => response({ success: false })));
});

test('list uses real groups envelope, deduplicates IDs, preserves nullable fields', async () => {
  const groups = await data.fetchGroups(async () => response({ success: true, groups: [group, group] }), { search: '', filter: 'all' });
  assert.equal(groups.length, 1);
  assert.equal(groups[0].id, 7);
  assert.equal(groups[0].creator.profile_image, null);
  assert.equal(groups[0].is_member, false);
});
test('search and exclusive filters reach the server as exact query parameters', async () => {
  const paths = [];
  const api = async (url) => { paths.push(url); return response({ success: true, groups: [] }); };
  for (const filter of ['all', 'public', 'mine']) await data.fetchGroups(api, { search: '믿음 & 소망', filter });
  assert.equal(paths.length, 3);
  for (const [i, url] of paths.entries()) {
    const parsed = new URL(url, 'https://example.test');
    assert.equal(parsed.pathname, '/api/v1/todos/groups/');
    assert.equal(parsed.searchParams.get('search'), '믿음 & 소망');
    assert.equal(parsed.searchParams.get('only_public'), i === 1 ? 'true' : null);
    assert.equal(parsed.searchParams.get('only_mine'), i === 2 ? 'true' : null);
  }
});
test('HTTP and semantic failures are not empty success', async () => {
  for (const [payload, status] of [[{ success: false, error: '거절' }, 200], [{ error: '요청 제한' }, 429], [{ success: true }, 200]]) {
    await assert.rejects(() => data.fetchGroups(async () => response(payload, status), { search: '', filter: 'all' }));
  }
});

test('detail identity and join acknowledgement are checked at the API boundary', async () => {
  assert.equal((await data.fetchGroup(async () => response({ success: true, group }), 7)).id, 7);
  await assert.rejects(() => data.fetchGroup(async () => response({ success: true, group }), 8));
  const calls = [];
  await data.joinGroup(async (url, init) => { calls.push([url, init]); return response({ success: true, message: '가입 완료' }, 201); }, 7);
  assert.deepEqual(calls, [['/api/v1/todos/groups/7/join/', { method: 'POST' }]]);
  await assert.rejects(() => data.joinGroup(async () => response({ success: false }), 7));
});
test('members retain actual roles, profiles, and pagination disclosure', async () => {
  const result = await data.fetchMembers(async () => response({
    success: true, members: [{ user: group.creator, role: '관리자', joined_at: group.created_at }],
    meta: { total_members: 101, returned_members: 1, limit: 100, offset: 0, has_more: true },
  }), 7);
  assert.equal(result.members[0].role, '관리자');
  assert.equal(result.members[0].user.profile_image, null);
  assert.equal(result.total, 101);
  assert.equal(result.hasMore, true);
});
test('schedule consumes the bare array and does not invent guest completion', async () => {
  const result = await data.fetchGroupSchedules(async (url) => {
    assert.equal(url, '/api/v1/todos/schedules/month/?plan_id=3&year=2026&month=9');
    return response([{ id: 12, plan: 3, plan_name: '일독', date: '2026-09-22', book: 'gen', start_chapter: 1, end_chapter: 3 }]);
  }, { planId: 3, year: 2026, month: 9 });
  assert.equal(result[0].is_completed, null);
  assert.equal(result[0].end_chapter, 3);
  await assert.rejects(() => data.fetchGroupSchedules(async () => response({ schedules: [] }), { planId: 3, year: 2026, month: 9 }));
});
test('stats and progress consume independent real response envelopes', async () => {
  const calls = [];
  const stats = await data.fetchStats(async (url) => {
    calls.push(url);
    return response({ success: true, leaderboard: [{ user: { id: 2, nickname: '리더', profile_image: null }, progress_rate: 47.5, current_streak: 6,
      completed_days: 20, bible_completed_days: 20, hasena_completed_days: 0, activity_score: 20, longest_streak: 6, current_hasena_streak: 0, longest_hasena_streak: 0, rank: 1 }] });
  }, { groupId: 7, planId: 3 });
  const calendar = await data.fetchProgress(async (url) => {
    calls.push(url);
    return response({ success: true, plan: { id: 3, name: '일독' }, meta: { year: 2026, month: 9 }, calendar: {
      '2026-09-22': { schedule: { book: 'gen', start_chapter: 1, end_chapter: 3 }, total_members: 1, completed_count: 1, members: [{ id: 2, nickname: '리더', profile_image: null, is_completed: true }] },
    } });
  }, { groupId: 7, planId: 3, year: 2026, month: 9 });
  assert.equal(stats[0].progress_rate, 47.5);
  assert.equal(calendar['2026-09-22'].members[0].is_completed, true);
  assert.deepEqual(calls, ['/api/v1/todos/scoreboard/group/7/?period=all&plan_id=3', '/api/v1/todos/groups/7/member-progress/?plan_id=3&year=2026&month=9']);
});
test('week crosses months and unknown metrics stay unknown, not zero', () => {
  const activity = load('components/together/activity.ts');
  assert.deepEqual(activity.weekDates(new Date(2026, 9, 1)).map(activity.dateKey), [
    '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04',
  ]);
  assert.equal(activity.averageProgress([]), null);
  assert.equal(activity.averageProgress([{ progress_rate: 10 }, { progress_rate: 35 }]), 23);
  const calendar = { '2026-09-21': { members: [{ id: 2, is_completed: true }, { id: 3, is_completed: false }] } };
  assert.equal(activity.weekState(calendar, 2, { day: '2026-09-21', today: '2026-09-22' }), 'completed');
  assert.equal(activity.weekState(calendar, 3, { day: '2026-09-21', today: '2026-09-22' }), 'pending');
  assert.equal(activity.weekState(calendar, 4, { day: '2026-09-21', today: '2026-09-22' }), 'unavailable');
  assert.equal(activity.weekState(calendar, 4, { day: '2026-09-23', today: '2026-09-22' }), 'upcoming');
});
test('real apiFetch transports bearer auth, creation JSON, join and leave to a local HTTP server', { timeout: 5000 }, async (t) => {
  const http = require('node:http');
  const { once } = require('node:events');
  const seen = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    seen.push({ url: req.url, method: req.method, authorization: req.headers.authorization, body, contentType: req.headers['content-type'] });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(req.url.endsWith('/create/') ? { success: true, group }
      : req.method === 'POST' ? { success: true, message: '가입' } : { success: true, groups: [group] }));
  });
  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await listening;
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const api = load('api/nativeApi.ts').createApiFetch({
    baseUrl: `http://127.0.0.1:${server.address().port}`, getAccessToken: () => 'fixture-token',
    fetchImpl: fetch, refresh: async () => null,
  });
  assert.equal((await data.fetchGroups(api, { search: '', filter: 'public' }))[0].id, 7);
  await data.joinGroup(api, 7);
  assert.deepEqual(seen.map(({ method, authorization }) => [method, authorization]), [['GET', 'Bearer fixture-token'], ['POST', 'Bearer fixture-token']]);
  assert.equal(seen[1].url, '/api/v1/todos/groups/7/join/');
  const payload = { name: '그룹', description: '', plan_ids: [3], max_members: 20, is_public: true };
  assert.equal((await data.createGroup(api, payload)).id, 7);
  await data.leaveGroup(api, 7);
  assert.deepEqual(seen.slice(2).map(({ url, method, authorization }) => [url, method, authorization]), [
    ['/api/v1/todos/groups/create/', 'POST', 'Bearer fixture-token'],
    ['/api/v1/todos/groups/7/leave/', 'POST', 'Bearer fixture-token'],
  ]);
  assert.equal(seen[2].contentType, 'application/json');
  assert.deepEqual(JSON.parse(seen[2].body), payload);
  assert.equal(seen[3].body, '');
});
