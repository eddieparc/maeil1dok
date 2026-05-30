'use client'

import React, { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type CardVariant = 'default' | 'elevated' | 'bordered' | 'faint'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  variant?: CardVariant
  className?: string
}

interface CardSubComponentProps {
  children: ReactNode
  className?: string
}

const variantStyles: Record<CardVariant, string> = {
  default:
    'bg-[var(--color-paper)] border border-[var(--color-rule)]',
  elevated:
    'bg-[var(--color-paper)] border border-[var(--color-rule)] shadow-[var(--shadow-card)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)]',
  bordered:
    'bg-[var(--color-paper)] border-2 border-[var(--color-rule)]',
  faint:
    'bg-[var(--color-brand-faint)] border border-[var(--color-brand-faint-border)]',
}

export function Card({ children, variant = 'default', className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden transition-[transform,box-shadow] duration-[var(--duration-fade)]',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: CardSubComponentProps) {
  return (
    <div
      className={cn(
        'px-5 py-4 border-b border-[var(--color-rule)]',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardBody({ children, className }: CardSubComponentProps) {
  return (
    <div className={cn('p-5', className)}>{children}</div>
  )
}

export function CardFooter({ children, className }: CardSubComponentProps) {
  return (
    <div
      className={cn(
        'px-5 py-4 border-t border-[var(--color-rule)] bg-[var(--color-paper-warm)]',
        className
      )}
    >
      {children}
    </div>
  )
}
