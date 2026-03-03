'use client'

import React from 'react'
import { cn } from '@/lib/utils'

type ProgressVariant = 'primary' | 'success'

interface ProgressBarProps {
  value: number
  max?: number
  variant?: ProgressVariant
  showLabel?: boolean
  className?: string
}

const variantStyles: Record<ProgressVariant, string> = {
  primary: 'bg-[var(--color-primary)]',
  success: 'bg-[var(--color-success)]',
}

/**
 * ProgressBar component - Horizontal progress indicator
 * Displays fill percentage with animated transition
 * Variants: primary, success
 * Can show percentage label
 */
export default function ProgressBar({
  value,
  max = 100,
  variant = 'primary',
  showLabel = false,
  className,
}: ProgressBarProps) {
  // Clamp value between 0 and max
  const clampedValue = Math.min(Math.max(value, 0), max)
  const percentage = (clampedValue / max) * 100

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'w-full h-2 bg-[var(--color-bg-tertiary)] dark:bg-[var(--color-bg-secondary)] rounded-full overflow-hidden'
        )}
      >
        <div
          className={cn(
            'h-full transition-all duration-500 ease-out',
            variantStyles[variant]
          )}
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>

      {showLabel && (
        <div className="mt-2 text-sm font-medium text-[var(--color-text-secondary)]">
          {Math.round(percentage)}%
        </div>
      )}
    </div>
  )
}
