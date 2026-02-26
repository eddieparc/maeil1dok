'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { DailySchedule } from '@/types'
import ScheduleItem from './ScheduleItem'

interface ScheduleListProps {
  schedules: DailySchedule[]
  progressMap: Record<string, boolean>
  currentYear: number
  currentMonth: number
  subscriptionId: string
}

const MONTH_NAMES = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월',
]

export default function ScheduleList({
  schedules,
  progressMap,
  currentYear,
  currentMonth,
  subscriptionId,
}: ScheduleListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const todayStr = new Date().toISOString().split('T')[0]

  function navigateMonth(delta: number) {
    let newMonth = currentMonth + delta
    let newYear = currentYear
    if (newMonth < 1) {
      newMonth = 12
      newYear -= 1
    } else if (newMonth > 12) {
      newMonth = 1
      newYear += 1
    }

    const params = new URLSearchParams(searchParams.toString())
    params.set('planId', subscriptionId)
    params.set('year', String(newYear))
    params.set('month', String(newMonth))
    router.push(`/plan?${params.toString()}`)
  }

  const completedCount = schedules.filter((s) => progressMap[s.id]).length

  return (
    <div data-testid="schedule-list">
      {/* Month navigation */}
      <div className="mb-5 flex items-center justify-between px-1">
        <button
          onClick={() => navigateMonth(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50"
          aria-label="이전 달"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900">
            {currentYear}년 {MONTH_NAMES[currentMonth - 1]}
          </h3>
          {schedules.length > 0 && (
            <p className="mt-0.5 text-xs text-gray-400">
              {completedCount}/{schedules.length}일 완료
            </p>
          )}
        </div>

        <button
          onClick={() => navigateMonth(1)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50"
          aria-label="다음 달"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Schedule items */}
      {schedules.length === 0 ? (
        <div className="rounded-xl bg-white px-4 py-10 text-center shadow-sm">
          <p className="text-sm text-gray-400">이 달에 등록된 일정이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map((schedule) => (
            <ScheduleItem
              key={schedule.id}
              schedule={schedule}
              isCompleted={progressMap[schedule.id] ?? false}
              isToday={schedule.date === todayStr}
            />
          ))}
        </div>
      )}
    </div>
  )
}
