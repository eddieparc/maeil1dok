import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const { transform } = esbuild;
let importSequence = 0;

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

const readingPositionSource = await readFile(
  new URL('../app/composables/useReadingPosition.ts', import.meta.url),
  'utf8',
);
const personalRecordSource = await readFile(
  new URL('../app/composables/usePersonalRecord.ts', import.meta.url),
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
    scrollY: 0,
    scrollTo: () => {},
  };
  globalThis.document = {
    documentElement: {
      scrollHeight: 3000,
    },
  };
};

// Deterministic timer harness: debounced saves are scheduled through
// __testSchedule/__testClear so tests flush them explicitly (no sleeps).
const pendingTimers = new Map();
let timerSequence = 0;
globalThis.__testSchedule = (fn) => {
  timerSequence += 1;
  pendingTimers.set(timerSequence, fn);
  return timerSequence;
};
globalThis.__testClear = (id) => {
  pendingTimers.delete(id);
};
const flushScheduledSaves = async () => {
  const scheduled = [...pendingTimers.values()];
  pendingTimers.clear();
  for (const fn of scheduled) {
    await fn();
  }
};

const createCountingApi = (getResponse = () => ({ success: true, read_chapters: [1, 2] })) => {
  const calls = [];
  return {
    calls,
    GET: async (url, options) => {
      calls.push({ method: 'GET', url, params: options?.params });
      return { data: getResponse(url, options) };
    },
    POST: async (url, body) => {
      calls.push({ method: 'POST', url, body });
      return { data: { success: true } };
    },
  };
};

const setAuth = ({ authenticated = true, userId = 7 } = {}) => {
  if (!globalThis.__testAuth) {
    globalThis.__testAuth = {
      isAuthenticated: { value: false },
      isInitialized: { value: true },
      isLoading: { value: false },
      user: { value: null },
      initialize: async () => {},
    };
  }
  globalThis.__testAuth.isAuthenticated.value = authenticated;
  globalThis.__testAuth.user.value = authenticated ? { id: userId } : null;
};

const importReadingPositionModule = async () => {
  const runnableSource = readingPositionSource
    .replace(
      "import { ref, type Ref } from 'vue';",
      'const ref = value => ({ value });',
    )
    .replace(
      "import { useAuthService } from '~/composables/useAuthService';",
      'const useAuthService = () => globalThis.__testAuth;',
    )
    .replace(
      "import { BIBLE_BOOKS, VISIBLE_VERSION_NAMES } from '~/composables/useBibleData';",
      "const BIBLE_BOOKS = { old: [{ id: 'gen', chapters: 50 }, { id: 'exo', chapters: 40 }, { id: 'jnh', chapters: 4 }], new: [] };\nconst VISIBLE_VERSION_NAMES = { GAE: '개역개정', KNT: '새한글성경' };",
    )
    .replace(
      "import { useApi } from './useApi';",
      'const useApi = () => globalThis.__testApi;',
    )
    .replaceAll(
      'clearTimeout(savePositionTimeout)',
      '__testClear(savePositionTimeout)',
    )
    .replace(
      'setTimeout(doSave, 1500)',
      '__testSchedule(doSave)',
    );

  return importTypescriptSource(runnableSource);
};

const importPersonalRecordModule = async () => {
  const runnableSource = personalRecordSource
    .replace(
      "import { ref } from 'vue';",
      'const ref = value => ({ value });',
    )
    .replace(
      "import { useApi } from '~/composables/useApi';",
      'const useApi = () => globalThis.__testApi;',
    )
    .replace(
      "import { useAuthService } from '~/composables/useAuthService';",
      'const useAuthService = () => globalThis.__testAuth;',
    );

  return importTypescriptSource(runnableSource);
};

const positionPosts = (api) =>
  api.calls.filter(
    call => call.method === 'POST' && call.url === '/api/v1/todos/bible/reading-position/',
  );
const recordGets = (api) =>
  api.calls.filter(
    call => call.method === 'GET' && call.url === '/api/v1/todos/bible/personal-records/by-book/',
  );

test('immediate reading-position save skips a position already sent to the server', async () => {
  setupBrowserGlobals();
  setAuth();
  globalThis.__testApi = createCountingApi();

  const { useReadingPosition } = await importReadingPositionModule();
  const readingPosition = useReadingPosition();
  readingPosition.enableSaving();

  await readingPosition.saveReadingPosition('exo', 3, 'KNT', false, 0.42);
  await flushScheduledSaves();
  assert.equal(positionPosts(globalThis.__testApi).length, 1);

  // Unmount/beforeunload path: identical location + scroll must not POST again.
  await readingPosition.saveReadingPosition('exo', 3, 'KNT', true, 0.42);
  assert.equal(positionPosts(globalThis.__testApi).length, 1);
});

test('immediate reading-position save flushes a pending debounced save', async () => {
  setupBrowserGlobals();
  setAuth();
  globalThis.__testApi = createCountingApi();

  const { useReadingPosition } = await importReadingPositionModule();
  const readingPosition = useReadingPosition();
  readingPosition.enableSaving();

  await readingPosition.saveReadingPosition('exo', 3, 'KNT', false, 0.42);
  assert.equal(pendingTimers.size, 1);

  // The pending debounced save must not be dropped by the immediate dedupe:
  // the immediate save flushes it as exactly one POST.
  await readingPosition.saveReadingPosition('exo', 3, 'KNT', true, 0.42);
  assert.equal(pendingTimers.size, 0);
  assert.equal(positionPosts(globalThis.__testApi).length, 1);
});

test('an immediate save retries the same position after a failed server write', async () => {
  setupBrowserGlobals();
  setAuth();
  const api = createCountingApi();
  const post = api.POST;
  let attempts = 0;
  api.POST = async (...args) => {
    await post(...args);
    if (++attempts === 1) throw new Error('offline');
  };
  globalThis.__testApi = api;
  const { useReadingPosition } = await importReadingPositionModule();
  const position = useReadingPosition();
  await position.saveReadingPosition('exo', 3, 'KNT', true, 0.42);
  await position.saveReadingPosition('exo', 3, 'KNT', true, 0.42);
  assert.equal(positionPosts(api).length, 2);
});

test('the same local position is persisted after signing in or switching users', async () => {
  setupBrowserGlobals();
  setAuth({ authenticated: false });
  globalThis.__testApi = createCountingApi();
  const { useReadingPosition } = await importReadingPositionModule();
  const position = useReadingPosition();
  await position.saveReadingPosition('exo', 3, 'KNT', true, 0.42);
  setAuth({ userId: 7 });
  await position.saveReadingPosition('exo', 3, 'KNT', true, 0.42);
  setAuth({ userId: 8 });
  await position.saveReadingPosition('exo', 3, 'KNT', true, 0.42);
  assert.equal(positionPosts(globalThis.__testApi).length, 2);
});

test('clearing an in-flight book cache lets the new identity load independently', async () => {
  setAuth();
  const old = Promise.withResolvers();
  const calls = [];
  globalThis.__testApi = { GET: () => {
    calls.push(1);
    return calls.length === 1 ? old.promise : Promise.resolve({ data: { success: true, read_chapters: [9] } });
  } };
  const { usePersonalRecord } = await importPersonalRecordModule();
  const records = usePersonalRecord();
  const first = records.fetchReadChapters('exo');
  records.clearCache();
  setAuth({ userId: 8 });
  const second = records.fetchReadChapters('exo');
  try {
    assert.equal(calls.length, 2, 'new user must not wait for an old user request');
  } finally {
    old.resolve({ data: { success: true, read_chapters: [1] } });
    await Promise.all([first, second]);
  }
  assert.equal(records.isChapterRead('exo', 1), false);
  assert.equal(records.isChapterRead('exo', 9), true);
});

test('immediate reading-position save still posts a changed location', async () => {
  setupBrowserGlobals();
  setAuth();
  globalThis.__testApi = createCountingApi();

  const { useReadingPosition } = await importReadingPositionModule();
  const readingPosition = useReadingPosition();
  readingPosition.enableSaving();

  await readingPosition.saveReadingPosition('exo', 3, 'KNT', false, 0.42);
  await flushScheduledSaves();
  await readingPosition.saveReadingPosition('exo', 4, 'KNT', true, 0);

  assert.equal(positionPosts(globalThis.__testApi).length, 2);
  assert.deepEqual(positionPosts(globalThis.__testApi)[1].body, {
    book: 'exo',
    chapter: 4,
    scroll_position: 0,
    version: 'KNT',
  });
});

test('debounced same-location saves below the scroll delta stay deduped', async () => {
  setupBrowserGlobals();
  setAuth();
  globalThis.__testApi = createCountingApi();

  const { useReadingPosition } = await importReadingPositionModule();
  const readingPosition = useReadingPosition();
  readingPosition.enableSaving();

  await readingPosition.saveReadingPosition('exo', 3, 'KNT', false, 0.42);
  await flushScheduledSaves();
  await readingPosition.saveReadingPosition('exo', 3, 'KNT', false, 0.44);
  await flushScheduledSaves();

  assert.equal(positionPosts(globalThis.__testApi).length, 1);
});

test('fetchReadChapters reuses the fetched per-book record list', async () => {
  setAuth();
  globalThis.__testApi = createCountingApi();

  const { usePersonalRecord } = await importPersonalRecordModule();
  const records = usePersonalRecord();

  await records.fetchReadChapters('exo');
  await records.fetchReadChapters('exo');

  assert.equal(recordGets(globalThis.__testApi).length, 1);
  assert.equal(records.isChapterRead('exo', 2), true);
  assert.equal(records.isChapterRead('exo', 9), false);
});

test('fetchReadChapters joins an in-flight request for the same book', async () => {
  setAuth();
  globalThis.__testApi = createCountingApi();

  const { usePersonalRecord } = await importPersonalRecordModule();
  const records = usePersonalRecord();

  await Promise.all([
    records.fetchReadChapters('exo'),
    records.fetchReadChapters('exo'),
  ]);

  assert.equal(recordGets(globalThis.__testApi).length, 1);
});

test('markAsRead does not mark the book list as fully fetched', async () => {
  setAuth();
  globalThis.__testApi = createCountingApi(() => ({ success: true, read_chapters: [1, 2, 3] }));

  const { usePersonalRecord } = await importPersonalRecordModule();
  const records = usePersonalRecord();

  await records.markAsRead('exo', 3);
  await records.fetchReadChapters('exo');

  // The local markAsRead cache is incomplete; the server list must still load.
  assert.equal(recordGets(globalThis.__testApi).length, 1);
  assert.equal(records.isChapterRead('exo', 3), true);
});

test('clearCache forces a refetch and unauthenticated fetches stay silent', async () => {
  setAuth({ authenticated: false });
  globalThis.__testApi = createCountingApi();

  const { usePersonalRecord } = await importPersonalRecordModule();
  const records = usePersonalRecord();

  await records.fetchReadChapters('exo');
  assert.equal(recordGets(globalThis.__testApi).length, 0);

  setAuth({ userId: 7 });
  await records.fetchReadChapters('exo');
  records.clearCache();
  await records.fetchReadChapters('exo');
  assert.equal(recordGets(globalThis.__testApi).length, 2);
});
