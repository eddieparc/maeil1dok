import { ref, computed } from 'vue'
import type { ToastInstance, ToastOptions } from '~/types/toast'

const toastList = ref<ToastInstance[]>([])
let idCounter = 0
let dismissTimer: ReturnType<typeof setTimeout> | undefined
export const DEFAULT_TOAST_DURATION = 1800

function clearDismissTimer(): void {
  if (dismissTimer !== undefined) clearTimeout(dismissTimer)
  dismissTimer = undefined
}

export function useToastState() {
  const toasts = computed(() => toastList.value)

  function scheduleDismiss(toast: ToastInstance): void {
    clearDismissTimer()
    if (toast.duration > 0) {
      dismissTimer = setTimeout(() => dismiss(toast.id), toast.duration)
    }
  }

  function show(options: ToastOptions | string): string {
    const opts = typeof options === 'string' ? { message: options } : options
    const instance: ToastInstance = {
      ...opts,
      id: opts.id || `toast-${++idCounter}-${Date.now()}`,
      type: opts.type || 'info',
      duration: opts.duration ?? DEFAULT_TOAST_DURATION,
      dismissible: opts.dismissible ?? true,
      showIcon: opts.showIcon ?? true,
      createdAt: Date.now()
    }
    // One visible toast, including same-id replacements, owns exactly one timer.
    toastList.value = [instance]
    scheduleDismiss(instance)
    return instance.id
  }

  function dismiss(id?: string): void {
    if (id && toastList.value[0]?.id !== id) return
    clearDismissTimer()
    toastList.value = []
  }

  function dismissAll(): void {
    dismiss()
  }

  function update(id: string, updates: Partial<ToastOptions>): void {
    const current = toastList.value[0]
    // Settling a superseded promise must not resurrect an older toast.
    if (!current || current.id !== id) return
    const instance: ToastInstance = {
      ...current,
      ...updates,
      id,
      duration: updates.duration ?? current.duration,
      createdAt: Date.now()
    }
    toastList.value = [instance]
    scheduleDismiss(instance)
  }

  return { toasts, show, dismiss, dismissAll, update }
}
