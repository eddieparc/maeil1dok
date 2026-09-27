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

  assert.match(
    viewerScript,
    /const scrollToTop = \(\) => \{[\s\S]*?viewerRef\.value\.scrollTop = 0;[\s\S]*?\}/,
    'BibleViewer should expose a direct reset for its scroll-owning element',
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
  assert.match(
    biblePageSource,
    /const goToPrevChapter = async \(\) => \{[\s\S]*?await loadBibleContent\(currentBook\.value, currentChapter\.value\);[\s\S]*?scrollToTop\(\);/,
    'previous navigation should reset after the new chapter has loaded',
  );
  assert.match(
    biblePageSource,
    /goToNextChapterBase\(\);[\s\S]*?await loadBibleContent\(currentBook\.value, currentChapter\.value\);[\s\S]*?scrollToTop\(\);/,
    'next navigation should reset after the new chapter has loaded',
  );
});

test('resets document navigation without leaving a smooth-scroll intermediate position', () => {
  assert.match(
    biblePageSource,
    /window\.scrollTo\(\{ top: 0, behavior: 'auto' \}\);/,
    'chapter navigation should synchronously place the document at its top',
  );
});
