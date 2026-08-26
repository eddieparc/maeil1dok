import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compileTemplate, parse } from '@vue/compiler-sfc';
import { renderToString } from '@vue/server-renderer';
import * as Vue from 'vue';
import { createSSRApp, defineComponent, h } from 'vue';
import esbuild from 'esbuild';

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
const importTypescriptModule = async (path) => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const { code } = await esbuild.transform(source, {
    format: 'esm',
    loader: 'ts',
    sourcemap: false,
  });
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return import(dataUrl);
};

const bibleShare = await importTypescriptModule(
  '../app/composables/bible/bibleShare.ts',
);

const compileSfcTemplate = (source, filename) => {
  const { descriptor } = parse(source, { filename });
  assert.ok(descriptor.template, `${filename} should have a template`);
  const compiled = compileTemplate({
    id: `test-${filename}`,
    source: descriptor.template.content,
    filename,
    compilerOptions: { mode: 'function' },
  });
  assert.deepEqual(compiled.errors, []);
  return new Function('Vue', `${compiled.code}; return render`)(Vue);
};

const iconStub = defineComponent({
  setup: () => () => h('span', { 'aria-hidden': 'true' }),
});
const nuxtLinkStub = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: [String, Object], required: true } },
  setup(props, { slots }) {
    return () => h('a', {
      href: typeof props.to === 'string' ? props.to : props.to.path,
    }, slots.default?.());
  },
});

const renderTongdokReader = async () => {
  const FloatingBottomBar = defineComponent({
    name: 'FloatingBottomBar',
    components: {
      HomeIcon: iconStub,
      NuxtLink: nuxtLinkStub,
      UserIcon: iconStub,
    },
    setup() {
      return { profileLink: '/login' };
    },
    render: compileSfcTemplate(floatingBottomBarSource, 'FloatingBottomBar.vue'),
  });
  const emptyStub = defineComponent({ setup: () => () => h('div') });
  const audioStub = defineComponent({
    name: 'TongdokAudioPlayer',
    setup: () => () => h('section', { 'aria-label': '통독 오디오 재생 진행률' }),
  });
  const noop = () => {};
  const component = defineComponent({
    components: {
      BibleSearchButton: emptyStub,
      BibleToolPopover: emptyStub,
      BibleViewer: emptyStub,
      BookmarkFilledIcon: iconStub,
      BookmarkOutlineIcon: iconStub,
      BookOpenIcon: iconStub,
      CalendarCheckIcon: iconStub,
      CheckCircleIcon: iconStub,
      CheckCircleOutlineIcon: iconStub,
      CheckIcon: iconStub,
      ClientOnly: emptyStub,
      ChevronLeftIcon: iconStub,
      ChevronRightIcon: iconStub,
      FloatingBottomBar,
      HeadphonesIcon: iconStub,
      SelectionFloatingControls: emptyStub,
      TongdokAudioPlayer: audioStub,
      XMarkIcon: iconStub,
    },
    setup() {
      return {
        bookProgress: { read: 1, total: 21, percentage: 5 },
        chapterSuffix: '장',
        content: '<div>본문</div>',
        currentBookName: '요한복음',
        currentChapter: 3,
        handleSelectionClose: noop,
        handleSelectionCopy: noop,
        handleSelectionCopyClose: noop,
        handleSelectionCopyWithFormat: noop,
        handleSelectionHighlightOrRemove: noop,
        handleSelectionShare: noop,
        handleSwipeLeft: noop,
        handleSwipeRight: noop,
        hasNextChapter: true,
        hasPrevChapter: true,
        highlights: [],
        isAuthenticated: true,
        isBookmarked: false,
        isCompleting: false,
        isCurrentChapterRead: false,
        isLoading: false,
        isMarkingRead: false,
        isTongdokAudioPlayerOpen: true,
        isTongdokMode: true,
        noteCount: 0,
        scrollPosition: 0,
        selectionMenuState: { visible: false, mode: null },
        shortBookName: '요',
        shortScheduleDate: '8/26(수)',
        tongdokAudioLink: 'https://youtu.be/video-id',
        tongdokGuideLink: null,
        tongdokProgress: { current: 2, total: 4 },
        tongdokScheduleRange: '요한복음 3-4장',
      };
    },
    render: compileSfcTemplate(readerSource, 'BibleReaderView.vue'),
  });

  return renderToString(createSSRApp(component));
};

test('renders selection actions in the anchored popover layer above the bottom bar', () => {
  // Moved to Playwright: tests/e2e/bible-behavior.spec.ts.
});

test('keeps copy menu in the anchored popover layer above the bottom bar', () => {
  // Moved to Playwright: tests/e2e/bible-behavior.spec.ts.
});

test('does not render Tongdok completion as a standalone floating button', () => {
  assert.doesNotMatch(
    readerSource,
    /tongdok-complete-floating-btn|tongdok-complete-floating-scrim/,
    'Bible reader should not include the unrequested standalone Tongdok completion button or backdrop',
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

test('preserves adjacent bottom bar and event wiring', async () => {
  const html = await renderTongdokReader();
  const audioIndex = html.indexOf('aria-label="통독 오디오 재생 진행률"');
  const progressIndex = html.indexOf('class="tongdok-progress-area"');
  const navigationIndex = html.indexOf('class="floating-bottom-navigation"');
  const previousIndex = html.indexOf('aria-label="이전 장"', navigationIndex);
  const chapterIndex = html.indexOf('class="chapter-info is-tongdok"', navigationIndex);
  const nextIndex = html.indexOf('aria-label="다음 장"', navigationIndex);

  assert.ok(audioIndex >= 0 && audioIndex < navigationIndex, 'tongdok audio should render above navigation');
  assert.ok(progressIndex > audioIndex && progressIndex < navigationIndex, 'tongdok progress should render above navigation after audio');
  assert.ok(previousIndex < chapterIndex && chapterIndex < nextIndex, 'previous, chapter, and next controls should keep DOM order');

  for (const eventName of ['highlight', 'highlight-delete', 'copy', 'share']) {
    assert.ok(
      readerSource.includes(`@${eventName}="$emit('${eventName}'`),
      `reader should keep forwarding ${eventName}`,
    );
  }
});

test('shares the Maeil1Dok Bible URL from the floating selection UI', () => {
  // Moved to Playwright: tests/e2e/bible-behavior.spec.ts.

  const shareUrl = bibleShare.buildBibleShareUrl(
    'https://maeil1dok.com',
    { book: 'jhn', chapter: 3, version: 'GAE' },
    { start: 16, end: 18 },
  );
  const shareData = bibleShare.buildBibleSelectionShareData({
    bookName: '요한복음',
    chapter: 3,
    chapterSuffix: '장',
    verseRange: { start: 16, end: 18 },
    url: shareUrl,
  });

  assert.deepEqual(shareData, {
    title: '요한복음 3장 16-18절',
    url: 'https://maeil1dok.com/bible?book=jhn&chapter=3&verse=16-18',
  });
  assert.equal(Object.hasOwn(shareData, 'text'), false);
});

test('opens verse-range share URLs with focused verses', () => {
  assert.deepEqual(bibleShare.parseVerseRangeParam('16'), { start: 16, end: 16 });
  assert.deepEqual(bibleShare.parseVerseRangeParam(['16-18', '20']), { start: 16, end: 18 });
  assert.equal(bibleShare.parseVerseRangeParam('18-16'), null);
  assert.equal(bibleShare.parseVerseRangeParam('invalid'), null);
  assert.equal(
    bibleShare.buildBibleShareUrl(
      'https://maeil1dok.com',
      { book: 'jhn', chapter: 3, version: 'KNT' },
      { start: 16, end: 16 },
    ),
    'https://maeil1dok.com/bible?book=jhn&chapter=3&version=KNT&verse=16',
  );

  // Moved to Playwright: tests/e2e/bible-behavior.spec.ts.
});
