<template>
  <div class="bible-reader-view">
    <!-- 헤더 -->
    <header class="bible-header">
      <div class="header-left-actions">
        <button
          class="bookmark-toggle-button"
          :class="{ 'is-bookmarked': isBookmarked }"
          @click="$emit('bookmark-toggle')"
          :title="isBookmarked ? '북마크 삭제' : '북마크 추가'"
          :aria-label="isBookmarked ? '북마크 삭제' : '북마크 추가'"
        >
          <BookmarkFilledIcon v-if="isBookmarked" :size="20" />
          <BookmarkOutlineIcon v-else :size="20" />
        </button>
      </div>

      <!-- 가운데 현재 위치 -->
      <div class="book-selector-group">
        <button class="book-selector-trigger" @click="$emit('open-book-selector')">
          <span class="book-chapter-text book-name-full">{{ currentBookName }} {{ currentChapter }}{{ chapterSuffix }}</span>
          <span class="book-chapter-text book-name-short">{{ shortBookName }} {{ currentChapter }}{{ chapterSuffix }}</span>
        </button>
      </div>

      <div class="header-actions">
        <BibleSearchButton />
        <button
          v-if="isTongdokMode && tongdokAudioLink"
          class="header-icon-action"
          type="button"
          @click="$emit('audio-link-click', tongdokAudioLink)"
          title="오디오 플레이어"
          aria-label="오디오 플레이어"
        >
          <HeadphonesIcon :size="18" />
        </button>
        <a
          v-if="isTongdokMode && tongdokGuideLink"
          :href="tongdokGuideLink"
          target="_blank"
          rel="noopener noreferrer"
          class="header-icon-action"
          title="가이드"
          aria-label="가이드"
        >
          <BookOpenIcon :size="18" />
        </a>
        <BibleToolPopover
          :note-count="noteCount"
          :show-bookmark-toggle="false"
          :is-bookmarked="isBookmarked"
          :audio-link="null"
          :guide-link="null"
          @note-click="$emit('note-click')"
          @open-settings="$emit('open-settings')"
          @reading-plan-click="$emit('reading-plan-click')"
          @bookmark-toggle="$emit('bookmark-toggle')"
          @audio-link-click="$emit('audio-link-click', $event)"
          @audio-external-click="$emit('audio-external-click', $event)"
        />
        <!-- 통독모드 버튼 (로그인 사용자, 비통독 모드일 때) -->
        <button
          v-if="isAuthenticated && !isTongdokMode"
          class="tongdok-mode-btn"
          @click="$emit('today-tongdok')"
          title="통독모드"
        >
          <CalendarCheckIcon :size="14" />
          <span>통독모드</span>
        </button>
      </div>
    </header>

    <!-- 성경 본문 뷰어 -->
    <BibleViewer
      ref="bibleViewerRef"
      :content="content"
      :book="currentBookName"
      :chapter="currentChapter"
      :is-loading="isLoading"
      :initial-scroll-position="scrollPosition"
      :highlights="highlights"
      @scroll="$emit('scroll', $event)"
      @bookmark="$emit('bookmark', $event)"
      @highlight="$emit('highlight', $event)"
      @highlight-delete="$emit('highlight-delete', $event)"
      @copy="$emit('copy', $event)"
      @share="$emit('share', $event)"
      @selection-menu-change="selectionMenuState = $event"
      @swipe-left="handleSwipeLeft"
      @swipe-right="handleSwipeRight"
    >
      <!-- 본문 하단: 읽음 표시 영역 -->
      <template #bottom>
        <!-- 통독 모드일 때 (하단 네비게이션 체크박스로 대체되어 숨김) -->
        <div v-if="false && isTongdokMode && !isLoading" class="content-bottom-action">
          <button
            class="tongdok-complete-btn-inline"
            :disabled="isCompleting"
            @click="$emit('tongdok-complete-click')"
          >
            <CheckCircleOutlineIcon />
            <span>통독 완료</span>
          </button>
        </div>

        <!-- 본문 하단 액션 영역: 이전 장 / 완료 / 다음 장 (플랫, 한 줄, 가운데 정렬) -->
        <div v-if="!isLoading" class="content-bottom-action">
          <div class="chapter-action-row">
            <button
              class="flat-action-btn"
              type="button"
              :disabled="!hasPrevChapter"
              aria-label="이전 장"
              @click="$emit('prev-chapter')"
            >
              <ChevronLeftIcon :size="16" />
              <span>이전 장</span>
            </button>

            <button
              v-if="!isTongdokMode"
              class="flat-action-btn complete"
              :class="{ 'is-read': isCurrentChapterRead }"
              type="button"
              :disabled="isMarkingRead"
              @click="$emit('mark-as-read')"
            >
              <CheckCircleIcon v-if="isCurrentChapterRead" :size="16" />
              <CheckCircleOutlineIcon v-else :size="16" />
              <span>완료</span>
            </button>

            <button
              class="flat-action-btn"
              type="button"
              :disabled="!hasNextChapter"
              aria-label="다음 장"
              @click="$emit('next-chapter')"
            >
              <span>다음 장</span>
              <ChevronRightIcon :size="16" />
            </button>
          </div>

          <!-- 진도 표시 -->
          <ClientOnly>
            <div v-if="!isTongdokMode && isAuthenticated && bookProgress.total > 0" class="progress-info-inline">
              <span class="progress-label">{{ currentBookName }} 읽기 진도</span>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: `${bookProgress.percentage}%` }"></div>
              </div>
              <span class="progress-text">{{ bookProgress.read }} / {{ bookProgress.total }}{{ chapterSuffix }} <span class="progress-percentage">({{ bookProgress.percentage }}%)</span></span>
            </div>
          </ClientOnly>
        </div>

        <!-- 본문 하단 이전장/다음장 이동 버튼 -->
        <div v-if="!isLoading" class="chapter-nav-inline">
          <button
            class="chapter-nav-btn prev"
            type="button"
            :disabled="!hasPrevChapter"
            aria-label="이전 장"
            @click="$emit('prev-chapter')"
          >
            <ChevronLeftIcon :size="18" />
            <span>이전 장</span>
          </button>
          <button
            class="chapter-nav-btn next"
            type="button"
            :disabled="!hasNextChapter"
            aria-label="다음 장"
            @click="$emit('next-chapter')"
          >
            <span>다음 장</span>
            <ChevronRightIcon :size="18" />
          </button>
        </div>
      </template>
    </BibleViewer>

    <!-- 하단 플로팅 네비게이션 -->
    <FloatingBottomBar>
      <template #above>
        <TongdokAudioPlayer
          v-if="isTongdokMode && tongdokAudioLink"
          :audio-link="tongdokAudioLink"
          :is-open="isTongdokAudioPlayerOpen"
          :schedule-range="tongdokScheduleRange"
          :is-completing="isCompleting"
          @update:is-open="$emit('audio-player-open-change', $event)"
          @ended="$emit('audio-ended')"
          @open-external="$emit('audio-external-click', $event)"
        />

        <!-- 통독모드: 진행률 바 영역 -->
        <div v-if="isTongdokMode && tongdokProgress" class="tongdok-progress-area">
          <div class="story-progress-bar">
            <div
              v-for="i in tongdokProgress.total"
              :key="i"
              class="progress-segment"
              :class="{
                'filled': i < tongdokProgress.current,
                'current': i === tongdokProgress.current
              }"
            ></div>
          </div>
          <div class="progress-text-indicator">
            {{ tongdokProgress.current }}/{{ tongdokProgress.total }}
          </div>
          <button
            class="tongdok-complete-status"
            type="button"
            :disabled="isCompleting"
            @click="$emit('tongdok-complete-click')"
            title="통독 완료"
            aria-label="통독 완료"
          >
            <CheckIcon :size="15" :stroke-width="2.25" />
            <span class="tongdok-complete-label">통독 완료</span>
          </button>
          <button
            class="tongdok-exit-bottom-btn"
            type="button"
            @click="$emit('exit-tongdok')"
            title="통독모드 종료"
            aria-label="통독모드 종료"
          >
            <XMarkIcon :size="14" />
          </button>
        </div>

      </template>

      <template #popover>
        <SelectionFloatingControls
          :state="selectionMenuState"
          @highlight-or-remove="handleSelectionHighlightOrRemove"
          @copy="handleSelectionCopy"
          @share="handleSelectionShare"
          @close="handleSelectionClose"
          @copy-format="handleSelectionCopyWithFormat"
          @copy-close="handleSelectionCopyClose"
        />
      </template>

      <template #center>
        <button
          class="nav-button prev"
          :disabled="!hasPrevChapter"
          aria-label="이전 장"
          @click="$emit('prev-chapter')"
        >
          <ChevronLeftIcon />
        </button>

        <button
          class="chapter-info"
          :class="{ 'is-tongdok': isTongdokMode && shortScheduleDate }"
          @click="isTongdokMode && shortScheduleDate ? $emit('reading-plan-click') : $emit('open-book-selector')"
        >
          <template v-if="isTongdokMode && shortScheduleDate">
            <span class="schedule-short-date">{{ shortScheduleDate }}</span>
            <div class="tongdok-completion-group">
              <span class="schedule-range">{{ tongdokScheduleRange }}</span>
            </div>
          </template>
          <template v-else>
            <span class="chapter-info-text">{{ currentBookName }} {{ currentChapter }}{{ chapterSuffix }}</span>
          </template>
        </button>

        <button
          class="nav-button next"
          :disabled="!hasNextChapter"
          aria-label="다음 장"
          @click="$emit('next-chapter')"
        >
          <ChevronRightIcon />
        </button>
      </template>
    </FloatingBottomBar>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { BookOpenIcon, CalendarCheckIcon, HeadphonesIcon } from '@lucide/vue';
import BibleViewer from '~/components/bible/BibleViewer.vue';
import type { SelectionMenuState, SelectionSharePayload } from '~/components/bible/BibleViewer.vue';
import BibleSearchButton from '~/components/bible/BibleSearchButton.vue';
import BibleToolPopover from '~/components/bible/BibleToolPopover.vue';
import SelectionFloatingControls from '~/components/bible/SelectionFloatingControls.vue';
import type { SelectionCopyFormat } from '~/components/bible/SelectionFloatingControls.vue';
import TongdokAudioPlayer from '~/components/bible/TongdokAudioPlayer.vue';
import FloatingBottomBar from '~/components/common/FloatingBottomBar.vue';
import CheckIcon from '~/components/icons/CheckIcon.vue';
import ChevronLeftIcon from '~/components/icons/ChevronLeftIcon.vue';
import ChevronRightIcon from '~/components/icons/ChevronRightIcon.vue';
import ChevronDownIcon from '~/components/icons/ChevronDownIcon.vue';
import CheckCircleIcon from '~/components/icons/CheckCircleIcon.vue';
import CheckCircleOutlineIcon from '~/components/icons/CheckCircleOutlineIcon.vue';
import XMarkIcon from '~/components/icons/XMarkIcon.vue';
import BookmarkFilledIcon from '~/components/icons/BookmarkFilledIcon.vue';
import BookmarkOutlineIcon from '~/components/icons/BookmarkOutlineIcon.vue';

// Highlight 인터페이스
interface Highlight {
  id: number;
  start_verse: number;
  end_verse: number;
  color: string;
  memo?: string;
}

// Props
interface Props {
  // 콘텐츠
  content: string;
  isLoading: boolean;
  scrollPosition?: number;

  // 현재 위치
  currentBookName: string;
  currentChapter: number;
  currentVersionName: string;
  chapterSuffix: string;

  // 네비게이션
  hasPrevChapter: boolean;
  hasNextChapter: boolean;

  // 통독모드
  isTongdokMode: boolean;
  tongdokScheduleRange?: string | null;
  tongdokScheduleDate?: string | null;
  tongdokAudioLink?: string | null;
  tongdokGuideLink?: string | null;
  tongdokProgress?: { current: number; total: number } | null;
  isTongdokAudioPlayerOpen?: boolean;
  isCompleting?: boolean;

  // 읽기모드
  isCurrentChapterRead: boolean;
  isMarkingRead?: boolean;
  bookProgress: { read: number; total: number; percentage: number };

  // 사용자 데이터
  isAuthenticated: boolean;
  isBookmarked: boolean;
  noteCount: number;

  // 하이라이트
  highlights?: Highlight[];
}

const props = withDefaults(defineProps<Props>(), {
  scrollPosition: 0,
  tongdokScheduleRange: null,
  tongdokScheduleDate: null,
  tongdokAudioLink: null,
  tongdokGuideLink: null,
  tongdokProgress: null,
  isTongdokAudioPlayerOpen: false,
  isCompleting: false,
  isMarkingRead: false,
  highlights: () => [],
});

const formatScheduleDate = (dateString: string | null): string => {
  if (!dateString) return '';
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dayOfWeek = days[date.getDay()];
  return `${year}년 ${month}월 ${day}일(${dayOfWeek})`;
};

const formattedScheduleDate = computed(() => formatScheduleDate(props.tongdokScheduleDate));

const shortScheduleDate = computed(() => {
  if (!props.tongdokScheduleDate) return '';
  const date = new Date(props.tongdokScheduleDate);
  if (isNaN(date.getTime())) return '';
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayOfWeek = days[date.getDay()];
  return `${month}/${day}(${dayOfWeek})`;
});

// 책 이름 축약 (좁은 화면용)
const shortBookName = computed(() => {
  const name = props.currentBookName;
  if (!name) return '';
  
  // 축약어 매핑
  const abbreviations: Record<string, string> = {
    '창세기': '창', '출애굽기': '출', '레위기': '레', '민수기': '민', '신명기': '신',
    '여호수아': '수', '사사기': '삿', '룻기': '룻', '사무엘상': '삼상', '사무엘하': '삼하',
    '열왕기상': '왕상', '열왕기하': '왕하', '역대상': '대상', '역대하': '대하',
    '에스라': '스', '느헤미야': '느', '에스더': '에', '욥기': '욥', '시편': '시',
    '잠언': '잠', '전도서': '전', '아가': '아', '이사야': '사', '예레미야': '렘',
    '예레미야애가': '애', '에스겔': '겔', '다니엘': '단', '호세아': '호', '요엘': '욜',
    '아모스': '암', '오바댜': '옵', '요나': '욘', '미가': '미', '나훔': '나',
    '하박국': '합', '스바냐': '습', '학개': '학', '스가랴': '슥', '말라기': '말',
    '마태복음': '마', '마가복음': '막', '누가복음': '눅', '요한복음': '요',
    '사도행전': '행', '로마서': '롬', '고린도전서': '고전', '고린도후서': '고후',
    '갈라디아서': '갈', '에베소서': '엡', '빌립보서': '빌', '골로새서': '골',
    '데살로니가전서': '살전', '데살로니가후서': '살후', '디모데전서': '딤전', '디모데후서': '딤후',
    '디도서': '딛', '빌레몬서': '몬', '히브리서': '히', '야고보서': '약',
    '베드로전서': '벧전', '베드로후서': '벧후', '요한일서': '요일', '요한이서': '요이',
    '요한삼서': '요삼', '유다서': '유', '요한계시록': '계',
  };
  
  return abbreviations[name] || name.charAt(0);
});

// Emits
const emit = defineEmits<{
  // 네비게이션
  back: [];
  'prev-chapter': [];
  'next-chapter': [];

  // 모달 열기
  'open-book-selector': [];
  'open-version-selector': [];
  'open-settings': [];

  // 사용자 액션
  'bookmark-toggle': [];
  'note-click': [];
  'mark-as-read': [];

  // BibleViewer 이벤트 전달
  scroll: [position: number];
  bookmark: [verses: { start: number; end: number; text: string }];
  highlight: [verses: { start: number; end: number; text: string }];
  'highlight-delete': [highlightId: number];
  copy: [text: string];
  share: [payload: SelectionSharePayload];

  // 통독모드
  'exit-tongdok': [];
  'tongdok-complete-click': [];
  'today-tongdok': [];
  'audio-link-click': [url: string];
  'audio-external-click': [url: string];
  'audio-player-open-change': [value: boolean];
  'audio-ended': [];
  'reading-plan-click': [];
}>();

// Swipe handlers
const handleSwipeLeft = () => {
  if (props.hasNextChapter) {
    emit('next-chapter');
  }
};

const handleSwipeRight = () => {
  if (props.hasPrevChapter) {
    emit('prev-chapter');
  }
};

// Refs
const bibleViewerRef = ref<InstanceType<typeof BibleViewer> | null>(null);
const selectionMenuState = ref<SelectionMenuState>({
  visible: false,
  mode: null,
  isHighlighted: false,
  isSingleVerse: true,
});

const handleSelectionHighlightOrRemove = () => {
  bibleViewerRef.value?.handleHighlightOrRemove();
};

const handleSelectionCopy = () => {
  bibleViewerRef.value?.handleCopy();
};

const handleSelectionShare = () => {
  bibleViewerRef.value?.handleShare();
};

const handleSelectionClose = () => {
  bibleViewerRef.value?.clearAllSelections();
};

const handleSelectionCopyWithFormat = (format: SelectionCopyFormat) => {
  bibleViewerRef.value?.handleClickCopy(format);
};

const handleSelectionCopyClose = () => {
  bibleViewerRef.value?.clearClickSelection();
};

// Expose
defineExpose({
  bibleViewerRef,
  scrollToTop: () => {
    bibleViewerRef.value?.restoreScrollPosition();
  },
  restoreScrollPosition: () => {
    bibleViewerRef.value?.restoreScrollPosition();
  },
  scrollToVerse: (verseNumber: number) => {
    bibleViewerRef.value?.scrollToVerse(verseNumber);
  },
  focusVerseRange: (startVerse: number, endVerse: number, searchTerm?: string | null) => {
    bibleViewerRef.value?.focusVerseRange(startVerse, endVerse, searchTerm);
  },
});
</script>

<style scoped>
.bible-reader-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}


@media (max-width: 768px) {
  .bible-header,
  .tongdok-indicator {
    padding-left: 10px;
    padding-right: 10px;
  }
}

/* 헤더 */
.bible-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem;
  padding: 0.45rem 1rem;
  background: color-mix(in srgb, var(--color-bg-primary, #f9fafb) 92%, #f3f0ea 8%);
  position: sticky;
  top: 0;
  z-index: 100;
  height: 45px;
  border-bottom: 1px solid rgba(17, 24, 39, 0.045);
  box-shadow: none;
  transition: all 0.15s ease;
}

.back-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: var(--text-primary, #1f2937);
  border-radius: 8px;
  transition: background 0.2s;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;
}

.back-button:hover {
  background: var(--color-bg-hover, #f3f4f6);
}

.back-button:active {
  background: var(--color-bg-active, #e5e7eb);
}

.bookmark-toggle-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  color: var(--text-secondary, #6b7280);
  border-radius: 8px;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;
}

.bookmark-toggle-button:hover {
  background: var(--color-bg-hover, #f3f4f6);
  color: var(--text-primary, #1f2937);
}

.bookmark-toggle-button:active {
  background: var(--color-bg-active, #e5e7eb);
}

.bookmark-toggle-button.is-bookmarked {
  color: var(--primary-color, #2A1111);
}

.bookmark-toggle-button.is-bookmarked:hover {
  color: var(--primary-dark, #3A1A1A);
}

/* 책/장 선택 트리거 - 깔끔한 텍스트 스타일 */
.book-selector-trigger {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0;
  background: transparent;
  border: none;
  color: var(--text-primary, #1f2937);
  cursor: pointer;
  min-width: 0;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.15s ease;
}

.book-selector-trigger:active {
  opacity: 0.7;
}

.book-chapter-text {
  font-family: "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: clamp(1rem, 4.4vw, 1.125rem);
  font-weight: 700;
  color: #181818;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.035em;
}

.selector-icon {
  color: var(--text-tertiary, #9ca3af);
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  transition: transform 0.2s ease;
}

.book-selector-trigger:hover .selector-icon {
  transform: translateY(2px);
  color: var(--text-secondary, #6b7280);
}

/* 책/장 선택 그룹 */
.book-selector-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.book-selector-group {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  justify-content: center;
  flex: none;
  width: max-content;
  max-width: calc(100% - 9rem);
}

.book-selector-group .book-selector-trigger {
  justify-content: center;
  max-width: 100%;
}

/* 통독중 배지 - 플랫한 텍스트 스타일 (레거시) */
.tongdok-badge-inline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.25rem 0.375rem;
  background: transparent;
  color: var(--primary-color);
  border: none;
  border-radius: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.2s;
  margin-left: auto;
  margin-right: auto;
}

.tongdok-badge-inline:hover {
  background: transparent;
  opacity: 0.8; /* 호버 시 투명도 조절로 반응 */
  color: var(--primary-color); /* 색상 유지 */
}

.tongdok-badge-inline:active {
  transform: scale(0.95);
}

.tongdok-badge-inline .close-icon {
  color: var(--text-tertiary, #9ca3af);
  opacity: 0.8;
  margin-left: 2px;
}

.tongdok-badge-inline:hover .close-icon {
  color: var(--primary-color);
}

.tongdok-badge-inline svg {
  opacity: 0.85;
}

/* 상태 도트 (은은한 펄스 효과) */
.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--primary-color);
  margin-right: 2px;
  animation: pulse-dot 2s infinite ease-in-out;
}

.tongdok-badge-inline:hover .status-dot {
  background-color: var(--primary-color);
}

@keyframes pulse-dot {
  0% { opacity: 0.4; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.1); }
  100% { opacity: 0.4; transform: scale(0.9); }
}

.header-left-actions,
.header-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  position: relative;
  z-index: 1;
}

.header-left-actions {
  min-width: 36px;
}

.header-actions {
  margin-left: auto;
}

.header-icon-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  color: var(--text-secondary, #6b7280);
  background: transparent;
  border-radius: 8px;
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
  flex-shrink: 0;
}

.header-icon-action:hover {
  background: var(--color-bg-hover, #f3f4f6);
  color: var(--text-primary, #1f2937);
}

.header-icon-action:active {
  transform: scale(0.94);
}

.tongdok-mode-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.375rem 0.625rem;
  color: var(--primary-color);
  background: var(--primary-light);
  border: 1px solid var(--primary-color);
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.2s;
  white-space: nowrap;
}

.tongdok-mode-btn:hover {
  background: var(--primary-color);
  color: white;
}

.tongdok-mode-btn:active {
  transform: scale(0.95);
}

.version-button {
  padding: 0.375rem 0.75rem;
  background: var(--primary-light);
  color: var(--primary-color);
  border: 1px solid var(--primary-color);
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 600;
  transition: all 0.2s;
}

.version-button:hover {
  background: var(--primary-color);
  color: white;
}

/* 책 이름 표시 토글 */
.book-name-short {
  display: none;
}

/* 반응형 - 좁은 화면 */
@media (max-width: 480px) {
  .tongdok-badge-inline {
    font-size: 0.8125rem;
  }
}

/* 매우 좁은 화면 - 책 이름 축약 */
@media (max-width: 380px) {
  .book-name-full {
    display: none;
  }
  
  .book-name-short {
    display: inline;
  }
  
  .tongdok-badge-inline {
    font-size: 0.75rem;
  }
}

/* 통독 인디케이터 (기존 하위 호환성) */
.tongdok-indicator {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: var(--primary-light, #eef2ff);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.tongdok-info-container {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.tongdok-badge {
  padding: 0.25rem 0.5rem;
  background: var(--primary-color, #2A1111);
  color: white;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
}

.tongdok-range {
  font-size: 0.9375rem;
  color: var(--text-primary, #1f2937);
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.02em;
}

.tongdok-remaining-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.375rem;
  background: rgba(42, 17, 17, 0.1);
  color: var(--primary-color, #2A1111);
  border-radius: 6px;
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
}

.tongdok-date {
  font-size: 0.75rem;
  color: var(--text-secondary, #6b7280);
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

.tongdok-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.tongdok-btn-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.625rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.2s;
  white-space: nowrap;
  text-decoration: none;
  cursor: pointer;
}

.tongdok-btn-label:hover {
  background: rgba(255, 255, 255, 0.5);
}

.tongdok-btn-label:active {
  transform: scale(0.96);
}

.tongdok-btn-label.audio {
  color: var(--text-secondary, #4b5563);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.tongdok-btn-label.audio:hover {
  background: white;
  color: var(--primary-color, #2A1111);
}

.tongdok-btn-label.guide {
  color: var(--text-secondary, #4b5563);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.tongdok-btn-label.guide:hover {
  background: white;
  color: var(--primary-color, #2A1111);
}

.tongdok-btn-label.complete {
  color: var(--color-success, #2A1111);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(42, 17, 17, 0.2);
}

.tongdok-btn-label.complete:hover {
  background: rgba(42, 17, 17, 0.1);
}

.tongdok-btn-label.close {
  color: var(--text-secondary, #6b7280);
  background: transparent;
  border: 1px solid transparent;
}

.tongdok-btn-label.close:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-primary, #1f2937);
}

/* 본문 하단 읽음 표시 영역 (인라인) */
.content-bottom-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem 1rem 2rem;
  margin-top: 1rem;
  /* 시스템 폰트 강제 적용 - 본문 명조체 상속 방지 */
  font-family: "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  border-top: none;
  background: transparent;
  border-radius: 0;
}

/* 하단 액션 행: 이전 장 / 완료 / 다음 장 - 플랫, 한 줄, 가운데 정렬 */
.chapter-action-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  padding: 0.5rem 1rem;
}

.flat-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  flex: 1;
  min-width: 0;
  padding: 0.75rem 1rem;
  background: transparent;
  color: var(--text-primary, #1f2937);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
  font-family: "Pretendard", -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.flat-action-btn:hover:not(:disabled) {
  background: var(--color-bg-hover, #f3f4f6);
  border-color: var(--color-border-dark, #d1d5db);
}

.flat-action-btn:active:not(:disabled) {
  background: var(--color-bg-active, #e5e7eb);
}

.flat-action-btn.complete {
  color: var(--primary-color, #2A1111);
  border-color: rgba(42, 17, 17, 0.25);
}

.flat-action-btn.complete.is-read {
  color: var(--color-success, #2A1111);
  border-color: rgba(42, 17, 17, 0.3);
  background: rgba(42, 17, 17, 0.06);
}

.flat-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

[data-theme="dark"] .flat-action-btn {
  color: var(--color-text-primary);
  border-color: rgba(255, 255, 255, 0.12);
}

[data-theme="dark"] .flat-action-btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
  border-color: rgba(255, 255, 255, 0.2);
}

[data-theme="dark"] .flat-action-btn.complete.is-read {
  background: rgba(255, 255, 255, 0.08);
}

.progress-info-inline {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  max-width: 260px;
  padding: 1rem 1.25rem;
  background: var(--color-bg-card, rgba(255, 255, 255, 0.8));
  border-radius: 14px;
  border: 1px solid var(--color-border-light, rgba(0, 0, 0, 0.06));
}

.progress-info-inline .progress-label {
  font-family: "Pretendard", -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary, #374151);
  white-space: nowrap;
  letter-spacing: -0.01em;
}

.progress-info-inline .progress-text {
  font-family: "Pretendard", -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary, #6b7280);
  white-space: nowrap;
  letter-spacing: -0.01em;
}

.progress-info-inline .progress-percentage {
  color: var(--primary-color, #2A1111);
  font-weight: 600;
}

.progress-info-inline .progress-bar {
  width: 100%;
  height: 8px;
  background: var(--color-bg-tertiary, #e5e7eb);
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
}

.progress-info-inline .progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--primary-color, #2A1111) 0%, #3A1A1A 100%);
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 4px;
}

/* 본문 하단 이전장/다음장 이동 버튼 */
.chapter-nav-inline {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
  max-width: 360px;
  margin-top: 1.5rem;
  padding-bottom: 2.5rem;
  font-family: "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.chapter-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  flex: 1;
  padding: 0.75rem 1rem;
  background: var(--color-bg-card, rgba(255, 255, 255, 0.8));
  color: var(--text-primary, #1f2937);
  border: 1px solid var(--color-border-light, rgba(0, 0, 0, 0.08));
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  transition: all 0.2s ease;
}

.chapter-nav-btn:hover:not(:disabled) {
  background: var(--color-bg-hover, #f3f4f6);
  border-color: var(--color-border-dark, #d1d5db);
}

.chapter-nav-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.chapter-nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

[data-theme="dark"] .chapter-nav-btn {
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  border-color: rgba(255, 255, 255, 0.08);
}

[data-theme="dark"] .chapter-nav-btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
  border-color: rgba(255, 255, 255, 0.14);
}

.nav-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--color-slate-600, #475569);
  border-radius: 6px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  background: transparent;
  border: none;
  outline: none;
  cursor: pointer;
  flex-shrink: 0;
}

.nav-button:hover:not(:disabled) {
  transform: scale(1.15);
  color: var(--primary-color, #2A1111);
  background: transparent;
}

.nav-button:active:not(:disabled) {
  transform: scale(0.95);
}

.nav-button:disabled {
  color: var(--text-muted, #9ca3af);
  opacity: 0.5;
  cursor: not-allowed;
}

.chapter-info {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  font-size: clamp(0.8125rem, 2.8vw, 0.875rem);
  color: var(--text-primary, #1f2937);
  padding: 0.375rem 0.5rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid var(--color-border, #e5e7eb);
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
  flex: 1;
  max-width: min(200px, 55vw);
  min-width: 0;
  overflow: hidden;
}

.chapter-info:hover {
  background: var(--color-bg-hover, #f3f4f6);
  border-color: var(--color-border-dark, #d1d5db);
}

.chapter-info:active {
  background: var(--color-bg-active, #e5e7eb);
  transform: scale(0.98);
}

.chapter-info-text {
  font-weight: 600;
  color: var(--text-primary, #1f2937);
}

.chapter-info .schedule-short-date {
  font-size: clamp(0.6875rem, 2.4vw, 0.75rem);
  color: var(--text-secondary, #6b7280);
  font-weight: 500;
  margin-right: 0.125rem;
  flex-shrink: 0;
}

.chapter-info .schedule-range {
  font-size: clamp(0.8125rem, 2.8vw, 0.875rem);
  color: var(--text-primary, #1f2937);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 통독 모드일 때 챕터 정보 버튼 스타일 */
.chapter-info.is-tongdok {
  padding: 0.25rem 0.375rem 0.25rem 0.5rem;
  gap: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
  min-width: 0;
  max-width: min(260px, 66vw);
  width: auto;
  flex-shrink: 1;
  background: rgba(42, 17, 17, 0.08);
  border-color: rgba(42, 17, 17, 0.18);
}

.chapter-info.is-tongdok:hover {
  background: rgba(42, 17, 17, 0.12);
  border-color: rgba(42, 17, 17, 0.28);
}

.chapter-info.is-tongdok:active {
  background: rgba(42, 17, 17, 0.16);
}

.tongdok-status-badge {
  display: inline-flex; /* 상단과 동일 */
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.25rem 0.25rem 0; /* 상단과 높이 맞춤, 좌측 패딩 제거 */
  background: transparent;
  color: var(--primary-color);
  border: none;
  border-radius: 0;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1.2;
}

.status-dot-small {
  display: inline-block;
  width: 6px; /* 상단과 동일하게 6px */
  height: 6px;
  border-radius: 50%;
  background-color: var(--primary-color);
  animation: pulse-dot 2s infinite ease-in-out;
}

.schedule-short-date {
  color: var(--text-secondary);
  font-size: 0.8125rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.vertical-divider {
  width: 1px;
  height: 10px;
  background-color: var(--color-border-default, #e5e7eb);
  margin: 0;
  flex-shrink: 0;
}

.tongdok-completion-group {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
  padding: 0;
  border-radius: 999px;
  transition: background 0.2s;
  white-space: nowrap;
  flex-shrink: 1;
  min-width: 0;
}

/* 다크모드 대응 */
[data-theme="dark"] .tongdok-status-badge {
  /* 상단 헤더와 동일한 변수 사용으로 자동 적용됨 (primary-light/primary-color) */
}

[data-theme="dark"] .vertical-divider {
  background-color: var(--color-border-default);
}

[data-theme="dark"] .tongdok-completion-group:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* ==========================================
   다크모드 스타일 - [data-theme="dark"] 셀렉터 사용
   프로젝트 전체 테마 시스템과 일관성 유지
   ========================================== */

/* 헤더 다크모드 */
[data-theme="dark"] .bible-header {
  background: var(--color-bg-primary);
  border-bottom-color: rgba(255, 255, 255, 0.06);
  box-shadow: none;
}


/* 책/장 선택 트리거 다크모드 */
[data-theme="dark"] .book-chapter-text {
  color: var(--color-text-primary);
}

[data-theme="dark"] .selector-icon {
  color: var(--color-text-tertiary);
}

[data-theme="dark"] .book-selector-trigger:hover .selector-icon {
  color: var(--color-text-secondary);
}

/* 통독중 배지 다크모드 (레거시) */
[data-theme="dark"] .tongdok-badge-inline:hover {
  color: var(--primary-color);
  background: transparent;
  opacity: 0.8;
}

/* 북마크 버튼 다크모드 */
[data-theme="dark"] .bookmark-toggle-button {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .bookmark-toggle-button:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

[data-theme="dark"] .bookmark-toggle-button.is-bookmarked {
  color: var(--color-accent-primary);
}

[data-theme="dark"] .header-icon-action {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .header-icon-action:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

/* 통독모드 버튼 다크모드 */
[data-theme="dark"] .tongdok-mode-btn {
  background: rgba(42, 17, 17, 0.15);
  color: var(--color-accent-primary);
}

[data-theme="dark"] .tongdok-mode-btn:hover {
  background: var(--color-accent-primary);
  color: var(--color-text-inverse);
}

/* 네비게이션 버튼 다크모드 */
[data-theme="dark"] .nav-button {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .nav-button:hover:not(:disabled) {
  background: transparent;
  color: var(--color-accent-primary);
}

[data-theme="dark"] .nav-button:disabled {
  color: var(--color-text-muted);
  opacity: 0.4;
}

/* 챕터 정보 버튼 다크모드 */
[data-theme="dark"] .chapter-info {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
  color: var(--color-text-primary);
}

[data-theme="dark"] .chapter-info:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.15);
}

[data-theme="dark"] .chapter-info:active {
  background: rgba(255, 255, 255, 0.14);
}

[data-theme="dark"] .chapter-info-text {
  color: var(--color-text-primary);
}

[data-theme="dark"] .chapter-info .schedule-short-date {
  color: var(--color-text-tertiary);
}

[data-theme="dark"] .tongdok-completion-group:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* 통독 인디케이터 다크모드 */
[data-theme="dark"] .tongdok-indicator {
  background: rgba(42, 17, 17, 0.1);
  border-color: var(--color-border-default);
}

[data-theme="dark"] .tongdok-range {
  color: var(--color-text-primary);
}

[data-theme="dark"] .tongdok-remaining-badge {
  background: rgba(42, 17, 17, 0.15);
  color: var(--color-accent-primary);
}

[data-theme="dark"] .tongdok-date {
  color: var(--color-text-secondary);
}

/* 통독 버튼 라벨 다크모드 */
[data-theme="dark"] .tongdok-btn-label.audio,
[data-theme="dark"] .tongdok-btn-label.guide {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
  color: var(--color-text-secondary);
}

[data-theme="dark"] .tongdok-btn-label.audio:hover,
[data-theme="dark"] .tongdok-btn-label.guide:hover {
  background: rgba(255, 255, 255, 0.15);
  color: var(--color-text-primary);
}

[data-theme="dark"] .tongdok-btn-label.complete {
  background: rgba(52, 211, 153, 0.1);
  border-color: rgba(52, 211, 153, 0.25);
  color: var(--color-success);
}

[data-theme="dark"] .tongdok-btn-label.complete:hover {
  background: rgba(52, 211, 153, 0.18);
}

[data-theme="dark"] .tongdok-btn-label.close {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .tongdok-btn-label.close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text-primary);
}

/* 본문 하단 액션 영역 다크모드 */
[data-theme="dark"] .content-bottom-action {
  background: linear-gradient(
    to bottom,
    transparent 0%,
    var(--color-bg-secondary) 20%,
    var(--color-bg-secondary) 100%
  );
}

/* 진도 정보 인라인 다크모드 */
[data-theme="dark"] .progress-info-inline {
  background: var(--color-bg-card);
  border-color: rgba(255, 255, 255, 0.08);
}

[data-theme="dark"] .progress-info-inline .progress-label {
  color: var(--color-text-primary);
}

[data-theme="dark"] .progress-info-inline .progress-text {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .progress-info-inline .progress-bar {
  background: var(--color-bg-tertiary);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* 통독 완료 미니 버튼 (헤더) */
.tongdok-complete-mini-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: var(--color-success, #2A1111);
  border-radius: 6px;
  transition: all 0.2s;
}

.tongdok-complete-mini-btn:hover:not(:disabled) {
  background: rgba(42, 17, 17, 0.15);
}

.tongdok-complete-mini-btn:active:not(:disabled) {
  background: rgba(42, 17, 17, 0.25);
  transform: scale(0.95);
}

.tongdok-complete-mini-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 통독 완료 인라인 버튼 (본문 하단) */
.tongdok-complete-btn-inline {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  max-width: 180px;
  padding: 0.75rem 1.25rem;
  background: linear-gradient(135deg, var(--color-success, #2A1111) 0%, #3A1A1A 100%);
  color: white;
  border-radius: 12px;
  font-family: "Pretendard", -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    0 4px 14px rgba(42, 17, 17, 0.35),
    0 2px 6px rgba(42, 17, 17, 0.2);
}

.tongdok-complete-btn-inline:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--color-success-dark, #1F0C0C) 0%, #2A1111 100%);
  transform: translateY(-2px);
  box-shadow: 
    0 8px 20px rgba(42, 17, 17, 0.4),
    0 4px 10px rgba(42, 17, 17, 0.25);
}

.tongdok-complete-btn-inline:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
  box-shadow: 
    0 2px 8px rgba(42, 17, 17, 0.3),
    0 1px 4px rgba(42, 17, 17, 0.2);
}

.tongdok-complete-btn-inline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 통독 하단 진행 정보 */
.tongdok-progress-area {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem 0.5rem;
  background: rgba(255, 255, 255, 0.72);
  border-bottom: 1px solid rgba(42, 17, 17, 0.12);
}

.tongdok-complete-status {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  justify-content: center;
  width: auto;
  min-width: 26px;
  height: 26px;
  padding: 0 0.45rem;
  border-radius: 999px;
  color: var(--color-accent-primary, #2A1111);
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(42, 17, 17, 0.14);
  flex-shrink: 0;
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.tongdok-complete-status:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.9);
  color: var(--color-accent-primary, #2A1111);
}

.tongdok-complete-status:active:not(:disabled) {
  transform: scale(0.96);
}

.tongdok-complete-status:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.tongdok-complete-label {
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

[data-theme="dark"] .tongdok-progress-area {
  background: rgba(31, 41, 55, 0.82);
  border-bottom-color: rgba(42, 17, 17, 0.16);
}

[data-theme="dark"] .tongdok-complete-status {
  color: var(--color-accent-primary);
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
}

[data-theme="dark"] .tongdok-complete-status:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.14);
  color: var(--color-accent-primary);
}

.story-progress-bar {
  display: flex;
  flex: 1;
  gap: 5px;
  min-width: 0;
}

.progress-segment {
  flex: 1;
  height: 5px;
  background: rgba(42, 17, 17, 0.16);
  border-radius: 999px;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

[data-theme="dark"] .progress-segment {
  background: rgba(255, 255, 255, 0.14);
}

.progress-segment.filled {
  background: rgba(42, 17, 17, 0.56);
}

.progress-segment.current {
  background: var(--color-accent-primary, #2A1111);
  box-shadow: 0 0 0 3px rgba(42, 17, 17, 0.12);
}

.progress-text-indicator {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-secondary, #6b7280);
  white-space: nowrap;
  min-width: 2rem;
  text-align: right;
  font-feature-settings: "tnum";
  font-variant-numeric: tabular-nums;
}

[data-theme="dark"] .progress-text-indicator {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .progress-segment.filled {
  background: rgba(42, 17, 17, 0.56);
}

[data-theme="dark"] .progress-segment.current {
  background: var(--color-accent-primary);
  box-shadow: 0 0 0 3px rgba(42, 17, 17, 0.14);
}

.tongdok-exit-bottom-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 999px;
  color: var(--text-secondary, #6b7280);
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(42, 17, 17, 0.14);
  flex-shrink: 0;
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.tongdok-exit-bottom-btn:hover {
  color: var(--text-primary, #1f2937);
  background: rgba(255, 255, 255, 0.9);
}

.tongdok-exit-bottom-btn:active {
  transform: scale(0.94);
}

[data-theme="dark"] .tongdok-exit-bottom-btn {
  color: var(--color-text-secondary);
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
}

[data-theme="dark"] .tongdok-exit-bottom-btn:hover {
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.14);
}

@media (max-width: 768px) {
  .bible-header,
  .tongdok-indicator {
    padding-left: 10px;
    padding-right: 10px;
  }
}

</style>
