'use client'

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ToastContext } from '@/components/providers/ToastProvider'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface ToastInput {
  message: string
  variant?: ToastVariant
  duration?: number
}

export interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
  duration: number
  isDismissing: boolean
}

export interface ToastContextValue {
  toasts: ToastItem[]
  toast: (input: ToastInput) => string
  dismiss: (id: string) => void
}

const DEFAULT_DURATION = 3000
const DISMISS_ANIMATION_MS = 250

export function useToastState(): ToastContextValue {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const clearTimeoutById = useCallback((id: string) => {
    const timeout = timeoutRefs.current.get(id)
    if (!timeout) return

    clearTimeout(timeout)
    timeoutRefs.current.delete(id)
  }, [])

  const removeToast = useCallback(
    (id: string) => {
      clearTimeoutById(id)
      setToasts((prev) => prev.filter((item) => item.id !== id))
    },
    [clearTimeoutById]
  )

  const dismiss = useCallback(
    (id: string) => {
      clearTimeoutById(id)

      setToasts((prev) =>
        prev.map((item) => {
          if (item.id !== id || item.isDismissing) return item
          return { ...item, isDismissing: true }
        })
      )

      const removeTimeout = setTimeout(() => {
        removeToast(id)
      }, DISMISS_ANIMATION_MS)

      timeoutRefs.current.set(id, removeTimeout)
    },
    [clearTimeoutById, removeToast]
  )

  const toast = useCallback(
    ({ message, variant = 'info', duration = DEFAULT_DURATION }: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

      setToasts((prev) => [
        ...prev,
        {
          id,
          message,
          variant,
          duration,
          isDismissing: false,
        },
      ])

      const dismissTimeout = setTimeout(() => {
        dismiss(id)
      }, duration)

      timeoutRefs.current.set(id, dismissTimeout)
      return id
    },
    [dismiss]
  )

  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeoutId) => {
        clearTimeout(timeoutId)
      })
      timeoutRefs.current.clear()
    }
  }, [])

  return useMemo(
    () => ({
      toasts,
      toast,
      dismiss,
    }),
    [dismiss, toast, toasts]
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }

  return {
    toast: context.toast,
    dismiss: context.dismiss,
    toasts: context.toasts,
  }
}
