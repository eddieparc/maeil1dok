<template>
  <Teleport to="body">
    <TransitionGroup name="modal">
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
/*
 * Modal motion contract.
 * The whole layer (scrim + panel) is ONE transition: the layer fades on a
 * single clock and the panel adds a small settle transform on the same clock.
 * The layer root carries the duration so Vue's TransitionGroup waits for it.
 */
:root {
  --modal-width-sm: 320px;
  --modal-width-md: 420px;
  --modal-width-lg: 560px;
  --modal-width-xl: 720px;
  --modal-scrim: var(--color-overlay);
  --modal-radius: var(--radius-card);
  --modal-radius-sheet: 20px 20px 0 0;
  --modal-enter: 220ms;
  --modal-leave: 160ms;
  --modal-ease-out: cubic-bezier(0.32, 0.72, 0, 1);
  --modal-ease-in: cubic-bezier(0.4, 0, 1, 1);
  --modal-settle: translateY(8px) scale(0.98);
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
  position: absolute;
  inset: 0;
  background: var(--modal-scrim);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  pointer-events: auto;
}

/* Enter: layer fades in while the panel settles into place. */
.modal-enter-active {
  transition: opacity var(--modal-enter) var(--modal-ease-out);
}
.modal-enter-active .modal-container {
  transition: transform var(--modal-enter) var(--modal-ease-out);
}

/* Leave: shorter, ease-in, same shape reversed. */
.modal-leave-active {
  transition: opacity var(--modal-leave) var(--modal-ease-in);
}
.modal-leave-active .modal-container {
  transition: transform var(--modal-leave) var(--modal-ease-in);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: var(--modal-settle);
}
.modal-enter-from .modal-position-bottom,
.modal-leave-to .modal-position-bottom {
  transform: translateY(100%);
}

@media (max-width: 640px) {
  /* Responsive sheets slide instead of settling. */
  .modal-enter-from .modal-container:not(.modal-size-full):not(.modal-size-sm),
  .modal-leave-to .modal-container:not(.modal-size-full):not(.modal-size-sm) {
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal-enter-active,
  .modal-leave-active,
  .modal-enter-active .modal-container,
  .modal-leave-active .modal-container {
    transition: none;
  }
  .modal-enter-from .modal-container,
  .modal-leave-to .modal-container,
  .modal-enter-from .modal-position-bottom,
  .modal-leave-to .modal-position-bottom {
    transform: none;
  }
}
</style>
