<template>
  <Teleport to="body">
    <div class="toast-host" role="region" aria-label="알림">
      <TransitionGroup name="toast" tag="div" class="toast-container">
        <ToastItem
          v-for="toast in toasts"
          :key="toast.id"
          :toast="toast"
          @dismiss="handleDismiss"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToastState } from '~/composables/useToastState'
import ToastItem from './ToastItem.vue'

const state = useToastState()
const toasts = state.toasts

function handleDismiss(id: string) {
  state.dismiss(id)
}
</script>

<style>
/* Toast tokens */
:root {
  --toast-position-bottom: 1.25rem;
  --toast-min-width: 200px;
  --toast-max-width: 400px;
  --toast-gap: 0.5rem;
  --toast-radius: 12px;
  --toast-duration: 300ms;
  --toast-easing: cubic-bezier(0.16, 1, 0.3, 1);
  --z-toast: 9999;

  /* Colors */
  --toast-bg-info: #3A1A1A;
  --toast-bg-success: #1F0C0C;
  --toast-bg-warning: #d97706;
  --toast-bg-error: #dc2626;
}

/* Dark mode */
[data-theme="dark"],
.dark {
  --toast-bg-info: #2A1111;
  --toast-bg-success: #2A1111;
  --toast-bg-warning: #f59e0b;
  --toast-bg-error: #ef4444;
}

.toast-host {
  position: fixed;
  bottom: var(--toast-position-bottom);
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-toast);
  pointer-events: none;
  width: 100%;
  max-width: 90vw;
  padding: 0 1rem;
}

.toast-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--toast-gap);
}

/* Toast transitions */
.toast-enter-active,
.toast-leave-active {
  transition: all var(--toast-duration) var(--toast-easing);
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}

.toast-move {
  transition: transform var(--toast-duration) var(--toast-easing);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active,
  .toast-leave-active,
  .toast-move {
    transition: opacity 150ms;
    transform: none;
  }
}
</style>
