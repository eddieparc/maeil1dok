export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import MultiPlanCalendar, { type PlanCalendarData } from '@/components/calendar/MultiPlanCalendar'

const PLAN_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316']

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>
}) {
  try {
    const params = await searchParams
    const now = new Date()
    const year = parseInt(params.year ?? String(now.getFullYear()), 10)
    const month = parseInt(params.month ?? String(now.getMonth() + 1), 10)

    const supabase = await createClient()
    const repositories = createServerRepositories(supabase)

    const [subscriptions, availablePlans] = await Promise.all([
      repositories.plan.getUserSubscriptions(),
      repositories.plan.getAvailablePlans(),
    ])

    const activeSubscriptions = subscriptions.filter((s) => s.isActive)

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    const plans: PlanCalendarData[] = await Promise.all(
      activeSubscriptions.map(async (sub, index) => {
        const plan = availablePlans.find((p) => p.id === sub.planId)
        const planName = plan?.name ?? `플랜 ${index + 1}`

        let color = PLAN_COLORS[index % PLAN_COLORS.length]
        try {
          const settings = await repositories.plan.getDisplaySettings(sub.id)
          if (settings?.color) color = settings.color
        } catch {
          color = PLAN_COLORS[index % PLAN_COLORS.length]
        }

        const schedules = await repositories.schedule.getSchedulesForPlan(sub.planId, startDate, endDate)
        const scheduleIds = schedules.map((s) => s.id)
        const progress = scheduleIds.length > 0 ? await repositories.progress.bulkGetProgress(sub.id, scheduleIds) : []

        return { subscriptionId: sub.id, planId: sub.planId, planName, color, schedules, progress }
      }),
    )

    return (
      <main style={{ backgroundColor: '#F9F8F6', minHeight: '100vh' }}>
        <MultiPlanCalendar year={year} month={month} plans={plans} />
      </main>
    )
  } catch {
    return (
      <main style={{ backgroundColor: '#F9F8F6', minHeight: '100vh' }}>
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <p className="text-center text-sm text-red-600">캘린더를 불러오는 중 오류가 발생했습니다</p>
        </div>
      </main>
    )
  }
}
