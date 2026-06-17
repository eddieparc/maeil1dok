import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const bibleFetchWrapperSource = await readFile(
  new URL('../app/composables/useBibleFetch.ts', import.meta.url),
  'utf8',
);

const bibleFetchClientSource = await readFile(
  new URL('../app/composables/bible/bibleFetchClient.ts', import.meta.url),
  'utf8',
);

const extractFunctionBody = (source, functionName) => {
  const declaration = `async function ${functionName}`;
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

test('standard Bible fetch checks the cache server before the no-store proxy', () => {
  assert.match(
    bibleFetchWrapperSource,
    /fetchStandardContentWithCache\(bibleCacheUrl,\s*version,\s*book,\s*chapter\)/,
  );

  const body = extractFunctionBody(bibleFetchClientSource, 'fetchWithCacheFallback');

  assert.ok(
    body.indexOf('fetchFromCacheServer(') <
      body.indexOf('options.proxyFetch()'),
  );
});

test('KNT Bible fetch checks the cache server before the no-store proxy', () => {
  assert.match(
    bibleFetchWrapperSource,
    /fetchKntContentWithCache\(bibleCacheUrl,\s*book,\s*chapter\)/,
  );

  const body = extractFunctionBody(bibleFetchClientSource, 'fetchWithCacheFallback');

  assert.ok(
    body.indexOf('fetchFromCacheServer(') <
      body.indexOf('options.proxyFetch()'),
  );
});
