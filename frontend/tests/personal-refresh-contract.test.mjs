import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { rawHexes, styleOf } from './helpers/design-contract.mjs';

// PR4 개인 — 알림/설정/읽기설정/내 기록 디자인 계약 (핸드오프 README "10~14").
const notifications = await readFile(new URL('../app/pages/notifications/index.vue', import.meta.url), 'utf8');
const settings = await readFile(new URL('../app/pages/account/settings.vue', import.meta.url), 'utf8');
const readingSettings = await readFile(new URL('../app/pages/bible/settings.vue', import.meta.url), 'utf8');
const records = await Promise.all([
  ['notes', '../app/pages/bible/notes/index.vue'],
  ['highlights', '../app/pages/bible/highlights/index.vue'],
  ['bookmarks', '../app/pages/bible/bookmarks.vue'],
].map(async ([name, path]) => [name, await readFile(new URL(path, import.meta.url), 'utf8')]));

test('알림은 날짜 그룹과 미읽음 도트를 그린다', () => {
  assert.match(notifications, /오늘|어제/, '날짜 그룹 라벨');
  assert.match(styleOf(notifications), /(unread|미읽음|is-unread)[^{]*\{[\s\S]*?(background|color):\s*var\(--color-accent/, '미읽음 accent');
  assert.match(notifications, /모두 읽음/, '모두 읽음 액션');
});

test('설정은 알림 스위치와 테마 세그먼트를 통합한다', () => {
  assert.match(settings, /SegmentedControl/, '테마 세그먼트');
  for (const label of ['라이트', '다크', '시스템']) {
    assert.match(settings, new RegExp(label), `테마 ${label}`);
  }
  assert.match(settings, /오늘 본문 알림|하세나하시조 알림|친구 활동/, '알림 설정 통합');
  assert.match(styleOf(settings), /switch[^{]*\{[\s\S]*?width:\s*40px/, 'Switch 40x24');
});

test('읽기 설정은 바텀시트로 열린다', () => {
  assert.match(readingSettings, /BottomSheet/, 'ui/BottomSheet 사용');
  assert.match(readingSettings, /Pretendard/, '글꼴 칩');
  assert.match(readingSettings, /인명|지명/, '인명·지명 강조 스위치');
});

test('내 기록 3화면은 동일한 3분할 세그먼트를 공유한다', () => {
  for (const [name, source] of records) {
    assert.match(source, /SegmentedControl/, `${name} 세그먼트`);
    for (const label of ['묵상노트', '하이라이트', '북마크']) {
      assert.match(source, new RegExp(label), `${name} 세그먼트 라벨 ${label}`);
    }
  }
});

test('하이라이트 화면은 4색 스와치 토큰을 쓴다', () => {
  const highlights = records.find(([n]) => n === 'highlights')[1];
  for (const token of ['yellow', 'green', 'blue', 'pink']) {
    assert.match(highlights, new RegExp(`--color-highlight-${token}`), `스와치 ${token}`);
  }
});

test('개인 화면에 원시 hex 가 없다', () => {
  for (const [name, source] of [['notifications', notifications], ['settings', settings], ['bible/settings', readingSettings], ...records]) {
    assert.deepEqual(rawHexes(source), [], `${name} 원시 hex`);
  }
});
