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
    <p
      v-if="description"
      :id="`modal-description-${modalId}`"
      class="confirm-description"
    >
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
  background: var(--color-warning-bg);
  color: var(--color-warning-text);
}

.confirm-icon-error {
  background: var(--color-error-bg);
  color: var(--color-error-text);
}

.confirm-icon-info {
  background: var(--color-info-bg);
  color: var(--color-info-text);
}

.confirm-icon-success {
  background: var(--color-success-bg);
  color: var(--color-success-text);
}

.confirm-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 0.5rem;
}

.confirm-description {
  font-size: 0.9375rem;
  color: var(--color-text-secondary);
  margin: 0 0 1.5rem;
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  gap: 0.75rem;
}

.confirm-btn {
  flex: 1;
  min-height: var(--hit-min);
  padding: 0.75rem 1rem;
  font-size: 0.9375rem;
  font-weight: 600;
  border-radius: var(--radius-pill);
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.confirm-btn-cancel {
  border: 1px solid var(--color-border-default);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
}

.confirm-btn-cancel:hover {
  background: var(--color-bg-tertiary);
}

.confirm-btn-primary {
  background: var(--color-accent-primary);
  color: var(--color-text-inverse);
}

.confirm-btn-primary:hover {
  background: var(--color-accent-primary-hover);
}

.confirm-btn-danger {
  background: var(--color-error);
  color: var(--color-text-inverse);
}

.confirm-btn-danger:hover {
  filter: brightness(0.94);
}

/* Shared semantic tokens supply both themes. */
.confirm-btn:focus-visible {
  outline: 3px solid var(--color-accent-focus-ring);
  outline-offset: 2px;
  box-shadow: 0 0 0 1px var(--color-accent-primary);
}

@media (prefers-reduced-motion: reduce) {
  .confirm-btn { transition: none; }
}
</style>
