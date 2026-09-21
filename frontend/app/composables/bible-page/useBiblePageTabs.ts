/**
 * useBiblePageTabs - 성경 본문 탭 바와 페이지 상태의 연결
 *
 * pages/bible/index.vue에서 분리한 탭 관심사:
 * bibleTabsStore와 현재 리더 위치(책·장·역본·스크롤) 사이의
 * 스냅샷 동기화·탭 전환 복원을 한곳에서 관리한다.
 */

import { computed, watch, type Ref, type ComputedRef } from 'vue';
import { useBibleTabsStore } from '~/stores/bibleTabs';
import type { BibleTab, BibleTabSnapshot } from '~/utils/bibleTabs';
import type { ViewMode } from '~/types/bible';

export interface UseBiblePageTabsOptions {
  viewMode: Ref<ViewMode>;
  currentBook: Ref<string>;
  currentChapter: Ref<number>;
  currentVersion: Ref<string>;
  currentBookName: ComputedRef<string>;
  chapterSuffix: ComputedRef<string>;
  scrollPosition: Ref<number>;
  resetReaderScrollPosition: () => void;
  loadBibleContent: (book: string, chapter: number) => Promise<void>;
  restoreSavedScrollPosition: (position: number | undefined) => Promise<void>;
}

export function useBiblePageTabs(options: UseBiblePageTabsOptions) {
  const {
    viewMode, currentBook, currentChapter, currentVersion,
    currentBookName, chapterSuffix, scrollPosition,
    resetReaderScrollPosition, loadBibleContent, restoreSavedScrollPosition,
  } = options;

  const bibleTabsStore = useBibleTabsStore();
  const tabBarVisible = computed(() => bibleTabsStore.barVisible);
  const bibleTabs = computed(() => bibleTabsStore.tabs);
  const activeBibleTabId = computed(() => bibleTabsStore.activeTabId);
  const currentTabLabel = computed(
    () => `${currentBookName.value} ${currentChapter.value}${chapterSuffix.value}`
  );

  const buildTabSnapshot = (): BibleTabSnapshot => ({
    book: currentBook.value,
    chapter: currentChapter.value,
    version: currentVersion.value,
    scrollPosition: scrollPosition.value,
  });

  const syncActiveBibleTab = () => {
    bibleTabsStore.syncActiveTab(buildTabSnapshot(), currentTabLabel.value);
  };

  /** 탭 스냅샷을 리더에 복원한다 (책·장·역본·스크롤). */
  const applyTabSnapshot = async (tab: BibleTab) => {
    const snap = tab.snapshot;
    // localStorage에 남은 legacy 'jon' 코드를 canonical 'jnh'로 정규화한다.
    currentBook.value = snap.book === 'jon' ? 'jnh' : snap.book;
    currentChapter.value = snap.chapter;
    currentVersion.value = snap.version;
    viewMode.value = 'reader';

    resetReaderScrollPosition();
    await loadBibleContent(currentBook.value, snap.chapter);
    if (snap.scrollPosition > 0) {
      await restoreSavedScrollPosition(snap.scrollPosition);
    }
    // 복원 과정에서 바뀐 값들을 활성 탭에 다시 동기화
    syncActiveBibleTab();
  };

  const handleToggleTabBar = () => {
    const opening = !bibleTabsStore.barVisible;
    bibleTabsStore.toggleBar();
    // 처음 여는 경우 현재 본문으로 첫 탭을 만든다
    if (opening && bibleTabsStore.tabs.length === 0) {
      bibleTabsStore.addTab(buildTabSnapshot(), currentTabLabel.value);
    }
  };

  const handleTabAdd = () => {
    bibleTabsStore.addTab(buildTabSnapshot(), currentTabLabel.value);
  };

  const handleTabSwitch = async (tabId: string) => {
    if (tabId === bibleTabsStore.activeTabId) return;
    syncActiveBibleTab();
    const tab = bibleTabsStore.switchTab(tabId);
    if (tab) {
      await applyTabSnapshot(tab);
    }
  };

  const handleTabClose = async (tabId: string) => {
    const activated = bibleTabsStore.closeTab(tabId);
    if (activated) {
      await applyTabSnapshot(activated);
    }
  };

  // 리더 상태가 바뀌면 활성 탭의 스냅샷·라벨을 갱신한다
  watch(
    [
      () => currentBook.value,
      () => currentChapter.value,
      () => currentVersion.value,
    ],
    () => {
      syncActiveBibleTab();
    },
    { flush: 'post' }
  );

  return {
    tabBarVisible,
    bibleTabs,
    activeBibleTabId,
    currentTabLabel,
    buildTabSnapshot,
    syncActiveBibleTab,
    applyTabSnapshot,
    handleToggleTabBar,
    handleTabAdd,
    handleTabSwitch,
    handleTabClose,
    hydrateTabs: () => bibleTabsStore.hydrate(),
    updateActiveScroll: (position: number) => bibleTabsStore.updateActiveScroll(position),
  };
}
