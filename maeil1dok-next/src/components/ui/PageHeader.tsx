'use client'

import React, { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}

/**
 * PageHeader component - Page title with optional subtitle and action button area
 * Provides consistent spacing and typography for page headers
 * 
 * @param title - Main page title (required)
 * @param subtitle - Optional subtitle text
 * @param action - Optional action button or element (e.g., button, icon)
 * @param className - Additional CSS classes
 */
export default function PageHeader({
  title,
  subtitle,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 py-6',
        className
      )}
    >
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-[var(--color-text-secondary)]">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <div className="flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  )
}
