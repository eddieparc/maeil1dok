'use client'

import React from 'react'
import { cn } from '@/lib/utils'

type SkeletonVariant = 'text' | 'circular' | 'rectangular'

interface SkeletonProps {
  variant?: SkeletonVariant
  width?: string | number
  height?: string | number
  className?: string
}

const variantStyles: Record<SkeletonVariant, string> = {
  text: 'rounded',
  circular: 'rounded-full',
  rectangular: 'rounded-2xl',
}

export default function Skeleton({
  variant = 'text',
  width = '100%',
  height = '1rem',
  className,
}: SkeletonProps) {
  const widthStyle = typeof width === 'number' ? `${width}px` : width
  const heightStyle = typeof height === 'number' ? `${height}px` : height

  return (
    <div
      className={cn(
        'bg-[var(--color-rule)] animate-pulse',
        variantStyles[variant],
        className
      )}
      style={{
        width: widthStyle,
        height: heightStyle,
      }}
    />
  )
}
