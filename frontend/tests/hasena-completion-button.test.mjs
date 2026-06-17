import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const hasenaSource = await readFile(
  new URL('../app/pages/hasena.vue', import.meta.url),
  'utf8',
);

const floatingStart = hasenaSource.indexOf('<FloatingBottomBar>');
assert.notEqual(floatingStart, -1, 'hasena page should render FloatingBottomBar');

const centerStart = hasenaSource.indexOf('<template #center>', floatingStart);
assert.notEqual(centerStart, -1, 'hasena bottom bar should keep a center slot');

const centerEnd = hasenaSource.indexOf('</template>', centerStart);
assert.notEqual(centerEnd, -1, 'hasena bottom bar center slot should close');

const beforeCenterBlock = hasenaSource.slice(floatingStart, centerStart);
const centerSlotBlock = hasenaSource.slice(centerStart, centerEnd);

test('renders Hasena completion as a standalone button above the bottom bar', () => {
  assert.doesNotMatch(
    hasenaSource,
    /hasena-complete-floating-scrim/,
    'Hasena completion should not add an opaque bottom backdrop behind the separated action',
  );
  assert.match(
    beforeCenterBlock,
    /<template\s+#popover>[\s\S]*class="hasena-complete-floating-btn"[\s\S]*@click="handleComplete"[\s\S]*{{ buttonText }}/,
    'Hasena completion should render in the FloatingBottomBar popover above the bar',
  );
  assert.doesNotMatch(
    centerSlotBlock,
    /@click="handleComplete"|hasena-complete-info/,
    'bottom bar center should not own the Hasena completion action',
  );
  assert.match(
    centerSlotBlock,
    /hasena-status-info/,
    'bottom bar center should remain an informational date/title label',
  );
});
