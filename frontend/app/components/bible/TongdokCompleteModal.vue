<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="modelValue" class="modal-overlay" @click.self="close">
        <div class="modal-content">
          <div class="modal-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>

          <h2 class="modal-title">오늘 분량을 다 읽으셨나요?</h2>

          <p class="modal-range">
            {{ scheduleRange }}
          </p>

          <label class="auto-complete-option">
            <input type="checkbox" v-model="autoCompleteChecked" />
            <span>다음부터 자동으로 완료 처리</span>
          </label>

          <p v-if="autoCompleteChecked" class="auto-complete-hint">
            설정 > 읽기 설정에서 변경할 수 있습니다
          </p>

          <div class="modal-actions">
            <button class="btn-cancel" @click="close">취소</button>
            <button class="btn-confirm" :disabled="isLoading" @click="confirm">
              <span v-if="isLoading" class="loading-spinner"></span>
              <span v-else>완료 처리</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  scheduleRange: string;
  initialAutoComplete?: boolean;
  isLoading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'confirm', payload: { autoComplete: boolean }): void;
}>();

const autoCompleteChecked = ref(props.initialAutoComplete ?? false);

// Props 변경 시 동기화
watch(() => props.initialAutoComplete, (newVal) => {
  if (newVal !== undefined) {
    autoCompleteChecked.value = newVal;
  }
});

const close = () => {
  emit('update:modelValue', false);
};

const confirm = () => {
  emit('confirm', { autoComplete: autoCompleteChecked.value });
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
  background: var(--color-bg-card, #fff);
  border-radius: 16px;
  padding: 1.5rem;
  width: 100%;
  max-width: 320px;
  text-align: center;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}

.modal-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
  color: var(--color-success, #2A1111);
}

.modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
  margin-bottom: 0.5rem;
}

.modal-range {
  font-size: 0.9375rem;
  color: var(--text-secondary, #6b7280);
  margin-bottom: 1.25rem;
}

.auto-complete-option {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  margin-bottom: 0.5rem;
}

.auto-complete-option input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--primary-color, #2A1111);
  cursor: pointer;
}

.auto-complete-hint {
  font-size: 0.75rem;
  color: var(--text-muted, #9ca3af);
  margin-bottom: 1rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.25rem;
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-size: 0.9375rem;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-cancel {
  background: var(--color-bg-tertiary, #f3f4f6);
  color: var(--text-secondary, #6b7280);
}

.btn-cancel:hover {
  background: var(--color-bg-hover, #e5e7eb);
}

.btn-confirm {
  background: var(--color-success, #2A1111);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-confirm:hover:not(:disabled) {
  background: var(--color-success-dark, #1F0C0C);
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

/* Transition */
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

/* Dark mode */
:root.dark .modal-content,
[data-theme="dark"] .modal-content {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-default);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

:root.dark .modal-overlay,
[data-theme="dark"] .modal-overlay {
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
}

:root.dark .modal-title {
  color: var(--color-text-primary);
}

:root.dark .modal-range {
  color: var(--color-text-secondary);
}

:root.dark .auto-complete-option {
  color: var(--color-text-secondary);
}

:root.dark .auto-complete-hint {
  color: var(--color-text-muted);
}

:root.dark .btn-cancel {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-default);
}

:root.dark .btn-cancel:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-color: var(--color-text-muted);
}

:root.dark .auto-complete-option input[type="checkbox"] {
  accent-color: var(--color-success);
}
</style>
