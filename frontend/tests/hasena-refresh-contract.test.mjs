import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { rawHexes, styleOf } from './helpers/design-contract.mjs';

// PR2 코어 — 하세나하시조 화면 디자인 계약 (핸드오프 README "2. 하세나하시조").
const page = await readFile(new URL('../app/pages/hasena.vue', import.meta.url), 'utf8');
const css = styleOf(page);

test('완료 버튼은 하단 고정 52px 필 버튼이다', () => {
  const block = css.match(/\.complete-button[^{]*\{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.notEqual(block, '', '.complete-button 스타일 블록이 있어야 한다');
  assert.match(block, /height:\s*52px/, '완료 버튼 높이 52px');
  assert.match(block, /border-radius:\s*(999px|var\(--radius-pill\))/, '완료 버튼 필 반경');
});

test('완료 상태는 틴트 반전과 체크 pop 모션을 쓴다', () => {
  assert.match(css, /\.complete-button\.(is-)?completed|\.completed\b/, '완료 상태 클래스');
  assert.match(css, /@keyframes\s+[\w-]*pop/i, '체크 pop 키프레임');
  assert.match(css, /var\(--duration-pop\)|350ms/, 'pop 지속시간 토큰');
});

test('스탯 행은 줄바꿈 없이 한 줄로 유지된다', () => {
  assert.match(css, /white-space:\s*nowrap/, '스탯 nowrap');
});

test('날짜 배지는 accent 틴트 배지 스타일이다', () => {
  assert.match(css, /var\(--color-accent-bg\)|var\(--color-accent-primary-light\)/, '배지 틴트 배경 토큰');
});

test('하세나 소스에 원시 hex 와 이모지가 없다', () => {
  assert.deepEqual(rawHexes(page), [], '원시 hex');
  assert.doesNotMatch(page, /\p{Extended_Pictographic}/u, '이모지');
});
