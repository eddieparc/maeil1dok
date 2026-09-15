import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const { transform } = esbuild;
let importSequence = 0;

const moduleSources = new Map();

const importComposable = async fileName => {
  if (!moduleSources.has(fileName)) {
    moduleSources.set(
      fileName,
      await readFile(new URL(`../app/composables/${fileName}`, import.meta.url), 'utf8'),
    );
  }

  let runnableSource = moduleSources.get(fileName)
    .replace(
      "import { ref, type Ref } from 'vue';",
      'const ref = value => ({ value });',
    )
    .replace(
      "import { ref } from 'vue';",
      'const ref = value => ({ value });',
    )
    .replace(
      "import { useAuthService } from '~/composables/useAuthService';",
      'const useAuthService = () => globalThis.__readinessAuth;',
    )
    .replace(
      "import { useAuthService } from '~/composables/useAuthService'",
      'const useAuthService = () => globalThis.__readinessAuth;',
    )
    .replace(
      "import { useApi } from './useApi';",
      'const useApi = () => globalThis.__readinessApi;',
    )
    .replace(
      "import { useApi } from '~/composables/useApi';",
      'const useApi = () => globalThis.__readinessApi;',
    );

  if (fileName === 'useReadingPosition.ts') {
    runnableSource = runnableSource.replace(
      "import { BIBLE_BOOKS, VISIBLE_VERSION_NAMES } from '~/composables/useBibleData';",
      `const BIBLE_BOOKS = { old: [{ id: 'gen', chapters: 50 }], new: [] };
const VISIBLE_VERSION_NAMES = { GAE: '개역개정' };`,
    );
  }

  const { code } = await transform(runnableSource, {
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
  });
  importSequence += 1;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return import(`${dataUrl}#${importSequence}`);
};

const createDeferredAuth = () => {
  let resolveInitialization;
  const initialization = new Promise(resolve => {
    resolveInitialization = resolve;
  });
  let initializationStarts = 0;
  const auth = {
    user: { value: null },
    isAuthenticated: { value: false },
    isInitialized: { value: false },
    isLoading: { value: true },
    initialize: () => {
      if (initializationStarts === 0) initializationStarts += 1;
      return initialization;
    },
  };

  return {
    auth,
    initializationStarts: () => initializationStarts,
    resolveAsAuthenticated: () => {
      auth.user.value = { id: 7 };
      auth.isAuthenticated.value = true;
      auth.isInitialized.value = true;
      auth.isLoading.value = false;
      resolveInitialization();
    },
  };
};

const getResponse = url => {
  if (url.endsWith('/bible/notes/')) {
    return { data: { results: [{ id: 1, book: 'gen', chapter: 1, content: 'note' }] } };
  }
  if (url.includes('/bible/notes/by-chapter/')) {
    return { data: { notes: [{ id: 1, book: 'gen', chapter: 1, content: 'note' }] } };
  }
  if (url.includes('/bible/notes/1/')) {
    return { data: { id: 1, book: 'gen', chapter: 1, content: 'note' } };
  }
  if (url.endsWith('/bible/bookmarks/')) {
    return { data: { results: [{ id: 2, book: 'gen', chapter: 1, bookmark_type: 'chapter' }] } };
  }
  if (url.includes('/bible/bookmarks/by-chapter/')) {
    return { data: { bookmarks: [{ id: 2, book: 'gen', chapter: 1, bookmark_type: 'chapter' }] } };
  }
  if (url.endsWith('/bible/highlights/')) {
    return { data: { results: [{ id: 3, book: 'gen', chapter: 1, start_verse: 1, end_verse: 1 }] } };
  }
  if (url.includes('/bible/highlights/by-chapter/')) {
    return { data: { highlights: [{ id: 3, book: 'gen', chapter: 1, start_verse: 1, end_verse: 1 }] } };
  }
  if (url.includes('/personal-records/by-book/')) {
    return { data: { success: true, read_chapters: [1] } };
  }
  if (url.includes('/reading-position/')) {
    return {
      data: {
        success: true,
        position: { book: 'gen', chapter: 1, scroll_position: 0.25, version: 'GAE' },
      },
    };
  }
  throw new Error(`Unexpected test URL: ${url}`);
};

const cases = [
  ['useNote.ts fetchNotes', 'useNote.ts', 'useNote', value => value.fetchNotes(), value => value.isNoteLoading],
  ['useNote.ts fetchChapterNotes', 'useNote.ts', 'useNote', value => value.fetchChapterNotes('gen', 1)],
  ['useNote.ts fetchNote', 'useNote.ts', 'useNote', value => value.fetchNote(1), value => value.isNoteLoading],
  ['useBookmark.ts loadBookmarks', 'useBookmark.ts', 'useBookmark', value => value.loadBookmarks('gen', 1), value => value.isBookmarkLoading],
  ['useBookmark.ts getAllBookmarks', 'useBookmark.ts', 'useBookmark', value => value.getAllBookmarks()],
  ['useHighlight.ts fetchHighlights', 'useHighlight.ts', 'useHighlight', value => value.fetchHighlights(), value => value.isHighlightLoading],
  ['useHighlight.ts fetchChapterHighlights', 'useHighlight.ts', 'useHighlight', value => value.fetchChapterHighlights('gen', 1)],
  ['usePersonalRecord.ts fetchReadChapters', 'usePersonalRecord.ts', 'usePersonalRecord', value => value.fetchReadChapters('gen'), value => value.isLoading],
  ['useReadingPosition.ts loadReadingPosition', 'useReadingPosition.ts', 'useReadingPosition', value => value.loadReadingPosition()],
];

for (const [name, fileName, factoryName, startRead, loadingRef] of cases) {
  test(`${name} waits for auth before settling initial data`, async () => {
    const deferredAuth = createDeferredAuth();
    const fetchCalls = [];
    const storage = new Map();
    if (fileName === 'useReadingPosition.ts') {
      storage.set('lastReadingPosition', JSON.stringify({
        book: 'gen',
        chapter: 1,
        scroll_position: 0.5,
        version: 'GAE',
      }));
    }

    globalThis.__readinessAuth = deferredAuth.auth;
    globalThis.__readinessApi = {
      GET: async url => {
        fetchCalls.push(url);
        return getResponse(url);
      },
      POST: async () => undefined,
      path: (template, parameters) =>
        template.replace(/\{(\w+)\}/g, (_, key) => String(parameters[key])),
    };
    globalThis.window = {};
    globalThis.document = { documentElement: { scrollHeight: 1000 } };
    globalThis.localStorage = {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
    };

    try {
      const module = await importComposable(fileName);
      const composable = module[factoryName]();
      let settled = false;

      const initialRead = startRead(composable).finally(() => {
        settled = true;
      });
      await Promise.resolve();

      assert.equal(settled, false, `${name} must not settle while auth is unresolved`);
      assert.equal(fetchCalls.length, 0, `${name} must not fetch before auth resolves`);
      if (loadingRef) {
        assert.equal(loadingRef(composable).value, true, `${name} keeps loading pending`);
      }
      if (fileName === 'useReadingPosition.ts') {
        assert.equal(
          composable.lastReadingPosition.value?.scroll_position,
          0.5,
          'local reading position remains available during auth restoration',
        );
      }

      deferredAuth.resolveAsAuthenticated();
      await initialRead;

      assert.equal(fetchCalls.length, 1, `${name} fetches after auth restoration`);
      assert.equal(deferredAuth.initializationStarts(), 1, `${name} starts auth once`);
    } finally {
      delete globalThis.__readinessAuth;
      delete globalThis.__readinessApi;
      delete globalThis.window;
      delete globalThis.document;
      delete globalThis.localStorage;
    }
  });
}
