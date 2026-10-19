/**
 * readerTabs — 성경 리더 탭 상태의 순수 로직 + AsyncStorage 영속화.
 *
 * frontend/app/utils/bibleTabs.ts (LAB-139) 와 같은 모델:
 * 탭은 "저장된 본문 위치"(book/chapter/version/scrollPosition)다.
 * 리더 자체는 하나만 살아 있고, 탭 전환 시 현재 상태를 스냅샷으로 저장한 뒤
 * 대상 탭의 스냅샷을 복원한다.
 *
 * 웹과 다른 점: 마지막 남은 탭은 닫을 수 없다(removeTab이 거부) —
 * 네이티브 셸에는 탭 0개의 리더 상태가 없기 때문이다.
 */

import { chapterCount, isBibleBook } from './bibleBooks';

export const READER_TABS_STORAGE_KEY = 'bibleReaderTabs';

export interface ReaderTabSnapshot {
  book: string;
  chapter: number;
  version: string;
  scrollPosition: number;
}

export interface ReaderTab {
  id: string;
  label: string;
  snapshot: ReaderTabSnapshot;
}

export interface ReaderTabsState {
  tabs: ReaderTab[];
  activeTabId: string | null;
  barVisible: boolean;
}

/** AsyncStorage 호환 최소 인터페이스 (테스트에서 인메모리 스토리지 주입). */
export interface ReaderTabsStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<unknown>;
}

export const createTabsState = (): ReaderTabsState => ({
  tabs: [],
  activeTabId: null,
  barVisible: false,
});

const createTabId = (): string =>
  `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * 상태의 얕은+스냅샷 복사본. 위 함수들은 상태를 제자리에서 변경하므로
 * React setState와 함께 쓸 때는 clone → 변경 → set 순서로 사용한다.
 */
export const cloneTabsState = (state: ReaderTabsState): ReaderTabsState => ({
  tabs: state.tabs.map((t) => ({ ...t, snapshot: { ...t.snapshot } })),
  activeTabId: state.activeTabId,
  barVisible: state.barVisible,
});

/** 새 탭을 추가하고 활성화한다. 추가된 탭을 반환한다. */
export const addTab = (
  state: ReaderTabsState,
  snapshot: ReaderTabSnapshot,
  label: string,
): ReaderTab => {
  const tab: ReaderTab = { id: createTabId(), label, snapshot };
  state.tabs.push(tab);
  state.activeTabId = tab.id;
  return tab;
};

/** 대상 탭을 활성화한다. 존재하면 true, 아니면 false. */
export const activateTab = (state: ReaderTabsState, tabId: string): boolean => {
  if (!state.tabs.some((tab) => tab.id === tabId)) return false;
  state.activeTabId = tabId;
  return true;
};

export interface RemoveTabResult {
  removed: boolean;
  /** 닫힌 탭이 활성 탭이었을 때 새로 활성화된 탭 (없으면 null) */
  activated: ReaderTab | null;
}

/**
 * 탭을 닫는다. 활성 탭을 닫으면 다음 이웃(없으면 이전 이웃)을 활성화한다.
 * 마지막 남은 탭은 닫을 수 없다 — removed:false 를 반환한다.
 */
export const removeTab = (state: ReaderTabsState, tabId: string): RemoveTabResult => {
  const index = state.tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return { removed: false, activated: null };
  if (state.tabs.length <= 1) return { removed: false, activated: null };

  const wasActive = state.activeTabId === tabId;
  state.tabs.splice(index, 1);

  let activated: ReaderTab | null = null;
  if (wasActive) {
    activated = state.tabs[index] ?? state.tabs[index - 1] ?? null;
    state.activeTabId = activated?.id ?? null;
  }
  return { removed: true, activated };
};

/** 탭의 스냅샷과 라벨을 갱신한다. */
export const updateTabSnapshot = (
  state: ReaderTabsState,
  tabId: string,
  snapshot: ReaderTabSnapshot,
  label: string,
): void => {
  const tab = state.tabs.find((t) => t.id === tabId);
  if (!tab) return;
  tab.snapshot = snapshot;
  tab.label = label;
};

export const setBarVisible = (state: ReaderTabsState, visible: boolean): void => {
  state.barVisible = visible;
};

export const serializeTabsState = (state: ReaderTabsState): string =>
  JSON.stringify(state);

const isValidSnapshot = (value: unknown): value is ReaderTabSnapshot => {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as ReaderTabSnapshot;
  if (typeof s.book !== 'string' || !isBibleBook(s.book)) return false;
  if (typeof s.chapter !== 'number' || !Number.isInteger(s.chapter)) return false;
  if (s.chapter < 1 || s.chapter > chapterCount(s.book)) return false;
  if (typeof s.version !== 'string' || s.version.length === 0) return false;
  if (
    typeof s.scrollPosition !== 'number' ||
    !Number.isFinite(s.scrollPosition) ||
    s.scrollPosition < 0 ||
    s.scrollPosition > 1
  ) {
    return false;
  }
  return true;
};

const isValidTab = (value: unknown): value is ReaderTab => {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as ReaderTab;
  return (
    typeof t.id === 'string' &&
    typeof t.label === 'string' &&
    isValidSnapshot(t.snapshot)
  );
};

/**
 * 저장된 문자열을 상태로 복원한다.
 * 깨진 입력은 빈 상태로, activeTabId가 가리키는 탭이 없으면 첫 탭으로 복구한다.
 */
export const parseTabsState = (raw: string | null): ReaderTabsState => {
  const fallback = createTabsState();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<ReaderTabsState>;
    if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.tabs)) {
      return fallback;
    }
    const tabs = parsed.tabs.filter(isValidTab);
    const activeTabId =
      typeof parsed.activeTabId === 'string' &&
      tabs.some((t) => t.id === parsed.activeTabId)
        ? parsed.activeTabId
        : (tabs[0]?.id ?? null);
    return {
      tabs,
      activeTabId,
      barVisible: parsed.barVisible === true,
    };
  } catch {
    return fallback;
  }
};

/** AsyncStorage에서 탭 상태를 읽는다. 실패·깨진 값은 빈 상태로 복구한다. */
export const loadReaderTabs = async (
  storage: ReaderTabsStorage,
): Promise<ReaderTabsState> => {
  try {
    return parseTabsState(await storage.getItem(READER_TABS_STORAGE_KEY));
  } catch (error) {
    console.warn('[ReaderTabs] load failed:', error);
    return createTabsState();
  }
};

/** 탭 상태를 AsyncStorage에 쓴다. 쓰기 실패는 삼킨다(영속화는 best-effort). */
export const saveReaderTabs = async (
  storage: ReaderTabsStorage,
  state: ReaderTabsState,
): Promise<void> => {
  try {
    await storage.setItem(READER_TABS_STORAGE_KEY, serializeTabsState(state));
  } catch (error) {
    console.warn('[ReaderTabs] save failed:', error);
  }
};
