import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const { transform } = esbuild;

const apiSource = await readFile(
  new URL('../app/composables/useApi.ts', import.meta.url),
  'utf8',
);

// Load useApi with controllable stubs for its Nuxt-only imports so the
// 401-refresh-and-retry path can be exercised in isolation. The auth service
// stub is resolved through a global hook set per-test.
const importApiModule = async () => {
  const runnableSource = apiSource
    .replace(
      "import { useRuntimeConfig } from '#app'",
      "const useRuntimeConfig = () => ({ public: { apiBase: 'http://api.test' }, internalApiBase: '' });",
    )
    .replace(
      "import { useAuthService } from '~/composables/useAuthService'",
      'const useAuthService = () => globalThis.__authServiceStub;',
    );

  const { code } = await transform(runnableSource, {
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return import(`${dataUrl}#${Date.now()}-${Math.random()}`);
};

const makeResponse = ({ status, body = {}, csrf = null }) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: (name) => (name === 'X-CSRFToken' ? csrf : null) },
  json: async () => body,
  clone: () => makeResponse({ status, body, csrf }),
});

// Installs window/localStorage/fetch stubs, records every fetch invocation with
// a snapshot of the headers as they existed at call time (headers are mutated in
// place across the retry), and restores globals afterwards.
const withEnvironment = async ({ storedCsrf, onRefresh, responses }, run) => {
  const saved = {};
  for (const key of ['window', 'document', 'localStorage', 'fetch']) {
    saved[key] = Object.getOwnPropertyDescriptor(globalThis, key);
  }

  const store = new Map();
  if (storedCsrf !== undefined) store.set('csrfToken', storedCsrf);
  const localStorageStub = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };

  globalThis.window = {};
  globalThis.document = { cookie: '' };
  globalThis.localStorage = localStorageStub;

  const calls = [];
  const queue = [...responses];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method, headers: { ...(options.headers || {}) } });
    return queue.shift();
  };

  globalThis.__authServiceStub = {
    isAuthenticated: { value: true },
    refreshToken: async () => {
      if (onRefresh) onRefresh(store);
      return true;
    },
    logout: () => {},
  };

  try {
    return await run({ calls, store });
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key]) Object.defineProperty(globalThis, key, saved[key]);
      else delete globalThis[key];
    }
    delete globalThis.__authServiceStub;
  }
};

test('multipart upload retry after 401 refresh does NOT re-add a JSON Content-Type', async () => {
  const { useApi } = await importApiModule();

  await withEnvironment(
    {
      storedCsrf: 'csrf-old',
      onRefresh: (store) => store.set('csrfToken', 'csrf-new'),
      responses: [
        makeResponse({ status: 401 }),
        makeResponse({ status: 200, body: { success: true } }),
      ],
    },
    async ({ calls }) => {
      const api = useApi();
      const form = new FormData();
      form.append('file', 'x');

      const result = await api.upload('/api/v1/todos/schedules/excel/', form);
      assert.deepEqual(result, { success: true });

      assert.equal(calls.length, 2, 'expected an initial call and one retry');
      const retry = calls[1];
      // The fix: retry must preserve the FormData-safe absence of Content-Type
      // so the browser keeps the multipart boundary. A regression re-adds
      // application/json and corrupts the upload.
      assert.equal(
        'Content-Type' in retry.headers,
        false,
        'retry must not inject Content-Type for a multipart upload',
      );
      // The refreshed CSRF token must still ride along on the retry.
      assert.equal(retry.headers['X-CSRFToken'], 'csrf-new');
    },
  );
});

test('JSON POST retry after 401 refresh preserves Content-Type and uses the refreshed CSRF token', async () => {
  const { useApi } = await importApiModule();

  await withEnvironment(
    {
      storedCsrf: 'csrf-old',
      onRefresh: (store) => store.set('csrfToken', 'csrf-new'),
      responses: [
        makeResponse({ status: 401 }),
        makeResponse({ status: 200, body: { ok: true } }),
      ],
    },
    async ({ calls }) => {
      const api = useApi();

      const result = await api.post('/api/v1/todos/hasena/record/update/', { is_completed: true });
      assert.deepEqual(result, { ok: true });

      assert.equal(calls.length, 2, 'expected an initial call and one retry');
      const first = calls[0];
      const retry = calls[1];
      assert.equal(first.headers['Content-Type'], 'application/json');
      assert.equal(retry.headers['Content-Type'], 'application/json', 'JSON retry keeps its Content-Type');
      assert.equal(retry.headers['X-CSRFToken'], 'csrf-new', 'JSON retry rides the refreshed CSRF token');
    },
  );
});

test('successful JSON POST without a 401 sends exactly one request', async () => {
  const { useApi } = await importApiModule();

  await withEnvironment(
    {
      storedCsrf: 'csrf-old',
      responses: [makeResponse({ status: 200, body: { ok: true } })],
    },
    async ({ calls }) => {
      const api = useApi();
      const result = await api.post('/api/v1/todos/hasena/record/update/', { is_completed: false });
      assert.deepEqual(result, { ok: true });
      assert.equal(calls.length, 1, 'no retry should happen on a 200 response');
    },
  );
});
