<template>
  <div class="modal-wrapper" :style="{ zIndex }" :inert="!isTopmost">
    <div
      v-if="modal.options.showOverlay"
      class="modal-overlay"
      @click="isTopmost && modal.options.closeOnOverlay && emit('close')"
    />
    <div
      ref="containerRef"
      class="modal-container"
      :class="[sizeClass, positionClass]"
      role="dialog"
      :aria-modal="isTopmost || undefined"
      :aria-hidden="!isTopmost || undefined"
      :inert="!isTopmost"
      :aria-labelledby="`modal-title-${modal.id}`"
      :aria-describedby="modal.options.props?.description ? `modal-description-${modal.id}` : undefined"
      tabindex="-1"
    >
      <button
        v-if="modal.options.showCloseButton"
        type="button"
        class="modal-close-btn"
        aria-label="닫기"
        @click="isTopmost && emit('close')"
      >
        <XIcon :size="20" />
      </button>

      <component
        :is="modal.component"
        v-bind="modal.options.props"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { XIcon } from '@lucide/vue'
import { ref, computed } from 'vue'
import { useFocusTrap } from '~/composables/useFocusTrap'
import { useModalState } from '~/composables/useModalState'
import type { ModalInstance } from '~/types/modal'

const props = defineProps<{ modal: ModalInstance }>()
const emit = defineEmits<{ close: [] }>()

const containerRef = ref<HTMLElement | null>(null)

const state = useModalState()
const { isTopmost, zIndex } = useFocusTrap(containerRef, {
  enabled: computed(() => state.isModalOpen(props.modal.id)),
  onEscape: () => { if (props.modal.options.closeOnEsc) emit('close') },
  autoFocus: true,
  returnFocusOnDeactivate: true
})

const sizeClass = computed(() => `modal-size-${props.modal.options.size || 'md'}`)
const positionClass = computed(() => `modal-position-${props.modal.options.position || 'center'}`)
</script>

<style scoped>
.modal-container {
  position: relative;
  z-index: 1; /* Above the scrim inside the shared ownership layer. */
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 2rem);
  max-width: calc(100vw - 2rem);
  overflow: hidden;
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  border-radius: var(--modal-radius);
  box-shadow: var(--shadow-lg);
  letter-spacing: var(--tracking-body);
  pointer-events: auto;
  will-change: transform;
}

.modal-size-sm { width: var(--modal-width-sm); }
.modal-size-md { width: var(--modal-width-md); }
.modal-size-lg { width: var(--modal-width-lg); }
.modal-size-xl { width: var(--modal-width-xl); }

.modal-size-full {
  width: 100%;
  height: 100%;
  max-width: 100vw;
  max-height: 100vh;
  border-radius: 0;
}

.modal-position-bottom {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-width: 100%;
  max-height: 90vh;
  border-radius: var(--modal-radius-sheet);
}

.modal-close-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--hit-min);
  height: var(--hit-min);
  border: none;
  border-radius: var(--radius-pill);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.modal-close-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

.modal-close-btn:focus-visible {
  outline: 3px solid var(--color-accent-focus-ring);
  outline-offset: 2px;
  box-shadow: 0 0 0 1px var(--color-accent-primary);
}

@media (max-width: 640px) {
  /* Non-compact dialogs become bottom sheets on phones; sm stays centered. */
  .modal-container:not(.modal-size-full):not(.modal-size-sm) {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    max-width: 100%;
    max-height: 90vh;
    border-radius: var(--modal-radius-sheet);
  }

  .modal-size-sm {
    width: calc(100% - 2rem);
    max-width: var(--modal-width-sm);
  }
}

@media (prefers-reduced-motion: reduce) {
  .modal-close-btn { transition: none; }
}
</style>
