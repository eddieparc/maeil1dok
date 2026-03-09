'use client'

import { SelectHTMLAttributes, ReactNode } from 'react'
import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
  children: ReactNode
}

export default function Select({
  label,
  error,
  helperText,
  className,
  disabled,
  children,
  id: providedId,
  ...props
}: SelectProps) {
  const generatedId = useId()
  const id = providedId || generatedId

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          disabled={disabled}
          className={cn(
            'w-full px-3 py-2 text-base rounded-lg appearance-none',
            'bg-[var(--color-input-bg)] border border-[var(--color-input-border)]',
            'text-[var(--color-text-primary)]',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'pr-10',
            error && 'border-[var(--color-danger)] focus:ring-[var(--color-danger)]/30 focus:border-[var(--color-danger)]',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4',
            'text-[var(--color-text-tertiary)] pointer-events-none',
            disabled && 'opacity-50'
          )}
        />
      </div>
      {error && (
        <p className="mt-1 text-sm text-[var(--color-danger)]">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">{helperText}</p>
      )}
    </div>
  )
}
