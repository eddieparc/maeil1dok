'use client'

import { type ModalIcon, useModal } from '@/hooks/useModal'
import { cn } from '@/lib/utils'

interface AlertModalProps {
  modalId: string
  title: string
  description?: string
  confirmText: string
  icon?: ModalIcon
}

const ICON_STYLE: Record<ModalIcon, string> = {
  warning: 'bg-amber-100 text-amber-600',
  error: 'bg-red-100 text-red-600',
  info: 'bg-blue-100 text-blue-600',
  success: 'bg-emerald-100 text-emerald-600',
}

const ICON_TEXT: Record<ModalIcon, string> = {
  warning: '⚠️',
  error: '❌',
  info: 'ℹ️',
  success: '✅',
}

export function AlertModal({ modalId, title, description, confirmText, icon }: AlertModalProps) {
  const modal = useModal()

  return (
    <div className="p-6 text-center" data-testid="alert-modal">
      {icon ? (
        <div
          className={cn('mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-2xl', ICON_STYLE[icon])}
          aria-hidden="true"
        >
          {ICON_TEXT[icon]}
        </div>
      ) : null}

      <h3 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]" data-testid="alert-modal-title">
        {title}
      </h3>

      {description ? (
        <p className="mb-6 text-sm leading-6 text-[var(--color-text-secondary)]" data-testid="alert-modal-description">
          {description}
        </p>
      ) : null}

      <button
        type="button"
        className="w-full rounded-lg bg-[var(--color-accent-primary)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)]"
        onClick={() => modal.close(modalId)}
        data-testid="alert-modal-confirm"
      >
        {confirmText}
      </button>
    </div>
  )
}
