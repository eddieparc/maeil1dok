import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const readerSource = await readFile(
  new URL('../app/components/bible/BibleReaderView.vue', import.meta.url),
  'utf8',
);

const viewerSource = await readFile(
  new URL('../app/components/bible/BibleViewer.vue', import.meta.url),
  'utf8',
);

const extractFloatingBottomAboveBlock = (source) => {
  const floatingStart = source.indexOf('<FloatingBottomBar>');
  assert.notEqual(floatingStart, -1, 'reader should render FloatingBottomBar');
  const centerStart = source.indexOf('<template #center>', floatingStart);
  assert.notEqual(centerStart, -1, 'reader should keep FloatingBottomBar center slot');
  const aboveBlock = source.slice(floatingStart, centerStart);
  assert.match(aboveBlock, /<template\s+#above>/, 'reader should render FloatingBottomBar #above slot');
  return aboveBlock;
};

const floatingAboveBlock = extractFloatingBottomAboveBlock(readerSource);

test('places selection actions in the floating bottom bar above slot', () => {
  assert.match(
    floatingAboveBlock,
    /data-testid="selection-action-menu"/,
    'selection actions should render inside FloatingBottomBar #above',
  );
  assert.match(
    readerSource,
    /@selection-menu-change="selectionMenuState = \$event"/,
    'reader should receive viewer selection state before rendering bottom controls',
  );
  assert.match(
    viewerSource,
    /'selection-menu-change': \[state: SelectionMenuState\]/,
    'viewer should expose selection action state through an event',
  );
});

test('keeps copy menu in the floating bottom bar above slot', () => {
  assert.match(
    floatingAboveBlock,
    /data-testid="selection-copy-menu"/,
    'copy options should render inside FloatingBottomBar #above',
  );
  assert.match(
    readerSource,
    /handleSelectionCopyWithFormat\('includeLocation'\)[\s\S]*handleSelectionCopyWithFormat\('numOnly'\)[\s\S]*handleSelectionCopyWithFormat\('textOnly'\)/,
    'single-verse copy options should preserve existing copy formats',
  );
  assert.match(
    viewerSource,
    /handleClickCopy,[\s\S]*clearClickSelection,/,
    'viewer should expose copy menu actions for the bottom bar controls',
  );
});

test('does not teleport selection menus to body coordinates', () => {
  assert.doesNotMatch(
    viewerSource,
    /<Teleport\s+to="body">[\s\S]*verse-action-menu/,
    'selection action menu should not be teleported to body',
  );
  assert.doesNotMatch(
    viewerSource,
    /<Teleport\s+to="body">[\s\S]*copy-menu/,
    'selection copy menu should not be teleported to body',
  );
  assert.doesNotMatch(
    viewerSource,
    /actionMenuPosition|copyMenuPosition|positionActionMenu|positionCopyMenu/,
    'selection menus should not depend on fixed top/left coordinate calculations',
  );
  assert.doesNotMatch(
    readerSource,
    /\.selection-floating-stack\s*\{[^}]*position:\s*fixed;/s,
    'selection menus should stack inside FloatingBottomBar #above instead of using a replacement fixed-bottom layer',
  );
});

test('preserves adjacent bottom bar and event wiring', () => {
  assert.match(floatingAboveBlock, /<TongdokAudioPlayer/, 'tongdok audio should remain in #above');
  assert.match(floatingAboveBlock, /class="tongdok-progress-area"/, 'tongdok progress should remain in #above');
  assert.match(
    readerSource,
    /<template\s+#center>[\s\S]*aria-label="이전 장"[\s\S]*class="chapter-info"[\s\S]*aria-label="다음 장"/,
    'bottom navigation center controls should remain in #center',
  );
  for (const eventName of ['highlight', 'highlight-delete', 'copy', 'share']) {
    assert.ok(
      readerSource.includes(`@${eventName}="$emit('${eventName}'`),
      `reader should keep forwarding ${eventName}`,
    );
  }
});
