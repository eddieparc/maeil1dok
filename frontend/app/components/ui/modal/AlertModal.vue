<template>
  <div class="alert-modal">
    <!-- Icon -->
    <div v-if="icon" class="alert-icon" :class="`alert-icon-${icon}`">
      <TriangleAlertIcon v-if="icon === 'warning'" :size="24" />
      <CircleXIcon v-else-if="icon === 'error'" :size="24" />
      <InfoIcon v-else-if="icon === 'info'" :size="24" />
      <CircleCheckIcon v-else-if="icon === 'success'" :size="24" />
    </div>

    <!-- Title -->
    <h3 :id="`modal-title-${modalId}`" class="alert-title">
      {{ title }}
    </h3>

    <!-- Description -->
    <p
      v-if="description"
      :id="`modal-description-${modalId}`"
      class="alert-description"
    >
      {{ description }}
    </p>

    <button
      v-if="copyText"
      type="button"
      class="alert-copy-btn"
      @click="copyDetail"
    >
      {{ copyStatus === 'copied' ? '복사됨' : copyStatus === 'failed' ? '복사 실패' : '오류 ID 복사' }}
    </button>
    <span class="sr-only" aria-live="polite">
      {{ copyStatus === 'copied'
        ? '오류 ID가 복사되었습니다.'
        : copyStatus === 'failed'
          ? '오류 ID를 복사하지 못했습니다. 직접 선택해 주세요.'
          : '' }}
    </span>

    <!-- Action -->
    <div class="alert-actions">
      <button
        type="button"
        class="alert-btn"
        @click="handleConfirm"
      >
        {{ confirmText }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CircleCheckIcon, CircleXIcon, InfoIcon, TriangleAlertIcon } from '@lucide/vue'
import { ref } from 'vue'
import { useModal } from '~/composables/useModal'
import type { ConfirmIcon } from '~/types/modal'

const props = withDefaults(defineProps<{
  modalId: string
  title: string
  description?: string
  confirmText?: string
  icon?: ConfirmIcon
  copyText?: string
}>(), {
  confirmText: '확인'
})

const modal = useModal()
const copyStatus = ref<'idle' | 'copied' | 'failed'>('idle')

async function copyDetail() {
  if (!props.copyText) return
  try {
    await navigator.clipboard.writeText(props.copyText)
    copyStatus.value = 'copied'
  } catch {
    copyStatus.value = 'failed'
  }
}

function handleConfirm() {
  modal.close(props.modalId)
}
</script>

<style scoped>
.alert-modal {
  padding: 1.5rem;
  text-align: center;
}

.alert-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin: 0 auto 1rem;
  border-radius: 50%;
}

.alert-icon-warning {
  background: #fef3c7;
  color: #d97706;
}

.alert-icon-error {
  background: #fee2e2;
  color: #dc2626;
}

.alert-icon-info {
  background: #dbeafe;
  color: #3A1A1A;
}

.alert-icon-success {
  background: #d1fae5;
  color: #1F0C0C;
}

.alert-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
  margin: 0 0 0.5rem;
}

.alert-description {
  font-size: 0.9375rem;
  color: var(--color-text-secondary, #6b7280);
  margin: 0 0 1.5rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
  user-select: text;
  white-space: pre-line;
  word-break: keep-all;
}

.alert-copy-btn {
  margin: -0.5rem auto 1.25rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-default, #d1d5db);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  font-size: 0.8125rem;
  font-weight: 600;
}

.alert-copy-btn:hover {
  background: var(--color-bg-muted, #f3f4f6);
}

.alert-actions {
  display: flex;
}

.alert-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  font-size: 0.9375rem;
  font-weight: 600;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  background: var(--color-primary, #2A1111);
  color: white;
}

.alert-btn:hover {
  background: var(--color-primary-dark, #3A1A1A);
}

/* Dark mode */
[data-theme="dark"] .alert-modal,
.dark .alert-modal {
  --color-text-primary: #f9fafb;
  --color-text-secondary: #9ca3af;
}

[data-theme="dark"] .alert-icon-warning,
.dark .alert-icon-warning {
  background: #78350f;
  color: #fbbf24;
}

[data-theme="dark"] .alert-icon-error,
.dark .alert-icon-error {
  background: #7f1d1d;
  color: #f87171;
}

[data-theme="dark"] .alert-icon-info,
.dark .alert-icon-info {
  background: #1e3a8a;
  color: #2A1111;
}

[data-theme="dark"] .alert-icon-success,
.dark .alert-icon-success {
  background: #064e3b;
  color: #3A1A1A;
}
</style>
