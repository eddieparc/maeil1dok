import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveHasenaDayState } from '../app/utils/hasenaDay.js';

test('uses the returned Hasena entry date when a Sunday request falls back to the latest video date', () => {
  const state = resolveHasenaDayState({
    success: true,
    is_completed: true,
    entry: {
      date: '2026-06-27',
      passage: '사무엘상 31:1-13',
      title: '2026년 6월 27일 토요일 하세나하시조',
      video_id: '_npuPXwLUbE',
      verses: [{ number: '1', text: '블레셋 사람이 이스라엘에 싸움을 걸어 왔다.' }],
    },
  }, '2026-06-28');

  assert.equal(state.entryDate, '2026-06-27');
  assert.equal(state.videoId, '_npuPXwLUbE');
  assert.equal(state.bibleTitle, '사무엘상 31:1-13');
  assert.equal(state.isCompleted, true);
  assert.deepEqual(state.verses, [{ number: '1', text: '블레셋 사람이 이스라엘에 싸움을 걸어 왔다.' }]);
});

test('throws the API error when no Hasena entry can be resolved', () => {
  assert.throws(
    () => resolveHasenaDayState({
      success: false,
      error: '해당 날짜의 하세나 본문을 찾을 수 없습니다.',
    }, '2026-06-28'),
    /해당 날짜의 하세나 본문을 찾을 수 없습니다\./,
  );
});
