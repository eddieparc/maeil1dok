'use client'

import { InputHTMLAttributes, useId } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

export default function Input({
  label,
  error,
  helperText,
  className,
  disabled,
  id: providedId,
  ...props
}: InputProps) {
  const generatedId = useId()
  const id = providedId || generatedId

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-[11px] font-medium text-[var(--color-mute)]"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-[9px] text-[13px] rounded-xl',
          'bg-[var(--color-paper)] border border-[var(--color-rule)]',
          'text-[var(--color-ink)] placeholder-[var(--color-subtle)]',
          'transition-all duration-150 -tracking-[0.008em]',
          'focus:outline-none focus-visible:border-[var(--color-ink)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-[var(--color-danger)] focus-visible:border-[var(--color-danger)]',
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-[11px] text-[var(--color-danger)]">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-[11px] text-[var(--color-subtle)]">{helperText}</p>
      )}
    </div>
  )
}
