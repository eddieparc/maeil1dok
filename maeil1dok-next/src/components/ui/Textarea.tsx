'use client'

import { TextareaHTMLAttributes } from 'react'
import { useId } from 'react'
import { cn } from '@/lib/utils'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

export default function Textarea({
  label,
  error,
  helperText,
  className,
  disabled,
  id: providedId,
  ...props
}: TextareaProps) {
  const generatedId = useId()
  const id = providedId || generatedId

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
          {label}
        </label>
      )}
      <textarea
        id={id}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-2 text-base rounded-lg',
          'bg-[var(--color-input-bg)] border border-[var(--color-input-border)]',
          'text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]',
          'transition-all duration-200 resize-vertical',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30 focus-visible:border-[var(--color-primary)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-[var(--color-danger)] focus-visible:ring-[var(--color-danger)]/30 focus-visible:border-[var(--color-danger)]',
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-[var(--color-danger)]">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-sm text-[var(--color-text-tertiary)]">{helperText}</p>
      )}
    </div>
  )
}
