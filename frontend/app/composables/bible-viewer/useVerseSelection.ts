import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue';
import type {
  Highlight,
  ResolvedViewerProps,
  VerseSelectionPayload,
  ViewerEmit,
} from './types';

export interface VerseSelection {
  selectionMode: Ref<'click' | 'drag' | null>;
  showCopyMenu: Ref<boolean>;
  showActionMenu: Ref<boolean>;
  clickSelectedStart: Ref<number | null>;
  clickSelectedEnd: Ref<number | null>;
  clickSelectedVerses: Ref<Array<{ number: number; text: string }>>;
  selectedVerses: Ref<{ start: number; end: number }>;
  selectedText: Ref<string>;
  isSelectedVerseHighlighted: Ref<boolean>;
  getVerseText: (el: Element) => string;
  getSelectionPayload: () => VerseSelectionPayload | null;
  getSelectedVerseHighlight: () => Highlight | undefined;
  emitSelectionMenuChange: () => void;
  clearVerseHighlight: () => void;
  clearClickSelection: () => void;
  clearDragSelection: () => void;
  clearAllSelections: () => void;
  highlightVerses: (start: number, end: number) => void;
  handleVerseClick: (event: MouseEvent | TouchEvent) => void;
  hideActionMenu: () => void;
}

// 절 클릭/텍스트 드래그 선택 상태 머신. DOM 조작은 viewerRef 안의
// 렌더된 본문에 한정하고, 메뉴 상태 변화는 emitSelectionMenuChange로 알린다.
export function useVerseSelection(
  viewerRef: Ref<HTMLElement | null>,
  props: ResolvedViewerProps,
  emit: ViewerEmit,
): VerseSelection {
  // 선택 모드: 'click' (절 클릭) | 'drag' (텍스트 드래그) | null
  const selectionMode = ref<'click' | 'drag' | null>(null);

  // 절 클릭 선택 상태 (복사 메뉴용 데이터)
  const showCopyMenu = ref(false);
  const clickSelectedStart = ref<number | null>(null);
  const clickSelectedEnd = ref<number | null>(null);
  const clickSelectedVerses = ref<Array<{ number: number; text: string }>>([]);

  // 텍스트 드래그/클릭 선택 상태 (플로팅 액션 메뉴용)
  const showActionMenu = ref(false);
  const selectedVerses = ref({ start: 0, end: 0 });
  const selectedText = ref('');

  // Read the complete verse, including KNT continuation lines, from sanitized content.
  const getVerseText = (el: Element): string => Array.from(el.querySelectorAll('.verse-text'))
    .map(line => line.textContent?.trim() || '').filter(Boolean).join(' ');

  const getSelectionPayload = (): VerseSelectionPayload | null => {
    const { start, end } = selectedVerses.value;
    if (start <= 0 || end < start || !viewerRef.value) return null;
    const verses: VerseSelectionPayload['verses'] = [];
    viewerRef.value.querySelectorAll('.verse').forEach(el => {
      const number = Number(el.querySelector('.verse-number')?.textContent?.trim());
      if (number >= start && number <= end) verses.push({ number, text: getVerseText(el) });
    });
    if (!verses.length) return null;
    return { book: props.book, chapter: props.chapter, version: props.version,
      start, end, text: verses.map(verse => verse.text).join(' '), verses };
  };

  // 현재 선택된 절이 하이라이트되어 있는지 확인
  const isSelectedVerseHighlighted = computed(() => {
    if (!selectedVerses.value.start) return false;
    return props.highlights.some(
      h => h.start_verse === selectedVerses.value.start &&
           h.end_verse === selectedVerses.value.end
    );
  });

  // 현재 선택된 절의 하이라이트 정보 가져오기
  const getSelectedVerseHighlight = (): Highlight | undefined => {
    if (!selectedVerses.value.start) return undefined;
    return props.highlights.find(
      h => h.start_verse === selectedVerses.value.start &&
           h.end_verse === selectedVerses.value.end
    );
  };

  const emitSelectionMenuChange = () => {
    const visible = showActionMenu.value || showCopyMenu.value;
    const selection = visible ? getSelectionPayload() : null;
    // Consumers receive a detached snapshot before any action can open a sheet.
    if (selection) emit('verse-select', selection);
    emit('selection-menu-change', {
      visible,
      mode: showActionMenu.value ? 'action' : showCopyMenu.value ? 'copy' : null,
      isHighlighted: isSelectedVerseHighlighted.value,
      isSingleVerse: selectedVerses.value.start === selectedVerses.value.end,
      highlightColor: getSelectedVerseHighlight()?.color ?? null,
      selection,
    });
  };

  // ====== 절 클릭 선택 기능 (reading.vue 방식) ======

  // 절 하이라이트 해제
  const clearVerseHighlight = () => {
    if (!viewerRef.value) return;
    viewerRef.value.querySelectorAll('.verse.selected-verse')
      .forEach((el) => {
        el.classList.remove('selected-verse', 'selected-first', 'selected-middle', 'selected-last');
      });
  };

  // 절 클릭 선택 초기화
  const clearClickSelection = () => {
    showCopyMenu.value = false;
    clearVerseHighlight();
    clickSelectedVerses.value = [];
    clickSelectedStart.value = null;
    clickSelectedEnd.value = null;
    if (selectionMode.value === 'click') {
      selectionMode.value = null;
    }
    emitSelectionMenuChange();
  };

  // 텍스트 드래그 선택 초기화
  const clearDragSelection = () => {
    showActionMenu.value = false;
    selectedVerses.value = { start: 0, end: 0 };
    selectedText.value = '';
    window.getSelection()?.removeAllRanges();
    if (selectionMode.value === 'drag') {
      selectionMode.value = null;
    }
    emitSelectionMenuChange();
  };

  // 모든 선택 초기화
  const clearAllSelections = () => {
    clearDragSelection();
    clearClickSelection();
  };

  // 절 하이라이트 적용
  const highlightVerses = (start: number, end: number) => {
    if (!viewerRef.value) return;
    viewerRef.value.querySelectorAll('.verse').forEach((el) => {
      const numEl = el.querySelector('.verse-number');
      if (!numEl) return;
      const n = parseInt(numEl.textContent?.trim() || '0', 10);
      if (n >= start && n <= end) {
        el.classList.add('selected-verse');
        // 위치 클래스 초기화
        el.classList.remove('selected-first', 'selected-middle', 'selected-last');
        // 범위 선택인 경우 위치에 따른 클래스 추가
        if (start !== end) {
          if (n === start) {
            el.classList.add('selected-first');
          } else if (n === end) {
            el.classList.add('selected-last');
          } else {
            el.classList.add('selected-middle');
          }
        }
      } else {
        el.classList.remove('selected-verse', 'selected-first', 'selected-middle', 'selected-last');
      }
    });
  };

  // 절 클릭 핸들러 - 액션 메뉴 표시
  const handleVerseClick = (event: MouseEvent | TouchEvent) => {
    const target = event.target as HTMLElement;
    const verseEl = target.closest('.verse');
    if (!verseEl) return;

    event.stopPropagation();

    // 드래그 선택이 진행 중이면 무시 (텍스트 선택 후 클릭 시)
    const browserSelection = window.getSelection();
    if (browserSelection && !browserSelection.isCollapsed && browserSelection.toString().trim()) {
      return;
    }

    const numEl = verseEl.querySelector('.verse-number');
    const textEl = verseEl.querySelector('.verse-text');
    if (!numEl || !textEl) return;

    const num = parseInt(numEl.textContent?.trim() || '0', 10);
    const txt = getVerseText(verseEl);

    // 단일 절 선택 상태에서 같은 절을 다시 클릭하면 해제
    if (
      clickSelectedStart.value !== null &&
      clickSelectedEnd.value === null &&
      clickSelectedStart.value === num &&
      clickSelectedVerses.value.length === 1
    ) {
      clearAllSelections();
      return;
    }

    // 드래그 선택 해제 후 클릭 선택 시작
    clearDragSelection();
    selectionMode.value = 'click';

    if (clickSelectedStart.value === null) {
      // 시작점 설정
      clearVerseHighlight();
      clickSelectedVerses.value = [];
      clickSelectedStart.value = num;
      clickSelectedEnd.value = null;
      clickSelectedVerses.value = [{ number: num, text: txt }];
      highlightVerses(num, num);

      // 액션 메뉴용 데이터 설정
      selectedVerses.value = { start: num, end: num };
      selectedText.value = txt;
      showActionMenu.value = true;
      emitSelectionMenuChange();
    } else if (clickSelectedEnd.value === null) {
      // 끝점 설정 및 범위 선택
      clickSelectedEnd.value = num;
      const start = Math.min(clickSelectedStart.value, clickSelectedEnd.value);
      const end = Math.max(clickSelectedStart.value, clickSelectedEnd.value);
      highlightVerses(start, end);

      // 선택 구간의 number/text 저장
      const versesArray: Array<{ number: number; text: string }> = [];
      let combinedText = '';
      if (viewerRef.value) {
        viewerRef.value.querySelectorAll('.verse').forEach((el) => {
          const nEl = el.querySelector('.verse-number');
          const tEl = el.querySelector('.verse-text');
          if (!nEl || !tEl) return;
          const n = parseInt(nEl.textContent?.trim() || '0', 10);
          if (n >= start && n <= end) {
            const verseText = getVerseText(el);
            versesArray.push({ number: n, text: verseText });
            combinedText += (combinedText ? ' ' : '') + verseText;
          }
        });
      }
      clickSelectedVerses.value = versesArray;

      // 액션 메뉴용 데이터 설정
      selectedVerses.value = { start, end };
      selectedText.value = combinedText;

      showActionMenu.value = true;
      emitSelectionMenuChange();
    } else {
      clearAllSelections();
      selectionMode.value = 'click';
      clickSelectedStart.value = num;
      clickSelectedVerses.value = [{ number: num, text: txt }];
      highlightVerses(num, num);
      selectedVerses.value = { start: num, end: num };
      selectedText.value = txt;
      showActionMenu.value = true;
      emitSelectionMenuChange();
    }
  };

  // ====== 텍스트 드래그 선택 기능 (플로팅 액션 메뉴) ======

  // 텍스트 선택 핸들러
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      // 선택이 해제되면 액션 메뉴 숨김
      if (selectionMode.value === 'drag') {
        hideActionMenu();
      }
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      if (selectionMode.value === 'drag') {
        hideActionMenu();
      }
      return;
    }

    // 선택 범위가 bible-content 내부인지 확인
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const isInBibleContent = container.parentElement?.closest('.bible-content') ||
                             (container as Element).closest?.('.bible-content');
    if (!isInBibleContent || !viewerRef.value?.contains(container)) {
      return;
    }

    // 클릭 선택 해제 후 드래그 선택 시작
    clearClickSelection();
    selectionMode.value = 'drag';

    // 선택된 텍스트에서 절 번호 추출
    const verses = extractVerseNumbers(range);

    if (verses.start > 0) {
      selectedVerses.value = verses;
      const payload = getSelectionPayload();
      selectedText.value = payload?.text || text;
      clickSelectedVerses.value = payload?.verses || [];
      showActionMenu.value = true;
      emitSelectionMenuChange();
    }
  };

  // 절 번호 추출
  const extractVerseNumbers = (range: Range): { start: number; end: number } => {
    let start = 0;
    let end = 0;
    // Intersect whole verse elements: a selection may begin after its verse number.
    viewerRef.value?.querySelectorAll('.verse').forEach(el => {
      if (!range.intersectsNode(el)) return;
      const number = Number(el.querySelector('.verse-number')?.textContent?.trim());
      if (!number) return;
      if (!start) start = number;
      end = number;
    });
    return { start, end };
  };

  // 액션 메뉴 숨기기
  const hideActionMenu = () => {
    showActionMenu.value = false;
    if (selectionMode.value === 'drag') {
      selectionMode.value = null;
    }
    emitSelectionMenuChange();
  };

  // 문서 클릭 시 메뉴 닫기
  const handleDocumentClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // 액션 메뉴 외부 클릭 시 닫기
    if (showActionMenu.value && !target.closest('.selection-action-menu') && !target.closest('.verse')) {
      hideActionMenu();
      clearClickSelection();
    }

    // 복사 메뉴 외부 클릭 시 닫기
    if (showCopyMenu.value && !target.closest('.selection-copy-menu') && !target.closest('.verse')) {
      clearClickSelection();
    }
  };

  onMounted(() => {
    document.addEventListener('click', handleDocumentClick);
    // 텍스트 드래그 선택 감지 (mouseup)
    document.addEventListener('mouseup', handleTextSelection);
    // 터치 디바이스 지원
    document.addEventListener('touchend', handleTextSelection);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleDocumentClick);
    document.removeEventListener('mouseup', handleTextSelection);
    document.removeEventListener('touchend', handleTextSelection);
    // 선택 상태 정리
    clearAllSelections();
  });

  return {
    selectionMode,
    showCopyMenu,
    showActionMenu,
    clickSelectedStart,
    clickSelectedEnd,
    clickSelectedVerses,
    selectedVerses,
    selectedText,
    isSelectedVerseHighlighted,
    getVerseText,
    getSelectionPayload,
    getSelectedVerseHighlight,
    emitSelectionMenuChange,
    clearVerseHighlight,
    clearClickSelection,
    clearDragSelection,
    clearAllSelections,
    highlightVerses,
    handleVerseClick,
    hideActionMenu,
  };
}
