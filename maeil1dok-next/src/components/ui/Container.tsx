'use client'

import React, { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ContainerProps {
  children: ReactNode
  className?: string
  fullHeight?: boolean
  maxWidth?: 'default' | 'content' | 'narrow' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
  safePadding?: boolean
}

export default function Container({
  children,
  className,
  fullHeight = false,
  maxWidth = 'default',
  safePadding = false,
}: ContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto px-4 md:px-5 lg:px-6',
        'bg-[var(--color-paper-warm)]',
        maxWidth === 'default' && 'max-w-screen-xl',
        maxWidth === 'content' && 'max-w-[768px]',
        maxWidth === 'narrow' && 'max-w-md',
        maxWidth === 'sm' && 'max-w-screen-sm',
        maxWidth === 'md' && 'max-w-screen-md',
        maxWidth === 'lg' && 'max-w-screen-lg',
        maxWidth === 'xl' && 'max-w-screen-xl',
        maxWidth === 'full' && 'max-w-full',
        fullHeight && 'min-h-screen',
        safePadding && 'pb-[env(safe-area-inset-bottom)]',
        className
      )}
    >
      {children}
    </div>
  )
}
