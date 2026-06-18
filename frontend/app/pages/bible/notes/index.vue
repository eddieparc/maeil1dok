<template>
  <div class="bible-page notes-page">
    <PageHeader title="묵상노트" fallback-path="/bible" />

    <!-- 필터 -->
    <div class="filter-bar">
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
    </div>

    <!-- 로딩 -->
    <template v-if="isLoading">
      <SkeletonList :count="5" variant="note" />
    </template>

    <!-- 로그인 필요 -->
    <EmptyState
      v-else-if="!auth.isAuthenticated.value"
      text="로그인 후 묵상노트를 확인할 수 있습니다"
      fullscreen
    >
      <template #icon>
        <DocumentIcon :size="48" />
      </template>
      <template #action>
        <NuxtLink to="/login" class="bible-login-btn">로그인</NuxtLink>
      </template>
    </EmptyState>

    <!-- 빈 상태 -->
    <EmptyState
      v-else-if="filteredNotes.length === 0"
      :text="filterBook ? '해당 책에 작성된 묵상노트가 없습니다' : '작성된 묵상노트가 없습니다'"
      hint="말씀을 읽고 묵상을 기록해보세요"
      :guide="!filterBook ? ['성경 읽기 화면으로 이동하세요', '상단 메뉴(⋮)를 탭하세요', '묵상노트 버튼을 선택하세요'] : undefined"
      fullscreen
    >
      <template #icon>
        <DocumentIcon :size="48" />
      </template>
    </EmptyState>

    <!-- 노트 목록 -->
    <ul v-else class="note-list">
      <li
        v-for="note in filteredNotes"
        :key="note.id"
        class="note-item"
        @click="goToNote(note.id)"
      >
        <div class="note-header">
          <span class="note-location">
            {{ note.book_name || getBookName(note.book) }} {{ note.chapter }}장
          </span>
          <span class="note-date">{{ formatRelativeDate(note.updated_at) }}</span>
        </div>
        <p class="note-preview">{{ truncate(note.content, 120) }}</p>
        <div class="note-meta">
          <span v-if="note.is_private" class="private-badge">
            <LockIcon :size="12" />
            비공개
          </span>
        </div>
      </li>
    </ul>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useNote } from '~/composables/useNote';
import { useBibleData, BIBLE_BOOKS } from '~/composables/useBibleData';
import { useAuthService } from '~/composables/useAuthService';
import { useTextUtils } from '~/composables/useTextUtils';
import Toast from '~/components/Toast.vue';
import SkeletonList from '~/components/ui/skeleton/SkeletonList.vue';
import type { Note } from '~/types/bible';

definePageMeta({
  layout: 'default'
});

const router = useRouter();
const auth = useAuthService();
const { notes, isNoteLoading: isLoading, fetchNotes } = useNote();
const { getBookName } = useBibleData();
const { truncate } = useTextUtils();

const filterBook = ref('');

onMounted(async () => {
  if (auth.isAuthenticated.value) {
    await fetchNotes();
  }
});

const filteredNotes = computed(() => {
  if (!filterBook.value) return notes.value;
  return notes.value.filter(n => n.book === filterBook.value);
});

const goToNote = (id: number) => {
  router.push(`/bible/notes/${id}`);
};

const { formatRelativeDate } = useDateFormat();
</script>

<style scoped>
/*
 * Notes List Page specific styles
 * 공통 스타일은 bible-page.css에서 관리됨
 */

/* 필터 */
.filter-bar {
  padding: 0.75rem 1rem;
  background: var(--color-bg-card, #fff);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.filter-select {
  width: 100%;
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
  border-color: var(--primary-color, #6366f1);
}

/* 노트 목록 */
.note-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.note-item {
  padding: 1rem;
  background: var(--color-bg-card, #fff);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  cursor: pointer;
  transition: background 0.2s;
}

.note-item:hover {
  background: var(--color-bg-hover, #f9fafb);
}

.note-item:last-child {
  border-bottom: none;
}

.note-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.note-location {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--primary-color, #6366f1);
}

.note-date {
  font-size: 0.75rem;
  color: var(--text-muted, #9ca3af);
}

.note-preview {
  font-size: 0.875rem;
  color: var(--text-primary, #1f2937);
  line-height: 1.5;
  margin: 0 0 0.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.note-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.private-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--text-muted, #9ca3af);
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

:root.dark .note-item {
  background: var(--color-bg-card);
  border-color: var(--color-border);
}

:root.dark .note-item:hover {
  background: var(--color-bg-hover);
}
</style>
