import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const playerSource = await readFile(
  new URL('../app/components/bible/TongdokAudioPlayer.vue', import.meta.url),
  'utf8',
);

test('renders a floating playback speed control for embedded tongdok audio', () => {
  assert.match(
    playerSource,
    /data-testid="tongdok-audio-speed-control"/,
    'audio player should expose a stable floating speed control',
  );
  assert.match(
    playerSource,
    /class="player-speed-floating"/,
    'speed control should render as part of the bottom audio control row',
  );
  assert.match(
    playerSource,
    /<div v-if="videoId" class="youtube-progress-row">[\s\S]*data-testid="tongdok-audio-speed-control"[\s\S]*<button class="player-close"/,
    'speed control should sit inside the bottom audio control row before the close button',
  );
  assert.doesNotMatch(
    playerSource,
    /\.player-speed-floating\s*\{[^}]*bottom:\s*calc\(100%/s,
    'speed trigger should not float above the bottom panel over scripture text',
  );
  assert.match(
    playerSource,
    /:deep\(iframe\[src\*="youtube"\]\)/,
    'rewritten YouTube iframes should remain visually hidden inside the audio host',
  );
});

test('applies selected playback rates through the YouTube player API', () => {
  assert.match(
    playerSource,
    /setPlaybackRate:\s*\(rate:\s*number\)\s*=>\s*void/,
    'typed YouTube player contract should include playback speed control',
  );
  assert.match(
    playerSource,
    /PLAYBACK_RATES\s*=\s*\[[^\]]*0\.75[^\]]*1[^\]]*1\.25[^\]]*1\.5[^\]]*2[^\]]*\]\s*as const/s,
    'speed menu should offer the expected reading-friendly playback rates',
  );
  assert.match(
    playerSource,
    /activePlayer\.setPlaybackRate\(rate\)/,
    'selecting a speed should update the embedded player playback rate',
  );
});
