export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import PlanPageClient, { PlanPageEmpty } from './PlanPageClient'
import styles from './plan.module.css'

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
      return <PlanPageEmpty />
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
      <PlanPageClient
        schedules={schedules}
        progressMap={progressMap}
        currentYear={year}
        currentMonth={month}
        subscriptionId={selectedSub.id}
        subscriptions={activeSubscriptions}
        plans={availablePlans}
        selectedSubscriptionId={selectedSub.id}
      />
    )
  } catch {
    return (
      <div className={styles.container}>
        <div className={styles.fixedArea}>
          <div className={styles.headerRow}>
            <h1 className={styles.headerTitle}>성경통독표</h1>
          </div>
        </div>
        <div className={styles.scrollArea}>
          <div className={styles.errorState}>
            <p className={styles.errorText}>
              일정을 불러오는 중 오류가 발생했습니다
            </p>
          </div>
        </div>
      </div>
    )
  }
}
