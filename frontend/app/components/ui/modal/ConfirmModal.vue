<template>
  <div class="confirm-modal">
    <!-- Icon -->
    <div v-if="icon" class="confirm-icon" :class="`confirm-icon-${icon}`">
      <TriangleAlertIcon v-if="icon === 'warning'" :size="24" />
      <CircleXIcon v-else-if="icon === 'error'" :size="24" />
      <InfoIcon v-else-if="icon === 'info'" :size="24" />
      <CircleCheckIcon v-else-if="icon === 'success'" :size="24" />
    </div>

    <!-- Title -->
    <h3 :id="`modal-title-${modalId}`" class="confirm-title">
      {{ title }}
    </h3>

    <!-- Description -->
    <p v-if="description" class="confirm-description">
      {{ description }}
    </p>

    <!-- Actions -->
    <div class="confirm-actions">
      <button
        type="button"
        class="confirm-btn confirm-btn-cancel"
        @click="handleCancel"
      >
        {{ cancelText }}
      </button>
      <button
        type="button"
        class="confirm-btn"
        :class="confirmButtonClass"
        @click="handleConfirm"
      >
        {{ confirmText }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CircleCheckIcon, CircleXIcon, InfoIcon, TriangleAlertIcon } from '@lucide/vue'
import { computed } from 'vue'
import { useModal } from '~/composables/useModal'
import type { ConfirmVariant, ConfirmIcon } from '~/types/modal'

const props = withDefaults(defineProps<{
  modalId: string
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: ConfirmVariant
  icon?: ConfirmIcon
}>(), {
  confirmText: '확인',
  cancelText: '취소',
  confirmVariant: 'primary'
})

const modal = useModal()

const confirmButtonClass = computed(() => {
  return props.confirmVariant === 'danger'
    ? 'confirm-btn-danger'
    : 'confirm-btn-primary'
})

function handleConfirm() {
  modal.close(props.modalId, true)
}

function handleCancel() {
  modal.close(props.modalId, false)
}
</script>

<style scoped>
.confirm-modal {
  padding: 1.5rem;
  text-align: center;
}

.confirm-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin: 0 auto 1rem;
  border-radius: 50%;
}

.confirm-icon-warning {
  background: #fef3c7;
  color: #d97706;
}

.confirm-icon-error {
  background: #fee2e2;
  color: #dc2626;
}

.confirm-icon-info {
  background: #dbeafe;
  color: #3A1A1A;
}

.confirm-icon-success {
  background: #d1fae5;
  color: #1F0C0C;
}

.confirm-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
  margin: 0 0 0.5rem;
}

.confirm-description {
  font-size: 0.9375rem;
  color: var(--color-text-secondary, #6b7280);
  margin: 0 0 1.5rem;
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  gap: 0.75rem;
}

.confirm-btn {
  flex: 1;
  padding: 0.75rem 1rem;
  font-size: 0.9375rem;
  font-weight: 600;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.confirm-btn-cancel {
  background: var(--color-bg-secondary, #f3f4f6);
  color: var(--color-text-primary, #374151);
}

.confirm-btn-cancel:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.confirm-btn-primary {
  background: var(--color-primary, #2A1111);
  color: white;
}

.confirm-btn-primary:hover {
  background: var(--color-primary-dark, #1F0C0C);
}

.confirm-btn-danger {
  background: #dc2626;
  color: white;
}

.confirm-btn-danger:hover {
  background: #b91c1c;
}

/* Dark mode */
[data-theme="dark"] .confirm-modal,
.dark .confirm-modal {
  --color-text-primary: #f9fafb;
  --color-text-secondary: #9ca3af;
  --color-bg-secondary: #374151;
  --color-bg-tertiary: #4b5563;
}

[data-theme="dark"] .confirm-icon-warning,
.dark .confirm-icon-warning {
  background: #78350f;
  color: #fbbf24;
}

[data-theme="dark"] .confirm-icon-error,
.dark .confirm-icon-error {
  background: #7f1d1d;
  color: #f87171;
}

[data-theme="dark"] .confirm-icon-info,
.dark .confirm-icon-info {
  background: #1e3a8a;
  color: #2A1111;
}

[data-theme="dark"] .confirm-icon-success,
.dark .confirm-icon-success {
  background: #064e3b;
  color: #3A1A1A;
}
</style>
