/**
 * useShareSheet - 성경 본문 공유 시트 상태와 공유 액션
 *
 * pages/bible/index.vue에서 분리한 공유 관심사:
 * ShareSheet v-model 상태, 구절/장 공유 링크 생성(Web Share → 클립보드 폴백),
 * 시트 결과·에러 토스트를 한곳에서 관리한다.
 */

import { ref, type Ref, type ComputedRef } from 'vue';
import { useToast } from '~/composables/useToast';
import { useErrorHandler } from '~/composables/useErrorHandler';
import type { BibleShareMetadata, BibleShareVerse } from '~/composables/bible/bibleShare';
import type { BibleVerseRange } from '~/composables/bible/useBiblePageState';
import type { SelectionSharePayload } from '~/components/bible/BibleViewer.vue';

export interface UseShareSheetOptions {
  currentBookName: ComputedRef<string>;
  currentChapter: Ref<number>;
  currentVersionName: ComputedRef<string>;
  chapterSuffix: ComputedRef<string>;
  generateShareUrl: (verseRange?: BibleVerseRange) => string;
}

export function useShareSheet(options: UseShareSheetOptions) {
  const { currentBookName, currentChapter, currentVersionName, chapterSuffix, generateShareUrl } = options;
  const toast = useToast();
  const { handleApiError } = useErrorHandler();

  const showShareSheet = ref(false);
  const shareMode = ref<'verse' | 'complete'>('verse');
  const shareMetadata = ref<BibleShareMetadata>({});
  const shareVerses = ref<BibleShareVerse[]>([]);
  const shareUrl = ref('');
  const shareContext = ref<{ planId: number | null; scheduleId: number | null }>({ planId: null, scheduleId: null });

  // [매일일독] <참조>\n<풀 링크> 형식으로 공유. Web Share → 클립보드 폴백.
  const shareBibleLink = async (reference: string, url: string) => {
    const text = `[매일일독] ${reference}\n${url}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success('링크를 복사했습니다');
    } catch (error) {
      handleApiError(error, '공유');
    }
  };

  const handleShareAction = (selection: SelectionSharePayload) => {
    if ((selection.book && selection.book !== currentBookName.value) ||
        (selection.chapter && selection.chapter !== currentChapter.value) ||
        (selection.version && selection.version !== currentVersionName.value)) return;
    const range = { start: selection.startVerse, end: selection.endVerse };
    const reference = `${selection.book || currentBookName.value} ${selection.chapter || currentChapter.value}:${range.start}${range.end === range.start ? '' : `-${range.end}`}`;
    void shareBibleLink(reference, generateShareUrl(range));
  };

  const handleChapterShare = () => {
    void shareBibleLink(`${currentBookName.value} ${currentChapter.value}${chapterSuffix.value}`, generateShareUrl());
  };

  const handleShareError = (error: Error) => handleApiError(error, '공유');
  const handleShareResult = (payload: { action: string; result: string }) => {
    if (payload.result === 'copied') toast.success('링크가 복사되었습니다');
    else if (payload.result === 'downloaded') toast.success('이미지를 저장했어요');
    else toast.success('공유 시트를 열었어요');
  };

  return {
    showShareSheet,
    shareMode,
    shareMetadata,
    shareVerses,
    shareUrl,
    shareContext,
    shareBibleLink,
    handleShareAction,
    handleChapterShare,
    handleShareError,
    handleShareResult,
  };
}
