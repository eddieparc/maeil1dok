import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compileTemplate, parse } from '@vue/compiler-sfc';
import { renderToString } from '@vue/server-renderer';
import * as Vue from 'vue';
import { createSSRApp, defineComponent, h } from 'vue';
import esbuild from 'esbuild';

const searchPageSource = await readFile(
  new URL('../app/pages/bible/search.vue', import.meta.url),
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

const snippetRuntime = await importTypescriptModule('../app/utils/bibleSearchSnippet.ts');
const searchRouteRuntime = await importTypescriptModule('../app/utils/bibleSearchRoute.ts');

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

const renderSearchResults = async (snippet, query) => {
  const render = compileSfcTemplate(searchPageSource, 'BibleSearchPage.vue');
  const passthroughLayout = defineComponent({
    name: 'BibleSubpageLayout',
    setup(_, { slots }) {
      return () => h('main', slots.default?.());
    },
  });
  const iconStub = defineComponent({
    setup: () => () => h('span', { 'aria-hidden': 'true' }),
  });
  const linkStub = defineComponent({
    name: 'NuxtLink',
    props: { to: { type: [String, Object], required: true } },
    setup(_, { slots }) {
      return () => h('a', slots.default?.());
    },
  });
  const result = {
    version: 'GAE',
    book: 'jhn',
    chapter: 3,
    verse: 16,
    snippet,
  };

  const component = defineComponent({
    components: {
      BibleSubpageLayout: passthroughLayout,
      ChevronDownIcon: iconStub,
      SearchIcon: iconStub,
      NuxtLink: linkStub,
    },
    setup() {
      return {
        bookLabel: () => '요한복음',
        chapterSuffix: () => '장',
        groupedResults: [{ book: 'jhn', results: [result] }],
        hasSearched: true,
        highlightSnippet: value => snippetRuntime.highlightBibleSearchSnippet(value, query),
        isGroupExpanded: () => true,
        isSearching: false,
        message: '',
        query,
        resultSummary: '1개 결과 · 1권',
        resultUrl: () => ({ path: '/bible' }),
        results: [result],
        search: () => {},
        toggleGroup: () => {},
        version: 'GAE',
        versionLabel: () => '개역개정',
        versionOptions: [],
      };
    },
    render,
  });

  return renderToString(createSSRApp(component));
};

test('cache search results clean snippets and highlight the query term', async () => {
  assert.equal(
    snippetRuntime.decodeBibleSearchHtmlEntities('하나님&nbsp;사랑 &amp; 은혜'),
    '하나님 사랑 & 은혜',
  );
  assert.equal(
    snippetRuntime.sanitizeBibleSearchSnippet('  하나님&nbsp; 직접입력 [출처]  사랑  '),
    '하나님 사랑',
  );
  assert.equal(
    snippetRuntime.highlightBibleSearchSnippet('<b>사랑</b> 사랑?', '사랑?'),
    '&lt;b&gt;사랑&lt;/b&gt; <mark class="search-hit">사랑?</mark>',
  );

  const html = await renderSearchResults('하나님&nbsp; 직접입력 [출처] 사랑', '사랑');
  assert.match(html, /하나님 <mark class="search-hit">사랑<\/mark>/);
  assert.doesNotMatch(html, /직접입력|\[출처\]/);
});

test('slash key focuses the cache search input', () => {
  // Moved to Playwright: tests/e2e/browser-behavior.spec.ts.
});

test('cache search result links include verse and search focus parameters', () => {
  assert.deepEqual(
    searchRouteRuntime.buildBibleSearchResultQuery({
      version: 'KNT',
      book: 'jhn',
      chapter: 3,
      verse: 16,
    }, '사랑'),
    {
      version: 'KNT',
      book: 'jhn',
      chapter: '3',
      verse: '16',
      search: '사랑',
    },
  );
  assert.deepEqual(
    searchRouteRuntime.buildBibleSearchResultQuery({
      version: 'GAE',
      book: 'gen',
      chapter: 1,
      verse: null,
    }, '빛'),
    {
      version: 'GAE',
      book: 'gen',
      chapter: '1',
      verse: undefined,
      search: '빛',
    },
  );
});

test('Bible reader focuses search term from deep link query', () => {
  assert.equal(searchRouteRuntime.parseSearchFocusParam(['  사랑  ', '무시']), '사랑');
  assert.equal(searchRouteRuntime.parseSearchFocusParam('   '), null);

  // Moved to Playwright: tests/e2e/bible-behavior.spec.ts.
});
