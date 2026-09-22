const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

// scheduleData.ts imports ./bibleBooks — register a .ts loader so the
// transpiled CommonJS require() can resolve it (same as homeData.test.cjs).
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

function loadTsModule(fileName) {
  const filePath = path.join(__dirname, '..', fileName);
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filePath,
  });

  const moduleInstance = new Module(filePath, module);
  moduleInstance.filename = filePath;
  moduleInstance.paths = Module._nodeModulePaths(path.dirname(filePath));
  moduleInstance._compile(transpiled.outputText, filePath);
  return moduleInstance.exports;
}

const {
  normalizeMonthSchedules,
  normalizeSubscriptions,
  normalizeNextPosition,
  groupByDate,
  buildMonthGrid,
  pickDefaultPlan,
  summarizeDay,
  shiftMonth,
  formatScheduleDate,
  scheduleTitle,
  readingStatus,
  monthSummary,
  sortSchedules,
} = loadTsModule('api/scheduleData.ts');

const entry = (overrides = {}) => ({
  id: 1,
  plan: 7,
  plan_name: '1년 1독',
  date: '2026-09-19',
  book: 'gen',
  start_chapter: 1,
  end_chapter: 3,
  audio_link: null,
  guide_link: null,
  is_completed: false,
  ...overrides,
});

// --- normalizeMonthSchedules ----------------------------------------------

test('normalizeMonthSchedules accepts a bare array (current backend shape)', () => {
  const list = [entry({ id: 1 }), entry({ id: 2, date: '2026-09-20' })];
  const out = normalizeMonthSchedules(list);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 1);
  assert.equal(out[1].date, '2026-09-20');
});

test('normalizeMonthSchedules unwraps {schedules:[...]} and {results:[...]} envelopes', () => {
  const inner = [entry({ id: 5 })];
  assert.deepEqual(
    normalizeMonthSchedules({ schedules: inner }).map((s) => s.id),
    [5],
  );
  assert.deepEqual(
    normalizeMonthSchedules({ results: inner }).map((s) => s.id),
    [5],
  );
});

test('normalizeMonthSchedules returns [] for garbage input', () => {
  for (const bad of [null, undefined, {}, { schedules: 'nope' }, 'x', 42, { data: [] }]) {
    assert.deepEqual(normalizeMonthSchedules(bad), [], `must be []: ${JSON.stringify(bad)}`);
  }
});

test('normalizeMonthSchedules defaults missing is_completed to false', () => {
  const raw = entry({ id: 3 });
  delete raw.is_completed;
  const [out] = normalizeMonthSchedules([raw]);
  assert.equal(out.is_completed, false);
});

test('normalizeMonthSchedules coerces numeric strings and drops malformed rows', () => {
  const out = normalizeMonthSchedules([
    entry({ id: '9', start_chapter: '2', end_chapter: '4' }),
    { id: null, date: '2026-09-19', book: 'gen' },          // no usable id
    { id: 4, date: '', book: 'gen' },                       // no date
    'not-an-object',
    entry({ id: 10 }),
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 9);
  assert.equal(out[0].start_chapter, 2);
  assert.equal(out[0].end_chapter, 4);
  assert.equal(out[1].id, 10);
});

// --- groupByDate ------------------------------------------------------------

test('groupByDate buckets schedules by date preserving order', () => {
  const grouped = groupByDate([
    entry({ id: 1, date: '2026-09-19' }),
    entry({ id: 2, date: '2026-09-20' }),
    entry({ id: 3, date: '2026-09-19' }),
  ]);
  assert.deepEqual(Object.keys(grouped).sort(), ['2026-09-19', '2026-09-20']);
  assert.deepEqual(grouped['2026-09-19'].map((s) => s.id), [1, 3]);
  assert.deepEqual(grouped['2026-09-20'].map((s) => s.id), [2]);
});

test('groupByDate of empty list is empty object', () => {
  assert.deepEqual(groupByDate([]), {});
});

// --- summarizeDay -----------------------------------------------------------

test('summarizeDay counts total and completed', () => {
  assert.deepEqual(
    summarizeDay([
      entry({ id: 1, is_completed: true }),
      entry({ id: 2, is_completed: false }),
      entry({ id: 3, is_completed: true }),
    ]),
    { total: 3, completed: 2 },
  );
  assert.deepEqual(summarizeDay([]), { total: 0, completed: 0 });
});

// --- buildMonthGrid ---------------------------------------------------------

test('buildMonthGrid: Feb 2026 starts Sunday and ends Saturday -> exactly 4 clean weeks', () => {
  // 2026-02-01 is a Sunday; 28 days fills exactly 4 weeks with no spillover.
  const weeks = buildMonthGrid(2026, 2, {});
  assert.equal(weeks.length, 4);
  for (const week of weeks) {
    assert.equal(week.length, 7);
    for (const cell of week) {
      assert.equal(cell.inCurrentMonth, true, `${cell.date} should be in month`);
    }
  }
  assert.equal(weeks[0][0].date, '2026-02-01');
  assert.equal(weeks[3][6].date, '2026-02-28');
});

test('buildMonthGrid: Aug 2026 starts Saturday -> 6 leading cells from July', () => {
  // 2026-08-01 is a Saturday, so the first week is almost all July.
  const weeks = buildMonthGrid(2026, 8, {});
  assert.equal(weeks[0][0].date, '2026-07-26');
  assert.equal(weeks[0][0].inCurrentMonth, false);
  assert.equal(weeks[0][6].date, '2026-08-01');
  assert.equal(weeks[0][6].inCurrentMonth, true);
  // August has 31 days; last day 2026-08-31 is a Monday -> trailing Sept cells.
  const last = weeks[weeks.length - 1];
  assert.equal(last[6].inCurrentMonth, false);
  assert.equal(last[6].date, '2026-09-05');
});

test('buildMonthGrid: leap February 2024 has 29 in-month days', () => {
  const weeks = buildMonthGrid(2024, 2, {});
  const inMonth = weeks.flat().filter((c) => c.inCurrentMonth);
  assert.equal(inMonth.length, 29);
  assert.equal(inMonth[28].date, '2024-02-29');
});

test('buildMonthGrid attaches schedule counts from byDate', () => {
  const byDate = groupByDate([
    entry({ id: 1, date: '2026-09-19', is_completed: true }),
    entry({ id: 2, date: '2026-09-19', is_completed: false }),
  ]);
  const weeks = buildMonthGrid(2026, 9, byDate);
  const cell = weeks.flat().find((c) => c.date === '2026-09-19');
  assert.equal(cell.total, 2);
  assert.equal(cell.completed, 1);
  const empty = weeks.flat().find((c) => c.date === '2026-09-20');
  assert.equal(empty.total, 0);
  assert.equal(empty.completed, 0);
});

test('buildMonthGrid day numbers match the date tail', () => {
  const weeks = buildMonthGrid(2026, 9, {});
  for (const cell of weeks.flat()) {
    assert.equal(cell.day, Number(cell.date.slice(-2)), cell.date);
  }
});

// --- pickDefaultPlan --------------------------------------------------------

const sub = (overrides = {}) => ({
  id: 1,
  plan_id: 7,
  plan_name: '1년 1독',
  is_default: false,
  is_active: true,
  start_date: '2026-01-01',
  ...overrides,
});

test('pickDefaultPlan prefers the active default subscription', () => {
  const picked = pickDefaultPlan([
    sub({ id: 1, plan_id: 7 }),
    sub({ id: 2, plan_id: 8, is_default: true }),
  ]);
  assert.equal(picked.plan_id, 8);
});

test('pickDefaultPlan falls back to the first active subscription', () => {
  const picked = pickDefaultPlan([
    sub({ id: 1, plan_id: 7, is_active: false }),
    sub({ id: 2, plan_id: 8 }),
  ]);
  assert.equal(picked.plan_id, 8);
});

test('pickDefaultPlan ignores inactive defaults and returns null when nothing is active', () => {
  assert.equal(
    pickDefaultPlan([sub({ id: 1, is_default: true, is_active: false })]),
    null,
  );
  assert.equal(pickDefaultPlan([]), null);
});

// --- shiftMonth -------------------------------------------------------------

test('shiftMonth crosses year boundaries both ways', () => {
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
  assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
  assert.deepEqual(shiftMonth(2026, 9, 1), { year: 2026, month: 10 });
  assert.deepEqual(shiftMonth(2026, 9, -1), { year: 2026, month: 8 });
});

// --- normalizeSubscriptions (GET /api/v1/todos/plan/) ----------------------

test('normalizeSubscriptions maps the signed-in subscription shape', () => {
  const out = normalizeSubscriptions([
    { id: 11, plan_id: 7, plan_name: '2026 성경통독', is_active: true, is_default: true, start_date: '2026-01-01' },
    { id: 12, plan_id: 8, plan_name: '열왕기', is_active: false, is_default: false, start_date: '2026-02-01' },
  ]);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], {
    id: 11, plan_id: 7, plan_name: '2026 성경통독',
    is_active: true, is_default: true, start_date: '2026-01-01',
  });
  assert.equal(out[1].is_active, false);
});

test('normalizeSubscriptions maps the guest public-plan shape (no id/is_active)', () => {
  const out = normalizeSubscriptions([
    { plan_id: 7, plan_name: '2026 성경통독', is_default: true },
    { plan_id: 8, plan_name: '다른 플랜', is_default: false },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, 7);
  assert.equal(out[0].is_active, true);
  assert.equal(out[0].is_default, true);
  assert.equal(out[1].plan_id, 8);
});

test('normalizeSubscriptions drops rows without a usable plan_id and non-arrays', () => {
  assert.deepEqual(normalizeSubscriptions(null), []);
  assert.deepEqual(normalizeSubscriptions({ subscriptions: [] }), []);
  const out = normalizeSubscriptions([
    { plan_name: 'no id' },
    { plan_id: 'x' },
    { plan_id: 9, plan_name: 'ok' },
    'garbage',
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].plan_id, 9);
});

// --- normalizeNextPosition (GET /api/v1/todos/next-position/) ---------------

test('normalizeNextPosition accepts known statuses with a date', () => {
  for (const status of ['next_incomplete', 'all_completed', 'today', 'nearest', 'no_schedule']) {
    const out = normalizeNextPosition({ success: true, status, date: '2026-09-20', message: 'm' });
    assert.equal(out.status, status);
    assert.equal(out.date, '2026-09-20');
    assert.equal(out.message, 'm');
  }
});

test('normalizeNextPosition returns null for unknown status or non-object', () => {
  assert.equal(normalizeNextPosition({ status: 'weird' }), null);
  assert.equal(normalizeNextPosition(null), null);
  assert.equal(normalizeNextPosition('x'), null);
});

test('normalizeNextPosition tolerates missing date/message', () => {
  const out = normalizeNextPosition({ success: false, status: 'no_schedule' });
  assert.equal(out.status, 'no_schedule');
  assert.equal(out.date, null);
  assert.equal(out.message, null);
});

// --- formatScheduleDate -----------------------------------------------------

test('formatScheduleDate renders M/D(요일)', () => {
  // 2026-09-01 is a Tuesday.
  assert.equal(formatScheduleDate('2026-09-01'), '9/1(화)');
  // 2026-09-06 is a Sunday.
  assert.equal(formatScheduleDate('2026-09-06'), '9/6(일)');
  assert.equal(formatScheduleDate('bad'), 'bad');
});

// --- scheduleTitle ----------------------------------------------------------

test('scheduleTitle uses 편 for 시편 and 장 otherwise, en-dash ranges', () => {
  assert.equal(scheduleTitle({ book: '시편', start_chapter: 7, end_chapter: 12 }), '시편 7–12편');
  assert.equal(scheduleTitle({ book: '시편', start_chapter: 23, end_chapter: 23 }), '시편 23편');
  assert.equal(scheduleTitle({ book: '창세기', start_chapter: 1, end_chapter: 3 }), '창세기 1–3장');
  assert.equal(scheduleTitle({ book: '창세기', start_chapter: 1, end_chapter: 1 }), '창세기 1장');
  // 코드 형태로 들어와도 동일하게 동작해야 한다.
  assert.equal(scheduleTitle({ book: 'psa', start_chapter: 7, end_chapter: 12 }), '시편 7–12편');
  assert.equal(scheduleTitle({ book: 'gen', start_chapter: 1, end_chapter: 3 }), '창세기 1–3장');
});

// --- readingStatus ----------------------------------------------------------

test('readingStatus: completed wins; else today=current, past=not_completed, future=upcoming', () => {
  const today = '2026-09-20';
  assert.equal(readingStatus('2026-09-19', true, today), 'completed');
  assert.equal(readingStatus('2026-09-20', true, today), 'completed');
  assert.equal(readingStatus('2026-09-20', false, today), 'current');
  assert.equal(readingStatus('2026-09-19', false, today), 'not_completed');
  assert.equal(readingStatus('2026-09-21', false, today), 'upcoming');
});

// --- monthSummary -----------------------------------------------------------

test('monthSummary counts fully-completed days and percent', () => {
  const grouped = groupByDate([
    entry({ id: 1, date: '2026-09-01', is_completed: true }),
    entry({ id: 2, date: '2026-09-02', is_completed: true }),
    entry({ id: 3, date: '2026-09-02', is_completed: false }), // day not fully done
    entry({ id: 4, date: '2026-09-03', is_completed: false }),
  ]);
  assert.deepEqual(monthSummary(grouped), { totalDays: 3, completedDays: 1, percent: 33 });
  assert.deepEqual(monthSummary({}), { totalDays: 0, completedDays: 0, percent: 0 });
});

// --- sortSchedules ----------------------------------------------------------

test('sortSchedules orders by date then canonical book order then id', () => {
  const out = sortSchedules([
    entry({ id: 3, date: '2026-09-02', book: '시편' }),
    entry({ id: 1, date: '2026-09-01', book: '창세기' }),
    entry({ id: 2, date: '2026-09-01', book: '출애굽기' }),
    entry({ id: 4, date: '2026-09-01', book: '창세기' }),
  ]);
  assert.deepEqual(out.map((s) => s.id), [4, 1, 2, 3]);
});
