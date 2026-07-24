import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const { transform } = esbuild;

const apiSource = await readFile(
  new URL('../app/composables/useApi.ts', import.meta.url),
  'utf8',
);

// Load useApi with controllable stubs for its Nuxt-only imports.
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

// A faithful stand-in for a real fetch Response to a 204 No Content reply:
// the body is empty, so json() rejects with a SyntaxError exactly like the
// browser/undici implementations do ("Unexpected end of JSON input").
const makeEmptyResponse = (status) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: () => null },
  json: async () => {
    throw new SyntaxError('Unexpected end of JSON input');
  },
  clone() {
    return makeEmptyResponse(status);
  },
});

const makeJsonResponse = ({ status, body }) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: () => null },
  json: async () => body,
  clone() {
    return makeJsonResponse({ status, body });
  },
});

const withEnvironment = async ({ responses }, run) => {
  const saved = {};
  for (const key of ['window', 'document', 'localStorage', 'fetch']) {
    saved[key] = Object.getOwnPropertyDescriptor(globalThis, key);
  }

  const store = new Map();
  globalThis.window = {};
  globalThis.document = { cookie: '' };
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };

  const queue = [...responses];
  globalThis.fetch = async () => queue.shift();

  globalThis.__authServiceStub = {
    isAuthenticated: { value: true },
    refreshToken: async () => true,
    logout: () => {},
  };

  try {
    return await run();
  } finally {
    for (const key of Object.keys(saved)) {
      if (saved[key]) Object.defineProperty(globalThis, key, saved[key]);
      else delete globalThis[key];
    }
    delete globalThis.__authServiceStub;
  }
};

test('DELETE returning 204 No Content resolves to null instead of throwing', async () => {
  const { useApi } = await importApiModule();

  await withEnvironment({ responses: [makeEmptyResponse(204)] }, async () => {
    const api = useApi();
    // Regression: the old code called response.json() unconditionally, so a
    // 204 (which every DELETE endpoint returns) threw SyntaxError and every
    // successful deletion looked like a failure to the caller.
    const result = await api.delete('/api/v1/todos/bible/bookmarks/1/');
    assert.equal(result, null);
  });
});

test('PATCH returning 204 No Content resolves to null instead of throwing', async () => {
  const { useApi } = await importApiModule();

  await withEnvironment({ responses: [makeEmptyResponse(204)] }, async () => {
    const api = useApi();
    const result = await api.patch('/api/v1/todos/calendar/settings/1/', { x: 1 });
    assert.equal(result, null);
  });
});

test('DELETE returning a JSON body still parses it', async () => {
  const { useApi } = await importApiModule();

  await withEnvironment(
    { responses: [makeJsonResponse({ status: 200, body: { detail: 'ok' } })] },
    async () => {
      const api = useApi();
      const result = await api.delete('/api/v1/accounts/unfollow/7/');
      assert.deepEqual(result, { detail: 'ok' });
    },
  );
});

test('POST returning 200 with a body is unaffected by the empty-body guard', async () => {
  const { useApi } = await importApiModule();

  await withEnvironment(
    { responses: [makeJsonResponse({ status: 200, body: { ok: true } })] },
    async () => {
      const api = useApi();
      const result = await api.post('/api/v1/todos/hasena/record/update/', { is_completed: true });
      assert.deepEqual(result, { ok: true });
    },
  );
});
