'use client'

import { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
  children: ReactNode
}

const variants = {
  primary:
    'bg-[var(--color-ink)] text-[var(--color-paper)] border border-[var(--color-ink)] hover:opacity-90 active:opacity-80',
  secondary:
    'bg-[var(--color-brand)] text-[var(--color-paper)] border border-[var(--color-brand)] hover:bg-[var(--color-brand-deep)] active:opacity-90',
  outline:
    'bg-transparent text-[var(--color-ink)] border border-[var(--color-rule)] hover:bg-[var(--color-brand-faint)] active:bg-[var(--color-brand-faint-border)]',
  ghost:
    'bg-transparent text-[var(--color-ink)] border border-transparent hover:bg-[var(--color-brand-faint)] active:bg-[var(--color-brand-faint-border)]',
  danger:
    'bg-[var(--color-danger)] text-[var(--color-paper)] border border-[var(--color-danger)] hover:opacity-90 active:opacity-80',
}

const sizes = {
  sm: 'px-[13px] py-1.5 text-xs',
  md: 'px-[17px] py-[9px] text-[13px]',
  lg: 'px-[22px] py-3 text-sm',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  className,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 font-semibold rounded-full transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
        '-tracking-[0.012em]',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {children}
    </button>
  )
}
