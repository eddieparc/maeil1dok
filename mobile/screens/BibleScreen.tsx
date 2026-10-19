import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth/AuthSession';
import { useAppStack } from '../navigation/AppStackContext';
import { navigationRef, type TabParamList } from '../navigation/navigationRef';
import { useNativeTabBarInset } from '../navigation/NativeTabBar';
import ReaderTabs from '../components/bible/ReaderTabs';
import ReaderTongdokControls from '../components/bible/ReaderTongdokControls';
import ReaderTongdokSchedule from '../components/bible/ReaderTongdokSchedule';
import { createReaderTongdok } from '../api/readerTongdok';
import ReadingSettingsSheet from '../components/bible/ReadingSettingsSheet';
import ReaderBody from '../components/bible/ReaderBody';
import { useReadingSettings } from '../components/bible/ReadingSettingsProvider';
import ReaderAudioPlayer from '../components/bible/ReaderAudioPlayer';
import { parseReaderAudioResponse, selectReaderAudioLink, PLAYBACK_RATES } from '../api/readerAudio';
import {
  activateTab,
  addTab,
  cloneTabsState,
  createTabsState,
  loadReaderTabs,
  removeTab,
  saveReaderTabs,
  setBarVisible,
  updateTabSnapshot,
  type ReaderTabsState,
  type ReaderTabSnapshot,
} from '../api/readerTabs';
import {
  BIBLE_BOOKS,
  bookCode,
  chapterCount,
  chapterLabel,
  chapterUnit,
  isBibleBook,
  nextChapter,
  parseBibleReaderRoute,
  prevChapter,
  type BibleBook,
  type ChapterRef,
  type BibleReaderRoute,
} from '../api/bibleBooks';
import {
  normalizeVersionList,
  parseBibleContent,
  type BibleBlock,
  type BibleVersion,
} from '../api/bibleContent';
import { readerScrollProgress } from '../api/readerProgress';
import { normalizeSubscriptions, pickDefaultPlan, type PlanSubscription } from '../api/scheduleData';

const BG = '#FAF8F5';
const CARD = '#FFFFFF';
const TEXT = '#1F1A17';
const SECONDARY = '#6B625B';
const TERTIARY = '#9B928A';
const BORDER = '#E9E4DE';
const ACCENT = '#2A1111';
const ACCENT_BG = '#F3EEEE';
const SERIF = 'NotoSerifKR-Regular';
const SERIF_BOLD = 'NotoSerifKR-Bold';
const VERSE_BLUE = '#3B5BA9';

/** 앱에 노출하는 한국어 역본 (서버 목록 중 이 코드만 표시). */
const VISIBLE_VERSION_CODES = ['GAE', 'KNT', 'SAENEW', 'HAN', 'SAE', 'COG', 'COGNEW'] as const;
const VISIBLE_VERSION_SET = new Set<string>(VISIBLE_VERSION_CODES);

/** versions API 실패 시 사용하는 정적 폴백. */
const FALLBACK_VERSIONS: readonly BibleVersion[] = [
  { code: 'GAE', name: '개역개정' },
  { code: 'KNT', name: '새한글' },
  { code: 'SAENEW', name: '새번역' },
  { code: 'HAN', name: '개역한글' },
  { code: 'SAE', name: '표준새번역' },
  { code: 'COG', name: '공동번역' },
  { code: 'COGNEW', name: '공동번역 개정판' },
];

const DEFAULT_LOCATION: ChapterRef = { book: 'gen', chapter: 1 };
const DEFAULT_VERSION = 'GAE';

type LoadState = 'loading' | 'ready' | 'error';
type ViewMode = 'home' | 'reader';

interface SavedPosition {
  readonly book: string;
  readonly chapter: number;
  readonly version: string;
  readonly scrollPosition: number;
}

interface TodaySchedule {
  readonly id: number;
  readonly book_code: string;
  readonly book: string;
  readonly start_chapter: number;
  readonly end_chapter: number;
  readonly is_completed: boolean;
}

interface HomeStats {
  readonly bookmarks: number;
  readonly notes: number;
  readonly highlights: number;
  readonly recent_records: { book: string; chapter: number; read_date?: string }[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 서버 읽기 위치 검증: 웹과 같은 규칙 (book 유효, chapter 범위, scroll 0..1). */
const parseSavedPosition = (value: unknown): SavedPosition | null => {
  if (!isRecord(value)) return null;
  const { book, chapter, version, scroll_position } = value;
  if (typeof book !== 'string' || !isBibleBook(book)) return null;
  if (typeof chapter !== 'number' || !Number.isInteger(chapter)) return null;
  if (chapter < 1 || chapter > chapterCount(book)) return null;
  if (typeof version !== 'string' || !VISIBLE_VERSION_SET.has(version)) return null;
  if (
    typeof scroll_position !== 'number' ||
    !Number.isFinite(scroll_position) ||
    scroll_position < 0 ||
    scroll_position > 1
  ) {
    return null;
  }
  return { book, chapter, version, scrollPosition: scroll_position };
};

const parseTodaySchedules = (json: unknown): TodaySchedule[] => {
  if (!isRecord(json) || !Array.isArray(json.schedules)) return [];
  const out: TodaySchedule[] = [];
  for (const raw of json.schedules) {
    if (!isRecord(raw)) continue;
    const bookCodeValue = typeof raw.book_code === 'string' ? raw.book_code : '';
    const book = typeof raw.book === 'string' ? raw.book : '';
    const start = typeof raw.start_chapter === 'number' ? raw.start_chapter : null;
    if (start === null || (!bookCodeValue && !book)) continue;
    out.push({
      id: typeof raw.id === 'number' ? raw.id : 0,
      book_code: bookCodeValue || (bookCode(book) ?? ''),
      book,
      start_chapter: start,
      end_chapter: typeof raw.end_chapter === 'number' ? raw.end_chapter : start,
      is_completed: raw.is_completed === true,
    });
  }
  return out;
};

const parseHomeStats = (json: unknown): HomeStats | null => {
  if (!isRecord(json)) return null;
  const records = Array.isArray(json.recent_records) ? json.recent_records : [];
  return {
    bookmarks: typeof json.bookmarks === 'number' ? json.bookmarks : 0,
    notes: typeof json.notes === 'number' ? json.notes : 0,
    highlights: typeof json.highlights === 'number' ? json.highlights : 0,
    recent_records: records
      .filter(isRecord)
      .map((r) => ({
        book: typeof r.book === 'string' ? r.book : '',
        chapter: typeof r.chapter === 'number' ? r.chapter : 0,
        read_date: typeof r.read_date === 'string' ? r.read_date : undefined,
      }))
      .filter((r) => r.book && r.chapter > 0),
  };
};

const openWebPath = (webBase: string, path: string) => {
  if (navigationRef.isReady()) {
    navigationRef.navigate('WebView', { url: `${webBase}${path}` });
  }
};

export default function BibleScreen() {
  const { status, accessToken, apiFetch } = useAuth();
  const { stack } = useAppStack();
  const route = useRoute<RouteProp<TabParamList, 'Bible'>>();
  const tabBarInset = useNativeTabBarInset();
  const safeInsets = useSafeAreaInsets();
  // Cache identity only; AuthSession/server still own token validation.
  // Match the settings boundary without resetting on access-token rotation.
  let accountId: string | null = null;
  if (status === 'signedIn' && accessToken) {
    try {
      const payload = accessToken.split('.')[1];
      if (payload) {
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const claims: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
        if (isRecord(claims)) {
          const id = claims.user_id;
          if ((typeof id === 'number' && Number.isSafeInteger(id) && id > 0)
            || (typeof id === 'string' && /^[1-9]\d*$/.test(id))) accountId = String(id);
        }
      }
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      accountId = null;
    }
  }
  const tongdok = useMemo(() => createReaderTongdok(apiFetch),
    [apiFetch, stack.api, status, accountId]);
  const tongdokRef = useRef(tongdok);
  tongdokRef.current = tongdok;
  const [contextSnapshot, setContextSnapshot] = useState(() => ({ controller: tongdok, state: tongdok.getState() }));
  // Never paint the previous account's proof while the subscription is rebinding.
  const readingContext = contextSnapshot.controller === tongdok
    ? contextSnapshot.state : tongdok.getState();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  // A route observed before storage settles must never lose to saved tab state.
  const explicitEntry = useRef(false);
  if (route.params?.url) {
    const entry = parseBibleReaderRoute(route.params.url);
    if (entry.location || entry.version || entry.context.enabled) explicitEntry.current = true;
  }
  useEffect(() => {
    setContextSnapshot({ controller: tongdok, state: tongdok.getState() });
    const unsubscribe = tongdok.subscribe(() => setContextSnapshot({ controller: tongdok, state: tongdok.getState() }));
    return () => { unsubscribe(); tongdok.invalidate(); };
  }, [tongdok]);

  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [location, setLocation] = useState<ChapterRef>(DEFAULT_LOCATION);
  const [version, setVersion] = useState<string>(DEFAULT_VERSION);
  const [blocks, setBlocks] = useState<readonly BibleBlock[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [reloadToken, setReloadToken] = useState(0);
  const [picker, setPicker] = useState<'none' | 'book' | 'chapter' | 'version'>('none');
  const [pickerBook, setPickerBook] = useState<BibleBook | null>(null);
  const [versions, setVersions] = useState<readonly BibleVersion[]>(FALLBACK_VERSIONS);
  const [readChapters, setReadChapters] = useState<ReadonlySet<number>>(new Set());
  const [moreOpen, setMoreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [audioLink, setAudioLink] = useState<string | null>(null);
  const audioGeneration = useRef(0);
  const {
    settings: readingSettings, update: updateReadingSetting, syncError, retry: retrySettings,
  } = useReadingSettings();
  const [readerProgress, setReaderProgress] = useState(0);

  // 리더 본문 탭 (저장된 본문 위치들, AsyncStorage 영속화)
  const [readerTabs, setReaderTabs] = useState<ReaderTabsState>(createTabsState);

  // 홈 뷰 데이터
  const [homeLoading, setHomeLoading] = useState(true);
  const [lastPosition, setLastPosition] = useState<SavedPosition | null>(null);
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [todaySchedules, setTodaySchedules] = useState<TodaySchedule[]>([]);
  const [planName, setPlanName] = useState<string | null>(null);
  const [homePlan, setHomePlan] = useState<{ controller: typeof tongdok; id: number | null }>(
    () => ({ controller: tongdok, id: null }),
  );
  const planId = homePlan.controller === tongdok ? homePlan.id : null;

  const signedIn = status === 'signedIn';
  const audioSession = useMemo(() => ({
    key: JSON.stringify([stack.api, accountId, status, readingContext.context,
      location.book, location.chapter, version, ++audioGeneration.current]),
    ended: false,
  }), [tongdok, viewMode, route.params?.url, location.book, location.chapter, version,
    readingContext.context.enabled, readingContext.context.planId, readingContext.context.date,
    readingContext.context.scheduleId, audioOpen, audioLink]);
  const activeAudio = useRef<typeof audioSession | null>(audioSession);
  activeAudio.current = audioSession;
  const autoCompleteRef = useRef(readingSettings.tongdokAutoComplete);
  autoCompleteRef.current = readingSettings.tongdokAutoComplete;
  useEffect(() => () => { activeAudio.current = null; }, []);
  useEffect(() => {
    setAudioOpen(false);
    setAudioLink(null);
    if (viewMode !== 'reader') return;
    let cancelled = false;
    const query = new URLSearchParams({ book: location.book, chapter: String(location.chapter) });
    if (readingContext.context.enabled && readingContext.context.planId !== null)
      query.set('plan_id', String(readingContext.context.planId));
    apiFetch(`/api/v1/todos/detail/?${query}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Audio detail HTTP ${response.status}`);
        const detail = parseReaderAudioResponse(await response.json());
        if (!cancelled) setAudioLink(selectReaderAudioLink({
          ...detail, book: location.book, chapter: location.chapter,
        }));
      })
      .catch((error) => console.warn('[Bible] audio detail failed:', error));
    return () => { cancelled = true; };
  }, [viewMode, location.book, location.chapter, readingContext.context.enabled,
    readingContext.context.planId, route.params?.url, tongdok, apiFetch]);
  const listRef = useRef<ScrollView>(null);
  const pendingScrollFraction = useRef<number | null>(null);
  const scrollFraction = useRef(0);
  const contentHeight = useRef(0);
  const viewHeight = useRef(0);
  const requestSeq = useRef(0);

  const locationRef = useRef(location);
  const versionRef = useRef(version);
  const signedInRef = useRef(signedIn);
  const readerTabsRef = useRef(readerTabs);
  const tabsHydrated = useRef(false);
  locationRef.current = location;
  versionRef.current = version;
  signedInRef.current = signedIn;
  readerTabsRef.current = readerTabs;

  const savePosition = useCallback(
    (loc: ChapterRef, ver: string, fraction: number) => {
      apiFetch('/api/v1/todos/bible/reading-position/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book: loc.book,
          chapter: loc.chapter,
          scroll_position: fraction,
          version: ver,
        }),
      }).catch((error) => console.warn('[Bible] reading-position save failed:', error));
    },
    [apiFetch],
  );

  // --- 리더 탭: 현재 리더 상태 → 스냅샷 ---
  const currentTabSnapshot = useCallback(
    (): ReaderTabSnapshot => ({
      book: locationRef.current.book,
      chapter: locationRef.current.chapter,
      version: versionRef.current,
      scrollPosition: scrollFraction.current,
    }),
    [],
  );

  const persistTabs = useCallback((state: ReaderTabsState) => {
    void saveReaderTabs(AsyncStorage, state);
  }, []);

  // --- 리더 탭: 앱 재시작 시 AsyncStorage에서 복원 ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const restored = await loadReaderTabs(AsyncStorage);
      if (cancelled) return;
      tabsHydrated.current = true;
      if (restored.tabs.length === 0) return;
      const active =
        restored.tabs.find((t) => t.id === restored.activeTabId) ?? restored.tabs[0];
      if (explicitEntry.current && active) {
        updateTabSnapshot(restored, active.id, currentTabSnapshot(),
          chapterLabel(locationRef.current.book, locationRef.current.chapter));
      }
      setReaderTabs(restored);
      if (!explicitEntry.current && restored.barVisible && active) {
        pendingScrollFraction.current = active.snapshot.scrollPosition;
        scrollFraction.current = active.snapshot.scrollPosition;
        setLocation({ book: active.snapshot.book, chapter: active.snapshot.chapter });
        setVersion(active.snapshot.version);
        setViewMode('reader');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- 리더 탭: 상태 변경 시 영속화 (hydrate 전에는 쓰지 않는다) ---
  useEffect(() => {
    if (tabsHydrated.current) persistTabs(readerTabs);
  }, [readerTabs, persistTabs]);

  // --- 리더 탭: 리더가 이동하면 활성 탭의 스냅샷·라벨을 따라가게 한다 ---
  useEffect(() => {
    const state = readerTabsRef.current;
    if (!state.activeTabId) return;
    const next = cloneTabsState(state);
    updateTabSnapshot(
      next,
      next.activeTabId as string,
      currentTabSnapshot(),
      chapterLabel(location.book, location.chapter),
    );
    setReaderTabs(next);
  }, [location, version, currentTabSnapshot]);

  const toggleTabsBar = useCallback(() => {
    const next = cloneTabsState(readerTabsRef.current);
    const showing = !next.barVisible;
    setBarVisible(next, showing);
    if (showing && next.tabs.length === 0) {
      addTab(
        next,
        currentTabSnapshot(),
        chapterLabel(locationRef.current.book, locationRef.current.chapter),
      );
    }
    setReaderTabs(next);
  }, [currentTabSnapshot]);

  const addReaderTab = useCallback(() => {
    const next = cloneTabsState(readerTabsRef.current);
    addTab(
      next,
      currentTabSnapshot(),
      chapterLabel(locationRef.current.book, locationRef.current.chapter),
    );
    setReaderTabs(next);
  }, [currentTabSnapshot]);

  /** 탭 스냅샷을 리더에 적용한다. 본문이 같으면 스크롤만 복원한다. */
  const applyTabSnapshot = useCallback((snapshot: ReaderTabSnapshot) => {
    activeAudio.current = null;
    setAudioOpen(false);
    const sameContent =
      snapshot.book === locationRef.current.book &&
      snapshot.chapter === locationRef.current.chapter &&
      snapshot.version === versionRef.current;
    pendingScrollFraction.current = snapshot.scrollPosition;
    scrollFraction.current = snapshot.scrollPosition;
    setReaderProgress(snapshot.scrollPosition);
    if (sameContent) {
      // 재로드가 없으므로 onContentSizeChange가 안 불린다 — 직접 스크롤.
      pendingScrollFraction.current = null;
      const max = contentHeight.current - viewHeight.current;
      if (max > 0) {
        listRef.current?.scrollTo({
          y: snapshot.scrollPosition * max,
          animated: false,
        });
      }
      return;
    }
    setLocation({ book: snapshot.book, chapter: snapshot.chapter });
    setVersion(snapshot.version);
    setViewMode('reader');
  }, []);

  const selectReaderTab = useCallback(
    (tabId: string) => {
      const state = readerTabsRef.current;
      if (tabId === state.activeTabId) return;
      const target = state.tabs.find((t) => t.id === tabId);
      if (!target) return;
      const next = cloneTabsState(state);
      if (next.activeTabId) {
        updateTabSnapshot(
          next,
          next.activeTabId,
          currentTabSnapshot(),
          chapterLabel(locationRef.current.book, locationRef.current.chapter),
        );
      }
      activateTab(next, tabId);
      setReaderTabs(next);
      applyTabSnapshot(target.snapshot);
    },
    [currentTabSnapshot, applyTabSnapshot],
  );

  const closeReaderTab = useCallback(
    (tabId: string) => {
      const state = readerTabsRef.current;
      const next = cloneTabsState(state);
      if (next.activeTabId && next.activeTabId !== tabId) {
        updateTabSnapshot(
          next,
          next.activeTabId,
          currentTabSnapshot(),
          chapterLabel(locationRef.current.book, locationRef.current.chapter),
        );
      }
      const { removed, activated } = removeTab(next, tabId);
      if (!removed) return; // 마지막 탭은 닫을 수 없다
      setReaderTabs(next);
      if (activated) applyTabSnapshot(activated.snapshot);
    },
    [currentTabSnapshot, applyTabSnapshot],
  );

  // --- 딥링크: /bible?book=..&chapter=.. 형태의 url 파라미터 → 리더로 ---
  useEffect(() => {
    const url = route.params?.url;
    if (!url) return;
    const target = parseBibleReaderRoute(url);
    tongdok.enter(target);
    if (viewMode === 'reader' && (!target.location
      || (target.location.book === locationRef.current.book
        && target.location.chapter === locationRef.current.chapter))) void tongdok.load();
    if (target.version) setVersion(target.version);
    if (target.location || target.context.enabled) {
      pendingScrollFraction.current = null;
      scrollFraction.current = 0;
      setReaderProgress(0);
      if (target.location) setLocation(target.location);
      setViewMode('reader');
    }
  }, [route.params?.url, tongdok]);

  useEffect(() => {
    tongdok.setDefaultPlan(planId);
  }, [planId, readingContext.context.enabled, tongdok]);

  useEffect(() => {
    if (viewMode !== 'reader') { tongdok.invalidate(); return; }
    tongdok.move(location);
    void tongdok.load();
  }, [viewMode, location.book, location.chapter, readingContext.context.enabled,
    readingContext.context.planId, tongdok]);

  // --- 홈 뷰 데이터: 읽기 위치 + 활동 통계 + 오늘 일정 ---
  const loadHome = useCallback(async () => {
    setHomeLoading(true);
    setLastPosition(null);
    setStats(null);
    setTodaySchedules([]);
    setPlanName(null);
    try {
      const posRes = await apiFetch('/api/v1/todos/bible/reading-position/');
      const posJson: unknown = await posRes.json().catch(() => null);
      if (tongdokRef.current !== tongdok) return;
      const position =
        posRes.ok && isRecord(posJson) && posJson.success === true
          ? parseSavedPosition(posJson.position)
          : null;
      setLastPosition(position);

      if (!signedIn) {
        setStats(null);
        setTodaySchedules([]);
        setPlanName(null);
        setHomePlan({ controller: tongdok, id: null });
        return;
      }

      const [statsRes, subsRes] = await Promise.all([
        apiFetch('/api/v1/todos/bible/home-stats/'),
        apiFetch('/api/v1/todos/plan/'),
      ]);
      const loadedStats = statsRes.ok ? parseHomeStats(await statsRes.json()) : null;
      const subs = subsRes.ok ? normalizeSubscriptions(await subsRes.json()) : [];
      if (tongdokRef.current !== tongdok) return;
      setStats(loadedStats);
      const active = subs.filter((s: PlanSubscription) => s.is_active);
      const primary = active.find((s) => s.is_default) ?? active[0] ?? null;
      setPlanName(primary?.plan_name ?? null);
      setHomePlan({ controller: tongdok, id: primary?.plan_id ?? null });
      if (primary) {
        const todayRes = await apiFetch(
          `/api/v1/todos/schedules/today/?plan_id=${primary.plan_id}`,
        );
        const schedules = todayRes.ok ? parseTodaySchedules(await todayRes.json()) : [];
        if (tongdokRef.current !== tongdok) return;
        setTodaySchedules(schedules);
      } else {
        setTodaySchedules([]);
      }
    } catch (error) {
      console.warn('[Bible] home load failed:', error);
    } finally {
      if (tongdokRef.current === tongdok) setHomeLoading(false);
    }
  }, [apiFetch, signedIn, tongdok]);

  useEffect(() => {
    if (status === 'loading') return;
    void loadHome();
  }, [status, loadHome]);

  // --- 본문 로드 (리더 모드일 때만) ---
  useEffect(() => {
    if (viewMode !== 'reader') return;
    const seq = ++requestSeq.current;
    contentHeight.current = 0;
    viewHeight.current = 0;
    setLoadState('loading');
    (async () => {
      try {
        const res = await apiFetch(
          `/api/v1/bible-cache/${version}/${location.book}/${location.chapter}/`,
        );
        const json: unknown = await res.json();
        if (seq !== requestSeq.current) return;
        const data = isRecord(json) && isRecord(json.data) ? json.data : null;
        const parsed =
          res.ok && data ? parseBibleContent(data.content, data.content_type) : [];
        if (parsed.length === 0) {
          setBlocks([]);
          setLoadState('error');
          return;
        }
        setBlocks(parsed);
        setLoadState('ready');
      } catch (error) {
        if (seq !== requestSeq.current) return;
        console.warn('[Bible] content load failed:', error);
        setBlocks([]);
        setLoadState('error');
      }
    })();
  }, [viewMode, location, version, reloadToken, apiFetch]);

  // --- 장 변경 시: 위치 저장 + 읽음 기록 (로그인만, fire-and-forget) ---
  useEffect(() => {
    if (!signedIn || viewMode !== 'reader' || loadState !== 'ready') return;
    savePosition(location, version, scrollFraction.current);
    apiFetch('/api/v1/todos/bible/personal-records/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book: location.book, chapter: location.chapter }),
    }).catch((error) => console.warn('[Bible] personal-record save failed:', error));
  }, [signedIn, viewMode, loadState, location, version, apiFetch, savePosition]);

  // --- 책별 읽은 장 (장 선택 그리드 표시용, 로그인만) ---
  useEffect(() => {
    if (!signedIn) {
      setReadChapters(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(
          `/api/v1/todos/bible/personal-records/by-book/?book=${location.book}`,
        );
        const json: unknown = await res.json();
        if (cancelled || !res.ok || !isRecord(json) || json.success !== true) return;
        const list = Array.isArray(json.read_chapters) ? json.read_chapters : [];
        setReadChapters(
          new Set(list.filter((n): n is number => typeof n === 'number')),
        );
      } catch (error) {
        console.warn('[Bible] read-chapters load failed:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, location.book, apiFetch]);

  // --- 역본 목록 (보이는 한국어 역본만) ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/v1/bible-cache/versions/');
        const json: unknown = await res.json();
        if (cancelled || !res.ok) return;
        const visible = normalizeVersionList(json).filter((v) =>
          VISIBLE_VERSION_SET.has(v.code),
        );
        if (visible.length > 0) setVersions(visible);
      } catch (error) {
        console.warn('[Bible] version list load failed:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  // --- 화면을 떠날 때 마지막 스크롤 위치 저장 ---
  useEffect(
    () => () => {
      if (signedInRef.current) {
        savePosition(locationRef.current, versionRef.current, scrollFraction.current);
      }
    },
    [savePosition],
  );

  const prev = useMemo(() => prevChapter(location), [location]);
  const next = useMemo(() => nextChapter(location), [location]);

  const goTo = useCallback((ref: ChapterRef) => {
    activeAudio.current = null;
    setAudioOpen(false);
    pendingScrollFraction.current = null;
    scrollFraction.current = 0;
    setReaderProgress(0);
    setLocation(ref);
    setViewMode('reader');
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      contentHeight.current = contentSize.height;
      viewHeight.current = layoutMeasurement.height;
      scrollFraction.current = readerScrollProgress(
        contentOffset.y,
        contentSize.height,
        layoutMeasurement.height,
      );
      setReaderProgress(scrollFraction.current);
    },
    [],
  );

  const saveTabScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleScroll(event);
      const state = readerTabsRef.current;
      if (!state.activeTabId) return;
      const next = cloneTabsState(state);
      updateTabSnapshot(
        next,
        state.activeTabId,
        currentTabSnapshot(),
        chapterLabel(locationRef.current.book, locationRef.current.chapter),
      );
      readerTabsRef.current = next;
      setReaderTabs(next);
    },
    [handleScroll, currentTabSnapshot],
  );

  const restoreScroll = useCallback(() => {
    const fraction = pendingScrollFraction.current;
    if (fraction === null) return;
    const max = contentHeight.current - viewHeight.current;
    if (viewHeight.current <= 0 || max <= 0) return;
    pendingScrollFraction.current = null;
    if (fraction > 0) {
      listRef.current?.scrollTo({ y: fraction * max, animated: false });
    }
  }, []);

  const versionName = useMemo(
    () => versions.find((v) => v.code === version)?.name ?? version,
    [versions, version],
  );

  const openChapterPicker = useCallback((book: BibleBook) => {
    setPickerBook(book);
    setPicker('chapter');
  }, []);

  const continueReading = useCallback(() => {
    if (!lastPosition) return;
    pendingScrollFraction.current = lastPosition.scrollPosition;
    setLocation({ book: lastPosition.book, chapter: lastPosition.chapter });
    setVersion(lastPosition.version);
    setViewMode('reader');
  }, [lastPosition]);

  const startTodayTongdok = useCallback(() => {
    const nextSchedule = todaySchedules.find((s) => !s.is_completed);
    if (!nextSchedule) return;
    const book = nextSchedule.book_code || bookCode(nextSchedule.book) || '';
    if (!isBibleBook(book) || planId === null) return;
    explicitEntry.current = true;
    tongdok.enter({
      location: { book, chapter: nextSchedule.start_chapter }, version: null,
      context: { enabled: true, planId, scheduleId: nextSchedule.id, date: null },
    });
    goTo({ book, chapter: nextSchedule.start_chapter });
  }, [todaySchedules, goTo, planId, tongdok]);

  const enterSchedule = useCallback((target: BibleReaderRoute) => {
    if (!target.location) return;
    explicitEntry.current = true;
    tongdok.enter(target);
    setScheduleOpen(false);
    goTo(target.location);
    // Same passage can belong to a newly selected day; location alone is not a load trigger.
    void tongdok.load();
  }, [tongdok, goTo]);

  const nextSchedule = useCallback(async () => {
    const target = await tongdok.next();
    if (target) enterSchedule(target);
  }, [tongdok, enterSchedule]);

  const todayCompleted = todaySchedules.filter((s) => s.is_completed).length;
  const tongdokState =
    todaySchedules.length === 0
      ? 'none'
      : todayCompleted === todaySchedules.length
        ? 'completed'
        : todayCompleted > 0
          ? 'resume'
          : 'start';

  const scheduleLocation = useMemo(() => {
    const ranges: { book: string; start: number; end: number }[] = [];
    for (const s of todaySchedules) {
      const book = s.book_code || bookCode(s.book) || s.book;
      const prevRange = ranges.at(-1);
      if (prevRange?.book === book && prevRange.end + 1 === s.start_chapter) {
        prevRange.end = s.end_chapter;
      } else {
        ranges.push({ book, start: s.start_chapter, end: s.end_chapter });
      }
    }
    return ranges
      .map(
        (r) =>
          `${BIBLE_BOOKS.find((b) => b.id === r.book)?.name ?? r.book} ${r.start}${r.end !== r.start ? `–${r.end}` : ''}${chapterUnit(r.book)}`,
      )
      .join(' · ');
  }, [todaySchedules]);

  const showWelcomeGuide =
    !homeLoading &&
    !lastPosition &&
    todaySchedules.length === 0 &&
    (stats?.recent_records.length ?? 0) === 0 &&
    !(stats?.bookmarks || stats?.notes || stats?.highlights);

  const features = useMemo(
    () => [
      {
        key: 'bookmarks',
        name: '북마크',
        icon: 'bookmark-outline' as const,
        path: '/bible/bookmarks',
        count: stats?.bookmarks ?? 0,
        description: stats?.bookmarks
          ? `저장된 ${stats.bookmarks}개의 장`
          : '자주 찾는 장을 저장하세요',
      },
      {
        key: 'notes',
        name: '묵상노트',
        icon: 'document-text-outline' as const,
        path: '/bible/notes',
        count: stats?.notes ?? 0,
        description: stats?.notes
          ? `작성된 ${stats.notes}개의 노트`
          : '말씀을 읽고 묵상을 기록하세요',
      },
      {
        key: 'highlights',
        name: '하이라이트',
        icon: 'color-wand-outline' as const,
        path: '/bible/highlights',
        count: stats?.highlights ?? 0,
        description: stats?.highlights
          ? `표시된 ${stats.highlights}개의 구절`
          : '중요한 구절에 색상을 입히세요',
      },
      {
        key: 'history',
        name: '읽기 기록',
        icon: 'time-outline' as const,
        path: '/bible/history',
        count: 0,
        description: '읽은 장과 날짜를 확인하세요',
      },
    ],
    [stats],
  );

  // --- 홈 뷰 ---
  const renderHome = () => (
    <ScrollView
      style={styles.homeScroll}
      contentContainerStyle={[
        styles.homeContent,
        { paddingBottom: 24 + tabBarInset },
      ]}
    >
      <View style={styles.homeHeader}>
        <Text style={styles.homeTitle}>성경</Text>
        <View style={styles.homeHeaderActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => openWebPath(stack.web, '/bible/search')}
            hitSlop={8}
            accessibilityLabel="본문 검색"
          >
            <Ionicons name="search" size={20} color={TEXT} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setPicker('book')}
            hitSlop={8}
            accessibilityLabel="성경 목차"
          >
            <Ionicons name="list" size={22} color={TEXT} />
          </TouchableOpacity>
        </View>
      </View>

      {homeLoading ? (
        <View style={styles.homeLoading}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : (
        <>
          {showWelcomeGuide && (
            <View style={styles.welcomeCard}>
              <View style={styles.welcomeIconWrap}>
                <Ionicons name="book-outline" size={28} color={ACCENT} />
              </View>
              <Text style={styles.welcomeTitle}>매일일독에 오신 것을 환영합니다</Text>
              <Text style={styles.welcomeDesc}>성경을 읽고, 묵상하고, 기록해보세요.</Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => setPicker('book')}
                activeOpacity={0.85}
              >
                <Ionicons name="list" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>성경 목차에서 시작하기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => openWebPath(stack.web, '/plans')}
                activeOpacity={0.85}
              >
                <Ionicons name="calendar-outline" size={18} color={ACCENT} />
                <Text style={styles.secondaryButtonText}>통독 플랜 구독하기</Text>
              </TouchableOpacity>
            </View>
          )}

          {!showWelcomeGuide && todaySchedules.length > 0 && (
            <View style={styles.todayCard}>
              <View style={styles.todayHeader}>
                <Text style={styles.todayBadge}>오늘의 통독</Text>
                <Text style={styles.todayDate}>
                  {new Intl.DateTimeFormat('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  }).format(new Date())}
                </Text>
              </View>
              <Text style={styles.todayLocation}>{scheduleLocation}</Text>
              {planName && <Text style={styles.todayPlan}>{planName}</Text>}
              <View style={styles.todayProgressRow}>
                <View style={styles.todayProgressTrack}>
                  <View
                    style={[
                      styles.todayProgressFill,
                      { width: `${(todayCompleted / todaySchedules.length) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.todayProgressText}>
                  {todayCompleted}/{todaySchedules.length} 완료
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  tongdokState === 'completed' && styles.secondaryButton,
                ]}
                onPress={startTodayTongdok}
                disabled={tongdokState === 'completed'}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={tongdokState === 'completed' ? 'checkmark-circle' : 'play'}
                  size={18}
                  color={tongdokState === 'completed' ? ACCENT : '#fff'}
                />
                <Text
                  style={[
                    styles.primaryButtonText,
                    tongdokState === 'completed' && styles.secondaryButtonText,
                  ]}
                >
                  {tongdokState === 'completed'
                    ? '오늘 통독 완료'
                    : tongdokState === 'resume'
                      ? '이어서 통독'
                      : '통독 시작'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!showWelcomeGuide && lastPosition && (
            <>
              <Text style={styles.sectionTitle}>계속 읽기</Text>
              <TouchableOpacity
                style={styles.continueCard}
                onPress={continueReading}
                activeOpacity={0.8}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="book-outline" size={18} color={ACCENT} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={styles.continueLocation}>
                    {chapterLabel(lastPosition.book, lastPosition.chapter)}
                  </Text>
                  <Text style={styles.continueMeta}>
                    {versions.find((v) => v.code === lastPosition.version)?.name ?? ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={TERTIARY} />
              </TouchableOpacity>
            </>
          )}

          {!showWelcomeGuide && (stats || !signedIn) && (
            <>
              <Text style={styles.sectionTitle}>내 성경 활동</Text>
              <View style={styles.groupedCard}>
                {features.map((f, i) => (
                  <TouchableOpacity
                    key={f.key}
                    style={[styles.featureRow, i > 0 && styles.featureRowBorder]}
                    onPress={() => openWebPath(stack.web, f.path)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.rowIcon}>
                      <Ionicons name={f.icon} size={18} color={ACCENT} />
                    </View>
                    <View style={styles.rowContent}>
                      <View style={styles.featureHeading}>
                        <Text style={styles.featureName}>{f.name}</Text>
                        {f.count > 0 && <Text style={styles.featureCount}>{f.count}</Text>}
                      </View>
                      <Text style={styles.featureDesc}>{f.description}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={TERTIARY} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {!showWelcomeGuide && (stats?.recent_records.length ?? 0) > 0 && (
            <>
              <Text style={styles.sectionTitle}>최근 읽은 성경</Text>
              <View style={styles.groupedCard}>
                {stats!.recent_records.map((r, i) => {
                  const code = bookCode(r.book);
                  return (
                    <TouchableOpacity
                      key={`${r.book}-${r.chapter}-${i}`}
                      style={[styles.recentRow, i > 0 && styles.featureRowBorder]}
                      onPress={() => {
                        if (code && isBibleBook(code)) {
                          goTo({ book: code, chapter: r.chapter });
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.recentText}>
                        {r.book} {r.chapter}
                        {r.book === '시편' ? '편' : '장'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <TouchableOpacity
            style={styles.tocButton}
            onPress={() => setPicker('book')}
            activeOpacity={0.85}
          >
            <Ionicons name="list" size={18} color={ACCENT} />
            <Text style={styles.tocButtonText}>성경 전체 목차</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );

  // --- 리더 뷰 ---
  const renderReader = () => (
    <>
      <View style={styles.readerHeader}>
        <TouchableOpacity
          style={styles.readerTitleButton}
          onPress={() => setPicker('book')}
        >
          <Text style={styles.readerTitle}>
            {chapterLabel(location.book, location.chapter)}
          </Text>
          <Ionicons name="chevron-down" size={14} color={TERTIARY} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setPicker('version')} hitSlop={8}>
          <Text style={styles.readerVersion}>{versionName}</Text>
        </TouchableOpacity>
        <View style={styles.readerActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={toggleTabsBar}
            hitSlop={8}
            accessibilityLabel="탭"
          >
            <Text style={styles.readerActionText}>탭</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => openWebPath(stack.web, '/bible/search')}
            hitSlop={8}
            accessibilityLabel="본문 검색"
          >
            <Ionicons name="search" size={20} color={TEXT} />
          </TouchableOpacity>
          {audioLink && <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setAudioOpen(true)}
            hitSlop={8}
            accessibilityLabel="오디오"
          >
            <Ionicons name="headset-outline" size={20} color={TEXT} />
          </TouchableOpacity>}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setMoreOpen(true)}
            hitSlop={8}
            accessibilityLabel="더보기"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={TEXT} />
          </TouchableOpacity>
        </View>
        <View style={styles.readerProgressTrack} pointerEvents="none">
          <View style={[styles.readerProgressFill, { width: `${readerProgress * 100}%` }]} />
        </View>
      </View>

      <ReaderTongdokControls
        state={readingContext}
        onToggle={() => tongdok.toggle(signedIn)}
        onRetry={() => {
          if (readingContext.error === 'update')
            return tongdok.retryUpdate(signedIn, readingSettings.tongdokAutoComplete);
          if (readingContext.error === 'next') return nextSchedule();
          return tongdok.load();
        }}
        onNext={() => { void nextSchedule(); }}
        onSchedule={() => setScheduleOpen(true)}
        onExit={() => { tongdok.exit(); setScheduleOpen(false); }}
        onLogin={() => openWebPath(stack.web, '/login')}
      />
      {readerTabs.barVisible && (
        <ReaderTabs
          tabs={readerTabs.tabs}
          activeTabId={readerTabs.activeTabId}
          onSelect={selectReaderTab}
          onClose={closeReaderTab}
          onAdd={addReaderTab}
        />
      )}

      {loadState === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      )}
      {loadState === 'error' && (
        <View style={styles.center}>
          <Text style={styles.errorText}>본문을 불러오지 못했습니다</Text>
          <Pressable style={styles.retryButton} onPress={() => setReloadToken((n) => n + 1)}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </Pressable>
        </View>
      )}
      {loadState === 'ready' && (
        <ScrollView
          ref={listRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.content}
          onScroll={handleScroll}
          onScrollEndDrag={saveTabScroll}
          onMomentumScrollEnd={saveTabScroll}
          scrollEventThrottle={100}
          onContentSizeChange={(w, h) => {
            contentHeight.current = h;
            restoreScroll();
          }}
          onLayout={(e) => {
            viewHeight.current = e.nativeEvent.layout.height;
            restoreScroll();
          }}
        >
          <ReaderBody blocks={blocks} settings={readingSettings} />
        </ScrollView>
      )}

      {/* 하단 장 이동 바 */}
      <View style={[styles.readerFooter, { paddingBottom: tabBarInset }]}>
        <TouchableOpacity
          accessibilityLabel="이전 장"
          disabled={!prev}
          onPress={() => prev && goTo(prev)}
          style={styles.footerButton}
          hitSlop={8}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={prev ? SECONDARY : BORDER}
          />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="다음 장"
          disabled={!next}
          onPress={() => next && goTo(next)}
          style={styles.footerButton}
          hitSlop={8}
        >
          <Ionicons
            name="chevron-forward"
            size={24}
            color={next ? SECONDARY : BORDER}
          />
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {viewMode === 'home' ? renderHome() : renderReader()}

      {/* 책 선택 모달 (구약/신약 66권 그리드) */}
      <Modal
        visible={picker === 'book'}
        animationType="slide"
        onRequestClose={() => setPicker('none')}
      >
        <View style={[styles.modalContainer, { paddingTop: safeInsets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>책 선택</Text>
            <Pressable onPress={() => setPicker('none')} hitSlop={12}>
              <Text style={styles.modalClose}>닫기</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            {(['old', 'new'] as const).map((testament) => (
              <View key={testament}>
                <Text style={styles.sectionLabel}>
                  {testament === 'old' ? '구약' : '신약'}
                </Text>
                <View style={styles.grid}>
                  {BIBLE_BOOKS.filter((b) => b.testament === testament).map((b) => (
                    <Pressable
                      key={b.id}
                      style={[
                        styles.gridCell,
                        b.id === location.book && styles.gridCellActive,
                      ]}
                      onPress={() => openChapterPicker(b)}
                    >
                      <Text
                        style={[
                          styles.gridCellText,
                          b.id === location.book && styles.gridCellTextActive,
                        ]}
                      >
                        {b.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* 장 선택 모달 */}
      <Modal
        visible={picker === 'chapter'}
        animationType="slide"
        onRequestClose={() => setPicker('book')}
      >
        <View style={[styles.modalContainer, { paddingTop: safeInsets.top }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setPicker('book')} hitSlop={12}>
              <Text style={styles.modalBack}>‹ 책</Text>
            </Pressable>
            <Text style={styles.modalTitle}>{pickerBook?.name ?? ''}</Text>
            <Pressable onPress={() => setPicker('none')} hitSlop={12}>
              <Text style={styles.modalClose}>닫기</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <View style={styles.grid}>
              {pickerBook &&
                Array.from({ length: pickerBook.chapters }, (_, i) => i + 1).map(
                  (ch) => {
                    const isCurrent =
                      pickerBook.id === location.book && ch === location.chapter;
                    const isRead = readChapters.has(ch);
                    return (
                      <Pressable
                        key={ch}
                        style={[styles.gridCell, isCurrent && styles.gridCellActive]}
                        onPress={() => {
                          setPicker('none');
                          goTo({ book: pickerBook.id, chapter: ch });
                        }}
                      >
                        <Text
                          style={[
                            styles.gridCellText,
                            isCurrent && styles.gridCellTextActive,
                          ]}
                        >
                          {ch}
                        </Text>
                        {isRead && <View style={styles.readDot} />}
                      </Pressable>
                    );
                  },
                )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* 역본 선택 모달 */}
      <Modal
        visible={picker === 'version'}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker('none')}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setPicker('none')}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>역본 선택</Text>
            {versions.map((v) => (
              <Pressable
                key={v.code}
                style={styles.sheetRow}
                onPress={() => {
                  setPicker('none');
                  if (v.code !== version) {
                    pendingScrollFraction.current = null;
                    scrollFraction.current = 0;
                    setVersion(v.code);
                  }
                }}
              >
                <Text
                  style={[
                    styles.sheetRowText,
                    v.code === version && styles.sheetRowTextActive,
                  ]}
                >
                  {v.name}
                </Text>
                {v.code === version && <Text style={styles.sheetCheck}>✓</Text>}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* 더보기 시트 */}
      <Modal
        visible={moreOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreOpen(false)}
      >
        <Pressable accessible={false} style={styles.sheetBackdrop} onPress={() => setMoreOpen(false)}>
          <View style={styles.sheet}>
            {[
              { label: '읽기 설정', settings: true },
              ...(readingContext.context.enabled ? [{ label: '성경 통독표', schedule: true }] : []),
              { label: '북마크', path: '/bible/bookmarks' },
              { label: '묵상노트', path: '/bible/notes' },
              { label: '하이라이트', path: '/bible/highlights' },
              { label: '읽기 기록', path: '/bible/history' },
              { label: '성경 홈으로', home: true },
            ].map((item) => (
              <Pressable
                key={item.label}
                style={styles.sheetRow}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => {
                  setMoreOpen(false);
                  if ('settings' in item && item.settings) setSettingsOpen(true);
                  else if ('schedule' in item && item.schedule) setScheduleOpen(true);
                  else if ('home' in item && item.home) setViewMode('home');
                  else if (item.path) openWebPath(stack.web, item.path);
                }}
              >
                <Text style={styles.sheetRowText}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
      {scheduleOpen && readingContext.context.enabled && <ReaderTongdokSchedule
        key={`${readingContext.context.planId}-${readingContext.context.scheduleId}`}
        controller={tongdok}
        onSelect={enterSchedule}
        onClose={() => setScheduleOpen(false)}
      />}
      <ReadingSettingsSheet
        visible={settingsOpen}
        settings={readingSettings}
        onChange={updateReadingSetting}
        syncError={syncError}
        onRetry={retrySettings}
        onClose={() => setSettingsOpen(false)}
      />
      {audioOpen && audioLink && <ReaderAudioPlayer
        visible
        audioLink={audioLink}
        contextKey={audioSession.key}
        onEnded={async source => {
          if (activeAudio.current !== audioSession || audioSession.ended
            || source.contextKey !== audioSession.key || source.link !== audioLink
            || !Number.isSafeInteger(source.generation) || source.generation < 1) return;
          audioSession.ended = true;
          if (viewMode !== 'reader' || !signedIn || accountId === null
            || !autoCompleteRef.current || !readingContext.context.enabled) return;
          await tongdok.heardChapter(signedIn);
        }}
        onOpenExternal={async url => {
          if (activeAudio.current !== audioSession || url !== audioLink) return;
          const parsed = new URL(url);
          if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return;
          await Linking.openURL(url);
        }}
        title={chapterLabel(location.book, location.chapter)}
        initialRate={PLAYBACK_RATES.find((rate) => rate === readingSettings.audioPlaybackRate) ?? 1}
        onRateChange={(rate) => updateReadingSetting('audioPlaybackRate', rate)}
        onClose={() => { activeAudio.current = null; setAudioOpen(false); }}
      />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  // --- 홈 ---
  homeScroll: { flex: 1 },
  homeContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  homeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
  },
  homeTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 22,
    color: TEXT,
    letterSpacing: -0.4,
  },
  homeHeaderActions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeLoading: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  welcomeCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#1F1A17',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  welcomeIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: ACCENT_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 17,
    color: TEXT,
    marginBottom: 6,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  welcomeDesc: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 14,
    color: SECONDARY,
    marginBottom: 20,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 10,
    backgroundColor: ACCENT,
    marginBottom: 8,
  },
  primaryButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: '#fff',
    letterSpacing: -0.4,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    height: 48,
    borderRadius: 10,
    backgroundColor: ACCENT_BG,
  },
  secondaryButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: ACCENT,
    letterSpacing: -0.4,
  },
  todayCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    marginBottom: 20,
    shadowColor: '#1F1A17',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  todayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  todayBadge: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    color: ACCENT,
    letterSpacing: -0.4,
  },
  todayDate: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    color: TERTIARY,
    letterSpacing: -0.4,
  },
  todayLocation: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 18,
    color: TEXT,
    letterSpacing: -0.4,
  },
  todayPlan: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    color: SECONDARY,
    marginTop: 2,
    letterSpacing: -0.4,
  },
  todayProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    marginBottom: 16,
  },
  todayProgressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: BORDER,
    overflow: 'hidden',
  },
  todayProgressFill: {
    height: 3,
    backgroundColor: ACCENT,
  },
  todayProgressText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    color: SECONDARY,
    letterSpacing: -0.4,
  },
  sectionTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: SECONDARY,
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  continueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    shadowColor: '#1F1A17',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ACCENT_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
  },
  continueLocation: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: TEXT,
    letterSpacing: -0.4,
  },
  continueMeta: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    color: TERTIARY,
    letterSpacing: -0.4,
  },
  groupedCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#1F1A17',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  featureRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  featureHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featureName: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    color: TEXT,
    letterSpacing: -0.4,
  },
  featureCount: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 12,
    color: ACCENT,
  },
  featureDesc: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 12,
    color: SECONDARY,
    letterSpacing: -0.4,
  },
  recentRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  recentText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    color: TEXT,
    letterSpacing: -0.4,
  },
  tocButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 10,
    backgroundColor: ACCENT_BG,
    marginTop: 4,
  },
  tocButtonText: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 15,
    color: ACCENT,
    letterSpacing: -0.4,
  },
  // --- 리더 ---
  readerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 48,
    gap: 4,
    position: 'relative',
  },
  readerTitleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readerTitle: {
    fontFamily: 'Pretendard-Bold',
    fontSize: 20,
    color: TEXT,
    letterSpacing: -0.4,
  },
  readerVersion: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 13,
    color: SECONDARY,
    letterSpacing: -0.4,
    marginLeft: 4,
  },
  readerActions: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  readerActionText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    color: TEXT,
    letterSpacing: -0.4,
  },
  readerProgressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: BORDER,
  },
  readerProgressFill: {
    height: '100%',
    backgroundColor: ACCENT,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 15,
    color: SECONDARY,
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: ACCENT,
  },
  retryButtonText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: '#fff',
  },
  content: {
    flexGrow: 1,
  },
  heading: {
    fontFamily: SERIF_BOLD,
    fontSize: 17,
    color: TEXT,
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  note: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 13,
    color: TERTIARY,
    marginBottom: 10,
    lineHeight: 19,
  },
  verseParagraph: {
    fontFamily: SERIF,
    fontSize: 18,
    lineHeight: 32,
    color: TEXT,
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  verseNum: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 13,
    color: VERSE_BLUE,
  },
  readerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    minHeight: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    backgroundColor: BG,
  },
  footerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // --- 모달 ---
  modalContainer: {
    flex: 1,
    backgroundColor: BG,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  modalTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 17,
    color: TEXT,
    letterSpacing: -0.4,
  },
  modalClose: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: ACCENT,
  },
  modalBack: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 15,
    color: ACCENT,
    width: 48,
  },
  modalScroll: {
    padding: 16,
    paddingBottom: 48,
  },
  sectionLabel: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 14,
    color: TERTIARY,
    marginTop: 8,
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  gridCell: {
    width: '23%',
    minWidth: 72,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  gridCellActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  gridCellText: {
    fontFamily: 'Pretendard-Medium',
    fontSize: 14,
    color: TEXT,
    letterSpacing: -0.4,
  },
  gridCellTextActive: {
    color: '#fff',
  },
  readDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  sheetTitle: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    color: TEXT,
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  sheetRowText: {
    fontFamily: 'Pretendard-Regular',
    fontSize: 16,
    color: TEXT,
    letterSpacing: -0.4,
  },
  sheetRowTextActive: {
    fontFamily: 'Pretendard-SemiBold',
    color: ACCENT,
  },
  sheetCheck: {
    fontFamily: 'Pretendard-SemiBold',
    fontSize: 16,
    color: ACCENT,
  },
});
