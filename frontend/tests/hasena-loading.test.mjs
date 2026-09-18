import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { build } from 'esbuild';
import { compileScript, parse } from '@vue/compiler-sfc';
import { renderToString } from '@vue/server-renderer';
import * as Vue from 'vue';

const runtime = { Vue };
globalThis.__hasenaLoadingTest = runtime;
const source = await readFile(new URL('../app/pages/hasena.vue', import.meta.url), 'utf8');
const { descriptor } = parse(source);
const script = compileScript(descriptor, { id: 'hasena-loading' }).content;
const modules = {
  vue: Object.keys(Vue).filter(key => /^[\w$]+$/.test(key))
    .map(key => `export const ${key} = globalThis.__hasenaLoadingTest.Vue.${key};`).join('\n'),
  'vue-router': 'export const useRouter = () => ({});',
  '~/composables/useApi': 'export const useApi = () => globalThis.__hasenaLoadingTest.api;',
  '~/composables/useAuthService': 'export const useAuthService = () => ({ isAuthenticated: { value: false } });',
  '~/stores/hasena': 'export const useHasenaStore = () => ({ setCompletionStatus() {} });',
  '~/stores/readingSettings': `export const useReadingSettingsStore = () => ({ settings: {} });
    export const FONT_FAMILIES = {}; export const FONT_WEIGHTS = {};`,
  '~/composables/useSanitize': 'export const useSanitize = () => ({ sanitize: value => value });',
  '~/utils/hasenaFormatters': 'export const formatHasenaSummary = value => value;',
  '~/utils/hasenaVideoUrl': `export const buildHasenaEmbedUrl = value => value;
    export const withJsApiEnabled = value => value;`,
  '@lucide/vue': `export const CalendarDaysIcon = {}, ChevronDownIcon = {}, ChevronRightIcon = {},
    CircleCheckIcon = {}, PlayIcon = {}, SlidersHorizontalIcon = {}, SparklesIcon = {};`,
};
const compiled = await build({
  stdin: { contents: script, loader: 'js' }, bundle: true, write: false, format: 'esm',
  plugins: [{ name: 'hasena-boundaries', setup(builder) {
    builder.onResolve({ filter: /.*/ }, ({ path }) => ({ path, namespace: 'boundary' }));
    builder.onLoad({ filter: /.*/, namespace: 'boundary' }, ({ path }) => {
      if (path.endsWith('.vue')) return { contents: 'export default {};' };
      assert.ok(modules[path], `known boundary: ${path}`);
      return { contents: modules[path] };
    });
  } }],
});
const { default: Hasena } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const deferred = () => Promise.withResolvers();
async function setup(api) {
  runtime.api = api;
  let state;
  await renderToString(Vue.createSSRApp({
    setup() {
      state = Hasena.setup({}, { expose() {} });
      return () => Vue.h('div');
    },
  }));
  return state;
}

test('reveals daily content while the independent AI summary is still pending', async () => {
  // Given a ready daily passage and an unresolved summary response.
  const summary = deferred();
  const requested = deferred();
  const state = await setup({ GET: async path => {
    if (path.endsWith('/day/')) return { data: { success: true, entry: {
      passage: '창세기 1장', video_id: 'video-a', verses: [{ number: '1', text: '태초에' }],
    } } };
    requested.resolve();
    return summary.promise;
  } });
  // When the real page starts loading and reaches the summary boundary.
  const content = state.fetchHasenaContent();
  await requested.promise;
  await Vue.nextTick();
  try {
    // Then the main skeleton is gone, but the summary owns its loading state.
    assert.equal(state.isLoading.value, false);
    assert.equal(state.summaryLoading.value, true);
    assert.equal(state.bibleTitle.value, '창세기 1장');
    assert.match(state.parsedContent.value, /태초에/);
  } finally {
    summary.resolve({ data: { success: true, summary: 'summary-a' } });
    await content;
  }
});

test('an older video summary cannot replace the newly selected video summary', async () => {
  // Given two video requests that complete out of order.
  const summaries = new Map([['video-a', deferred()], ['video-b', deferred()]]);
  const state = await setup({ GET: (_path, { params }) => summaries.get(params.video_id).promise });
  state.latestVideoId.value = 'video-a';
  const first = state.loadAISummary();
  state.latestVideoId.value = 'video-b';
  const second = state.loadAISummary();
  // When the newer result arrives before the older one.
  summaries.get('video-b').resolve({ data: { success: true, summary: 'summary-b' } });
  await second;
  summaries.get('video-a').resolve({ data: { success: true, summary: 'summary-a' } });
  await first;
  // Then only the selected video's summary remains.
  assert.equal(state.summaryContent.value, 'summary-b');
});

test('a day without a video clears a pending summary without requesting another', async () => {
  // Given a summary in flight for the previous day.
  const summary = deferred();
  let requests = 0;
  const state = await setup({ GET: () => { requests++; return summary.promise; } });
  state.latestVideoId.value = 'video-a';
  const pending = state.loadAISummary();
  // When the next day has no video.
  state.latestVideoId.value = '';
  await state.loadAISummary();
  try {
    // Then there is no summary request or spinner for the empty video.
    assert.equal(state.summaryLoading.value, false);
    assert.equal(requests, 1);
  } finally {
    summary.resolve({ data: { success: true, summary: 'summary-a' } });
    await pending;
  }
  assert.equal(state.summaryContent.value, '');
});
