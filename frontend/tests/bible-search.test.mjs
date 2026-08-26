import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compileTemplate, parse as parseSfc } from '@vue/compiler-sfc';
import { renderToString } from '@vue/server-renderer';
import * as Vue from 'vue';
import { createSSRApp, defineComponent, h } from 'vue';
import esbuild from 'esbuild';

const { transform } = esbuild;

const importTypescriptModule = async (path) => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { code } = await transform(source, {
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return import(dataUrl);
};

const { parseBibleSearchQuery } = await importTypescriptModule(
  '../app/utils/bibleSearch.ts',
);

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

const sourceFor = path => readFile(new URL(path, import.meta.url), 'utf8');
const bookSelectorSource = await sourceFor('../app/components/bible/BookSelector.vue');
const searchButtonSource = await sourceFor('../app/components/bible/BibleSearchButton.vue');
const homeHeaderSource = await sourceFor('../app/components/bible/BibleHomeHeader.vue');
const readerSource = await sourceFor('../app/components/bible/BibleReaderView.vue');

const compileSfcTemplate = (source, filename) => {
  const { descriptor } = parseSfc(source, { filename });
  assert.ok(descriptor.template, `${filename} should have a template`);
  const compiled = compileTemplate({
    id: `test-${filename}`,
    source: descriptor.template.content,
    filename,
    compilerOptions: { mode: 'function' },
  });
  assert.deepEqual(compiled.errors, []);
  return new Function('Vue', `${compiled.code}; return render`)(Vue);
};

const iconStub = defineComponent({
  setup: () => () => h('span', { 'aria-hidden': 'true' }),
});
const nuxtLinkStub = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: [String, Object], required: true } },
  setup(props, { slots }) {
    return () => h('a', {
      href: typeof props.to === 'string' ? props.to : props.to.path,
    }, slots.default?.());
  },
});

const createSearchButtonComponent = () => defineComponent({
  name: 'BibleSearchButton',
  components: { NuxtLink: nuxtLinkStub, SearchIcon: iconStub },
  render: compileSfcTemplate(searchButtonSource, 'BibleSearchButton.vue'),
});

const renderBookSelectorInChapterMode = async () => {
  const modalStub = defineComponent({
    name: 'UiModalBaseModal',
    setup(_, { slots }) {
      return () => h('section', slots.default?.());
    },
  });
  const noop = () => {};
  const component = defineComponent({
    components: {
      ArrowRightIcon: iconStub,
      SearchIcon: iconStub,
      SparkleIcon: iconStub,
      UiModalBaseModal: modalStub,
      XCircleIcon: iconStub,
    },
    setup() {
      return {
        VISIBLE_VERSION_NAMES: {},
        bibleBooks: { old: [], new: [] },
        chaptersArray: [],
        confirmedBookId: 'jhn',
        confirmedBookName: '요한복음',
        confirmedChapter: 0,
        currentBook: 'jhn',
        currentChapter: 3,
        currentInputValue: '3',
        currentSearchResult: null,
        currentVersion: 'GAE',
        close: noop,
        getChapterUnit: () => '장',
        goToSearchResult: noop,
        handleInput: noop,
        handleSearchKeydown: noop,
        handleSubmitButton: noop,
        inputError: false,
        inputMode: 'chapter',
        inputPlaceholder: '요한복음 몇 장?',
        modelValue: true,
        resetToSearchMode: noop,
        searchQuery: '',
        searchResults: [],
        selectBook: noop,
        selectChapter: noop,
        selectedBookId: 'jhn',
        selectedResultIndex: 0,
        selectSearchResult: noop,
      };
    },
    render: compileSfcTemplate(bookSelectorSource, 'BookSelector.vue'),
  });

  return renderToString(createSSRApp(component));
};

const renderHomeHeader = async () => {
  const component = defineComponent({
    components: {
      BibleSearchButton: createSearchButtonComponent(),
      SettingsIcon: iconStub,
    },
    render: compileSfcTemplate(homeHeaderSource, 'BibleHomeHeader.vue'),
  });
  return renderToString(createSSRApp(component));
};

const renderReaderHeader = async () => {
  const emptyStub = defineComponent({ setup: () => () => h('div') });
  const noop = () => {};
  const component = defineComponent({
    components: {
      BibleSearchButton: createSearchButtonComponent(),
      BibleToolPopover: emptyStub,
      BibleViewer: emptyStub,
      BookmarkFilledIcon: iconStub,
      BookmarkOutlineIcon: iconStub,
      BookOpenIcon: iconStub,
      CalendarCheckIcon: iconStub,
      CheckCircleIcon: iconStub,
      CheckCircleOutlineIcon: iconStub,
      CheckIcon: iconStub,
      ClientOnly: emptyStub,
      ChevronLeftIcon: iconStub,
      ChevronRightIcon: iconStub,
      FloatingBottomBar: emptyStub,
      HeadphonesIcon: iconStub,
      SelectionFloatingControls: emptyStub,
      TongdokAudioPlayer: emptyStub,
      XMarkIcon: iconStub,
    },
    setup() {
      return {
        bookProgress: { read: 0, total: 0, percentage: 0 },
        chapterSuffix: '장',
        content: '',
        currentBookName: '요한복음',
        currentChapter: 3,
        handleSelectionClose: noop,
        handleSelectionCopy: noop,
        handleSelectionCopyClose: noop,
        handleSelectionCopyWithFormat: noop,
        handleSelectionHighlightOrRemove: noop,
        handleSelectionShare: noop,
        handleSwipeLeft: noop,
        handleSwipeRight: noop,
        hasNextChapter: true,
        hasPrevChapter: true,
        highlights: [],
        isAuthenticated: false,
        isBookmarked: false,
        isCompleting: false,
        isCurrentChapterRead: false,
        isLoading: false,
        isMarkingRead: false,
        isTongdokAudioPlayerOpen: false,
        isTongdokMode: false,
        noteCount: 0,
        scrollPosition: 0,
        selectionMenuState: { visible: false, mode: null },
        shortBookName: '요',
        shortScheduleDate: '',
        tongdokAudioLink: null,
        tongdokGuideLink: null,
        tongdokProgress: null,
        tongdokScheduleRange: null,
      };
    },
    render: compileSfcTemplate(readerSource, 'BibleReaderView.vue'),
  });
  return renderToString(createSSRApp(component));
};

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
  const html = await renderBookSelectorInChapterMode();
  assert.match(html, /<button[^>]*type="button"[^>]*aria-label="입력한 장\/절로 이동"/);

  // Click behavior moved to Playwright: tests/e2e/browser-behavior.spec.ts.
});

test('Bible search button opens the search page accessibly', async () => {
  const SearchButton = createSearchButtonComponent();
  const html = await renderToString(createSSRApp(SearchButton));

  assert.match(html, /href="\/bible\/search"/);
  assert.match(html, /aria-label="성경 본문 검색 열기"/);
});

test('Bible home exposes the shared search button', async () => {
  const html = await renderHomeHeader();

  assert.match(html, /<a[^>]*href="\/bible\/search"[^>]*aria-label="성경 본문 검색 열기"/);
});

test('Bible reader exposes the same search button on /bible', async () => {
  const html = await renderReaderHeader();

  assert.match(html, /<a[^>]*href="\/bible\/search"[^>]*aria-label="성경 본문 검색 열기"/);
});
