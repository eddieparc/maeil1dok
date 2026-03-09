'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ToastItem, ToastType } from '@/hooks/useToast'

interface ToastProps {
  toasts: ToastItem[]
  dismiss: (id: string) => void
}

const typeStyles: Record<ToastType, string> = {
  success: 'bg-[var(--color-success-bg)] text-[var(--color-success-text)] border border-[var(--color-success)]',
  error: 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border border-[var(--color-danger)]',
  warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border border-[var(--color-warning)]',
  info: 'bg-[var(--color-info-bg)] text-[var(--color-info-text)] border border-[var(--color-info)]',
}

const typeIcon: Record<ToastType, typeof CheckCircle2> = {
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
        className="pointer-events-none fixed bottom-5 left-1/2 z-[9999] flex w-[calc(100%-2rem)] max-w-[400px] -translate-x-1/2 flex-col items-center gap-2"
      >
        {toasts.map((item) => {
          const Icon = typeIcon[item.variant]
          return (
            <div
              key={item.id}
              className={cn(
                'pointer-events-auto flex w-full items-center gap-3 rounded-[12px] px-4 py-3.5 shadow-lg transition-all duration-300',
                typeStyles[item.variant],
                item.isDismissing
                  ? 'translate-y-2 opacity-0'
                  : 'animate-[toast-slide-in_300ms_cubic-bezier(0.16,1,0.3,1)] opacity-100'
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
        @keyframes toast-slide-in {
          from {
            opacity: 0;
            transform: translateY(20px);
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
