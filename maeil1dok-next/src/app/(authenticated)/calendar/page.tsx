export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import MultiPlanCalendar, { type PlanCalendarData } from '@/components/calendar/MultiPlanCalendar'
import Container from '@/components/ui/Container'
import PageHeader from '@/components/ui/PageHeader'
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

    const subscriptionIds = activeSubscriptions.map((sub) => sub.id)
    const planIds = [...new Set(activeSubscriptions.map((sub) => sub.planId))]

    const [displaySettingsList, allSchedules] = await Promise.all([
      subscriptionIds.length > 0
        ? repositories.plan.getDisplaySettingsForSubscriptions(subscriptionIds)
        : Promise.resolve([]),
      planIds.length > 0
        ? repositories.schedule.getSchedulesForPlans(planIds, startDate, endDate)
        : Promise.resolve([]),
    ])

    const allScheduleIds = allSchedules.map((s) => s.id)
    const allProgress =
      subscriptionIds.length > 0 && allScheduleIds.length > 0
        ? await repositories.progress.bulkGetProgressForSubscriptions(subscriptionIds, allScheduleIds)
        : []

    const colorBySubscriptionId = new Map(displaySettingsList.map((ds) => [ds.subscriptionId, ds.color]))

    const schedulesByPlanId = new Map<number, typeof allSchedules>()
    for (const schedule of allSchedules) {
      const existing = schedulesByPlanId.get(schedule.planId) ?? []
      existing.push(schedule)
      schedulesByPlanId.set(schedule.planId, existing)
    }

    const progressBySubscriptionId = new Map<string, typeof allProgress>()
    for (const entry of allProgress) {
      const existing = progressBySubscriptionId.get(entry.subscriptionId) ?? []
      existing.push(entry)
      progressBySubscriptionId.set(entry.subscriptionId, existing)
    }

    const plans: PlanCalendarData[] = activeSubscriptions.map((sub, index) => {
      const plan = availablePlans.find((p) => p.id === sub.planId)
      const planName = plan?.name ?? `플랜 ${index + 1}`
      const color = colorBySubscriptionId.get(sub.id) ?? PLAN_COLORS[index % PLAN_COLORS.length]
      const schedules = schedulesByPlanId.get(sub.planId) ?? []
      const progress = progressBySubscriptionId.get(sub.id) ?? []

      return { subscriptionId: sub.id, planId: sub.planId, planName, color, schedules, progress }
    })

    return (
      <Container fullHeight>
        <PageHeader title="내 캘린더" />
        <MultiPlanCalendar year={year} month={month} plans={plans} />
      </Container>
    )
  } catch {
    return (
      <Container fullHeight>
        <PageHeader title="내 캘린더" />
        <div className="flex min-h-[50vh] items-center justify-center px-4">
          <p className="text-center text-sm text-[var(--color-danger)]">캘린더를 불러오는 중 오류가 발생했습니다</p>
        </div>
      </Container>
    )
  }
}
