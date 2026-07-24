// Regression guard for the KST off-by-one date bug.
//
// The app and the Django backend operate in Asia/Seoul (UTC+9). Several call
// sites derived "today" / a calendar day key via
// `new Date(...).toISOString().split('T')[0]`, which is UTC-based:
//   - `new Date(year, month, day)` is local midnight -> toISOString rolls back
//     to the PREVIOUS UTC day for any positive offset (always wrong in KST).
//   - `new Date()` between 00:00-09:00 KST also yields yesterday in UTC.
// `toLocalDateString` / `getTodayString` must use local calendar components so
// the string matches the server's KST date key.
//
// Force a deterministic timezone before any Date is constructed.
process.env.TZ = 'Asia/Seoul';

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const { transform } = esbuild;

const source = await readFile(
  new URL('../app/utils/dateFormat.ts', import.meta.url),
  'utf8',
);

const { code } = await transform(source, {
  format: 'esm',
  loader: 'ts',
  sourcemap: false,
});
const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const { toLocalDateString, getTodayString, formatDateForInput } = await import(
  `${dataUrl}#${Date.now()}-${Math.random()}`
);

test('sanity: TZ is pinned to Asia/Seoul (UTC+9)', () => {
  // If this fails the whole regression is meaningless, so assert it loudly.
  assert.equal(new Date('2026-07-14T15:30:00Z').getTimezoneOffset(), -540);
});

test('toLocalDateString keeps a local-midnight Date on the same calendar day', () => {
  // The exact pattern ReadingCalendar builds for each cell.
  const cell = new Date(2026, 6, 15); // local July 15, 00:00 KST
  // RED proof: the old UTC pattern silently rolls back a full day.
  assert.equal(cell.toISOString().split('T')[0], '2026-07-14');
  // GREEN: local-based helper stays on July 15.
  assert.equal(toLocalDateString(cell), '2026-07-15');
});

test('toLocalDateString resolves early-morning KST instants to the KST day', () => {
  // 2026-07-15 00:30 KST == 2026-07-14 15:30 UTC.
  const earlyMorning = new Date('2026-07-14T15:30:00Z');
  assert.equal(earlyMorning.toISOString().split('T')[0], '2026-07-14'); // UTC bug
  assert.equal(toLocalDateString(earlyMorning), '2026-07-15'); // fixed
});

test('toLocalDateString accepts ISO string input', () => {
  assert.equal(toLocalDateString('2026-07-14T15:30:00Z'), '2026-07-15');
});

test('toLocalDateString returns empty string for nullish/invalid input', () => {
  assert.equal(toLocalDateString(null), '');
  assert.equal(toLocalDateString(undefined), '');
  assert.equal(toLocalDateString(''), '');
  assert.equal(toLocalDateString('not-a-date'), '');
});

test('getTodayString matches local calendar components of now (never UTC)', () => {
  const now = new Date();
  const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  assert.equal(getTodayString(), expected);
  // And it is a well-formed YYYY-MM-DD key.
  assert.match(getTodayString(), /^\d{4}-\d{2}-\d{2}$/);
});

test('toLocalDateString stays consistent with formatDateForInput', () => {
  const d = new Date(2026, 0, 3);
  assert.equal(toLocalDateString(d), formatDateForInput(d));
  assert.equal(toLocalDateString(d), '2026-01-03');
});
