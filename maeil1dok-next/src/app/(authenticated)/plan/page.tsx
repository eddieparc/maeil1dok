export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import PlanSelector from '@/components/schedule/PlanSelector'
import ScheduleList from '@/components/schedule/ScheduleList'

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string; year?: string; month?: string }>
}) {
  try {
    const params = await searchParams
    const supabase = await createClient()
    const repositories = createServerRepositories(supabase)

    const [subscriptions, availablePlans] = await Promise.all([
      repositories.plan.getUserSubscriptions(),
      repositories.plan.getAvailablePlans(),
    ])

    const activeSubscriptions = subscriptions.filter((s) => s.isActive)

    // No active subscriptions — empty state
    if (activeSubscriptions.length === 0) {
      return (
        <main style={{ backgroundColor: '#F9F8F6', minHeight: '100vh' }}>
          <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
            <div className="rounded-xl bg-white px-6 py-10 text-center shadow-sm">
              <p className="text-sm text-gray-500">구독 중인 플랜이 없습니다.</p>
              <p className="mt-1 text-sm text-gray-500">플랜을 구독해주세요.</p>
              <Link
                href="/plans"
                className="mt-4 inline-block rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm"
                style={{ backgroundColor: '#3B82F6' }}
              >
                플랜 둘러보기
              </Link>
            </div>
          </div>
        </main>
      )
    }

    // Determine selected subscription
    const now = new Date()
    const year = parseInt(params.year ?? String(now.getFullYear()), 10)
    const month = parseInt(params.month ?? String(now.getMonth() + 1), 10)

    const selectedSub =
      activeSubscriptions.find((s) => s.id === params.planId) ?? activeSubscriptions[0]

    // Compute date range for the month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // Fetch schedules and progress
    const schedules = await repositories.schedule.getSchedulesForPlan(
      selectedSub.planId,
      startDate,
      endDate,
    )

    const scheduleIds = schedules.map((s) => s.id)
    const progressList =
      scheduleIds.length > 0
        ? await repositories.progress.bulkGetProgress(selectedSub.id, scheduleIds)
        : []

    const progressMap: Record<string, boolean> = {}
    for (const p of progressList) {
      progressMap[p.scheduleId] = p.isCompleted
    }

    return (
      <main style={{ backgroundColor: '#F9F8F6', minHeight: '100vh' }}>
        <div className="mx-auto max-w-md px-4 py-6">
          <PlanSelector
            subscriptions={activeSubscriptions}
            plans={availablePlans}
            selectedSubscriptionId={selectedSub.id}
          />
          <ScheduleList
            schedules={schedules}
            progressMap={progressMap}
            currentYear={year}
            currentMonth={month}
            subscriptionId={selectedSub.id}
          />
        </div>
      </main>
    )
  } catch {
    return (
      <main style={{ backgroundColor: '#F9F8F6', minHeight: '100vh' }}>
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <p className="text-center text-sm text-red-600">
            일정을 불러오는 중 오류가 발생했습니다
          </p>
        </div>
      </main>
    )
  }
}
