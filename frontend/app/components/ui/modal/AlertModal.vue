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
    <p v-if="description" class="alert-description">
      {{ description }}
    </p>

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
import { useModal } from '~/composables/useModal'
import type { ConfirmIcon } from '~/types/modal'

const props = withDefaults(defineProps<{
  modalId: string
  title: string
  description?: string
  confirmText?: string
  icon?: ConfirmIcon
}>(), {
  confirmText: '확인'
})

const modal = useModal()

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
  color: #2563eb;
}

.alert-icon-success {
  background: #d1fae5;
  color: #059669;
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
  background: var(--color-primary, #3b82f6);
  color: white;
}

.alert-btn:hover {
  background: var(--color-primary-dark, #2563eb);
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
  color: #60a5fa;
}

[data-theme="dark"] .alert-icon-success,
.dark .alert-icon-success {
  background: #064e3b;
  color: #34d399;
}
</style>
