<template>
  <BibleSubpageLayout title="내 기록" class="records-page">
    <template #actions><BibleRecordControls v-model:show-search="showSearch" action-only search-id="notes-search" /></template>
    <template #filter>
      <BibleRecordControls v-model:show-search="showSearch" v-model:search-query="searchQuery" v-model:filter-book="filterBook" v-model:sort-order="sortOrder" active-route="/bible/notes" search-id="notes-search" search-label="묵상노트 검색" />
    </template>

    <SkeletonList v-if="auth.isLoading.value || isLoading" :count="5" variant="note" />
    <EmptyState v-else-if="!auth.isAuthenticated.value" text="로그인 후 묵상노트를 확인할 수 있습니다" fullscreen>
      <template #icon><FileText :size="48" /></template>
      <template #action><NuxtLink to="/login" class="bible-login-btn">로그인</NuxtLink></template>
    </EmptyState>
    <EmptyState v-else-if="noteListFailed" data-testid="notes-error" role="alert" text="묵상노트를 불러오지 못했습니다" action-text="다시 시도" fullscreen @action="fetchNotes">
      <template #icon><FileText :size="48" /></template>
    </EmptyState>
    <EmptyState
      v-else-if="filteredNotes.length === 0"
      :text="filterBook || searchQuery ? '해당 조건의 묵상노트가 없습니다' : '작성된 묵상노트가 없습니다'"
      :hint="filterBook || searchQuery ? '' : '말씀을 읽고 묵상을 기록해보세요'"
      fullscreen
    >
      <template #icon><FileText :size="48" /></template>
      <template #action>
        <button v-if="filterBook || searchQuery" type="button" class="bible-login-btn" @click="filterBook = ''; searchQuery = ''">필터 초기화</button>
        <NuxtLink v-else to="/bible" class="bible-login-btn">성경 읽기</NuxtLink>
      </template>
    </EmptyState>

    <ul v-else class="note-list">
      <BibleRecordRow v-for="(note, index) in filteredNotes" :key="note.id" :index="index" :to="`/bible/notes/${note.id}`">
        <template #location><span class="note-location">{{ note.book_name || getBookName(note.book) }} {{ note.chapter }}{{ getChapterUnit(note.book) }}</span></template>
        <template #date><time class="note-date" :datetime="note.updated_at">{{ formatRelativeDate(note.updated_at) }}</time></template>
        <template #body><p class="note-preview">{{ truncate(note.content, 120) }}</p></template>
        <template #badges><span v-if="note.is_private" class="private-badge"><Lock :size="12" aria-hidden="true" />비공개</span></template>
      </BibleRecordRow>
    </ul>
    <Toast />
  </BibleSubpageLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { FileText, Lock } from '@lucide/vue';
import { useNote } from '~/composables/useNote';
import { useBibleData } from '~/composables/useBibleData';
import { useAuthService } from '~/composables/useAuthService';
import { useTextUtils } from '~/composables/useTextUtils';
import BibleSubpageLayout from '~/components/bible/BibleSubpageLayout.vue';
import BibleRecordControls from '~/components/bible/BibleRecordControls.vue';
import BibleRecordRow from '~/components/bible/BibleRecordRow.vue';
import EmptyState from '~/components/common/EmptyState.vue';
import Toast from '~/components/Toast.vue';
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue';

definePageMeta({ layout: 'default' });
const auth = useAuthService();
const { notes, isNoteLoading: isLoading, noteListFailed, fetchNotes } = useNote();
const { getBookName, getChapterUnit } = useBibleData();
const { truncate } = useTextUtils();
const { formatRelativeDate } = useDateFormat();
const filterBook = ref('');
const sortOrder = ref('recent');
const showSearch = ref(false);
const searchQuery = ref('');
const mounted = ref(false);
onMounted(() => { mounted.value = true; });
watch(() => mounted.value && auth.isInitialized.value && !auth.isLoading.value
  ? auth.user.value?.id ?? null : undefined, (identity) => {
  if (identity !== undefined) void fetchNotes();
}, { immediate: true });

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
.note-list { display: grid; gap: 10px; list-style: none; padding: 0 20px 96px; margin: 0; }
.note-location { font-size: 13px; font-weight: 700; color: var(--color-accent-primary); }
.note-date { flex-shrink: 0; font-size: 11px; color: var(--color-text-tertiary); }
.note-preview { margin: 8px 0; font-size: 13px; color: var(--color-text-secondary); line-height: 1.55; overflow-wrap: anywhere; }
.private-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; color: var(--color-text-tertiary); }
</style>
