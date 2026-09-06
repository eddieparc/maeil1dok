<template>
  <div
    class="toast-item"
    :class="`toast-${toast.type}`"
    role="alert"
    :aria-live="toast.type === 'error' ? 'assertive' : 'polite'"
    aria-atomic="true"
  >
    <!-- Icon -->
    <div v-if="toast.showIcon" class="toast-icon">
      <component :is="toast.icon" v-if="toast.icon" />
      <template v-else>
        <CircleCheckIcon v-if="toast.type === 'success'" :size="18" />
        <CircleXIcon v-else-if="toast.type === 'error'" :size="18" />
        <TriangleAlertIcon v-else-if="toast.type === 'warning'" :size="18" />
        <InfoIcon v-else :size="18" />
      </template>
    </div>

    <!-- Content -->
    <div class="toast-content">
      <p v-if="toast.title" class="toast-title">{{ toast.title }}</p>
      <p class="toast-message">{{ toast.message }}</p>
    </div>

    <!-- Action -->
    <button
      v-if="toast.action"
      type="button"
      class="toast-action"
      @click="handleAction"
    >
      {{ toast.action.label }}
    </button>

    <!-- Dismiss -->
    <button
      v-if="toast.dismissible"
      type="button"
      class="toast-dismiss"
      aria-label="닫기"
      @click="handleDismiss"
    >
      <XIcon :size="16" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { CircleCheckIcon, CircleXIcon, InfoIcon, TriangleAlertIcon, XIcon } from '@lucide/vue'
import type { ToastInstance } from '~/types/toast'

const props = defineProps<{
  toast: ToastInstance
}>()

const emit = defineEmits<{
  dismiss: [id: string]
}>()

function handleAction() {
  props.toast.action?.onClick()
  emit('dismiss', props.toast.id)
}

function handleDismiss() {
  emit('dismiss', props.toast.id)
}
</script>

<style scoped>
.toast-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 4px 8px 4px 16px;
  min-height: var(--hit-min);
  box-sizing: border-box;
  min-width: var(--toast-min-width);
  max-width: var(--toast-max-width);
  border-radius: var(--toast-radius);
  color: var(--color-text-inverse);
  font-size: 0.9375rem;
  box-shadow: var(--shadow-md);
  letter-spacing: var(--tracking-body);
  pointer-events: auto;
}

.toast-info {
  background: var(--color-accent-primary);
}

.toast-success {
  background: var(--color-accent-primary);
}

.toast-warning {
  background: var(--color-accent-primary);
}

.toast-error {
  background: var(--color-error);
}

.toast-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-weight: 600;
  margin: 0 0 0.125rem;
  font-size: 0.9375rem;
}

.toast-message {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.toast-action {
  flex-shrink: 0;
  padding: 0.375rem 0.75rem;
  min-width: var(--hit-min);
  min-height: var(--hit-min);
  font-size: 0.8125rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: var(--radius-pill);
  color: var(--color-text-inverse);
  cursor: pointer;
  transition: background 0.15s ease;
}

.toast-action:hover {
  background: rgba(255, 255, 255, 0.3);
}

.toast-dismiss {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--hit-min);
  height: var(--hit-min);
  padding: 0;
  background: transparent;
  border: none;
  color: var(--color-text-inverse);
  cursor: pointer;
  border-radius: var(--radius-pill);
  transition: all 0.15s ease;
}

.toast-dismiss:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

.toast-action:focus-visible,
.toast-dismiss:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .toast-action, .toast-dismiss { transition: none; }
}

/* Mobile adjustments */
@media (max-width: 480px) {
  .toast-item {
    min-width: auto;
    width: 100%;
  }
}
</style>
