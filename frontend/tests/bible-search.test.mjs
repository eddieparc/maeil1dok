import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const {
  parseBibleSearchQuery,
} = await import('../app/utils/bibleSearch.ts');

const books = [
  { id: 'gen', name: '창세기', chapters: 50 },
  { id: 'exo', name: '출애굽기', chapters: 40 },
  { id: 'jhn', name: '요한복음', chapters: 21 },
  { id: 'psa', name: '시편', chapters: 150 },
];

const aliases = {
  창: 'gen',
  창세기: 'gen',
  출: 'exo',
  요: 'jhn',
  요한: 'jhn',
  시: 'psa',
  시편: 'psa',
};

const bookNames = Object.fromEntries(books.map((book) => [book.id, book.name]));
const bookChapters = Object.fromEntries(books.map((book) => [book.id, book.chapters]));

const parse = (query) => parseBibleSearchQuery(query, {
  allBooks: books,
  aliases,
  bookNames,
  bookChapters,
  getVerseCount: (bookId, chapter) => {
    if (bookId === 'jhn' && chapter === 3) return 36;
    if (bookId === 'gen' && chapter === 1) return 31;
    if (bookId === 'psa' && chapter === 119) return 176;
    return 30;
  },
});

test('parses compact Korean chapter and verse references', () => {
  const [result] = parse('요3:16');

  assert.equal(result?.bookId, 'jhn');
  assert.equal(result?.chapter, 3);
  assert.equal(result?.verse, 16);
});

test('parses initial-consonant book aliases with spaced chapter and verse numbers', () => {
  const [result] = parse('ㅊㅅㄱ 1 3');

  assert.equal(result?.bookId, 'gen');
  assert.equal(result?.chapter, 1);
  assert.equal(result?.verse, 3);
});

test('parses Psalm references with Korean units and keeps high chapter numbers', () => {
  const [result] = parse('시편 119편 105절');

  assert.equal(result?.bookId, 'psa');
  assert.equal(result?.chapter, 119);
  assert.equal(result?.verse, 105);
});

test('rejects out-of-range verses instead of navigating to a wrong location', () => {
  assert.deepEqual(parse('요3:99'), []);
});

test('BookSelector exposes a non-Enter submit button for numeric mobile keyboards', async () => {
  const source = await readFile(
    new URL('../app/components/bible/BookSelector.vue', import.meta.url),
    'utf8',
  );

  assert.match(source, /class="search-submit-button"/, 'numeric input modes should render a submit button');
  assert.match(source, /@click="handleSubmitButton"/, 'submit button should invoke the same navigation flow as Enter');
  assert.match(source, /aria-label="입력한 장\/절로 이동"/, 'submit button should be accessible');
});

test('Bible search button opens the search page accessibly', async () => {
  const source = await readFile(
    new URL('../app/components/bible/BibleSearchButton.vue', import.meta.url),
    'utf8',
  );

  assert.match(source, /to="\/bible\/search"/, 'Bible search button should open /bible/search');
  assert.match(source, /aria-label="성경 본문 검색 열기"/, 'Bible search button should be accessible');
});

test('Bible home exposes the shared search button', async () => {
  const source = await readFile(
    new URL('../app/components/bible/BibleHomeHeader.vue', import.meta.url),
    'utf8',
  );

  assert.match(source, /<BibleSearchButton/, 'Bible home should render the search button');
  assert.match(source, /import BibleSearchButton/, 'Bible home should import the search button component');
});

test('Bible reader exposes the same search button on /bible', async () => {
  const source = await readFile(
    new URL('../app/components/bible/BibleReaderView.vue', import.meta.url),
    'utf8',
  );

  assert.match(source, /<BibleSearchButton/, 'Bible reader should render a search button');
  assert.match(source, /import BibleSearchButton/, 'Bible reader should import the search button component');
});
