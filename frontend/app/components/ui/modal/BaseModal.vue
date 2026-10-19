<template>
  <Teleport to="body">
    <Transition name="modal-fade" appear>
      <div
        v-if="modelValue"
        class="base-modal-overlay"
        :class="positionClass"
        @click="handleOverlayClick"
      >
        <div
          ref="modalRef"
          class="base-modal-content"
          :class="[sizeClass, positionClass, { 'base-modal--compact': compact }]"
          role="dialog"
          aria-modal="true"
          @click.stop
        >
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

          <div class="base-modal-body" :class="{ 'no-padding': noPadding }">
            <slot />
          </div>

          <div v-if="$slots.footer" class="base-modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { XIcon } from '@lucide/vue'
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'
type ModalPosition = 'center' | 'bottom'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  size?: ModalSize
  position?: ModalPosition
  closeOnOverlay?: boolean
  closeOnEsc?: boolean
  hideHeader?: boolean
  noPadding?: boolean
  compact?: boolean
}>(), {
  title: '',
  size: 'md',
  position: 'center',
  closeOnOverlay: true,
  closeOnEsc: true,
  hideHeader: false,
  noPadding: false,
  compact: false
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

const modalRef = ref<HTMLElement | null>(null)

const sizeClass = computed(() => `modal-size-${props.size}`)
const positionClass = computed(() => `modal-position-${props.position}`)

function close(): void {
  emit('update:modelValue', false)
  emit('close')
}

function handleOverlayClick(): void {
  if (props.closeOnOverlay) close()
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && props.closeOnEsc && props.modelValue) close()
}

// Page-local modals keep their own body lock; the service host has its own.
watch(() => props.modelValue, (isOpen) => {
  if (typeof document === 'undefined') return
  document.body.style.overflow = isOpen ? 'hidden' : ''
})

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.base-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: var(--color-overlay, rgba(0, 0, 0, 0.5));
}

.base-modal-overlay.modal-position-bottom {
  align-items: flex-end;
  padding: 0;
}

.base-modal-content {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  max-height: 85vh;
  overflow: hidden;
  background: var(--color-bg-card, #fff);
  border-radius: var(--modal-radius, 16px);
  box-shadow: var(--shadow-lg, 0 25px 50px -12px rgba(0, 0, 0, 0.25));
  will-change: transform;
}

.modal-size-sm { max-width: 320px; }
.modal-size-md { max-width: 420px; }
.modal-size-lg { max-width: 500px; }
.modal-size-xl { max-width: 640px; }

.modal-size-full {
  max-width: 100%;
  max-height: 100vh;
  height: 100%;
  border-radius: 0;
}

.modal-position-bottom .base-modal-content {
  max-height: 90vh;
  border-radius: var(--modal-radius-sheet, 20px 20px 0 0);
}

.base-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.base-modal-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary, #1f2937);
}

.base-modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: var(--hit-min);
  height: var(--hit-min);
  margin-left: auto;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: none;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.base-modal-close:hover {
  background: var(--color-bg-hover, #f3f4f6);
  color: var(--text-primary, #1f2937);
}

.base-modal--compact .base-modal-header {
  padding: 0.5rem 1rem;
}

.base-modal--compact .base-modal-close {
  width: 32px;
  height: 32px;
}

.base-modal-body {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  min-height: 0;
  padding: 1rem;
  overflow-x: hidden;
  overflow-y: auto;
  box-sizing: border-box;
}

.base-modal-body.no-padding {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}

.base-modal-footer {
  flex-shrink: 0;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

/* Same single-clock motion as the service host: layer fades, panel settles. */
.modal-fade-enter-active {
  transition: opacity 0.22s cubic-bezier(0.32, 0.72, 0, 1);
}
.modal-fade-enter-active .base-modal-content {
  transition: transform 0.22s cubic-bezier(0.32, 0.72, 0, 1);
}
.modal-fade-leave-active {
  transition: opacity 0.16s cubic-bezier(0.4, 0, 1, 1);
}
.modal-fade-leave-active .base-modal-content {
  transition: transform 0.16s cubic-bezier(0.4, 0, 1, 1);
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-from .base-modal-content,
.modal-fade-leave-to .base-modal-content {
  transform: var(--modal-settle, translateY(8px) scale(0.98));
}
.modal-fade-enter-from.modal-position-bottom .base-modal-content,
.modal-fade-leave-to.modal-position-bottom .base-modal-content {
  transform: translateY(100%);
}

@media (max-width: 640px) {
  .base-modal-overlay.modal-position-center {
    align-items: flex-end;
    padding: 0;
  }

  .modal-position-center .base-modal-content {
    width: 100%;
    max-width: 100%;
    height: 90vh;
    max-height: 90vh;
    border-radius: var(--modal-radius-sheet, 20px 20px 0 0);
  }

  .modal-size-sm,
  .modal-size-md,
  .modal-size-lg,
  .modal-size-xl {
    max-width: 100%;
  }

  .modal-fade-enter-from .base-modal-content,
  .modal-fade-leave-to .base-modal-content {
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .base-modal-close,
  .modal-fade-enter-active,
  .modal-fade-leave-active,
  .modal-fade-enter-active .base-modal-content,
  .modal-fade-leave-active .base-modal-content {
    transition: none;
  }

  .modal-fade-enter-from .base-modal-content,
  .modal-fade-leave-to .base-modal-content {
    transform: none;
  }
}

[data-theme="dark"] .base-modal-content {
  border: 1px solid rgba(255, 255, 255, 0.06);
}

[data-theme="dark"] .base-modal-header {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}

[data-theme="dark"] .base-modal-footer {
  border-top-color: rgba(255, 255, 255, 0.06);
}
</style>
