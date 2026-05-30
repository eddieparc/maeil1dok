'use client'

import React, { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}

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
      <div className="flex-1 min-w-0">
        <h1
          className="text-[28px] font-medium text-[var(--color-ink)] -tracking-[0.03em] leading-[1.2] mb-1"
          style={{ fontFamily: 'var(--font-family-serif)' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-[13px] text-[var(--color-mute)] -tracking-[0.008em]">
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
