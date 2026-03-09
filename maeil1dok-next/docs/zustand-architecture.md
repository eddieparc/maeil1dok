# Zustand Architecture for Maeil1Dok Next.js

## 문서 목적

- 이 문서는 `maeil1dok-next`의 전역 상태를 Zustand로 설계하기 위한 아키텍처 기준서다.
- 현재 React hook 기반 분산 상태(`ReadingSettingsContext`, `useBiblePageState`, `useTongdokMode`)와 Nuxt의 Pinia 구조를 분석해 도메인 단위 Zustand 구조로 통합한다.
- 실제 스토어 구현 코드는 포함하지 않고, 도메인 경계, SSR 패턴, 미들웨어 정책, persist 정책, 스토어 간 통신 규칙, 테스트 전략만 정의한다.
- 본 문서는 App Router + SSR 환경에서 hydration mismatch 없이 동작하는 패턴을 표준으로 삼는다.
- 모듈 전역 singleton store를 기본값으로 두지 않는다.

## 배경 요약

- 참고 원본 1: `src/hooks/bible/ReadingSettingsContext.tsx`
- 참고 원본 2: `src/hooks/bible/useBiblePageState.ts`
- 참고 원본 3: `src/hooks/bible/useTongdokMode.ts`
- 참고 원본 4: `frontend/app/stores/readingSettings.ts`
- 참고 원본 5: `frontend/app/composables/bible/useBiblePageState.ts`
- 참고 원본 6: `frontend/app/composables/bible/useBibleModals.ts`

핵심 관찰:

- 읽기 설정은 localStorage + 서버 동기화 + CSS 변수 반영 + 디바운스 저장을 동시에 수행한다.
- 성경 페이지 상태는 book/chapter/version/viewMode와 탐색 로직을 포함한다.
- 통독 모드는 schedule/progress 기반 비즈니스 로직과 localStorage 복원을 가진다.
- 모달 상태는 여러 boolean 플래그 중심의 UI 상태다.
- 기존 구조는 기능적으로 분리되어 있으나, 상태 정의와 액션이 hook 별로 분산되어 재사용성과 테스트 격리가 떨어진다.

---

## 1) Store Domains

아키텍처는 다음 7개 도메인 스토어를 기준으로 한다.

1. `auth`
2. `bible` (biblePageState)
3. `readingSettings`
4. `tongdok`
5. `modals`
6. `ui`
7. `notifications`

도메인 원칙:

- 도메인 스토어는 상태와 도메인 액션만 가진다.
- 네트워크 호출은 액션 내부에서 허용하되, API client는 주입 가능한 의존성으로 다룬다.
- 도메인 간 직접 참조를 피하고, selector/subscribe/event 방식으로 연결한다.
- 각 스토어는 자체 초기 상태를 명시한다.

### 1.1 Shared Primitive Types

```ts
export type ThemeMode = 'light' | 'dark' | 'system'
export type FontFamily =
  | 'ridi-batang'
  | 'noto-serif'
  | 'kopub-batang'
  | 'pretendard'
  | 'noto-sans'
  | 'system'
export type FontWeight = 'normal' | 'medium' | 'bold'
export type TextAlign = 'left' | 'justify'

export type ViewMode = 'home' | 'toc' | 'reader'
export type BibleVersion = 'GAE' | 'KNT' | 'NKRV'

export interface AsyncMeta {
  isLoading: boolean
  error: string | null
}
```

### 1.2 Auth Domain Interface

```ts
export interface AuthUser {
  id: string
  email: string | null
  nickname: string | null
  profileImageUrl: string | null
}

export interface AuthState {
  sessionToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  isAuthenticated: boolean
  isBootstrapped: boolean
  authMeta: AsyncMeta
}

export interface AuthActions {
  bootstrapAuth: () => Promise<void>
  loginWithOAuth: (provider: 'kakao' | 'google') => Promise<void>
  logout: () => Promise<void>
  setSession: (payload: {
    sessionToken: string
    refreshToken: string
    user: AuthUser
  }) => void
  clearSession: () => void
}

export type AuthStore = AuthState & AuthActions
```

### 1.3 Bible Domain Interface

```ts
export interface BibleState {
  viewMode: ViewMode
  currentBook: string
  currentChapter: number
  currentVersion: BibleVersion
  lastVisitedAt: string | null
  chapterHistory: string[]
}

export interface BibleSelectorsDerived {
  currentBookName: string
  currentVersionName: string
  maxChapters: number
  chapterSuffix: '장' | '편'
  hasPrevChapter: boolean
  hasNextChapter: boolean
}

export interface BibleActions {
  setViewMode: (mode: ViewMode) => void
  selectBook: (book: string) => void
  selectChapter: (chapter: number) => void
  selectVersion: (version: BibleVersion) => void
  goToPrevChapter: () => void
  goToNextChapter: () => void
  initFromQuery: (params: Record<string, string>) => void
  pushHistory: (book: string, chapter: number) => void
}

export type BibleStore = BibleState & BibleActions
```

### 1.4 Reading Settings Domain Interface

```ts
export interface ReadingSettingsState {
  theme: ThemeMode
  fontFamily: FontFamily
  fontSize: number
  fontWeight: FontWeight
  lineHeight: number
  textAlign: TextAlign
  verseJoining: boolean
  showVerseNumbers: boolean
  tongdokAutoComplete: boolean
  showDescription: boolean
  showCrossRef: boolean
  highlightNames: boolean
  showFootnotes: boolean
  isSyncing: boolean
  lastSyncedAt: string | null
}

export interface ReadingSettingsActions {
  updateSetting: <K extends keyof Omit<
    ReadingSettingsState,
    'isSyncing' | 'lastSyncedAt'
  >>(
    key: K,
    value: ReadingSettingsState[K],
  ) => void
  updateSettings: (
    updates: Partial<
      Omit<ReadingSettingsState, 'isSyncing' | 'lastSyncedAt'>
    >,
  ) => void
  resetSettings: () => void
  applyThemeToDocument: () => void
  syncFromServer: () => Promise<void>
  syncToServer: () => Promise<void>
}

export type ReadingSettingsStore =
  ReadingSettingsState & ReadingSettingsActions
```

### 1.5 Tongdok Domain Interface

```ts
export interface TongdokSchedule {
  id: string
  planId: string
  date: string | null
  book: string
  startChapter: number
  endChapter: number
  audioLink: string | null
  guideLink: string | null
}

export interface TongdokProgress {
  scheduleId: string
  isCompleted: boolean
  subscriptionId: string | null
}

export interface TongdokState {
  enabled: boolean
  scheduleId: string | null
  planId: string | null
  schedules: TongdokSchedule[]
  progressList: TongdokProgress[]
  completedChapters: Set<string>
  bookmarksByBook: Map<string, number>
}

export interface TongdokActions {
  enableTongdokMode: (scheduleId: string, planId: string) => void
  disableTongdokMode: () => void
  loadReadingDetail: (planId: string) => Promise<void>
  completeReading: () => Promise<boolean>
  markChapterCompleted: (book: string, chapter: number) => void
  setBookBookmark: (book: string, chapter: number) => void
}

export type TongdokStore = TongdokState & TongdokActions
```

### 1.6 Modals Domain Interface

```ts
export interface HighlightSelection {
  start: number
  end: number
}

export interface ModalsState {
  showBookSelector: boolean
  showVersionSelector: boolean
  showTongdokCompleteModal: boolean
  showNoteModal: boolean
  showHighlightModal: boolean
  showSettingsModal: boolean
  highlightSelection: HighlightSelection | null
}

export interface ModalsActions {
  openBookSelector: () => void
  closeBookSelector: () => void
  openVersionSelector: () => void
  closeVersionSelector: () => void
  openTongdokCompleteModal: () => void
  closeTongdokCompleteModal: () => void
  openNoteModal: () => void
  closeNoteModal: () => void
  openHighlightModal: (selection: HighlightSelection) => void
  closeHighlightModal: () => void
  openSettingsModal: () => void
  closeSettingsModal: () => void
  closeAllModals: () => void
}

export type ModalsStore = ModalsState & ModalsActions
```

### 1.7 UI Domain Interface

```ts
export interface UiState {
  isMobileMenuOpen: boolean
  isGlobalPending: boolean
  routeTransitioning: boolean
  prefersReducedMotion: boolean
  viewport: {
    width: number
    height: number
  }
}

export interface UiActions {
  openMobileMenu: () => void
  closeMobileMenu: () => void
  setGlobalPending: (pending: boolean) => void
  setRouteTransitioning: (value: boolean) => void
  setViewport: (payload: { width: number; height: number }) => void
  bootstrapUi: () => void
}

export type UiStore = UiState & UiActions
```

### 1.8 Notifications Domain Interface

```ts
export type NotificationLevel = 'info' | 'success' | 'warning' | 'error'

export interface NotificationItem {
  id: string
  level: NotificationLevel
  title: string
  description: string
  createdAt: string
  autoCloseMs: number | null
}

export interface NotificationsState {
  queue: NotificationItem[]
  unreadCount: number
}

export interface NotificationsActions {
  enqueue: (item: Omit<NotificationItem, 'id' | 'createdAt'>) => string
  remove: (id: string) => void
  clearAll: () => void
  markAllRead: () => void
}

export type NotificationsStore = NotificationsState & NotificationsActions
```

### 1.9 Domain Factory Examples (`createStore()` only)

```ts
import { createStore } from 'zustand/vanilla'

export const createAuthStore = (init?: Partial<AuthStore>) =>
  createStore<AuthStore>()((set) => ({
    sessionToken: null,
    refreshToken: null,
    user: null,
    isAuthenticated: false,
    isBootstrapped: false,
    authMeta: { isLoading: false, error: null },
    bootstrapAuth: async () => {},
    loginWithOAuth: async () => {},
    logout: async () => {},
    setSession: ({ sessionToken, refreshToken, user }) =>
      set({ sessionToken, refreshToken, user, isAuthenticated: true }),
    clearSession: () =>
      set({
        sessionToken: null,
        refreshToken: null,
        user: null,
        isAuthenticated: false,
      }),
    ...init,
  }))

export const createBibleStore = (init?: Partial<BibleStore>) =>
  createStore<BibleStore>()((set) => ({
    viewMode: 'home',
    currentBook: 'gen',
    currentChapter: 1,
    currentVersion: 'GAE',
    lastVisitedAt: null,
    chapterHistory: [],
    setViewMode: (mode) => set({ viewMode: mode }),
    selectBook: (book) => set({ currentBook: book }),
    selectChapter: (chapter) => set({ currentChapter: chapter }),
    selectVersion: (version) => set({ currentVersion: version }),
    goToPrevChapter: () => {},
    goToNextChapter: () => {},
    initFromQuery: () => {},
    pushHistory: () => {},
    ...init,
  }))

export const createReadingSettingsStore = (
  init?: Partial<ReadingSettingsStore>,
) =>
  createStore<ReadingSettingsStore>()((set) => ({
    theme: 'light',
    fontFamily: 'kopub-batang',
    fontSize: 16,
    fontWeight: 'medium',
    lineHeight: 1.6,
    textAlign: 'left',
    verseJoining: false,
    showVerseNumbers: true,
    tongdokAutoComplete: false,
    showDescription: true,
    showCrossRef: true,
    highlightNames: true,
    showFootnotes: false,
    isSyncing: false,
    lastSyncedAt: null,
    updateSetting: (key, value) => set({ [key]: value } as Partial<ReadingSettingsStore>),
    updateSettings: (updates) => set(updates),
    resetSettings: () => {},
    applyThemeToDocument: () => {},
    syncFromServer: async () => {},
    syncToServer: async () => {},
    ...init,
  }))

export const createTongdokStore = (init?: Partial<TongdokStore>) =>
  createStore<TongdokStore>()((set) => ({
    enabled: false,
    scheduleId: null,
    planId: null,
    schedules: [],
    progressList: [],
    completedChapters: new Set<string>(),
    bookmarksByBook: new Map<string, number>(),
    enableTongdokMode: (scheduleId, planId) => set({ enabled: true, scheduleId, planId }),
    disableTongdokMode: () => set({ enabled: false, scheduleId: null, planId: null }),
    loadReadingDetail: async () => {},
    completeReading: async () => false,
    markChapterCompleted: () => {},
    setBookBookmark: () => {},
    ...init,
  }))

export const createModalsStore = (init?: Partial<ModalsStore>) =>
  createStore<ModalsStore>()((set) => ({
    showBookSelector: false,
    showVersionSelector: false,
    showTongdokCompleteModal: false,
    showNoteModal: false,
    showHighlightModal: false,
    showSettingsModal: false,
    highlightSelection: null,
    openBookSelector: () => set({ showBookSelector: true }),
    closeBookSelector: () => set({ showBookSelector: false }),
    openVersionSelector: () => set({ showVersionSelector: true }),
    closeVersionSelector: () => set({ showVersionSelector: false }),
    openTongdokCompleteModal: () => set({ showTongdokCompleteModal: true }),
    closeTongdokCompleteModal: () => set({ showTongdokCompleteModal: false }),
    openNoteModal: () => set({ showNoteModal: true }),
    closeNoteModal: () => set({ showNoteModal: false }),
    openHighlightModal: (selection) =>
      set({ showHighlightModal: true, highlightSelection: selection }),
    closeHighlightModal: () => set({ showHighlightModal: false }),
    openSettingsModal: () => set({ showSettingsModal: true }),
    closeSettingsModal: () => set({ showSettingsModal: false }),
    closeAllModals: () =>
      set({
        showBookSelector: false,
        showVersionSelector: false,
        showTongdokCompleteModal: false,
        showNoteModal: false,
        showHighlightModal: false,
        showSettingsModal: false,
      }),
    ...init,
  }))

export const createUiStore = (init?: Partial<UiStore>) =>
  createStore<UiStore>()((set) => ({
    isMobileMenuOpen: false,
    isGlobalPending: false,
    routeTransitioning: false,
    prefersReducedMotion: false,
    viewport: { width: 0, height: 0 },
    openMobileMenu: () => set({ isMobileMenuOpen: true }),
    closeMobileMenu: () => set({ isMobileMenuOpen: false }),
    setGlobalPending: (pending) => set({ isGlobalPending: pending }),
    setRouteTransitioning: (value) => set({ routeTransitioning: value }),
    setViewport: (payload) => set({ viewport: payload }),
    bootstrapUi: () => {},
    ...init,
  }))

export const createNotificationsStore = (init?: Partial<NotificationsStore>) =>
  createStore<NotificationsStore>()((set) => ({
    queue: [],
    unreadCount: 0,
    enqueue: (item) => {
      const id = crypto.randomUUID()
      set((state) => ({
        queue: [
          ...state.queue,
          {
            ...item,
            id,
            createdAt: new Date().toISOString(),
          },
        ],
        unreadCount: state.unreadCount + 1,
      }))
      return id
    },
    remove: (id) =>
      set((state) => ({ queue: state.queue.filter((x) => x.id !== id) })),
    clearAll: () => set({ queue: [], unreadCount: 0 }),
    markAllRead: () => set({ unreadCount: 0 }),
    ...init,
  }))
```

---

## 2) SSR Pattern

### 2.1 왜 글로벌 singleton store가 위험한가

Zustand의 store는 모듈 상태(module state)로 취급된다. Next.js App Router SSR에서 전역 singleton store를 쓰면 다음 리스크가 있다.

- 요청 간 상태 누수: 동시에 들어온 요청이 같은 서버 메모리 store를 공유할 수 있다.
- hydration mismatch: 서버 렌더 상태와 클라이언트 초기 상태가 다르면 경고/오동작이 발생한다.
- 테스트 오염: 테스트 케이스 간 singleton 상태가 섞여 flaky해진다.

따라서 **요청 단위 혹은 provider 단위 store 인스턴스 생성**이 기본 전략이다.

### 2.2 `createStore()` factory + Provider 패턴

표준 패턴은 `zustand/vanilla`의 `createStore`를 사용해 factory를 만들고, React Context Provider에서 `useState(() => createXStore())`로 단 한번 초기화한다.

```tsx
'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'

interface CounterState {
  count: number
}

interface CounterActions {
  inc: () => void
  dec: () => void
}

type CounterStore = CounterState & CounterActions

const createCounterStore = (initState: CounterState = { count: 0 }) => {
  return createStore<CounterStore>()((set) => ({
    ...initState,
    inc: () => set((s) => ({ count: s.count + 1 })),
    dec: () => set((s) => ({ count: s.count - 1 })),
  }))
}

type CounterStoreApi = StoreApi<CounterStore>

const CounterStoreContext = createContext<CounterStoreApi | null>(null)

export function CounterStoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createCounterStore())
  return (
    <CounterStoreContext.Provider value={store}>
      {children}
    </CounterStoreContext.Provider>
  )
}

export function useCounterStore<T>(selector: (state: CounterStore) => T): T {
  const ctx = useContext(CounterStoreContext)
  if (!ctx) {
    throw new Error('useCounterStore must be used within CounterStoreProvider')
  }
  return useStore(ctx, selector)
}
```

### 2.3 App Router 적용 규칙

- 각 도메인 Provider는 `app` 트리의 필요한 범위에서만 감싼다.
- 전역이 필요한 store만 Root Layout에 둔다.
- 페이지 단위 초기화가 필요한 store는 route segment layout/provider에 둔다.
- 서버에서 preload한 값이 있으면 `initState`로 주입한다.

### 2.4 SSR/Hydration 일관성 체크리스트

- 서버와 클라이언트에서 동일한 초기 값을 사용한다.
- 시간 의존 값(`Date.now`, `Math.random`)은 초기 상태 계산에서 직접 사용하지 않는다.
- 브라우저 API(`window`, `localStorage`) 접근은 action 또는 hydration 이후 effect로 지연한다.

---

## 3) Middleware Stack

권장 래핑 순서(외부 -> 내부):

1. `devtools`
2. `persist`
3. `subscribeWithSelector`

즉, 코드 구조는 아래와 같다.

```ts
const store = createStore<SomeStore>()(
  devtools(
    persist(
      subscribeWithSelector((set, get) => ({
        // state + actions
      })),
      {
        name: 'some-store',
      },
    ),
    { name: 'SomeStore' },
  ),
)
```

### 3.1 역할 분리

- `subscribeWithSelector`
  - selector 기반 정밀 구독 제공
  - 불필요한 리렌더 및 과한 이벤트 전파를 줄임
  - inter-store communication의 기반이 됨
- `persist`
  - localStorage/sessionStorage 저장/복원 담당
  - `partialize`, `merge`, `version`, `migrate` 전략을 제공
- `devtools`
  - 액션 이름 추적, 타임라인 디버깅
  - 개발 단계에서 상태 전이 가시성 향상

### 3.2 이 순서를 쓰는 이유

- 내부에서 selector 기반 구독 컨텍스트를 먼저 만든 뒤,
- 그 결과를 persist로 저장 정책에 묶고,
- 최외곽에서 devtools가 전체 액션 흐름을 관측하는 구조가 가장 직관적이다.

### 3.3 환경별 정책

- production에서는 `devtools`를 비활성화할 수 있다.
- persist 저장소 접근은 클라이언트에서만 가능하므로 SSR 시 안전한 storage guard를 둔다.
- 마이그레이션 필요 store는 `version`과 `migrate`를 의무화한다.

---

## 4) Persistence

### 4.1 기본 persist 설정 원칙

- 저장소: `localStorage`
- 저장 키: 도메인별 prefix 사용 (예: `maeil1dok:reading-settings`, `maeil1dok:tongdok`)
- 최소 저장: `partialize`로 필요한 필드만 저장
- 호환성: `version` + `migrate`로 스키마 진화 대응
- 복원 안전성: `merge`에서 current state와 persisted state를 병합

예시:

```ts
import { createJSONStorage, persist } from 'zustand/middleware'

persist(stateCreator, {
  name: 'maeil1dok:reading-settings',
  storage: createJSONStorage(() => localStorage),
  version: 1,
  partialize: (state) => ({
    theme: state.theme,
    fontFamily: state.fontFamily,
    fontSize: state.fontSize,
    fontWeight: state.fontWeight,
    lineHeight: state.lineHeight,
    textAlign: state.textAlign,
    verseJoining: state.verseJoining,
    showVerseNumbers: state.showVerseNumbers,
    tongdokAutoComplete: state.tongdokAutoComplete,
    showDescription: state.showDescription,
    showCrossRef: state.showCrossRef,
    highlightNames: state.highlightNames,
    showFootnotes: state.showFootnotes,
  }),
})
```

### 4.2 Set/Map 직렬화 전략

JSON은 `Set`/`Map`을 직접 직렬화하지 못한다. 따라서 `partialize`에서 배열 형태로 변환하고, `merge`에서 다시 복원한다.

요구사항 예시: `completedChapters: Set<string>`

```ts
import { createStore } from 'zustand/vanilla'
import {
  devtools,
  persist,
  subscribeWithSelector,
  createJSONStorage,
} from 'zustand/middleware'

interface TongdokState {
  enabled: boolean
  completedChapters: Set<string>
  bookmarksByBook: Map<string, number>
  markChapterCompleted: (book: string, chapter: number) => void
  setBookBookmark: (book: string, chapter: number) => void
}

type PersistedTongdokShape = {
  enabled: boolean
  completedChapters: string[]
  bookmarksByBook: [string, number][]
}

export const createTongdokStore = () => {
  return createStore<TongdokState>()(
    devtools(
      persist(
        subscribeWithSelector((set) => ({
          enabled: false,
          completedChapters: new Set<string>(),
          bookmarksByBook: new Map<string, number>(),
          markChapterCompleted: (book, chapter) =>
            set((state) => {
              const next = new Set(state.completedChapters)
              next.add(`${book}:${chapter}`)
              return { completedChapters: next }
            }),
          setBookBookmark: (book, chapter) =>
            set((state) => {
              const next = new Map(state.bookmarksByBook)
              next.set(book, chapter)
              return { bookmarksByBook: next }
            }),
        })),
        {
          name: 'maeil1dok:tongdok',
          storage: createJSONStorage(() => localStorage),
          partialize: (state): PersistedTongdokShape => ({
            enabled: state.enabled,
            completedChapters: Array.from(state.completedChapters),
            bookmarksByBook: Array.from(state.bookmarksByBook.entries()),
          }),
          merge: (persisted, current) => {
            const p = (persisted ?? {}) as Partial<PersistedTongdokShape>
            return {
              ...current,
              enabled: p.enabled ?? current.enabled,
              completedChapters: new Set(p.completedChapters ?? []),
              bookmarksByBook: new Map(p.bookmarksByBook ?? []),
            }
          },
        },
      ),
      { name: 'TongdokStore' },
    ),
  )
}
```

### 4.3 마이그레이션 정책

- version 증가 시 `migrate`로 이전 저장 데이터를 변환한다.
- 변환 실패 시 안전한 기본값으로 fallback한다.
- 파괴적 변경(필드 타입 변경)은 `merge`에서 방어적으로 처리한다.

### 4.4 SSR 환경 주의점

- `localStorage` 접근은 브라우저 전용이므로 client boundary 내부에서만 실행한다.
- 서버 렌더 단계에서 persist를 강제로 rehydrate하지 않는다.
- 초기 화면은 SSR-safe default state로 그린 뒤 클라이언트에서 rehydrate한다.

---

## 5) Inter-store Communication

### 5.1 기본 원칙

- 스토어 A가 스토어 B의 state/action을 직접 import해서 호출하지 않는다.
- 도메인 경계를 유지하기 위해 다음 순서를 따른다.
  1) selector 구독
  2) 이벤트/콜백
  3) 상위 조합 레이어(orchestration hook)
- cross-store 트랜잭션이 필요하면 별도 coordinator 계층에서 처리한다.

### 5.2 `subscribe` API 패턴

`subscribeWithSelector`를 사용하면 특정 필드 변화에만 반응할 수 있다.

```ts
// 예시: auth 상태가 logout 되면 notifications 정리
const unsubAuth = authStore.subscribe(
  (state) => state.isAuthenticated,
  (isAuthenticated, prev) => {
    if (prev && !isAuthenticated) {
      notificationsStore.getState().clearAll()
      modalsStore.getState().closeAllModals()
    }
  },
)

// 페이지 unmount 혹은 teardown 시
unsubAuth()
```

### 5.3 추천 조합 시나리오

- `readingSettings.theme` 변경 -> `ui` 도메인의 문서 테마 적용 액션 트리거
- `tongdok.completeReading` 성공 -> `notifications.enqueue(success)` 발행
- `auth.clearSession` -> `tongdok`/`readingSettings` 민감 필드 reset

### 5.4 안티 패턴

- store 생성 시점에 다른 store를 즉시 참조해 순환 의존을 만드는 패턴
- selector 없이 전체 state를 subscribe하여 불필요한 후처리를 유발하는 패턴
- 한 액션에서 다수 store를 직접 mutate하는 패턴

---

## 6) Testing Pattern

테스트 목표:

- 각 테스트 케이스는 깨끗한 store 상태에서 시작한다.
- React 컴포넌트 테스트는 store provider 주입을 표준화한다.
- persist/rehydrate 부작용을 테스트 간 공유하지 않는다.

### 6.1 Store Reset Registry 패턴 (`createStore` factory 전용)

테스트에서 생성한 vanilla store를 레지스트리에 등록하고 `afterEach`에서 초기 상태로 되돌린다.

```ts
// src/test/storeResetRegistry.ts
import { act } from '@testing-library/react'
import type { StoreApi } from 'zustand/vanilla'

const storeResetFns = new Set<() => void>()

export const registerStore = <T extends object>(store: StoreApi<T>) => {
  const initial = store.getInitialState()
  storeResetFns.add(() => {
    store.setState(initial, true)
  })
  return store
}

export const resetAllStores = () => {
  act(() => {
    storeResetFns.forEach((fn) => fn())
  })
}
```

### 6.2 `afterEach` 자동 리셋

```ts
// src/test/setup.ts
import { afterEach } from 'vitest'
import { resetAllStores } from '@/test/storeResetRegistry'

afterEach(() => {
  resetAllStores()
})
```

### 6.3 `renderWithStore` 유틸리티

컴포넌트 테스트에서 provider 반복 코드를 줄인다.

```tsx
// src/test/renderWithStore.tsx
import { render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'

import { BibleStoreProvider } from '@/providers/bible-store-provider'
import { ReadingSettingsStoreProvider } from '@/providers/reading-settings-store-provider'

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <ReadingSettingsStoreProvider>
      <BibleStoreProvider>{children}</BibleStoreProvider>
    </ReadingSettingsStoreProvider>
  )
}

export function renderWithStore(ui: ReactElement) {
  return render(ui, { wrapper: Wrapper })
}
```

### 6.4 도메인 테스트 우선순위

1. bible navigation 경계 케이스(창세기 1장 이전/요한계시록 마지막 장 이후)
2. readingSettings local persist + server merge 충돌 케이스
3. tongdok `Set`/`Map` rehydrate 정확성
4. modals `closeAllModals` 일관성
5. inter-store subscribe side effect teardown 누락 방지

---

## 도입 순서 제안

- Phase 1: `readingSettings` + `bible` store factory 도입
- Phase 2: `tongdok` + `modals` 전환
- Phase 3: `auth` + `ui` + `notifications` 정리
- Phase 4: inter-store subscribe 통합/최적화
- Phase 5: 테스트 유틸리티/모킹 고정

## 결정 사항 요약

- 전역 singleton 대신 provider-scoped factory store를 채택한다.
- 미들웨어 순서는 `devtools -> persist -> subscribeWithSelector`를 기본으로 고정한다.
- persist는 `partialize` + `merge`를 강제해 schema 안전성을 확보한다.
- `Set`/`Map` 필드는 배열 변환 저장 후 복원한다.
- 스토어 간 통신은 subscribe 기반으로 최소 결합을 유지한다.
- 테스트는 `afterEach` 자동 리셋과 `renderWithStore`를 표준으로 한다.

## 참고 출처

- Zustand Next.js Guide: App Router에서 `createStore` factory + Provider + `useState(() => createStore())` 패턴
- Zustand Persist Integration: `partialize`, `merge`, custom serialization(Map/Set)
