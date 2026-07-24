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

          <h2 class="modal-title">이미 완료한 구간입니다</h2>

          <p class="modal-range">
            {{ scheduleRange }}
          </p>

          <p class="modal-description">
            어떻게 하시겠어요?
          </p>

          <div class="modal-actions-vertical">
            <button class="action-btn primary" :disabled="isLoading" @click="handleReComplete">
              <span v-if="isLoading" class="loading-spinner"></span>
              <span v-else>이 구간 완료 (다시 완료 처리)</span>
            </button>
            <button class="action-btn secondary" @click="handleGoNextChapter">
              완료 후 다음 장으로
            </button>
            <button class="action-btn ghost" @click="close">
              아무것도 하지 않기
            </button>
          </div>

          <label class="remember-option">
            <input type="checkbox" v-model="rememberChecked" />
            <span>이 선택을 기억하기</span>
          </label>

          <p v-if="rememberChecked" class="remember-hint">
            설정 > 읽기 설정에서 변경할 수 있습니다
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

export type AlreadyCompleteAction = 're-complete' | 'go-next' | 'cancel';

const props = defineProps<{
  modelValue: boolean;
  scheduleRange: string;
  isLoading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'action', payload: { action: AlreadyCompleteAction; remember: boolean }): void;
}>();

const rememberChecked = ref(false);

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    rememberChecked.value = false;
  }
});

const close = () => {
  emit('action', { action: 'cancel', remember: rememberChecked.value });
  emit('update:modelValue', false);
};

const handleReComplete = () => {
  emit('action', { action: 're-complete', remember: rememberChecked.value });
};

const handleGoNextChapter = () => {
  emit('action', { action: 'go-next', remember: rememberChecked.value });
  emit('update:modelValue', false);
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
  max-width: 340px;
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
  margin-bottom: 0.5rem;
}

.modal-description {
  font-size: 0.875rem;
  color: var(--text-muted, #9ca3af);
  margin-bottom: 1.25rem;
}

.modal-actions-vertical {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.action-btn {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-size: 0.9375rem;
  font-weight: 500;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.action-btn.primary {
  background: var(--color-success, #2A1111);
  color: white;
  border: none;
}

.action-btn.primary:hover:not(:disabled) {
  background: var(--color-success-dark, #1F0C0C);
}

.action-btn.primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn.secondary {
  background: var(--color-bg-tertiary, #f3f4f6);
  color: var(--text-primary, #1f2937);
  border: 1px solid var(--color-border, #e5e7eb);
}

.action-btn.secondary:hover {
  background: var(--color-bg-hover, #e5e7eb);
}

.action-btn.ghost {
  background: transparent;
  color: var(--text-secondary, #6b7280);
  border: none;
}

.action-btn.ghost:hover {
  background: var(--color-bg-tertiary, #f3f4f6);
  color: var(--text-primary, #1f2937);
}

.remember-option {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  margin-bottom: 0.5rem;
}

.remember-option input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--primary-color, #2A1111);
  cursor: pointer;
}

.remember-hint {
  font-size: 0.75rem;
  color: var(--text-muted, #9ca3af);
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

:root.dark .modal-range,
:root.dark .modal-description {
  color: var(--color-text-secondary);
}

:root.dark .action-btn.secondary {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border-default);
  color: var(--color-text-primary);
}

:root.dark .action-btn.secondary:hover {
  background: var(--color-bg-hover);
}

:root.dark .action-btn.ghost {
  color: var(--color-text-secondary);
}

:root.dark .action-btn.ghost:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

:root.dark .remember-option {
  color: var(--color-text-secondary);
}

:root.dark .remember-hint {
  color: var(--color-text-muted);
}

:root.dark .remember-option input[type="checkbox"] {
  accent-color: var(--color-success);
}
</style>
