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

/**
 * Container component - Max-width wrapper with design token background
 * Replaces inline style={{ backgroundColor: '#F9F8F6', minHeight: '100vh' }}
 * 
 * @param children - Content to wrap
 * @param className - Additional CSS classes
 * @param fullHeight - If true, adds min-h-screen for full viewport height
 * @param maxWidth - Max-width variant:
 *   - 'default': max-w-screen-xl (default, full-width pages)
 *   - 'content': max-w-[768px] (Groups, Friends, Scoreboard, etc.)
 *   - 'narrow': max-w-md (Reading, focused content)
 *   - 'sm' | 'md' | 'lg' | 'xl' | 'full' (legacy variants)
 * @param safePadding - If true, adds pb-[env(safe-area-inset-bottom)] for mobile notch support
 */
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
        'bg-[var(--color-bg-primary)]',
        // New semantic variants
        maxWidth === 'default' && 'max-w-screen-xl',
        maxWidth === 'content' && 'max-w-[768px]',
        maxWidth === 'narrow' && 'max-w-md',
        // Legacy variants (deprecated, kept for backward compatibility)
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
