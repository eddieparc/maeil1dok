/**
 * useBiblePageState - Bible 페이지 상태 및 네비게이션 관리
 *
 * View mode 전이, 현재 위치(책/장/역본), 네비게이션 로직을 관리합니다.
 *
 * @example
 * const pageState = useBiblePageState();
 *
 * // View mode 전이
 * pageState.goHome();
 * pageState.goToc();
 * pageState.goReader();
 *
 * // 책/장 선택
 * pageState.selectBook('gen', 1);
 *
 * // 네비게이션
 * pageState.goToPrevChapter();
 * pageState.goToNextChapter();
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import type { LocationQuery, LocationQueryValue } from 'vue-router';
import { useBibleData } from '~/composables/useBibleData';
import { useNavigation } from '~/composables/useNavigation';
import type { ViewMode } from '~/types/bible';

// Re-export for backward compatibility
export type { ViewMode } from '~/types/bible';

/**
 * useBiblePageState 반환 타입
 */
export interface UseBiblePageStateReturn {
  // 상태
  viewMode: Ref<ViewMode>;
  currentBook: Ref<string>;
  currentChapter: Ref<number>;
  currentVersion: Ref<string>;

  // Computed (Display)
  currentBookName: ComputedRef<string>;
  currentVersionName: ComputedRef<string>;
  maxChapters: ComputedRef<number>;
  chapterSuffix: ComputedRef<string>;

  // Computed (Navigation)
  hasPrevChapter: ComputedRef<boolean>;
  hasNextChapter: ComputedRef<boolean>;

  // View Mode Actions
  goHome: () => void;
  goToc: () => void;
  goReader: () => void;
  goBack: () => void;

  // Navigation Actions
  goToPrevChapter: () => { book: string; chapter: number } | null;
  goToNextChapter: () => { book: string; chapter: number } | null;

  // Selection Actions
  selectBook: (book: string, chapter: number) => void;
  selectVersion: (version: string) => void;

  // Query Initialization
  initFromQuery: (query: LocationQuery) => void;

  // URL Generation
  generateShareUrl: (verseRange?: BibleVerseRange) => string;
}

export interface BibleVerseRange {
  start: number;
  end: number;
}

const getFirstQueryValue = (
  value: LocationQueryValue | LocationQueryValue[] | undefined
): string | null => {
  if (Array.isArray(value)) {
    const [firstValue] = value;
    return firstValue ?? null;
  }

  return value ?? null;
};

export const parseVerseRangeParam = (
  value: LocationQueryValue | LocationQueryValue[] | undefined
): BibleVerseRange | null => {
  const rawValue = getFirstQueryValue(value)?.trim();
  if (!rawValue) return null;

  const match = rawValue.match(/^(\d+)(?:-(\d+))?$/);
  if (!match) return null;

  const [, startValue, endValue] = match;
  if (!startValue) return null;

  const start = Number.parseInt(startValue, 10);
  const end = endValue ? Number.parseInt(endValue, 10) : start;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start <= 0 || end < start) {
    return null;
  }

  return { start, end };
};

const formatVerseRangeParam = (verseRange: BibleVerseRange): string => {
  return verseRange.start === verseRange.end
    ? String(verseRange.start)
    : `${verseRange.start}-${verseRange.end}`;
};

/**
 * Bible 페이지 상태 및 네비게이션 composable
 */
export function useBiblePageState(): UseBiblePageStateReturn {
  // ============================================
  // Dependencies
  // ============================================

  const { bookNames, bookChapters, versionNames } = useBibleData();
  const navigation = useNavigation();

  // ============================================
  // State
  // ============================================

  const viewMode = ref<ViewMode>('reader');
  const currentBook = ref('gen');
  const currentChapter = ref(1);
  const currentVersion = ref('GAE');

  // ============================================
  // Computed - Display
  // ============================================

  const currentBookName = computed(() => bookNames[currentBook.value] || currentBook.value);
  const currentVersionName = computed(() => versionNames[currentVersion.value] || currentVersion.value);
  const maxChapters = computed(() => bookChapters[currentBook.value] || 1);
  const chapterSuffix = computed(() => currentBook.value === 'psa' ? '편' : '장');

  // ============================================
  // Computed - Navigation
  // ============================================

  const hasPrevChapter = computed(() => {
    // 첫 번째 책의 첫 번째 장이 아니면 이전 장이 있음
    if (currentChapter.value > 1) return true;
    const allBooks = Object.keys(bookNames);
    const currentIndex = allBooks.indexOf(currentBook.value);
    return currentIndex > 0;
  });

  const hasNextChapter = computed(() => {
    // 현재 책의 마지막 장이 아니거나, 마지막 책이 아니면 다음 장이 있음
    if (currentChapter.value < maxChapters.value) return true;
    const allBooks = Object.keys(bookNames);
    const currentIndex = allBooks.indexOf(currentBook.value);
    return currentIndex < allBooks.length - 1;
  });

  // ============================================
  // View Mode Actions
  // ============================================

  const goHome = () => {
    viewMode.value = 'home';
  };

  const goToc = () => {
    viewMode.value = 'toc';
  };

  const goReader = () => {
    viewMode.value = 'reader';
  };

  const goBack = () => {
    navigation.goBack('/');
  };

  // ============================================
  // Navigation Actions
  // ============================================

  /**
   * 이전 장으로 이동
   * @returns 새로운 위치 또는 null (이동 불가 시)
   */
  const goToPrevChapter = (): { book: string; chapter: number } | null => {
    if (currentChapter.value > 1) {
      currentChapter.value--;
      return { book: currentBook.value, chapter: currentChapter.value };
    } else {
      // 이전 책의 마지막 장으로
      const allBooks = Object.keys(bookNames);
      const currentIndex = allBooks.indexOf(currentBook.value);
      if (currentIndex > 0) {
        const prevBook = allBooks[currentIndex - 1];
        if (prevBook) {
          currentBook.value = prevBook;
          currentChapter.value = bookChapters[prevBook] || 1;
          return { book: currentBook.value, chapter: currentChapter.value };
        }
      }
    }
    return null;
  };

  /**
   * 다음 장으로 이동
   * @returns 새로운 위치 또는 null (이동 불가 시)
   */
  const goToNextChapter = (): { book: string; chapter: number } | null => {
    if (currentChapter.value < maxChapters.value) {
      currentChapter.value++;
      return { book: currentBook.value, chapter: currentChapter.value };
    } else {
      // 다음 책의 첫 장으로
      const allBooks = Object.keys(bookNames);
      const currentIndex = allBooks.indexOf(currentBook.value);
      if (currentIndex < allBooks.length - 1) {
        const nextBook = allBooks[currentIndex + 1];
        if (nextBook) {
          currentBook.value = nextBook;
          currentChapter.value = 1;
          return { book: currentBook.value, chapter: currentChapter.value };
        }
      }
    }
    return null;
  };

  // ============================================
  // Selection Actions
  // ============================================

  const selectBook = (book: string, chapter: number) => {
    currentBook.value = book;
    currentChapter.value = chapter;
  };

  const selectVersion = (version: string) => {
    currentVersion.value = version;
    // URL 업데이트 제거 - 역본 상태는 useReadingPosition에서 localStorage/서버에 저장됨
    // 딥링크 진입 시에만 URL 파라미터 사용, 이후 변경은 상태 관리에 위임
  };

  // ============================================
  // Query Initialization
  // ============================================

  const initFromQuery = (query: LocationQuery) => {
    const { book, chapter, version } = query;

    if (book && typeof book === 'string' && bookNames[book]) {
      currentBook.value = book;
    }

    if (chapter) {
      const chapterNum = parseInt(chapter as string);
      if (!isNaN(chapterNum) && chapterNum > 0) {
        currentChapter.value = Math.min(chapterNum, bookChapters[currentBook.value] || 1);
      }
    }

    if (version && typeof version === 'string' && versionNames[version]) {
      currentVersion.value = version;
    } else {
      currentVersion.value = 'GAE';
    }
  };

  // ============================================
  // URL Generation
  // ============================================

  const generateShareUrl = (verseRange?: BibleVerseRange): string => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const params = new URLSearchParams();

    params.set('book', currentBook.value);
    params.set('chapter', String(currentChapter.value));

    // GAE(개역개정)가 아닐 때만 version 포함
    if (currentVersion.value !== 'GAE') {
      params.set('version', currentVersion.value);
    }

    if (verseRange && verseRange.start > 0 && verseRange.end >= verseRange.start) {
      params.set('verse', formatVerseRangeParam(verseRange));
    }

    return `${baseUrl}/bible?${params.toString()}`;
  };

  // ============================================
  // Return
  // ============================================

  return {
    // State
    viewMode,
    currentBook,
    currentChapter,
    currentVersion,

    // Computed - Display
    currentBookName,
    currentVersionName,
    maxChapters,
    chapterSuffix,

    // Computed - Navigation
    hasPrevChapter,
    hasNextChapter,

    // View Mode Actions
    goHome,
    goToc,
    goReader,
    goBack,

    // Navigation Actions
    goToPrevChapter,
    goToNextChapter,

    // Selection Actions
    selectBook,
    selectVersion,

    // Query Initialization
    initFromQuery,

    // URL Generation
    generateShareUrl,
  };
}
