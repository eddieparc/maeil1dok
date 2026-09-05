<template>
  <BibleSubpageLayout title="내 기록" class="records-page" :loading="isLoading" loading-text="북마크를 불러오는 중..." :empty="isEmpty" :empty-text="emptyText" :empty-hint="emptyHint" :empty-guide="emptyGuide">
    <template #actions>
      <button type="button" class="icon-btn" aria-label="기록 검색" :aria-expanded="showSearch" aria-controls="bookmarks-search" @click="showSearch = !showSearch"><Search :size="20" aria-hidden="true" /></button>
    </template>
    <template #empty-icon><BookmarkIcon :size="48" /></template>
    <template #empty-action><NuxtLink v-if="!authStore.isAuthenticated.value" to="/login" class="bible-login-btn">로그인</NuxtLink></template>
    <template #filter>
      <div class="record-controls">
        <SegmentedControl model-value="/bible/bookmarks" :options="recordSegments" aria-label="내 기록 종류" @update:model-value="router.push(String($event))" />
        <input v-if="showSearch" id="bookmarks-search" v-model="searchQuery" class="search-input" type="search" aria-label="북마크 검색" placeholder="북마크 검색" />
        <div class="filter-bar">
          <select v-model="filterBook" class="filter-select" aria-label="성경 필터">
            <option value="">전체 성경</option>
            <optgroup label="구약"><option v-for="book in BIBLE_BOOKS.old" :key="book.id" :value="book.id">{{ book.name }}</option></optgroup>
            <optgroup label="신약"><option v-for="book in BIBLE_BOOKS.new" :key="book.id" :value="book.id">{{ book.name }}</option></optgroup>
          </select>
          <select v-model="sortOrder" class="filter-select" aria-label="정렬"><option value="recent">최근순</option><option value="oldest">오래된순</option></select>
        </div>
      </div>
    </template>
    <template #skeleton><SkeletonList :count="6" variant="bookmark" /></template>

    <ul class="bookmark-list">
      <li v-for="(bookmark, index) in filteredBookmarks" :key="bookmark.id" class="bookmark-item" :style="{ '--record-delay': `${80 + index * 50}ms` }">
        <button type="button" class="bookmark-link" @click="goToBookmark(bookmark)">
          <span class="bookmark-header">
            <span class="bookmark-location">
              <span class="bookmark-color" :style="{ background: bookmark.color || 'var(--color-accent-primary)' }" aria-hidden="true" />
              {{ bookmark.book_name || bookmark.book }} {{ formatLocation(bookmark) }}
            </span>
            <time class="bookmark-date" :datetime="bookmark.created_at">{{ formatRelativeDate(bookmark.created_at) }}</time>
          </span>
          <span v-if="bookmark.title" class="bookmark-title">{{ bookmark.title }}</span>
          <span v-if="bookmark.memo" class="bookmark-memo">{{ bookmark.memo }}</span>
        </button>
        <button type="button" class="icon-btn delete-btn" @click="handleDelete(bookmark)" aria-label="북마크 삭제" title="삭제"><Trash2 :size="18" aria-hidden="true" /></button>
      </li>
    </ul>
    <Toast />
  </BibleSubpageLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Bookmark as BookmarkIcon, Search, Trash2 } from '@lucide/vue';
import { useBookmark, type Bookmark } from '~/composables/useBookmark';
import { BIBLE_BOOKS } from '~/composables/useBibleData';
import { useAuthService } from '~/composables/useAuthService';
import { useErrorHandler } from '~/composables/useErrorHandler';
import { useModal } from '~/composables/useModal';
import { useApi } from '~/composables/useApi';
import Toast from '~/components/Toast.vue';
import BibleSubpageLayout from '~/components/bible/BibleSubpageLayout.vue';
import SegmentedControl from '~/components/ui/SegmentedControl.vue';
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue';

definePageMeta({ layout: 'default' });
const router = useRouter();
const authStore = useAuthService();
const { handleApiError } = useErrorHandler();
const modal = useModal();
const api = useApi();
const { getAllBookmarks } = useBookmark();
const { formatRelativeDate } = useDateFormat();
const recordSegments = [
  { value: '/bible/notes', label: '묵상노트' },
  { value: '/bible/highlights', label: '하이라이트' },
  { value: '/bible/bookmarks', label: '북마크' },
];
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

onMounted(async () => {
  if (authStore.isAuthenticated.value) {
    try {
      bookmarks.value = await getAllBookmarks();
    } catch (error) {
      handleApiError(error, '북마크 로드');
    }
  }
  isLoading.value = false;
});

const formatLocation = (bookmark: Bookmark): string => {
  if (bookmark.bookmark_type === 'verse' && bookmark.start_verse) {
    if (bookmark.end_verse && bookmark.start_verse !== bookmark.end_verse) return `${bookmark.chapter}:${bookmark.start_verse}-${bookmark.end_verse}`;
    return `${bookmark.chapter}:${bookmark.start_verse}`;
  }
  return `${bookmark.chapter}장`;
};

const goToBookmark = (bookmark: Bookmark) => {
  const query: Record<string, string> = { book: bookmark.book, chapter: String(bookmark.chapter) };
  if (bookmark.bookmark_type === 'verse' && bookmark.start_verse) query.verse = String(bookmark.start_verse);
  router.push({ path: '/bible', query });
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
.record-controls { display: grid; gap: 14px; padding: 14px 20px; }
.filter-bar { display: flex; gap: 8px; }
.filter-select, .search-input { min-height: 44px; min-width: 0; padding: 8px 14px; border: 1px solid var(--color-border-default); border-radius: var(--radius-pill); font-size: 13px; font-weight: 600; color: var(--color-text-secondary); background: var(--color-bg-card); }
.filter-select { max-width: 65%; cursor: pointer; }
.search-input { width: 100%; box-sizing: border-box; }
.search-input::placeholder { color: var(--color-text-tertiary); }
.icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border: 1px solid transparent; border-radius: var(--radius-pill); background: transparent; color: var(--color-text-secondary); cursor: pointer; transition: background-color var(--duration-micro) ease, transform var(--duration-micro) ease; }
.icon-btn:hover, .filter-select:hover { background: var(--color-bg-hover); }
.bookmark-list { display: grid; gap: 10px; list-style: none; padding: 0 20px 96px; margin: 0; }
.bookmark-item { position: relative; border: 1px solid var(--color-border-default); border-radius: var(--radius-card); background: var(--color-bg-card); box-shadow: var(--shadow-card); animation: record-enter var(--duration-enter) var(--ease-out-quint) both; animation-delay: var(--record-delay); transition: transform var(--duration-micro) ease, box-shadow var(--duration-micro) ease; }
.bookmark-link { display: block; width: 100%; min-height: 76px; padding: 16px 18px; padding-right: 52px; border: none; border-radius: inherit; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.bookmark-item:hover { transform: translateY(-2px); box-shadow: var(--shadow-card-hover); }
.bookmark-header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; }
.bookmark-location { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: var(--color-accent-primary); }
.bookmark-color { display: inline-block; flex: 0 0 4px; width: 4px; height: 12px; border-radius: var(--radius-pill); }
.bookmark-date { flex-shrink: 0; font-size: 11px; color: var(--color-text-tertiary); }
.bookmark-title { display: block; margin-top: 8px; font-size: 14px; font-weight: 500; color: var(--color-text-primary); line-height: 1.6; overflow-wrap: anywhere; }
.bookmark-memo { display: block; margin-top: 8px; font-size: 13px; color: var(--color-text-secondary); line-height: 1.55; overflow-wrap: anywhere; }
.delete-btn { position: absolute; top: 5px; right: 4px; color: var(--color-text-tertiary); }
.delete-btn:hover { background: var(--color-error-bg); color: var(--color-error); }
.icon-btn:focus-visible, .filter-select:focus-visible, .search-input:focus-visible, .bookmark-link:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; border-color: var(--color-accent-primary); }
.icon-btn:active, .bookmark-link:active { transform: scale(.97); }
@keyframes record-enter { from { opacity: 0; translate: 0 10px; } to { opacity: 1; translate: 0 0; } }
@media (prefers-reduced-motion: reduce) {
  .bookmark-item { animation-name: record-fade; }
  .bookmark-item, .icon-btn { transition: none; }
  .bookmark-item:hover, .icon-btn:active, .bookmark-link:active { transform: none; }
  @keyframes record-fade { from { opacity: 0; } to { opacity: 1; } }
}
</style>
