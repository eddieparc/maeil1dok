'use client'

import { SelectHTMLAttributes, ReactNode, useId } from 'react'
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
        <label htmlFor={id} className="mb-1.5 block text-[11px] font-medium text-[var(--color-mute)]">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          disabled={disabled}
          className={cn(
            'w-full px-3 py-[9px] pr-10 text-[13px] rounded-xl appearance-none',
            'bg-[var(--color-paper)] border border-[var(--color-rule)]',
            'text-[var(--color-ink)] -tracking-[0.008em]',
            'transition-all duration-150',
            'focus:outline-none focus-visible:border-[var(--color-ink)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-[var(--color-danger)] focus-visible:border-[var(--color-danger)]',
            className
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          className={cn(
            'absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4',
            'text-[var(--color-subtle)] pointer-events-none',
            disabled && 'opacity-50'
          )}
        />
      </div>
      {error && <p className="mt-1 text-[11px] text-[var(--color-danger)]">{error}</p>}
      {helperText && !error && (
        <p className="mt-1 text-[11px] text-[var(--color-subtle)]">{helperText}</p>
      )}
    </div>
  )
}
