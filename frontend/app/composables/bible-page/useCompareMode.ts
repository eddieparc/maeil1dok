/**
 * useCompareMode - 성경 본문 역본 비교 모드
 *
 * pages/bible/index.vue에서 분리한 비교 모드 관심사:
 * 보조 역본 선택·본문 로드·캐시·localStorage 선호도를 한곳에서 관리한다.
 * 기본(primary) 역본은 라우트가 소유하므로, 기본 역본 변경은
 * onPrimaryVersionSelect 콜백으로 페이지에 위임한다.
 */

import { ref, watch, onBeforeUnmount, type Ref, type ComputedRef } from 'vue';
import { useBibleContent } from '~/composables/bible/useBibleContent';
import { VISIBLE_VERSION_NAMES } from '~/composables/useBibleData';
import type { ViewMode } from '~/types/bible';

export interface UseCompareModeOptions {
  currentBook: Ref<string>;
  currentChapter: Ref<number>;
  currentVersion: Ref<string>;
  viewMode: Ref<ViewMode>;
  /** 기본 역본 변경 요청 (페이지의 handleVersionSelect). */
  onPrimaryVersionSelect: (version: string) => void | Promise<void>;
}

export function useCompareMode(options: UseCompareModeOptions) {
  const { currentBook, currentChapter, currentVersion, viewMode, onPrimaryVersionSelect } = options;
  // setup 시점에 컨텍스트를 잡아둔다 — 비동기 콜백 안에서는 useNuxtApp()이 안전하지 않다.
  const nuxtApp = useNuxtApp();

  const compareEnabled = ref(false);
  const secondaryVersion = ref('KNT');
  const secondaryContent = ref('');
  const isSecondaryLoading = ref(false);
  let secondaryGeneration = 0;
  let compareActive = true;
  // Reuse already parsed chapters when exchanging columns; primary remains route-owned.
  const compareChapters = new Map<string, string>();
  const chapterKey = (book: string, chapter: number, version: string) => `${book}:${chapter}:${version}`;

  const persistCompare = () => {
    try { localStorage.setItem('bibleCompare', JSON.stringify({ enabled: compareEnabled.value, secondaryVersion: secondaryVersion.value })); }
    catch (error) { console.warn('Failed to save compare preferences:', error); }
  };

  /** localStorage에 저장된 비교 모드 선호도를 복원한다 (클라이언트 전용). */
  const restoreComparePrefs = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('bibleCompare') || '{}');
      if (typeof saved.secondaryVersion === 'string' && saved.secondaryVersion in VISIBLE_VERSION_NAMES) secondaryVersion.value = saved.secondaryVersion;
      else secondaryVersion.value = currentVersion.value === 'GAE' ? 'KNT' : 'GAE';
      compareEnabled.value = saved.enabled === true;
    } catch (error) { console.warn('Failed to load compare preferences:', error); }
  };

  const toggleCompare = () => {
    compareEnabled.value = !compareEnabled.value;
    if (compareEnabled.value && secondaryVersion.value === currentVersion.value) secondaryVersion.value = currentVersion.value === 'GAE' ? 'KNT' : 'GAE';
    persistCompare();
  };

  const handleCompareVersionSelect = (version: string) => {
    secondaryVersion.value = version;
    persistCompare();
  };

  // 비교 뷰어 헤더 드롭다운에서 바로 역본을 바꾼다.
  const handleCompareColumnSelect = (column: 'primary' | 'secondary', version: string) => {
    if (column === 'primary') void onPrimaryVersionSelect(version);
    else handleCompareVersionSelect(version);
  };

  const swapCompareVersions = async () => {
    const primary = currentVersion.value;
    const secondary = secondaryVersion.value;
    secondaryVersion.value = primary;
    persistCompare();
    await onPrimaryVersionSelect(secondary);
  };

  const loadSecondaryContent = async () => {
    const generation = ++secondaryGeneration;
    if (!compareEnabled.value || viewMode.value !== 'reader') { isSecondaryLoading.value = false; return; }
    const book = currentBook.value;
    const chapter = currentChapter.value;
    const version = secondaryVersion.value;
    const key = chapterKey(book, chapter, version);
    isSecondaryLoading.value = true;
    secondaryContent.value = '';
    const cached = compareChapters.get(key);
    if (cached !== undefined) { secondaryContent.value = cached; isSecondaryLoading.value = false; return; }
    const loader = await nuxtApp.runWithContext(() => useBibleContent());
    await loader.loadContent(book, chapter, version);
    if (!compareActive || generation !== secondaryGeneration) return;
    secondaryContent.value = loader.content.value;
    if (!loader.error?.value) compareChapters.set(key, loader.content.value);
    isSecondaryLoading.value = false;
  };
  watch([compareEnabled, secondaryVersion, currentBook, currentChapter, viewMode], loadSecondaryContent);

  onBeforeUnmount(() => {
    compareActive = false;
    ++secondaryGeneration;
  });

  return {
    compareEnabled,
    secondaryVersion,
    secondaryContent,
    isSecondaryLoading,
    compareChapters,
    chapterKey,
    persistCompare,
    restoreComparePrefs,
    toggleCompare,
    handleCompareVersionSelect,
    handleCompareColumnSelect,
    swapCompareVersions,
    loadSecondaryContent,
  };
}
