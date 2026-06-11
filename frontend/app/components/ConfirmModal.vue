<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click="handleOverlayClick" @keydown.esc="emit('cancel')">
        <div ref="modalRef" class="modal-container" role="dialog" aria-modal="true" :aria-label="title" @click.stop>
          <div class="modal-header">
            <h3>{{ title }}</h3>
            <button @click="emit('cancel')" class="close-button" aria-label="닫기">
              <XMarkIcon :size="20" />
            </button>
          </div>
          <div class="modal-content">
            <slot />
          </div>
          <div class="modal-footer">
            <button v-if="showCancel" @click="emit('cancel')" class="modal-button">
              {{ cancelText }}
            </button>
            <button
              @click="emit('confirm')"
              :class="['modal-button', confirmVariant]"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import XMarkIcon from '~/components/icons/XMarkIcon.vue';
import { useFocusTrap } from '~/composables/useFocusTrap';

interface Props {
  show: boolean;
  title: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'danger';
  showCancel?: boolean;
  closeOnOverlay?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: '확인',
  cancelText: '취소',
  confirmVariant: 'primary',
  showCancel: true,
  closeOnOverlay: true
});

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const modalRef = ref<HTMLElement | null>(null);
const isOpen = computed(() => props.show);
useFocusTrap(modalRef, { enabled: isOpen });

const handleOverlayClick = () => {
  if (props.closeOnOverlay) {
    emit('cancel');
  }
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-overlay);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1100;
}

.modal-container {
  background-color: var(--color-modal-bg);
  border-radius: 0.5rem;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--color-border-default);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--color-modal-bg);
}

.modal-header h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.close-button {
  color: var(--color-text-secondary);
  padding: 0.25rem;
  border-radius: 0.25rem;
  transition: all 0.2s;
}

.close-button:hover {
  background-color: var(--color-bg-hover);
}

.modal-content {
  padding: 1.5rem 1rem;
  color: var(--color-text-primary);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid var(--color-border-default);
}

.modal-button {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  background-color: var(--color-button-default);
  color: var(--color-text-primary);
  transition: all 0.2s;
}

.modal-button:hover {
  background-color: var(--color-button-hover);
}

.modal-button.primary {
  background-color: var(--primary-color);
  color: white;
}

.modal-button.primary:hover {
  background-color: var(--primary-dark);
}

.modal-button.danger {
  background-color: var(--color-error);
  color: white;
}

.modal-button.danger:hover {
  filter: brightness(0.92);
}

/* Transition animations */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95);
}
</style>
