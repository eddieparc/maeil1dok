'use client'

import React, { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  variant?: 'default' | 'empty' | 'error'
  action?: {
    label: string
    onClick: () => void
  }
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export default function EmptyState({
  icon,
  title,
  description,
  variant = 'default',
  action,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  const getIconStyles = () => {
    if (variant === 'error') {
      return 'mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger)]'
    }
    return 'mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-brand-faint)] text-[var(--color-brand)]'
  }

  const buttonLabel = actionLabel || action?.label
  const buttonHandler = onAction || action?.onClick
  const showButton = !!(buttonLabel && buttonHandler)

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      {icon && <div className={getIconStyles()}>{icon}</div>}

      <h3
        className="text-[18px] font-medium text-[var(--color-ink)] -tracking-[0.02em] mb-1.5"
        style={{ fontFamily: 'var(--font-family-serif)' }}
      >
        {title}
      </h3>

      {description && (
        <p className="text-[13px] text-[var(--color-mute)] -tracking-[0.008em] mb-6 max-w-sm">
          {description}
        </p>
      )}

      {showButton && (
        <button
          type="button"
          onClick={buttonHandler}
          className={cn(
            'inline-flex items-center justify-center px-[17px] py-[9px] text-[13px] font-semibold rounded-full',
            'bg-[var(--color-ink)] text-[var(--color-paper)] border border-[var(--color-ink)]',
            '-tracking-[0.012em] transition-all duration-150',
            'hover:opacity-90 active:opacity-80 active:scale-[0.98]'
          )}
        >
          {buttonLabel}
        </button>
      )}
    </div>
  )
}
