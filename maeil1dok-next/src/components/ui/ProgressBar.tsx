'use client'

import React from 'react'
import { cn } from '@/lib/utils'

type ProgressVariant = 'primary' | 'brand' | 'success'

interface ProgressBarProps {
  value: number
  max?: number
  variant?: ProgressVariant
  showLabel?: boolean
  className?: string
}

const variantStyles: Record<ProgressVariant, string> = {
  primary: 'bg-[var(--color-ink)]',
  brand: 'bg-[var(--color-brand)]',
  success: 'bg-[var(--color-success)]',
}

export default function ProgressBar({
  value,
  max = 100,
  variant = 'primary',
  showLabel = false,
  className,
}: ProgressBarProps) {
  const clampedValue = Math.min(Math.max(value, 0), max)
  const percentage = (clampedValue / max) * 100

  return (
    <div className={cn('w-full', className)}>
      <div className="w-full h-1 bg-[var(--color-rule)] rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', variantStyles[variant])}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {showLabel && (
        <div className="mt-2 text-[11px] font-medium text-[var(--color-mute)] tabular-nums">
          {Math.round(percentage)}%
        </div>
      )}
    </div>
  )
}
