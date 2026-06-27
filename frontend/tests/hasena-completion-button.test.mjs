import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const hasenaSource = await readFile(
  new URL('../app/pages/hasena.vue', import.meta.url),
  'utf8',
);

const actionStart = hasenaSource.indexOf('<div class="inline-complete-action');
assert.notEqual(actionStart, -1, 'hasena page should render an inline completion action');

const actionEnd = hasenaSource.indexOf('</div>', actionStart);
assert.notEqual(actionEnd, -1, 'hasena inline completion action should close');

const actionBlock = hasenaSource.slice(actionStart, actionEnd);

test('renders Hasena completion as a standalone inline button above the progress stats', () => {
  assert.doesNotMatch(
    hasenaSource,
    /hasena-complete-floating-scrim/,
    'Hasena completion should not add an opaque bottom backdrop behind the separated action',
  );
  assert.doesNotMatch(
    hasenaSource,
    /<FloatingBottomBar>/,
    'Hasena completion should not depend on the global bottom bar layout',
  );
  assert.match(
    actionBlock,
    /class="hasena-complete-floating-btn"[\s\S]*@click="handleComplete"[\s\S]*{{ buttonText }}/,
    'Hasena completion should render as the primary inline action',
  );
  assert.match(
    hasenaSource,
    /inline-complete-action[\s\S]*streak-card/,
    'Hasena completion should appear before streak statistics',
  );
});
