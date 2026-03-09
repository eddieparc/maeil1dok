'use client'

import { cn } from '@/lib/utils'

interface TongdokProgressBarProps {
  tongdokProgress: { completed: number; total: number }
}

export default function TongdokProgressBar({ tongdokProgress }: TongdokProgressBarProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border-default)]">
      <div className="story-progress-segments">
        {Array.from({ length: tongdokProgress.total }, (_, segment) => segment + 1).map((segment) => (
          <div
            key={`progress-${segment}`}
            className={cn(
              'progress-segment',
              segment <= tongdokProgress.completed && 'filled',
              segment === tongdokProgress.completed + 1 && 'current',
            )}
          />
        ))}
      </div>
      <span className="text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap min-w-[2rem] text-right tabular-nums">
        {tongdokProgress.completed}/{tongdokProgress.total}
      </span>
    </div>
  )
}
