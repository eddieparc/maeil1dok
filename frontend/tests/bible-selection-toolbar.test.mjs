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

const selectionControlsSource = await readFile(
  new URL('../app/components/bible/SelectionFloatingControls.vue', import.meta.url),
  'utf8',
);

const floatingBottomBarSource = await readFile(
  new URL('../app/components/common/FloatingBottomBar.vue', import.meta.url),
  'utf8',
);

const biblePageSource = await readFile(
  new URL('../app/pages/bible/index.vue', import.meta.url),
  'utf8',
);

const biblePageStateSource = await readFile(
  new URL('../app/composables/bible/useBiblePageState.ts', import.meta.url),
  'utf8',
);

const extractFloatingBottomBlock = (source) => {
  const floatingStart = source.indexOf('<FloatingBottomBar>');
  assert.notEqual(floatingStart, -1, 'reader should render FloatingBottomBar');
  const centerStart = source.indexOf('<template #center>', floatingStart);
  assert.notEqual(centerStart, -1, 'reader should keep FloatingBottomBar center slot');
  const bottomBlock = source.slice(floatingStart, centerStart);
  assert.match(bottomBlock, /<template\s+#above>/, 'reader should render FloatingBottomBar #above slot');
  return bottomBlock;
};

const floatingBeforeCenterBlock = extractFloatingBottomBlock(readerSource);

test('renders selection actions in the anchored popover layer above the bottom bar', () => {
  assert.match(
    floatingBeforeCenterBlock,
    /<template\s+#popover>[\s\S]*<SelectionFloatingControls/,
    'selection actions should render through FloatingBottomBar #popover',
  );
  assert.match(
    floatingBottomBarSource,
    /class="floating-above-popover"/,
    'FloatingBottomBar should expose a dedicated popover layer above the navigation',
  );
  assert.match(
    floatingBottomBarSource,
    /<slot\s+name="popover"\s*\/>/,
    'FloatingBottomBar should expose a popover slot for controls that should not expand the bar',
  );
  assert.match(
    floatingBottomBarSource,
    /\.floating-above-popover\s*\{[\s\S]*position:\s*absolute;[\s\S]*bottom:\s*calc\(100% \+ 0\.75rem\);/s,
    'popover slot should be absolutely positioned above the bar so it does not expand the bar height',
  );
  assert.match(
    floatingBottomBarSource,
    /\.floating-bottom-navigation\s*\{[\s\S]*pointer-events:\s*auto;/s,
    'bottom navigation should remain the compact interactive anchor under the popover',
  );
  assert.match(
    selectionControlsSource,
    /data-testid="selection-action-menu"/,
    'selection controls should expose a stable action menu test id',
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

test('keeps copy menu in the anchored popover layer above the bottom bar', () => {
  assert.match(
    floatingBeforeCenterBlock,
    /<template\s+#popover>[\s\S]*<SelectionFloatingControls/,
    'copy options should render through FloatingBottomBar #popover',
  );
  assert.match(
    selectionControlsSource,
    /'includeLocation'[\s\S]*'numOnly'[\s\S]*'textOnly'/,
    'single-verse copy options should preserve existing copy formats',
  );
  assert.match(
    selectionControlsSource,
    /data-testid="selection-copy-menu"/,
    'selection controls should expose a stable copy menu test id',
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
    `${readerSource}\n${selectionControlsSource}`,
    /\.selection-floating-stack\s*\{[^}]*position:\s*fixed;/s,
    'selection menus should rely on the shared bottom bar popover instead of using a replacement fixed-bottom layer',
  );
});

test('preserves adjacent bottom bar and event wiring', () => {
  assert.match(floatingBeforeCenterBlock, /<template\s+#above>[\s\S]*<TongdokAudioPlayer/, 'tongdok audio should remain in #above');
  assert.match(floatingBeforeCenterBlock, /<template\s+#above>[\s\S]*class="tongdok-progress-area"/, 'tongdok progress should remain in #above');
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

test('shares the Maeil1Dok Bible URL from the floating selection UI', () => {
  assert.match(
    viewerSource,
    /emit\('share',\s*\{[\s\S]*text:\s*selectedText\.value,[\s\S]*startVerse,[\s\S]*endVerse,[\s\S]*\}\);/,
    'floating share should send the selected verse range to the page-level URL share handler',
  );
  assert.doesNotMatch(
    viewerSource,
    /const handleShare = async \(\) => \{[\s\S]*navigator\.share/s,
    'BibleViewer should not directly share selected verse text from the floating UI',
  );
  assert.match(
    biblePageSource,
    /const shareUrl = generateShareUrl\(verseRange\);[\s\S]*url: shareUrl/s,
    'page-level share should include the generated Maeil1Dok Bible URL for the selected verse range',
  );
  assert.match(
    biblePageStateSource,
    /params\.set\('verse',\s*formatVerseRangeParam\(verseRange\)\);/,
    'generated share URLs should include the selected verse or verse range query',
  );
  assert.doesNotMatch(
    biblePageSource,
    /text:\s*text\s*\|\|/,
    'page-level share should not use selected verse text as the shared payload body',
  );
});

test('opens verse-range share URLs with focused verses', () => {
  assert.match(
    biblePageStateSource,
    /export const parseVerseRangeParam = \([\s\S]*rawValue\.match\(\/\^\(\\d\+\)\(\?:-\(\\d\+\)\)\?\$\/\);/,
    'page state should parse single-verse and verse-range query values',
  );
  assert.match(
    biblePageSource,
    /pendingVerseFocus\.value = parseVerseRangeParam\(route\.query\.verse\);/,
    'Bible page should capture verse range query values on entry',
  );
  assert.match(
    biblePageSource,
    /bibleReaderViewRef\.value\?\.focusVerseRange\(verseRange\.start,\s*verseRange\.end\);/,
    'Bible page should focus the requested verse range after loading content',
  );
  assert.match(
    biblePageSource,
    /newQuery\.book \|\| newQuery\.chapter \|\| newQuery\.verse/,
    'route watcher should react to verse-only share URL changes',
  );
  assert.match(
    readerSource,
    /focusVerseRange:\s*\(startVerse:\s*number,\s*endVerse:\s*number\) => \{[\s\S]*bibleViewerRef\.value\?\.focusVerseRange\(startVerse,\s*endVerse\);[\s\S]*\}/,
    'reader should expose verse-range focus to the page',
  );
  assert.match(
    viewerSource,
    /const focusVerseRange = \(startVerse: number, endVerse: number\) => \{[\s\S]*highlightVerses\(startVerse,\s*endVerse\);[\s\S]*scrollToVerse\(startVerse\);[\s\S]*\};/,
    'viewer should highlight the requested range and scroll to its first verse',
  );
});
