import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { rawHexes, styleOf } from './helpers/design-contract.mjs';

// PR3 함께 — 그룹/리더보드/친구 디자인 계약 (핸드오프 README "6~9").
const groups = await readFile(new URL('../app/pages/groups/index.vue', import.meta.url), 'utf8');
const groupDetail = await readFile(new URL('../app/pages/groups/[id].vue', import.meta.url), 'utf8');
const scoreboard = await readFile(new URL('../app/pages/scoreboard.vue', import.meta.url), 'utf8');
const friends = await readFile(new URL('../app/pages/friends.vue', import.meta.url), 'utf8');

test('그룹 목록은 칩 필터와 아바타 스택을 쓴다', () => {
  assert.match(groups, /FilterChip|FilterButtonGroup/, '칩 필터 컴포넌트');
  for (const label of ['전체', '공개', '내 그룹']) {
    assert.match(groups, new RegExp(label), `필터 ${label}`);
  }
  assert.match(styleOf(groups), /avatar-stack|margin-left:\s*-8px/, '아바타 스택 겹침');
});

test('그룹 목록 상단에 친구·리더보드 secondary 버튼이 있다', () => {
  assert.match(groups, /친구/, '친구 버튼');
  assert.match(groups, /리더보드/, '리더보드 버튼');
  assert.match(groups, /variant="secondary"/, 'secondary 변형 사용');
});

test('그룹 상세 멤버 행은 주간 7셀을 그린다', () => {
  assert.match(groupDetail, /week|주간/, '주간 표시');
  assert.match(styleOf(groupDetail), /repeat\(7,|week-cell/, '7셀 그리드');
  assert.match(styleOf(groupDetail), /dashed/, '예정 상태 dashed');
});

test('리더보드는 이모지 없이 순위 숫자와 accent 를 쓴다', () => {
  assert.doesNotMatch(scoreboard, /\p{Extended_Pictographic}/u, '리더보드 이모지 금지');
  assert.match(scoreboard, /SegmentedControl/, '보기 세그먼트');
  assert.match(styleOf(scoreboard), /\.(my-rank|rank-card)[^{]*\{[\s\S]*?background:\s*var\(--color-accent-primary\)/, '내 순위 카드 accent 채움');
  assert.match(styleOf(scoreboard), /\.(is-me|my-row)[^{]*\{[\s\S]*?background:\s*var\(--color-accent-bg\)/, '내 행 틴트');
});

test('친구 목록 토글은 32px 필 버튼이다', () => {
  const css = styleOf(friends);
  assert.match(css, /(follow|toggle)[^{]*\{[\s\S]*?height:\s*32px/, '토글 높이 32px');
  assert.match(css, /border-radius:\s*(999px|var\(--radius-pill\))/, '필 반경');
});

test('함께 화면에 원시 hex 가 없다', () => {
  for (const [name, source] of [['groups/index.vue', groups], ['groups/[id].vue', groupDetail], ['scoreboard.vue', scoreboard], ['friends.vue', friends]]) {
    assert.deepEqual(rawHexes(source), [], `${name} 원시 hex`);
  }
});
