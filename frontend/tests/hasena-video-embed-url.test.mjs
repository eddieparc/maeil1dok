import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  HASENA_PLAYLIST_ID,
  buildHasenaEmbedUrl,
  withJsApiEnabled,
} from '../app/utils/hasenaVideoUrl.js';

const VIDEO_ID = 'A83cdGOhMdt';

test('builds a single-video embed URL whose video id stays in the path', () => {
  const url = new URL(buildHasenaEmbedUrl(VIDEO_ID));

  assert.equal(url.origin, 'https://www.youtube.com');
  assert.equal(url.pathname, `/embed/${VIDEO_ID}`);
  assert.equal(url.searchParams.get('list'), null);
});

test('keeps the video id parseable after the YouTube iframe API upgrade', () => {
  const upgraded = new URL(withJsApiEnabled(buildHasenaEmbedUrl(VIDEO_ID)));

  assert.equal(
    upgraded.pathname,
    `/embed/${VIDEO_ID}`,
    'enablejsapi must be a query parameter, never glued onto the video id path segment',
  );
  assert.equal(upgraded.searchParams.get('enablejsapi'), '1');
  assert.doesNotMatch(
    upgraded.pathname,
    /[&?=]/,
    'the embed path must never contain query syntax',
  );
});

test('keeps the playlist fallback embed valid after the API upgrade', () => {
  const upgraded = new URL(withJsApiEnabled(buildHasenaEmbedUrl('')));

  assert.equal(upgraded.pathname, '/embed/videoseries');
  assert.equal(upgraded.searchParams.get('list'), HASENA_PLAYLIST_ID);
  assert.equal(upgraded.searchParams.get('enablejsapi'), '1');
});

test('upgrading an already-enabled URL does not duplicate the parameter', () => {
  const once = withJsApiEnabled(buildHasenaEmbedUrl(VIDEO_ID));
  const twice = new URL(withJsApiEnabled(once));

  assert.deepEqual(twice.searchParams.getAll('enablejsapi'), ['1']);
});

test('hasena page derives both embed sources from the shared URL builder', async () => {
  const hasenaSource = await readFile(
    new URL('../app/pages/hasena.vue', import.meta.url),
    'utf8',
  );

  assert.doesNotMatch(
    hasenaSource,
    /currentSrc\s*\+\s*['"]&enablejsapi=1['"]/,
    'hasena page must not concatenate enablejsapi onto a query-less embed URL',
  );
  assert.match(hasenaSource, /buildHasenaEmbedUrl\(/);
  assert.match(hasenaSource, /withJsApiEnabled\(/);
});
