import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildHasenaYoutubeEmbedUrl,
  buildHasenaYoutubeWatchUrl,
  HASENA_PLAYLIST_ID,
} from '../app/utils/hasenaYoutube.js';

test('builds a valid Hasena video embed URL with query parameters after ?', () => {
  const url = buildHasenaYoutubeEmbedUrl('_npuPXwLUbE');

  assert.equal(url, 'https://www.youtube.com/embed/_npuPXwLUbE?enablejsapi=1&rel=0&playsinline=1');
  assert.doesNotMatch(url, /embed\/[^?]+&enablejsapi=/);
});

test('builds a valid Hasena playlist embed URL when no video is selected', () => {
  const url = buildHasenaYoutubeEmbedUrl('');

  assert.equal(
    url,
    `https://www.youtube.com/embed/videoseries?list=${HASENA_PLAYLIST_ID}&rel=0&playsinline=1`,
  );
});

test('builds a valid YouTube watch URL for fallback navigation', () => {
  assert.equal(
    buildHasenaYoutubeWatchUrl('_npuPXwLUbE'),
    'https://www.youtube.com/watch?v=_npuPXwLUbE',
  );
});
