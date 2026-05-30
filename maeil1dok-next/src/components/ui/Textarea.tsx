'use client'

import { TextareaHTMLAttributes, useId } from 'react'
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
        <label htmlFor={id} className="mb-1.5 block text-[11px] font-medium text-[var(--color-mute)]">
          {label}
        </label>
      )}
      <textarea
        id={id}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-[9px] text-[13px] rounded-xl resize-vertical',
          'bg-[var(--color-paper)] border border-[var(--color-rule)]',
          'text-[var(--color-ink)] placeholder-[var(--color-subtle)] -tracking-[0.008em]',
          'transition-all duration-150',
          'focus:outline-none focus-visible:border-[var(--color-ink)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-[var(--color-danger)] focus-visible:border-[var(--color-danger)]',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-[11px] text-[var(--color-danger)]">{error}</p>}
      {helperText && !error && (
        <p className="mt-1 text-[11px] text-[var(--color-subtle)]">{helperText}</p>
      )}
    </div>
  )
}
