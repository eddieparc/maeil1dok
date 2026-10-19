import { useModalState } from './useModalState'
import type { ConfirmOptions, AlertOptions, UseModalReturn } from '~/types/modal'

// Built-in dialogs are imported statically: a lazy chunk made the scrim animate
// over an empty panel until the chunk arrived, and callers rely on confirm()
// joining the stack synchronously (they capture the top modal right after).
import ConfirmModal from '~/components/ui/modal/ConfirmModal.vue'
import AlertModal from '~/components/ui/modal/AlertModal.vue'

export function useModal(): UseModalReturn {
  const state = useModalState()

  async function confirm(options: ConfirmOptions): Promise<boolean> {
    try {
      const result = await state.open<boolean>(ConfirmModal, {
        size: 'sm',
        position: 'center',
        closeOnEsc: true,
        closeOnOverlay: true,
        showCloseButton: false,
        props: {
          title: options.title,
          description: options.description,
          confirmText: options.confirmText || '확인',
          cancelText: options.cancelText || '취소',
          confirmVariant: options.confirmVariant || 'primary',
          icon: options.icon
        }
      })
      return result ?? false
    } catch {
      return false
    }
  }

  async function alert(options: AlertOptions): Promise<void> {
    try {
      await state.open<void>(AlertModal, {
        size: 'sm',
        position: 'center',
        closeOnEsc: true,
        closeOnOverlay: true,
        showCloseButton: false,
        props: {
          title: options.title,
          description: options.description,
          confirmText: options.confirmText || '확인',
          icon: options.icon,
          copyText: options.copyText
        }
      })
    } catch {
      // Dismissing an alert is not an error.
    }
  }

  return {
    open: state.open,
    close: state.close,
    cancel: state.cancel,
    update: state.update,
    confirm,
    alert,
    stack: state.stack,
    isOpen: state.isOpen,
    isModalOpen: state.isModalOpen
  }
}

export default useModal
