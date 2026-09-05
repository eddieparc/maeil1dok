<template>
  <BibleSubpageLayout title="내 기록" class="records-page" :loading="isLoading" loading-text="하이라이트를 불러오는 중..." :empty="isEmpty" :empty-text="emptyText" :empty-hint="emptyHint" :empty-guide="emptyGuide">
    <template #actions>
      <button type="button" class="icon-btn" aria-label="기록 검색" :aria-expanded="showSearch" aria-controls="highlights-search" @click="showSearch = !showSearch"><Search :size="20" aria-hidden="true" /></button>
    </template>
    <template #empty-icon><Highlighter :size="48" /></template>
    <template #empty-action><NuxtLink v-if="!auth.isAuthenticated.value" to="/login" class="bible-login-btn">로그인</NuxtLink></template>
    <template #filter>
      <div class="record-controls">
        <SegmentedControl model-value="/bible/highlights" :options="recordSegments" aria-label="내 기록 종류" @update:model-value="router.push(String($event))" />
        <input v-if="showSearch" id="highlights-search" v-model="searchQuery" class="search-input" type="search" aria-label="하이라이트 검색" placeholder="하이라이트 검색" />
        <div class="filter-bar">
          <select v-model="filterBook" class="filter-select" aria-label="성경 필터">
            <option value="">전체 성경</option>
            <optgroup label="구약"><option v-for="book in BIBLE_BOOKS.old" :key="book.id" :value="book.id">{{ book.name }}</option></optgroup>
            <optgroup label="신약"><option v-for="book in BIBLE_BOOKS.new" :key="book.id" :value="book.id">{{ book.name }}</option></optgroup>
          </select>
          <select v-model="sortOrder" class="filter-select" aria-label="정렬"><option value="recent">최근순</option><option value="oldest">오래된순</option></select>
          <select v-model="filterColor" class="filter-select" aria-label="색상 필터">
            <option value="">모든 색상</option>
            <option v-for="color in DEFAULT_HIGHLIGHT_COLORS" :key="color.value" :value="color.value">{{ color.name }}</option>
          </select>
        </div>
      </div>
    </template>
    <template #skeleton><SkeletonList :count="5" variant="highlight" /></template>

    <ul class="highlight-list">
      <li v-for="(highlight, index) in filteredHighlights" :key="highlight.id" class="highlight-item" :style="{ '--record-delay': `${80 + index * 50}ms` }">
        <button type="button" class="highlight-link" @click="goToHighlight(highlight)">
          <span class="highlight-header">
            <span class="highlight-location">
              <span class="highlight-color" :style="{ background: highlightColor(highlight.color) }" aria-hidden="true" />
              {{ highlight.book_name || getBookName(highlight.book) }} {{ formatVerseRange(highlight) }}
            </span>
            <time class="highlight-date" :datetime="highlight.created_at">{{ formatRelativeDate(highlight.created_at) }}</time>
          </span>
          <span v-if="highlight.memo" class="highlight-memo">{{ truncate(highlight.memo, 100) }}</span>
        </button>
        <button type="button" class="icon-btn delete-btn" @click="handleDelete(highlight)" aria-label="하이라이트 삭제" title="삭제"><Trash2 :size="18" aria-hidden="true" /></button>
      </li>
    </ul>
    <Toast />
  </BibleSubpageLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Highlighter, Search, Trash2 } from '@lucide/vue';
import { useHighlight, DEFAULT_HIGHLIGHT_COLORS } from '~/composables/useHighlight';
import { useBibleData, BIBLE_BOOKS } from '~/composables/useBibleData';
import { useAuthService } from '~/composables/useAuthService';
import { useToast } from '~/composables/useToast';
import { useModal } from '~/composables/useModal';
import { useErrorHandler } from '~/composables/useErrorHandler';
import { useTextUtils } from '~/composables/useTextUtils';
import Toast from '~/components/Toast.vue';
import BibleSubpageLayout from '~/components/bible/BibleSubpageLayout.vue';
import SegmentedControl from '~/components/ui/SegmentedControl.vue';
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue';
import type { Highlight } from '~/types/bible';

definePageMeta({ layout: 'default' });
const router = useRouter();
const auth = useAuthService();
const toast = useToast();
const modal = useModal();
const { handleApiError } = useErrorHandler();
const { highlights, isHighlightLoading: isLoading, fetchHighlights, deleteHighlight } = useHighlight();
const { getBookName } = useBibleData();
const { formatRelativeDate } = useDateFormat();
const { truncate } = useTextUtils();
const recordSegments = [
  { value: '/bible/notes', label: '묵상노트' },
  { value: '/bible/highlights', label: '하이라이트' },
  { value: '/bible/bookmarks', label: '북마크' },
];
const filterBook = ref('');
const filterColor = ref('');
const sortOrder = ref('recent');
const showSearch = ref(false);
const searchQuery = ref('');

// Presentation only: retain persisted palette values for filtering and API calls.
const highlightTokens = [
  'var(--color-highlight-yellow)',
  'var(--color-highlight-green)',
  'var(--color-highlight-blue)',
  'var(--color-highlight-pink)',
];
const highlightColor = (color: string) => {
  const index = DEFAULT_HIGHLIGHT_COLORS.findIndex(option => option.value.toLowerCase() === color.toLowerCase());
  return highlightTokens[index] ?? color;
};

const isEmpty = computed(() => !auth.isAuthenticated.value || filteredHighlights.value.length === 0);
const emptyText = computed(() => {
  if (!auth.isAuthenticated.value) return '로그인 후 하이라이트를 확인할 수 있습니다';
  return filterBook.value || filterColor.value || searchQuery.value ? '해당 조건의 하이라이트가 없습니다' : '하이라이트가 없습니다';
});
const emptyHint = computed(() => auth.isAuthenticated.value ? '중요한 구절에 색상을 입혀보세요' : '');
const emptyGuide = computed(() =>
  auth.isAuthenticated.value && !filterBook.value && !filterColor.value && !searchQuery.value
    ? ['성경 읽기 화면에서 텍스트를 드래그하세요', '나타나는 메뉴에서 "하이라이트"를 선택하세요', '원하는 색상을 선택하면 저장됩니다']
    : undefined
);

onMounted(async () => {
  if (auth.isAuthenticated.value) await fetchHighlights();
});

const filteredHighlights = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  return highlights.value.filter(highlight =>
    (!filterBook.value || highlight.book === filterBook.value) &&
    (!filterColor.value || highlight.color === filterColor.value) &&
    (!query || `${highlight.book_name || getBookName(highlight.book)} ${highlight.memo || ''}`.toLocaleLowerCase().includes(query))
  ).sort((a, b) => (sortOrder.value === 'recent' ? -1 : 1) * (Date.parse(a.created_at) - Date.parse(b.created_at)));
});

const formatVerseRange = (highlight: Highlight): string => {
  if (highlight.start_verse === highlight.end_verse) return `${highlight.chapter}:${highlight.start_verse}`;
  return `${highlight.chapter}:${highlight.start_verse}-${highlight.end_verse}`;
};

const goToHighlight = (highlight: Highlight) => {
  router.push({ path: '/bible', query: { book: highlight.book, chapter: String(highlight.chapter), verse: String(highlight.start_verse) } });
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
    if (success) toast.success('삭제되었습니다');
    else toast.error('삭제에 실패했습니다');
  } catch (error) {
    handleApiError(error, '하이라이트 삭제');
  }
};
</script>

<style scoped>
.records-page { letter-spacing: var(--tracking-body); }
.records-page :deep(.bible-page-header) { min-height: 52px; padding: 0 20px; }
.records-page :deep(.bible-page-header h1) { font-size: 16px; font-weight: 700; }
.records-page :deep(.bible-back-btn) { width: 44px; height: 44px; border-radius: var(--radius-pill); }
.records-page :deep(.bible-back-btn:focus-visible) { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; }
.record-controls { display: grid; gap: 14px; padding: 14px 20px; }
.filter-bar { display: flex; flex-wrap: wrap; gap: 8px; }
.filter-select, .search-input { min-height: 44px; min-width: 0; padding: 8px 14px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); font-size: 13px; font-weight: 600; color: var(--color-text-secondary); background: var(--color-bg-card); }
.filter-select { max-width: 65%; cursor: pointer; }
.search-input { width: 100%; box-sizing: border-box; }
.search-input::placeholder { color: var(--color-text-tertiary); }
.icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border: 1px solid transparent; border-radius: var(--radius-pill); background: transparent; color: var(--color-text-secondary); cursor: pointer; transition: background-color var(--duration-micro) ease, transform var(--duration-micro) ease; }
.icon-btn:hover, .filter-select:hover { background: var(--color-bg-hover); }
.highlight-list { display: grid; gap: 10px; list-style: none; padding: 0 20px 96px; margin: 0; }
.highlight-item { position: relative; border: 1px solid var(--color-border-default); border-radius: var(--radius-card); background: var(--color-bg-card); box-shadow: var(--shadow-card); animation: record-enter var(--duration-enter) var(--ease-out-quint) both; animation-delay: var(--record-delay); transition: transform var(--duration-micro) ease, box-shadow var(--duration-micro) ease; }
.highlight-link { display: block; width: 100%; min-height: 76px; padding: 16px 18px; padding-right: 52px; border: none; border-radius: inherit; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.highlight-item:hover { transform: translateY(-2px); box-shadow: var(--shadow-card-hover); }
.highlight-header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; }
.highlight-location { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--color-accent-primary); }
.highlight-color { display: inline-block; flex: 0 0 12px; width: 12px; height: 4px; border-radius: var(--radius-pill); }
.highlight-date { flex-shrink: 0; font-size: 11px; color: var(--color-text-tertiary); }
.highlight-memo { display: block; margin-top: 8px; font-size: 13px; color: var(--color-text-secondary); line-height: 1.55; overflow-wrap: anywhere; }
.delete-btn { position: absolute; top: 5px; right: 4px; color: var(--color-text-tertiary); }
.delete-btn:hover { background: var(--color-error-bg); color: var(--color-error); }
.icon-btn:focus-visible, .filter-select:focus-visible, .search-input:focus-visible, .highlight-link:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; border-color: var(--color-accent-primary); }
.icon-btn:active, .highlight-link:active { transform: scale(.97); }
@keyframes record-enter { from { opacity: 0; translate: 0 10px; } to { opacity: 1; translate: 0 0; } }
@media (prefers-reduced-motion: reduce) {
  .highlight-item { animation-name: record-fade; }
  .highlight-item, .icon-btn { transition: none; }
  .highlight-item:hover, .icon-btn:active, .highlight-link:active { transform: none; }
  @keyframes record-fade { from { opacity: 0; } to { opacity: 1; } }
}
</style>
