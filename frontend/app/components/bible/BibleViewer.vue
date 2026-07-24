<template>
  <div
    ref="viewerRef"
    class="bible-viewer"
    :class="[
      `theme-${effectiveTheme}`,
      {
        'verse-joining': settings.verseJoining,
        'hide-highlight-names': !settings.highlightNames
      }
    ]"
    :style="viewerStyle"
    @scroll="handleScroll"
  >
    <!-- 로딩 상태 - 스켈레톤 UI -->
    <BibleViewerSkeleton v-if="isLoading" :verse-count="10" />

    <!-- 성경 본문 -->
    <template v-else>
      <div
        class="bible-content"
        :class="{ 'verse-joining': settings.verseJoining }"
        @click="handleVerseClick"
        v-html="renderedContent"
      ></div>

      <!-- 본문 하단 슬롯 (읽음 표시 버튼 등) -->
      <slot v-if="!hasErrorContent" name="bottom"></slot>
    </template>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useReadingSettingsStore, FONT_FAMILIES, FONT_WEIGHTS } from '~/stores/readingSettings';
import { TIMING } from '~/constants/bible';
import { useSwipe } from '~/composables/useSwipe';
import { useSanitize } from '~/composables/useSanitize';
import BibleViewerSkeleton from '~/components/bible/BibleViewerSkeleton.vue';

interface Highlight {
  id: number;
  start_verse: number;
  end_verse: number;
  color: string;
  memo?: string;
}

export interface SelectionMenuState {
  visible: boolean;
  mode: 'action' | 'copy' | null;
  isHighlighted: boolean;
  isSingleVerse: boolean;
}

export interface SelectionSharePayload {
  text: string;
  startVerse: number;
  endVerse: number;
}

interface Props {
  content: string;
  book: string;
  chapter: number;
  isLoading?: boolean;
  initialScrollPosition?: number;
  highlights?: Highlight[];
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  initialScrollPosition: 0,
  highlights: () => [],
});

const emit = defineEmits<{
  scroll: [position: number];
  'verse-select': [verses: { start: number; end: number; text: string }];
  bookmark: [verses: { start: number; end: number; text: string }];
  highlight: [verses: { start: number; end: number; text: string }];
  'highlight-delete': [highlightId: number];
  copy: [text: string];
  share: [payload: SelectionSharePayload];
  'selection-menu-change': [state: SelectionMenuState];
  'swipe-left': [];
  'swipe-right': [];
}>();

// Store
const settingsStore = useReadingSettingsStore();
const settings = computed(() => settingsStore.settings);
const effectiveTheme = computed(() => settingsStore.effectiveTheme);

// Refs
const viewerRef = ref<HTMLElement | null>(null);

// Swipe navigation
useSwipe(viewerRef, {
  onSwipeLeft: () => emit('swipe-left'),
  onSwipeRight: () => emit('swipe-right'),
}, { threshold: 80, horizontalRatio: 2 });

// ====== 선택 시스템 상태 ======
// 선택 모드: 'click' (절 클릭) | 'drag' (텍스트 드래그) | null
const selectionMode = ref<'click' | 'drag' | null>(null);

const { sanitize } = useSanitize();

// 절 클릭 선택 상태 (복사 메뉴용 데이터)
const showCopyMenu = ref(false);
const clickSelectedStart = ref<number | null>(null);
const clickSelectedEnd = ref<number | null>(null);
const clickSelectedVerses = ref<Array<{ number: number; text: string }>>([]);

// 텍스트 드래그/클릭 선택 상태 (플로팅 액션 메뉴용)
const showActionMenu = ref(false);
const selectedVerses = ref({ start: 0, end: 0 });
const selectedText = ref('');

const emitSelectionMenuChange = () => {
  emit('selection-menu-change', {
    visible: showActionMenu.value || showCopyMenu.value,
    mode: showActionMenu.value ? 'action' : showCopyMenu.value ? 'copy' : null,
    isHighlighted: isSelectedVerseHighlighted.value,
    isSingleVerse: clickSelectedVerses.value.length === 1,
  });
};

// 스타일 계산
const viewerStyle = computed(() => ({
  '--reading-font-family': FONT_FAMILIES[settings.value.fontFamily].css,
  '--reading-font-size': `${settings.value.fontSize}px`,
  '--reading-font-weight': FONT_WEIGHTS[settings.value.fontWeight],
  '--reading-line-height': settings.value.lineHeight,
  '--reading-text-align': settings.value.textAlign,
}));

// 특정 절의 하이라이트 찾기
const getHighlightForVerse = (verseNum: number): Highlight | undefined => {
  return props.highlights.find(
    h => verseNum >= h.start_verse && verseNum <= h.end_verse
  );
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

// 본문 렌더링 (절 번호에 data-verse 속성 추가 + 하이라이트 적용)
const hasErrorContent = computed(() => props.content.includes('class="error-message"'));

const renderedContent = computed(() => {
  if (!props.content) return '';

  // sup 태그에 클릭 가능한 클래스와 data-verse 추가
  let content = props.content.replace(
    /<sup>(\d+)<\/sup>/g,
    '<sup class="verse-num" data-verse="$1">$1</sup>'
  );

  // 기존 절 번호 스타일 개선
  content = content.replace(
    /<sup class="verse-num"/g,
    '<sup class="verse-num clickable"'
  );

  // 하이라이트가 있으면 절에 배경색 적용
  if (props.highlights.length > 0) {
    // .verse 요소에 하이라이트 적용 (verse-number에서 절 번호 추출)
    content = content.replace(
      /<div class="verse"><span class="verse-number">(\d+)<\/span>/g,
      (match, verseNum) => {
        const highlight = getHighlightForVerse(parseInt(verseNum));
        if (highlight) {
          // 배경색을 직접 지정하지 않고 CSS 변수로 전달하여 투명도 조절 가능하게 함
          return `<div class="verse highlighted" data-highlight-id="${highlight.id}" style="--highlight-bg: ${highlight.color}"><span class="verse-number">${verseNum}</span>`;
        }
        return match;
      }
    );
  }

  return sanitize(content);
});

// 스크롤 핸들러 (throttle 적용)
let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
const handleScroll = () => {
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
  scrollTimeout = setTimeout(() => {
    if (viewerRef.value) {
      const { scrollTop, scrollHeight, clientHeight } = viewerRef.value;
      const maxScroll = scrollHeight - clientHeight;
      const position = maxScroll > 0 ? scrollTop / maxScroll : 0;
      emit('scroll', position);
    }
  }, TIMING.SCROLL_THROTTLE);
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
  clearClickSelection();
  clearDragSelection();
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

// 복사 텍스트 생성
const getCopyText = (type: string): string => {
  if (!clickSelectedVerses.value.length) return '';
  const bookName = props.book;
  const chapter = props.chapter;

  if (clickSelectedVerses.value.length === 1) {
    const { number, text } = clickSelectedVerses.value[0];
    if (type === 'includeLocation') {
      return `[${bookName}${chapter}:${number}] ${text}`;
    } else if (type === 'numOnly') {
      return `${number} ${text}`;
    } else if (type === 'textOnly') {
      return text;
    }
  } else {
    const start = clickSelectedVerses.value[0].number;
    const end = clickSelectedVerses.value[clickSelectedVerses.value.length - 1].number;
    const versesTexts = clickSelectedVerses.value.map(v => `${v.number} ${v.text}`);
    if (type === 'includeLocationRange') {
      return `[${bookName}${chapter}:${start}-${end}]\n${versesTexts.join('\n')}`;
    } else if (type === 'excludeLocationRange') {
      return versesTexts.join('\n');
    }
  }
  return '';
};

// 절 클릭 복사 핸들러
const handleClickCopy = async (type: string) => {
  const text = getCopyText(type);
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    emit('copy', text);
  } catch {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    emit('copy', text);
  }

  clearClickSelection();
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
  const txt = textEl.textContent?.trim() || '';

  // 단일 절 선택 상태에서 같은 절을 다시 클릭하면 해제
  if (
    clickSelectedStart.value !== null &&
    clickSelectedEnd.value === null &&
    clickSelectedStart.value === num &&
    clickSelectedVerses.value.length === 1
  ) {
    hideActionMenu();
    setTimeout(() => {
      clearClickSelection();
    }, TIMING.VERSE_RESELECT_DELAY);
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
          const verseText = tEl.textContent?.trim() || '';
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
    // 재선택: 메뉴를 닫고 새로 열기
    clearClickSelection();
    hideActionMenu();
    setTimeout(() => {
      clickSelectedStart.value = num;
      clickSelectedVerses.value = [{ number: num, text: txt }];
      highlightVerses(num, num);
      
      // 액션 메뉴용 데이터 설정
      selectedVerses.value = { start: num, end: num };
      selectedText.value = txt;
      showActionMenu.value = true;
      emitSelectionMenuChange();
    }, TIMING.VERSE_RESELECT_DELAY);
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
  if (!isInBibleContent) {
    return;
  }

  // 클릭 선택 해제 후 드래그 선택 시작
  clearClickSelection();
  selectionMode.value = 'drag';

  // 선택된 텍스트에서 절 번호 추출
  const verses = extractVerseNumbers(range);

  if (verses.start > 0) {
    selectedVerses.value = verses;
    selectedText.value = text;
    showActionMenu.value = true;
    emitSelectionMenuChange();
  }
};

// 절 번호 추출
const extractVerseNumbers = (range: Range): { start: number; end: number } => {
  const container = range.commonAncestorContainer;
  const parent = container.parentElement?.closest('.bible-content') || viewerRef.value;

  if (!parent) return { start: 0, end: 0 };

  // 선택 범위 내의 절 번호 찾기 (.verse-number 클래스 사용)
  const allVerseNums = parent.querySelectorAll('.verse-number');
  let start = 0;
  let end = 0;

  allVerseNums.forEach((el) => {
    // 절 번호는 텍스트 콘텐츠에서 추출
    const verseNum = parseInt(el.textContent?.trim() || '0', 10);
    if (verseNum === 0) return;

    // 선택 범위와 비교
    try {
      const position = range.comparePoint(el, 0);
      if (position <= 0 && start === 0) {
        start = verseNum;
      }
      if (position <= 0) {
        end = verseNum;
      }
    } catch {
      // comparePoint가 실패하는 경우 (다른 문서 등) 무시
    }
  });

  // 시작 절이 없으면 첫 번째 절로
  if (start === 0 && end > 0) start = 1;
  if (end === 0 && start > 0) end = start;

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

// 액션 핸들러
const handleHighlight = () => {
  emit('highlight', {
    start: selectedVerses.value.start,
    end: selectedVerses.value.end,
    text: selectedText.value,
  });
  hideActionMenu();
  clearSelection();
};

// 하이라이트 추가 또는 제거 핸들러
const handleHighlightOrRemove = () => {
  const existingHighlight = getSelectedVerseHighlight();
  if (existingHighlight) {
    // 기존 하이라이트가 있으면 삭제 이벤트 발생
    emit('highlight-delete', existingHighlight.id);
    hideActionMenu();
    clearAllSelections();
  } else {
    // 하이라이트 추가
    handleHighlight();
  }
};

const handleCopy = async () => {
  // 액션 메뉴를 숨기고 복사 메뉴 표시
  hideActionMenu();
  
  // 클릭 선택 모드에서는 복사 메뉴 표시
  if (selectionMode.value === 'click') {
    showCopyMenu.value = true;
    emitSelectionMenuChange();
    return;
  }
  
  // 드래그 선택 모드에서는 clickSelectedVerses 데이터 설정 후 복사 메뉴 표시
  if (selectionMode.value === 'drag') {
    // 드래그 선택 데이터를 클릭 선택 형식으로 변환
    clickSelectedStart.value = selectedVerses.value.start;
    clickSelectedEnd.value = selectedVerses.value.start === selectedVerses.value.end 
      ? null 
      : selectedVerses.value.end;
    
    // 단일 절 선택
    if (selectedVerses.value.start === selectedVerses.value.end) {
      clickSelectedVerses.value = [{
        number: selectedVerses.value.start,
        text: selectedText.value
      }];
    } else {
      // 범위 선택 - viewerRef에서 각 절 텍스트 추출
      const versesArray: Array<{ number: number; text: string }> = [];
      if (viewerRef.value) {
        viewerRef.value.querySelectorAll('.verse').forEach((el) => {
          const nEl = el.querySelector('.verse-number');
          const tEl = el.querySelector('.verse-text');
          if (!nEl || !tEl) return;
          const n = parseInt(nEl.textContent?.trim() || '0', 10);
          if (n >= selectedVerses.value.start && n <= selectedVerses.value.end) {
            versesArray.push({
              number: n,
              text: tEl.textContent?.trim() || ''
            });
          }
        });
      }
      clickSelectedVerses.value = versesArray;
    }
    
    selectionMode.value = 'click'; // 복사 메뉴는 클릭 모드로 처리
    showCopyMenu.value = true;
    emitSelectionMenuChange();
  }
};

const handleShare = () => {
  const startVerse = selectedVerses.value.start;
  const endVerse = selectedVerses.value.end;
  if (startVerse <= 0 || endVerse < startVerse) return;

  emit('share', {
    text: selectedText.value,
    startVerse,
    endVerse,
  });
  hideActionMenu();
  clearSelection();
};

const clearSelection = () => {
  clearDragSelection();
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

  clearAllSelections();
  selectedVerses.value = { start: startVerse, end: endVerse };
  selectionMode.value = null;
  highlightVerses(startVerse, endVerse);
  scrollToVerse(startVerse);
  nextTick(() => {
    focusSearchTermInVerse(startVerse, searchTerm);
  });
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

// 라이프사이클
onMounted(() => {
  document.addEventListener('click', handleDocumentClick);
  // 텍스트 드래그 선택 감지 (mouseup)
  document.addEventListener('mouseup', handleTextSelection);
  // 터치 디바이스 지원
  document.addEventListener('touchend', handleTextSelection);

  // 초기 스크롤 위치 복원 (컨텐츠 로드 후)
  nextTick(() => {
    restoreScrollPosition();
  });
});

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick);
  document.removeEventListener('mouseup', handleTextSelection);
  document.removeEventListener('touchend', handleTextSelection);
  if (scrollTimeout) {
    clearTimeout(scrollTimeout);
  }
  // 검색 강조 타이머 정리
  if (searchHighlightTimeout) {
    clearTimeout(searchHighlightTimeout);
  }
  // 선택 상태 정리
  clearAllSelections();
});

// 컨텐츠 변경 시 스크롤 위치 복원 및 선택 상태 초기화
watch(() => props.content, () => {
  // 컨텐츠 변경 시 모든 선택 상태 초기화
  clearAllSelections();
  nextTick(() => {
    restoreScrollPosition();
  });
});

// expose
defineExpose({
  scrollToVerse,
  restoreScrollPosition,
  focusVerseRange,
  handleHighlightOrRemove,
  handleCopy,
  handleShare,
  clearAllSelections,
  handleClickCopy,
  clearClickSelection,
});
</script>

<style scoped>
.bible-viewer {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  padding-bottom: 84px;
  font-family: var(--reading-font-family);
  font-size: var(--reading-font-size);
  font-weight: var(--reading-font-weight);
  line-height: var(--reading-line-height);
  text-align: var(--reading-text-align);
  transition: background-color 0.3s, color 0.3s;
}

@media (max-width: 768px) {
  .bible-viewer {
    padding-left: 5px;
    padding-right: 5px;
  }
}

/* 테마 */
.theme-light {
  background: var(--color-bg-primary, #f9fafb);
  color: var(--text-primary, #1f2937);
}

/* 읽기 전용 다크 모드: 앱 테마와 독립적인 고정 본문 색상 (눈 피로 최소화) */
.theme-dark {
  background: #1a1a1a;
  color: #e5e5e5;
}

/* 성경 본문 */
.bible-content {
  word-break: keep-all;
  -webkit-user-select: text;
  user-select: text;
  font-family: var(--reading-font-family, "RIDIBatang", serif);
  font-size: var(--reading-font-size, 16px);
  font-weight: var(--reading-font-weight, 400);
  line-height: var(--reading-line-height, 1.8);
  text-align: var(--reading-text-align, left);
}

/* 절 스타일 (reading.vue 동일) */
.bible-content :deep(.verse) {
  display: flex;
  align-items: flex-start;
  font-family: var(--reading-font-family, "RIDIBatang", serif);
  letter-spacing: -0.02em;
  font-weight: var(--reading-font-weight, normal);
  transition: background-color 0.3s ease-in-out;
  padding: 0.25rem 0.35rem;
  border-radius: 8px;
}

/* verse-group은 block으로 (내부에 여러 verse-line 포함) */
.bible-content :deep(.verse.verse-group) {
  display: block;
  padding: 0;
}

/* 절 번호 스타일 (reading.vue 동일) */
.bible-content :deep(.verse-number) {
  color: var(--verse-number-color, #999999);
  font-weight: 500;
  margin-right: 0.3rem;
  min-width: 0.8em;
  flex-shrink: 0;
  text-align: right;
  font-size: 0.75em;
  font-family: "Pretendard", sans-serif;
  position: relative;
  line-height: 2;
}

/* 절 본문 스타일 */
.bible-content :deep(.verse-text) {
  flex: 1;
}

/* 하이라이트된 절 스타일 */
.bible-content :deep(.verse.highlighted) {
  border-radius: 6px;
  /* margin 제거 - 레이아웃 시프트 방지 */
  /* margin: 0.125rem 0; */ 
  position: relative;
  z-index: 1; /* 가상 요소 배경을 뒤로 보내기 위함 */
  /* 배경색은 ::after로 처리하므로 제거 */
  background-color: transparent !important;
}

/* 하이라이트 배경 (가상 요소) */
.bible-content :deep(.verse.highlighted)::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background-color: var(--highlight-bg);
  border-radius: 6px;
  opacity: 0.5; /* 기본(라이트모드) 투명도 */
}

/* 하이라이트 왼쪽 강조선 (기존 ::before 유지) */
.bible-content :deep(.verse.highlighted)::before {
  content: '';
  position: absolute;
  left: -4px;
  top: 0;
  bottom: 0;
  width: 3px;
  background-color: var(--highlight-bg); /* currentColor 대신 원래 색상 사용 */
  border-radius: 2px;
  opacity: 1;
}



/* 인명/지명 강조 스타일 (reading.vue 동일) */
.bible-content :deep(.bible-name) {
  color: var(--highlight-name-color, #7c5a3c);
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-decoration-color: currentColor;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

.bible-content :deep(.bible-area) {
  color: var(--highlight-place-color, #5a6e54);
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-decoration-color: currentColor;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

/* 인명/지명 강조 비활성화 */
.hide-highlight-names .bible-content :deep(.bible-name),
.hide-highlight-names .bible-content :deep(.bible-area) {
  color: inherit;
}

.bible-content :deep(.verse-num) {
  color: var(--primary-color, #2A1111);
  font-weight: 700;
  font-size: 0.75em;
  margin-right: 0.25em;
  vertical-align: super;
  cursor: pointer;
  transition: color 0.2s;
}

.bible-content :deep(.verse-num:hover) {
  color: var(--primary-dark, #3A1A1A);
}

/* 절 연결 모드 */
.verse-joining .bible-content :deep(p),
.verse-joining .bible-content :deep(.verse-line),
.bible-content.verse-joining :deep(p),
.bible-content.verse-joining :deep(.verse-line) {
  display: inline;
}

.verse-joining .bible-content :deep(br),
.bible-content.verse-joining :deep(br) {
  display: none;
}

/* 절 붙임 모드에서 절 스타일 */
.bible-content.verse-joining :deep(.verse),
.bible-content.verse-joining :deep(.verse-group) {
  display: inline;
  padding: 0;
}

.bible-content.verse-joining :deep(.verse-number) {
  display: inline;
  font-size: 0.65em;
  vertical-align: super;
  margin: 0 0.1em;
  min-width: auto;
  text-align: left;
  line-height: 1;
}

.bible-content.verse-joining :deep(.verse-text) {
  display: inline;
}

.bible-content.verse-joining :deep(.verse-text)::after {
  content: " ";
}

/* 섹션 타이틀에서 단락 분리 */
.bible-content.verse-joining :deep(.section-title),
.bible-content.verse-joining :deep(h3),
.bible-content.verse-joining :deep(h4) {
  display: block;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}

/* 섹션 제목 (reading.vue 동일) */
.bible-content :deep(.section-title),
.bible-content :deep(h3),
.bible-content :deep(h4) {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--section-title-color, #4a5d4a);
  margin: 2rem 0 0.25rem;
  text-align: center;
}

.bible-content :deep(.section-title:first-child),
.bible-content :deep(h3:first-child),
.bible-content :deep(h4:first-child) {
  margin-top: 0;
}

/* 섹션 제목 내 참조 */
.bible-content :deep(.section-title .reference),
.bible-content :deep(h3 .reference),
.bible-content :deep(h4 .reference) {
  font-size: 0.75em;
  font-weight: 500;
  color: var(--text-secondary, #6b7280);
  margin-left: 0.25rem;
}

/* 에러 메시지 */
.bible-content :deep(.error-message) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-secondary, #6b7280);
  font-family: "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.bible-content :deep(.error-message h3) {
  margin: 1rem 0 0.5rem;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary, #1f2937);
}

.bible-content :deep(.error-message p) {
  margin-bottom: 1rem;
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 500;
}

.bible-content :deep(.external-link) {
  padding: 0.75rem 1.5rem;
  background: var(--primary-color, #2A1111);
  color: white;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.2s;
}

.bible-content :deep(.external-link:hover) {
  background: var(--primary-dark, #3A1A1A);
}

/* iOS 안전영역 */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .bible-viewer {
    padding-bottom: calc(84px + env(safe-area-inset-bottom));
  }
}

/* 다크모드 인명/지명 색상 - themes.css에서 정의된 CSS 변수 사용 */
.theme-dark .bible-content :deep(.bible-name) {
  color: var(--highlight-name-color, #c9a67a);
}

.theme-dark .bible-content :deep(.bible-area) {
  color: var(--highlight-place-color, #9cb094);
}

/* 다크모드 섹션 제목 색상 */
.theme-dark .bible-content :deep(.section-title),
.theme-dark .bible-content :deep(h3),
.theme-dark .bible-content :deep(h4) {
  color: var(--section-title-color-dark, #8ba888);
}

/* 다크모드 절 번호 색상 */
.theme-dark .bible-content :deep(.verse-number) {
  color: var(--verse-number-color-dark, #666666);
}

/* ====== 검색 결과 강조 스타일 ====== */

/* 검색으로 이동한 절 강조 */
.bible-content :deep(.verse.search-highlight) {
  background-color: rgba(251, 191, 36, 0.25) !important;
  animation: search-pulse 0.6s ease-out;
  border-radius: 8px;
  box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.4);
}

.theme-dark .bible-content :deep(.verse.search-highlight) {
  background-color: rgba(251, 191, 36, 0.2) !important;
  box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.3);
}

.bible-content :deep(.focused-search-term) {
  border-radius: 4px;
  background: rgba(250, 204, 21, 0.72);
  color: inherit;
  padding: 0 2px;
  box-shadow: 0 0 0 2px rgba(202, 138, 4, 0.32);
}

.theme-dark .bible-content :deep(.focused-search-term) {
  background: rgba(250, 204, 21, 0.58);
  box-shadow: 0 0 0 2px rgba(250, 204, 21, 0.28);
}

@keyframes search-pulse {
  0% {
    background-color: rgba(251, 191, 36, 0.5);
    transform: scale(1.02);
  }
  100% {
    background-color: rgba(251, 191, 36, 0.25);
    transform: scale(1);
  }
}

/* ====== 절 클릭 선택 스타일 ====== */

/* 선택된 절 하이라이트 */
.bible-content :deep(.verse.selected-verse) {
  background-color: rgba(42, 17, 17, 0.15) !important; /* 앱 primary 그린 */
  transition: background-color 0.2s ease;
  border-radius: 8px;
  position: relative;
  z-index: 1;
}

.theme-dark .bible-content :deep(.verse.selected-verse) {
  background-color: rgba(42, 17, 17, 0.2) !important; /* 다크모드 그린 */
}

/* 다중 절 선택: 연속 블록으로 표시 */
.bible-content :deep(.verse.selected-verse.selected-first) {
  border-radius: 8px 8px 0 0 !important;
  margin-bottom: 0 !important;
}

.bible-content :deep(.verse.selected-verse.selected-middle) {
  border-radius: 0 !important;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
}

.bible-content :deep(.verse.selected-verse.selected-last) {
  border-radius: 0 0 8px 8px !important;
  margin-top: 0 !important;
}

/* 하이라이트된 절이 선택되었을 때 - 외곽선으로 선택 표시 (배경색 유지) */
.bible-content :deep(.verse.highlighted.selected-verse) {
  box-shadow: 0 0 0 2px var(--color-accent-primary, #2A1111);
}

/* 다크모드에서 하이라이트된 절이 선택되었을 때 */
.theme-dark .bible-content :deep(.verse.highlighted.selected-verse),
:root[data-theme="dark"] .bible-content :deep(.verse.highlighted.selected-verse) {
  box-shadow: 0 0 0 2px var(--color-accent-primary, #2A1111);
}

/* 절 hover 효과 */
.bible-content :deep(.verse:hover) {
  background-color: rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-radius: 8px;
}

.theme-dark .bible-content :deep(.verse:hover) {
  background-color: rgba(255, 255, 255, 0.06);
}

/* 터치 디바이스에서는 hover 배경색 비활성화 */
@media (hover: none) and (pointer: coarse) {
  .bible-content :deep(.verse:hover):not(.selected-verse) {
    background-color: inherit !important;
  }
}

@supports (-webkit-touch-callout: none) {
  @media (hover: none) {
    .bible-content :deep(.verse:hover):not(.selected-verse) {
      background-color: inherit !important;
    }
  }
}

/* ====== 새한글(KNT) 전용 스타일 ====== */

/* 구절 그룹 (시적 구조) */
.bible-content :deep(.verse-group) {
  margin: 0.25rem 0;
}

.bible-content :deep(.verse-line) {
  font-family: var(--reading-font-family, "RIDIBatang", serif);
  display: flex;
  align-items: flex-start;
  line-height: var(--reading-line-height, 1.8);
  font-weight: var(--reading-font-weight, normal);
  letter-spacing: -0.02em;
  transition: background-color 0.3s ease-in-out;
  padding: 0.25rem 0.35rem;
  border-radius: 8px;
}

/* verse-group 호버 시 전체 그룹에 효과 적용 (한 절이므로 덩어리로 처리) */
.bible-content :deep(.verse.verse-group:hover) {
  background-color: rgba(0, 0, 0, 0.04);
  cursor: pointer;
  border-radius: 8px;
}

.theme-dark .bible-content :deep(.verse.verse-group:hover) {
  background-color: rgba(255, 255, 255, 0.06);
}

/* 후속 줄 (continuation) */
.bible-content :deep(.verse-line.continuation) {
  padding-left: 1.3em;
}

/* 시적 구조 들여쓰기 */
.bible-content :deep(.verse-line.q1) {
  padding-left: 1.5em;
}

.bible-content :deep(.verse-line.continuation.q1) {
  padding-left: calc(1.3em + 1.5em);
}

.bible-content :deep(.verse-line.q2) {
  padding-left: 2.5em;
}

.bible-content :deep(.verse-line.continuation.q2) {
  padding-left: calc(1.3em + 2.5em);
}

.bible-content :deep(.verse-line.q3) {
  padding-left: 3.5em;
}

.bible-content :deep(.verse-line.continuation.q3) {
  padding-left: calc(1.3em + 3.5em);
}

.bible-content :deep(.verse-line.q4) {
  padding-left: 4.5em;
}

.bible-content :deep(.verse-line.continuation.q4) {
  padding-left: calc(1.3em + 4.5em);
}

.bible-content :deep(.verse-line.m) {
  padding-left: 0.5em;
}

.bible-content :deep(.verse-line.continuation.m) {
  padding-left: calc(1.3em + 0.5em);
}

/* 부제목 */
.bible-content :deep(.sub-title) {
  font-size: 0.875rem;
  color: var(--section-title-color, #4a5d4a);
  font-style: italic;
  margin: 1rem 0 0.5rem;
  text-align: center;
}

.theme-dark .bible-content :deep(.sub-title) {
  color: var(--section-title-color-dark, #8ba888);
}

/* 설명/주석 (시편 머리말, 음악 지시어 등) */
.bible-content :deep(.description) {
  font-style: italic;
  font-size: 0.9em;
  color: var(--text-secondary, #6b7280);
  margin: 0.5rem 0 1rem;
  padding-left: 0.75rem;
  border-left: 2px solid var(--color-border, #e5e7eb);
  line-height: 1.6;
}

.theme-dark .bible-content :deep(.description) {
  color: var(--text-secondary-dark, #9ca3af);
  border-left-color: var(--color-border-dark, #404040);
}

/* 교차 참조 */
.bible-content :deep(.cross-ref) {
  font-size: 0.85em;
  color: var(--text-secondary, #6b7280);
  margin: 0.25rem 0 0.75rem;
  padding-left: 0.5rem;
}

.theme-dark .bible-content :deep(.cross-ref) {
  color: var(--text-secondary-dark, #9ca3af);
}

/* 각주 마커 */
.bible-content :deep(.footnote-marker) {
  color: var(--primary-color, #2A1111);
  cursor: help;
  font-size: 0.75em;
  vertical-align: super;
  margin: 0 1px;
  font-weight: 500;
  position: relative;
}

.bible-content :deep(.footnote-marker:hover)::after,
.bible-content :deep(.footnote-marker:focus)::after {
  content: attr(data-footnote);
  position: absolute;
  left: 50%;
  bottom: 100%;
  transform: translateX(-50%);
  background: var(--color-bg-inverse, #1f2937);
  color: var(--text-inverse, white);
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-weight: normal;
  max-width: 280px;
  width: max-content;
  z-index: 100;
  white-space: normal;
  line-height: 1.5;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  margin-bottom: 4px;
}

.bible-content :deep(.footnote-marker:hover)::before,
.bible-content :deep(.footnote-marker:focus)::before {
  content: '';
  position: absolute;
  left: 50%;
  bottom: 100%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--color-bg-inverse, #1f2937);
  margin-bottom: -8px;
  z-index: 101;
}

/* 단락 스타일 */
.bible-content :deep(.paragraph) {
  margin: 0.5rem 0;
  line-height: 1.8;
}

/* 시적 구조 클래스 (verse, paragraph 공용) */
.bible-content :deep(.verse.q1),
.bible-content :deep(.paragraph.q1) {
  padding-left: 40px !important;
  text-indent: 0 !important;
  white-space: pre-wrap !important;
}

.bible-content :deep(.verse.q2),
.bible-content :deep(.paragraph.q2) {
  padding-left: 60px !important;
  text-indent: 0 !important;
  white-space: pre-wrap !important;
}

.bible-content :deep(.verse.q3),
.bible-content :deep(.paragraph.q3) {
  padding-left: 80px !important;
  text-indent: 0 !important;
  white-space: pre-wrap !important;
}

.bible-content :deep(.verse.q4),
.bible-content :deep(.paragraph.q4) {
  padding-left: 100px !important;
  text-indent: 0 !important;
  white-space: pre-wrap !important;
}

/* m - margin continuation */
.bible-content :deep(.verse.m),
.bible-content :deep(.paragraph.m) {
  padding-left: 1.5rem !important;
  margin-top: 0;
}

/* pi1, pi2 - 들여쓰기 단락 */
.bible-content :deep(.verse.pi1),
.bible-content :deep(.paragraph.pi1) {
  padding-left: 2rem !important;
}

.bible-content :deep(.verse.pi2),
.bible-content :deep(.paragraph.pi2) {
  padding-left: 4rem !important;
}

/* pc - 가운데 정렬 */
.bible-content :deep(.verse.pc),
.bible-content :deep(.paragraph.pc) {
  text-align: center;
}

/* pm, pmo, pmc - 오른쪽 정렬 */
.bible-content :deep(.verse.pm),
.bible-content :deep(.paragraph.pm),
.bible-content :deep(.verse.pmo),
.bible-content :deep(.paragraph.pmo),
.bible-content :deep(.verse.pmc),
.bible-content :deep(.paragraph.pmc) {
  text-align: right;
  margin-right: 1rem;
}

/* nb - no break */
.bible-content :deep(.verse.nb),
.bible-content :deep(.paragraph.nb) {
  display: inline;
  margin: 0;
}

/* 절 붙임 모드에서 verse-group/verse-line 처리 */
.bible-content.verse-joining :deep(.verse-group) {
  display: inline;
}

.bible-content.verse-joining :deep(.verse-line) {
  display: inline;
  padding: 0;
}

.bible-content.verse-joining :deep(.verse-line.continuation) {
  padding-left: 0;
}
</style>

<style>
/* 다크모드 하이라이트 설정 */
[data-theme="dark"] .bible-content .verse.highlighted::after {
  opacity: 0.3; /* 다크모드에서는 배경을 더 투명하게 */
}

/* 다크모드에서 텍스트 색상은 기본값(밝은색) 유지 */
[data-theme="dark"] .bible-content .verse.highlighted,
[data-theme="dark"] .bible-content .verse.highlighted .verse-number,
[data-theme="dark"] .bible-content .verse.highlighted .bible-name,
[data-theme="dark"] .bible-content .verse.highlighted .bible-area {
  color: inherit !important;
}

/* 하이라이트된 절이 선택되었을 때 - 외곽선으로 선택 표시 (배경색 유지) */
.bible-content .verse.highlighted.selected-verse {
  box-shadow: 0 0 0 2px var(--color-accent-primary, #2A1111);
}

/* 다크모드에서 하이라이트된 절이 선택되었을 때 - 초록색 외곽선 */
.theme-dark .bible-content .verse.highlighted.selected-verse,
:root[data-theme="dark"] .bible-content .verse.highlighted.selected-verse {
  box-shadow: 0 0 0 2px var(--color-accent-primary, #2A1111) !important;
  filter: none !important; /* 기존 필터 제거 */
}
</style>
