import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const hasenaSource = await readFile(
  new URL('../app/pages/hasena.vue', import.meta.url),
  'utf8',
);

test('keeps beta tooltip above the summary card without clipping', () => {
  assert.match(
    hasenaSource,
    /\.summary-card\s*\{[^}]*overflow:\s*visible;/s,
    'summary card should allow the beta tooltip to escape its rounded card bounds',
  );
  assert.match(
    hasenaSource,
    /\.beta-tooltip-container\s*\{[^}]*z-index:\s*60;/s,
    'beta tooltip container should stack above adjacent card content',
  );
});
