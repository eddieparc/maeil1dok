<template>
  <BibleSubpageLayout
    title="하이라이트"
    :loading="isLoading"
    loading-text="하이라이트를 불러오는 중..."
    :empty="isEmpty"
    :empty-text="emptyText"
    :empty-hint="emptyHint"
    :empty-guide="emptyGuide"
  >
    <!-- 빈 상태 아이콘 -->
    <template #empty-icon>
      <LayersIcon :size="48" />
    </template>

    <!-- 빈 상태 액션 -->
    <template #empty-action>
      <NuxtLink v-if="!auth.isAuthenticated.value" to="/login" class="bible-login-btn">로그인</NuxtLink>
    </template>

    <!-- 필터 -->
    <template #filter>
      <div class="filter-bar">
        <div class="filter-row">
          <select v-model="filterBook" class="filter-select">
            <option value="">전체</option>
            <optgroup label="구약">
              <option v-for="book in BIBLE_BOOKS.old" :key="book.id" :value="book.id">
                {{ book.name }}
              </option>
            </optgroup>
            <optgroup label="신약">
              <option v-for="book in BIBLE_BOOKS.new" :key="book.id" :value="book.id">
                {{ book.name }}
              </option>
            </optgroup>
          </select>
          <select v-model="filterColor" class="filter-select color-filter">
            <option value="">모든 색상</option>
            <option v-for="color in DEFAULT_HIGHLIGHT_COLORS" :key="color.value" :value="color.value">
              {{ color.name }}
            </option>
          </select>
        </div>
      </div>
    </template>

    <!-- 스켈레톤 -->
    <template #skeleton>
      <SkeletonList :count="5" variant="highlight" />
    </template>

    <!-- 하이라이트 목록 -->
    <ul class="highlight-list">
      <li
        v-for="highlight in filteredHighlights"
        :key="highlight.id"
        class="highlight-item"
        @click="goToHighlight(highlight)"
      >
        <div class="highlight-color" :style="{ background: highlight.color }"></div>
        <div class="highlight-content">
          <div class="highlight-location">
            {{ highlight.book_name || getBookName(highlight.book) }}
            {{ formatVerseRange(highlight) }}
          </div>
          <p v-if="highlight.memo" class="highlight-memo">
            {{ truncate(highlight.memo, 100) }}
          </p>
          <div class="highlight-date">
            {{ formatRelativeDate(highlight.created_at) }}
          </div>
        </div>
        <button class="delete-btn" @click.stop="handleDelete(highlight)" title="삭제">
          <TrashIcon :size="18" />
        </button>
      </li>
    </ul>

    <!-- 토스트 -->
    <Toast />
  </BibleSubpageLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useHighlight, DEFAULT_HIGHLIGHT_COLORS } from '~/composables/useHighlight';
import { useBibleData, BIBLE_BOOKS } from '~/composables/useBibleData';
import { useAuthService } from '~/composables/useAuthService';
import { useToast } from '~/composables/useToast';
import { useModal } from '~/composables/useModal';
import { useErrorHandler } from '~/composables/useErrorHandler';
import { useTextUtils } from '~/composables/useTextUtils';
import Toast from '~/components/Toast.vue';
import BibleSubpageLayout from '~/components/bible/BibleSubpageLayout.vue';
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue';
import type { Highlight } from '~/types/bible';

definePageMeta({
  layout: 'default'
});

const router = useRouter();
const auth = useAuthService();
const toast = useToast();
const modal = useModal();
const { handleApiError } = useErrorHandler();
const { highlights, isHighlightLoading: isLoading, fetchHighlights, deleteHighlight } = useHighlight();
const { getBookName } = useBibleData();
const { formatRelativeDate } = useDateFormat();
const { truncate } = useTextUtils();

const filterBook = ref('');
const filterColor = ref('');

// 빈 상태 계산
const isEmpty = computed(() => !auth.isAuthenticated.value || filteredHighlights.value.length === 0);
const emptyText = computed(() => {
  if (!auth.isAuthenticated.value) {
    return '로그인 후 하이라이트를 확인할 수 있습니다';
  }
  return filterBook.value || filterColor.value
    ? '해당 조건의 하이라이트가 없습니다'
    : '하이라이트가 없습니다';
});
const emptyHint = computed(() =>
  auth.isAuthenticated.value ? '중요한 구절에 색상을 입혀보세요' : ''
);
const emptyGuide = computed(() =>
  auth.isAuthenticated.value && !filterBook.value && !filterColor.value
    ? [
        '성경 읽기 화면에서 텍스트를 드래그하세요',
        '나타나는 메뉴에서 "하이라이트"를 선택하세요',
        '원하는 색상을 선택하면 저장됩니다'
      ]
    : undefined
);

onMounted(async () => {
  if (auth.isAuthenticated.value) {
    await fetchHighlights();
  }
});

const filteredHighlights = computed(() => {
  let result = highlights.value;
  if (filterBook.value) {
    result = result.filter(h => h.book === filterBook.value);
  }
  if (filterColor.value) {
    result = result.filter(h => h.color === filterColor.value);
  }
  return result;
});

const formatVerseRange = (highlight: Highlight): string => {
  if (highlight.start_verse === highlight.end_verse) {
    return `${highlight.chapter}:${highlight.start_verse}`;
  }
  return `${highlight.chapter}:${highlight.start_verse}-${highlight.end_verse}`;
};

const goToHighlight = (highlight: Highlight) => {
  router.push({
    path: '/bible',
    query: {
      book: highlight.book,
      chapter: String(highlight.chapter),
      verse: String(highlight.start_verse)
    }
  });
};

const handleDelete = async (highlight: Highlight) => {
  const confirmed = await modal.confirm({
    title: '하이라이트 삭제',
    description: '하이라이트를 삭제하시겠습니까?',
    confirmText: '삭제',
    cancelText: '취소',
    confirmVariant: 'danger',
    icon: 'warning'
  });
  if (!confirmed) return;

  try {
    const success = await deleteHighlight(highlight.id);
    if (success) {
      toast.success('삭제되었습니다');
    } else {
      toast.error('삭제에 실패했습니다');
    }
  } catch (error) {
    handleApiError(error, '하이라이트 삭제');
  }
};
</script>

<style scoped>
/*
 * Highlights Page specific styles
 * 공통 스타일은 bible-page.css에서 관리됨
 */

/* 필터 */
.filter-bar {
  padding: 0.75rem 1rem;
  background: var(--color-bg-card, #fff);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.filter-row {
  display: flex;
  gap: 0.5rem;
}

.filter-select {
  flex: 1;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  font-size: 0.9375rem;
  color: var(--text-primary, #1f2937);
  background: var(--color-bg-card, #fff);
  cursor: pointer;
}

.filter-select:focus {
  outline: none;
  border-color: var(--primary-color, #2A1111);
}

.color-filter {
  flex: 0 0 auto;
  min-width: 100px;
}

/* 하이라이트 목록 */
.highlight-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.highlight-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--color-bg-card, #fff);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  cursor: pointer;
  transition: background 0.2s;
}

.highlight-item:hover {
  background: var(--color-bg-hover, #f9fafb);
}

.highlight-item:last-child {
  border-bottom: none;
}

.highlight-color {
  width: 4px;
  min-height: 40px;
  border-radius: 2px;
  flex-shrink: 0;
  align-self: stretch;
}

.highlight-content {
  flex: 1;
  min-width: 0;
}

.highlight-location {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
  margin-bottom: 0.25rem;
}

.highlight-memo {
  font-size: 0.8125rem;
  color: var(--text-secondary, #6b7280);
  margin: 0.25rem 0 0.375rem;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.5;
}

.highlight-date {
  font-size: 0.75rem;
  color: var(--text-muted, #9ca3af);
}

.delete-btn {
  padding: 0.5rem;
  margin: -0.25rem;
  color: var(--text-secondary, #6b7280);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.delete-btn:hover {
  background: var(--color-error-light, #fef2f2);
  color: var(--color-error, #ef4444);
}

/* 다크모드 */
:root.dark .filter-bar {
  background: var(--color-bg-card);
  border-color: var(--color-border);
}

:root.dark .filter-select {
  background: var(--color-bg-secondary);
  border-color: var(--color-border);
  color: var(--text-primary);
}

:root.dark .highlight-item {
  background: var(--color-bg-card);
  border-color: var(--color-border);
}

:root.dark .highlight-item:hover {
  background: var(--color-bg-hover);
}

:root.dark .delete-btn:hover {
  background: rgba(239, 68, 68, 0.15);
}
</style>
