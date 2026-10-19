import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compileScript, parse } from '@vue/compiler-sfc';

const compileSfcScript = async (relativePath) => {
  const filename = new URL(relativePath, import.meta.url).pathname;
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  const { descriptor } = parse(source, { filename });
  return compileScript(descriptor, { id: `test-${filename}` }).content;
};

const biblePageSource = await readFile(
  new URL('../app/pages/bible/index.vue', import.meta.url),
  'utf8',
);

test('resets the reader scroll owner to the top for chapter navigation', async () => {
  const viewerScript = await compileSfcScript('../app/components/bible/BibleViewer.vue');
  const readerScript = await compileSfcScript('../app/components/bible/BibleReaderView.vue');

  const viewerScrollSource = await readFile(
    new URL('../app/composables/bible-viewer/useViewerScroll.ts', import.meta.url),
    'utf8',
  );
  assert.match(
    viewerScrollSource,
    /const scrollToTop = \(\) => \{[\s\S]*?viewerRef\.value\.scrollTop = 0;[\s\S]*?\}/,
    'BibleViewer scroll composable should provide a direct reset for its scroll-owning element',
  );
  assert.match(
    viewerScript,
    /__expose\(\{[\s\S]*?scrollToTop,[\s\S]*?\}\)/,
    'BibleViewer should expose its top reset to the reader',
  );
  assert.match(
    readerScript,
    /scrollToTop: \(\) => \{[\s\S]*?bibleViewerRef\.value\?\.scrollToTop\(\);[\s\S]*?\}/,
    'BibleReaderView should use the viewer top reset rather than restore a saved position',
  );
});

test('waits for each chapter content load before resetting the page scroll', () => {
  // 장 이동은 navigateReader -> route watcher -> applyReaderRoute 로 흐른다.
  assert.match(
    biblePageSource,
    /const goToPrevChapter = async \(\) => \{[\s\S]*?goToPrevChapterBase\(\);[\s\S]*?await navigateReader\(/,
    'previous navigation should go through the reader route',
  );
  assert.match(
    biblePageSource,
    /goToNextChapterBase\(\);[\s\S]*?await navigateReader\(/,
    'next navigation should go through the reader route',
  );
  assert.match(
    biblePageSource,
    /const applyReaderRoute = async[\s\S]*?loadBibleContent\(book, chapter\),[\s\S]*?\} else \{\s*\/\/[^\n]*\n\s*scrollToTop\(\);/,
    'the reader route should reset to the top only after the new chapter has loaded',
  );
});

test('resets document navigation without leaving a smooth-scroll intermediate position', () => {
  assert.match(
    biblePageSource,
    /window\.scrollTo\(\{ top: 0, behavior: 'auto' \}\);/,
    'chapter navigation should synchronously place the document at its top',
  );
});
