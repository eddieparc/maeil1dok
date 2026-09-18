/**
 * useScheduleApi - 일정 관련 API 호출 composable
 *
 * 일정 조회, 읽기 상태 업데이트 등 모든 일정 관련 API를 중앙화
 */

import { ref } from 'vue';
import { useApi } from '~/composables/useApi';
import { BIBLE_BOOKS } from '~/composables/useBibleData';
import { useErrorHandler } from '~/composables/useErrorHandler';
import { useToast } from '~/composables/useToast';
import type { components, paths } from '~/types/generated/api-schema';
import type {
  Schedule,
  NextPositionResponse,
  ReadingAction,
} from '~/types/plan';

type BibleBook = NonNullable<
  paths['/api/v1/todos/detail/']['get']['parameters']['query']
>['book'];

const BIBLE_BOOK_CODES = new Set<string>(
  [...BIBLE_BOOKS.old, ...BIBLE_BOOKS.new].map(book => book.id)
);
const NEXT_POSITION_STATUSES = new Set<string>([
  'next_incomplete',
  'all_completed',
  'today',
  'nearest',
  'no_schedule',
  'error',
] satisfies NextPositionResponse['status'][]);

const toBibleBook = (value: string): BibleBook | undefined =>
  BIBLE_BOOK_CODES.has(value) ? (value as BibleBook) : undefined;

const normalizeNextPosition = (
  response: components['schemas']['NextReadingPositionResponse']
): NextPositionResponse | null =>
  NEXT_POSITION_STATUSES.has(response.status)
    ? { ...response, status: response.status as NextPositionResponse['status'] }
    : null;

export function useScheduleApi() {
  const api = useApi();
  const { handleApiError } = useErrorHandler();
  const toast = useToast();

  const isFetchingSchedules = ref(false);
  const isFetchingNextPosition = ref(false);
  let pendingSchedules = 0;
  let pendingPositions = 0;

  /**
   * 월별 일정 조회
   */
  async function fetchMonthlySchedules(
    planId: number,
    month: number,
    year?: number,
    options: { throwOnError?: boolean } = {},
  ): Promise<Schedule[]> {
    // Consumers own identity-scoped coalescing. A concurrent caller must never
    // receive a fabricated empty month (or another identity's in-flight data).
    pendingSchedules++;
    isFetchingSchedules.value = true;

    try {
      const response = await api.GET('/api/v1/todos/schedules/month/', {
        params: { plan_id: planId, month, ...(year === undefined ? {} : { year }) },
      });
      return response.data.map(schedule => ({
        ...schedule,
        is_completed: schedule.is_completed ?? false,
      }));
    } catch (error) {
      handleApiError(error, '일정 조회', { silent: true });
      if (options.throwOnError) throw error;
      return [];
    } finally {
      isFetchingSchedules.value = --pendingSchedules > 0;
    }
  }

  /**
   * 연간 월별 진행 요약 조회 (월 도트용 — 12개월 일정을 한 번의 요청으로)
   */
  async function fetchYearProgress(
    planId: number,
    year: number,
    options: { throwOnError?: boolean } = {},
  ): Promise<components['schemas']['ProgressStatsMonthlyProgress'][]> {
    pendingSchedules++;
    isFetchingSchedules.value = true;

    try {
      const { data } = await api.GET('/api/v1/todos/stats/progress/', {
        params: { plan_id: planId, year },
      });
      return data.monthly_progress ?? [];
    } catch (error) {
      handleApiError(error, '월별 진행 조회', { silent: true });
      if (options.throwOnError) throw error;
      return [];
    } finally {
      isFetchingSchedules.value = --pendingSchedules > 0;
    }
  }

  /**
   * 다음 미완료 위치 조회
   */
  async function fetchNextPosition(
    planId: number
  ): Promise<NextPositionResponse | null> {
    pendingPositions++;
    isFetchingNextPosition.value = true;

    try {
      const { data } = await api.GET('/api/v1/todos/next-position/', {
        params: { plan_id: planId },
      });
      return normalizeNextPosition(data);
    } catch (error) {
      handleApiError(error, '다음 위치 조회', { silent: true });
      return null;
    } finally {
      isFetchingNextPosition.value = --pendingPositions > 0;
    }
  }

  /**
   * 현재 읽기 위치 조회
   */
  async function fetchCurrentPosition(
    planId: number,
    book: string,
    chapter: number
  ): Promise<components['schemas']['ChapterDetailResponse'] | null> {
    const bibleBook = toBibleBook(book);
    if (!bibleBook) return null;

    try {
      const response = await api.GET('/api/v1/todos/detail/', {
        params: { plan_id: planId, book: bibleBook, chapter },
      });
      return response.data;
    } catch (error) {
      handleApiError(error, '현재 위치 조회', { silent: true });
      return null;
    }
  }

  /**
   * 읽기 상태 업데이트
   */
  async function updateReadingStatus(
    planId: number,
    scheduleIds: number[],
    action: ReadingAction
  ): Promise<boolean> {
    try {
      const response = await api.POST('/api/v1/todos/reading/update/', {
        plan_id: planId,
        schedule_ids: scheduleIds,
        action,
      });
      return response.success !== false;
    } catch (error) {
      handleApiError(error, '상태 변경');
      return false;
    }
  }

  /**
   * 일괄 읽기 상태 업데이트 (토스트 메시지 포함)
   */
  async function updateBulkReadingStatus(
    planId: number,
    scheduleIds: number[],
    action: ReadingAction
  ): Promise<boolean> {
    const success = await updateReadingStatus(planId, scheduleIds, action);

    if (success) {
      const message = action === 'complete'
        ? '읽음으로 저장되었습니다.'
        : '읽지 않음으로 저장되었습니다.';
      toast.success(message);
    }

    return success;
  }

  return {
    // 상태
    isFetchingSchedules,
    isFetchingNextPosition,

    // API 메서드
    fetchMonthlySchedules,
    fetchYearProgress,
    fetchNextPosition,
    fetchCurrentPosition,
    updateReadingStatus,
    updateBulkReadingStatus,
  };
}
