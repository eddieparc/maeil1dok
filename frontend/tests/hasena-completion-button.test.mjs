import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const hasenaSource = await readFile(
  new URL('../app/pages/hasena.vue', import.meta.url),
  'utf8',
);

test('renders Hasena completion as an inline action after scripture content', () => {
  assert.doesNotMatch(
    hasenaSource,
    /hasena-complete-floating-scrim/,
    'Hasena completion should not add an opaque bottom backdrop',
  );
  assert.match(
    hasenaSource,
    /<div class="inline-complete-action[\s\S]*class="hasena-complete-floating-btn"[\s\S]*@click="handleComplete"[\s\S]*{{ buttonText }}/,
    'Hasena completion should render inline after the scripture card',
  );
  assert.doesNotMatch(
    hasenaSource,
    /<FloatingBottomBar>|hasena-status-info/,
    'Hasena page should not use a fixed bottom bar that can overlap scripture text',
  );
});
