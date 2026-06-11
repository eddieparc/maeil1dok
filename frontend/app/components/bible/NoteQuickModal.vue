<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-overlay" @click.self="close" @keydown.esc="close">
        <div ref="modalRef" class="modal-content" role="dialog" aria-modal="true" aria-labelledby="note-quick-modal-title">
          <h2 class="modal-title" id="note-quick-modal-title">빠른 메모</h2>

          <div class="note-location">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>{{ bookName }} {{ chapter }}{{ book === 'psa' ? '편' : '장' }}</span>
          </div>

          <div class="form-group">
            <textarea
              ref="textareaRef"
              v-model="content"
              placeholder="묵상 내용을 적어보세요..."
              rows="4"
              maxlength="2000"
            />
            <span class="char-count">{{ content.length }}/2000</span>
          </div>

          <div class="modal-footer">
            <button v-if="existingNote" class="btn-detail" @click="goToDetail">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h6v6M14 10l6.1-6.1M9 21H3v-6M10 14l-6.1 6.1" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              상세 편집
            </button>

            <div class="modal-actions">
              <button type="button" class="btn-cancel" @click="close">취소</button>
              <button
                type="button"
                class="btn-confirm"
                :disabled="!content.trim() || isSaving"
                @click="save"
              >
                <span v-if="isSaving" class="loading-spinner"></span>
                <span v-else>저장</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { useFocusTrap } from '~/composables/useFocusTrap';
import type { Note } from '~/composables/useNote';

const props = defineProps<{
  modelValue: boolean;
  book: string;
  bookName: string;
  chapter: number;
  existingNote?: Note | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  save: [content: string];
  'go-detail': [noteId?: number, content?: string];
}>();

const content = ref('');
const isSaving = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const modalRef = ref<HTMLElement | null>(null);
const isModalOpen = computed(() => props.modelValue);
// autoFocus는 끔: 아래 watch에서 textarea로 직접 포커스를 옮기기 때문
useFocusTrap(modalRef, { enabled: isModalOpen, autoFocus: false });

// 기존 노트가 있으면 로드
watch(() => props.existingNote, (val) => {
  if (val) {
    content.value = val.content || '';
  }
}, { immediate: true });

// 모달 열릴 때 포커스 및 초기화
watch(() => props.modelValue, async (val) => {
  if (val) {
    if (!props.existingNote) {
      content.value = '';
    }
    await nextTick();
    textareaRef.value?.focus();
  }
});

const close = () => {
  emit('update:modelValue', false);
  content.value = '';
};

const save = async () => {
  if (!content.value.trim()) return;

  isSaving.value = true;
  try {
    emit('save', content.value);
    close();
  } finally {
    isSaving.value = false;
  }
};

const goToDetail = () => {
  emit('go-detail', props.existingNote?.id, content.value);
  close();
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 1000;
}

.modal-content {
  width: 100%;
  max-width: 400px;
  background: var(--color-bg-card, #fff);
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
  margin: 0 0 1rem;
  text-align: center;
}

.note-location {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--color-bg-primary, #f9fafb);
  border-radius: 8px;
  margin-bottom: 1.25rem;
  color: var(--primary-color, #6366f1);
  font-size: 0.9375rem;
  font-weight: 500;
}

.form-group {
  position: relative;
  margin-bottom: 1rem;
}

.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  font-size: 0.9375rem;
  color: var(--text-primary, #1f2937);
  background: var(--color-bg-card, #fff);
  resize: vertical;
  min-height: 120px;
  transition: border-color 0.2s, box-shadow 0.2s;
  font-family: inherit;
  line-height: 1.6;
}

.form-group textarea:focus {
  outline: none;
  border-color: var(--primary-color, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.char-count {
  position: absolute;
  bottom: 0.5rem;
  right: 0.75rem;
  font-size: 0.75rem;
  color: var(--text-muted, #9ca3af);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.btn-detail {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-detail:hover {
  background: var(--color-bg-hover, #f3f4f6);
  color: var(--text-primary, #1f2937);
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  margin-left: auto;
}

.btn-cancel,
.btn-confirm {
  padding: 0.625rem 1rem;
  border-radius: 10px;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: var(--color-bg-secondary, #f3f4f6);
  color: var(--text-primary, #1f2937);
  border: none;
}

.btn-cancel:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.btn-confirm {
  background: var(--primary-color, #6366f1);
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-width: 80px;
}

.btn-confirm:hover:not(:disabled) {
  background: var(--primary-dark, #4f46e5);
}

.btn-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 트랜지션 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-active .modal-content,
.modal-fade-leave-active .modal-content {
  transition: transform 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .modal-content,
.modal-fade-leave-to .modal-content {
  transform: scale(0.95);
}

/* 다크모드 */
:root.dark .modal-content {
  background: var(--color-bg-card);
}

:root.dark .note-location {
  background: var(--color-bg-secondary);
}

:root.dark .form-group textarea {
  background: var(--color-bg-secondary);
  border-color: var(--color-border);
  color: var(--text-primary);
}

:root.dark .btn-detail {
  border-color: var(--color-border);
}

:root.dark .btn-detail:hover {
  background: var(--color-bg-hover);
}
</style>
