<template>
  <BibleSubpageLayout title="내 기록" class="records-page" :loading="authStore.isLoading.value || isLoading" loading-text="북마크를 불러오는 중...">
    <template #actions>
      <BibleRecordControls v-model:show-search="showSearch" action-only search-id="bookmarks-search" />
    </template>
    <template #filter>
      <BibleRecordControls v-model:show-search="showSearch" v-model:search-query="searchQuery" v-model:filter-book="filterBook" v-model:sort-order="sortOrder" active-route="/bible/bookmarks" search-id="bookmarks-search" search-label="북마크 검색" />
    </template>
    <template #skeleton><SkeletonList :count="6" variant="bookmark" /></template>

    <EmptyState v-if="listFailed" data-testid="bookmarks-error" role="alert" text="북마크를 불러오지 못했습니다" action-text="다시 시도" @action="loadBookmarks" />
    <EmptyState v-else-if="isEmpty" :text="emptyText" :hint="emptyHint" :guide="emptyGuide">
      <template #icon><BookmarkIcon :size="48" /></template>
      <template #action>
        <NuxtLink v-if="!authStore.isAuthenticated.value" to="/login" class="bible-login-btn">로그인</NuxtLink>
        <button v-else-if="filterBook || searchQuery" type="button" class="bible-login-btn" @click="filterBook = ''; searchQuery = ''">필터 초기화</button>
        <NuxtLink v-else to="/bible" class="bible-login-btn">성경 읽기</NuxtLink>
      </template>
    </EmptyState>
    <ul v-else class="bookmark-list">
      <BibleRecordRow v-for="(bookmark, index) in filteredBookmarks" :key="bookmark.id" :index="index" :to="bookmarkLocation(bookmark)">
        <template #location><span class="bookmark-location"><span class="bookmark-color" :style="{ background: bookmark.color || 'var(--color-accent-primary)' }" aria-hidden="true" />{{ bookmark.book_name || bookmark.book }} {{ formatLocation(bookmark) }}</span></template>
        <template #date><time class="bookmark-date" :datetime="bookmark.created_at">{{ formatRelativeDate(bookmark.created_at) }}</time></template>
        <template #body>
          <span v-if="bookmark.title" class="bookmark-title">{{ bookmark.title }}</span>
          <span v-if="bookmark.memo" class="bookmark-memo">{{ bookmark.memo }}</span>
        </template>
        <template #trailing><button type="button" class="icon-btn delete-btn" @click="handleDelete(bookmark)" aria-label="북마크 삭제" title="삭제"><Trash2 :size="18" aria-hidden="true" /></button></template>
      </BibleRecordRow>
    </ul>
    <Toast />
  </BibleSubpageLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Bookmark as BookmarkIcon, Trash2 } from '@lucide/vue';
import type { Bookmark } from '~/composables/useBookmark';
import { useBibleData } from '~/composables/useBibleData';
import { useAuthService } from '~/composables/useAuthService';
import { useErrorHandler } from '~/composables/useErrorHandler';
import { useModal } from '~/composables/useModal';
import { useApi } from '~/composables/useApi';
import Toast from '~/components/Toast.vue';
import BibleSubpageLayout from '~/components/bible/BibleSubpageLayout.vue';
import BibleRecordControls from '~/components/bible/BibleRecordControls.vue';
import BibleRecordRow from '~/components/bible/BibleRecordRow.vue';
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue';
import EmptyState from '~/components/common/EmptyState.vue';

definePageMeta({ layout: 'default' });
const authStore = useAuthService();
const { handleApiError } = useErrorHandler();
const modal = useModal();
const api = useApi();
const listFailed = ref(false);
let listRequest = 0;
const { formatRelativeDate } = useDateFormat();
const { getChapterUnit } = useBibleData();
const bookmarks = ref<Bookmark[]>([]);
const isLoading = ref(true);
const filterBook = ref('');
const sortOrder = ref('recent');
const showSearch = ref(false);
const searchQuery = ref('');

const filteredBookmarks = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  return bookmarks.value.filter(bookmark =>
    (!filterBook.value || bookmark.book === filterBook.value) &&
    (!query || `${bookmark.book_name || bookmark.book} ${bookmark.title} ${bookmark.memo || ''}`.toLocaleLowerCase().includes(query))
  ).sort((a, b) => (sortOrder.value === 'recent' ? -1 : 1) * (Date.parse(a.created_at) - Date.parse(b.created_at)));
});
const isEmpty = computed(() => !authStore.isAuthenticated.value || filteredBookmarks.value.length === 0);
const emptyText = computed(() => !authStore.isAuthenticated.value
  ? '로그인 후 북마크를 확인할 수 있습니다'
  : filterBook.value || searchQuery.value ? '해당 조건의 북마크가 없습니다' : '저장된 북마크가 없습니다'
);
const emptyHint = computed(() => authStore.isAuthenticated.value ? '자주 찾는 장을 저장해두세요' : '');
const emptyGuide = computed(() => authStore.isAuthenticated.value && !filterBook.value && !searchQuery.value
  ? ['성경 읽기 화면으로 이동하세요', '상단의 북마크 아이콘을 탭하세요', '현재 장이 북마크에 저장됩니다']
  : undefined
);

const loadBookmarks = async () => {
  const request = ++listRequest;
  const userId = authStore.user.value?.id;
  bookmarks.value = [];
  listFailed.value = false;
  isLoading.value = true;
  try {
    if (!authStore.isAuthenticated.value) return;
    const response = await api.GET('/api/v1/todos/bible/bookmarks/');
    if (request !== listRequest || userId !== authStore.user.value?.id) return;
    bookmarks.value = response.data.results.map(bookmark => ({ ...bookmark,
      start_verse: bookmark.start_verse ?? undefined, end_verse: bookmark.end_verse ?? undefined,
      title: bookmark.title ?? '',
    }));
  } catch (error) {
    if (request === listRequest && userId === authStore.user.value?.id) listFailed.value = true;
    handleApiError(error, '북마크 로드');
  } finally {
    if (request === listRequest) isLoading.value = false;
  }
};
const mounted = ref(false);
onMounted(() => { mounted.value = true; });
watch(() => mounted.value && authStore.isInitialized.value && !authStore.isLoading.value
  ? authStore.user.value?.id ?? null : undefined, (identity) => {
  if (identity !== undefined) void loadBookmarks();
}, { immediate: true });

const formatLocation = (bookmark: Bookmark): string => {
  if (bookmark.bookmark_type === 'verse' && bookmark.start_verse) {
    if (bookmark.end_verse && bookmark.start_verse !== bookmark.end_verse) return `${bookmark.chapter}:${bookmark.start_verse}-${bookmark.end_verse}`;
    return `${bookmark.chapter}:${bookmark.start_verse}`;
  }
  return `${bookmark.chapter}${getChapterUnit(bookmark.book)}`;
};

const bookmarkLocation = (bookmark: Bookmark) => {
  const query: Record<string, string> = { book: bookmark.book, chapter: String(bookmark.chapter) };
  if (bookmark.bookmark_type === 'verse' && bookmark.start_verse) query.verse = String(bookmark.start_verse);
  return { path: '/bible', query };
};

const handleDelete = async (bookmark: Bookmark) => {
  const confirmed = await modal.confirm({
    title: '북마크 삭제',
    description: '이 북마크를 삭제하시겠습니까?',
    confirmText: '삭제',
    cancelText: '취소',
    confirmVariant: 'danger',
    icon: 'warning'
  });
  if (!confirmed) return;
  try {
    await api.DELETE(api.path('/api/v1/todos/bible/bookmarks/{id}/', { id: bookmark.id }));
    bookmarks.value = bookmarks.value.filter(b => b.id !== bookmark.id);
  } catch (error) {
    handleApiError(error, '북마크 삭제');
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
.bookmark-list { display: grid; gap: 10px; list-style: none; padding: 0 20px 96px; margin: 0; }
.bookmark-location { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--color-accent-primary); }
.bookmark-color { display: inline-block; flex: 0 0 4px; width: 4px; height: 12px; border-radius: var(--radius-pill); }
.bookmark-date { flex-shrink: 0; font-size: 11px; color: var(--color-text-tertiary); }
.bookmark-title { display: block; margin-top: 8px; font-size: 14px; font-weight: 500; color: var(--color-text-primary); line-height: 1.6; overflow-wrap: anywhere; }
.bookmark-memo { display: block; margin-top: 8px; font-size: 13px; color: var(--color-text-secondary); line-height: 1.55; overflow-wrap: anywhere; }
.delete-btn { color: var(--color-text-tertiary); }
.delete-btn:hover { background: var(--color-error-bg); color: var(--color-error); }
.icon-btn:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; }
.icon-btn:active { transform: scale(.97); }
@media (prefers-reduced-motion: reduce) {
  .icon-btn { transition: none; }
  .icon-btn:active { transform: none; }
}
</style>
