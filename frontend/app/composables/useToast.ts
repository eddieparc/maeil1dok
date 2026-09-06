import { DEFAULT_TOAST_DURATION, useToastState } from './useToastState'
import type { ToastOptions, ToastType, PromiseToastOptions, UseToastReturn } from '~/types/toast'

export function useToast(): UseToastReturn {
  const state = useToastState()

  function show(options: ToastOptions | string): string {
    return state.show(options)
  }

  function info(message: string, options?: Partial<ToastOptions>): string {
    return state.show({ ...options, message, type: 'info' })
  }

  function success(message: string, options?: Partial<ToastOptions>): string {
    return state.show({ ...options, message, type: 'success' })
  }

  function warning(message: string, options?: Partial<ToastOptions>): string {
    return state.show({ ...options, message, type: 'warning' })
  }

  function error(message: string, options?: Partial<ToastOptions>): string {
    return state.show({ ...options, message, type: 'error' })
  }

  function dismiss(id?: string): void {
    state.dismiss(id)
  }

  function dismissAll(): void {
    state.dismissAll()
  }

  async function promise<T>(
    promiseOrFn: Promise<T>,
    options: PromiseToastOptions<T>
  ): Promise<T> {
    const id = state.show({
      message: options.loading,
      type: 'info',
      duration: 0, // 자동 닫힘 안 함
      dismissible: false
    })

    try {
      const result = await promiseOrFn

      const successMessage = typeof options.success === 'function'
        ? options.success(result)
        : options.success

      state.update(id, {
        message: successMessage,
        type: 'success',
        duration: DEFAULT_TOAST_DURATION,
        dismissible: true
      })

      return result
    } catch (err) {
      const errorMessage = typeof options.error === 'function'
        ? options.error(err as Error)
        : options.error

      state.update(id, {
        message: errorMessage,
        type: 'error',
        duration: DEFAULT_TOAST_DURATION,
        dismissible: true
      })

      throw err
    }
  }

  // ============================================
  // 기존 API 호환용 (deprecated)
  // ============================================

  /**
   * @deprecated showToastMessage 대신 success(), error(), info(), warning() 사용 권장
   */
  function showToastMessage(message: string, type: ToastType = 'success'): string {
    return state.show({ message, type })
  }

  /**
   * @deprecated remove 대신 dismiss 사용 권장
   */
  function remove(id: number | string): void {
    state.dismiss(String(id))
  }

  return {
    show,
    info,
    success,
    warning,
    error,
    dismiss,
    dismissAll,
    promise,
    toasts: state.toasts,
    // 기존 API 호환
    showToastMessage,
    remove
  }
}

// 기본 export
export default useToast
