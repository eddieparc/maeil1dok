'use client'

import { type ConfirmVariant, type ModalIcon, useModal } from '@/hooks/useModal'
import { cn } from '@/lib/utils'

interface ConfirmModalProps {
  modalId: string
  title: string
  description?: string
  confirmText: string
  cancelText: string
  confirmVariant: ConfirmVariant
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

export function ConfirmModal({
  modalId,
  title,
  description,
  confirmText,
  cancelText,
  confirmVariant,
  icon,
}: ConfirmModalProps) {
  const modal = useModal()

  return (
    <div className="p-6 text-center" data-testid="confirm-modal">
      {icon ? (
        <div
          className={cn('mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-2xl', ICON_STYLE[icon])}
          aria-hidden="true"
        >
          {ICON_TEXT[icon]}
        </div>
      ) : null}

      <h3 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]" data-testid="confirm-modal-title">
        {title}
      </h3>

      {description ? (
        <p className="mb-6 text-sm leading-6 text-[var(--color-text-secondary)]" data-testid="confirm-modal-description">
          {description}
        </p>
      ) : null}

      <div className="flex gap-3">
        <button
          type="button"
          className="flex-1 rounded-lg bg-[var(--color-bg-tertiary)] px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-button-hover)]"
          onClick={() => modal.cancel(modalId)}
          data-testid="confirm-modal-cancel"
        >
          {cancelText}
        </button>
        <button
          type="button"
          className={cn(
            'flex-1 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-colors',
            confirmVariant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)]',
          )}
          onClick={() => modal.close(modalId, true)}
          data-testid="confirm-modal-confirm"
        >
          {confirmText}
        </button>
      </div>
    </div>
  )
}
