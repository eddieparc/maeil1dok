'use client'

import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md'
  className?: string
  title?: string
  children: React.ReactNode
}

const variants = {
  default: 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]',
  primary: 'bg-[var(--color-accent-light)] text-[var(--color-primary)]',
  success: 'bg-[var(--color-success-bg)] text-[var(--color-success-text)]',
  warning: 'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]',
  danger: 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]',
}

const sizes = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
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
        'inline-flex items-center font-medium rounded-full',
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
