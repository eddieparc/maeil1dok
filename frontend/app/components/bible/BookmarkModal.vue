<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-overlay" @click.self="close" @keydown.esc="close">
        <div ref="modalRef" class="modal-content" role="dialog" aria-modal="true" aria-labelledby="bookmark-modal-title">
          <h2 class="modal-title" id="bookmark-modal-title">
            {{ isEdit ? '북마크 수정' : '북마크 추가' }}
          </h2>

          <div class="bookmark-location">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>{{ locationText }}</span>
          </div>

          <div class="form-group">
            <label>제목 (선택)</label>
            <input
              type="text"
              v-model="form.title"
              placeholder="북마크 제목을 입력하세요"
              maxlength="100"
            />
          </div>

          <div class="form-group">
            <label>색상</label>
            <div class="color-picker">
              <button
                v-for="color in colors"
                :key="color"
                type="button"
                class="color-btn"
                :class="{ active: form.color === color }"
                :style="{ background: color }"
                @click="form.color = color"
              />
            </div>
          </div>

          <div class="form-group">
            <label>메모 (선택)</label>
            <textarea
              v-model="form.memo"
              placeholder="메모를 입력하세요"
              rows="3"
              maxlength="500"
            />
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-cancel" @click="close">취소</button>
            <button
              type="button"
              class="btn-confirm"
              :disabled="isSaving"
              @click="save"
            >
              <span v-if="isSaving" class="loading-spinner"></span>
              <span v-else>저장</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { useFocusTrap } from '~/composables/useFocusTrap';
import type { Bookmark } from '~/composables/useBookmark';

const props = defineProps<{
  modelValue: boolean;
  bookmark?: Bookmark | null;
  book: string;
  bookName: string;
  chapter: number;
  startVerse?: number;
  endVerse?: number;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  save: [data: { title: string; color: string; memo: string }];
}>();

const modalRef = ref<HTMLElement | null>(null);
const isModalOpen = computed(() => props.modelValue);
useFocusTrap(modalRef, { enabled: isModalOpen });

const isEdit = computed(() => !!props.bookmark);

const locationText = computed(() => {
  if (props.startVerse && props.endVerse) {
    if (props.startVerse === props.endVerse) {
      return `${props.bookName} ${props.chapter}:${props.startVerse}`;
    }
    return `${props.bookName} ${props.chapter}:${props.startVerse}-${props.endVerse}`;
  }
  return `${props.bookName} ${props.chapter}${props.book === 'psa' ? '편' : '장'}`;
});

const colors = [
  '#3B82F6', // blue (기본)
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // purple
];

const form = reactive({
  title: '',
  color: '#3B82F6',
  memo: ''
});

const isSaving = ref(false);

// 모달 열릴 때 기존 값 로드
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    if (props.bookmark) {
      form.title = props.bookmark.title || '';
      form.color = props.bookmark.color || '#3B82F6';
      form.memo = props.bookmark.memo || '';
    } else {
      // 기본값으로 초기화
      form.title = '';
      form.color = '#3B82F6';
      form.memo = '';
    }
  }
});

const close = () => emit('update:modelValue', false);

const save = async () => {
  isSaving.value = true;
  try {
    emit('save', { ...form });
    close();
  } finally {
    isSaving.value = false;
  }
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

.bookmark-location {
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
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 0.375rem;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  font-size: 0.9375rem;
  color: var(--text-primary, #1f2937);
  background: var(--color-bg-card, #fff);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--primary-color, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.form-group textarea {
  resize: vertical;
  min-height: 80px;
}

.color-picker {
  display: flex;
  gap: 0.5rem;
}

.color-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.color-btn:hover {
  transform: scale(1.1);
}

.color-btn.active {
  border-color: var(--text-primary, #1f2937);
  box-shadow: 0 0 0 2px var(--color-bg-card, #fff);
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  padding: 0.75rem 1rem;
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

:root.dark .bookmark-location {
  background: var(--color-bg-secondary);
}

:root.dark .form-group input,
:root.dark .form-group textarea {
  background: var(--color-bg-secondary);
  border-color: var(--color-border);
  color: var(--text-primary);
}

:root.dark .color-btn.active {
  border-color: var(--text-primary);
  box-shadow: 0 0 0 2px var(--color-bg-card);
}
</style>
