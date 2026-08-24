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

test('hasena page ships an iframe-API-ready embed URL instead of rewriting iframe.src later', async () => {
  const hasenaSource = await readFile(
    new URL('../app/pages/hasena.vue', import.meta.url),
    'utf8',
  );

  // iframe.src 를 사후에 갈아끼우면 진행 중이던 YouTube 플레이어 로드가 취소되고
  // 임베드가 광고 서브프레임 네비게이션을 한 번 더 일으킨다. iOS WebView 에서는
  // 그 차단된 네비게이션이 전체화면 에러로 승격됐다(LAB-59).
  assert.doesNotMatch(
    hasenaSource,
    /iframe\.src\s*=/,
    'hasena page must not reassign iframe.src after mount',
  );
  assert.match(
    hasenaSource,
    /withJsApiEnabled\(buildHasenaEmbedUrl\(/,
    'the initial embed URL must already have enablejsapi enabled',
  );
});
