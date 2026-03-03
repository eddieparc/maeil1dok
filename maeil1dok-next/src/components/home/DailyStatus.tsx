'use client'

import type { DailyStatusData } from '@/types'
import { Card, CardBody } from '@/components/ui'

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
    <div data-testid={testId} className="flex items-center gap-1">
      <span className={completed ? 'text-[var(--color-accent-primary)]' : 'text-[var(--color-border-dark)]'}>{completed ? '✓' : '○'}</span>
      <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
    </div>
  )
}

function SkeletonLoader() {
  return (
    <Card variant="elevated" className="mx-4 mb-4 rounded-2xl">
      <CardBody className="p-4">
        {/* Profile Stats Row */}
        <div className="flex justify-around mb-3">
          <div className="text-center">
            <div className="h-8 w-12 bg-[var(--color-border-default)] rounded animate-pulse mx-auto mb-1" />
            <div className="h-3 w-12 bg-[var(--color-border-default)] rounded animate-pulse mx-auto" />
          </div>
          <div className="text-center">
            <div className="h-8 w-12 bg-[var(--color-border-default)] rounded animate-pulse mx-auto mb-1" />
            <div className="h-3 w-12 bg-[var(--color-border-default)] rounded animate-pulse mx-auto" />
          </div>
          <div className="text-center">
            <div className="h-8 w-12 bg-[var(--color-border-default)] rounded animate-pulse mx-auto mb-1" />
            <div className="h-3 w-12 bg-[var(--color-border-default)] rounded animate-pulse mx-auto" />
          </div>
        </div>

        {/* Today's Checklist */}
        <div className="border-t border-[var(--color-border-default)] pt-3">
          <div className="h-3 w-16 bg-[var(--color-border-default)] rounded animate-pulse mb-2" />
          <div className="flex gap-3">
            <div className="h-4 w-16 bg-[var(--color-border-default)] rounded animate-pulse" />
            <div className="h-4 w-16 bg-[var(--color-border-default)] rounded animate-pulse" />
            <div className="h-4 w-16 bg-[var(--color-border-default)] rounded animate-pulse" />
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

export function DailyStatus({ data }: DailyStatusProps) {
  if (!data) {
    return <SkeletonLoader />
  }

  return (
    <Card variant="elevated" className="mx-4 mb-4 rounded-2xl">
      <CardBody className="p-4" data-testid="daily-status">
        {/* Profile Stats Row */}
        <div className="flex justify-around mb-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-500">🔥{data.currentStreak}</div>
            <div className="text-xs text-[var(--color-text-tertiary)]">현재 연속</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[var(--color-info)]">{data.totalCompletedDays}</div>
            <div className="text-xs text-[var(--color-text-tertiary)]">총 완료일</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[var(--color-accent-primary)]">{data.longestStreak}</div>
            <div className="text-xs text-[var(--color-text-tertiary)]">최장 연속</div>
          </div>
        </div>

        {/* Today's Checklist */}
        <div className="border-t border-[var(--color-border-default)] pt-3">
          <div className="text-xs font-medium text-[var(--color-text-tertiary)] mb-2">오늘의 진행</div>
          <div className="flex gap-3">
            <CheckItem data-testid="checklist-reading" label="성경읽기" completed={data.readingCompleted} />
            <CheckItem data-testid="checklist-hasena" label="하세나" completed={data.hasenaCompleted} />
            <CheckItem data-testid="checklist-intro" label="성경개론" completed={data.introCompleted} />
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
