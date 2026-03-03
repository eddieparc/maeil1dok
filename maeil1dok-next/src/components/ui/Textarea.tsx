'use client'

import { TextareaHTMLAttributes } from 'react'
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
  ...props
}: TextareaProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
          {label}
        </label>
      )}
      <textarea
        disabled={disabled}
        className={cn(
          'w-full px-3 py-2 text-base rounded-lg',
          'bg-[var(--color-input-bg)] border border-[var(--color-input-border)]',
          'text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]',
          'transition-all duration-200 resize-vertical',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-input-focus)] focus:ring-offset-0 focus:border-[var(--color-input-focus)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-[var(--color-danger)] focus:ring-[var(--color-danger)] focus:border-[var(--color-danger)]',
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
