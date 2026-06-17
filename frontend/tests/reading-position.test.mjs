import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { transform } from 'esbuild';

const readingPositionSource = await readFile(
  new URL('../app/composables/useReadingPosition.ts', import.meta.url),
  'utf8',
);

const biblePageSource = await readFile(
  new URL('../app/pages/bible/index.vue', import.meta.url),
  'utf8',
);

const bibleFetchWrapperSource = await readFile(
  new URL('../app/composables/useBibleFetch.ts', import.meta.url),
  'utf8',
);

const bibleFetchClientSource = await readFile(
  new URL('../app/composables/bible/bibleFetchClient.ts', import.meta.url),
  'utf8',
);

const bibleFetchSource = `${bibleFetchWrapperSource}\n${bibleFetchClientSource}`;

const readerViewSource = await readFile(
  new URL('../app/components/bible/BibleReaderView.vue', import.meta.url),
  'utf8',
);

const bibleViewerSource = await readFile(
  new URL('../app/components/bible/BibleViewer.vue', import.meta.url),
  'utf8',
);

const readingPositionSerializerSource = await readFile(
  new URL('../../backend/todos/serializers.py', import.meta.url),
  'utf8',
);

const createLocalStorage = () => {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
};

const setupBrowserGlobals = () => {
  globalThis.localStorage = createLocalStorage();
  globalThis.window = {
    innerHeight: 1000,
    scrollY: 900,
    scrollTo: () => {},
  };
  globalThis.document = {
    documentElement: {
      scrollHeight: 3000,
    },
  };
};

const importReadingPositionModule = async () => {
  const runnableSource = readingPositionSource
    .replace(
      "import { ref, type Ref } from 'vue';",
      "const ref = value => ({ value });",
    )
    .replace(
      "import { useAuthService } from '~/composables/useAuthService';",
      "const useAuthService = () => ({ isAuthenticated: { value: false } });",
    )
    .replace(
      "import { BIBLE_BOOKS, VISIBLE_VERSION_NAMES } from '~/composables/useBibleData';",
      "const BIBLE_BOOKS = { old: [{ id: 'gen', chapters: 50 }, { id: 'exo', chapters: 40 }, { id: 'jnh', chapters: 4 }], new: [] };\nconst VISIBLE_VERSION_NAMES = { GAE: '개역개정', KNT: '새한글성경' };",
    )
    .replace(
      "import { useApi } from './useApi';",
      "const useApi = () => ({ get: async () => ({ data: { success: false } }), post: async () => undefined });",
    );

  const { code } = await transform(runnableSource, {
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return import(`${dataUrl}#${Date.now()}-${Math.random()}`);
};

const extractFunctionBody = (source, functionName) => {
  const declaration = `const ${functionName} =`;
  const start = source.indexOf(declaration);
  assert.notEqual(start, -1, `${functionName} should exist`);

  const bodyStart = source.indexOf('{', start);
  assert.notEqual(bodyStart, -1, `${functionName} should have a body`);

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) {
      return source.slice(bodyStart, index + 1);
    }
  }

  assert.fail(`${functionName} body should close`);
};

test('loadReadingPosition ignores malformed localStorage reading positions at runtime', async () => {
  setupBrowserGlobals();
  localStorage.setItem('lastReadingPosition', JSON.stringify({
    book: 'exo',
    chapter: 3,
    scroll_position: 1.42,
    version: 'KNT',
  }));

  const { useReadingPosition } = await importReadingPositionModule();
  const readingPosition = useReadingPosition();

  assert.equal(await readingPosition.loadReadingPosition(), null);
  assert.equal(readingPosition.lastReadingPosition.value, null);
});

test('loadReadingPosition normalizes valid stored positions at runtime', async () => {
  setupBrowserGlobals();
  localStorage.setItem('lastReadingPosition', JSON.stringify({
    book: 'jon',
    chapter: 3,
    scroll_position: 0.42,
    version: 'knt',
  }));

  const { useReadingPosition } = await importReadingPositionModule();
  const readingPosition = useReadingPosition();

  assert.deepEqual(await readingPosition.loadReadingPosition(), {
    book: 'jnh',
    chapter: 3,
    scroll_position: 0.42,
    version: 'KNT',
  });
});

test('saveReadingPosition stores the explicit reader scroll instead of window scroll at runtime', async () => {
  setupBrowserGlobals();
  window.scrollY = 1800;
  document.documentElement.scrollHeight = 3000;

  const { useReadingPosition } = await importReadingPositionModule();
  const readingPosition = useReadingPosition();

  await readingPosition.saveReadingPosition('exo', 3, 'KNT', true, 0.42);

  const stored = JSON.parse(localStorage.getItem('lastReadingPosition'));
  assert.deepEqual(
    {
      book: stored.book,
      chapter: stored.chapter,
      scroll_position: stored.scroll_position,
      version: stored.version,
    },
    {
      book: 'exo',
      chapter: 3,
      scroll_position: 0.42,
      version: 'KNT',
    },
  );
  assert.equal(readingPosition.lastSavedScrollPosition.value, 0.42);
});

test('saveReadingPosition falls back to window scroll until the reader emits at runtime', async () => {
  setupBrowserGlobals();
  window.scrollY = 840;
  document.documentElement.scrollHeight = 3000;

  const pageScrollState = {
    scrollPosition: { value: 0 },
    hasReaderScrollPosition: { value: false },
    setReaderScrollPosition(position, fromReaderScroll = false) {
      this.scrollPosition.value = position;
      this.hasReaderScrollPosition.value = fromReaderScroll;
    },
    resetReaderScrollPosition() {
      this.setReaderScrollPosition(0);
    },
    getExplicitReaderScrollPosition() {
      return this.hasReaderScrollPosition.value ? this.scrollPosition.value : undefined;
    },
  };

  const { useReadingPosition } = await importReadingPositionModule();
  const readingPosition = useReadingPosition();

  pageScrollState.setReaderScrollPosition(0.91, true);
  pageScrollState.resetReaderScrollPosition();

  await readingPosition.saveReadingPosition(
    'exo',
    3,
    'KNT',
    true,
    pageScrollState.getExplicitReaderScrollPosition(),
  );

  let stored = JSON.parse(localStorage.getItem('lastReadingPosition'));
  assert.equal(stored.scroll_position, 0.42);
  assert.equal(readingPosition.lastSavedScrollPosition.value, 0.42);

  pageScrollState.setReaderScrollPosition(0.11, true);
  await readingPosition.saveReadingPosition(
    'exo',
    3,
    'KNT',
    true,
    pageScrollState.getExplicitReaderScrollPosition(),
  );

  stored = JSON.parse(localStorage.getItem('lastReadingPosition'));
  assert.equal(stored.scroll_position, 0.11);
  assert.equal(readingPosition.lastSavedScrollPosition.value, 0.11);
});

test('bible page saves the emitted inner-reader scroll position', () => {
  const handleScrollPositionBody = extractFunctionBody(biblePageSource, 'handleScrollPosition');
  const setReaderScrollPositionBody = extractFunctionBody(biblePageSource, 'setReaderScrollPosition');

  assert.match(
    handleScrollPositionBody,
    /setReaderScrollPosition\(position,\s*true\)/,
    'scroll handler should mark emitted reader scroll as the current explicit reader position',
  );
  assert.match(
    setReaderScrollPositionBody,
    /scrollPosition\.value\s*=\s*position/,
    'reader scroll helper should keep the emitted scroll position in state',
  );
  assert.match(
    setReaderScrollPositionBody,
    /hasReaderScrollPosition\.value\s*=\s*fromReaderScroll/,
    'reader scroll helper should keep whether the position is explicit for save paths',
  );
  assert.match(
    handleScrollPositionBody,
    /saveReadingPosition\(\s*currentBook\.value,\s*currentChapter\.value,\s*currentVersion\.value,\s*false,\s*position\s*\)/,
    'scroll handler should persist the emitted inner-reader position with the current location',
  );
  assert.match(
    biblePageSource,
    /const\s+getExplicitReaderScrollPosition\s*=\s*\(\)\s*=>\s*{[\s\S]*hasReaderScrollPosition\.value\s*\?\s*scrollPosition\.value\s*:\s*undefined[\s\S]*}/,
    'page should expose an explicit reader scroll helper only after the reader emits one',
  );
  assert.match(
    biblePageSource,
    /saveReadingPosition\(\s*currentBook\.value,\s*currentChapter\.value,\s*currentVersion\.value,\s*true,\s*getExplicitReaderScrollPosition\(\)\s*\)/,
    'unload paths should pass the conditional explicit reader scroll helper',
  );
});

test('bible page restores saved scroll after content loads', () => {
  assert.match(
    biblePageSource,
    /restoreScrollPosition:\s*restoreReadingScrollPosition/,
    'page should alias the reading-position scroll restore helper',
  );
  assert.match(
    biblePageSource,
    /const\s+restoreSavedScrollPosition\s*=\s*async\s*\(position:\s*number\s*\|\s*undefined\)/,
    'page should centralize saved-scroll restoration for reader and window surfaces',
  );
  assert.match(
    biblePageSource,
    /bibleReaderViewRef\.value\?\.restoreScrollPosition\(\)/,
    'saved position restore should explicitly trigger the inner BibleViewer restore path',
  );
  assert.match(
    readerViewSource,
    /restoreScrollPosition:\s*\(\)\s*=>\s*{[\s\S]*bibleViewerRef\.value\?\.restoreScrollPosition\(\);/,
    'BibleReaderView should expose the inner BibleViewer restore path',
  );
  assert.match(
    biblePageSource,
    /const\s+resetReaderScrollPosition\s*=\s*\(\)\s*=>\s*{[\s\S]*setReaderScrollPosition\(0\);[\s\S]*}/,
    'fresh location changes should reset explicit reader scroll state to top',
  );
  assert.match(
    biblePageSource,
    /const\s+setReaderScrollPosition\s*=\s*\(position:\s*number,\s*fromReaderScroll\s*=\s*false\)/,
    'programmatic resets and restores should not mark the current reader position as explicit',
  );
  assert.match(
    biblePageSource,
    /hasReaderScrollPosition\.value\s*=\s*fromReaderScroll/,
    'save paths should know whether the current reader position is explicit',
  );
  assert.match(
    biblePageSource,
    /setReaderScrollPosition\(position,\s*true\);[\s\S]*saveReadingPosition\(\s*currentBook\.value,\s*currentChapter\.value,\s*currentVersion\.value,\s*false,\s*position\s*\)/,
    'actual reader scroll events should still save the emitted explicit position',
  );
  assert.match(
    bibleViewerSource,
    /const\s+scrollPosition\s*=\s*Math\.min\(1,\s*Math\.max\(0,\s*props\.initialScrollPosition\)\);[\s\S]*viewerRef\.value\.scrollTop\s*=\s*scrollPosition\s*\*\s*maxScroll;/,
    'BibleViewer should restore an explicit 0 position instead of treating it as absent',
  );
  assert.match(
    biblePageSource,
    /await\s+loadBibleContent\(currentBook\.value,\s*currentChapter\.value\);\s*await\s+restoreSavedScrollPosition\(lastPos\?\.scroll_position\);/,
    'initial /bible restore should wait for content before restoring the saved scroll ratio',
  );
});

test('bible page clears stale scroll state on route changes and auto-save', () => {
  assert.match(
    biblePageSource,
    /const hasBibleLocationQuery = newQuery\.book \|\| newQuery\.chapter \|\| newQuery\.verse;[\s\S]*if\s*\(hasBibleLocationQuery \|\| newQuery\.tongdok\)\s*{[\s\S]*initFromQuery\(\);[\s\S]*resetReaderScrollPosition\(\);[\s\S]*loadBibleContent/,
    'deep-link route changes should reset stale reader scroll state before loading a fresh location',
  );
  assert.match(
    biblePageSource,
    /saveReadingPosition\(\s*currentBook\.value,\s*currentChapter\.value,\s*currentVersion\.value,\s*false,\s*getExplicitReaderScrollPosition\(\)\s*\)/,
    'automatic location saves should pass the current explicit reader scroll state',
  );
});

test('bible fetch proxy URLs are built with URLSearchParams', () => {
  assert.match(
    bibleFetchSource,
    /new\s+URLSearchParams\(\{[\s\S]*chapter:\s*`\$\{book\.toUpperCase\(\)\}\.\$\{chapter\}`/,
    'KNT proxy fetch should encode the chapter query parameter',
  );
  assert.match(
    bibleFetchSource,
    /new\s+URLSearchParams\(\{[\s\S]*version,[\s\S]*book,[\s\S]*chap:\s*String\(chapter\)/,
    'standard proxy fetch should encode version, book, and chapter query parameters',
  );
});

test('backend serializer rejects invalid reading position payloads', () => {
  assert.match(
    readingPositionSerializerSource,
    /def\s+validate_scroll_position\(self,\s*value\):[\s\S]*value\s*<\s*0\s+or\s+value\s*>\s*1/,
    'backend should enforce scroll_position in the 0..1 range',
  );
  assert.match(
    readingPositionSerializerSource,
    /def\s+validate_book\(self,\s*value\):[\s\S]*normalized\s+not\s+in\s+BIBLE_BOOK_CHAPTERS/,
    'backend should reject unsupported book codes',
  );
  assert.match(
    readingPositionSerializerSource,
    /def\s+validate_version\(self,\s*value\):[\s\S]*normalized\s+not\s+in\s+SUPPORTED_READING_VERSIONS/,
    'backend should reject unsupported version codes',
  );
  assert.match(
    readingPositionSerializerSource,
    /if\s+max_chapter\s+is\s+not\s+None\s+and\s+chapter\s*>\s*max_chapter/,
    'backend should reject chapters beyond the selected book bounds',
  );
});
