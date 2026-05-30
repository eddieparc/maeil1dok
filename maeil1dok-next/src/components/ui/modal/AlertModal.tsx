'use client'

import { type ModalIcon, useModal } from '@/hooks/useModal'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AlertModalProps {
  modalId: string
  title: string
  description?: string
  confirmText: string
  icon?: ModalIcon
}

const ICON_STYLE: Record<ModalIcon, string> = {
  warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  error: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
  info: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  success: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
}

const ICON_COMPONENT: Record<ModalIcon, typeof AlertTriangle> = {
  warning: AlertTriangle,
  error: XCircle,
  info: Info,
  success: CheckCircle2,
}

export function AlertModal({ modalId, title, description, confirmText, icon }: AlertModalProps) {
  const modal = useModal()
  const Icon = icon ? ICON_COMPONENT[icon] : null

  return (
    <div className="p-6 text-center" data-testid="alert-modal">
      {icon && Icon ? (
        <div
          className={cn(
            'mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full',
            ICON_STYLE[icon],
          )}
          aria-hidden="true"
        >
          <Icon className="h-6 w-6" strokeWidth={1.8} />
        </div>
      ) : null}

      <h3
        className="mb-2 text-[18px] font-medium text-[var(--color-ink)] -tracking-[0.02em] leading-[1.3]"
        style={{ fontFamily: 'var(--font-family-serif)' }}
        data-testid="alert-modal-title"
      >
        {title}
      </h3>

      {description ? (
        <p
          className="mb-6 text-[13px] leading-[1.5] text-[var(--color-mute)] -tracking-[0.008em]"
          data-testid="alert-modal-description"
        >
          {description}
        </p>
      ) : null}

      <button
        type="button"
        className="w-full rounded-full bg-[var(--color-ink)] px-4 py-3 text-[13px] font-semibold text-[var(--color-paper)] -tracking-[0.012em] transition-all duration-150 hover:opacity-90 active:opacity-80 active:scale-[0.98]"
        onClick={() => modal.close(modalId)}
        data-testid="alert-modal-confirm"
      >
        {confirmText}
      </button>
    </div>
  )
}
