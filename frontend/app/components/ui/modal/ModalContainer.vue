<template>
  <div class="modal-wrapper" :style="{ zIndex }" :inert="!isTopmost">
    <div
      v-if="modal.options.showOverlay"
      class="modal-overlay"
      @click="isTopmost && modal.options.closeOnOverlay && emit('close')"
    />
    <Transition :name="transitionName">
      <div
        v-if="modal"
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
        <!-- Close button (optional) -->
        <button
          v-if="modal.options.showCloseButton"
          type="button"
          class="modal-close-btn"
          aria-label="닫기"
          @click="isTopmost && emit('close')"
        >
          <XIcon :size="20" />
        </button>

        <!-- Dynamic component -->
        <component
          :is="modal.component"
          v-bind="modal.options.props"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { XIcon } from '@lucide/vue'
import { ref, computed } from 'vue'
import { useFocusTrap } from '~/composables/useFocusTrap'
import { useModalState } from '~/composables/useModalState'
import type { ModalInstance } from '~/types/modal'

const props = defineProps<{
  modal: ModalInstance
}>()

const emit = defineEmits<{
  close: []
}>()

const containerRef = ref<HTMLElement | null>(null)

// Focus trap
const state = useModalState()
const { isTopmost, zIndex } = useFocusTrap(containerRef, {
  enabled: computed(() => state.isModalOpen(props.modal.id)),
  onEscape: () => { if (props.modal.options.closeOnEsc) emit('close') },
  autoFocus: true,
  returnFocusOnDeactivate: true
})

// Size class
const sizeClass = computed(() => {
  const size = props.modal?.options.size || 'md'
  return `modal-size-${size}`
})

// Position class
const positionClass = computed(() => {
  const position = props.modal?.options.position || 'center'
  return `modal-position-${position}`
})

// Transition name based on position
const transitionName = computed(() => {
  const position = props.modal?.options.position || 'center'
  return position === 'bottom' ? 'modal-slide-up' : 'modal-scale'
})
</script>

<style scoped>
.modal-container {
  position: relative;
  z-index: 1; /* Above the scrim inside the shared ownership layer. */
  background: var(--color-bg-card);
  border-radius: var(--modal-radius);
  max-height: calc(100vh - 2rem);
  max-width: calc(100vw - 2rem);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  color: var(--color-text-primary);
  letter-spacing: var(--tracking-body);
  pointer-events: auto;
}

/* Sizes */
.modal-size-sm {
  width: var(--modal-width-sm);
}

.modal-size-md {
  width: var(--modal-width-md);
}

.modal-size-lg {
  width: var(--modal-width-lg);
}

.modal-size-xl {
  width: var(--modal-width-xl);
}

.modal-size-full {
  width: 100%;
  height: 100%;
  max-width: 100vw;
  max-height: 100vh;
  border-radius: 0;
}

/* Position: Center (default) */
.modal-position-center {
  /* Default centered by parent flex */
}

/* Position: Bottom (BottomSheet) */
.modal-position-bottom {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-width: 100%;
  border-radius: var(--modal-radius-bottom);
  max-height: 90vh;
}

/* Close button */
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
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: all 0.15s ease;
}

.modal-close-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
}

/* Scale transition (center) */
.modal-scale-enter-active,
.modal-scale-leave-active {
  transition: all var(--modal-duration) var(--modal-easing);
}

.modal-scale-enter-from,
.modal-scale-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

/* Slide up transition (bottom) */
.modal-slide-up-enter-active,
.modal-slide-up-leave-active {
  transition: all var(--modal-duration) var(--modal-easing);
}

.modal-slide-up-enter-from,
.modal-slide-up-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

/* Responsive: Bottom sheet on mobile (except sm size) */
@media (max-width: 640px) {
  .modal-container:not(.modal-size-full):not(.modal-size-sm) {
    width: 100%;
    max-width: 100%;
    border-radius: var(--modal-radius-bottom);
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    max-height: 90vh;
  }
  
  /* sm 사이즈는 모바일에서도 가운데 표시 */
  .modal-size-sm {
    width: calc(100% - 2rem);
    max-width: var(--modal-width-sm);
  }
}

.modal-close-btn:focus-visible {
  outline: 3px solid var(--color-accent-focus-ring);
  outline-offset: 2px;
  box-shadow: 0 0 0 1px var(--color-accent-primary);
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .modal-scale-enter-active,
  .modal-scale-leave-active,
  .modal-slide-up-enter-active,
  .modal-slide-up-leave-active {
    transition: none;
    transform: none;
  }
}
</style>
