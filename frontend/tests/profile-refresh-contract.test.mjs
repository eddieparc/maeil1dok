import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { rawHexes, styleOf } from './helpers/design-contract.mjs';

// PR2 코어 — 내 정보 화면 디자인 계약 (핸드오프 README "3. 내 정보").
const page = await readFile(new URL('../app/pages/profile/[id].vue', import.meta.url), 'utf8');
const calendar = await readFile(new URL('../app/components/profile/ProfileCalendar.vue', import.meta.url), 'utf8');
const combined = `${page}\n${calendar}`;

test('프로필은 96px/두께 8 완료율 링을 쓴다', () => {
  assert.match(page, /RingProgress/, 'ui/RingProgress 사용');
  assert.match(page, /:size="96"|size="96"/, '링 크기 96');
  assert.match(page, /:thickness="8"|thickness="8"/, '링 두께 8');
  assert.match(page, /완료율/, '완료율 라벨');
});

test('통계는 2x2 그리드다', () => {
  assert.match(styleOf(page), /grid-template-columns:\s*repeat\(2,\s*(1fr|minmax)/, '2열 그리드');
  for (const label of ['완료한 일수', '현재 연속', '최장 연속', '하세나']) {
    assert.match(page, new RegExp(label), `스탯 ${label}`);
  }
});

test('탭 인디케이터는 2px accent 밑줄이다', () => {
  const css = styleOf(page);
  assert.match(css, /(border-bottom|height):\s*2px/, '2px 인디케이터');
  assert.match(css, /var\(--color-accent-primary\)/, 'accent 색');
});

test('캘린더 셀은 읽음·오늘·미완료·미래 4상태를 구분한다', () => {
  const css = styleOf(calendar);
  assert.match(css, /var\(--color-schedule-completed-bg\)/, '읽음 채움');
  assert.match(css, /var\(--color-schedule-current-border\)/, '오늘 보더');
  assert.match(css, /dashed/, '미완료 dashed 보더');
  assert.match(css, /var\(--color-schedule-upcoming-bg\)/, '미래 배경');
});

test('프로필 소스에 원시 hex 와 이모지가 없다', () => {
  for (const [name, source] of [['[id].vue', page], ['ProfileCalendar.vue', calendar]]) {
    assert.deepEqual(rawHexes(source), [], `${name} 원시 hex`);
    assert.doesNotMatch(source, /\p{Extended_Pictographic}/u, `${name} 이모지`);
  }
});
