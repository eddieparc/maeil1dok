import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
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
  return import(`${dataUrl}#${Date.now()}-${Math.random()}`);
};

const { fetchStandardContentWithCache } = await importTypescriptModule(
  '../app/composables/bible/bibleFetchClient.ts',
);

test('falls back to cache when the direct proxy fetch is slow', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  let cacheCalls = 0;

  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    calls.push(href);

    if (href === 'https://cache.test/api/v1/bible-cache/GAE/gen/1/') {
      cacheCalls += 1;
      if (cacheCalls === 1) {
        return new Response(JSON.stringify({
          success: false,
          error: 'cache warming',
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          content: '<p>Cached Bible content</p>',
          content_type: 'html',
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (href.startsWith('/bible-proxy/')) {
      return new Promise((resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        }, { once: true });
      });
    }

    throw new Error(`Unexpected fetch URL: ${href}`);
  };

  try {
    const startedAt = Date.now();
    const result = await fetchStandardContentWithCache(
      'https://cache.test',
      'GAE',
      'gen',
      1,
    );
    const elapsedMs = Date.now() - startedAt;

    assert.equal(result.source, 'cache');
    assert.equal(result.fromCache, true);
    assert.equal(result.content, '<p>Cached Bible content</p>');
    assert.ok(elapsedMs >= 3000, 'proxy timeout should drive the fallback');
    assert.ok(elapsedMs < 8000, 'slow proxy should not wait for the full backend timeout');
    assert.deepEqual(calls, [
      'https://cache.test/api/v1/bible-cache/GAE/gen/1/',
      '/bible-proxy/bible/korbibReadpage.php?version=GAE&book=gen&chap=1&cVersion=&fontSize=15px&fontWeight=normal',
      'https://cache.test/api/v1/bible-cache/GAE/gen/1/',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('preserves cache API from_cache metadata', async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    const href = String(url);

    if (href === 'https://cache.test/api/v1/bible-cache/GAE/gen/1/') {
      return new Response(JSON.stringify({
        success: true,
        data: {
          content: '<p>Freshly fetched through cache API</p>',
          content_type: 'html',
          from_cache: false,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unexpected fetch URL: ${href}`);
  };

  try {
    const result = await fetchStandardContentWithCache(
      'https://cache.test',
      'GAE',
      'gen',
      1,
    );

    assert.equal(result.source, 'cache');
    assert.equal(result.fromCache, false);
    assert.equal(result.content, '<p>Freshly fetched through cache API</p>');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('uses cached Bible content before touching the direct proxy', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url) => {
    const href = String(url);
    calls.push(href);

    if (href === 'https://cache.test/api/v1/bible-cache/GAE/gen/1/') {
      return new Response(JSON.stringify({
        success: true,
        data: {
          content: '<p>Cached Bible content</p>',
          content_type: 'html',
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unexpected fetch URL: ${href}`);
  };

  try {
    const startedAt = Date.now();
    const result = await fetchStandardContentWithCache(
      'https://cache.test',
      'GAE',
      'gen',
      1,
    );
    const elapsedMs = Date.now() - startedAt;

    assert.equal(result.source, 'cache');
    assert.equal(result.fromCache, true);
    assert.equal(result.content, '<p>Cached Bible content</p>');
    assert.ok(elapsedMs < 500, 'cache hit should not wait for proxy timeout');
    assert.deepEqual(calls, [
      'https://cache.test/api/v1/bible-cache/GAE/gen/1/',
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
