'use client'

import React, { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type CardVariant = 'default' | 'elevated' | 'bordered'

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
  default: 'bg-[var(--color-bg-card)] border border-[var(--color-border-default)] dark:bg-[var(--color-bg-secondary)] dark:border-[var(--color-border-default)]',
  elevated: 'bg-[var(--color-bg-card)] shadow-[var(--shadow-card)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] dark:bg-[var(--color-bg-secondary)] dark:shadow-[var(--shadow-card)]',
  bordered: 'bg-[var(--color-bg-card)] border-2 border-[var(--color-border-dark)] dark:bg-[var(--color-bg-secondary)] dark:border-[var(--color-border-dark)]',
}

/**
 * Card component with three variants: default, elevated, and bordered
 * Supports composable sub-components: CardHeader, CardBody, CardFooter
 */
export function Card({ children, variant = 'default', className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden transition-[transform,shadow] duration-[var(--duration-fade)]',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * CardHeader - Top section of the card
 * Typically used for titles and descriptions
 */
export function CardHeader({ children, className }: CardSubComponentProps) {
  return (
    <div
      className={cn(
        'px-6 py-4 border-b border-[var(--color-border-default)] dark:border-[var(--color-border-default)]',
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * CardBody - Main content section of the card
 * Primary area for card content
 */
export function CardBody({ children, className }: CardSubComponentProps) {
  return (
    <div
      className={cn(
        'p-5',
        className
      )}
    >
      {children}
    </div>
  )
}

/**
 * CardFooter - Bottom section of the card
 * Typically used for actions or additional information
 */
export function CardFooter({ children, className }: CardSubComponentProps) {
  return (
    <div
      className={cn(
        'px-6 py-4 border-t border-[var(--color-border-default)] dark:border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] dark:bg-[var(--color-bg-tertiary)]',
        className
      )}
    >
      {children}
    </div>
  )
}
