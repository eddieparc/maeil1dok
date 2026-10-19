import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { styleOf } from './helpers/design-contract.mjs';

// PR5 데스크톱 — 셸/2컬럼/최대 폭 계약 (핸드오프 README "15. 데스크톱 홈").
const page = await readFile(new URL('../app/pages/index.vue', import.meta.url), 'utf8');
const layout = await readFile(new URL('../app/components/common/PageLayout.vue', import.meta.url), 'utf8');

test('데스크톱 홈은 760 + 300 두 컬럼이다', () => {
  const css = styleOf(page);
  assert.match(css, /@media[^{]*min-width:\s*1024px/, '1024px 브레이크포인트');
  assert.match(css, /grid-template-columns:[^;]*(760px|var\(--content-max\))[^;]*(300px|var\(--aside-width\))/, '760 + 300 컬럼');
  assert.match(css, /gap:\s*28px/, '컬럼 간격 28px');
});

test('데스크톱 홈 링은 120px 두께 10 이다', () => {
  assert.match(page, /:size="120"|size="120"/, '데스크톱 링 120');
  assert.match(page, /:thickness="10"|thickness="10"/, '데스크톱 링 두께 10');
});

test('리스트 페이지는 콘텐츠 최대 폭 토큰을 쓴다', () => {
  assert.match(styleOf(layout), /max-width:\s*var\(--content-max\)/, 'PageLayout 최대 폭 토큰');
});
