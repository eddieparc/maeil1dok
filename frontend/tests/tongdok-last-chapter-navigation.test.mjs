import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const biblePageSource = await readFile(
  new URL('../app/pages/bible/index.vue', import.meta.url),
  'utf8',
);

test('완료된 통독 일정의 마지막 장에서는 완료 확인 없이 바로 다음 장으로 이동한다', () => {
  assert.match(
    biblePageSource,
    /const goToNextChapter = async \(\) => \{[\s\S]*?if \(isTongdokMode\.value && isAtLastTongdokChapter\.value && !isScheduleCompleted\(\)\)/,
    'the completion confirm should be skipped when the schedule is already complete',
  );
});

test('미완료 일정의 마지막 장에서는 기존 완료 확인 흐름을 유지한다', () => {
  assert.match(
    biblePageSource,
    /if \(isTongdokMode\.value && isAtLastTongdokChapter\.value && !isScheduleCompleted\(\)\) \{[\s\S]*?modal\.confirm\(\{[\s\S]*?handleTongdokComplete\(\);/,
    'incomplete schedules should still confirm before completing',
  );
});
