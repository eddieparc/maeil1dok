/**
 * usePersonalRecord
 * 개인 성경 읽기 기록 관리 composable
 * Plan 무관하게 자유 읽기 시 사용
 */
import { ref } from 'vue';
import { useApi } from '~/composables/useApi';
import { useAuthService } from '~/composables/useAuthService';

interface ReadingRecord {
  id: number;
  book: string;
  book_name: string;
  chapter: number;
  read_date: string;
  created_at: string;
}

interface BookProgress {
  read: number;
  total: number;
  percentage: number;
}

export const usePersonalRecord = () => {
  const api = useApi();
  const auth = useAuthService();

  // 책별 읽은 장 캐시 (Map<book, Set<chapter>>)
  const readChapters = ref<Map<string, Set<number>>>(new Map());
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  /**
   * 특정 책의 읽은 장 목록 조회
   */
  const fetchReadChapters = async (book: string): Promise<void> => {
    if (!auth.isAuthenticated.value) return;

    isLoading.value = true;
    error.value = null;

    try {
      const response = await api.GET('/api/v1/todos/bible/personal-records/by-book/', {
        params: { book }
      });

      if (response.data.success) {
        const chapters = new Set<number>(response.data.read_chapters || []);
        readChapters.value.set(book, chapters);
      }
    } catch (err: any) {
      console.error('읽기 기록 조회 실패:', err);
      error.value = err.message || '읽기 기록을 불러오는데 실패했습니다';
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 장 읽음 표시
   */
  const markAsRead = async (book: string, chapter: number): Promise<boolean> => {
    if (!auth.isAuthenticated.value) {
      throw new Error('로그인이 필요합니다');
    }

    isLoading.value = true;
    error.value = null;

    try {
      await api.POST('/api/v1/todos/bible/personal-records/', {
        book,
        chapter
      });

      // 로컬 캐시 업데이트
      if (!readChapters.value.has(book)) {
        readChapters.value.set(book, new Set());
      }
      readChapters.value.get(book)!.add(chapter);

      return true;
    } catch (err: any) {
      // 중복 저장은 성공으로 처리 (이미 읽음 표시된 경우)
      if (err.response?.status === 400) {
        // 로컬 캐시도 업데이트
        if (!readChapters.value.has(book)) {
          readChapters.value.set(book, new Set());
        }
        readChapters.value.get(book)!.add(chapter);
        return true;
      }

      console.error('읽음 표시 실패:', err);
      error.value = err.message || '읽음 표시에 실패했습니다';
      throw err;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 특정 장 읽음 여부 확인
   */
  const isChapterRead = (book: string, chapter: number): boolean => {
    return readChapters.value.get(book)?.has(chapter) || false;
  };

  /**
   * 책별 읽기 진도 계산
   */
  const getBookProgress = (book: string, totalChapters: number): BookProgress => {
    const readCount = readChapters.value.get(book)?.size || 0;
    return {
      read: readCount,
      total: totalChapters,
      percentage: totalChapters > 0 ? Math.round((readCount / totalChapters) * 100) : 0
    };
  };

  /**
   * 캐시 초기화
   */
  const clearCache = () => {
    readChapters.value.clear();
  };

  return {
    // State
    readChapters,
    isLoading,
    error,

    // Methods
    fetchReadChapters,
    markAsRead,
    isChapterRead,
    getBookProgress,
    clearCache
  };
};
