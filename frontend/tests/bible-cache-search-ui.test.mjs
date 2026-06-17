import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const searchPageSource = await readFile(
  new URL('../app/pages/bible/search.vue', import.meta.url),
  'utf8',
);

const biblePageSource = await readFile(
  new URL('../app/pages/bible/index.vue', import.meta.url),
  'utf8',
);

const readerSource = await readFile(
  new URL('../app/components/bible/BibleReaderView.vue', import.meta.url),
  'utf8',
);

const viewerSource = await readFile(
  new URL('../app/components/bible/BibleViewer.vue', import.meta.url),
  'utf8',
);

test('cache search results clean snippets and highlight the query term', () => {
  assert.match(searchPageSource, /decodeHtmlEntities/, 'search snippets should decode HTML entities before rendering');
  assert.match(searchPageSource, /sanitizeSnippet/, 'search snippets should strip cache/source noise');
  assert.match(searchPageSource, /highlightSnippet\(result\.snippet\)/, 'result snippets should render highlighted query terms');
  assert.match(searchPageSource, /class="search-hit"/, 'highlighted search terms should have a stable class');
});

test('slash key focuses the cache search input', () => {
  assert.match(searchPageSource, /ref="searchInputRef"/, 'search input should be addressable');
  assert.match(searchPageSource, /event\.key !== '\/'/, 'page should handle slash shortcut');
  assert.match(searchPageSource, /searchInputRef\.value\?\.focus\(\)/, 'slash should focus the search input');
});

test('cache search result links include verse and search focus parameters', () => {
  assert.match(searchPageSource, /verse:\s*result\.verse \? String\(result\.verse\) : undefined/, 'result links should include matching verse when available');
  assert.match(searchPageSource, /search:\s*query\.value/, 'result links should include the search term for word focus');
});

test('Bible reader focuses search term from deep link query', () => {
  assert.match(biblePageSource, /pendingSearchFocus\.value = parseSearchFocusParam\(route\.query\.search\);/, 'Bible page should capture search focus query');
  assert.match(readerSource, /focusVerseRange\(startVerse,\s*endVerse,\s*searchTerm\)/, 'reader should forward search term focus');
  assert.match(viewerSource, /focusSearchTermInVerse\(startVerse,\s*searchTerm\)/, 'viewer should focus the search term inside the verse');
  assert.match(viewerSource, /focused-search-term/, 'focused term should have a stable class');
});
