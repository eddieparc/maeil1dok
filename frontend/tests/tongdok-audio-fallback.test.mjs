import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const source = await readFile(
  new URL('../app/utils/tongdokAudioSelection.ts', import.meta.url),
  'utf8',
);
const { code } = await esbuild.transform(source, {
  format: 'esm',
  loader: 'ts',
  sourcemap: false,
});
const { selectTongdokAudioLink } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
);

const FALLBACKS = [
  { book: 'gen', chapter: 1, url: 'https://www.youtube.com/watch?v=gen1' },
  { book: 'gen', chapter: 2, url: 'https://www.youtube.com/watch?v=gen2' },
  { book: 'mat', chapter: 5, url: 'https://www.youtube.com/watch?v=mat5' },
];

test('플랜 오디오가 있으면 그 링크를 그대로 쓴다', () => {
  const link = selectTongdokAudioLink({
    audioLink: 'https://www.youtube.com/watch?v=planaudio',
    fallbackLinks: FALLBACKS,
    book: 'gen',
    chapter: 1,
  });

  assert.equal(link, 'https://www.youtube.com/watch?v=planaudio');
});

test('플랜 오디오가 없으면 현재 장의 폴백을 쓴다', () => {
  assert.equal(
    selectTongdokAudioLink({ audioLink: null, fallbackLinks: FALLBACKS, book: 'gen', chapter: 2 }),
    'https://www.youtube.com/watch?v=gen2',
  );
  assert.equal(
    selectTongdokAudioLink({ audioLink: '', fallbackLinks: FALLBACKS, book: 'mat', chapter: 5 }),
    'https://www.youtube.com/watch?v=mat5',
  );
});

test('장을 옮기면 그 장의 폴백으로 바뀐다', () => {
  const first = selectTongdokAudioLink({
    audioLink: null,
    fallbackLinks: FALLBACKS,
    book: 'gen',
    chapter: 1,
  });
  const second = selectTongdokAudioLink({
    audioLink: null,
    fallbackLinks: FALLBACKS,
    book: 'gen',
    chapter: 2,
  });

  assert.notEqual(first, second);
  assert.equal(first, 'https://www.youtube.com/watch?v=gen1');
  assert.equal(second, 'https://www.youtube.com/watch?v=gen2');
});

test('폴백에 없는 장은 null 이라 오디오 UI 가 뜨지 않는다', () => {
  assert.equal(
    selectTongdokAudioLink({ audioLink: null, fallbackLinks: FALLBACKS, book: 'gen', chapter: 3 }),
    null,
  );
  assert.equal(
    selectTongdokAudioLink({ audioLink: null, fallbackLinks: FALLBACKS, book: 'psa', chapter: 101 }),
    null,
  );
  assert.equal(
    selectTongdokAudioLink({ audioLink: null, fallbackLinks: [], book: 'gen', chapter: 1 }),
    null,
  );
  assert.equal(
    selectTongdokAudioLink({ audioLink: null, fallbackLinks: undefined, book: 'gen', chapter: 1 }),
    null,
  );
});

test('장 번호가 문자열로 들어와도 폴백을 찾는다', () => {
  assert.equal(
    selectTongdokAudioLink({ audioLink: null, fallbackLinks: FALLBACKS, book: 'gen', chapter: '2' }),
    'https://www.youtube.com/watch?v=gen2',
  );
});
