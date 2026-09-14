<template>
  <Teleport to="body">
    <TransitionGroup name="modal-stack">
      <ModalContainer
        v-for="modal in stack"
        :key="modal.id"
        :modal="modal"
        @close="handleClose(modal)"
      />
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { useModalState } from '~/composables/useModalState'
import { useScrollLock } from '~/composables/useScrollLock'
import ModalContainer from './ModalContainer.vue'
import type { ModalInstance } from '~/types/modal'

const state = useModalState()
const stack = state.stack

// One service-host lock; sheets retain their own lease until they close.
useScrollLock({ enabled: state.isOpen })

function handleClose(modal: ModalInstance): void {
  if (state.topModal.value?.id === modal.id) state.cancel(modal.id)
}
</script>

<style>
/* Modal tokens */
:root {
  --modal-width-sm: 320px;
  --modal-width-md: 420px;
  --modal-width-lg: 560px;
  --modal-width-xl: 720px;
  --modal-overlay-bg: var(--color-overlay);
  --modal-radius: var(--radius-card);
  --modal-radius-bottom: 20px 20px 0 0;
  --modal-duration: 200ms;
  --modal-easing: cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-wrapper {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  pointer-events: none;
}

.modal-overlay {
  z-index: 0;
  position: fixed;
  inset: 0;
  background: var(--modal-overlay-bg);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  pointer-events: auto;
}

/* Stack transition - overlay와 modal이 동시에 트랜지션 */
.modal-stack-enter-active,
.modal-stack-leave-active {
  transition: opacity var(--modal-duration) var(--modal-easing);
}

.modal-stack-enter-active .modal-overlay,
.modal-stack-leave-active .modal-overlay {
  transition: opacity var(--modal-duration) var(--modal-easing),
              backdrop-filter var(--modal-duration) var(--modal-easing);
}

.modal-stack-enter-from,
.modal-stack-leave-to {
  opacity: 0;
}

.modal-stack-enter-from .modal-overlay,
.modal-stack-leave-to .modal-overlay {
  backdrop-filter: blur(0);
  -webkit-backdrop-filter: blur(0);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .modal-stack-enter-active,
  .modal-stack-leave-active,
  .modal-stack-enter-active .modal-overlay,
  .modal-stack-leave-active .modal-overlay {
    transition: none;
  }
}
</style>
