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

/**
 * EmptyState component - Display when no data is available
 * Shows icon, title, description, and optional action button
 * Used for empty lists, no data states, etc.
 */
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
  // Determine icon styling based on variant
  const getIconStyles = () => {
    const baseStyles = 'mb-4 text-4xl'
    
    if (variant === 'error') {
      return cn(
        baseStyles,
        'text-[var(--color-danger)]',
        'bg-[var(--color-danger-bg)] rounded-full p-3'
      )
    }
    
    return cn(baseStyles, 'text-[var(--color-text-secondary)]')
  }

  // Determine button to render (prefer new props over legacy action)
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
      {icon && (
        <div className={getIconStyles()}>
          {icon}
        </div>
      )}

      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-[var(--color-text-secondary)] mb-6 max-w-sm">
          {description}
        </p>
      )}

      {showButton && (
        <button
          type="button"
          onClick={buttonHandler}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg',
            'bg-[var(--color-primary)] text-white',
            'hover:opacity-90 active:opacity-80',
            'transition-all duration-200'
          )}
        >
          {buttonLabel}
        </button>
      )}
    </div>
  )
}
