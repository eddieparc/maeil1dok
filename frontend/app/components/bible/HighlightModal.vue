<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-overlay" @click.self="close" @keydown.esc="close">
        <div ref="modalRef" class="modal-content" role="dialog" aria-modal="true" aria-labelledby="highlight-modal-title">
          <h2 class="modal-title" id="highlight-modal-title">하이라이트</h2>

          <div class="verse-info">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>{{ bookName }} {{ chapter }}{{ book === 'psa' ? '편' : '장' }} {{ startVerse }}<template v-if="endVerse !== startVerse">-{{ endVerse }}</template>절</span>
          </div>

          <div class="color-section">
            <label class="section-label">색상 선택</label>
            <HighlightPalette
              v-model="selectedColor"
              :custom-colors="customColors"
              @add-custom="handleAddCustomColor"
            />
          </div>

          <div class="memo-section">
            <label class="section-label">메모 (선택)</label>
            <textarea
              v-model="memo"
              placeholder="하이라이트에 메모를 추가하세요..."
              rows="2"
              maxlength="500"
            />
          </div>

          <div class="modal-footer">
            <button v-if="existingHighlight" class="btn-delete" @click="handleDelete">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              삭제
            </button>
            <div class="modal-actions">
              <button type="button" class="btn-cancel" @click="close">취소</button>
              <button
                type="button"
                class="btn-confirm"
                :disabled="!selectedColor || isSaving"
                @click="save"
              >
                <span v-if="isSaving" class="loading-spinner"></span>
                <span v-else>{{ existingHighlight ? '수정' : '저장' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useFocusTrap } from '~/composables/useFocusTrap';
import HighlightPalette from './HighlightPalette.vue';
import type { Highlight } from '~/composables/useHighlight';

const props = defineProps<{
  modelValue: boolean;
  book: string;
  bookName: string;
  chapter: number;
  startVerse: number;
  endVerse: number;
  existingHighlight?: Highlight | null;
  customColors: string[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  save: [data: { color: string; memo: string }];
  delete: [highlightId: number];
  'add-custom-color': [color: string];
}>();

const modalRef = ref<HTMLElement | null>(null);
const isModalOpen = computed(() => props.modelValue);
useFocusTrap(modalRef, { enabled: isModalOpen });

const selectedColor = ref('#FEF3C7');
const memo = ref('');
const isSaving = ref(false);

// 기존 하이라이트 있으면 로드
watch(() => props.existingHighlight, (val) => {
  if (val) {
    selectedColor.value = val.color;
    memo.value = val.memo || '';
  } else {
    selectedColor.value = '#FEF3C7';
    memo.value = '';
  }
}, { immediate: true });

// 모달 열릴 때 초기화
watch(() => props.modelValue, (val) => {
  if (val && !props.existingHighlight) {
    selectedColor.value = '#FEF3C7';
    memo.value = '';
  }
});

const close = () => {
  emit('update:modelValue', false);
};

const save = async () => {
  if (!selectedColor.value) return;

  isSaving.value = true;
  try {
    emit('save', {
      color: selectedColor.value,
      memo: memo.value
    });
    close();
  } finally {
    isSaving.value = false;
  }
};

const handleDelete = () => {
  if (props.existingHighlight && confirm('하이라이트를 삭제하시겠습니까?')) {
    emit('delete', props.existingHighlight.id);
    close();
  }
};

const handleAddCustomColor = (color: string) => {
  emit('add-custom-color', color);
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
  max-width: 360px;
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

.verse-info {
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

.section-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 0.5rem;
}

.color-section {
  margin-bottom: 1rem;
}

.memo-section {
  margin-bottom: 1rem;
}

.memo-section textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--text-primary, #1f2937);
  background: var(--color-bg-card, #fff);
  resize: none;
  font-family: inherit;
  line-height: 1.5;
}

.memo-section textarea:focus {
  outline: none;
  border-color: var(--primary-color, #6366f1);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.btn-delete {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: 1px solid var(--color-error, #ef4444);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--color-error, #ef4444);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-delete:hover {
  background: var(--color-error-light, #fef2f2);
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

:root.dark .verse-info {
  background: var(--color-bg-secondary);
}

:root.dark .memo-section textarea {
  background: var(--color-bg-secondary);
  border-color: var(--color-border);
  color: var(--text-primary);
}

:root.dark .btn-delete {
  border-color: var(--color-error);
  color: var(--color-error);
}

:root.dark .btn-delete:hover {
  background: rgba(239, 68, 68, 0.15);
}
</style>
