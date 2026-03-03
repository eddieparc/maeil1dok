'use client'

import React, { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ContainerProps {
  children: ReactNode
  className?: string
  fullHeight?: boolean
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

/**
 * Container component - Max-width wrapper with design token background
 * Replaces inline style={{ backgroundColor: '#F9F8F6', minHeight: '100vh' }}
 * 
 * @param children - Content to wrap
 * @param className - Additional CSS classes
 * @param fullHeight - If true, adds min-h-screen for full viewport height
 * @param maxWidth - Max-width variant: 'sm' | 'md' | 'lg' | 'xl' | 'full' (default: 'xl')
 */
export default function Container({
  children,
  className,
  fullHeight = false,
  maxWidth = 'xl',
}: ContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto px-4',
        'bg-[var(--color-bg-primary)]',
        maxWidth === 'sm' && 'max-w-screen-sm',
        maxWidth === 'md' && 'max-w-screen-md',
        maxWidth === 'lg' && 'max-w-screen-lg',
        maxWidth === 'xl' && 'max-w-screen-xl',
        maxWidth === 'full' && 'max-w-full',
        fullHeight && 'min-h-screen',
        className
      )}
    >
      {children}
    </div>
  )
}
