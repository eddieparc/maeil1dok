<template>
  <BibleSubpageLayout title="내 기록" class="records-page">
    <template #actions>
      <button type="button" class="icon-btn" aria-label="기록 검색" :aria-expanded="showSearch" aria-controls="notes-search" @click="showSearch = !showSearch"><Search :size="20" aria-hidden="true" /></button>
    </template>
    <template #filter>
      <div class="record-controls">
        <SegmentedControl model-value="/bible/notes" :options="recordSegments" aria-label="내 기록 종류" @update:model-value="router.push(String($event))" />
        <input v-if="showSearch" id="notes-search" v-model="searchQuery" class="search-input" type="search" aria-label="묵상노트 검색" placeholder="묵상노트 검색" />
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

    <template v-if="isLoading"><SkeletonList :count="5" variant="note" /></template>
    <EmptyState v-else-if="!auth.isAuthenticated.value" text="로그인 후 묵상노트를 확인할 수 있습니다" fullscreen>
      <template #icon><FileText :size="48" /></template>
      <template #action><NuxtLink to="/login" class="bible-login-btn">로그인</NuxtLink></template>
    </EmptyState>
    <EmptyState
      v-else-if="filteredNotes.length === 0"
      :text="filterBook || searchQuery ? '해당 조건의 묵상노트가 없습니다' : '작성된 묵상노트가 없습니다'"
      hint="말씀을 읽고 묵상을 기록해보세요"
      :guide="!filterBook && !searchQuery ? ['성경 읽기 화면으로 이동하세요', '상단 메뉴를 탭하세요', '묵상노트 버튼을 선택하세요'] : undefined"
      fullscreen
    ><template #icon><FileText :size="48" /></template></EmptyState>

    <ul v-else class="note-list">
      <li v-for="(note, index) in filteredNotes" :key="note.id" class="note-item" :style="{ '--record-delay': `${80 + index * 50}ms` }">
        <NuxtLink :to="`/bible/notes/${note.id}`" class="note-link">
          <div class="note-header">
            <span class="note-location">{{ note.book_name || getBookName(note.book) }} {{ note.chapter }}장</span>
            <time class="note-date" :datetime="note.updated_at">{{ formatRelativeDate(note.updated_at) }}</time>
          </div>
          <p class="note-preview">{{ truncate(note.content, 120) }}</p>
          <span v-if="note.is_private" class="private-badge"><Lock :size="12" aria-hidden="true" />비공개</span>
        </NuxtLink>
      </li>
    </ul>
    <Toast />
  </BibleSubpageLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { FileText, Lock, Search } from '@lucide/vue';
import { useNote } from '~/composables/useNote';
import { useBibleData, BIBLE_BOOKS } from '~/composables/useBibleData';
import { useAuthService } from '~/composables/useAuthService';
import { useTextUtils } from '~/composables/useTextUtils';
import BibleSubpageLayout from '~/components/bible/BibleSubpageLayout.vue';
import SegmentedControl from '~/components/ui/SegmentedControl.vue';
import Toast from '~/components/Toast.vue';
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue';

definePageMeta({ layout: 'default' });
const router = useRouter();
const auth = useAuthService();
const { notes, isNoteLoading: isLoading, fetchNotes } = useNote();
const { getBookName } = useBibleData();
const { truncate } = useTextUtils();
const { formatRelativeDate } = useDateFormat();
const recordSegments = [
  { value: '/bible/notes', label: '묵상노트' },
  { value: '/bible/highlights', label: '하이라이트' },
  { value: '/bible/bookmarks', label: '북마크' },
];
const filterBook = ref('');
const sortOrder = ref('recent');
const showSearch = ref(false);
const searchQuery = ref('');

onMounted(async () => {
  if (auth.isAuthenticated.value) await fetchNotes();
});

const filteredNotes = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase();
  return notes.value.filter(note =>
    (!filterBook.value || note.book === filterBook.value) &&
    (!query || `${note.book_name || getBookName(note.book)} ${note.content}`.toLocaleLowerCase().includes(query))
  ).sort((a, b) => (sortOrder.value === 'recent' ? -1 : 1) * (Date.parse(a.updated_at) - Date.parse(b.updated_at)));
});
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
.note-list { display: grid; gap: 10px; list-style: none; padding: 0 20px 96px; margin: 0; }
.note-item { border: 1px solid var(--color-border-default); border-radius: var(--radius-card); background: var(--color-bg-card); box-shadow: var(--shadow-card); animation: record-enter var(--duration-enter) var(--ease-out-quint) both; animation-delay: var(--record-delay); transition: transform var(--duration-micro) ease, box-shadow var(--duration-micro) ease; }
.note-link { display: block; min-height: 44px; padding: 16px 18px; border-radius: inherit; color: inherit; text-decoration: none; }
.note-item:hover { transform: translateY(-2px); box-shadow: var(--shadow-card-hover); }
.note-header { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.note-location { font-size: 13px; font-weight: 700; color: var(--color-accent-primary); }
.note-date { flex-shrink: 0; font-size: 11px; color: var(--color-text-tertiary); }
.note-preview { margin: 0 0 8px; font-size: 13px; color: var(--color-text-secondary); line-height: 1.55; overflow-wrap: anywhere; }
.private-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: var(--color-text-tertiary); }
.icon-btn:focus-visible, .filter-select:focus-visible, .search-input:focus-visible, .note-link:focus-visible { outline: 3px solid var(--color-accent-focus-ring); outline-offset: 2px; border-color: var(--color-accent-primary); }
.icon-btn:active, .note-link:active { transform: scale(.97); }
@keyframes record-enter { from { opacity: 0; translate: 0 10px; } to { opacity: 1; translate: 0 0; } }
@media (prefers-reduced-motion: reduce) {
  .note-item { animation-name: record-fade; }
  .note-item, .icon-btn { transition: none; }
  .note-item:hover, .icon-btn:active, .note-link:active { transform: none; }
  @keyframes record-fade { from { opacity: 0; } to { opacity: 1; } }
}
</style>
