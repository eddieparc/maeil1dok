<template>
  <BibleSubpageLayout title="내 기록" class="records-page" :loading="auth.isLoading.value || isLoading" loading-text="하이라이트를 불러오는 중...">
    <template #actions>
      <BibleRecordControls v-model:show-search="showSearch" action-only search-id="highlights-search" />
    </template>
    <template #filter>
      <BibleRecordControls v-model:show-search="showSearch" v-model:search-query="searchQuery" v-model:filter-book="filterBook" v-model:sort-order="sortOrder" active-route="/bible/highlights" search-id="highlights-search" search-label="하이라이트 검색">
        <template #filters>
          <select v-model="filterColor" class="filter-select" aria-label="색상 필터">
            <option value="">모든 색상</option>
            <option v-for="color in DEFAULT_HIGHLIGHT_COLORS" :key="color.value" :value="color.value">{{ color.name }}</option>
          </select>
        </template>
      </BibleRecordControls>
    </template>
    <template #skeleton><SkeletonList :count="5" variant="highlight" /></template>

    <EmptyState v-if="listFailed" data-testid="highlights-error" role="alert" text="하이라이트를 불러오지 못했습니다" action-text="다시 시도" @action="loadHighlights" />
    <EmptyState v-else-if="isEmpty" :text="emptyText" :hint="emptyHint" :guide="emptyGuide">
      <template #icon><Highlighter :size="48" /></template>
      <template #action>
        <NuxtLink v-if="!auth.isAuthenticated.value" to="/login" class="bible-login-btn">로그인</NuxtLink>
        <button v-else-if="filterBook || filterColor || searchQuery" type="button" class="bible-login-btn" @click="filterBook = ''; filterColor = ''; searchQuery = ''">필터 초기화</button>
        <NuxtLink v-else to="/bible" class="bible-login-btn">성경 읽기</NuxtLink>
      </template>
    </EmptyState>
    <ul v-else class="highlight-list">
      <BibleRecordRow v-for="(highlight, index) in filteredHighlights" :key="highlight.id" :index="index" :to="{ path: '/bible', query: { book: highlight.book, chapter: String(highlight.chapter), verse: String(highlight.start_verse) } }">
        <template #location><span class="highlight-location"><span class="highlight-color" :style="{ background: highlightColor(highlight.color) }" aria-hidden="true" />{{ highlight.book_name || getBookName(highlight.book) }} {{ formatVerseRange(highlight) }}</span></template>
        <template #date><time class="highlight-date" :datetime="highlight.created_at">{{ formatRelativeDate(highlight.created_at) }}</time></template>
        <template #body><span v-if="highlight.memo" class="highlight-memo">{{ truncate(highlight.memo, 100) }}</span></template>
        <template #trailing><button type="button" class="icon-btn delete-btn" @click="handleDelete(highlight)" aria-label="하이라이트 삭제" title="삭제"><Trash2 :size="18" aria-hidden="true" /></button></template>
      </BibleRecordRow>
    </ul>
    <Toast />
  </BibleSubpageLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Highlighter, Trash2 } from '@lucide/vue';
import { useHighlight, DEFAULT_HIGHLIGHT_COLORS } from '~/composables/useHighlight';
import { useBibleData } from '~/composables/useBibleData';
import { useAuthService } from '~/composables/useAuthService';
import { useToast } from '~/composables/useToast';
import { useModal } from '~/composables/useModal';
import { useErrorHandler } from '~/composables/useErrorHandler';
import { useTextUtils } from '~/composables/useTextUtils';
import { useApi } from '~/composables/useApi';
import EmptyState from '~/components/common/EmptyState.vue';
import Toast from '~/components/Toast.vue';
import BibleSubpageLayout from '~/components/bible/BibleSubpageLayout.vue';
import BibleRecordControls from '~/components/bible/BibleRecordControls.vue';
import BibleRecordRow from '~/components/bible/BibleRecordRow.vue';
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue';
import type { Highlight } from '~/types/bible';

definePageMeta({ layout: 'default' });
const auth = useAuthService();
const toast = useToast();
const modal = useModal();
const { handleApiError } = useErrorHandler();
const { highlights, deleteHighlight } = useHighlight();
const api = useApi();
const isLoading = ref(true);
const listFailed = ref(false);
let listRequest = 0;
const { getBookName } = useBibleData();
const { formatRelativeDate } = useDateFormat();
const { truncate } = useTextUtils();
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

const loadHighlights = async () => {
  const request = ++listRequest;
  const userId = auth.user.value?.id;
  highlights.value = [];
  listFailed.value = false;
  isLoading.value = true;
  try {
    if (!auth.isAuthenticated.value) return;
    const response = await api.GET('/api/v1/todos/bible/highlights/');
    if (request !== listRequest || userId !== auth.user.value?.id) return;
    highlights.value = response.data.results.map(highlight => ({ ...highlight, color: highlight.color ?? '#FFE28A' }));
  } catch (error) {
    if (request === listRequest && userId === auth.user.value?.id) listFailed.value = true;
    handleApiError(error, '하이라이트 로드');
  } finally {
    if (request === listRequest) isLoading.value = false;
  }
};
const mounted = ref(false);
onMounted(() => { mounted.value = true; });
watch(() => mounted.value && auth.isInitialized.value && !auth.isLoading.value
  ? auth.user.value?.id ?? null : undefined, (identity) => {
  if (identity !== undefined) void loadHighlights();
}, { immediate: true });

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
.icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border: 1px solid transparent; border-radius: var(--radius-pill); background: transparent; color: var(--color-text-secondary); cursor: pointer; transition: background-color var(--duration-micro) ease, transform var(--duration-micro) ease; }
.icon-btn:hover { background: var(--color-bg-hover); }
.highlight-list { display: grid; gap: 10px; list-style: none; padding: 0 20px 96px; margin: 0; }
.highlight-location { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--color-accent-primary); }
.highlight-color { display: inline-block; flex: 0 0 12px; width: 12px; height: 4px; border-radius: var(--radius-pill); }
.highlight-date { flex-shrink: 0; font-size: 11px; color: var(--color-text-tertiary); }
.highlight-memo { display: block; margin-top: 8px; font-size: 13px; color: var(--color-text-secondary); line-height: 1.55; overflow-wrap: anywhere; }
.delete-btn { color: var(--color-text-tertiary); }
.delete-btn:hover { background: var(--color-error-bg); color: var(--color-error); }
.icon-btn:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; }
.icon-btn:active { transform: scale(.97); }
@media (prefers-reduced-motion: reduce) {
  .icon-btn { transition: none; }
  .icon-btn:active { transform: none; }
}
</style>
