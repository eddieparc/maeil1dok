import { defineStore } from 'pinia';
import {
  activateTab as activateTabInState,
  addTab as addTabInState,
  parseTabsState,
  removeTab as removeTabInState,
  serializeTabsState,
  setBarVisible as setBarVisibleInState,
  updateTabSnapshot as updateTabSnapshotInState,
  type BibleTab,
  type BibleTabSnapshot,
  type BibleTabsState,
} from '~/utils/bibleTabs';

const STORAGE_KEY = 'bibleReaderTabs';

interface BibleTabsStoreState extends BibleTabsState {
  hydrated: boolean;
}

const persist = (state: BibleTabsState): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeTabsState(state));
  } catch {
    // 저장 실패는 무시 — 탭은 세션 내 상태로 계속 동작한다
  }
};

export const useBibleTabsStore = defineStore('bibleTabs', {
  state: (): BibleTabsStoreState => ({
    tabs: [],
    activeTabId: null,
    barVisible: false,
    hydrated: false,
  }),

  getters: {
    activeTab: (state): BibleTab | null =>
      state.tabs.find((tab) => tab.id === state.activeTabId) ?? null,
  },

  actions: {
    /** localStorage에서 복원한다. 클라이언트 마운트 시 한 번만 호출. */
    hydrate() {
      if (this.hydrated || typeof window === 'undefined') return;
      const restored = parseTabsState(localStorage.getItem(STORAGE_KEY));
      this.tabs = restored.tabs;
      this.activeTabId = restored.activeTabId;
      this.barVisible = restored.barVisible;
      this.hydrated = true;
    },

    toggleBar() {
      setBarVisibleInState(this, !this.barVisible);
      persist(this);
    },

    /** 현재 리더 상태로 새 탭을 만들고 활성화한다. 만들어진 탭을 반환. */
    addTab(snapshot: BibleTabSnapshot, label: string): BibleTab {
      const tab = addTabInState(this, snapshot, label);
      persist(this);
      return tab;
    },

    /**
     * 탭을 닫는다. 활성 탭이 닫혀 새 탭이 활성화되면 그 탭을 반환한다
     * (호출자가 리더 상태를 그 탭으로 복원해야 한다).
     */
    closeTab(tabId: string): BibleTab | null {
      const { activated } = removeTabInState(this, tabId);
      persist(this);
      return activated;
    },

    /** 활성 탭을 바꾼다. 대상 탭을 반환(없으면 null). */
    switchTab(tabId: string): BibleTab | null {
      if (!activateTabInState(this, tabId)) return null;
      persist(this);
      return this.activeTab;
    },

    /** 활성 탭의 스냅샷·라벨을 현재 리더 상태로 갱신한다. */
    syncActiveTab(snapshot: BibleTabSnapshot, label: string): void {
      if (!this.activeTabId) return;
      updateTabSnapshotInState(this, this.activeTabId, snapshot, label);
      persist(this);
    },

    /**
     * 활성 탭의 스크롤 위치만 갱신한다. 스크롤 이벤트마다 호출되므로
     * localStorage에는 쓰지 않고 메모리만 갱신한다 — 다음 persist 시 함께 저장된다.
     */
    updateActiveScroll(position: number): void {
      const tab = this.activeTab;
      if (tab) {
        tab.snapshot.scrollPosition = position;
      }
    },
  },
});
