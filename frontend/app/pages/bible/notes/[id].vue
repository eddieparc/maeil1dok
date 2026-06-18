<template>
  <div class="bible-page note-detail-page">
    <header class="bible-page-header">
      <button class="bible-back-btn" @click="handleBack">
        <ChevronLeftIcon :size="20" />
      </button>
      <h1>묵상노트</h1>
      <button v-if="note" class="bible-header-btn danger" @click="handleDelete" title="삭제">
        <TrashIcon :size="20" />
      </button>
    </header>

    <!-- 로딩 -->
    <template v-if="isLoading">
      <SkeletonCard>
        <template #body>
          <SkeletonText :lines="12" lastLineWidth="60%" />
        </template>
      </SkeletonCard>
    </template>

    <!-- 노트 없음 -->
    <EmptyState v-else-if="!note" text="묵상노트를 찾을 수 없습니다">
      <template #action>
        <NuxtLink to="/bible/notes" class="back-link">목록으로 돌아가기</NuxtLink>
      </template>
    </EmptyState>

    <!-- 에디터 -->
    <div v-else class="note-editor">
      <div class="note-location" @click="goToBible">
        <BookIcon :size="16" />
        <span>{{ note.book_name || getBookName(note.book) }} {{ note.chapter }}장</span>
        <ChevronRightIcon :size="14" />
      </div>

      <textarea
        ref="textareaRef"
        v-model="editContent"
        placeholder="묵상 내용을 적어보세요..."
        class="content-editor"
      />

      <div class="note-options">
        <label class="private-toggle">
          <input type="checkbox" v-model="isPrivate" />
          <span class="toggle-slider"></span>
          <span class="toggle-label">비공개</span>
        </label>
        <span class="last-updated">{{ formatDate(note.updated_at) }} 수정됨</span>
      </div>

      <div class="action-bar">
        <button
          class="save-btn"
          @click="handleSave"
          :disabled="!hasChanges || isSaving"
        >
          <span v-if="isSaving" class="loading-spinner-small"></span>
          <span v-else>{{ hasChanges ? '저장' : '저장됨' }}</span>
        </button>
      </div>
    </div>

    <Toast />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useNote } from '~/composables/useNote';
import { useBibleData } from '~/composables/useBibleData';
import { useErrorHandler } from '~/composables/useErrorHandler';
import { useModal } from '~/composables/useModal';
import { TIMING, TOGGLE_SIZE } from '~/constants/bible';
import Toast from '~/components/Toast.vue';
import SkeletonCard from '~/components/ui/skeleton/SkeletonCard.vue';
import SkeletonText from '~/components/ui/skeleton/SkeletonText.vue';

definePageMeta({
  layout: 'default'
});

const route = useRoute();
const router = useRouter();
const { handleApiError } = useErrorHandler();
const modal = useModal();
const { currentNote: note, isNoteLoading: isLoading, fetchNote, updateNote, deleteNote } = useNote();
const { getBookName } = useBibleData();

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const editContent = ref('');
const isPrivate = ref(true);
const isSaving = ref(false);
const originalContent = ref('');
const originalPrivate = ref(true);

const noteId = computed(() => parseInt(route.params.id as string));

onMounted(async () => {
  const loaded = await fetchNote(noteId.value);
  if (loaded) {
    editContent.value = loaded.content;
    isPrivate.value = loaded.is_private;
    originalContent.value = loaded.content;
    originalPrivate.value = loaded.is_private;
  }
});

const hasChanges = computed(() => {
  return editContent.value !== originalContent.value ||
         isPrivate.value !== originalPrivate.value;
});

const handleSave = async () => {
  if (!hasChanges.value) return;

  isSaving.value = true;
  try {
    await updateNote(noteId.value, {
      content: editContent.value,
      is_private: isPrivate.value
    });
    originalContent.value = editContent.value;
    originalPrivate.value = isPrivate.value;
  } catch (error) {
    handleApiError(error, '묵상노트 저장');
  } finally {
    isSaving.value = false;
  }
};

const handleDelete = async () => {
  const confirmed = await modal.confirm({
    title: '묵상노트 삭제',
    description: '묵상노트를 삭제하시겠습니까?',
    confirmText: '삭제',
    cancelText: '취소',
    confirmVariant: 'danger',
    icon: 'warning'
  });
  if (!confirmed) return;

  try {
    await deleteNote(noteId.value);
    router.push('/bible/notes');
  } catch (error) {
    handleApiError(error, '묵상노트 삭제');
  }
};

const handleBack = async () => {
  if (hasChanges.value) {
    const confirmed = await modal.confirm({
      title: '변경사항 저장 안 됨',
      description: '저장하지 않은 변경사항이 있습니다. 나가시겠습니까?',
      confirmText: '나가기',
      cancelText: '취소',
      confirmVariant: 'danger',
      icon: 'warning'
    });
    if (confirmed) {
      router.back();
    }
  } else {
    router.back();
  }
};

const goToBible = () => {
  if (note.value) {
    router.push({
      path: '/bible',
      query: {
        book: note.value.book,
        chapter: String(note.value.chapter)
      }
    });
  }
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// 자동 저장 (디바운스)
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
watch([editContent, isPrivate], () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  if (hasChanges.value && !isSaving.value) {
    saveTimeout = setTimeout(async () => {
      await handleSave();
    }, TIMING.AUTO_SAVE_DEBOUNCE);
  }
});
</script>

<style scoped>
/*
 * Note Detail Page specific styles
 * 공통 스타일은 bible-page.css에서 관리됨
 */

.note-detail-page {
  display: flex;
  flex-direction: column;
}

/* 로딩/빈 상태가 flex: 1을 차지하도록 */
.note-detail-page :deep(.loading-spinner-container),
.note-detail-page :deep(.empty-state-container) {
  flex: 1;
  min-height: auto;
}

.back-link {
  margin-top: 1rem;
  color: var(--primary-color, #6366f1);
  font-size: 0.875rem;
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}

/* 에디터 */
.note-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 1rem;
}

.note-location {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--color-bg-card, #fff);
  border-radius: 8px;
  margin-bottom: 1rem;
  color: var(--primary-color, #6366f1);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.note-location:hover {
  background: var(--color-bg-hover, #f3f4f6);
}

.note-location svg:last-child {
  margin-left: auto;
  opacity: 0.5;
}

.content-editor {
  flex: 1;
  width: 100%;
  min-height: 300px;
  padding: 1rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  font-size: 1rem;
  color: var(--text-primary, #1f2937);
  background: var(--color-bg-card, #fff);
  resize: none;
  font-family: inherit;
  line-height: 1.75;
}

.content-editor:focus {
  outline: none;
  border-color: var(--primary-color, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.note-options {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 1rem;
  padding: 0 0.25rem;
}

.private-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.private-toggle input {
  display: none;
}

.toggle-slider {
  width: 48px;
  height: 28px;
  background: var(--color-border, #e5e7eb);
  border-radius: 14px;
  position: relative;
  transition: background 0.2s;
}

.toggle-slider::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.private-toggle input:checked + .toggle-slider {
  background: var(--primary-color, #6366f1);
}

.private-toggle input:checked + .toggle-slider::after {
  transform: translateX(20px);
}

.toggle-label {
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
}

.last-updated {
  font-size: 0.75rem;
  color: var(--text-muted, #9ca3af);
}

.action-bar {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
}

.save-btn {
  padding: 0.75rem 1.5rem;
  background: var(--primary-color, #6366f1);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 100px;
  justify-content: center;
}

.save-btn:hover:not(:disabled) {
  background: var(--primary-dark, #4f46e5);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* 다크모드 */
:root.dark .note-location {
  background: var(--color-bg-card);
}

:root.dark .note-location:hover {
  background: var(--color-bg-hover);
}

:root.dark .content-editor {
  background: var(--color-bg-card);
  border-color: var(--color-border);
  color: var(--text-primary);
}

:root.dark .toggle-slider {
  background: var(--color-border);
}
</style>
