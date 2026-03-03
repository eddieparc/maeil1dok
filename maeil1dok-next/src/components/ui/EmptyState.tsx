'use client'

import React, { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
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
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-4 text-[var(--color-text-secondary)] text-4xl">
          {icon}
        </div>
      )}

      <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
        {title}
      </h3>

      <p className="text-sm text-[var(--color-text-secondary)] mb-6 max-w-sm">
        {description}
      </p>

      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg',
            'bg-[var(--color-primary)] text-white',
            'hover:opacity-90 active:opacity-80',
            'transition-all duration-200'
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
