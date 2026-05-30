'use client'

import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'solid' | 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'outline' | 'primary'
  size?: 'sm' | 'md'
  className?: string
  title?: string
  children: React.ReactNode
}

const variants = {
  default: 'bg-[var(--color-brand-faint)] text-[var(--color-brand)]',
  solid: 'bg-[var(--color-ink)] text-[var(--color-paper)]',
  brand: 'bg-[var(--color-brand)] text-[var(--color-paper)]',
  primary: 'bg-[var(--color-brand-faint)] text-[var(--color-brand)]',
  success: 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]',
  warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
  danger: 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]',
  info: 'bg-[var(--color-info-bg)] text-[var(--color-info-text)]',
  outline: 'bg-transparent text-[var(--color-ink)] border border-[var(--color-rule)]',
}

const sizes = {
  sm: 'px-[7px] py-[2px] text-[10px]',
  md: 'px-[9px] py-[3px] text-[11px]',
}

export default function Badge({
  variant = 'default',
  size = 'md',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-semibold rounded-full -tracking-[0.005em]',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}
