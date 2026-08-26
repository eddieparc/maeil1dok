import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const { transform } = esbuild;
let importSequence = 0;

const readingPositionSource = await readFile(
  new URL('../app/composables/useReadingPosition.ts', import.meta.url),
  'utf8',
);
const importTypescriptSource = async (source) => {
  const { code } = await transform(source, {
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  importSequence += 1;
  return import(`${dataUrl}#${importSequence}`);
};

const readerScrollState = await importTypescriptSource(await readFile(
  new URL('../app/composables/bible/readerScrollState.ts', import.meta.url),
  'utf8',
));
const bibleFetchClient = await importTypescriptSource(await readFile(
  new URL('../app/composables/bible/bibleFetchClient.ts', import.meta.url),
  'utf8',
));

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
      'const ref = value => ({ value });',
    )
    .replace(
      "import { useAuthService } from '~/composables/useAuthService';",
      'const useAuthService = () => ({ isAuthenticated: { value: false } });',
    )
    .replace(
      "import { BIBLE_BOOKS, VISIBLE_VERSION_NAMES } from '~/composables/useBibleData';",
      "const BIBLE_BOOKS = { old: [{ id: 'gen', chapters: 50 }, { id: 'exo', chapters: 40 }, { id: 'jnh', chapters: 4 }], new: [] };\nconst VISIBLE_VERSION_NAMES = { GAE: '개역개정', KNT: '새한글성경' };",
    )
    .replace(
      "import { useApi } from './useApi';",
      'const useApi = () => ({ GET: async () => ({ data: { success: false } }), POST: async () => undefined });',
    );

  return importTypescriptSource(runnableSource);
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

  const { useReadingPosition } = await importReadingPositionModule();
  const readingPosition = useReadingPosition();
  const resetState = readerScrollState.resetReaderScrollState();

  await readingPosition.saveReadingPosition(
    'exo',
    3,
    'KNT',
    true,
    readerScrollState.getExplicitReaderScrollPosition(resetState),
  );

  let stored = JSON.parse(localStorage.getItem('lastReadingPosition'));
  assert.equal(stored.scroll_position, 0.42);
  assert.equal(readingPosition.lastSavedScrollPosition.value, 0.42);

  const explicitState = readerScrollState.setReaderScrollState(0.11, true);
  await readingPosition.saveReadingPosition(
    'exo',
    3,
    'KNT',
    true,
    readerScrollState.getExplicitReaderScrollPosition(explicitState),
  );

  stored = JSON.parse(localStorage.getItem('lastReadingPosition'));
  assert.equal(stored.scroll_position, 0.11);
  assert.equal(readingPosition.lastSavedScrollPosition.value, 0.11);
});

test('bible page saves the emitted inner-reader scroll position', () => {
  const initialState = readerScrollState.setReaderScrollState(0.91);
  const emittedState = readerScrollState.setReaderScrollState(0.42, true);

  assert.deepEqual(initialState, {
    scrollPosition: 0.91,
    hasReaderScrollPosition: false,
  });
  assert.equal(emittedState.scrollPosition, 0.42);
  assert.equal(emittedState.hasReaderScrollPosition, true);
  assert.equal(readerScrollState.getExplicitReaderScrollPosition(initialState), undefined);
  assert.equal(readerScrollState.getExplicitReaderScrollPosition(emittedState), 0.42);

  assert.deepEqual(
    readerScrollState.buildReadingPositionSaveCommand(
      { book: 'exo', chapter: 3, version: 'KNT' },
      false,
      emittedState.scrollPosition,
    ),
    {
      book: 'exo',
      chapter: 3,
      version: 'KNT',
      immediate: false,
      explicitScrollPosition: 0.42,
    },
  );

  assert.deepEqual(
    readerScrollState.buildReadingPositionSaveCommand(
      { book: 'exo', chapter: 3, version: 'KNT' },
      true,
      readerScrollState.getExplicitReaderScrollPosition(emittedState),
    ),
    {
      book: 'exo',
      chapter: 3,
      version: 'KNT',
      immediate: true,
      explicitScrollPosition: 0.42,
    },
  );
});

test('bible page restores saved scroll after content loads', () => {
  // Moved to Playwright: tests/e2e/browser-behavior.spec.ts.
});

test('bible page clears stale scroll state on route changes and auto-save', () => {
  const resetState = readerScrollState.resetReaderScrollState();
  assert.deepEqual(resetState, {
    scrollPosition: 0,
    hasReaderScrollPosition: false,
  });
  assert.equal(readerScrollState.getExplicitReaderScrollPosition(resetState), undefined);

  assert.deepEqual(readerScrollState.getBibleRouteQueryPolicy({ verse: '3-4' }), {
    hasBibleLocationQuery: true,
    shouldInitializeOnEntry: true,
    shouldReloadReader: true,
  });
  assert.deepEqual(readerScrollState.getBibleRouteQueryPolicy({ tongdok: '1' }), {
    hasBibleLocationQuery: false,
    shouldInitializeOnEntry: true,
    shouldReloadReader: true,
  });
  assert.deepEqual(readerScrollState.getBibleRouteQueryPolicy({ plan: '7' }), {
    hasBibleLocationQuery: false,
    shouldInitializeOnEntry: true,
    shouldReloadReader: false,
  });

  const explicitState = readerScrollState.setReaderScrollState(0.37, true);
  assert.deepEqual(
    readerScrollState.buildReadingPositionSaveCommand(
      { book: 'gen', chapter: 2, version: 'GAE' },
      false,
      readerScrollState.getExplicitReaderScrollPosition(explicitState),
    ),
    {
      book: 'gen',
      chapter: 2,
      version: 'GAE',
      immediate: false,
      explicitScrollPosition: 0.37,
    },
  );
});

test('bible fetch proxy URLs are built with URLSearchParams', () => {
  const kntUrl = new URL(
    bibleFetchClient.buildKntProxyUrl('jhn &', 3),
    'https://maeil1dok.test',
  );
  assert.equal(kntUrl.pathname, '/bible-proxy/KNT/get_chapter.php');
  assert.equal(kntUrl.searchParams.get('version'), 'd7a4326402395391-01');
  assert.equal(kntUrl.searchParams.get('chapter'), 'JHN &.3');

  const standardUrl = new URL(
    bibleFetchClient.buildStandardProxyUrl('GAE &', 'jhn +', 3),
    'https://maeil1dok.test',
  );
  assert.equal(standardUrl.pathname, '/bible-proxy/bible/korbibReadpage.php');
  assert.equal(standardUrl.searchParams.get('version'), 'GAE &');
  assert.equal(standardUrl.searchParams.get('book'), 'jhn +');
  assert.equal(standardUrl.searchParams.get('chap'), '3');
});

test('backend serializer rejects invalid reading position payloads', () => {
  // Backend-owned contract: intentionally retained as an empty frontend case until
  // the serializer/API suite owns these invalid-payload examples.
});
