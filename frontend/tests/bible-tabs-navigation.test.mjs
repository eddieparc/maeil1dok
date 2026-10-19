import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import * as Pinia from 'pinia';
import * as Vue from 'vue';
const { createPinia, setActivePinia } = Pinia;
const { ref, computed, effectScope, nextTick } = Vue;

const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
  stdin: { contents: "export {useBiblePageTabs} from './app/composables/bible-page/useBiblePageTabs'; export {useBibleTabsStore} from './app/stores/bibleTabs';", resolveDir: root },
  bundle: true, write: false, format: 'cjs', platform: 'node', external: ['vue', 'pinia'],
  alias: { '~': `${root}/app` },
});
const module = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(name => ({ vue: Vue, pinia: Pinia })[name], module, module.exports);
const { useBiblePageTabs, useBibleTabsStore } = module.exports;

test('tab navigation delegates canonical position and restores scroll after the common loader', async t => {
  const values = new Map();
  globalThis.window = {};
  globalThis.localStorage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  setActivePinia(createPinia());
  const store = useBibleTabsStore();
  store.hydrate();
  const first = store.addTab({ book: 'gen', chapter: 1, version: 'GAE', scrollPosition: .2 }, 'gen');
  const target = store.addTab({ book: 'jon', chapter: 2, version: 'KNT', scrollPosition: .6 }, 'jnh');
  store.switchTab(first.id);
  const currentBook = ref('gen'), currentChapter = ref(1), currentVersion = ref('GAE'), scrollPosition = ref(.4);
  const calls = [];
  const scope = effectScope(); t.after(() => scope.stop());
  const tabs = scope.run(() => useBiblePageTabs({
    viewMode: ref('reader'), currentBook, currentChapter, currentVersion, scrollPosition,
    currentBookName: computed(() => currentBook.value), chapterSuffix: computed(() => '장'),
    resetReaderScrollPosition: () => { scrollPosition.value = 0; },
    loadBibleContent: async () => { calls.push('body-only'); },
    navigateReader: async (book, chapter, version) => {
      calls.push([book, chapter, version]);
      currentBook.value = book; currentChapter.value = chapter; currentVersion.value = version;
      scrollPosition.value = 0;
      await nextTick();
    },
    restoreSavedScrollPosition: async position => { calls.push(['scroll', position]); scrollPosition.value = position; },
  }));
  await tabs.handleTabSwitch(target.id);
  assert.deepEqual(calls, [['jnh', 2, 'KNT'], ['scroll', .6]]);
  assert.equal(store.tabs[0].snapshot.scrollPosition, .4);
  assert.equal(store.activeTab.snapshot.scrollPosition, .6);
  assert.equal(JSON.parse(values.get('bibleReaderTabs')).tabs[1].snapshot.book, 'jnh');
});
