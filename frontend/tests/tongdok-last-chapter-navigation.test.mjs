import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const biblePageSource = await readFile(
  new URL('../app/pages/bible/index.vue', import.meta.url),
  'utf8',
);

const loadAction = async () => {
  const source = await readFile(
    new URL('../app/utils/tongdokLastChapter.ts', import.meta.url),
    'utf8',
  );
  const { code } = await esbuild.transform(source, {
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
};

test('완료된 통독 일정의 마지막 장에서는 모달 없이 바로 다음 장으로 이동한다', () => {
  assert.match(
    biblePageSource,
    /const goToNextChapter = async \(\) => \{[\s\S]*?action === 'navigate'\) \{\s*disableTongdokMode\(\);[\s\S]*?goToNextChapterBase\(\);[\s\S]*?await loadBibleContent\(currentBook\.value, currentChapter\.value\);/,
    'completed schedules should navigate forward inside goToNextChapter instead of opening a modal',
  );
});

test('완료된 일정용 AlreadyComplete 모달은 더 이상 페이지에 연결되지 않는다', () => {
  assert.doesNotMatch(
    biblePageSource,
    /TongdokAlreadyCompleteModal|showAlreadyCompleteModal|handleAlreadyCompleteAction/,
    'the already-complete modal wiring should be removed from the page',
  );
});

test('미완료 일정의 마지막 장에서는 기존 다음 일정 모달 흐름을 유지한다', () => {
  assert.match(
    biblePageSource,
    /showNextScheduleModal\.value = true;/,
    'incomplete schedules should still offer the next-schedule modal',
  );
});

test('완료된 일정이면 저장된 액션과 무관하게 navigate를 선택한다', async () => {
  const { selectTongdokLastChapterAction } = await loadAction();

  assert.equal(
    selectTongdokLastChapterAction({
      isScheduleCompleted: true,
      savedNextScheduleAction: null,
    }),
    'navigate',
  );
  assert.equal(
    selectTongdokLastChapterAction({
      isScheduleCompleted: true,
      savedNextScheduleAction: 'go-next-schedule',
    }),
    'navigate',
  );
});

test('미완료 일정은 저장된 액션이 있으면 saved, 없으면 modal을 선택한다', async () => {
  const { selectTongdokLastChapterAction } = await loadAction();

  assert.equal(
    selectTongdokLastChapterAction({
      isScheduleCompleted: false,
      savedNextScheduleAction: 'go-next-schedule',
    }),
    'saved',
  );
  assert.equal(
    selectTongdokLastChapterAction({
      isScheduleCompleted: false,
      savedNextScheduleAction: null,
    }),
    'modal',
  );
});
