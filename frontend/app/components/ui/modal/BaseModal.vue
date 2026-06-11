<template>
  <Teleport to="body">
    <Transition :name="transitionName">
      <div
        v-if="modelValue"
        class="base-modal-overlay"
        :class="positionClass"
        @click="handleOverlayClick"
      >
        <div
          ref="modalRef"
          class="base-modal-content"
          :class="[sizeClass, positionClass]"
          role="dialog"
          aria-modal="true"
          @click.stop
        >
          <!-- Header -->
          <div v-if="!hideHeader" class="base-modal-header">
            <h3 class="base-modal-title">{{ title }}</h3>
            <slot name="header-extra" />
            <button
              type="button"
              class="base-modal-close"
              aria-label="닫기"
              @click="close"
            >
              <XIcon :size="24" />
            </button>
          </div>

          <!-- Body -->
          <div class="base-modal-body" :class="{ 'no-padding': noPadding }">
            <slot />
          </div>

          <!-- Footer (optional) -->
          <div v-if="$slots.footer" class="base-modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { XIcon } from '@lucide/vue';
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
type ModalPosition = 'center' | 'bottom';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    size?: ModalSize;
    position?: ModalPosition;
    closeOnOverlay?: boolean;
    closeOnEsc?: boolean;
    hideHeader?: boolean;
    noPadding?: boolean;
  }>(),
  {
    title: '',
    size: 'md',
    position: 'center',
    closeOnOverlay: true,
    closeOnEsc: true,
    hideHeader: false,
    noPadding: false,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const modalRef = ref<HTMLElement | null>(null);

// Classes
const sizeClass = computed(() => `modal-size-${props.size}`);
const positionClass = computed(() => `modal-position-${props.position}`);
const transitionName = computed(() =>
  props.position === 'bottom' ? 'modal-slide-up' : 'modal-fade'
);

// Close modal
const close = () => {
  emit('update:modelValue', false);
  emit('close');
};

// Handle overlay click
const handleOverlayClick = () => {
  if (props.closeOnOverlay) {
    close();
  }
};

// Handle ESC key
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.closeOnEsc && props.modelValue) {
    close();
  }
};

// Lock body scroll when modal is open
watch(
  () => props.modelValue,
  (isOpen) => {
    if (typeof document !== 'undefined') {
      if (isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
  }
);

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', handleKeydown);
  }
});

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('keydown', handleKeydown);
    document.body.style.overflow = '';
  }
});
</script>

<style scoped>
.base-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.base-modal-overlay.modal-position-bottom {
  align-items: flex-end;
  padding: 0;
}

.base-modal-content {
  background: var(--color-bg-card, #fff);
  border-radius: 16px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

/* Sizes */
.modal-size-sm {
  max-width: 320px;
}

.modal-size-md {
  max-width: 420px;
}

.modal-size-lg {
  max-width: 500px;
}

.modal-size-xl {
  max-width: 640px;
}

.modal-size-full {
  max-width: 100%;
  max-height: 100vh;
  height: 100%;
  border-radius: 0;
}

/* Position: Bottom */
.modal-position-bottom .base-modal-content {
  border-radius: 20px 20px 0 0;
  max-height: 90vh;
}

/* Header */
.base-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  flex-shrink: 0;
}

.base-modal-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
  margin: 0;
}

.base-modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  padding: 0;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
  flex-shrink: 0;
  margin-left: auto;
}

.base-modal-close:hover {
  background: var(--color-bg-hover, #f3f4f6);
  color: var(--text-primary, #1f2937);
}

/* Body */
.base-modal-body {
  flex: 1 1 auto; /* grow, shrink, basis=auto로 콘텐츠 기반 확장 */
  width: 100%;
  min-width: 0;
  min-height: 0; /* flex 자식이 shrink 가능 */
  overflow-x: hidden;
  overflow-y: auto;
  padding: 1rem;
  box-sizing: border-box;
}

/* no-padding: flex 컨테이너로 동작, 자식에서 스크롤 */
.base-modal-body.no-padding {
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 자식에서 스크롤 제어 */
}

/* Footer */
.base-modal-footer {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--color-border, #e5e7eb);
  flex-shrink: 0;
}

/* Fade transition (center) */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-active .base-modal-content,
.modal-fade-leave-active .base-modal-content {
  transition: transform 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .base-modal-content,
.modal-fade-leave-to .base-modal-content {
  transform: scale(0.95) translateY(10px);
}

/* Slide up transition (bottom) */
.modal-slide-up-enter-active,
.modal-slide-up-leave-active {
  transition: opacity 0.25s ease;
}

.modal-slide-up-enter-active .base-modal-content,
.modal-slide-up-leave-active .base-modal-content {
  transition: transform 0.25s ease;
}

.modal-slide-up-enter-from,
.modal-slide-up-leave-to {
  opacity: 0;
}

.modal-slide-up-enter-from .base-modal-content,
.modal-slide-up-leave-to .base-modal-content {
  transform: translateY(100%);
}

/* Responsive: Bottom sheet on mobile for non-bottom positioned modals */
@media (max-width: 640px) {
  .base-modal-overlay.modal-position-center {
    align-items: flex-end;
    padding: 0;
  }

  .modal-position-center.base-modal-content,
  .modal-position-center .base-modal-content {
    width: 100%;
    max-width: 100%;
    border-radius: 20px 20px 0 0;
    height: 90vh; /* 고정 높이로 바디 확장 공간 확보 */
    max-height: 90vh;
  }

  /* Size classes should not limit width on mobile */
  .modal-size-sm,
  .modal-size-md,
  .modal-size-lg,
  .modal-size-xl {
    max-width: 100%;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .modal-fade-enter-active,
  .modal-fade-leave-active,
  .modal-slide-up-enter-active,
  .modal-slide-up-leave-active,
  .modal-fade-enter-active .base-modal-content,
  .modal-fade-leave-active .base-modal-content,
  .modal-slide-up-enter-active .base-modal-content,
  .modal-slide-up-leave-active .base-modal-content {
    transition: opacity 100ms;
  }

  .modal-fade-enter-from .base-modal-content,
  .modal-fade-leave-to .base-modal-content,
  .modal-slide-up-enter-from .base-modal-content,
  .modal-slide-up-leave-to .base-modal-content {
    transform: none;
  }
}

/* Dark Mode */
:root.dark .base-modal-content,
[data-theme="dark"] .base-modal-content {
  background: var(--color-bg-card);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

:root.dark .base-modal-header,
[data-theme="dark"] .base-modal-header {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

:root.dark .base-modal-title,
[data-theme="dark"] .base-modal-title {
  color: var(--text-primary);
}

:root.dark .base-modal-close,
[data-theme="dark"] .base-modal-close {
  color: var(--text-secondary);
}

:root.dark .base-modal-close:hover,
[data-theme="dark"] .base-modal-close:hover {
  background: var(--color-bg-hover);
  color: var(--text-primary);
}

:root.dark .base-modal-footer,
[data-theme="dark"] .base-modal-footer {
  border-top-color: rgba(255, 255, 255, 0.06);
}
</style>
