import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { collectDir, rawHexes, styleOf } from './helpers/design-contract.mjs';

// PR2 코어 — 홈 화면 디자인 계약 (핸드오프 README "1. 홈").
const page = await readFile(new URL('../app/pages/index.vue', import.meta.url), 'utf8');
const components = await collectDir(new URL('../app/components/home-v2/', import.meta.url));
const all = [['index.vue', page], ...components];
const combined = all.map(([, s]) => s).join('\n');

test('홈은 88px/두께 8 링으로 진도를 그린다', () => {
  assert.match(combined, /RingProgress/, '홈은 ui/RingProgress 를 사용한다');
  assert.match(combined, /:size="88"|size="88"|:size="\s*88\s*"/, '링 크기 88');
  assert.match(combined, /:thickness="8"|thickness="8"/, '링 두께 8');
});

test('홈의 primary 버튼은 화면당 하나다', () => {
  const primaries = combined.match(/variant="primary"/g) ?? [];
  assert.equal(primaries.length, 1, `primary 버튼은 1개여야 한다(현재 ${primaries.length}개)`);
});

test('스탯 3열은 StatValue 와 지정된 Lucide 아이콘을 쓴다', () => {
  assert.match(combined, /StatValue/, '스탯은 ui/StatValue 를 사용한다');
  for (const icon of ['FlameIcon', 'CalendarCheckIcon', 'BookOpenIcon']) {
    assert.match(combined, new RegExp(icon), `아이콘 ${icon}`);
  }
});

test('주간 도트는 읽음·오늘·예정 3상태를 구분한다', () => {
  assert.match(combined, /week-dot|weekday-dot|day-dot/, '요일 도트 클래스');
  for (const state of ['read', 'today', 'upcoming']) {
    assert.match(combined, new RegExp(`(dot|day)[-_]?${state}|${state}\\b`, 'i'), `도트 상태 ${state}`);
  }
  assert.match(styleOf(combined), /border[^;]*dashed/, '예정 상태는 dashed 보더');
});

test('바로가기는 통독표·하세나하시조·개론 영상·함께 4개다', () => {
  for (const [label, href] of [['통독표', '/plan'], ['하세나하시조', '/hasena'], ['개론 영상', '/intro'], ['함께', '/groups']]) {
    assert.match(combined, new RegExp(label), `바로가기 ${label}`);
    assert.match(combined, new RegExp(`["']\\${href}["']`), `바로가기 링크 ${href}`);
  }
});

test('홈 소스에 원시 hex 와 이모지가 없다', () => {
  for (const [name, source] of all) {
    assert.deepEqual(rawHexes(source), [], `${name} 원시 hex`);
    assert.doesNotMatch(source, /\p{Extended_Pictographic}/u, `${name} 이모지`);
  }
});
