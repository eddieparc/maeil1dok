import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const bibleFetchSource = await readFile(
  new URL('../app/composables/useBibleFetch.ts', import.meta.url),
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
  const body = extractFunctionBody(bibleFetchSource, 'fetchStandardContent');

  assert.ok(
    body.indexOf("fetchFromCacheServer(version, book, chapter)") <
      body.indexOf('fetchStandardFromProxy(version, book, chapter)'),
  );
});

test('KNT Bible fetch checks the cache server before the no-store proxy', () => {
  const body = extractFunctionBody(bibleFetchSource, 'fetchKntContent');

  assert.ok(
    body.indexOf("fetchFromCacheServer('KNT', book, chapter)") <
      body.indexOf('fetchKntFromProxy(book, chapter)'),
  );
});
