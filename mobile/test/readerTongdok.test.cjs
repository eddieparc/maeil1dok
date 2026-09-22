const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const m = new Module(file, module);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  m.require = name => name.startsWith('.')
    ? load(path.resolve(path.dirname(file), `${name}.ts`)) : require(name);
  m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, file);
  cache.set(file, m.exports);
  return m.exports;
}
const books = load(path.resolve(__dirname, '../api/bibleBooks.ts'));
// A missing new controller is exposed as the missing behavior, not a loader error.
const file = path.resolve(__dirname, '../api/readerTongdok.ts');
const api = fs.existsSync(file) ? load(file) : {};
const ok = json => ({ ok: true, status: 200, json: async () => json });
const deferred = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
};
const route = '/bible?book=gen&chapter=1&version=KNT&plan=4&schedule=101&date=2026-09-22&tongdok=true';
const rows = [
  { schedule_id: '101', book: 'gen', start_chapter: 1, end_chapter: 2, date: '2026-09-22', is_complete: false },
  { schedule_id: '102', book: 'exo', start_chapter: 3, end_chapter: 4, date: '2026-09-22', is_complete: false },
];
const detail = { book: 'gen', chapter: '1', plan_id: '4', plan_name: '플랜 4', plan_date: '2026-09-22', plan_detail: rows };
function controller(fetch) {
  assert.equal(typeof api.createReaderTongdok, 'function');
  return api.createReaderTongdok(fetch);
}
function enter(c, url = route) {
  c.enter(books.parseBibleReaderRoute(url));
}
test('explicit plan 4 and KNT survive a delayed default plan 3', () => {
  assert.equal(typeof books.parseBibleReaderRoute, 'function');
  const c = controller(async () => ok(detail));
  enter(c);
  c.setDefaultPlan(3);
  assert.equal(c.getState().context.planId, 4);
  assert.equal(books.parseBibleReaderRoute(route).version, 'KNT');
});
test('manual complete and cancel post every daily row and apply verified ack', async () => {
  const requests = [];
  const c = controller(async (url, init) => {
    if (!init) return ok(detail);
    const body = JSON.parse(init.body); requests.push(body);
    return ok({ success: true, plan_id: '4', schedule_ids: ['102', '101'], is_completed: body.action === 'complete' });
  });
  enter(c); await c.load();
  await c.toggle(true);
  assert.deepEqual(requests[0], { plan_id: 4, schedule_ids: [101, 102], action: 'complete' });
  assert.equal(c.getState().detail.rows.every(r => r.complete), true);
  await c.toggle(true);
  assert.equal(requests[1].action, 'cancel');
  assert.equal(c.getState().detail.rows.some(r => r.complete), false);
});
test('stale completion after changing plan cannot change the current reader', async () => {
  const pending = deferred();
  const c = controller(async (url, init) => init ? pending.promise : ok(detail));
  enter(c); await c.load();
  const write = c.toggle(true);
  enter(c, '/bible?book=jhn&chapter=3&plan=3&tongdok=true');
  pending.resolve(ok({ success: true, plan_id: 4, schedule_ids: [101, 102], is_completed: true }));
  await write;
  assert.equal(c.getState().context.planId, 3);
  assert.equal(c.getState().detail, null);
  assert.equal(c.getState().completedNotice, false);
});
test('guest and duplicate taps issue zero and one writes respectively', async () => {
  const pending = deferred(); let writes = 0;
  const c = controller(async (url, init) => {
    if (!init) return ok(detail);
    writes++; return pending.promise;
  });
  enter(c); await c.load();
  await c.toggle(false);
  assert.equal(writes, 0);
  assert.equal(c.getState().error, 'guest');
  const first = c.toggle(true);
  await c.toggle(true);
  assert.equal(writes, 1);
  pending.resolve(ok({ success: true, plan_id: 4, schedule_ids: [101, 102], is_completed: true }));
  await first;
});
for (const ack of [
  { success: true, plan_id: 3, schedule_ids: [101, 102], is_completed: true },
  { success: true, plan_id: 4, schedule_ids: [101], is_completed: true },
  { success: true, plan_id: 4, schedule_ids: [101, 101, 102], is_completed: true },
  { success: true, plan_id: 4, schedule_ids: [101, 102], is_completed: false },
]) test(`invalid ack stays incomplete and can retry: ${JSON.stringify(ack)}`, async () => {
  let valid = false;
  const c = controller(async (url, init) => !init ? ok(detail) : ok(valid
    ? { success: true, plan_id: 4, schedule_ids: [101, 102], is_completed: true } : ack));
  enter(c); await c.load(); await c.toggle(true);
  assert.equal(c.getState().completedNotice, false);
  assert.equal(c.getState().error, 'update');
  valid = true; await c.toggle(true);
  assert.equal(c.getState().completedNotice, true);
});
test('late detail is ignored after a different chapter is entered', async () => {
  const pending = deferred();
  const c = controller(() => pending.promise);
  enter(c); const loading = c.load();
  c.move({ book: 'jhn', chapter: 3 });
  pending.resolve(ok(detail)); await loading;
  assert.equal(c.getState().detail, null);
});
test('next-position resolves the exact schedule ID, not tomorrow or first month row', async () => {
  const paths = [];
  const c = controller(async url => {
    paths.push(url);
    if (url.includes('next-position')) return ok({ status: 'next_incomplete', schedule_id: 202, month: 11 });
    return ok([
      { id: 201, plan: 4, date: '2026-11-01', book: '창세기', start_chapter: 1, end_chapter: 2 },
      { id: 202, plan: 4, date: '2026-11-14', book: '요한복음', start_chapter: 3, end_chapter: 4 },
    ]);
  });
  enter(c); const target = await c.next();
  assert.deepEqual(target.location, { book: 'jhn', chapter: 3 });
  assert.equal(target.context.scheduleId, 202);
  assert.equal(target.context.date, '2026-11-14');
  assert.ok(paths[1].includes('month=11'));
});
test('all_completed never invents a next chapter', async () => {
  const c = controller(async () => ok({ status: 'all_completed' }));
  enter(c);
  assert.equal(await c.next(), null);
  assert.equal(c.getState().allCompleted, true);
});

test('late next-position/month response cannot navigate a new context', async () => {
  const pending = deferred();
  const c = controller(async url => url.includes('next-position')
    ? ok({ status: 'next_incomplete', schedule_id: 202, month: 11 }) : pending.promise);
  enter(c);
  const next = c.next();
  // The network promise itself is the synchronization boundary.
  enter(c, '/bible?book=jhn&chapter=3&plan=3&tongdok=true');
  pending.resolve(ok([{ id: 202, plan: 4, date: '2026-11-14', book: '요한복음', start_chapter: 3, end_chapter: 4 }]));
  assert.equal(await next, null);
});

test('HTTP failure leaves completion false and permits an explicit retry', async () => {
  let fail = true;
  const c = controller(async (url, init) => !init ? ok(detail) : fail
    ? { ok: false, status: 500, json: async () => ({}) }
    : ok({ success: true, plan_id: 4, schedule_ids: [101, 102], is_completed: true }));
  enter(c); await c.load(); await c.toggle(true);
  assert.equal(c.getState().error, 'update');
  assert.equal(c.getState().completedNotice, false);
  fail = false; await c.toggle(true);
  assert.equal(c.getState().completedNotice, true);
});

test('out-of-range detail and mismatched dates cannot authorize writes', async () => {
  for (const data of [{ ...detail, plan_detail: [] }, { ...detail, plan_date: '2026-09-23' },
    { ...detail, plan_detail: [rows[0], { ...rows[1], date: '2026-09-23' }] }]) {
    let writes = 0;
    const c = controller(async (url, init) => { if (init) writes++; return ok(data); });
    enter(c); await c.load(); await c.toggle(true);
    assert.equal(c.getState().detail, null);
    assert.equal(writes, 0);
  }
});

test('plain reading never acquires the home default plan', async () => {
  let requests = 0;
  const c = controller(async () => { requests++; return ok(detail); });
  enter(c, '/bible?book=gen&chapter=1&tongdok=false');
  c.setDefaultPlan(3); await c.load();
  assert.equal(requests, 0);
  assert.equal(c.getState().context.enabled, false);
});
