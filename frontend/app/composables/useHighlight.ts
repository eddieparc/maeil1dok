/**
 * Highlight Composable
 *
 * 구절 하이라이트 CRUD 기능 제공
 */
import { ref, type Ref } from 'vue';
import { useAuthService } from '~/composables/useAuthService';
import { useApi } from './useApi';
import type { Highlight } from '~/types/bible';
import type { components } from '~/types/generated/api-schema';

// Re-export for backward compatibility
export type { Highlight } from '~/types/bible';

// 기본 색상 팔레트
export const DEFAULT_HIGHLIGHT_COLORS = [
  { name: '노랑', value: '#FEF3C7' },
  { name: '초록', value: '#D1FAE5' },
  { name: '파랑', value: '#DBEAFE' },
  { name: '빨강', value: '#FEE2E2' },
  { name: '보라', value: '#E9D5FF' },
];

const normalizeHighlight = (highlight: components['schemas']['BibleHighlight']): Highlight => ({
  ...highlight,
  color: highlight.color ?? DEFAULT_HIGHLIGHT_COLORS[0]!.value,
});

export const useHighlight = () => {
  const auth = useAuthService();
  const api = useApi();

  // 상태
  const highlights: Ref<Highlight[]> = ref([]);
  const chapterHighlights: Ref<Highlight[]> = ref([]);
  const isHighlightLoading = ref(false);

  // 사용자 지정 색상 (localStorage)
  const customColors = ref<string[]>(
    typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem('highlightCustomColors') || '[]')
      : []
  );

  /**
   * 사용자 지정 색상 저장
   */
  const saveCustomColors = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('highlightCustomColors', JSON.stringify(customColors.value));
    }
  };

  /**
   * 사용자 지정 색상 추가
   */
  const addCustomColor = (color: string) => {
    if (!customColors.value.includes(color)) {
      customColors.value.push(color);
      saveCustomColors();
    }
  };

  /**
   * 전체 하이라이트 목록 불러오기
   */
  const fetchHighlights = async (): Promise<void> => {
    if (!auth.isAuthenticated.value) return;

    try {
      isHighlightLoading.value = true;
      const response = await api.GET('/api/v1/todos/bible/highlights/');
      highlights.value = response.data.results.map(normalizeHighlight);
    } catch (error) {
      console.error('하이라이트 목록 조회 실패:', error);
      highlights.value = [];
    } finally {
      isHighlightLoading.value = false;
    }
  };

  /**
   * 장별 하이라이트 불러오기
   */
  const fetchChapterHighlights = async (book: string, chapter: number): Promise<void> => {
    if (!auth.isAuthenticated.value) {
      chapterHighlights.value = [];
      return;
    }

    try {
      const response = await api.GET('/api/v1/todos/bible/highlights/by-chapter/', {
        params: { book, chapter }
      });
      chapterHighlights.value = response.data.highlights.map(normalizeHighlight);
    } catch (error) {
      console.error('장별 하이라이트 조회 실패:', error);
      chapterHighlights.value = [];
    }
  };

  /**
   * 특정 절이 하이라이트 되어있는지 확인
   */
  const getVerseHighlight = (verse: number): Highlight | undefined => {
    return chapterHighlights.value.find(
      h => verse >= h.start_verse && verse <= h.end_verse
    );
  };

  /**
   * 하이라이트 생성
   */
  const createHighlight = async (data: {
    book: string;
    chapter: number;
    start_verse: number;
    end_verse: number;
    color: string;
    memo?: string;
  }): Promise<Highlight | null> => {
    if (!auth.isAuthenticated.value) {
      throw new Error('로그인이 필요합니다');
    }

    try {
      isHighlightLoading.value = true;
      const response = await api.POST('/api/v1/todos/bible/highlights/', data);
      const newHighlight = normalizeHighlight(response);
      if (newHighlight.id) {
        chapterHighlights.value.push(newHighlight);
        return newHighlight;
      }
      console.error('하이라이트 생성 응답 형식 오류:', newHighlight);
      return null;
    } catch (error) {
      console.error('하이라이트 생성 실패:', error);
      return null;
    } finally {
      isHighlightLoading.value = false;
    }
  };

  /**
   * 하이라이트 수정
   */
  const updateHighlight = async (
    id: number,
    data: Partial<Highlight>
  ): Promise<Highlight | null> => {
    if (!auth.isAuthenticated.value) return null;

    try {
      isHighlightLoading.value = true;
      const response = await api.PUT(
        api.path('/api/v1/todos/bible/highlights/{id}/', { id }),
        data,
      );
      const updated = normalizeHighlight(response);

      if (updated.id) {
        const index = chapterHighlights.value.findIndex(h => h.id === id);
        if (index !== -1) {
          chapterHighlights.value[index] = updated;
        }
        return updated;
      }
      return null;
    } catch (error) {
      console.error('하이라이트 수정 실패:', error);
      return null;
    } finally {
      isHighlightLoading.value = false;
    }
  };

  /**
   * 하이라이트 삭제
   */
  const deleteHighlight = async (id: number): Promise<boolean> => {
    if (!auth.isAuthenticated.value) return false;

    try {
      isHighlightLoading.value = true;
      await api.DELETE(api.path('/api/v1/todos/bible/highlights/{id}/', { id }));

      // 로컬 상태 업데이트
      highlights.value = highlights.value.filter(h => h.id !== id);
      chapterHighlights.value = chapterHighlights.value.filter(h => h.id !== id);

      return true;
    } catch (error) {
      console.error('하이라이트 삭제 실패:', error);
      return false;
    } finally {
      isHighlightLoading.value = false;
    }
  };

  /**
   * 현재 장의 하이라이트 개수
   */
  const getChapterHighlightCount = (): number => {
    return chapterHighlights.value.length;
  };

  return {
    // 상태
    highlights,
    chapterHighlights,
    isHighlightLoading,
    customColors,
    DEFAULT_HIGHLIGHT_COLORS,

    // 함수
    addCustomColor,
    fetchHighlights,
    fetchChapterHighlights,
    getVerseHighlight,
    createHighlight,
    updateHighlight,
    deleteHighlight,
    getChapterHighlightCount,
  };
};
