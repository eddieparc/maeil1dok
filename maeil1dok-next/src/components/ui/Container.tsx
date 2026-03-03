'use client'

import React, { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ContainerProps {
  children: ReactNode
  className?: string
  fullHeight?: boolean
}

/**
 * Container component - Max-width wrapper with design token background
 * Replaces inline style={{ backgroundColor: '#F9F8F6', minHeight: '100vh' }}
 * 
 * @param children - Content to wrap
 * @param className - Additional CSS classes
 * @param fullHeight - If true, adds min-h-screen for full viewport height
 */
export default function Container({
  children,
  className,
  fullHeight = false,
}: ContainerProps) {
  return (
    <div
      className={cn(
        'max-w-lg mx-auto px-4',
        'bg-[var(--color-bg-primary)]',
        fullHeight && 'min-h-screen',
        className
      )}
    >
      {children}
    </div>
  )
}
