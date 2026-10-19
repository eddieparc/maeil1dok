import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { compileTemplate, parse } from '@vue/compiler-sfc';
import * as Vue from 'vue';
import { renderToString } from '@vue/server-renderer';

const compileRender = async relativePath => {
  const source = await readFile(new URL(`../app/pages/${relativePath}`, import.meta.url), 'utf8');
  const { descriptor, errors } = parse(source, { filename: relativePath });
  assert.deepEqual(errors, []);
  assert.ok(descriptor.template);

  const compiled = compileTemplate({
    id: `auth-readiness-render-${relativePath}`,
    source: descriptor.template.content,
    filename: relativePath,
    compilerOptions: { mode: 'function' },
  });
  assert.deepEqual(compiled.errors, []);
  return new Function('Vue', `${compiled.code}; return render`)(Vue);
};

const LayoutStub = Vue.defineComponent({
  name: 'BibleSubpageLayout',
  inheritAttrs: false,
  props: {
    loading: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () => Vue.h(
      'main',
      { 'data-loading': String(props.loading) },
      [slots.default?.(), slots.skeleton?.()],
    );
  },
});

const SilentStub = Vue.defineComponent({
  inheritAttrs: false,
  setup(_, { slots }) {
    return () => Vue.h('div', slots.default?.());
  },
});

const SkeletonStub = Vue.defineComponent({
  name: 'SkeletonList',
  setup() {
    return () => Vue.h('div', { 'data-skeleton': 'true' });
  },
});

const renderPage = async (render, setup) => {
  const app = Vue.createSSRApp(Vue.defineComponent({ setup, render }));
  for (const name of [
    'BibleSubpageLayout',
    'BookmarkIcon',
    'EmptyState',
    'FileText',
    'Highlighter',
    'Lock',
    'NuxtLink',
    'Search',
    'SegmentedControl',
    'Toast',
    'Trash2',
  ]) {
    app.component(name, name === 'BibleSubpageLayout' ? LayoutStub : SilentStub);
  }
  app.component('SkeletonList', SkeletonStub);
  return renderToString(app);
};

test('record pages render loading instead of guest or empty state during auth restoration', async () => {
  const auth = {
    isAuthenticated: { value: false },
    isLoading: { value: true },
  };
  const commonSetup = {
    auth,
    authStore: auth,
    BIBLE_BOOKS: { old: [], new: [] },
    emptyGuide: undefined,
    emptyHint: '',
    emptyText: 'guest',
    filterBook: '',
    filterColor: '',
    filteredBookmarks: [],
    filteredHighlights: [],
    filteredNotes: [],
    formatLocation: () => '',
    formatRelativeDate: () => '',
    formatVerseRange: () => '',
    getBookName: value => value,
    goToBookmark: () => {},
    goToHighlight: () => {},
    handleDelete: () => {},
    highlightColor: () => '',
    isEmpty: true,
    isLoading: false,
    recordSegments: [],
    router: { push: () => {} },
    searchQuery: '',
    showSearch: false,
    sortOrder: 'recent',
    truncate: value => value,
  };

  for (const relativePath of [
    'bible/notes/index.vue',
    'bible/highlights/index.vue',
    'bible/bookmarks.vue',
  ]) {
    const html = await renderPage(await compileRender(relativePath), () => commonSetup);
    assert.match(
      html,
      /data-loading="true"|data-skeleton="true"/,
      `${relativePath} must expose loading while auth is unresolved`,
    );
    assert.doesNotMatch(html, />guest</);
  }
});
