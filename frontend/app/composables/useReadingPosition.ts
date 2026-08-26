/**
 * Reading Position Composable
 *
 * 마지막 읽기 위치 저장/복원 기능 제공
 * - 서버와 동기화 (로그인 사용자)
 * - localStorage 폴백 (비로그인 사용자)
 *
 * 중요: 페이지 초기화 중에는 저장하지 않음 (enableSaving 플래그로 제어)
 */
import { ref, type Ref } from 'vue';
import { useAuthService } from '~/composables/useAuthService';
import { BIBLE_BOOKS, VISIBLE_VERSION_NAMES } from '~/composables/useBibleData';
import { useApi } from './useApi';

export interface ReadingPosition {
  book: string;
  chapter: number;
  scroll_position: number;
  version: string;
  updated_at?: string;
}

const STORAGE_KEY = 'lastReadingPosition';
const BIBLE_BOOK_CHAPTERS = new Map(
  [...BIBLE_BOOKS.old, ...BIBLE_BOOKS.new].map(book => [book.id, book.chapters])
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isValidScrollPosition = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

const normalizeBookCode = (book: string): string => {
  const normalizedBook = book.trim().toLowerCase();
  return normalizedBook === 'jon' ? 'jnh' : normalizedBook;
};

const normalizeVersionCode = (version: string): string => version.trim().toUpperCase();

const isValidVersionCode = (version: string): boolean =>
  Object.prototype.hasOwnProperty.call(VISIBLE_VERSION_NAMES, version);

const parseReadingPosition = (value: unknown): ReadingPosition | null => {
  if (!isRecord(value)) return null;

  const { book, chapter, scroll_position, version, updated_at } = value;

  if (typeof book !== 'string' || book.trim() === '') return null;
  if (typeof chapter !== 'number' || !Number.isInteger(chapter) || chapter < 1) return null;
  if (!isValidScrollPosition(scroll_position)) return null;
  if (typeof version !== 'string' || version.trim() === '') return null;
  if (updated_at !== undefined && typeof updated_at !== 'string') return null;

  const normalizedBook = normalizeBookCode(book);
  const maxChapter = BIBLE_BOOK_CHAPTERS.get(normalizedBook);
  if (maxChapter === undefined || chapter > maxChapter) return null;

  const normalizedVersion = normalizeVersionCode(version);
  if (!isValidVersionCode(normalizedVersion)) return null;

  return {
    book: normalizedBook,
    chapter,
    scroll_position,
    version: normalizedVersion,
    ...(typeof updated_at === 'string' ? { updated_at } : {})
  };
};

const getWindowScrollPosition = (): number => {
  if (typeof window === 'undefined') return 0;

  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll <= 0) return 0;

  const position = window.scrollY / maxScroll;
  if (!Number.isFinite(position)) return 0;

  return Math.min(1, Math.max(0, position));
};

export const useReadingPosition = () => {
  const auth = useAuthService();
  const api = useApi();

  // 상태
  const lastReadingPosition: Ref<ReadingPosition | null> = ref(null);
  const showResumeModal = ref(false);
  const isSavingPosition = ref(false);
  const lastSavedScrollPosition = ref(0);

  /**
   * 저장 활성화 플래그: 페이지 초기화 완료 후 true로 설정 필수
   * false 상태에서는 saveReadingPosition()이 아무 동작도 하지 않음
   */
  const isSavingEnabled = ref(false);

  const lastSavedPosition = ref<{ book: string; chapter: number; version: string } | null>(null);

  // debounce용 타이머
  let savePositionTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * localStorage에서 위치 로드
   */
  const loadFromLocalStorage = (): ReadingPosition | null => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? parseReadingPosition(JSON.parse(stored)) : null;
    } catch (error) {
      if (error instanceof SyntaxError) return null;
      if (typeof DOMException !== 'undefined' && error instanceof DOMException) return null;
      throw error;
    }
  };

  /**
   * localStorage에 위치 저장
   */
  const saveToLocalStorage = (position: ReadingPosition): void => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
    } catch (error) {
      if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
        console.warn('Failed to save reading position to localStorage:', error);
        return;
      }
      throw error;
    }
  };

  const loadReadingPosition = async (): Promise<ReadingPosition | null> => {
    const localPosition = loadFromLocalStorage();

    if (!auth.isAuthenticated.value) {
      lastReadingPosition.value = localPosition;
      return lastReadingPosition.value;
    }

    try {
      const response = await api.GET('/api/v1/todos/bible/reading-position/');
      const serverPosition = response.data?.success ? response.data.position : null;

      if (serverPosition) {
        const mergedPosition = parseReadingPosition({
          ...serverPosition,
          version: serverPosition.version || localPosition?.version || 'GAE',
        });

        if (mergedPosition) {
          lastReadingPosition.value = mergedPosition;
          saveToLocalStorage(mergedPosition);
          return mergedPosition;
        }
      }

      lastReadingPosition.value = localPosition;
      return lastReadingPosition.value;
    } catch (error) {
      console.error('읽기 위치 불러오기 실패:', error);
      lastReadingPosition.value = localPosition;
      return lastReadingPosition.value;
    }
  };

  const saveReadingPosition = async (
    book: string,
    chapter: number,
    version: string,
    immediate = false,
    explicitScrollPosition?: number
  ): Promise<void> => {
    if (!isSavingEnabled.value && !immediate) return;

    const scrollPosition = isValidScrollPosition(explicitScrollPosition)
      ? explicitScrollPosition
      : getWindowScrollPosition();

    const isSameLocation = lastSavedPosition.value &&
      lastSavedPosition.value.book === book &&
      lastSavedPosition.value.chapter === chapter &&
      lastSavedPosition.value.version === version;

    const scrollDeltaTooSmall = Math.abs(scrollPosition - lastSavedScrollPosition.value) < 0.05;
    if (isSameLocation && !immediate && scrollDeltaTooSmall) {
      return;
    }

    const position = parseReadingPosition({
      book,
      chapter,
      scroll_position: scrollPosition,
      version,
      updated_at: new Date().toISOString()
    });

    if (!position) return;

    saveToLocalStorage(position);
    lastReadingPosition.value = position;
    lastSavedScrollPosition.value = scrollPosition;
    lastSavedPosition.value = {
      book: position.book,
      chapter: position.chapter,
      version: position.version
    };

    // 비로그인 시 localStorage만 저장하고 종료
    if (!auth.isAuthenticated.value) return;

    // debounce 처리
    if (savePositionTimeout) {
      clearTimeout(savePositionTimeout);
    }

    const doSave = async () => {
      isSavingPosition.value = true;
      try {
        await api.POST('/api/v1/todos/bible/reading-position/', {
          book: position.book,
          chapter: position.chapter,
          scroll_position: scrollPosition,
          version: position.version
        });
      } catch (error) {
        console.error('읽기 위치 저장 실패:', error);
      } finally {
        isSavingPosition.value = false;
      }
    };

    if (immediate) {
      await doSave();
    } else {
      savePositionTimeout = setTimeout(doSave, 1500); // 1.5초 debounce
    }
  };

  /**
   * 저장된 위치로 스크롤 복원
   */
  const restoreScrollPosition = (scrollPosition: number): void => {
    const scrollTarget = scrollPosition * (document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ top: scrollTarget, behavior: 'smooth' });
  };

  /**
   * 이어서 읽기 모달 표시 여부 결정
   */
  const checkAndShowResumeModal = (currentBook: string, currentChapter: number): boolean => {
    if (!lastReadingPosition.value) return false;

    const { book, chapter } = lastReadingPosition.value;

    // 현재 위치와 저장된 위치가 다르면 모달 표시
    if (book !== currentBook || chapter !== currentChapter) {
      showResumeModal.value = true;
      return true;
    }

    return false;
  };

  /**
   * 새로 시작 (모달 닫기)
   */
  const startFresh = (): void => {
    showResumeModal.value = false;
    lastReadingPosition.value = null;
  };

  const cleanup = (): void => {
    if (savePositionTimeout) {
      clearTimeout(savePositionTimeout);
      savePositionTimeout = null;
    }
    isSavingEnabled.value = false;
    lastSavedPosition.value = null;
  };

  const enableSaving = (): void => {
    isSavingEnabled.value = true;
  };

  const disableSaving = (): void => {
    isSavingEnabled.value = false;
  };

  return {
    lastReadingPosition,
    showResumeModal,
    isSavingPosition,
    lastSavedScrollPosition,
    isSavingEnabled,

    loadReadingPosition,
    saveReadingPosition,
    restoreScrollPosition,
    checkAndShowResumeModal,
    startFresh,
    cleanup,
    enableSaving,
    disableSaving,
  };
};
