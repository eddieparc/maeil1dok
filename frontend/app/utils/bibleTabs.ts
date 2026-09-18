/**
 * bibleTabs - 성경 리더 탭 상태의 순수 로직
 *
 * 탭은 "저장된 본문 위치"다. 리더 자체는 항상 하나만 살아 있고,
 * 탭 전환 시 현재 상태를 스냅샷으로 저장한 뒤 대상 탭의 스냅샷을 복원한다.
 * Pinia 스토어(app/stores/bibleTabs.ts)가 이 순수 함수들로 상태를 갱신하고
 * localStorage에 영속화한다.
 */

export interface BibleTabTongdok {
  enabled: boolean;
  scheduleId: number | null;
  planId: number | null;
}

export interface BibleTabSnapshot {
  book: string;
  chapter: number;
  version: string;
  scrollPosition: number;
  tongdok: BibleTabTongdok | null;
  /** useTongdokMode의 readingDetailResponse — 통독 범위·진행·오디오 폴백 */
  readingDetail: unknown;
}

export interface BibleTab {
  id: string;
  label: string;
  snapshot: BibleTabSnapshot;
}

export interface BibleTabsState {
  tabs: BibleTab[];
  activeTabId: string | null;
  barVisible: boolean;
}

export const createTabsState = (): BibleTabsState => ({
  tabs: [],
  activeTabId: null,
  barVisible: false,
});

const createTabId = (): string =>
  `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** 새 탭을 추가하고 활성화한다. 추가된 탭을 반환한다. */
export const addTab = (
  state: BibleTabsState,
  snapshot: BibleTabSnapshot,
  label: string,
): BibleTab => {
  const tab: BibleTab = { id: createTabId(), label, snapshot };
  state.tabs.push(tab);
  state.activeTabId = tab.id;
  return tab;
};

/** 대상 탭을 활성화한다. 존재하면 true, 아니면 false. */
export const activateTab = (state: BibleTabsState, tabId: string): boolean => {
  if (!state.tabs.some((tab) => tab.id === tabId)) return false;
  state.activeTabId = tabId;
  return true;
};

export interface RemoveTabResult {
  removed: boolean;
  /** 닫힌 탭이 활성 탭이었을 때 새로 활성화된 탭 (없으면 null) */
  activated: BibleTab | null;
}

/**
 * 탭을 닫는다. 활성 탭을 닫으면 다음 이웃(없으면 이전 이웃)을 활성화한다.
 */
export const removeTab = (state: BibleTabsState, tabId: string): RemoveTabResult => {
  const index = state.tabs.findIndex((tab) => tab.id === tabId);
  if (index === -1) return { removed: false, activated: null };

  const wasActive = state.activeTabId === tabId;
  state.tabs.splice(index, 1);

  let activated: BibleTab | null = null;
  if (wasActive) {
    activated = state.tabs[index] ?? state.tabs[index - 1] ?? null;
    state.activeTabId = activated?.id ?? null;
  }
  return { removed: true, activated };
};

/** 탭의 스냅샷과 라벨을 갱신한다. */
export const updateTabSnapshot = (
  state: BibleTabsState,
  tabId: string,
  snapshot: BibleTabSnapshot,
  label: string,
): void => {
  const tab = state.tabs.find((t) => t.id === tabId);
  if (!tab) return;
  tab.snapshot = snapshot;
  tab.label = label;
};

export const setBarVisible = (state: BibleTabsState, visible: boolean): void => {
  state.barVisible = visible;
};

export const serializeTabsState = (state: BibleTabsState): string =>
  JSON.stringify(state);

const isValidSnapshot = (value: unknown): value is BibleTabSnapshot => {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as BibleTabSnapshot;
  return typeof s.book === 'string' && typeof s.chapter === 'number';
};

const isValidTab = (value: unknown): value is BibleTab => {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as BibleTab;
  return typeof t.id === 'string' && typeof t.label === 'string' && isValidSnapshot(t.snapshot);
};

/**
 * localStorage에서 읽은 문자열을 상태로 복원한다.
 * 깨진 입력은 빈 상태로, activeTabId가 가리키는 탭이 없으면 첫 탭으로 복구한다.
 */
export const parseTabsState = (raw: string | null): BibleTabsState => {
  const fallback = createTabsState();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<BibleTabsState>;
    if (!Array.isArray(parsed.tabs)) return fallback;
    const tabs = parsed.tabs.filter(isValidTab);
    const activeTabId =
      typeof parsed.activeTabId === 'string' && tabs.some((t) => t.id === parsed.activeTabId)
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
