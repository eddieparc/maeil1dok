import { computed, defineAsyncComponent, type Component } from 'vue'
import { useModalState } from './useModalState'
import type { ModalOptions, ConfirmOptions, AlertOptions, UseModalReturn } from '~/types/modal'

// 내장 모달 컴포넌트 (lazy load)
const ConfirmModal = defineAsyncComponent(() => import('~/components/ui/modal/ConfirmModal.vue'))
const AlertModal = defineAsyncComponent(() => import('~/components/ui/modal/AlertModal.vue'))

export function useModal(): UseModalReturn {
  const state = useModalState()

  async function confirm(options: ConfirmOptions): Promise<boolean> {
    try {
      const result = await state.open<boolean>(ConfirmModal, {
        size: 'sm',
        position: 'center',
        closeOnEsc: false,
        closeOnOverlay: false,
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
        closeOnEsc: false,
        closeOnOverlay: false,
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
      // Alert 취소는 무시
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

// 기본 export
export default useModal
