'use client'

import type { DailyStatusData } from '@/types'
import { cn } from '@/lib/utils'

interface DailyStatusProps {
  data: DailyStatusData | null
}

function CheckItem({
  label,
  completed,
  'data-testid': testId,
}: {
  label: string
  completed: boolean
  'data-testid': string
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
        completed
          ? 'bg-[var(--color-accent-light)] text-[var(--color-accent-primary)]'
          : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
      )}
    >
      <span className={completed ? 'text-[var(--color-accent-primary)]' : 'text-[var(--color-text-secondary)]'}>
        {completed ? '✓' : '○'}
      </span>
      <span>{label}</span>
    </div>
  )
}

function SkeletonLoader() {
  return (
    <div
      className={cn(
        'mb-4 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-4 shadow-[var(--shadow-card)]',
      )}
    >
      {/* Profile Stats Row */}
      <div className="mb-3 flex justify-around">
        <div className="text-center">
          <div className="mx-auto mb-1 h-8 w-12 animate-pulse rounded bg-[var(--color-border-default)]" />
          <div className="mx-auto h-3 w-12 animate-pulse rounded bg-[var(--color-border-default)]" />
        </div>
        <div className="text-center">
          <div className="mx-auto mb-1 h-8 w-12 animate-pulse rounded bg-[var(--color-border-default)]" />
          <div className="mx-auto h-3 w-12 animate-pulse rounded bg-[var(--color-border-default)]" />
        </div>
        <div className="text-center">
          <div className="mx-auto mb-1 h-8 w-12 animate-pulse rounded bg-[var(--color-border-default)]" />
          <div className="mx-auto h-3 w-12 animate-pulse rounded bg-[var(--color-border-default)]" />
        </div>
      </div>

      {/* Today's Checklist */}
      <div className="border-t border-[var(--color-border-default)] pt-3">
        <div className="mb-2 h-3 w-16 animate-pulse rounded bg-[var(--color-border-default)]" />
        <div className="flex gap-3">
          <div className="h-4 w-16 animate-pulse rounded bg-[var(--color-border-default)]" />
          <div className="h-4 w-16 animate-pulse rounded bg-[var(--color-border-default)]" />
          <div className="h-4 w-16 animate-pulse rounded bg-[var(--color-border-default)]" />
        </div>
      </div>
    </div>
  )
}

const EMPTY_STATUS: DailyStatusData = {
  currentStreak: 0,
  totalCompletedDays: 0,
  longestStreak: 0,
  readingCompleted: false,
  hasenaCompleted: false,
  introCompleted: false,
}

export function DailyStatus({ data }: DailyStatusProps) {
  const status = data ?? EMPTY_STATUS

  return (
    <div
      className={cn(
        'mb-4 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] p-4 shadow-[var(--shadow-card)]',
      )}
    >
      <div data-testid="daily-status">
        {/* Profile Stats Row */}
        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-[var(--color-surface-secondary)] px-3 py-3 text-center">
            <div className="text-2xl font-bold text-[var(--color-warning)]">🔥 {status.currentStreak}</div>
            <div className="text-xs text-[var(--color-text-tertiary)]">현재 연속</div>
          </div>
          <div className="rounded-xl bg-[var(--color-surface-secondary)] px-3 py-3 text-center">
            <div className="text-2xl font-bold text-[var(--color-info)]">{status.totalCompletedDays}</div>
            <div className="text-xs text-[var(--color-text-tertiary)]">총 완료일</div>
          </div>
          <div className="rounded-xl bg-[var(--color-surface-secondary)] px-3 py-3 text-center">
            <div className="text-2xl font-bold text-[var(--color-accent-primary)]">{status.longestStreak}</div>
            <div className="text-xs text-[var(--color-text-tertiary)]">최장 연속</div>
          </div>
        </div>

        {/* Today's Checklist */}
        <div className="border-t border-[var(--color-border-default)] pt-3">
          <div className="mb-2 text-xs font-medium text-[var(--color-text-tertiary)]">오늘의 진행</div>
          <div className="flex flex-wrap gap-2">
            <CheckItem data-testid="checklist-reading" label="성경읽기" completed={status.readingCompleted} />
            <CheckItem data-testid="checklist-hasena" label="하세나" completed={status.hasenaCompleted} />
            <CheckItem data-testid="checklist-intro" label="성경개론" completed={status.introCompleted} />
          </div>
        </div>
      </div>
    </div>
  )
}
