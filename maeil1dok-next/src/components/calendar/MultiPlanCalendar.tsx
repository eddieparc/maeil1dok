'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import CalendarHeader from './CalendarHeader'
import CalendarDayCell, { type CalendarDot } from './CalendarDayCell'
import PlanTogglePanel, { type TogglePlanItem } from './PlanTogglePanel'
import CalendarLegend from './CalendarLegend'
import { generateCalendarDates } from './generateCalendarDates'
import type { DailySchedule } from '@/types/schedule'
import type { UserProgress } from '@/types/progress'

export interface PlanCalendarData {
  subscriptionId: string
  planId: number
  planName: string
  color: string
  schedules: DailySchedule[]
  progress: UserProgress[]
}

interface MultiPlanCalendarProps {
  year: number
  month: number
  plans: PlanCalendarData[]
}

export default function MultiPlanCalendar({ year, month, plans }: MultiPlanCalendarProps) {
  const router = useRouter()
  const [visiblePlanIds, setVisiblePlanIds] = useState<Set<string>>(
    new Set(plans.map((p) => p.subscriptionId)),
  )

  function handleToggle(subscriptionId: string) {
    setVisiblePlanIds((prev) => {
      const next = new Set(prev)
      if (next.has(subscriptionId)) {
        next.delete(subscriptionId)
      } else {
        next.add(subscriptionId)
      }
      return next
    })
  }

  function navigate(newYear: number, newMonth: number) {
    router.push(`/calendar?year=${newYear}&month=${newMonth}`)
  }

  function handlePrevMonth() {
    if (month === 1) navigate(year - 1, 12)
    else navigate(year, month - 1)
  }

  function handleNextMonth() {
    if (month === 12) navigate(year + 1, 1)
    else navigate(year, month + 1)
  }

  function handleToday() {
    const now = new Date()
    navigate(now.getFullYear(), now.getMonth() + 1)
  }

  const calendarDates = generateCalendarDates(year, month)

  // Build a map: dateStr -> dots[]
  const dotsMap = new Map<string, CalendarDot[]>()
  for (const plan of plans) {
    if (!visiblePlanIds.has(plan.subscriptionId)) continue
    const completedIds = new Set(plan.progress.filter((p) => p.isCompleted).map((p) => p.scheduleId))
    for (const schedule of plan.schedules) {
      const existing = dotsMap.get(schedule.date) ?? []
      existing.push({
        subscriptionId: plan.subscriptionId,
        color: plan.color,
        isCompleted: completedIds.has(schedule.id),
        planName: plan.planName,
      })
      dotsMap.set(schedule.date, existing)
    }
  }

  const toggleItems: TogglePlanItem[] = plans.map((p) => ({
    subscriptionId: p.subscriptionId,
    planName: p.planName,
    color: p.color,
  }))

  const visiblePlans = plans
    .filter((p) => visiblePlanIds.has(p.subscriptionId))
    .map((p) => ({ subscriptionId: p.subscriptionId, planName: p.planName, color: p.color }))

  const weekDays = ['일', '월', '화', '수', '목', '금', '토']

  return (
    <div data-testid="multi-plan-calendar" className="flex flex-col gap-4 px-4 py-4">
      <CalendarHeader
        year={year}
        month={month}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
      />

      {plans.length > 1 && (
        <PlanTogglePanel
          plans={toggleItems}
          visiblePlanIds={visiblePlanIds}
          onToggle={handleToggle}
        />
      )}

      <div>
        <div className="mb-1 grid grid-cols-7 gap-1">
          {weekDays.map((day) => (
            <div key={day} className="py-1 text-center text-xs font-semibold text-gray-500">
              {day}
            </div>
          ))}
        </div>
        <div data-testid="calendar-grid" className="grid grid-cols-7 gap-1">
          {calendarDates.map((calDate) => (
            <CalendarDayCell key={calDate.dateStr} date={calDate} dots={dotsMap.get(calDate.dateStr) ?? []} />
          ))}
        </div>
      </div>

      <CalendarLegend visiblePlans={visiblePlans} />
    </div>
  )
}
