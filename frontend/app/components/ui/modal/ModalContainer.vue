<template>
  <Transition :name="transitionName">
    <div
      v-if="modal"
      ref="containerRef"
      class="modal-container"
      :class="[sizeClass, positionClass]"
      :style="containerStyle"
      role="dialog"
      aria-modal="true"
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
        @click="$emit('close')"
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
</template>

<script setup lang="ts">
import { XIcon } from '@lucide/vue'
import { ref, computed, onMounted, type CSSProperties } from 'vue'
import { useFocusTrap } from '~/composables/useFocusTrap'
import type { ModalInstance } from '~/types/modal'

const props = defineProps<{
  modal: ModalInstance
}>()

// z-index 스타일 (overlay 위에 표시되도록)
const containerStyle = computed<CSSProperties>(() => ({
  zIndex: (props.modal?.options.zIndex || 1000) + 1
}))

defineEmits<{
  close: []
}>()

const containerRef = ref<HTMLElement | null>(null)

// Focus trap
useFocusTrap(containerRef, {
  enabled: computed(() => !!props.modal),
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
  z-index: 1; /* 부모에서 전달되는 인라인 z-index와 함께 사용 */
  background: var(--color-bg-card, #ffffff);
  border-radius: var(--modal-radius);
  max-height: calc(100vh - 2rem);
  max-width: calc(100vw - 2rem);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
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
  width: 32px;
  height: 32px;
  border: none;
  background: var(--color-bg-secondary, #f3f4f6);
  color: var(--color-text-secondary, #6b7280);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.modal-close-btn:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
  color: var(--color-text-primary, #111827);
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

/* Dark mode */
[data-theme="dark"] .modal-container,
.dark .modal-container {
  --color-bg-card: #1f2937;
  --color-bg-secondary: #374151;
  --color-bg-tertiary: #4b5563;
  --color-text-primary: #f9fafb;
  --color-text-secondary: #9ca3af;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .modal-scale-enter-active,
  .modal-scale-leave-active,
  .modal-slide-up-enter-active,
  .modal-slide-up-leave-active {
    transition: opacity 100ms;
    transform: none;
  }
}
</style>
