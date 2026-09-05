/**
 * Tongdok Mode Composable
 *
 * 통독모드 상태 관리 및 관련 기능 제공
 * - localStorage를 통한 상태 영속화
 * - URL 파라미터와의 동기화
 */
import { ref, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { BIBLE_BOOKS, useBibleData } from './useBibleData';
import { useApi } from './useApi';
import type { paths } from '~/types/generated/api-schema';
import {
  selectTongdokAudioLink,
  type ChapterFallbackAudioLink,
} from '~/utils/tongdokAudioSelection';

export interface PlanDetail {
  book: string;
  book_kor?: string;
  start_chapter: number;
  end_chapter: number;
  is_complete: boolean;
  schedule_id?: number;
  date?: string;
}

export interface ReadingDetailData {
  book?: string;
  chapter?: number | string;
  plan_id?: number;
  plan_detail?: PlanDetail[];
  audio_link?: string | null;
  fallback_audio_links?: ChapterFallbackAudioLink[] | null;
  guide_link?: string | null;
  plan_date?: string;
  schedule_date?: string;
  message?: string;
  is_complete?: boolean;
}

export interface ReadingDetailResponse {
  data?: ReadingDetailData;
}

type BibleBook = NonNullable<
  paths['/api/v1/todos/detail/']['get']['parameters']['query']
>['book'];

const BIBLE_BOOK_CODES = new Set<string>(
  [...BIBLE_BOOKS.old, ...BIBLE_BOOKS.new].map(book => book.id)
);

const toBibleBook = (value: string): BibleBook | undefined =>
  BIBLE_BOOK_CODES.has(value) ? (value as BibleBook) : undefined;

// localStorage 키
const TONGDOK_STATE_KEY = 'tongdokModeState';

interface TongdokStateStorage {
  enabled: boolean;
  scheduleId: number | null;
  planId: number | null;
  updatedAt: string;
}

/**
 * localStorage에서 통독모드 상태 로드
 */
const loadTongdokState = (): TongdokStateStorage | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(TONGDOK_STATE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

/**
 * localStorage에 통독모드 상태 저장
 */
const saveTongdokState = (state: TongdokStateStorage): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TONGDOK_STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save tongdok state:', e);
  }
};

/**
 * localStorage에서 통독모드 상태 삭제
 */
const clearTongdokState = (): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TONGDOK_STATE_KEY);
  } catch (e) {
    console.warn('Failed to clear tongdok state:', e);
  }
};

// 상태 (singleton - 모듈 레벨에서 공유)
const tongdokMode = ref(false);
const tongdokScheduleId: Ref<number | null> = ref(null);
const tongdokPlanId: Ref<number | null> = ref(null);
const readingDetailResponse: Ref<ReadingDetailResponse | null> = ref(null);
const isCompleting = ref(false);

export const useTongdokMode = () => {
  const route = useRoute();
  const router = useRouter();
  const api = useApi();
  const { bookNames } = useBibleData();

  /**
   * 통독모드 초기화
   * 우선순위: URL 파라미터 > localStorage
   */
  const initTongdokMode = (): void => {
    const { tongdok, schedule, plan } = route.query;

    // 1. URL 파라미터가 있으면 우선 사용
    if (tongdok === 'true' || plan) {
      tongdokMode.value = true;
      tongdokScheduleId.value = schedule ? Number(schedule) : null;
      tongdokPlanId.value = plan ? Number(plan) : null;

      // localStorage에도 저장
      saveTongdokState({
        enabled: true,
        scheduleId: tongdokScheduleId.value,
        planId: tongdokPlanId.value,
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    // 2. URL에 없으면 localStorage에서 복원
    const savedState = loadTongdokState();
    if (savedState && savedState.enabled) {
      tongdokMode.value = true;
      tongdokScheduleId.value = savedState.scheduleId;
      tongdokPlanId.value = savedState.planId;
    }
  };

  /**
   * 통독모드 현재 일정 범위 표시용 computed
   */
  const getTongdokScheduleRange = (currentBook: string, currentChapter: number): string | null => {
    if (!tongdokMode.value || !readingDetailResponse.value?.data?.plan_detail) {
      return null;
    }

    const planDetails = readingDetailResponse.value.data.plan_detail;
    if (planDetails.length === 0) return null;

    // 현재 장이 속한 구간 찾기
    const currentDetail = planDetails.find(detail =>
      detail.book === currentBook &&
      currentChapter >= detail.start_chapter &&
      currentChapter <= detail.end_chapter
    );

    if (!currentDetail) return null;

    const bookName = bookNames[currentDetail.book] || currentDetail.book;
    const chapters = currentDetail.start_chapter === currentDetail.end_chapter
      ? `${currentDetail.start_chapter}장`
      : `${currentDetail.start_chapter}-${currentDetail.end_chapter}장`;

    return `${bookName} ${chapters}`;
  };

  /**
   * 통독모드에서 마지막 장인지 확인
   */
  const isLastChapterInTongdok = (currentBook: string, currentChapter: number): boolean => {
    if (!tongdokMode.value || !readingDetailResponse.value?.data?.plan_detail) {
      return false;
    }

    const planDetails = readingDetailResponse.value.data.plan_detail;
    if (planDetails.length === 0) return false;

    // 마지막 구간의 마지막 장인지 확인
    const lastDetail = planDetails[planDetails.length - 1];
    if (!lastDetail) return false;

    return currentBook === lastDetail.book &&
           currentChapter === lastDetail.end_chapter;
  };

  /**
   * 장 완료 여부 확인
   */
  const isChapterCompleted = (book: string, chapter: number): boolean => {
    if (!readingDetailResponse.value?.data?.plan_detail) return false;

    const detail = readingDetailResponse.value.data.plan_detail.find((d) => {
      const isTargetBook = d.book === book;
      const isInRange = chapter >= d.start_chapter && chapter <= d.end_chapter;
      return isTargetBook && isInRange;
    });

    return detail?.is_complete || false;
  };

  /**
   * 현재 일정(스케줄) 전체가 완료되었는지 확인
   * - readingDetailResponse.data.is_complete 또는
   * - 모든 plan_detail의 is_complete가 true인 경우
   */
  const isScheduleCompleted = (): boolean => {
    if (!readingDetailResponse.value?.data) return false;

    // 1. 전체 일정 완료 플래그 확인
    if (readingDetailResponse.value.data.is_complete === true) {
      return true;
    }

    // 2. 모든 plan_detail이 완료되었는지 확인
    const planDetails = readingDetailResponse.value.data.plan_detail;
    if (!planDetails || planDetails.length === 0) return false;

    return planDetails.every(detail => detail.is_complete === true);
  };

  /**
   * 통독모드 끄기
   */
  const disableTongdokMode = (): void => {
    tongdokMode.value = false;
    tongdokScheduleId.value = null;
    tongdokPlanId.value = null;
    clearTongdokState();

    const { tongdok, schedule, plan, from, ...restQuery } = route.query;
    router.replace({ query: restQuery });
  };

  /**
   * 통독모드 켜기
   */
  const enableTongdokMode = (scheduleId?: number, planId?: number): void => {
    tongdokMode.value = true;
    if (scheduleId) {
      tongdokScheduleId.value = scheduleId;
    }
    if (planId) {
      tongdokPlanId.value = planId;
    }

    saveTongdokState({
      enabled: true,
      scheduleId: tongdokScheduleId.value,
      planId: tongdokPlanId.value,
      updatedAt: new Date().toISOString(),
    });
  };

  /**
   * 읽기 응답 데이터 설정
   */
  const setReadingDetailResponse = (response: ReadingDetailResponse | null): void => {
    readingDetailResponse.value = response;
  };

  const loadReadingDetail = async (
    planId: number | null,
    book: string,
    chapter: number
  ): Promise<ReadingDetailData | null> => {
    if (!planId) {
      console.warn('Plan ID is missing for loadReadingDetail');
      return null;
    }

    const bibleBook = toBibleBook(book);
    if (!bibleBook) return null;

    try {
      const hasSameData =
        readingDetailResponse.value?.data &&
        readingDetailResponse.value.data.book === book &&
        readingDetailResponse.value.data.chapter === chapter;

      if (hasSameData) {
        return readingDetailResponse.value?.data || null;
      }

      const response = await api.GET('/api/v1/todos/detail/', {
        params: {
          plan_id: planId,
          book: bibleBook,
          chapter,
        },
      });

      readingDetailResponse.value = response;
      return response.data || null;
    } catch (error) {
      console.error('Failed to load reading detail:', error);
      return null;
    }
  };

  const getAudioLink = (book?: string | null, chapter?: number | string | null): string | null => {
    const detail = readingDetailResponse.value?.data;
    return selectTongdokAudioLink({
      audioLink: detail?.audio_link,
      fallbackLinks: detail?.fallback_audio_links,
      book,
      chapter,
    });
  };

  const getGuideLink = (): string | null => {
    return readingDetailResponse.value?.data?.guide_link || null;
  };

  const getScheduleDate = (): string | null => {
    return readingDetailResponse.value?.data?.plan_date || readingDetailResponse.value?.data?.schedule_date || null;
  };

  /**
   * 통독 진행 상황 계산
   * @returns { current: 현재 장 순번(1부터), total: 전체 장 수 }
   */
  const getTongdokProgress = (currentBook: string, currentChapter: number): { current: number; total: number } | null => {
    if (!tongdokMode.value || !readingDetailResponse.value?.data?.plan_detail) {
      return null;
    }

    const planDetails = readingDetailResponse.value.data.plan_detail;
    if (planDetails.length === 0) return null;

    let total = 0;
    let current = 0;
    let foundCurrent = false;

    for (const detail of planDetails) {
      const chapterCount = detail.end_chapter - detail.start_chapter + 1;
      total += chapterCount;

      if (!foundCurrent) {
        if (detail.book === currentBook &&
            currentChapter >= detail.start_chapter &&
            currentChapter <= detail.end_chapter) {
          // 현재 장이 이 구간에 있음
          current += (currentChapter - detail.start_chapter + 1);
          foundCurrent = true;
        } else {
          // 이전 구간들은 모두 카운트
          current += chapterCount;
        }
      }
    }

    if (!foundCurrent) {
      // 현재 위치를 찾지 못한 경우 (범위 밖)
      return { current: 1, total };
    }

    return { current, total };
  };

  /**
   * 현재 일정의 구간 정보 가져오기
   */
  const getCurrentSectionChapters = (currentBook: string): Array<{
    book: string;
    book_kor: string;
    chapters: number[];
  }> => {
    if (!readingDetailResponse.value?.data?.plan_detail) return [];

    const planDetails = readingDetailResponse.value.data.plan_detail;
    return planDetails.map(detail => ({
      book: detail.book,
      book_kor: bookNames[detail.book] || detail.book,
      chapters: Array.from(
        { length: detail.end_chapter - detail.start_chapter + 1 },
        (_, i) => detail.start_chapter + i
      )
    }));
  };

  /**
   * 통독 전체 범위 문자열 가져오기
   */
  const getFullScheduleRange = (): string => {
    if (!readingDetailResponse.value?.data?.plan_detail) return '';

    const planDetails = readingDetailResponse.value.data.plan_detail;
    if (planDetails.length === 0) return '';

    // 모든 구간을 문자열로
    return planDetails.map(detail => {
      const bookName = bookNames[detail.book] || detail.book;
      const chapters = detail.start_chapter === detail.end_chapter
        ? `${detail.start_chapter}장`
        : `${detail.start_chapter}-${detail.end_chapter}장`;
      return `${bookName} ${chapters}`;
    }).join(', ');
  };

  /**
   * 통독 완료 처리 API 호출
   */
  const completeReading = async (): Promise<boolean> => {
    if (!tongdokPlanId.value || !tongdokScheduleId.value) {
      console.warn('Plan ID or Schedule ID is missing');
      return false;
    }

    isCompleting.value = true;
    try {
      await api.POST('/api/v1/todos/reading/update/', {
        plan_id: tongdokPlanId.value,
        schedule_ids: [tongdokScheduleId.value],
        action: 'complete'
      });

      clearTongdokState();
      tongdokMode.value = false;
      tongdokScheduleId.value = null;
      tongdokPlanId.value = null;

      return true;
    } catch (error) {
      console.error('통독 완료 처리 실패:', error);
      return false;
    } finally {
      isCompleting.value = false;
    }
  };

  return {
    tongdokMode,
    tongdokScheduleId,
    tongdokPlanId,
    readingDetailResponse,
    isCompleting,

    initTongdokMode,
    getTongdokScheduleRange,
    getFullScheduleRange,
    isLastChapterInTongdok,
    isChapterCompleted,
    isScheduleCompleted,
    disableTongdokMode,
    enableTongdokMode,
    setReadingDetailResponse,
    getCurrentSectionChapters,
    completeReading,
    loadReadingDetail,
    getAudioLink,
    getGuideLink,
    getScheduleDate,
    getTongdokProgress,
  };
};
