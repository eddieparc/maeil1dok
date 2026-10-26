const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// homeData.ts imports ./bibleBooks — register a .ts loader so the transpiled
// CommonJS require() can resolve it (same pattern as nativeApi.test.cjs).
require.extensions['.ts'] = (moduleInstance, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  moduleInstance._compile(transpiled.outputText, filename);
};

function loadModule(name) {
  const filePath = path.join(__dirname, '..', name);
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filePath,
  });
  const instance = new Module(filePath, module);
  instance.filename = filePath;
  instance.paths = Module._nodeModulePaths(path.dirname(filePath));
  instance._compile(transpiled.outputText, filePath);
  return instance.exports;
}

const {
  normalizeSchedule,
  pickEffectivePlanId,
  summarizeToday,
  parseHomeStats,
  readHomeResponse,
  recentCompleted,
  buildWeek,
} = loadModule('api/homeData.ts');

// --- normalizeSchedule -----------------------------------------------------

test('normalizeSchedule maps `book` payloads onto book_code', () => {
  const normalized = normalizeSchedule({
    id: 11,
    plan: 3,
    plan_name: '1년 1독',
    date: '2026-09-19',
    book: 'gen',
    start_chapter: 1,
    end_chapter: 3,
    audio_link: 'https://example.com/a',
    guide_link: null,
    is_completed: false,
  });

  assert.equal(normalized.book_code, 'gen');
  assert.equal(normalized.start_chapter, 1);
  assert.equal(normalized.end_chapter, 3);
  assert.equal(normalized.is_completed, false);
});

test('normalizeSchedule keeps `book_code` payloads as-is', () => {
  const normalized = normalizeSchedule({
    id: 12,
    plan: 3,
    plan_name: '1년 1독',
    date: '2026-09-19',
    book_code: 'psa',
    start_chapter: 23,
    end_chapter: 23,
    is_completed: true,
  });

  assert.equal(normalized.book_code, 'psa');
  assert.equal(normalized.is_completed, true);
});

test('normalizeSchedule prefers book_code when both keys exist', () => {
  const normalized = normalizeSchedule({
    id: 13,
    book: 'gen',
    book_code: 'exo',
    start_chapter: 1,
    end_chapter: 1,
    is_completed: false,
  });
  assert.equal(normalized.book_code, 'exo');
});

test('normalizeSchedule returns null for malformed rows', () => {
  assert.equal(normalizeSchedule(null), null);
  assert.equal(normalizeSchedule(undefined), null);
  assert.equal(normalizeSchedule('gen 1'), null);
  assert.equal(normalizeSchedule({ id: 1 }), null);
  assert.equal(
    normalizeSchedule({ id: 1, book_code: 'gen', start_chapter: 'x', end_chapter: 2 }),
    null,
  );
});

// --- pickEffectivePlanId ---------------------------------------------------

test('pickEffectivePlanId prefers the default subscription', () => {
  const planId = pickEffectivePlanId([
    { id: 1, plan_id: 10, is_default: false, is_active: true },
    { id: 2, plan_id: 20, is_default: true, is_active: true },
  ]);
  assert.equal(planId, 20);
});

test('pickEffectivePlanId falls back to the first active subscription', () => {
  const planId = pickEffectivePlanId([
    { id: 1, plan_id: 10, is_default: false, is_active: false },
    { id: 2, plan_id: 20, is_default: false, is_active: true },
  ]);
  assert.equal(planId, 20);
});

test('pickEffectivePlanId returns null with no usable subscription', () => {
  assert.equal(pickEffectivePlanId([]), null);
  assert.equal(pickEffectivePlanId(null), null);
  assert.equal(pickEffectivePlanId(undefined), null);
  assert.equal(
    pickEffectivePlanId([{ id: 1, plan_id: 10, is_default: false, is_active: false }]),
    null,
  );
});

test('inactive default never overrides an active plan', () => {
  assert.equal(pickEffectivePlanId([
    { id: 1, plan_id: 3, is_default: true, is_active: false },
    { id: 2, plan_id: 4, is_default: false, is_active: true },
  ]), 4);
});

// --- summarizeToday --------------------------------------------------------

test('summarizeToday handles an empty schedule list', () => {
  const summary = summarizeToday([]);
  assert.equal(summary.total, 0);
  assert.equal(summary.completed, 0);
  assert.equal(summary.allComplete, false);
  assert.deepEqual(summary.items, []);
});

test('summarizeToday counts completions and builds range labels', () => {
  const summary = summarizeToday([
    { id: 1, book_code: 'gen', start_chapter: 1, end_chapter: 3, is_completed: true },
    { id: 2, book_code: 'psa', start_chapter: 23, end_chapter: 23, is_completed: false },
  ]);

  assert.equal(summary.total, 2);
  assert.equal(summary.completed, 1);
  assert.equal(summary.allComplete, false);
  assert.equal(summary.items[0].label, '창세기 1-3장');
  assert.equal(summary.items[0].is_completed, true);
  assert.equal(summary.items[1].label, '시편 23편');
});

test('summarizeToday flags allComplete when every row is done', () => {
  const summary = summarizeToday([
    { id: 1, book_code: 'gen', start_chapter: 1, end_chapter: 1, is_completed: true },
    { id: 2, book_code: 'exo', start_chapter: 1, end_chapter: 2, is_completed: true },
  ]);
  assert.equal(summary.allComplete, true);
  assert.equal(summary.completed, 2);
});

test('summarizeToday skips malformed rows instead of throwing', () => {
  const summary = summarizeToday([
    { id: 1, book_code: 'gen', start_chapter: 1, end_chapter: 1, is_completed: false },
    null,
    { id: 2 },
  ]);
  assert.equal(summary.total, 1);
  assert.equal(summary.items.length, 1);
});

// --- parseHomeStats --------------------------------------------------------

test('parseHomeStats reads counts and recent records', () => {
  const stats = parseHomeStats({
    bookmarks: 4,
    notes: 2,
    highlights: 7,
    recent_records: [
      { book: 'jhn', chapter: 3, read_date: '2026-09-18' },
      { book: 'psa', chapter: 1, read_date: '2026-09-17' },
    ],
  });

  assert.equal(stats.bookmarks, 4);
  assert.equal(stats.notes, 2);
  assert.equal(stats.highlights, 7);
  assert.equal(stats.recentRecords.length, 2);
  assert.deepEqual(stats.recentRecords[0], {
    book: 'jhn',
    chapter: 3,
    read_date: '2026-09-18',
  });
});

test('parseHomeStats survives malformed or missing payloads', () => {
  assert.deepEqual(parseHomeStats(null), {
    bookmarks: 0,
    notes: 0,
    highlights: 0,
    recentRecords: [],
  });
  assert.deepEqual(parseHomeStats(undefined), {
    bookmarks: 0,
    notes: 0,
    highlights: 0,
    recentRecords: [],
  });
  assert.deepEqual(parseHomeStats('oops'), {
    bookmarks: 0,
    notes: 0,
    highlights: 0,
    recentRecords: [],
  });
});

test('parseHomeStats drops malformed recent records and non-numeric counts', () => {
  const stats = parseHomeStats({
    bookmarks: 'many',
    notes: 1,
    recent_records: [
      { book: 'gen', chapter: 1, read_date: '2026-09-19' },
      { chapter: 2 },
      'nope',
      { book: 'exo', chapter: 'x', read_date: '2026-09-19' },
    ],
  });

  assert.equal(stats.bookmarks, 0);
  assert.equal(stats.notes, 1);
  assert.equal(stats.highlights, 0);
  assert.equal(stats.recentRecords.length, 1);
  assert.equal(stats.recentRecords[0].book, 'gen');
});

test('Home preserves API error detail for HTTP and application failures', async () => {
  for (const [ok, status, json] of [
    [false, 404, { error: 'PLAN_NOT_FOUND' }],
    [true, 200, { success: false, detail: 'PLAN_NOT_FOUND' }],
  ]) {
    await assert.rejects(
      readHomeResponse({ ok, status, json: async () => json }),
      { message: 'PLAN_NOT_FOUND' },
    );
  }
});

test('recent records exclude future and unfinished dates then order schedule ties', () => {
  const entries = [
    { date: '2026-09-24', schedule_id: 10, is_completed: true },
    { date: '2026-09-24', schedule_id: 12, is_completed: true },
    { date: '2026-09-25', schedule_id: 13, is_completed: true },
    { date: '2026-09-23', schedule_id: 9, is_completed: false },
    { date: '2026-09-22', schedule_id: 8, is_completed: true },
    { date: '2026-09-21', schedule_id: 7, is_completed: true },
  ];
  const recent = recentCompleted(entries, '2026-09-24');
  assert.deepEqual(recent.map(e => e.schedule_id), [12, 10, 8]);
  assert.equal(entries[0].schedule_id, 10);
});

test('week crosses month boundary and requires all assignments complete for a read day', () => {
  const week = buildWeek('2026-10-01', [
    { date: '2026-09-28', is_completed: true },
    { date: '2026-09-28', is_completed: false },
    { date: '2026-09-29', is_completed: true },
  ]);
  assert.deepEqual(week.map(d => d.date), [
    '2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01',
    '2026-10-02', '2026-10-03', '2026-10-04',
  ]);
  assert.deepEqual(week.map(d => d.state), [
    'missed', 'read', 'missed', 'today', 'upcoming', 'upcoming', 'upcoming',
  ]);
});
