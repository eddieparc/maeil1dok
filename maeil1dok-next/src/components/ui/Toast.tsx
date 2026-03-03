'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ToastItem, ToastVariant } from '@/hooks/useToast'

interface ToastProps {
  toasts: ToastItem[]
  dismiss: (id: string) => void
}

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-[var(--color-success)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]',
  error: 'border-[var(--color-danger)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]',
  warning: 'border-[var(--color-warning)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
  info: 'border-[var(--color-info)] bg-[var(--color-info-bg)] text-[var(--color-info-text)]',
}

const variantIcon: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

export function Toast({ toasts, dismiss }: ToastProps) {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted || toasts.length === 0) {
    return null
  }

  return createPortal(
    <>
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col items-center gap-2"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}
      >
        {toasts.map((item) => {
          const Icon = variantIcon[item.variant]
          return (
            <div
              key={item.id}
              className={cn(
                'pointer-events-auto flex w-full items-center gap-3 rounded-xl border px-4 py-3 shadow-[var(--shadow-lg)] transition-all duration-250',
                variantStyles[item.variant],
                item.isDismissing
                  ? 'translate-y-2 opacity-0'
                  : 'animate-[toast-slide-up_220ms_ease-out] opacity-100'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <p className="flex-1 text-sm font-medium leading-normal">{item.message}</p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded-md p-1 opacity-70 transition-opacity hover:opacity-100"
                aria-label="알림 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </div>
      <style jsx global>{`
        @keyframes toast-slide-up {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </>,
    document.body
  )
}
