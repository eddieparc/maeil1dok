import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import esbuild from 'esbuild';

const { transform } = esbuild;
const source = await readFile(
  new URL('../app/composables/bible/bibleFetchClient.ts', import.meta.url),
  'utf8',
);
const { code } = await transform(source, {
  format: 'esm',
  loader: 'ts',
  sourcemap: false,
});
const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const {
  fetchKntContentWithCache,
  fetchStandardContentWithCache,
} = await import(dataUrl);

const cacheResponse = (contentType, content) => ({
  ok: true,
  json: async () => ({
    success: true,
    data: {
      content,
      content_type: contentType,
      from_cache: true,
    },
  }),
});

const withFetchMock = async (mock, callback) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

test('standard Bible fetch checks the cache server before the no-store proxy', async () => {
  const calls = [];

  const result = await withFetchMock(async (url) => {
    calls.push(String(url));
    if (String(url).startsWith('https://cache.test/')) {
      return cacheResponse('html', '<p>cached standard content</p>');
    }
    throw new Error(`proxy should not run before a successful cache read: ${url}`);
  }, () => fetchStandardContentWithCache('https://cache.test', 'GAE', 'gen', 1));

  assert.deepEqual(calls, [
    'https://cache.test/api/v1/bible-cache/GAE/gen/1/',
  ]);
  assert.deepEqual(result, {
    content: '<p>cached standard content</p>',
    contentType: 'html',
    fromCache: true,
    source: 'cache',
  });
});

test('KNT Bible fetch checks the cache server before the no-store proxy', async () => {
  const calls = [];

  const result = await withFetchMock(async (url) => {
    calls.push(String(url));
    if (String(url).startsWith('https://cache.test/')) {
      return cacheResponse('json', '{"cached":true}');
    }
    throw new Error(`proxy should not run before a successful cache read: ${url}`);
  }, () => fetchKntContentWithCache('https://cache.test', 'jhn', 3));

  assert.deepEqual(calls, [
    'https://cache.test/api/v1/bible-cache/KNT/jhn/3/',
  ]);
  assert.deepEqual(result, {
    content: '{"cached":true}',
    contentType: 'json',
    fromCache: true,
    source: 'cache',
  });
});
