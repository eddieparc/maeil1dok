'use client'

import type { DailyStatusData } from '@/types'

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
      <span className={completed ? 'text-green-500' : 'text-gray-300'}>{completed ? '✓' : '○'}</span>
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  )
}

function SkeletonLoader() {
  return (
    <div data-testid="daily-status" className="mx-4 mb-4 p-4 bg-white rounded-2xl shadow-sm">
      {/* Profile Stats Row */}
      <div className="flex justify-around mb-3">
        <div className="text-center">
          <div className="h-8 w-12 bg-gray-200 rounded animate-pulse mx-auto mb-1" />
          <div className="h-3 w-12 bg-gray-200 rounded animate-pulse mx-auto" />
        </div>
        <div className="text-center">
          <div className="h-8 w-12 bg-gray-200 rounded animate-pulse mx-auto mb-1" />
          <div className="h-3 w-12 bg-gray-200 rounded animate-pulse mx-auto" />
        </div>
        <div className="text-center">
          <div className="h-8 w-12 bg-gray-200 rounded animate-pulse mx-auto mb-1" />
          <div className="h-3 w-12 bg-gray-200 rounded animate-pulse mx-auto" />
        </div>
      </div>

      {/* Today's Checklist */}
      <div className="border-t pt-3">
        <div className="h-3 w-16 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="flex gap-3">
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export function DailyStatus({ data }: DailyStatusProps) {
  if (!data) {
    return <SkeletonLoader />
  }

  return (
    <div data-testid="daily-status" className="mx-4 mb-4 p-4 bg-white rounded-2xl shadow-sm">
      {/* Profile Stats Row */}
      <div className="flex justify-around mb-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-500">🔥{data.currentStreak}</div>
          <div className="text-xs text-gray-500">현재 연속</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{data.totalCompletedDays}</div>
          <div className="text-xs text-gray-500">총 완료일</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">{data.longestStreak}</div>
          <div className="text-xs text-gray-500">최장 연속</div>
        </div>
      </div>

      {/* Today's Checklist */}
      <div className="border-t pt-3">
        <div className="text-xs font-medium text-gray-500 mb-2">오늘의 진행</div>
        <div className="flex gap-3">
          <CheckItem data-testid="checklist-reading" label="성경읽기" completed={data.readingCompleted} />
          <CheckItem data-testid="checklist-hasena" label="하세나" completed={data.hasenaCompleted} />
          <CheckItem data-testid="checklist-intro" label="성경개론" completed={data.introCompleted} />
        </div>
      </div>
    </div>
  )
}
