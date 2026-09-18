import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const source = await readFile(
  new URL('../app/utils/mergeCompareContent.ts', import.meta.url),
  'utf8',
);
const { code } = await esbuild.transform(source, {
  format: 'esm',
  loader: 'ts',
  sourcemap: false,
});
const { mergeCompareContent } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);

const verse = (n, text) =>
  `<div class="verse"><span class="verse-number">${n}</span><span class="verse-text">${text}</span></div>`;

const PRIMARY = `<h3>소제목</h3>${verse(1, '일절')}${verse(2, '이절')}${verse(3, '삼절')}`;
const SECONDARY = `<h3>역본제목</h3>${verse(1, 'v1')}${verse(2, 'v2')}${verse(3, 'v3')}`;

test('절 번호가 같은 행으로 좌우에 붙는다', () => {
  const merged = mergeCompareContent(PRIMARY, SECONDARY);
  const rows = merged.match(/class="verse-pair[ "]/g);
  assert.equal(rows.length, 4, '제목 행 1 + 절 행 3');
  assert.match(merged, /pair-primary"><div class="verse"><span class="verse-number">2<\/span><span class="verse-text">이절/);
  assert.match(merged, /pair-secondary"><div class="verse"><span class="verse-number">2<\/span><span class="verse-text">v2/);
});

test('역본이 없으면 원본 HTML을 그대로 돌려준다', () => {
  assert.equal(mergeCompareContent(PRIMARY, ''), PRIMARY);
  assert.equal(mergeCompareContent(PRIMARY, undefined), PRIMARY);
});

test('한쪽에만 있는 절은 빈 셀로 둔다', () => {
  const merged = mergeCompareContent(
    `${verse(1, 'a')}${verse(2, 'b')}`,
    verse(1, 'x'),
  );
  assert.match(merged, /verse-text">b<\/span><\/div><\/div><div class="pair-secondary"><\/div>/);
});

test('역본에만 있는 절은 버리고 원본 절 순서를 유지한다', () => {
  const merged = mergeCompareContent(verse(1, 'a'), `${verse(1, 'x')}${verse(2, 'y')}`);
  assert.equal((merged.match(/verse-pair[ "]/g) ?? []).length, 1);
  assert.doesNotMatch(merged, /verse-text">y/);
});

test('rtl 역본은 셀에 rtl 클래스를 단다', () => {
  const merged = mergeCompareContent(verse(1, 'a'), verse(1, 'x'), true);
  assert.match(merged, /pair-secondary rtl-text/);
});

test('verse-group 절도 번호로 짝지어진다', () => {
  const group = n =>
    `<div class="verse verse-group"><div class="verse-line"><span class="verse-number">${n}</span><span class="verse-text">t${n}</span></div><div class="verse-line continuation"><span class="verse-text">c${n}</span></div></div>`;
  const merged = mergeCompareContent(group(1), group(1));
  assert.match(merged, /pair-secondary"><div class="verse verse-group">/);
});
