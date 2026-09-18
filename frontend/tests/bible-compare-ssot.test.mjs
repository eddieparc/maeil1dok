import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// 역본 비교 SSOT 계약: 보조(오른쪽) 컬럼은 주(왼쪽) 컬럼과 동일한
// BibleViewer 렌더링 경로를 거쳐야 한다. 별도의 v-html + 축소 스타일
// 경로가 존재하면 소제목·절 줄·각주 등이 역본마다 다르게 깨진다.
const compareSource = await readFile(
  new URL('../app/components/bible/BibleCompareViewer.vue', import.meta.url), 'utf8');
const readerSource = await readFile(
  new URL('../app/components/bible/BibleReaderView.vue', import.meta.url), 'utf8');
const sources = new Map([
  ['useBibleData.ts', await readFile(
    new URL('../app/composables/useBibleData.ts', import.meta.url), 'utf8')],
]);

function styleBlocks(source) {
  return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((m) => m[1].replace(/\/\*[\s\S]*?\*\//g, ''))
    .join('\n');
}

test('보조 컬럼은 BibleViewer 로 렌더링한다', () => {
  assert.match(compareSource, /import\s+BibleViewer\s+from/, 'BibleViewer import 가 없다');
  const secondarySection = compareSource.slice(compareSource.indexOf('column secondary'));
  assert.match(secondarySection, /<BibleViewer\b/, '보조 컬럼에 BibleViewer 가 없다');
});

test('보조 컬럼은 v-html 직접 렌더링을 쓰지 않는다', () => {
  assert.doesNotMatch(compareSource, /v-html/, 'v-html 잔존');
});

test('보조 컬럼은 본문 스타일을 자체 복제하지 않는다', () => {
  const css = styleBlocks(compareSource);
  for (const sel of ['.verse-number', '.verse-text', '.section-title', '.verse-line']) {
    assert.doesNotMatch(css, new RegExp(sel.replace('.', '\\.') + '\\s*[,{:]'),
      `${sel} 스타일이 비교 뷰어에 복제돼 있다`);
  }
});

test('보조 BibleViewer 에 책·장·역본명이 전달된다', () => {
  const secondarySection = compareSource.slice(compareSource.indexOf('column secondary'));
  for (const prop of [':book', ':chapter', ':version']) {
    assert.match(secondarySection, new RegExp(prop.replace(':', '\\:') + '='), `${prop} 미전달`);
  }
});

test('BibleReaderView 가 비교 뷰어에 책·장을 넘긴다', () => {
  const compareBlock = readerSource.slice(readerSource.indexOf('<BibleCompareViewer'));
  for (const prop of [':book', ':chapter']) {
    assert.match(compareBlock, new RegExp(prop.replace(':', '\\:') + '='), `${prop} 미전달`);
  }
});

test('원천이 소멸한 우리말성경(WOORI)은 선택 가능한 역본에서 제외된다', () => {
  const dataSource = sources.get('useBibleData.ts');
  const unsupported = dataSource.match(/UNSUPPORTED_VERSIONS\s*=\s*new Set\(\[([^\]]*)\]\)/);
  assert.ok(unsupported, 'UNSUPPORTED_VERSIONS 정의를 찾지 못했다');
  assert.match(unsupported[1], /'WOORI'/, 'WOORI 가 미지원 목록에 없다');
});
