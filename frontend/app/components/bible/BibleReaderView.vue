<template>
  <div class="bible-reader-view">
    <!-- 헤더 -->
    <header class="bible-header">
      <!-- 통독 모드: [dot] [창세기 1장] [x] -->
      <div v-if="isTongdokMode" class="book-selector-group tongdok-mode">
        <button class="book-selector-trigger tongdok-trigger" @click="$emit('open-book-selector')">
          <span class="tongdok-status-dot"></span>
          <span class="book-chapter-text tongdok-text book-name-full">{{ currentBookName }} {{ currentChapter }}{{ chapterSuffix }}</span>
          <span class="book-chapter-text tongdok-text book-name-short">{{ shortBookName }} {{ currentChapter }}{{ chapterSuffix }}</span>
        </button>
        <button
          class="tongdok-exit-btn"
          @click="$emit('exit-tongdok')"
          title="통독모드 종료"
          aria-label="통독모드 종료"
        >
          <XMarkIcon :size="14" />
        </button>
      </div>

      <!-- 일반 모드: [창세기 1장] [북마크] -->
      <div v-else class="book-selector-group">
        <button class="book-selector-trigger" @click="$emit('open-book-selector')">
          <span class="book-chapter-text book-name-full">{{ currentBookName }} {{ currentChapter }}{{ chapterSuffix }}</span>
          <span class="book-chapter-text book-name-short">{{ shortBookName }} {{ currentChapter }}{{ chapterSuffix }}</span>
          <span
            class="bookmark-toggle-icon"
            :class="{ 'is-bookmarked': isBookmarked }"
            role="button"
            tabindex="0"
            @click.stop="$emit('bookmark-toggle')"
            @keydown.enter.stop.prevent="$emit('bookmark-toggle')"
            :title="isBookmarked ? '북마크 삭제' : '북마크 추가'"
            :aria-label="isBookmarked ? '북마크 삭제' : '북마크 추가'"
          >
            <BookmarkFilledIcon v-if="isBookmarked" :size="18" />
            <BookmarkOutlineIcon v-else :size="18" />
          </span>
        </button>
      </div>

      <!-- 통독모드 액션 버튼들 -->
      <div v-if="isTongdokMode" class="tongdok-actions-inline">
        <!-- 듣기 -->
        <a
          v-if="tongdokAudioLink"
          href="#"
          class="tongdok-action-btn"
          @click.prevent="$emit('audio-link-click', tongdokAudioLink)"
          title="오디오 플레이어"
        >
          <HeadphonesIcon :size="16" />
          <span>듣기</span>
        </a>
        <!-- 가이드 -->
        <a
          v-if="tongdokGuideLink"
          :href="tongdokGuideLink"
          target="_blank"
          rel="noopener noreferrer"
          class="tongdok-action-btn"
          title="가이드"
        >
          <BookOpenIcon :size="16" />
          <span>가이드</span>
        </a>
      </div>

      <div class="header-actions">
        <BibleToolPopover
          :note-count="noteCount"
          :show-bookmark-toggle="isTongdokMode"
          :is-bookmarked="isBookmarked"
          :audio-link="isTongdokMode ? tongdokAudioLink : null"
          :guide-link="isTongdokMode ? tongdokGuideLink : null"
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

        <!-- 일반 읽기 모드일 때 -->
        <div v-if="!isTongdokMode && !isLoading" class="content-bottom-action">
          <button
            class="mark-read-btn-inline"
            :class="{ 'is-read': isCurrentChapterRead }"
            :disabled="isMarkingRead"
            @click="$emit('mark-as-read')"
          >
            <CheckCircleIcon v-if="isCurrentChapterRead" />
            <CheckCircleOutlineIcon v-else />
            <span>{{ isCurrentChapterRead ? '읽음 완료' : '읽음으로 표시' }}</span>
          </button>

          <!-- 진도 표시 -->
          <ClientOnly>
            <div v-if="isAuthenticated && bookProgress.total > 0" class="progress-info-inline">
              <span class="progress-label">{{ currentBookName }} 읽기 진도</span>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: `${bookProgress.percentage}%` }"></div>
              </div>
              <span class="progress-text">{{ bookProgress.read }} / {{ bookProgress.total }}{{ chapterSuffix }} <span class="progress-percentage">({{ bookProgress.percentage }}%)</span></span>
            </div>
          </ClientOnly>
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
        </div>
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
              <div class="tongdok-checkbox-wrapper" @click.stop="$emit('tongdok-complete-click')" title="통독 완료하기">
                <div class="tongdok-custom-checkbox"></div>
              </div>
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
import BibleToolPopover from '~/components/bible/BibleToolPopover.vue';
import TongdokAudioPlayer from '~/components/bible/TongdokAudioPlayer.vue';
import FloatingBottomBar from '~/components/common/FloatingBottomBar.vue';
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
  share: [text: string];

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

// Expose
defineExpose({
  bibleViewerRef,
  scrollToTop: () => {
    bibleViewerRef.value?.restoreScrollPosition();
  },
  scrollToVerse: (verseNumber: number) => {
    bibleViewerRef.value?.scrollToVerse(verseNumber);
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
  gap: 0.25rem;
  padding: 0.75rem 1rem;
  background: var(--color-bg-card, #fff);
  position: sticky;
  top: 0;
  z-index: 100;
  height: 50px;
  box-shadow: var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05));
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
  color: var(--primary-color, #6366f1);
}

.bookmark-toggle-button.is-bookmarked:hover {
  color: var(--primary-dark, #4f46e5);
}

/* 책/장 선택 트리거 - 깔끔한 텍스트 스타일 */
.book-selector-trigger {
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
}

.book-selector-trigger:active {
  opacity: 0.7;
}

.book-chapter-text {
  font-size: clamp(1.125rem, 5vw, 1.375rem);
  font-weight: 700;
  color: var(--text-primary, #1f2937);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.02em;
}

/* 북마크 아이콘 (XX장 옆) */
.bookmark-toggle-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary, #9ca3af);
  padding: 0.125rem;
  border-radius: 4px;
  transition: all 0.2s;
  cursor: pointer;
}

.bookmark-toggle-icon:hover {
  color: var(--text-secondary, #6b7280);
}

.bookmark-toggle-icon.is-bookmarked {
  color: var(--primary-color, #6366f1);
}

.bookmark-toggle-icon.is-bookmarked:hover {
  color: var(--primary-dark, #4f46e5);
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

/* 통독 모드 book-selector-group */
.book-selector-group.tongdok-mode {
  gap: 0.25rem;
}

/* 통독 모드 트리거 */
.book-selector-trigger.tongdok-trigger {
  gap: 0.375rem;
}

/* 통독 모드 상태 dot (초록색) */
.tongdok-status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--color-success, #10b981);
  flex-shrink: 0;
  animation: pulse-dot 2s infinite ease-in-out;
}

/* 통독 모드 텍스트 (초록색) */
.book-chapter-text.tongdok-text {
  color: var(--color-success, #10b981);
}

/* 통독 모드 종료 버튼 */
.tongdok-exit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--text-tertiary, #9ca3af);
  border-radius: 4px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.tongdok-exit-btn:hover {
  color: var(--text-secondary, #6b7280);
  background: var(--color-bg-hover, #f3f4f6);
}

.tongdok-exit-btn:active {
  transform: scale(0.9);
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

/* 통독모드 액션 영역 */
.tongdok-actions-inline {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.125rem;
  flex: 1;
}

/* 통독 액션 버튼 (듣기, 가이드) - 심플한 링크 스타일로 변경 */
.tongdok-action-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  color: var(--text-secondary, #6b7280);
  background: transparent;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  transition: all 0.2s;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
}

.tongdok-action-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-primary, #1f2937);
}

.tongdok-action-btn:active {
  transform: scale(0.95);
}

/* 완료 버튼만 강조 (기존 버튼 스타일 유지) */
.tongdok-action-btn.complete {
  color: var(--primary-color);
  background: var(--primary-light);
  border: 1px solid var(--primary-color);
  font-weight: 600;
  margin-left: 0.25rem;
}

.tongdok-action-btn.complete:hover {
  background: var(--primary-color);
  color: white;
}

.tongdok-action-btn.complete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tongdok-action-btn svg {
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
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
  /* 듣기/가이드 텍스트 숨김, 아이콘만 표시 */
  .tongdok-action-btn span {
    display: none;
  }
  
  .tongdok-action-btn {
    padding: 0.25rem;
  }
  
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
  background: var(--primary-color, #6366f1);
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
  background: rgba(99, 102, 241, 0.1);
  color: var(--primary-color, #6366f1);
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
  color: var(--primary-color, #6366f1);
}

.tongdok-btn-label.guide {
  color: var(--text-secondary, #4b5563);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.tongdok-btn-label.guide:hover {
  background: white;
  color: var(--primary-color, #6366f1);
}

.tongdok-btn-label.complete {
  color: var(--color-success, #10b981);
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.tongdok-btn-label.complete:hover {
  background: rgba(16, 185, 129, 0.1);
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
  gap: 1.25rem;
  padding: 2.5rem 1.5rem 2rem;
  margin-top: 2rem;
  /* 시스템 폰트 강제 적용 - 본문 명조체 상속 방지 */
  font-family: "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  /* 부드러운 구분선 대신 그라데이션 페이드 */
  border-top: none;
  background: linear-gradient(
    to bottom,
    transparent 0%,
    var(--color-bg-secondary, #f8f9fa) 20%,
    var(--color-bg-secondary, #f8f9fa) 100%
  );
  border-radius: 24px 24px 0 0;
}

.mark-read-btn-inline {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  max-width: 180px;
  padding: 0.75rem 1.25rem;
  background: linear-gradient(135deg, var(--primary-color, #6366f1) 0%, #818cf8 100%);
  color: white;
  border-radius: 12px;
  font-family: "Pretendard", -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    0 4px 14px rgba(99, 102, 241, 0.35),
    0 2px 6px rgba(99, 102, 241, 0.2);
}

.mark-read-btn-inline:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--primary-dark, #4f46e5) 0%, #6366f1 100%);
  transform: translateY(-2px);
  box-shadow: 
    0 8px 20px rgba(99, 102, 241, 0.4),
    0 4px 10px rgba(99, 102, 241, 0.25);
}

.mark-read-btn-inline:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
  box-shadow: 
    0 2px 8px rgba(99, 102, 241, 0.3),
    0 1px 4px rgba(99, 102, 241, 0.2);
}

.mark-read-btn-inline.is-read {
  background: linear-gradient(135deg, var(--color-success, #10b981) 0%, #34d399 100%);
  box-shadow: 
    0 4px 14px rgba(16, 185, 129, 0.35),
    0 2px 6px rgba(16, 185, 129, 0.2);
}

.mark-read-btn-inline.is-read:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--color-success-dark, #059669) 0%, #10b981 100%);
  box-shadow: 
    0 8px 20px rgba(16, 185, 129, 0.4),
    0 4px 10px rgba(16, 185, 129, 0.25);
}

.mark-read-btn-inline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
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
  color: var(--primary-color, #6366f1);
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
  background: linear-gradient(90deg, var(--primary-color, #6366f1) 0%, #818cf8 100%);
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 4px;
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
  color: var(--primary-color, #6366f1);
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
  font-size: clamp(0.6875rem, 2.5vw, 0.8125rem);
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
  font-size: clamp(0.5625rem, 2vw, 0.6875rem);
  color: var(--text-secondary, #6b7280);
  font-weight: 500;
  margin-right: 0.125rem;
  flex-shrink: 0;
}

.chapter-info .schedule-range {
  font-size: clamp(0.6875rem, 2.5vw, 0.8125rem);
  color: var(--text-primary, #1f2937);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 통독 모드일 때 챕터 정보 버튼 스타일 */
.chapter-info.is-tongdok {
  padding: 0.25rem 0.5rem;
  gap: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap; /* 줄바꿈 방지 */
  min-width: 0; /* 축소 허용 */
  max-width: 100%; /* 너비 제한 완화 */
  width: auto; /* 자동 너비 */
  flex-shrink: 1; /* 필요시 축소 */
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
  gap: 0.125rem;
  cursor: pointer;
  padding: 0.125rem 0;
  border-radius: 6px;
  transition: background 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
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

[data-theme="dark"] .tongdok-custom-checkbox {
  background-color: transparent;
  border-color: var(--color-text-secondary);
}

[data-theme="dark"] .tongdok-completion-group:hover .tongdok-custom-checkbox {
  border-color: var(--primary-color);
  background-color: rgba(75, 159, 126, 0.1);
}

/* ==========================================
   다크모드 스타일 - [data-theme="dark"] 셀렉터 사용
   프로젝트 전체 테마 시스템과 일관성 유지
   ========================================== */

/* 헤더 다크모드 */
[data-theme="dark"] .bible-header {
  background: var(--color-bg-card);
  box-shadow: var(--shadow-sm);
}

/* 책/장 선택 트리거 다크모드 */
[data-theme="dark"] .book-chapter-text {
  color: var(--color-text-primary);
}

[data-theme="dark"] .book-chapter-text.tongdok-text {
  color: var(--color-success, #34d399);
}

[data-theme="dark"] .tongdok-status-dot {
  background-color: var(--color-success, #34d399);
}

[data-theme="dark"] .tongdok-exit-btn {
  color: var(--color-text-tertiary);
}

[data-theme="dark"] .tongdok-exit-btn:hover {
  color: var(--color-text-secondary);
  background: var(--color-bg-hover);
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

/* 통독 액션 버튼 다크모드 */
[data-theme="dark"] .tongdok-action-btn {
  color: var(--color-text-secondary, #9ca3af);
  background: transparent;
}

[data-theme="dark"] .tongdok-action-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text-primary, #e5e5e5);
}

[data-theme="dark"] .tongdok-action-btn.complete {
  color: var(--primary-color);
  background: var(--primary-light);
  border-color: var(--primary-color);
}

[data-theme="dark"] .tongdok-action-btn.complete:hover {
  color: var(--color-text-inverse);
}

[data-theme="dark"] .tongdok-action-btn.complete {
  color: var(--color-success, #34d399);
}

[data-theme="dark"] .tongdok-action-btn.complete:hover {
  background: rgba(52, 211, 153, 0.15);
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

/* 북마크 아이콘 다크모드 (XX장 옆) */
[data-theme="dark"] .bookmark-toggle-icon {
  color: var(--color-text-tertiary);
}

[data-theme="dark"] .bookmark-toggle-icon:hover {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .bookmark-toggle-icon.is-bookmarked {
  color: var(--color-accent-primary);
}

/* 통독모드 버튼 다크모드 */
[data-theme="dark"] .tongdok-mode-btn {
  background: rgba(107, 201, 159, 0.15);
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

[data-theme="dark"] .tongdok-custom-checkbox {
  background-color: transparent;
  border-color: var(--color-text-secondary);
}

[data-theme="dark"] .tongdok-completion-group:hover .tongdok-custom-checkbox {
  border-color: var(--primary-color);
  background-color: rgba(75, 159, 126, 0.1);
}

/* 통독 인디케이터 다크모드 */
[data-theme="dark"] .tongdok-indicator {
  background: rgba(107, 201, 159, 0.1);
  border-color: var(--color-border-default);
}

[data-theme="dark"] .tongdok-range {
  color: var(--color-text-primary);
}

[data-theme="dark"] .tongdok-remaining-badge {
  background: rgba(107, 201, 159, 0.15);
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
  color: var(--color-success, #10b981);
  border-radius: 6px;
  transition: all 0.2s;
}

.tongdok-complete-mini-btn:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.15);
}

.tongdok-complete-mini-btn:active:not(:disabled) {
  background: rgba(16, 185, 129, 0.25);
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
  background: linear-gradient(135deg, var(--color-success, #10b981) 0%, #34d399 100%);
  color: white;
  border-radius: 12px;
  font-family: "Pretendard", -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    0 4px 14px rgba(16, 185, 129, 0.35),
    0 2px 6px rgba(16, 185, 129, 0.2);
}

.tongdok-complete-btn-inline:hover:not(:disabled) {
  background: linear-gradient(135deg, var(--color-success-dark, #059669) 0%, #10b981 100%);
  transform: translateY(-2px);
  box-shadow: 
    0 8px 20px rgba(16, 185, 129, 0.4),
    0 4px 10px rgba(16, 185, 129, 0.25);
}

.tongdok-complete-btn-inline:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
  box-shadow: 
    0 2px 8px rgba(16, 185, 129, 0.3),
    0 1px 4px rgba(16, 185, 129, 0.2);
}

.tongdok-complete-btn-inline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 통독 진행률 바 (인스타그램 스토리 스타일) */
.tongdok-progress-area {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

[data-theme="dark"] .tongdok-progress-area {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.story-progress-bar {
  display: flex;
  flex: 1;
  gap: 4px;
}

.progress-segment {
  flex: 1;
  height: 4px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 2px;
  transition: all 0.3s ease;
}

[data-theme="dark"] .progress-segment {
  background: rgba(255, 255, 255, 0.15);
}

.progress-segment.filled {
  background: var(--primary-color, #6366f1);
}

.progress-segment.current {
  background: var(--color-success, #10b981);
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
  animation: pulse-segment 2s infinite;
}

.progress-text-indicator {
  font-size: 0.75rem;
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
  background: var(--color-accent-primary);
}

[data-theme="dark"] .progress-segment.current {
  background: var(--color-success);
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.5);
}

@keyframes pulse-segment {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

@media (max-width: 768px) {
  .bible-header,
  .tongdok-indicator {
    padding-left: 10px;
    padding-right: 10px;
  }
}

.tongdok-checkbox-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  cursor: pointer;
  border-radius: 4px;
  margin-right: -4px; /* Adjust spacing since we added padding */
}

.tongdok-checkbox-wrapper:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

[data-theme="dark"] .tongdok-checkbox-wrapper:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

</style>
