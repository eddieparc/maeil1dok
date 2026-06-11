export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { Container } from '@/components/ui'
import HomeHero from '@/components/home/HomeHero'
import { DailyStatus } from '@/components/home/DailyStatus'
import ReadingCardStack from '@/components/home/ReadingCardStack'
import QuickAccessGrid from '@/components/home/QuickAccessGrid'
import type { PastIncompleteData } from '@/components/home/ReadingCardStack.utils'
import type { DailySchedule } from '@/types/schedule'
import type { DailyStatusData } from '@/types'

export default async function HomePage() {
  try {
    const supabase = await createClient()
    const repositories = createServerRepositories(supabase)

    const user = await repositories.auth.getUser()

    if (!user) {
      return (
        <Container fullHeight className="flex items-center justify-center">
          <p className="text-center text-sm text-[var(--color-text-tertiary)]">로그인이 필요합니다</p>
        </Container>
      )
    }

    const today = new Date().toISOString().split('T')[0]
    const [todaySchedule, subscriptions, dailyStatus, hasenaStatus] = await Promise.all([
      repositories.schedule.getCurrentSchedule(),
      repositories.plan.getUserSubscriptions(),
      supabase.rpc('get_daily_status', { p_user_id: user.id, p_date: today }),
      supabase
        .from('hasena_records')
        .select('is_completed')
        .eq('user_id', user.id)
        .eq('date', today)
        .single(),
    ])

    const dailyStatusData: DailyStatusData | null = dailyStatus.data?.[0] ?? null
    const hasenaCompleted = hasenaStatus.data?.is_completed ?? false

    // Get display name from profile (throws NotFoundError if no profile row)
    let displayName: string
    try {
      const profile = await repositories.profile.getProfile(user.id)
      displayName = profile.nickname || (user.email?.split('@')[0] ?? '성도')
    } catch {
      displayName = user.email?.split('@')[0] ?? '성도'
    }

    const activeSubscription = subscriptions.find((s) => s.isActive) ?? null

    // Fetch today's progress if active subscription and schedule exist
    let todayProgress = null
    if (activeSubscription && todaySchedule) {
      todayProgress = await repositories.progress.getProgress(activeSubscription.id, todaySchedule.id)
    }

    // Check past 7 days for incomplete readings
    let pastIncomplete: PastIncompleteData | null = null
    if (activeSubscription) {
      const pastDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (i + 1))
        return d.toISOString().split('T')[0]
      })

      const pastSchedules = await Promise.all(
        pastDates.map((date) => repositories.schedule.getScheduleByDate(date)),
      )

      const validPastSchedules = pastSchedules
        .map((schedule, i) => (schedule ? { schedule, date: pastDates[i] } : null))
        .filter((item): item is { schedule: DailySchedule; date: string } => item !== null)

      if (validPastSchedules.length > 0) {
        const scheduleIds = validPastSchedules.map((s) => s.schedule.id)
        const pastProgress = await repositories.progress.bulkGetProgress(
          activeSubscription.id,
          scheduleIds,
        )
        const completedIds = new Set(
          pastProgress.filter((p) => p.isCompleted).map((p) => p.scheduleId),
        )
        const firstIncomplete = validPastSchedules.find((s) => !completedIds.has(s.schedule.id))

        if (firstIncomplete) {
          pastIncomplete = {
            date: firstIncomplete.date,
            schedule: firstIncomplete.schedule,
          }
        }
      }
    }

    return (
      <Container fullHeight>
        <HomeHero displayName={displayName} />
        <DailyStatus data={dailyStatusData} />
        <ReadingCardStack
          todaySchedule={todaySchedule}
          todayProgress={todayProgress}
          pastIncomplete={pastIncomplete}
          hasenaCompleted={hasenaCompleted}
        />
        <QuickAccessGrid userId={user.id} />
      </Container>
    )
  } catch {
    return (
      <Container fullHeight className="flex items-center justify-center">
        <p className="text-center text-sm text-[var(--color-status-error)]">페이지를 불러오는 중 오류가 발생했습니다</p>
      </Container>
    )
}
}
