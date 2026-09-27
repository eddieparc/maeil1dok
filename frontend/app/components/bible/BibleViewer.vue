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
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useReadingSettingsStore, FONT_FAMILIES, FONT_WEIGHTS } from '~/stores/readingSettings';
import { useSwipe } from '~/composables/useSwipe';
import BibleViewerSkeleton from '~/components/bible/BibleViewerSkeleton.vue';
import { useRenderedContent } from '~/composables/bible-viewer/useRenderedContent';
import { useVerseSelection } from '~/composables/bible-viewer/useVerseSelection';
import { useVerseActions } from '~/composables/bible-viewer/useVerseActions';
import { useViewerScroll } from '~/composables/bible-viewer/useViewerScroll';
import type {
  Highlight,
  VerseSelectionPayload,
  SelectionHighlightPayload,
  SelectionMenuState,
  SelectionSharePayload,
  ViewerEmit,
} from '~/composables/bible-viewer/types';

// 기존 호출부(BibleReaderView.vue, pages/bible/index.vue)가 이 파일에서 타입을 가져간다.
export type {
  VerseSelectionPayload,
  SelectionHighlightPayload,
  SelectionMenuState,
  SelectionSharePayload,
} from '~/composables/bible-viewer/types';

// 로컬 선언을 유지한다 — 테스트 하네스의 compileScript는 fs 없이 실행되어
// import된 타입을 defineProps에 쓸 수 없다. ResolvedViewerProps(types.ts)와의
// 일치는 props를 컴포저블에 넘기는 호출부가 타입체크한다.
interface Props {
  content: string;
  book: string;
  chapter: number;
  version?: string;
  isLoading?: boolean;
  initialScrollPosition?: number;
  highlights?: Highlight[];
  // 역본 교체 애니메이션 단계. exit는 기존 셀이 목적지 방향으로 빠지고,
  // enter는 새 DOM이 마운트될 때 같은 방향으로 들어온다.

}

const props = withDefaults(defineProps<Props>(), {
  version: '',
  isLoading: false,
  initialScrollPosition: 0,
  highlights: () => [],
});

const emit: ViewerEmit = defineEmits<{
  scroll: [position: number];
  'scroll-pixels': [position: number];
  'verse-select': [verses: VerseSelectionPayload];
  'highlight-save': [payload: SelectionHighlightPayload];
  bookmark: [verses: { start: number; end: number; text: string }];
  highlight: [verses: { start: number; end: number; text: string }];
  'highlight-delete': [highlightId: number];
  copy: [text: string];
  'copy-error': [error: unknown];
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

// 본문 렌더 파이프라인 — renderedContent는 props.content의 순수 computed로 유지한다.
// 부모가 exit 애니메이션 동안 content를 고정하면 v-html이 재생성되지 않는다.
const { renderedContent, hasErrorContent } = useRenderedContent(props);

// 절 클릭/드래그 선택 상태 머신 (문서 리스너는 컴포저블이 등록·해제한다)
const selection = useVerseSelection(viewerRef, props, emit);

// 복사 텍스트 생성 — typecheck-baseline.json이 이 본문의 인덱싱 오류를
// 파일 경로별로 고정하므로 이 함수는 컴포넌트에 남긴다 (이동 시 래칫 실패).
const getCopyText = (type: string): string => {
  if (!selection.clickSelectedVerses.value.length) return '';
  const bookName = props.book;
  const chapter = props.chapter;

  if (selection.clickSelectedVerses.value.length === 1) {
    const { number, text } = selection.clickSelectedVerses.value[0];
    if (type === 'includeLocation') {
      return `[${bookName}${chapter}:${number}] ${text}`;
    } else if (type === 'numOnly') {
      return `${number} ${text}`;
    } else if (type === 'textOnly') {
      return text;
    }
  } else {
    const start = selection.clickSelectedVerses.value[0].number;
    const end = selection.clickSelectedVerses.value[selection.clickSelectedVerses.value.length - 1].number;
    const versesTexts = selection.clickSelectedVerses.value.map(v => `${v.number} ${v.text}`);
    if (type === 'includeLocationRange') {
      return `[${bookName}${chapter}:${start}-${end}]\n${versesTexts.join('\n')}`;
    } else if (type === 'excludeLocationRange') {
      return versesTexts.join('\n');
    }
  }
  return '';
};

// 선택 액션(복사/공유/하이라이트)과 스크롤/검색 포커스
const actions = useVerseActions(viewerRef, props, emit, selection, getCopyText);
const scroll = useViewerScroll(viewerRef, props, emit, selection);

// 스타일 계산
const viewerStyle = computed(() => ({
  '--reading-font-family': FONT_FAMILIES[settings.value.fontFamily].css,
  '--reading-font-size': `${settings.value.fontSize}px`,
  '--reading-font-weight': FONT_WEIGHTS[settings.value.fontWeight],
  '--reading-line-height': settings.value.lineHeight,
  '--reading-text-align': settings.value.textAlign,
}));

const { handleVerseClick, clearAllSelections, clearClickSelection } = selection;
const { handleScroll, restoreScrollPosition, scrollToTop, scrollToVerse, focusVerseRange } = scroll;
const { handleHighlightOrRemove, handleHighlightColor, handleCopy, handleShare, handleClickCopy } = actions;
const clearSelection = clearAllSelections;

// 라이프사이클 — 초기 스크롤 위치 복원 (컨텐츠 로드 후)
onMounted(() => {
  nextTick(() => {
    restoreScrollPosition();
  });
});

// 컨텐츠 변경 시 스크롤 위치 복원 및 선택 상태 초기화
watch(() => [props.content, props.book, props.chapter, props.version], () => {
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
  scrollToTop,
  focusVerseRange,
  handleHighlightOrRemove,
  handleHighlightColor,
  clearSelection,
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
  min-height: 0;
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

/* 역본 비교: 절 단위 병합 행. 하나의 DOM/스크롤에서 좌우가 붙는다. */
.bible-content :deep(.verse-pair) {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 1.5rem;
}

.bible-content :deep(.pair-secondary) {
  border-left: 1px solid var(--color-border-primary, #e5e7eb);
  padding-left: 1.5rem;
  margin-left: -1.5rem;
}

.bible-content :deep(.pair-secondary.rtl-text) {
  direction: rtl;
  text-align: right;
}

/* 좁은 세로 화면에서는 상하로 쌓고 역본을 위쪽 구분선으로 나눈다.
   (가로 방향은 비교 모드가 두 열을 유지한다) */
@media (max-width: 767px) and (orientation: portrait) {
  .bible-content :deep(.verse-pair) {
    grid-template-columns: 1fr;
  }
  .bible-content :deep(.pair-secondary) {
    border-left: none;
    padding-left: 0;
    margin-left: 0;
    border-top: 1px dashed var(--color-border-primary, #e5e7eb);
    margin-top: 0.25rem;
    padding-top: 0.25rem;
  }
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
