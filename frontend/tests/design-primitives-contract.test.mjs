import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// 디자인 리프레시 공통 컴포넌트(PR1 파운데이션) 계약.
const files = [
  'AppButton.vue',
  'FilterChip.vue',
  'SegmentedControl.vue',
  'StatValue.vue',
  'RingProgress.vue',
  'ListCard.vue',
  'BottomSheet.vue',
  'Skeleton.vue',
];

const sources = new Map();
for (const name of files) {
  sources.set(name, await readFile(new URL(`../app/components/ui/${name}`, import.meta.url), 'utf8'));
}

function styleBlocks(source) {
  return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((m) => m[1].replace(/\/\*[\s\S]*?\*\//g, ''))
    .join('\n');
}

test('공통 컴포넌트 스타일은 토큰만 사용하고 원시 hex 를 쓰지 않는다', () => {
  for (const [name, source] of sources) {
    const css = styleBlocks(source);
    const hexes = css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    assert.deepEqual(hexes, [], `${name} 에 원시 hex: ${hexes.join(', ')}`);
  }
});

test('공통 컴포넌트에 이모지를 쓰지 않는다', () => {
  for (const [name, source] of sources) {
    assert.doesNotMatch(source, /\p{Extended_Pictographic}/u, `${name} 에 이모지`);
  }
});

test('AppButton 은 4가지 변형과 3가지 크기를 필 형태로 제공한다', () => {
  const source = sources.get('AppButton.vue');
  for (const variant of ['primary', 'secondary', 'ghost', 'danger']) {
    assert.match(source, new RegExp(variant), `AppButton variant ${variant}`);
  }
  for (const size of ['sm', 'md', 'lg']) {
    assert.match(source, new RegExp(`'${size}'|"${size}"|\\b${size}\\b`), `AppButton size ${size}`);
  }
  assert.match(styleBlocks(source), /border-radius:\s*(999px|var\(--radius-pill\)|var\(--radius-control\))/);
});

test('RingProgress 는 SVG 링이며 size/thickness/value 를 받는다', () => {
  const source = sources.get('RingProgress.vue');
  assert.match(source, /<svg/);
  assert.match(source, /stroke-dasharray|strokeDasharray/);
  for (const prop of ['size', 'thickness', 'value']) {
    assert.match(source, new RegExp(prop), `RingProgress prop ${prop}`);
  }
});

test('BottomSheet 는 350ms 시트 모션과 핸들, 오버레이를 갖는다', () => {
  const source = sources.get('BottomSheet.vue');
  assert.match(styleBlocks(source), /var\(--duration-sheet\)|350ms/);
  assert.match(source, /handle/i);
  assert.match(source, /overlay|backdrop/i);
});

test('ListCard 는 20px 카드 반경을 쓴다', () => {
  assert.match(styleBlocks(sources.get('ListCard.vue')), /border-radius:\s*(20px|var\(--radius-card\))/);
});

test('FilterChip 과 SegmentedControl 은 필 반경을 쓴다', () => {
  for (const name of ['FilterChip.vue', 'SegmentedControl.vue']) {
    assert.match(styleBlocks(sources.get(name)), /border-radius:\s*(999px|var\(--radius-pill\))/, name);
  }
});

test('Skeleton 은 shimmer 애니메이션을 사용한다', () => {
  assert.match(styleBlocks(sources.get('Skeleton.vue')), /shimmer|animation/i);
});

test('StatValue 는 숫자에 tabular-nums 를 적용한다', () => {
  assert.match(styleBlocks(sources.get('StatValue.vue')), /tabular-nums/);
});
