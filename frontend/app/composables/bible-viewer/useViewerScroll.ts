import { nextTick, onUnmounted, type Ref } from 'vue';
import type { ResolvedViewerProps, ViewerEmit } from './types';
import type { VerseSelection } from './useVerseSelection';

// 스크롤 진행 emit + 위치 복원 + 검색어/절 포커스.
// 진행바는 프레임마다 갱신(rAF), 위치 저장은下游에서 debounce.
export function useViewerScroll(
  viewerRef: Ref<HTMLElement | null>,
  props: ResolvedViewerProps,
  emit: ViewerEmit,
  selection: VerseSelection,
) {
  let scrollRaf = 0;
  const handleScroll = () => {
    if (viewerRef.value) emit('scroll-pixels', viewerRef.value.scrollTop);
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      if (viewerRef.value) {
        const { scrollTop, scrollHeight, clientHeight } = viewerRef.value;
        const maxScroll = scrollHeight - clientHeight;
        const position = maxScroll > 0 ? scrollTop / maxScroll : 0;
        emit('scroll', position);
      }
    });
  };

  // 스크롤 위치 복원
  const restoreScrollPosition = () => {
    if (!viewerRef.value) return;

    const { scrollHeight, clientHeight } = viewerRef.value;
    const maxScroll = scrollHeight - clientHeight;
    const scrollPosition = Math.min(1, Math.max(0, props.initialScrollPosition));
    viewerRef.value.scrollTop = scrollPosition * maxScroll;
  };

  // 검색 결과 강조용 타이머
  let searchHighlightTimeout: ReturnType<typeof setTimeout> | null = null;

  const clearFocusedSearchTerms = () => {
    if (!viewerRef.value) return;

    viewerRef.value.querySelectorAll('mark.focused-search-term')
      .forEach((mark) => {
        mark.replaceWith(document.createTextNode(mark.textContent || ''));
      });
  };

  const findVerseElement = (verseNumber: number): Element | null => {
    if (!viewerRef.value) return null;

    const verseElements = viewerRef.value.querySelectorAll('.verse');
    for (const el of verseElements) {
      const numEl = el.querySelector('.verse-number');
      const num = parseInt(numEl?.textContent?.trim() || '0', 10);
      if (num === verseNumber) return el;
    }

    const supEl = viewerRef.value.querySelector(`[data-verse="${verseNumber}"]`);
    return supEl?.closest('.verse') || supEl;
  };

  const focusSearchTermInVerse = (verseNumber: number, searchTerm?: string | null) => {
    clearFocusedSearchTerms();
    if (!searchTerm) return;

    const targetVerse = findVerseElement(verseNumber);
    if (!targetVerse) return;

    const normalizedTerm = searchTerm.trim().toLowerCase();
    if (!normalizedTerm) return;

    const walker = document.createTreeWalker(targetVerse, NodeFilter.SHOW_TEXT);
    let currentNode = walker.nextNode();
    while (currentNode) {
      const text = currentNode.textContent || '';
      const index = text.toLowerCase().indexOf(normalizedTerm);
      if (index >= 0) {
        const range = document.createRange();
        range.setStart(currentNode, index);
        range.setEnd(currentNode, index + searchTerm.trim().length);
        const mark = document.createElement('mark');
        mark.className = 'focused-search-term';
        range.surroundContents(mark);
        mark.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        return;
      }

      currentNode = walker.nextNode();
    }
  };

  // 특정 절로 스크롤 및 강조
  const scrollToVerse = (verseNumber: number) => {
    if (!viewerRef.value) return;

    // 기존 강조 제거
    if (searchHighlightTimeout) {
      clearTimeout(searchHighlightTimeout);
      searchHighlightTimeout = null;
    }
    clearFocusedSearchTerms();
    viewerRef.value.querySelectorAll('.verse.search-highlight')
      .forEach((el) => {
        el.classList.remove('search-highlight');
      });

    const targetVerse = findVerseElement(verseNumber);

    if (targetVerse) {
      // 스크롤
      targetVerse.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // 강조 스타일 적용
      targetVerse.classList.add('search-highlight');

      // 3초 후 강조 제거
      searchHighlightTimeout = setTimeout(() => {
        targetVerse?.classList.remove('search-highlight');
        searchHighlightTimeout = null;
      }, 3000);
    }
  };

  const focusVerseRange = (startVerse: number, endVerse: number, searchTerm?: string | null) => {
    if (!viewerRef.value || startVerse <= 0 || endVerse < startVerse) return;

    selection.clearAllSelections();
    selection.selectedVerses.value = { start: startVerse, end: endVerse };
    selection.selectionMode.value = null;
    selection.highlightVerses(startVerse, endVerse);
    scrollToVerse(startVerse);
    nextTick(() => {
      focusSearchTermInVerse(startVerse, searchTerm);
    });
  };

  onUnmounted(() => {
    if (scrollRaf) {
      cancelAnimationFrame(scrollRaf);
      scrollRaf = 0;
    }
    // 검색 강조 타이머 정리
    if (searchHighlightTimeout) {
      clearTimeout(searchHighlightTimeout);
    }
  });

  return {
    handleScroll,
    restoreScrollPosition,
    scrollToVerse,
    focusVerseRange,
  };
}
