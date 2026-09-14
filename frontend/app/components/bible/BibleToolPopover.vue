<template>
  <div class="bible-tool-popover" ref="popoverRef">
    <!-- 트리거 버튼 -->
    <button
      class="tool-trigger-button"
      :class="{ active: isOpen, 'has-indicator': hasIndicator }"
      @click="togglePopover"
      title="도구"
      aria-label="도구 메뉴"
      :aria-expanded="isOpen"
    >
      <EllipsisIcon :size="20" aria-hidden="true" />
      <span v-if="hasIndicator" class="indicator-dot"></span>
    </button>

    <!-- 팝오버 -->
    <Transition name="popover-fade">
      <div v-if="isOpen" class="popover-content" @click.stop>
        <!-- 듣기 (통독모드, 좁은 화면에서만 표시) -->
        <button v-if="audioLink" class="popover-item mobile-only" @click="handleAudioLink">
          <div class="item-icon">
            <AudioIcon />
          </div>
          <div class="item-content">
            <span class="item-label">듣기</span>
          </div>
        </button>

        <!-- 가이드 (통독모드, 좁은 화면에서만 표시) -->
        <a v-if="guideLink" :href="guideLink" target="_blank" rel="noopener noreferrer" class="popover-item mobile-only" @click="closePopover">
          <div class="item-icon">
            <GuideIcon />
          </div>
          <div class="item-content">
            <span class="item-label">가이드</span>
          </div>
        </a>

        <div v-if="audioLink || guideLink" class="popover-divider mobile-only"></div>

        <!-- 성경통독표 -->
        <button class="popover-item" @click="handleReadingPlan">
          <div class="item-icon">
            <ListCheckIcon />
          </div>
          <div class="item-content">
            <span class="item-label">성경통독표</span>
          </div>
        </button>

        <!-- 현재 장 링크 공유 -->
        <button class="popover-item" data-testid="reader-share" @click="handleShare">
          <div class="item-icon">
            <ShareIcon />
          </div>
          <div class="item-content">
            <span class="item-label">공유</span>
          </div>
        </button>

        <div class="popover-divider"></div>

        <!-- 노트 -->
        <button class="popover-item" @click="handleNote">
          <div class="item-icon">
            <NoteIcon />
          </div>
          <div class="item-content">
            <span class="item-label">노트</span>
            <span v-if="noteCount > 0" class="item-badge">{{ noteCount }}</span>
          </div>
        </button>

        <!-- 현재 장 북마크 토글 (통독 모드에서만 표시) -->
        <button v-if="showBookmarkToggle" data-testid="reader-bookmark-toggle" class="popover-item" :class="{ active: isBookmarked }" @click="handleBookmarkToggle">
          <div class="item-icon">
            <BookmarkFilledIcon v-if="isBookmarked" fill="currentColor" />
            <BookmarkOutlineIcon v-else />
          </div>
          <div class="item-content">
            <span class="item-label">{{ isBookmarked ? '북마크 삭제' : '북마크 추가' }}</span>
          </div>
        </button>

        <!-- 북마크 목록 -->
        <button class="popover-item" @click="handleBookmarkList">
          <div class="item-icon">
            <BookmarkOutlineIcon />
          </div>
          <div class="item-content">
            <span class="item-label">북마크 목록</span>
          </div>
        </button>

        <div class="popover-divider"></div>

        <!-- 읽기 설정 -->
        <button data-testid="reader-settings" class="popover-item" @click="handleSettings">
          <div class="item-icon">
            <SettingsIcon />
          </div>
          <div class="item-content">
            <span class="item-label">읽기 설정</span>
          </div>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Ellipsis as EllipsisIcon, FileText as NoteIcon, Bookmark as BookmarkOutlineIcon, Bookmark as BookmarkFilledIcon, Settings as SettingsIcon, ListChecks as ListCheckIcon, Headphones as AudioIcon, BookOpen as GuideIcon, Share2 as ShareIcon } from '@lucide/vue';

const props = defineProps<{
  noteCount: number;
  showBookmarkToggle?: boolean;
  isBookmarked?: boolean;
  // 통독모드 액션 (좁은 화면에서 헤더에서 숨겨지므로 여기서 표시)
  audioLink?: string | null;
  guideLink?: string | null;
}>();

const emit = defineEmits<{
  'note-click': [];
  'reading-plan-click': [];
  'share-click': [];
  'bookmark-toggle': [];
  'audio-link-click': [url: string];
  'open-settings': [];
  'open-change': [value: boolean];
}>();

const popoverRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);
watch(isOpen, value => emit('open-change', value), { flush: 'sync' });

// 인디케이터 표시 여부 (노트가 있는 경우)
const hasIndicator = computed(() => props.noteCount > 0);

const togglePopover = () => {
  isOpen.value = !isOpen.value;
};

const closePopover = () => {
  isOpen.value = false;
};

const handleNote = () => {
  emit('note-click');
  closePopover();
};

const handleBookmarkToggle = () => {
  emit('bookmark-toggle');
  closePopover();
};

const handleBookmarkList = () => {
  closePopover();
  navigateTo('/bible/bookmarks');
};

const handleSettings = () => {
  closePopover();
  emit('open-settings');
};

const handleShare = () => {
  emit('share-click');
  closePopover();
};

const handleReadingPlan = () => {
  emit('reading-plan-click');
  closePopover();
};

const handleAudioLink = () => {
  if (props.audioLink) {
    emit('audio-link-click', props.audioLink);
  }
  closePopover();
};

// 외부 클릭 시 닫기
const handleClickOutside = (e: MouseEvent) => {
  if (popoverRef.value && !popoverRef.value.contains(e.target as Node)) {
    closePopover();
  }
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') closePopover();
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.bible-tool-popover {
  position: relative;
}

.tool-trigger-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--hit-min);
  height: var(--hit-min);
  color: var(--color-text-secondary);
  background: transparent;
  border-radius: 8px;
  border: none;
  outline: none;
  transition: background 0.15s ease, color 0.15s ease;
  position: relative;
}

.tool-trigger-button:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.tool-trigger-button.active {
  background: var(--color-accent-bg);
  color: var(--color-text-primary);
}

.indicator-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 6px;
  height: 6px;
  background: var(--color-accent-primary);
  border-radius: 50%;
}

/* 팝오버 컨텐츠 */
.popover-content {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 168px;
  max-width: calc(100vw - 32px);
  background: var(--color-bg-card);
  border-radius: 12px;
  box-shadow: var(--shadow-md);
  border: 1px solid var(--color-border-default);
  padding: 0.25rem;
  z-index: 100;
}

.popover-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  width: 100%;
  padding: 0.3rem 0.48rem;
  min-height: var(--hit-min);
  background: transparent;
  border-radius: 7px;
  transition: background 0.15s ease;
  text-align: left;
}

.popover-item:hover {
  background: var(--color-bg-hover);
}

.popover-item.active {
  color: var(--color-accent-primary);
}

.popover-item.active .item-icon {
  color: var(--color-accent-primary);
}

.item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.item-icon svg {
  width: 16px;
  height: 16px;
}

.item-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
}

.item-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.4px;
}

.item-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 0.375rem;
  background: var(--color-accent-primary);
  color: var(--color-text-inverse);
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: 9px;
}

.popover-divider {
  height: 1px;
  background: var(--color-border-default);
  margin: 0.18rem 0.15rem;
}

/* 애니메이션 */
.popover-fade-enter-active,
.popover-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.popover-fade-enter-from,
.popover-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* 모바일 전용 항목 (좁은 화면에서만 표시) */
.mobile-only {
  display: none;
}

@media (max-width: 480px) {
  .mobile-only {
    display: flex;
  }
}

/* 다크모드 */
[data-theme="dark"] .tool-trigger-button {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .tool-trigger-button:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

[data-theme="dark"] .tool-trigger-button.active {
  background: var(--color-bg-active);
  color: var(--color-text-primary);
}

[data-theme="dark"] .popover-content {
  background: var(--color-bg-card);
  border-color: var(--color-border-default);
  box-shadow: var(--shadow-md);
}

[data-theme="dark"] .popover-item:hover {
  background: var(--color-bg-hover);
}

[data-theme="dark"] .popover-item.active {
  color: var(--color-accent-primary);
}

[data-theme="dark"] .popover-item.active .item-icon {
  color: var(--color-accent-primary);
}

[data-theme="dark"] .item-label {
  color: var(--color-text-primary);
}

[data-theme="dark"] .item-icon {
  color: var(--color-text-secondary);
}

[data-theme="dark"] .popover-divider {
  background: var(--color-border-default);
}

[data-theme="dark"] .indicator-dot {
  background: var(--color-accent-primary);
}
.popover-item:focus-visible,
.tool-trigger-button:focus-visible {
  outline: 3px solid var(--color-accent-focus-ring);
  outline-offset: 1px;
}

@media (prefers-reduced-motion: reduce) {
  .popover-fade-enter-active,
  .popover-fade-leave-active,
  .popover-item {
    transition: none;
  }
}
</style>
